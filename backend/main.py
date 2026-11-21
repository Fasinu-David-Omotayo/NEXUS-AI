from __future__ import annotations

import os
import time
from typing import Optional

import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from starlette.concurrency import run_in_threadpool
from google import genai
from google.genai import types

load_dotenv()

MODEL_NAME = os.getenv("GEMINI_MODEL", "gemini-3.5-flash-lite").strip() or "gemini-3.5-flash-lite"

API_KEYS = [
    os.getenv(f"GEMINI_API_KEY_{index}", "").strip()
    for index in range(1, 6)
]
API_KEYS = [key for key in API_KEYS if key]

# Hugging Face is deliberately opt-in to prevent unexpected paid usage.
HF_TOKEN = os.getenv("HF_TOKEN", "").strip()
HF_FALLBACK_ENABLED = os.getenv("HF_FALLBACK_ENABLED", "false").strip().lower() in {
    "1", "true", "yes", "on"
}
HF_MODEL = os.getenv(
    "HF_MODEL", "deepseek-ai/DeepSeek-V4.1-Flash:cheapest"
).strip()
HF_TIMEOUT_SECONDS = 7.0

GEMINI_REQUEST_TIMEOUT_MS = 11000
GEMINI_TOTAL_BUDGET_SECONDS = 16
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

app = FastAPI(title="Nexus AI Backend", version="1.6.0")
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


def build_system_prompt(prompt: str) -> str:
    return f"""
You are Nexus AI.

You are an advanced AI assistant designed for research,
productivity, learning, automation, and general assistance.

Your name is Nexus AI.
Do not identify yourself as Gemini, Google AI, Hugging Face, or another provider.
Do not mention the underlying AI provider unless the user specifically asks
about the technology powering the system.

Be professional, intelligent, helpful, concise, and conversational.
When the user asks who you are, identify yourself as Nexus AI.

User Message:
{prompt}
"""


def generate_with_huggingface(prompt: str) -> str:
    """Use the Hugging Face Inference Providers router as the backup provider."""
    if not HF_FALLBACK_ENABLED:
        raise RuntimeError(
            "Hugging Face fallback is disabled. Enable it only after confirming "
            "that the Hugging Face account has inference credits."
        )
    if not HF_TOKEN:
        raise RuntimeError("HF_TOKEN is missing from the backend environment.")
    if not HF_MODEL:
        raise RuntimeError("HF_MODEL is not configured.")

    response = httpx.post(
        "https://router.huggingface.co/v1/chat/completions",
        headers={
            "Authorization": f"Bearer {HF_TOKEN}",
            "Content-Type": "application/json",
        },
        json={
            "model": HF_MODEL,
            "messages": [
                {
                    "role": "system",
                    "content": (
                        "You are Nexus AI, a professional and helpful assistant "
                        "for research, productivity, learning, and general help. "
                        "Do not identify yourself as the underlying model provider."
                    ),
                },
                {"role": "user", "content": prompt},
            ],
            "max_tokens": 700,
            "temperature": 0.7,
            "stream": False,
        },
        timeout=HF_TIMEOUT_SECONDS,
    )
    response.raise_for_status()

    data = response.json()
    choices = data.get("choices") or []
    if not choices:
        raise RuntimeError("Hugging Face returned no completion choices.")

    message = choices[0].get("message") or {}
    reply = message.get("content", "")
    if isinstance(reply, list):
        reply = "".join(
            part.get("text", "") for part in reply if isinstance(part, dict)
        )
    reply = str(reply).strip()
    if not reply:
        raise RuntimeError("Hugging Face returned an empty response.")

    return reply


def generate_with_failover(prompt: str) -> str:
    """Try Gemini first, then Hugging Face only when explicitly enabled."""
    system_prompt = build_system_prompt(prompt)
    failures: list[str] = []

    if API_KEYS:
        overload_attempts = 0
        started_at = time.monotonic()

        for index, key in enumerate(API_KEYS, start=1):
            if time.monotonic() - started_at >= GEMINI_TOTAL_BUDGET_SECONDS:
                print("Nexus AI: stopping Gemini attempts at the provider time budget.")
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
                message = str(error).replace("\\n", " ")[:400]
                failures.append(
                    f"Gemini key #{index}: {type(error).__name__}: {message}"
                )
                elapsed = time.monotonic() - key_started_at

                print(
                    f"Nexus AI: Gemini API key #{index} failed after "
                    f"{elapsed:.2f}s (HTTP {status or 'unknown'}, "
                    f"{type(error).__name__}): {message}"
                )

                if status == 429:
                    print(f"Nexus AI: skipping exhausted Gemini API key #{index}.")
                    continue

                if status == 503:
                    overload_attempts += 1
                    if overload_attempts >= MAX_OVERLOAD_ATTEMPTS:
                        print(
                            "Nexus AI: Gemini remains overloaded; "
                            "moving to the backup-provider stage."
                        )
                        break
                    continue

                if status in (400, 401, 403, 404):
                    break

                overload_attempts += 1
                if overload_attempts >= MAX_OVERLOAD_ATTEMPTS:
                    break

            finally:
                if client is not None:
                    try:
                        client.close()
                    except Exception:
                        pass
    else:
        failures.append("Gemini: no API keys are configured.")

    if HF_FALLBACK_ENABLED and HF_TOKEN:
        hf_started_at = time.monotonic()
        try:
            reply = generate_with_huggingface(prompt)
            elapsed = time.monotonic() - hf_started_at
            print(f"Nexus AI: Hugging Face fallback succeeded in {elapsed:.2f}s.")
            return reply
        except Exception as error:
            # Do not print request headers or the secret token.
            message = str(error).replace("\\n", " ")[:500]
            failures.append(f"Hugging Face: {type(error).__name__}: {message}")
            print(
                f"Nexus AI: Hugging Face fallback failed "
                f"({type(error).__name__}): {message}"
            )
    elif HF_TOKEN and not HF_FALLBACK_ENABLED:
        print(
            "Nexus AI: HF_TOKEN is configured, but fallback remains disabled "
            "to prevent unexpected inference charges."
        )
    elif not HF_TOKEN:
        print("Nexus AI: Hugging Face fallback is unavailable because HF_TOKEN is missing.")

    raise RuntimeError(
        "No AI provider completed this request. " + " | ".join(failures)
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
        "huggingface_token_configured": bool(HF_TOKEN),
        "huggingface_fallback_enabled": HF_FALLBACK_ENABLED,
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
                "Nexus AI is temporarily unable to complete this request. "
                "The primary AI provider may be out of quota or unavailable, "
                "and the backup provider may be disabled or unavailable. "
                "Please try again shortly."
            ),
        ) from error


# Desktop control remains account-scoped and uses the secure pairing router.
from secure_desktop import router as secure_desktop_router

app.include_router(secure_desktop_router)
