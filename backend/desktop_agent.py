"""Nexus AI local Windows desktop agent.

Run this only on the Windows computer that Nexus is allowed to control.
It exposes a small localhost API for opening and force-closing desktop apps.
"""

from __future__ import annotations

import difflib
import os
import re
import random
import shutil
import subprocess
import webbrowser
from urllib.parse import quote_plus, urlparse
from pathlib import Path
from typing import Optional

import psutil
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

try:
    import win32com.client  # supplied by pywin32; used to resolve Windows shortcuts
except ImportError:  # app opening can still use shortcuts via os.startfile
    win32com = None

app = FastAPI(title="Nexus AI Desktop Agent", version="1.0.0")

# Only the local Nexus frontend is allowed to call this API from a browser.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=False,
    allow_methods=["POST", "GET", "OPTIONS"],
    allow_headers=["Content-Type"],
)

class DesktopCommand(BaseModel):
    command: str = Field(min_length=2, max_length=300)



# Explicit aliases cover common apps whose Start Menu shortcut name differs from
# their process name. Unknown apps are discovered through Start Menu shortcuts.
APP_ALIASES = {
    # Windows built-in apps use different executable names and, in some cases,
    # URI launch handlers instead of ordinary .exe shortcuts.
    "settings": {"processes": ["systemsettings.exe"], "search": ["settings", "windows settings"]},
    "windows settings": {"processes": ["systemsettings.exe"], "search": ["windows settings", "settings"]},
    "system settings": {"processes": ["systemsettings.exe"], "search": ["settings", "windows settings"]},
    "windows calculator": {"processes": ["calculatorapp.exe", "calculator.exe", "calc.exe"], "search": ["calculator"]},
    "calculator": {"processes": ["calculatorapp.exe", "calculator.exe", "calc.exe"], "search": ["calculator"]},
    "file explorer": {"processes": ["explorer.exe"], "search": ["file explorer"]},
    "explorer": {"processes": ["explorer.exe"], "search": ["file explorer", "explorer"]},
    "control panel": {"processes": ["control.exe"], "search": ["control panel"]},
    "paint": {"processes": ["mspaint.exe"], "search": ["paint"]},
    "microsoft paint": {"processes": ["mspaint.exe"], "search": ["paint", "microsoft paint"]},
    "snipping tool": {"processes": ["snippingtool.exe", "snippingtoolhost.exe"], "search": ["snipping tool"]},
    "camera": {"processes": ["windowscamera.exe", "camera.exe"], "search": ["camera", "windows camera"]},
    "clock": {"processes": ["applicationframehost.exe", "alarms.exe"], "search": ["clock", "alarms and clock"]},
    "chrome": {"processes": ["chrome.exe"], "search": ["google chrome", "chrome"]},
    "google chrome": {"processes": ["chrome.exe"], "search": ["google chrome", "chrome"]},
    "edge": {"processes": ["msedge.exe"], "search": ["microsoft edge", "edge"]},
    "microsoft edge": {"processes": ["msedge.exe"], "search": ["microsoft edge", "edge"]},
    "firefox": {"processes": ["firefox.exe"], "search": ["mozilla firefox", "firefox"]},
    "notepad": {"processes": ["notepad.exe"], "search": ["notepad"]},
    "calculator": {"processes": ["calculatorapp.exe", "calculator.exe", "calc.exe"], "search": ["calculator"]},
    "vs code": {"processes": ["code.exe"], "search": ["visual studio code", "vs code"]},
    "visual studio code": {"processes": ["code.exe"], "search": ["visual studio code", "vs code"]},
    "word": {"processes": ["winword.exe"], "search": ["word", "microsoft word"]},
    "microsoft word": {"processes": ["winword.exe"], "search": ["microsoft word", "word"]},
    "excel": {"processes": ["excel.exe"], "search": ["excel", "microsoft excel"]},
    "microsoft excel": {"processes": ["excel.exe"], "search": ["microsoft excel", "excel"]},
    "powerpoint": {"processes": ["powerpnt.exe"], "search": ["powerpoint", "microsoft powerpoint"]},
    "microsoft powerpoint": {"processes": ["powerpnt.exe"], "search": ["microsoft powerpoint", "powerpoint"]},
    "spotify": {"processes": ["spotify.exe"], "search": ["spotify"]},
    "discord": {"processes": ["discord.exe"], "search": ["discord"]},
    "whatsapp": {"processes": ["whatsapp.exe"], "search": ["whatsapp"]},
    "teams": {"processes": ["ms-teams.exe", "teams.exe"], "search": ["microsoft teams", "teams"]},
    "task manager": {"processes": ["taskmgr.exe"], "search": ["task manager"]},
}


