"""Per-user Nexus desktop pairing and command relay.

All database administration uses the server-only Supabase service role key.
Desktop credentials are random, per-device, and stored only as SHA-256 hashes.
"""
from __future__ import annotations

import asyncio
import hashlib
import hmac
import os
import secrets
import string
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

import httpx
from fastapi import APIRouter, Header, HTTPException, WebSocket, WebSocketDisconnect
from pydantic import BaseModel, Field

router = APIRouter(prefix="/v2/desktop", tags=["secure desktop"])

SUPABASE_URL = os.getenv("SUPABASE_URL", "").rstrip("/")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY", "")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")

# In-memory connections are intentionally keyed by device id. For a multi-instance
# deployment, replace this relay state with a shared broker before scaling workers.
active_agents: dict[str, WebSocket] = {}
pending_responses: dict[str, tuple[str, WebSocket, asyncio.Future]] = {}
connection_lock = asyncio.Lock()


class PairingCodeRequest(BaseModel):
    device_name: str = Field(default="My Windows PC", min_length=1, max_length=120)


class ClaimCodeRequest(BaseModel):
    code: str = Field(min_length=6, max_length=12)
    device_name: str = Field(min_length=1, max_length=120)
    operating_system: str = Field(default="Windows", max_length=80)


class CommandRequest(BaseModel):
    command: str = Field(min_length=2, max_length=300)


def _require_service_key() -> None:
    if not SUPABASE_URL or not SUPABASE_ANON_KEY or not SUPABASE_SERVICE_ROLE_KEY:
        raise HTTPException(
            status_code=503,
            detail="Secure desktop pairing is not configured on the server.",
        )


def _admin_headers(prefer: str | None = None) -> dict[str, str]:
    _require_service_key()
    headers = {
        "apikey": SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
        "Content-Type": "application/json",
    }
    if prefer:
        headers["Prefer"] = prefer
    return headers


def _digest(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


async def _authenticated_user(authorization: str | None) -> dict[str, Any]:
    if not authorization or not authorization.startswith("Bearer ") or not authorization[7:].strip():
        raise HTTPException(status_code=401, detail="Please sign in to Nexus AI.")
    if not SUPABASE_URL or not SUPABASE_ANON_KEY:
        raise HTTPException(status_code=503, detail="Authentication is not configured.")
    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            response = await client.get(
                f"{SUPABASE_URL}/auth/v1/user",
                headers={
                    "apikey": SUPABASE_ANON_KEY,
                    "Authorization": authorization,
                },
            )
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=503, detail="Could not verify your Nexus AI session.") from exc
    if response.status_code != 200:
        raise HTTPException(status_code=401, detail="Your session is invalid or expired.")
    user = response.json()
    if not isinstance(user, dict) or not user.get("id"):
        raise HTTPException(status_code=401, detail="Could not verify your Nexus AI account.")
    return user


async def _owned_device(user_id: str, device_id: str) -> dict[str, Any]:
    _require_service_key()
    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            response = await client.get(
                f"{SUPABASE_URL}/rest/v1/desktop_devices",
                params={
                    "select": "id,user_id,device_name,operating_system,status,paired_at,last_seen_at,revoked_at,created_at",
                    "id": f"eq.{device_id}",
                    "user_id": f"eq.{user_id}",
                    "limit": "1",
                },
                headers=_admin_headers(),
            )
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=503, detail="Could not read your paired devices.") from exc
    if response.status_code != 200:
        raise HTTPException(status_code=503, detail="Could not read your paired devices.")
    rows = response.json()
    if not rows:
        raise HTTPException(status_code=404, detail="Paired device not found.")
    return rows[0]


