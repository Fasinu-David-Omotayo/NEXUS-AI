"""Nexus AI Desktop companion launcher.

This is the packaged Windows entry point. It runs the existing secure relay agent
and provides a Windows notification-area menu so users can quit the companion
without opening a terminal or Task Manager.
"""
from __future__ import annotations

import threading
import time
import webbrowser

import uvicorn
from PIL import Image, ImageDraw
import pystray

from desktop_agent_online import app


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
    webbrowser.open("https://nexus-ai.vercel.app")


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
    )
    server = uvicorn.Server(config)
    server_thread = threading.Thread(
        target=run_server,
        args=(server,),
        name="NexusRelay",
        daemon=True,
    )
    server_thread.start()

    deadline = time.monotonic() + 10
    while not server.started and server_thread.is_alive() and time.monotonic() < deadline:
        time.sleep(0.1)

    menu = pystray.Menu(
        pystray.MenuItem("Open Nexus AI website", lambda icon, item: open_nexus()),
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