# Direct launch handlers for Windows built-ins. These avoid relying on Start Menu
# shortcut names that vary by Windows version and installation language.
SPECIAL_URI_LAUNCHERS = {
    "settings": "ms-settings:",
    "windows settings": "ms-settings:",
    "system settings": "ms-settings:",
    "camera": "microsoft.windows.camera:",
    "clock": "ms-clock:",
}
SPECIAL_EXE_LAUNCHERS = {
    "calculator": "calc.exe",
    "windows calculator": "calc.exe",
    "task manager": "taskmgr.exe",
    "file explorer": "explorer.exe",
    "explorer": "explorer.exe",
    "control panel": "control.exe",
    "notepad": "notepad.exe",
    "paint": "mspaint.exe",
    "microsoft paint": "mspaint.exe",
    "snipping tool": "snippingtool.exe",
}



WEBSITE_ALIASES = {
    "youtube": "https://www.youtube.com/",
    "youtube music": "https://music.youtube.com/",
    "google": "https://www.google.com/",
    "gmail": "https://mail.google.com/",
    "google drive": "https://drive.google.com/",
    "google docs": "https://docs.google.com/",
    "facebook": "https://www.facebook.com/",
    "instagram": "https://www.instagram.com/",
    "tiktok": "https://www.tiktok.com/",
    "x": "https://x.com/",
    "twitter": "https://x.com/",
    "whatsapp web": "https://web.whatsapp.com/",
    "whatsapp": "https://web.whatsapp.com/",
    "netflix": "https://www.netflix.com/",
    "spotify web player": "https://open.spotify.com/",
    "spotify web": "https://open.spotify.com/",
    "amazon": "https://www.amazon.com/",
    "wikipedia": "https://www.wikipedia.org/",
    "github": "https://github.com/",
    "linkedin": "https://www.linkedin.com/",
    "chatgpt": "https://chatgpt.com/",
    "nexus": "http://localhost:3000/dashboard",
}


def send_browser_hotkey(*keys: str) -> None:
    """Send a small keyboard shortcut to the currently focused Windows app."""
    if os.name != "nt":
        raise RuntimeError("Browser keyboard shortcuts are supported on Windows only.")
    import ctypes
    user32 = ctypes.windll.user32
    vk_map = {
        "ctrl": 0x11,
        "alt": 0x12,
        "shift": 0x10,
        "win": 0x5B,
        "tab": 0x09,
        "esc": 0x1B,
        "f4": 0x73,
        "r": 0x52,
        "t": 0x54,
        "s": 0x53,
        "d": 0x44,
        "m": 0x4D,
        "space": 0x20,
        "up": 0x26,
        "down": 0x28,
        "left": 0x25,
        "right": 0x27,
        "media_play_pause": 0xB3,
        "volume_mute": 0xAD,
        "volume_down": 0xAE,
        "volume_up": 0xAF,
    }
    virtual_keys = [vk_map[key] for key in keys]
    for vk in virtual_keys:
        user32.keybd_event(vk, 0, 0, 0)
    for vk in reversed(virtual_keys):
        user32.keybd_event(vk, 0, 2, 0)


