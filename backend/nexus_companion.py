"""Nexus AI Desktop Windows tray companion."""
from __future__ import annotations

import os
import threading
import time
import webbrowser

import pystray
import uvicorn
from PIL import Image, ImageDraw

from desktop_agent_online import app, request_repair

NEXUS_WEB_URL = os.getenv("NEXUS_WEB_URL", "https://nexus-ai-impact3600.vercel.app/")


def make_icon() -> Image.Image:
    image = Image.new("RGBA", (64, 64), (18, 18, 18, 255))
    draw = ImageDraw.Draw(image)
    draw.rounded_rectangle((5, 5, 59, 59), radius=14, fill=(33, 33, 33, 255))
    draw.text((16, 15), "N", fill=(255, 255, 255, 255), stroke_width=1)
    draw.ellipse((43, 42, 51, 50), fill=(74, 222, 128, 255))
    return image


def run_server(server: uvicorn.Server) -> None:
    server.run()


def open_nexus() -> None:
    webbrowser.open(NEXUS_WEB_URL)


def pair_this_computer() -> None:
    request_repair()


def quit_companion(icon: pystray.Icon, server: uvicorn.Server) -> None:
    server.should_exit = True
    icon.stop()


def main() -> None:
    config = uvicorn.Config(
        app,
        host="127.0.0.1",
        port=0,
        log_level="warning",
        access_log=False,
        log_config=None,
    )
    server = uvicorn.Server(config)
    server_thread = threading.Thread(target=run_server, args=(server,), name="NexusRelay", daemon=True)
    server_thread.start()

    deadline = time.monotonic() + 10
    while not server.started and server_thread.is_alive() and time.monotonic() < deadline:
        time.sleep(0.1)

    menu = pystray.Menu(
        pystray.MenuItem("Pair / Re-pair this computer", lambda icon, item: pair_this_computer()),
        pystray.MenuItem("Open Nexus AI website", lambda icon, item: open_nexus()),
        pystray.Menu.SEPARATOR,
        pystray.MenuItem("Quit Nexus AI Desktop", lambda icon, item: quit_companion(icon, server)),
    )
    icon = pystray.Icon("NexusAI", make_icon(), "Nexus AI Desktop", menu)
    try:
        icon.run()
    finally:
        server.should_exit = True
        server_thread.join(timeout=10)


if __name__ == "__main__":
    main()
