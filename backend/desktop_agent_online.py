
from __future__ import annotations

import asyncio
import json
import os

import websockets
from dotenv import load_dotenv

load_dotenv()

from desktop_agent import app, desktop_command, DesktopCommand


def get_websocket_url() -> str:
    backend_url = os.getenv(
        "NEXUS_BACKEND_URL",
        "https://nexus-ai-backend-mswg.onrender.com",
    ).rstrip("/")

    if backend_url.startswith("https://"):
        backend_url = "wss://" + backend_url[len("https://"):]
    elif backend_url.startswith("http://"):
        backend_url = "ws://" + backend_url[len("http://"):]
    elif not backend_url.startswith(("wss://", "ws://")):
        raise ValueError("NEXUS_BACKEND_URL must start with https:// or http://")

    return backend_url + "/desktop/ws"


async def keep_connected() -> None:
    token = os.getenv("DESKTOP_AGENT_TOKEN", "")
    if len(token) < 32:
        print("Nexus remote agent is not configured: DESKTOP_AGENT_TOKEN is missing.")
        return

    websocket_url = get_websocket_url()

    while True:
        try:
            print("Connecting Nexus Desktop Agent to the secure relay...")

            async with websockets.connect(
                websocket_url,
                additional_headers={"Authorization": f"Bearer {token}"},
                open_timeout=30,
                ping_interval=20,
                ping_timeout=20,
                close_timeout=10,
            ) as connection:
                print("Nexus Desktop Agent connected to the remote relay.")

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

                        await connection.send(
                            json.dumps({"id": request_id, "result": result})
                        )

                    except Exception as error:
                        print(
                            "Could not process a desktop request:",
                            type(error).__name__,
                        )

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