def open_web_url(url: str, description: str) -> str:
    try:
        opened = webbrowser.open(url, new=2, autoraise=True)
        if not opened:
            # webbrowser may return False on some Windows setups even when a browser launches.
            os.startfile(url)
        return description
    except Exception as exc:
        raise RuntimeError(f"I couldn't open that website: {exc}") from exc


def handle_web_command(command: str) -> Optional[dict[str, object]]:
    """Handle website, YouTube search/play, browser-tab, and media commands."""
    raw = command.strip()
    text = re.sub(r"[^a-zA-Z0-9:/?.&=_+\-\s]", " ", raw.lower())
    text = re.sub(r"\s+", " ", text).strip(" .,!?")

    # Closing a named website closes the active browser tab. Closing the browser
    # application itself remains available through commands such as "close Chrome".
    close_site_match = re.match(r"^(?:hey\s+nexus\s+)?(?:close|shut)\s+(?:the\s+)?(?:(?:website|site|webpage)\s+)?(.+?)(?:\s+tab)?(?:\s+please)?$", text)
    if close_site_match:
        close_target = close_site_match.group(1).strip()
        if close_target in WEBSITE_ALIASES or close_target in {"current tab", "browser tab", "website", "webpage", "tab"}:
            try:
                send_browser_hotkey("ctrl", "w")
                return {"handled": True, "success": True, "reply": f"Closed the current browser tab for {close_target}."}
            except Exception as exc:
                return {"handled": True, "success": False, "reply": f"I couldn't close the browser tab. {exc}"}

    # Browser tab controls operate on the currently focused browser window.
    if re.match(r"^(?:hey\s+nexus\s+)?(?:close|shut)\s+(?:the\s+)?(?:current\s+)?(?:browser\s+)?(?:tab|website|webpage)(?:\s+please)?$", text):
        try:
            send_browser_hotkey("ctrl", "w")
            return {"handled": True, "success": True, "reply": "Closed the current browser tab."}
        except Exception as exc:
            return {"handled": True, "success": False, "reply": f"I couldn't close the browser tab. {exc}"}

    if re.match(r"^(?:hey\s+nexus\s+)?(?:pause|stop)\s+(?:the\s+)?(?:music|song|video|youtube|playback)(?:\s+please)?$", text):
        try:
            send_browser_hotkey("media_play_pause")
            return {"handled": True, "success": True, "reply": "Paused or resumed media playback."}
        except Exception as exc:
            return {"handled": True, "success": False, "reply": f"I couldn't control media playback. {exc}"}

    # Volume controls accept natural variations, not just one exact phrase.
    volume_intents = [
        ("volume_up", 3, [
            r"^(?:hey\s+nexus\s+)?(?:please\s+)?(?:increase|raise|boost)\s+(?:the\s+)?(?:system\s+)?volume(?:\s+please)?$",
            r"^(?:hey\s+nexus\s+)?(?:please\s+)?(?:make|turn)\s+(?:the\s+)?volume\s+(?:louder|higher|up)(?:\s+please)?$",
            r"^(?:hey\s+nexus\s+)?(?:please\s+)?(?:make|turn)\s+it\s+(?:louder|up)(?:\s+please)?$",
            r"^(?:hey\s+nexus\s+)?(?:please\s+)?(?:turn|bring)\s+it\s+up(?:\s+please)?$",
        ]),
        ("volume_up", 1, [
            r"^(?:hey\s+nexus\s+)?(?:turn\s+)?(?:the\s+)?volume\s+(?:up|higher)(?:\s+please)?$",
        ]),
        ("volume_down", 3, [
            r"^(?:hey\s+nexus\s+)?(?:please\s+)?(?:decrease|reduce|lower)\s+(?:the\s+)?(?:system\s+)?volume(?:\s+please)?$",
            r"^(?:hey\s+nexus\s+)?(?:please\s+)?(?:make|turn)\s+(?:the\s+)?volume\s+(?:quieter|lower|down)(?:\s+please)?$",
            r"^(?:hey\s+nexus\s+)?(?:please\s+)?(?:make|turn)\s+it\s+(?:quieter|lower|down)(?:\s+please)?$",
            r"^(?:hey\s+nexus\s+)?(?:please\s+)?(?:turn|bring)\s+it\s+down(?:\s+please)?$",
        ]),
        ("volume_down", 1, [
            r"^(?:hey\s+nexus\s+)?(?:turn\s+)?(?:the\s+)?volume\s+(?:down|lower)(?:\s+please)?$",
        ]),
        ("volume_mute", 1, [
            r"^(?:hey\s+nexus\s+)?(?:please\s+)?(?:mute|unmute|toggle mute)(?:\s+(?:the\s+)?volume)?(?:\s+please)?$",
            r"^(?:hey\s+nexus\s+)?(?:turn\s+)?(?:the\s+)?volume\s+(?:mute|off)(?:\s+please)?$",
        ]),
    ]
    for key, steps, patterns in volume_intents:
        if any(re.match(pattern, text) for pattern in patterns):
            try:
                for _ in range(steps):
                    send_browser_hotkey(key)
                if key == "volume_up":
                    reply = random.choice([
                        "Volume increased.", "I've turned the volume up.",
                        "A little louder, coming right up.", "Sound level raised.",
                    ])
                elif key == "volume_down":
                    reply = random.choice([
                        "Volume decreased.", "I've turned the volume down.",
                        "I've lowered the sound.", "Sound level reduced.",
                    ])
                else:
                    reply = random.choice([
                        "Mute toggled.", "I've changed the mute setting.",
                        "Audio mute setting updated.",
                    ])
                return {"handled": True, "success": True, "reply": reply}
            except Exception as exc:
                return {"handled": True, "success": False, "reply": f"I couldn't adjust the volume. {exc}"}

    # General web search opens results in the default browser; it does not execute page content.
    search_match = re.match(r"^(?:hey\s+nexus\s+)?(?:search\s+(?:the\s+)?web\s+for|google\s+search\s+for|search\s+google\s+for|look\s+up)\s+(.+?)(?:\s+please)?$", text)
    if search_match:
        query = search_match.group(1).strip()
        if query:
            url = "https://www.google.com/search?q=" + quote_plus(query)
            return {"handled": True, "success": True, "reply": open_web_url(url, f"Searching the web for {query}.")}

    # Play/search YouTube content. This opens search results; YouTube decides which
    # video is available and the user may need to select the intended result.
    match = re.match(r"^(?:hey\s+nexus\s+)?(?:play|find|search\s+for)\s+(.+?)\s+(?:on\s+)?youtube(?:\s+please)?$", text)
    if match:
        query = match.group(1).strip()
        if query in {"music", "some music", "music for me"}:
            return {"handled": True, "success": True, "reply": open_web_url("https://music.youtube.com/", "Opening YouTube Music.")}
        url = "https://www.youtube.com/results?search_query=" + quote_plus(query)
        return {"handled": True, "success": True, "reply": open_web_url(url, f"Searching YouTube for {query}.")}

    match = re.match(r"^(?:hey\s+nexus\s+)?(?:search\s+youtube\s+for|search\s+youtube|find\s+on\s+youtube)\s+(.+?)(?:\s+please)?$", text)
    if match:
        query = match.group(1).strip()
        url = "https://www.youtube.com/results?search_query=" + quote_plus(query)
        return {"handled": True, "success": True, "reply": open_web_url(url, f"Searching YouTube for {query}.")}

    if re.match(r"^(?:hey\s+nexus\s+)?(?:play\s+)?(?:some\s+)?music(?:\s+please)?$", text) or re.match(r"^(?:hey\s+nexus\s+)?play\s+music$", text):
        return {"handled": True, "success": True, "reply": open_web_url("https://music.youtube.com/", "Opening YouTube Music.")}

    # A natural "play [song/video/topic]" command searches YouTube unless it is
    # the general music command handled just above.
    match = re.match(r"^(?:hey\s+nexus\s+)?play\s+(.+?)(?:\s+please)?$", text)
    if match:
        query = match.group(1).strip()
        if query not in {"music", "some music"} and not query.startswith(("youtube ", "on youtube ")):
            url = "https://www.youtube.com/results?search_query=" + quote_plus(query)
            return {"handled": True, "success": True, "reply": open_web_url(url, f"Searching YouTube for {query}.")}

    # Directly open common websites, including natural language "open website YouTube".
    match = re.match(r"^(?:hey\s+nexus\s+)?(?:open|go\s+to|visit|browse)\s+(?:the\s+)?(?:(?:website|site|webpage)\s+)?(.+?)(?:\s+please)?$", text)
    if match:
        target = match.group(1).strip().strip(" .,!?")
        target = re.sub(r"^(?:website|site)\s+", "", target)
        target = re.sub(r"^my\s+", "", target)
        target = re.sub(r"\s+folder$", "", target)
        if target in WEBSITE_ALIASES:
            return {"handled": True, "success": True, "reply": open_web_url(WEBSITE_ALIASES[target], f"Opening {target}.")}
        # If the user gave a domain or URL, open it directly; otherwise use a Google search.
        candidate = target if re.match(r"^https?://", target) else ("https://" + target if re.match(r"^[\w-]+(?:\.[\w-]+)+(?:/.*)?$", target) else None)
        if candidate:
            parsed = urlparse(candidate)
            if parsed.scheme in {"http", "https"} and parsed.netloc:
                return {"handled": True, "success": True, "reply": open_web_url(candidate, f"Opening {parsed.netloc}.")}
        # Don't steal common desktop app commands from the desktop-app handler.
        if target in APP_ALIASES or target in {"settings", "windows settings", "system settings", "calculator", "notepad", "task manager", "file explorer", "control panel", "paint", "snipping tool", "camera", "clock", "desktop", "downloads", "documents", "pictures", "music", "videos", "download folder", "documents folder", "pictures folder", "music folder", "videos folder"}:
            return None
        search_url = "https://www.google.com/search?q=" + quote_plus(target)
        return {"handled": True, "success": True, "reply": open_web_url(search_url, f"Searching the web for {target}.")}

    return None


