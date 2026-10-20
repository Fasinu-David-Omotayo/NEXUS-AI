
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import google.generativeai as genai
from dotenv import load_dotenv
import os

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
        "No Gemini API keys were found. Check your backend/.env file."
    )

# Keep local development working, and allow production origins
# to be configured later through FRONTEND_ORIGINS.
default_origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]

configured_origins = os.getenv("FRONTEND_ORIGINS", "")

FRONTEND_ORIGINS = [
    origin.strip().rstrip("/")
    for origin in configured_origins.split(",")
    if origin.strip()
]

ALLOWED_ORIGINS = list(
    dict.fromkeys(default_origins + FRONTEND_ORIGINS)
)

app = FastAPI(
    title="Nexus AI Backend",
    version="1.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
)


class ChatRequest(BaseModel):
    message: str


def generate_with_failover(prompt: str) -> str:
    last_error = None

    system_prompt = f"""
You are Nexus AI.

You are an advanced AI assistant designed for research,
productivity, learning, automation, and general assistance.

Your name is Nexus AI.

Do not identify yourself as Gemini.
Do not identify yourself as Google AI.
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
                raise RuntimeError(
                    "The AI provider returned an empty response."
                )

            print(f"Gemini API key #{index} succeeded.")
            return response.text

        except Exception as error:
            # Do not print API keys or expose provider errors to users.
            print(
                f"Gemini API key #{index} failed: "
                f"{type(error).__name__}: {error}"
            )
            last_error = error

    raise RuntimeError(
        "All configured Gemini API keys failed."
    ) from last_error


@app.get("/")
async def root():
    return {
        "status": "Nexus AI Backend Running",
        "model": MODEL_NAME,
    }


@app.post("/chat")
async def chat(request: ChatRequest):
    message = request.message.strip()

    if not message:
        raise HTTPException(
            status_code=400,
            detail="Please enter a message.",
        )

    try:
        reply = generate_with_failover(message)
        return {"reply": reply}

    except Exception as error:
        print(
            f"Nexus AI request failed: "
            f"{type(error).__name__}: {error}"
        )

        raise HTTPException(
            status_code=503,
            detail=(
                "Nexus AI is temporarily unavailable. "
                "Please try again shortly."
            ),
        )