@router.post("/pairing-code")
async def create_pairing_code(
    payload: PairingCodeRequest,
    authorization: str | None = Header(default=None, alias="Authorization"),
):
    user = await _authenticated_user(authorization)
    _require_service_key()

    alphabet = string.ascii_uppercase + string.digits
    code = "".join(secrets.choice(alphabet) for _ in range(8))
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=10)
    row = {
        "user_id": user["id"],
        "code_hash": _digest(code),
        "expires_at": expires_at.isoformat(),
    }
    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            response = await client.post(
                f"{SUPABASE_URL}/rest/v1/desktop_pairing_codes",
                json=row,
                headers=_admin_headers("return=minimal"),
            )
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=503, detail="Could not create a pairing code.") from exc
    if response.status_code not in (200, 201, 204):
        print("Pairing code insert failed:", response.status_code, response.text[:300])
        raise HTTPException(status_code=503, detail="Could not create a pairing code.")
    # The plaintext code is returned once. Only its hash is persisted.
    return {"code": code, "expires_at": expires_at.isoformat(), "device_name": payload.device_name}


@router.post("/pair/claim")
async def claim_pairing_code(payload: ClaimCodeRequest):
    _require_service_key()
    code = payload.code.strip().upper()
    if not code.isalnum():
        raise HTTPException(status_code=400, detail="The pairing code is invalid.")
    device_token = secrets.token_urlsafe(48)
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(
                f"{SUPABASE_URL}/rest/v1/rpc/claim_nexus_desktop_pairing",
                json={
                    "p_code_hash": _digest(code),
                    "p_device_name": payload.device_name.strip(),
                    "p_operating_system": payload.operating_system.strip(),
                    "p_token_hash": _digest(device_token),
                },
                headers=_admin_headers(),
            )
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=503, detail="Could not complete device pairing.") from exc
    if response.status_code not in (200, 201):
        if response.status_code in (400, 404, 409):
            raise HTTPException(status_code=400, detail="Pairing code is invalid, expired, or already used.")
        print("Pairing claim failed:", response.status_code, response.text[:300])
        raise HTTPException(status_code=503, detail="Could not complete device pairing.")
    rows = response.json()
    if not isinstance(rows, list) or not rows or not rows[0].get("device_id"):
        raise HTTPException(status_code=503, detail="Pairing completed without a valid device response.")
    # The agent must securely save this token locally. It is never stored in plaintext on the server.
    return {"device_id": rows[0]["device_id"], "device_token": device_token, "paired": True}


@router.get("/devices")
async def list_devices(
    authorization: str | None = Header(default=None, alias="Authorization"),
):
    user = await _authenticated_user(authorization)
    _require_service_key()
    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            response = await client.get(
                f"{SUPABASE_URL}/rest/v1/desktop_devices",
                params={
                    "select": "id,device_name,operating_system,status,paired_at,last_seen_at,revoked_at,created_at",
                    "user_id": f"eq.{user['id']}",
                    "order": "created_at.desc",
                },
                headers=_admin_headers(),
            )
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=503, detail="Could not load your devices.") from exc
    if response.status_code != 200:
        raise HTTPException(status_code=503, detail="Could not load your devices.")
    return {"devices": response.json()}


@router.post("/devices/{device_id}/revoke")
async def revoke_device(
    device_id: str,
    authorization: str | None = Header(default=None, alias="Authorization"),
):
    user = await _authenticated_user(authorization)
    device = await _owned_device(user["id"], device_id)
    if device.get("status") == "revoked":
        return {"revoked": True, "device_id": device_id}
    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            response = await client.patch(
                f"{SUPABASE_URL}/rest/v1/desktop_devices",
                params={"id": f"eq.{device_id}", "user_id": f"eq.{user['id']}"},
                json={"status": "revoked", "revoked_at": datetime.now(timezone.utc).isoformat()},
                headers=_admin_headers("return=minimal"),
            )
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=503, detail="Could not revoke this device.") from exc
    if response.status_code not in (200, 204):
        raise HTTPException(status_code=503, detail="Could not revoke this device.")
    async with connection_lock:
        connection = active_agents.pop(device_id, None)
    if connection is not None:
        try:
            await connection.close(code=1008, reason="Device pairing revoked")
        except Exception:
            pass
    for request_id, (pending_device_id, _, future) in list(pending_responses.items()):
        if pending_device_id == device_id and not future.done():
            future.set_exception(RuntimeError("This desktop device has been revoked."))
            pending_responses.pop(request_id, None)
    return {"revoked": True, "device_id": device_id}