def handle_window_command(command: str) -> Optional[dict[str, object]]:
    """Handle explicit, low-risk Windows window and keyboard actions."""
    text = re.sub(r"[^a-zA-Z0-9:/?.&=_+\\-\\s]", " ", command.lower())
    text = re.sub(r"\\s+", " ", text).strip(" .,!?")
    text = re.sub(r"^(?:hey\\s+nexus|nexus)[, ]*", "", text)
    text = re.sub(r"^(?:please|can you|could you|would you|kindly)\\s+", "", text)

    hotkey_commands = [
        (r"^(?:show|display) (?:the )?desktop$", ("win", "d"), "Showing the desktop."),
        (r"^(?:minimize|hide) (?:the )?(?:current|active) window$", ("win", "down"), "Minimized the active window."),
        (r"^minimize all windows$", ("win", "m"), "Minimized all windows."),
        (r"^(?:maximize|full ?screen) (?:the )?(?:current|active) window$", ("win", "up"), "Maximized the active window."),
        (r"^(?:switch|change) (?:to the )?(?:next )?(?:window|app|application)$", ("alt", "tab"), "Switched windows."),
        (r"^switch (?:between )?(?:open )?windows$", ("alt", "tab"), "Switched windows."),
        (r"^(?:snap|move) (?:the )?(?:current|active) window left$", ("win", "left"), "Moved the active window to the left side of the screen."),
        (r"^(?:snap|move) (?:the )?(?:current|active) window right$", ("win", "right"), "Moved the active window to the right side of the screen."),
        (r"^(?:refresh|reload) (?:the )?(?:current )?(?:page|window|folder)$", ("ctrl", "r"), "Refreshed the current page or folder."),
        (r"^(?:open|create) (?:a )?new (?:browser )?tab$", ("ctrl", "t"), "Opened a new browser tab."),
        (r"^(?:switch to )?the next tab$", ("ctrl", "tab"), "Switched to the next tab."),
        (r"^(?:switch to )?the previous tab$", ("ctrl", "shift", "tab"), "Switched to the previous tab."),
        (r"^(?:save|save the current) (?:the )?(?:current )?(?:document|file|work)$", ("ctrl", "s"), "Sent the save shortcut to the active application."),
        (r"^(?:take|capture) (?:a )?(?:screenshot|screen capture)$", ("win", "shift", "s"), "Opened Windows screen capture. Select the area you want to capture."),
        (r"^(?:close|exit) (?:the )?(?:active|current) window$", ("alt", "f4"), "Sent the close shortcut to the active window. Windows may ask you to save unsaved work."),
    ]

    for pattern, keys, reply in hotkey_commands:
        if re.match(pattern, text):
            try:
                send_browser_hotkey(*keys)
                return {"handled": True, "success": True, "reply": reply}
            except Exception as exc:
                return {
                    "handled": True,
                    "success": False,
                    "reply": f"I couldn't complete that window action. {exc}",
                }

    if re.match(r"^(?:lock|lock the) (?:my )?(?:computer|pc|workstation|screen)$", text):
        if os.name != "nt":
            return {"handled": True, "success": False, "reply": "Locking the workstation is supported on Windows only."}
        try:
            import ctypes

            if not ctypes.windll.user32.LockWorkStation():
                raise OSError("Windows did not accept the lock request.")
            return {"handled": True, "success": True, "reply": "Locking your Windows workstation."}
        except Exception as exc:
            return {"handled": True, "success": False, "reply": f"I couldn't lock the workstation. {exc}"}

    return None


