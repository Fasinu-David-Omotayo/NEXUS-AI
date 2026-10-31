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


def request_pairing_details(default_name: str) -> tuple[str, str] | None:
    """Collect pairing details with a Windows dialog, falling back to terminal input."""
    if sys.stdin is not None and sys.stdin.isatty():
        code = input("Enter the one-time Nexus pairing code shown in your account (10-minute expiry): ").strip()
        if not code:
            print("No pairing code entered. Desktop control remains disabled.")
            return None
        name = input(f"Device name [{default_name}]: ").strip() or default_name
        return code, name

    try:
        import tkinter as tk
        from tkinter import messagebox, simpledialog

        root = tk.Tk()
        root.withdraw()
        root.attributes("-topmost", True)
        try:
            code = simpledialog.askstring(
                "Connect Nexus AI Desktop",
                "1. Generate a code on Nexus AI > Desktop devices.\n2. Paste the code below.\n\nThe code expires in 10 minutes:",
                parent=root,
            )
            if not code or not code.strip():
                return None
            name = simpledialog.askstring(
                "Name this computer",
                "Choose a name for this computer:",
                initialvalue=default_name,
                parent=root,
            )
            if name is None:
                return None
            return code.strip(), (name.strip() or default_name)
        finally:
            root.destroy()
    except Exception as error:
        print("Could not open the Nexus pairing window:", type(error).__name__)
        return None


def show_pairing_message(title: str, message: str, *, error: bool = False) -> None:
    """Show a native Windows message when no console is available."""
    if sys.stdin is not None and sys.stdin.isatty():
        print(f"{title}: {message}")
        return
    try:
        import tkinter as tk
        from tkinter import messagebox

        root = tk.Tk()
        root.withdraw()
        root.attributes("-topmost", True)
        try:
            if error:
                messagebox.showerror(title, message, parent=root)
            else:
                messagebox.showinfo(title, message, parent=root)
        finally:
            root.destroy()
    except Exception:
        pass


async def pair_device() -> dict[str, str] | None:
    # Pairing requires a person at this computer to provide a short-lived
    # code generated inside their signed-in Nexus AI account.
    default_name = platform.node() or "Windows PC"
    details = request_pairing_details(default_name)
    if not details:
        show_pairing_message(
            "Nexus AI Desktop",
            "Pairing was cancelled. Desktop control remains disabled.",
            error=True,
        )
        return None
    code, name = details

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
        show_pairing_message(
            "Nexus AI Desktop",
            f"Could not reach the Nexus pairing service ({type(error).__name__}). Check your internet connection and try again.",
            error=True,
        )
        return None

    if response.status_code != 200:
        try:
            detail = response.json().get("detail", "Pairing failed.")
        except (ValueError, AttributeError):
            detail = "Pairing failed."
        show_pairing_message("Nexus AI Desktop", str(detail), error=True)
        return None

    body = response.json()
    credentials = {
        "device_id": str(body.get("device_id") or ""),
        "device_token": str(body.get("device_token") or ""),
    }
    if not credentials["device_id"] or len(credentials["device_token"]) < 40:
        show_pairing_message(
            "Nexus AI Desktop",
            "The pairing response was incomplete. Desktop control remains disabled.",
            error=True,
        )
        return None

    save_credentials(credentials)
    show_pairing_message(
        "Nexus AI Desktop",
        "This computer is now paired to your Nexus AI account. You can close this message; the desktop companion will continue connecting in the background.",
    )
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
            # A revoked device is intentionally rejected by the server with
            # WebSocket close code 1008 and this reason. The previous behavior
            # kept retrying the now-invalid saved token forever, so the user
            # could never pair the same computer again.
            close_frame = getattr(error, "rcvd", None)
            close_code = getattr(error, "code", None)
            close_reason = getattr(error, "reason", "") or ""
            if close_frame is not None:
                close_code = getattr(close_frame, "code", close_code)
                close_reason = getattr(close_frame, "reason", close_reason) or close_reason

            revoked_or_unpaired = (
                close_code == 1008
                and (
                    "revoked" in close_reason.lower()
                    or "not paired" in close_reason.lower()
                )
            )
            if revoked_or_unpaired:
                print("This Nexus desktop pairing was revoked. Clearing the old credentials and requesting a new pairing.")
                try:
                    credential_path().unlink(missing_ok=True)
                except OSError as clear_error:
                    print("Could not clear revoked Nexus credentials:", type(clear_error).__name__)
                    return

                show_pairing_message(
                    "Nexus AI Desktop",
                    "This computer's previous access was revoked. Generate a fresh one-time pairing code in Nexus AI > Desktop devices. This computer will now ask you for that code.",
                    error=True,
                )
                credentials = await pair_device()
                if not credentials:
                    # Do not keep retrying a revoked token. The user can restart
                    # the companion after generating another code.
                    return
                continue

            print(
                "Nexus desktop relay disconnected:",
                type(error).__name__,
                "- reconnecting in 5 seconds.",
            )
        await asyncio.sleep(5)




async def repair_remote_agent() -> None:
    """Stop the old relay session, discard its token, and launch pairing again."""
    task = getattr(app.state, "remote_agent_task", None)
    current = asyncio.current_task()
    if task is not None and task is not current and not task.done():
        task.cancel()
        try:
            await task
        except asyncio.CancelledError:
            pass

    try:
        credential_path().unlink(missing_ok=True)
    except OSError as error:
        show_pairing_message(
            "Nexus AI Desktop",
            f"Could not clear the previous device credentials: {error}",
            error=True,
        )
        return

    app.state.remote_agent_task = asyncio.create_task(keep_connected())


def request_repair() -> bool:
    """Thread-safe entry point called by the Windows tray menu."""
    loop = getattr(app.state, "event_loop", None)
    if loop is None or not loop.is_running():
        show_pairing_message(
            "Nexus AI Desktop",
            "The desktop service is still starting. Please try again in a few seconds.",
            error=True,
        )
        return False
    asyncio.run_coroutine_threadsafe(repair_remote_agent(), loop)
    return True


@app.on_event("startup")
async def start_remote_agent() -> None:
    app.state.event_loop = asyncio.get_running_loop()
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
