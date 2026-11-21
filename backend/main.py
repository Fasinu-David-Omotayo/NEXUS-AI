from __future__ import annotations

import os
import time
from typing import Optional

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from starlette.concurrency import run_in_threadpool
from google import genai
from google.genai import types

load_dotenv()

MODEL_NAME = os.getenv("GEMINI_MODEL", "gemini-3.8-flash").strip() or "gemini-3.8-flash"

API_KEYS = [
    os.getenv(f"GEMINI_API_KEY_{index}", "").strip()
    for index in range(1, 6)
]
API_KEYS = [key for key in API_KEYS if key]

# Keep one provider request short. The SDK otherwise retries transient errors
# automatically, which can make the frontend wait longer than its timeout.
GEMINI_REQUEST_TIMEOUT_MS = 11000
MAX_OVERLOAD_ATTEMPTS = 2

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

app = FastAPI(title="Nexus AI Backend", version="1.5.1")
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
)


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=20000)


def get_http_status(error: Exception) -> Optional[int]:
    """Read the HTTP status from Google SDK errors without depending on one class."""
    code = getattr(error, "code", None)
    try:
        return int(code) if code is not None else None
    except (TypeError, ValueError):
        return None


def generate_with_failover(prompt: str) -> str:
    """Generate a reply, skipping exhausted keys and limiting overload retries."""
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
    overload_attempts = 0
    started_at = time.monotonic()

    for index, key in enumerate(API_KEYS, start=1):
        # Do not let several slow provider calls outlive the frontend timeout.
        if time.monotonic() - started_at >= 20:
            print("Nexus AI: stopping Gemini failover after the 20-second budget.")
            break

        client: Optional[genai.Client] = None
        key_started_at = time.monotonic()

        try:
            client = genai.Client(
                api_key=key,
                http_options=types.HttpOptions(
                    timeout=GEMINI_REQUEST_TIMEOUT_MS,
                    retry_options=types.HttpRetryOptions(attempts=1),
                ),
            )
            response = client.models.generate_content(
                model=MODEL_NAME,
                contents=system_prompt,
            )
            reply = (response.text or "").strip()
            if not reply:
                raise RuntimeError("Gemini returned an empty response.")

            elapsed = time.monotonic() - key_started_at
            print(
                f"Nexus AI: Gemini API key #{index} succeeded "
                f"in {elapsed:.2f}s."
            )
            return reply

        except Exception as error:
            status = get_http_status(error)
            message = str(error).replace("\\n", " ")[:500]
            failures.append(f"key #{index}: {type(error).__name__}: {message}")
            elapsed = time.monotonic() - key_started_at

            print(
                f"Nexus AI: Gemini API key #{index} failed after {elapsed:.2f}s "
                f"(HTTP {status or 'unknown'}, {type(error).__name__}): {message}"
            )

            # A daily/free-tier quota belongs to that key's project. Skip it
            # immediately and check the next configured key.
            if status == 429:
                print(f"Nexus AI: skipping exhausted Gemini API key #{index}.")
                continue

            # 503 means the model service is overloaded, not that this key is
            # invalid. Try at most one other key, then stop rather than looping.
            if status == 503:
                overload_attempts += 1
                if overload_attempts >= MAX_OVERLOAD_ATTEMPTS:
                    print(
                        "Nexus AI: Gemini model is still overloaded; "
                        "stopping further key attempts."
                    )
                    break
                continue

            # Authentication, permission, invalid model, and request errors
            # generally will not be fixed by trying the same request with
            # several other API keys.
            if status in (400, 401, 403, 404):
                break

            # Unknown/network failures: move to one more key only.
            overload_attempts += 1
            if overload_attempts >= MAX_OVERLOAD_ATTEMPTS:
                break

        finally:
            if client is not None:
                try:
                    client.close()
                except Exception:
                    pass

    raise RuntimeError(
        "Gemini could not complete this request. "
        "Check API quotas and model availability. " + " | ".join(failures)
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
            detail=(
                "Nexus AI is temporarily unable to reach its AI provider. "
                "The free Gemini quota may be exhausted or the model may be busy. "
                "Please try again shortly."
            ),
        ) from error


# Desktop control remains account-scoped and uses the secure pairing router.
from secure_desktop import router as secure_desktop_router

app.include_router(secure_desktop_router)