# Never force-terminate core Windows/security/session processes.
PROTECTED_PROCESSES = {
    "system", "system idle process", "registry", "smss.exe", "csrss.exe",
    "wininit.exe", "services.exe", "lsass.exe", "winlogon.exe", "svchost.exe",
    "dwm.exe", "explorer.exe", "fontdrvhost.exe", "spoolsv.exe", "runtimebroker.exe",
    "securityhealthservice.exe", "msmpeng.exe", "sihost.exe", "taskhostw.exe",
}

ACTION_PATTERN = re.compile(
    r"^\s*(?:hey\s+nexus[\s,.:;-]*)?(open|launch|start|run|close|quit|exit|kill|terminate|force[- ]?close)\s+(.+?)\s*[.!?]*\s*$",
    re.IGNORECASE,
)


def normalize(value: str) -> str:
    value = value.lower().strip()
    value = re.sub(r"\b(the|a|an|application|app|program)\b", " ", value)
    value = re.sub(r"[^a-z0-9]+", " ", value)
    return re.sub(r"\s+", " ", value).strip()


def start_menu_dirs() -> list[Path]:
    candidates = [
        Path(os.environ.get("APPDATA", "")) / "Microsoft/Windows/Start Menu/Programs",
        Path(os.environ.get("PROGRAMDATA", "")) / "Microsoft/Windows/Start Menu/Programs",
    ]
    return [path for path in candidates if path.exists()]