@router.get("/status")
async def desktop_status(
    authorization: str | None = Header(default=None, alias="Authorization"),
):
    user = await _authenticated_user(authorization)
    _require_service_key()
    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            response = await client.get(
                f"{SUPABASE_URL}/rest/v1/desktop_devices",
                params={
                    "select": "id,status",
                    "user_id": f"eq.{user['id']}",
                    "status": "neq.revoked",
                },
                headers=_admin_headers(),
            )
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=503, detail="Could not check desktop status.") from exc
    if response.status_code != 200:
        raise HTTPException(status_code=503, detail="Could not check desktop status.")
    devices = response.json()
    online_ids = set(active_agents)
    return {
        "online": any(device["id"] in online_ids for device in devices),
        "devices": [
            {"id": device["id"], "online": device["id"] in online_ids}
            for device in devices
        ],
    }


@router.post("/command")
async def desktop_command(
    payload: CommandRequest,
    authorization: str | None = Header(default=None, alias="Authorization"),
):
    user = await _authenticated_user(authorization)
    _require_service_key()
    # Select only an active, non-revoked device belonging to this signed-in user.
    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            response = await client.get(
                f"{SUPABASE_URL}/rest/v1/desktop_devices",
                params={
                    "select": "id,status",
                    "user_id": f"eq.{user['id']}",
                    "status": "neq.revoked",
                    "order": "last_seen_at.desc.nullslast",
                },
                headers=_admin_headers(),
            )
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=503, detail="Could not find your paired desktop.") from exc
    if response.status_code != 200:
        raise HTTPException(status_code=503, detail="Could not find your paired desktop.")
    device = next((item for item in response.json() if item["id"] in active_agents), None)
    if not device:
        return {"handled": True, "success": False, "reply": "No paired Nexus desktop is online for your account."}

    device_id = device["id"]
    connection = active_agents.get(device_id)
    if connection is None:
        return {"handled": True, "success": False, "reply": "Your paired desktop is offline."}
    request_id = uuid.uuid4().hex
    future = asyncio.get_running_loop().create_future()
    pending_responses[request_id] = (device_id, connection, future)
    try:
        await connection.send_json({"id": request_id, "command": payload.command.strip()})
        return await asyncio.wait_for(future, timeout=20.0)
    except asyncio.TimeoutError as exc:
        raise HTTPException(status_code=504, detail="Your desktop did not respond in time.") from exc
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=503, detail="Your desktop connection was interrupted.") from exc
    finally:
        pending_responses.pop(request_id, None)


