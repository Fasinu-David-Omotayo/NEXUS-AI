from __future__ import annotations

import asyncio
import json
import os
import platform
import sys
from pathlib import Path
from urllib.parse import urlparse

import httpx
import websockets
from dotenv import load_dotenv

load_dotenv()

from desktop_agent import app, desktop_command, DesktopCommand


def backend_base_url() -> str:
    value = os.getenv(
        "NEXUS_BACKEND_URL",
        "https://nexus-ai-backend-mswg.onrender.com",
    ).rstrip("/")
    if not value.startswith(("https://", "http://")):
        raise ValueError("NEXUS_BACKEND_URL must start with https:// or http://")
    return value


def websocket_url() -> str:
    base = backend_base_url()
    if base.startswith("https://"):
        return "wss://" + base[len("https://"):] + "/v2/desktop/ws"
    return "ws://" + base[len("http://"):] + "/v2/desktop/ws"


def credential_path() -> Path:
    base = os.getenv("APPDATA")
    root = Path(base) / "NexusAI" if base else Path.home() / ".nexus-ai"
    root.mkdir(parents=True, exist_ok=True)
    return root / "desktop_credentials.json"


def load_credentials() -> dict[str, str] | None:
    path = credential_path()
    try:
        raw = json.loads(path.read_text(encoding="utf-8"))
        if (
            isinstance(raw, dict)
            and isinstance(raw.get("device_id"), str)
            and isinstance(raw.get("device_token"), str)
            and len(raw["device_token"]) >= 40
        ):
            return raw
    except (OSError, ValueError, TypeError):
        pass
    return None


def save_credentials(credentials: dict[str, str]) -> None:
    path = credential_path()
    temporary = path.with_suffix(".tmp")
    temporary.write_text(json.dumps(credentials), encoding="utf-8")
    os.replace(temporary, path)
    try:
        os.chmod(path, 0o600)
    except OSError:
        pass
    print(f"Nexus device credentials saved to: {path}")


async def pair_device() -> dict[str, str] | None:
    # Pairing requires a person at this computer to provide a short-lived
    # code generated inside their signed-in Nexus AI account.
    if not sys.stdin.isatty():
        print("Nexus desktop is not paired. Run the pairing app interactively to authorize this computer.")
        return None

    code = input("Enter the one-time Nexus pairing code shown in your account (10-minute expiry): ").strip()
    if not code:
        print("No pairing code entered. Desktop control remains disabled.")
        return None

    default_name = platform.node() or "Windows PC"
    name = input(f"Device name [{default_name}]: ").strip() or default_name
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.post(
                backend_base_url() + "/v2/desktop/pair/claim",
                json={
                    "code": code,
                    "device_name": name[:120],
                    "operating_system": f"{platform.system()} {platform.release()}"[:80],
                },
            )
    except httpx.HTTPError as error:
        print("Could not reach Nexus pairing service:", type(error).__name__)
        return None

    if response.status_code != 200:
        try:
            detail = response.json().get("detail", "Pairing failed.")
        except (ValueError, AttributeError):
            detail = "Pairing failed."
        print(f"Nexus pairing was not completed: {detail}")
        return None

    body = response.json()
    credentials = {
        "device_id": str(body.get("device_id") or ""),
        "device_token": str(body.get("device_token") or ""),
    }
    if not credentials["device_id"] or len(credentials["device_token"]) < 40:
        print("Pairing response was incomplete. Desktop control remains disabled.")
        return None

    save_credentials(credentials)
    print("This computer is now paired to your Nexus account.")
    return credentials


async def get_or_pair_credentials() -> dict[str, str] | None:
    credentials = load_credentials()
    if credentials:
        return credentials
    return await pair_device()


async def keep_connected() -> None:
    credentials = await get_or_pair_credentials()
    if not credentials:
        # Fail closed. Never connect using the deprecated shared token.
        return

    url = websocket_url()
    while True:
        try:
            print("Connecting this paired Nexus desktop to the relay...")
            async with websockets.connect(
                url,
                open_timeout=30,
                ping_interval=20,
                ping_timeout=20,
                close_timeout=10,
                max_size=1_000_000,
            ) as connection:
                await connection.send(json.dumps({
                    "type": "authenticate",
                    "device_id": credentials["device_id"],
                    "device_token": credentials["device_token"],
                }))
                first = json.loads(await asyncio.wait_for(connection.recv(), timeout=10))
                if not isinstance(first, dict) or first.get("type") != "authenticated":
                    raise RuntimeError("The server did not authenticate this paired device.")
                print("Paired Nexus desktop is connected. Close this app to stop access.")

                async for raw_message in connection:
                    try:
                        message = json.loads(raw_message)
                        request_id = message.get("id")
                        command = message.get("command")
                        if not isinstance(request_id, str):
                            continue
                        if not isinstance(command, str):
                            result = {
                                "handled": True,
                                "success": False,
                                "reply": "The desktop command was invalid.",
                            }
                        else:
                            result = await asyncio.to_thread(
                                desktop_command,
                                DesktopCommand(command=command),
                            )
                        await connection.send(json.dumps({
                            "id": request_id,
                            "result": result,
                        }))
                    except Exception as error:
                        print("Could not process a desktop request:", type(error).__name__)
        except asyncio.CancelledError:
            raise
        except Exception as error:
            print(
                "Nexus desktop relay disconnected:",
                type(error).__name__,
                "- reconnecting in 5 seconds.",
            )
        await asyncio.sleep(5)


@app.on_event("startup")
async def start_remote_agent() -> None:
    app.state.remote_agent_task = asyncio.create_task(keep_connected())


@app.on_event("shutdown")
async def stop_remote_agent() -> None:
    task = getattr(app.state, "remote_agent_task", None)
    if task is not None:
        task.cancel()
        try:
            await task
        except asyncio.CancelledError:
            pass