def find_shortcut(app_name: str) -> Optional[Path]:
    wanted = normalize(app_name)
    aliases = APP_ALIASES.get(wanted, {}).get("search", [wanted])
    candidates: list[tuple[float, Path]] = []

    for root in start_menu_dirs():
        for current_root, _, files in os.walk(root):
            for filename in files:
                path = Path(current_root) / filename
                if path.suffix.lower() not in {".lnk", ".url", ".exe"}:
                    continue
                label = normalize(path.stem)
                if not label:
                    continue
                for alias in aliases:
                    target = normalize(alias)
                    if label == target:
                        return path
                    if target in label or label in target:
                        score = 0.9
                    else:
                        score = difflib.SequenceMatcher(None, target, label).ratio()
                    candidates.append((score, path))

    if not candidates:
        return None
    candidates.sort(key=lambda item: item[0], reverse=True)
    score, path = candidates[0]
    return path if score >= 0.72 else None


def resolve_shortcut_target(shortcut: Path) -> Optional[Path]:
    if shortcut.suffix.lower() == ".exe":
        return shortcut
    if shortcut.suffix.lower() != ".lnk" or win32com is None:
        return None
    try:
        shell = win32com.client.Dispatch("WScript.Shell")
        target = shell.CreateShortcut(str(shortcut)).TargetPath
        if target:
            return Path(target)
    except Exception:
        return None
    return None


