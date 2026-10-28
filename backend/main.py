from __future__ import annotations

import os

import google.generativeai as genai
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
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
    raise RuntimeError(
        "No Gemini API keys were found. Check your backend environment."
    )

default_origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]
configured_origins = os.getenv("FRONTEND_ORIGINS", "")
configured = [
    origin.strip().rstrip("/")
    for origin in configured_origins.split(",")
    if origin.strip()
]
ALLOWED_ORIGINS = list(dict.fromkeys(default_origins + configured))

app = FastAPI(title="Nexus AI Backend", version="1.3.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
)


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=20000)


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
            print(
                f"Gemini API key #{index} failed: "
                f"{type(error).__name__}: {error}"
            )
            last_error = error
    raise RuntimeError("All configured Gemini API keys failed.") from last_error


@app.get("/")
async def root():
    return {
        "status": "Nexus AI Backend Running",
        "model": MODEL_NAME,
        "desktop_relay": "secure-per-user-pairing",
    }


@app.post("/chat")
async def chat(request: ChatRequest):
    message = request.message.strip()
    if not message:
        raise HTTPException(status_code=400, detail="Please enter a message.")
    try:
        return {"reply": generate_with_failover(message)}
    except Exception as error:
        print(
            f"Nexus AI request failed: {type(error).__name__}: {error}"
        )
        raise HTTPException(
            status_code=503,
            detail="Nexus AI is temporarily unavailable. Please try again shortly.",
        ) from error


# The previous /desktop/ws, /desktop/status, and /desktop-command endpoints
# used one shared token and one global agent. They are intentionally removed.
# New endpoints are account-scoped and live under /v2/desktop.
from secure_desktop import router as secure_desktop_router

app.include_router(secure_desktop_router)
