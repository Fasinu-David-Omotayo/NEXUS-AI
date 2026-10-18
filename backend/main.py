from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import google.generativeai as genai
from dotenv import load_dotenv
import os

load_dotenv()

MODEL_NAME = "gemini-3.8-flash"

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

app = FastAPI(
    title="Nexus AI Backend",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
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
                    "Gemini returned an empty response."
                )

            print(f"Using Gemini Key #{index}")

            return response.text

        except Exception as error:
            print(
                f"Gemini Key #{index} failed: {error}"
            )

            last_error = error

    raise RuntimeError(
        f"All Gemini API keys failed. Last error: {last_error}"
    )


@app.get("/")
async def root():
    return {
        "status": "Nexus AI Backend Running",
        "model": MODEL_NAME,
        "available_api_keys": len(API_KEYS),
    }


@app.post("/chat")
async def chat(request: ChatRequest):
    message = request.message.strip()

    if not message:
        return {
            "reply": "Please enter a message."
        }

    try:
        reply = generate_with_failover(message)

        return {
            "reply": reply
        }

    except Exception as error:
        print(f"Nexus AI error: {error}")

        return {
            "reply": (
                "Nexus AI is temporarily unavailable. "
                "Please try again shortly."
            )
        }