def process_names_for(app_name: str, shortcut: Optional[Path]) -> set[str]:
    wanted = normalize(app_name)
    names: set[str] = set()
    alias = APP_ALIASES.get(wanted)
    if alias:
        names.update(name.lower() for name in alias["processes"])
    if shortcut:
        target = resolve_shortcut_target(shortcut)
        if target and target.name:
            names.add(target.name.lower())
        # Some packaged apps launch under a process name matching their shortcut.
        names.add(f"{shortcut.stem.lower()}.exe")
    names.add(f"{wanted.replace(' ', '')}.exe")
    return {name for name in names if name and name not in PROTECTED_PROCESSES}


def open_application(app_name: str) -> str:
    wanted = normalize(app_name)

    # Common user folders are opened directly in File Explorer.
    known_folders = {
        "desktop": Path.home() / "Desktop",
        "downloads": Path.home() / "Downloads",
        "download folder": Path.home() / "Downloads",
        "documents": Path.home() / "Documents",
        "documents folder": Path.home() / "Documents",
        "pictures": Path.home() / "Pictures",
        "pictures folder": Path.home() / "Pictures",
        "music folder": Path.home() / "Music",
        "videos folder": Path.home() / "Videos",
    }
    folder = known_folders.get(wanted)
    if folder and folder.exists():
        os.startfile(str(folder))
        return f"Opening your {app_name} folder."

    # Prefer explicit Windows launch handlers for built-in apps.
    uri = SPECIAL_URI_LAUNCHERS.get(wanted)
    if uri:
        try:
            os.startfile(uri)
            return f"Opening {app_name}."
        except OSError as exc:
            raise RuntimeError(f"Windows could not open {app_name}: {exc}") from exc

    executable_name = SPECIAL_EXE_LAUNCHERS.get(wanted)
    if executable_name:
        executable = shutil.which(executable_name)
        if executable:
            subprocess.Popen([executable], close_fds=True)
            return f"Opening {app_name}."
        # Windows can resolve built-in executable aliases even when shutil.which
        # cannot find them because PATH has been customized.
        try:
            subprocess.Popen([executable_name], close_fds=True)
            return f"Opening {app_name}."
        except OSError:
            pass

    shortcut = find_shortcut(wanted)

    if shortcut:
        try:
            os.startfile(str(shortcut))  # Windows opens .lnk/.url/.exe correctly
            return f"Opening {app_name}."
        except OSError as exc:
            raise RuntimeError(f"Windows could not open {app_name}: {exc}") from exc

    # PATH applications and Windows execution aliases (e.g. some installed CLI apps).
    executable = shutil.which(app_name) or shutil.which(f"{wanted.replace(' ', '')}.exe")
    if executable:
        subprocess.Popen([executable], close_fds=True)
        return f"Opening {app_name}."

    raise FileNotFoundError(
        f"I couldn't find an installed app named {app_name}. If it is a portable app, add a shortcut for it to your Windows Start Menu."
    )


