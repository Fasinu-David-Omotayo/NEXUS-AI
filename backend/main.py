
from __future__ import annotations

import asyncio
import hmac
import os
import uuid

import google.generativeai as genai
import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, Header, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

load_dotenv()

MODEL_NAME = os.getenv("GEMINI_MODEL", "gemini-3.8-flash")
API_KEYS = [
    os.getenv("GEMINI_API_KEY_1"),
    os.getenv("GEMINI_API_KEY_2"),
    os.getenv("GEMINI_API_KEY_3"),
    os.getenv("GEMINI_API_KEY_4"),
    os.getenv("GEMINI_API_KEY_5"),
]
API_KEYS = [key for key in API_KEYS if key]

if not API_KEYS:
    raise RuntimeError("No Gemini API keys were found. Check your backend environment.")

SUPABASE_URL = os.getenv("SUPABASE_URL", "").rstrip("/")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY", "")
DESKTOP_AGENT_TOKEN = os.getenv("DESKTOP_AGENT_TOKEN", "")
DESKTOP_OWNER_EMAIL = os.getenv("DESKTOP_OWNER_EMAIL", "").strip().lower()

default_origins = ["http://localhost:3000", "http://127.0.0.1:3000"]
configured_origins = os.getenv("FRONTEND_ORIGINS", "")
configured = [origin.strip().rstrip("/") for origin in configured_origins.split(",") if origin.strip()]
ALLOWED_ORIGINS = list(dict.fromkeys(default_origins + configured))

app = FastAPI(title="Nexus AI Backend", version="1.2.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
)


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=20000)


class DesktopCommandRequest(BaseModel):
    command: str = Field(min_length=2, max_length=300)


active_desktop_agent: WebSocket | None = None
pending_desktop_responses: dict[str, asyncio.Future] = {}


def generate_with_failover(prompt: str) -> str:
    last_error = None
    system_prompt = f"""
You are Nexus AI.

You are an advanced AI assistant designed for research,
productivity, learning, automation, and general assistance.

Your name is Nexus AI.
Do not identify yourself as Gemini or Google AI.
Do not mention the underlying AI provider unless the user
specifically asks about the technology powering the system.

Be professional, intelligent, helpful, concise, and conversational.
When the user asks who you are, identify yourself as Nexus AI.

User Message:
{prompt}
"""

    for index, key in enumerate(API_KEYS, start=1):
        try:
            genai.configure(api_key=key)
            model = genai.GenerativeModel(MODEL_NAME)
            response = model.generate_content(system_prompt)
            if not response.text:
                raise RuntimeError("The AI provider returned an empty response.")
            print(f"Gemini API key #{index} succeeded.")
            return response.text
        except Exception as error:
            print(f"Gemini API key #{index} failed: {type(error).__name__}: {error}")
            last_error = error

    raise RuntimeError("All configured Gemini API keys failed.") from last_error


async def verify_desktop_owner(authorization: str | None) -> None:
    if not SUPABASE_URL or not SUPABASE_ANON_KEY or not DESKTOP_OWNER_EMAIL:
        raise HTTPException(status_code=503, detail="Desktop control is not configured.")

    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Please sign in to Nexus AI.")

    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            response = await client.get(
                f"{SUPABASE_URL}/auth/v1/user",
                headers={
                    "apikey": SUPABASE_ANON_KEY,
                    "Authorization": authorization,
                },
            )
    except httpx.HTTPError as error:
        print(f"Supabase verification failed: {type(error).__name__}")
        raise HTTPException(status_code=503, detail="Could not verify your Nexus AI session.") from error

    if response.status_code != 200:
        raise HTTPException(status_code=401, detail="Your session is invalid or expired. Please sign in again.")

    account_email = str(response.json().get("email") or "").strip().lower()
    if not account_email or not hmac.compare_digest(account_email, DESKTOP_OWNER_EMAIL):
        raise HTTPException(status_code=403, detail="This account is not authorised to control the desktop agent.")


@app.get("/")
async def root():
    return {
        "status": "Nexus AI Backend Running",
        "model": MODEL_NAME,
        "desktop_relay": "configured" if DESKTOP_AGENT_TOKEN else "not configured",
    }


@app.get("/desktop/status")
async def desktop_status(authorization: str | None = Header(default=None, alias="Authorization")):
    await verify_desktop_owner(authorization)
    return {"online": active_desktop_agent is not None}


@app.websocket("/desktop/ws")
async def desktop_agent_socket(websocket: WebSocket):
    global active_desktop_agent

    expected_token = DESKTOP_AGENT_TOKEN
    authorization = websocket.headers.get("authorization", "")
    supplied_token = authorization[7:] if authorization.startswith("Bearer ") else ""

    if (
        not expected_token
        or len(expected_token) < 32
        or not supplied_token
        or not hmac.compare_digest(supplied_token, expected_token)
    ):
        await websocket.close(code=1008, reason="Not authorised")
        return

    await websocket.accept()
    previous_agent = active_desktop_agent
    active_desktop_agent = websocket

    if previous_agent is not None and previous_agent is not websocket:
        try:
            await previous_agent.close(code=1012, reason="Agent reconnected")
        except Exception:
            pass

    print("Nexus desktop agent connected.")

    try:
        while True:
            message = await websocket.receive_json()
            request_id = message.get("id")
            result = message.get("result")

            if not isinstance(request_id, str):
                continue

            future = pending_desktop_responses.get(request_id)
            if future is not None and not future.done():
                future.set_result(result)

    except WebSocketDisconnect:
        pass
    except Exception as error:
        print(f"Desktop connection ended: {type(error).__name__}")
    finally:
        if active_desktop_agent is websocket:
            active_desktop_agent = None

        for future in list(pending_desktop_responses.values()):
            if not future.done():
                future.set_exception(RuntimeError("The desktop agent disconnected."))

        print("Nexus desktop agent disconnected.")


@app.post("/desktop-command")
async def remote_desktop_command(
    payload: DesktopCommandRequest,
    authorization: str | None = Header(default=None, alias="Authorization"),
):
    await verify_desktop_owner(authorization)

    agent = active_desktop_agent
    if agent is None:
        return {
            "handled": True,
            "success": False,
            "reply": "Your Windows desktop agent is offline. Turn on your computer and ensure the Nexus background agent is running.",
        }

    request_id = uuid.uuid4().hex
    future = asyncio.get_running_loop().create_future()
    pending_desktop_responses[request_id] = future

    try:
        await agent.send_json({"id": request_id, "command": payload.command.strip()})
        return await asyncio.wait_for(future, timeout=20.0)
    except asyncio.TimeoutError:
        raise HTTPException(status_code=504, detail="The desktop agent did not respond in time.")
    except HTTPException:
        raise
    except Exception as error:
        print(f"Desktop relay failed: {type(error).__name__}")
        raise HTTPException(status_code=503, detail="The desktop connection was interrupted. Please try again.") from error
    finally:
        pending_desktop_responses.pop(request_id, None)


@app.post("/chat")
async def chat(request: ChatRequest):
    message = request.message.strip()
    if not message:
        raise HTTPException(status_code=400, detail="Please enter a message.")

    try:
        return {"reply": generate_with_failover(message)}
    except Exception as error:
        print(f"Nexus AI request failed: {type(error).__name__}: {error}")
        raise HTTPException(
            status_code=503,
            detail="Nexus AI is temporarily unavailable. Please try again shortly.",
        ) from error