@router.websocket("/ws")
async def desktop_agent_socket(websocket: WebSocket):
    """Authenticate and maintain one secure connection per paired device.

    Once a WebSocket is accepted, errors must be reported with WebSocket close
    frames, not HTTPException responses. Raising HTTPException after accept()
    makes Starlette attempt an HTTP response on an established WebSocket and
    can produce Uvicorn's "Expected websocket.send or websocket.close" error.
    """
    device_id: str | None = None
    accepted = False

    try:
        # Validate server configuration before accepting the WebSocket. If the
        # service is misconfigured, close the handshake cleanly with a policy
        # failure rather than raising an HTTP exception after accept().
        try:
            _require_service_key()
        except HTTPException:
            await websocket.close(code=1011, reason="Secure desktop is not configured")
            return

        await websocket.accept()
        accepted = True

        try:
            first = await asyncio.wait_for(websocket.receive_json(), timeout=10)
        except asyncio.TimeoutError:
            await websocket.close(code=1008, reason="Authentication timed out")
            return
        except WebSocketDisconnect:
            return
        except Exception:
            await websocket.close(code=1008, reason="Valid authentication message required")
            return

        if not isinstance(first, dict) or first.get("type") != "authenticate":
            await websocket.close(code=1008, reason="Authentication required")
            return

        candidate_device_id = first.get("device_id")
        token = first.get("device_token")
        if (
            not isinstance(candidate_device_id, str)
            or not candidate_device_id
            or not isinstance(token, str)
            or len(token) < 40
        ):
            await websocket.close(code=1008, reason="Invalid device credentials")
            return

        device_id = candidate_device_id

        try:
            async with httpx.AsyncClient(timeout=8.0) as client:
                response = await client.get(
                    f"{SUPABASE_URL}/rest/v1/desktop_devices",
                    params={
                        "select": "id,token_hash,status",
                        "id": f"eq.{device_id}",
                        "limit": "1",
                    },
                    headers=_admin_headers(),
                )
        except httpx.HTTPError as exc:
            print("Secure desktop credential lookup failed:", type(exc).__name__)
            await websocket.close(code=1013, reason="Could not verify device")
            return
        except HTTPException:
            await websocket.close(code=1011, reason="Secure desktop is not configured")
            return

        if response.status_code != 200:
            print("Secure desktop credential lookup returned HTTP", response.status_code)
            await websocket.close(code=1013, reason="Could not verify device")
            return

        try:
            rows = response.json()
        except ValueError:
            rows = []

        if (
            not isinstance(rows, list)
            or not rows
            or rows[0].get("status") == "revoked"
            or not hmac.compare_digest(
                str(rows[0].get("token_hash") or ""),
                _digest(token),
            )
        ):
            await websocket.close(code=1008, reason="Device is not paired or was revoked")
            return

        await websocket.send_json({"type": "authenticated", "device_id": device_id})

        async with connection_lock:
            previous = active_agents.get(device_id)
            active_agents[device_id] = websocket

        if previous is not None and previous is not websocket:
            try:
                await previous.close(code=1012, reason="Device reconnected")
            except Exception:
                pass

        # Mark online best-effort. A database status update failure must not
        # terminate an otherwise authenticated relay connection.
        try:
            async with httpx.AsyncClient(timeout=8.0) as client:
                status_response = await client.patch(
                    f"{SUPABASE_URL}/rest/v1/desktop_devices",
                    params={"id": f"eq.{device_id}", "status": "neq.revoked"},
                    json={
                        "status": "online",
                        "last_seen_at": datetime.now(timezone.utc).isoformat(),
                    },
                    headers=_admin_headers("return=minimal"),
                )
            if status_response.status_code not in (200, 204):
                print("Secure desktop online-state update returned HTTP", status_response.status_code)
        except Exception as exc:
            print("Secure desktop online-state update failed:", type(exc).__name__)

        while True:
            message = await websocket.receive_json()
            if not isinstance(message, dict) or not isinstance(message.get("id"), str):
                continue

            pending = pending_responses.get(message["id"])
            if pending is None:
                continue

            pending_device, pending_socket, future = pending
            if pending_device != device_id or pending_socket is not websocket or future.done():
                continue

            result = message.get("result")
            future.set_result(
                result
                if isinstance(result, dict)
                else {
                    "handled": True,
                    "success": False,
                    "reply": "Invalid desktop response.",
                }
            )

    except WebSocketDisconnect:
        pass
    except asyncio.CancelledError:
        raise
    except Exception as exc:
        print("Secure desktop websocket ended:", type(exc).__name__, str(exc)[:200])
        # Do not raise HTTPException after websocket.accept(). Close the socket
        # only if it was accepted and is still open.
        if accepted:
            try:
                await websocket.close(code=1011, reason="Desktop relay error")
            except Exception:
                pass
    finally:
        if device_id is not None:
            async with connection_lock:
                if active_agents.get(device_id) is websocket:
                    active_agents.pop(device_id, None)
                    try:
                        async with httpx.AsyncClient(timeout=5.0) as client:
                            await client.patch(
                                f"{SUPABASE_URL}/rest/v1/desktop_devices",
                                params={"id": f"eq.{device_id}", "status": "neq.revoked"},
                                json={"status": "offline"},
                                headers=_admin_headers("return=minimal"),
                            )
                    except Exception as exc:
                        print("Secure desktop offline-state update failed:", type(exc).__name__)

            for request_id, (pending_device, pending_socket, future) in list(pending_responses.items()):
                if pending_device == device_id and pending_socket is websocket and not future.done():
                    future.set_exception(RuntimeError("Desktop disconnected."))
                    pending_responses.pop(request_id, None)