def close_application(app_name: str) -> str:
    wanted = normalize(app_name)
    shortcut = find_shortcut(wanted)
    targets = process_names_for(wanted, shortcut)

    if not targets:
        raise ValueError("I couldn't safely identify the process for that application.")

    matching_pids: list[int] = []
    for process in psutil.process_iter(["pid", "name", "exe"]):
        try:
            name = (process.info.get("name") or "").lower()
            exe_path = process.info.get("exe") or ""
            exe_name = Path(exe_path).name.lower() if exe_path else ""
            if name in targets or exe_name in targets:
                if name in PROTECTED_PROCESSES or exe_name in PROTECTED_PROCESSES:
                    continue
                matching_pids.append(int(process.info["pid"]))
        except (psutil.NoSuchProcess, psutil.AccessDenied, psutil.ZombieProcess, TypeError):
            continue

    if not matching_pids:
        raise ProcessLookupError(f"{app_name} doesn't appear to be running.")

    closed = 0
    errors: list[str] = []
    for pid in matching_pids:
        try:
            # Force-terminate the selected app process tree, per the requested behavior.
            subprocess.run(
                ["taskkill", "/F", "/T", "/PID", str(pid)],
                capture_output=True,
                text=True,
                timeout=8,
                check=False,
                creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0),
            )
            try:
                psutil.Process(pid).wait(timeout=1.0)
                closed += 1
            except psutil.NoSuchProcess:
                closed += 1
            except psutil.TimeoutExpired:
                # Confirm if taskkill ended it, otherwise report a failure.
                if not psutil.pid_exists(pid):
                    closed += 1
                else:
                    errors.append(f"PID {pid} did not exit")
        except (OSError, subprocess.TimeoutExpired) as exc:
            errors.append(str(exc))

    if closed:
        return random.choice([
            f"Done — {app_name} is closed.",
            f"I've closed {app_name}.",
            f"{app_name} has been closed successfully.",
            f"All done. {app_name} is no longer running.",
            f"Closed {app_name} for you.",
        ])
    if errors:
        raise RuntimeError(f"Windows could not force-close {app_name}: {'; '.join(errors)}")
    raise RuntimeError(f"Windows could not force-close {app_name}.")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "Nexus AI Desktop Agent"}


@app.post("/desktop-command")
def desktop_command(payload: DesktopCommand) -> dict[str, object]:
    command = payload.command.strip()
    window_result = handle_window_command(command)
    if window_result is not None:
        return window_result
    web_result = handle_web_command(command)
    if web_result is not None:
        return web_result
    match = ACTION_PATTERN.match(command)
    if not match:
        return {"handled": False, "reply": ""}

    action = match.group(1).lower()
    app_name = match.group(2).strip().strip(" .,!?;:")
    app_name = re.sub(r"\b(?:please|for me|now)\b", " ", app_name, flags=re.IGNORECASE)
    app_name = re.sub(r"\s+", " ", app_name).strip()
    app_name = re.sub(r"^(?:my\s+)?(?:project|workspace|file)\s+in\s+", "", app_name, flags=re.IGNORECASE)
    app_name = re.sub(r"^(the|a|an|application|app|program)\s+", "", app_name, flags=re.IGNORECASE)

    # Avoid interpreting generic commands like "open a new tab" as desktop apps.
    if not app_name or len(app_name) > 100:
        return {"handled": False, "reply": ""}

    try:
        if action in {"open", "launch", "start", "run"}:
            reply = open_application(app_name)
            return {"handled": True, "success": True, "reply": reply}
        # Immediate force-close, as requested. Critical Windows processes remain protected.
        reply = close_application(app_name)
        return {"handled": True, "success": True, "reply": reply}
    except FileNotFoundError as exc:
        return {"handled": True, "success": False, "reply": str(exc)}
    except ProcessLookupError as exc:
        return {"handled": True, "success": False, "reply": str(exc)}
    except (ValueError, RuntimeError) as exc:
        return {"handled": True, "success": False, "reply": str(exc)}
    except Exception as exc:
        # Keep internal details in the backend terminal; send a plain error to the UI.
        print(f"Desktop command failed: {type(exc).__name__}: {exc}")
        return {"handled": True, "success": False, "reply": f"I couldn't complete that desktop command for {app_name}. Check the Nexus desktop-agent terminal for details."}
