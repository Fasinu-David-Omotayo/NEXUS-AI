from __future__ import annotations

import os
from typing import Optional

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from starlette.concurrency import run_in_threadpool
from google import genai

load_dotenv()

MODEL_NAME = os.getenv("GEMINI_MODEL", "gemini-3.8-flash").strip() or "gemini-3.8-flash"

API_KEYS = [
    os.getenv(f"GEMINI_API_KEY_{index}", "").strip()
    for index in range(1, 6)
]
API_KEYS = [key for key in API_KEYS if key]

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

app = FastAPI(title="Nexus AI Backend", version="1.4.0")
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
    """Generate a reply using the current Google Gen AI SDK and rotate API keys."""
    if not API_KEYS:
        raise RuntimeError(
            "No Gemini API keys are configured. Add GEMINI_API_KEY_1 in Render."
        )

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

    failures: list[str] = []

    for index, key in enumerate(API_KEYS, start=1):
        client: Optional[genai.Client] = None
        try:
            client = genai.Client(api_key=key)
            response = client.models.generate_content(
                model=MODEL_NAME,
                contents=system_prompt,
            )
            reply = (response.text or "").strip()
            if not reply:
                raise RuntimeError("Gemini returned an empty response.")

            print(f"Nexus AI: Gemini API key #{index} succeeded.")
            return reply

        except Exception as error:
            message = str(error).replace("\\n", " ")[:500]
            failures.append(f"key #{index}: {type(error).__name__}: {message}")
            print(
                f"Nexus AI: Gemini API key #{index} failed "
                f"({type(error).__name__}): {message}"
            )
        finally:
            if client is not None:
                try:
                    client.close()
                except Exception:
                    pass

    raise RuntimeError(
        "Every configured Gemini API key failed. " + " | ".join(failures)
    )


@app.get("/")
async def root():
    return {
        "status": "Nexus AI Backend Running",
        "model": MODEL_NAME,
        "desktop_relay": "secure-per-user-pairing",
    }


@app.get("/health")
async def health():
    return {
        "status": "ok",
        "service": "Nexus AI Backend",
        "model": MODEL_NAME,
        "gemini_keys_configured": len(API_KEYS),
    }


@app.post("/chat")
async def chat(request: ChatRequest):
    message = request.message.strip()
    if not message:
        raise HTTPException(status_code=400, detail="Please enter a message.")

    try:
        reply = await run_in_threadpool(generate_with_failover, message)
        return {"reply": reply}
    except Exception as error:
        print(f"Nexus AI request failed: {type(error).__name__}: {error}")
        raise HTTPException(
            status_code=503,
            detail="Nexus AI could not get a response from its AI provider. "
                   "Please try again shortly.",
        ) from error


# Desktop control remains account-scoped and uses the secure pairing router.
from secure_desktop import router as secure_desktop_router

app.include_router(secure_desktop_router)
