import asyncio
import logging
import os
from typing import Optional
from groq import Groq

logger = logging.getLogger(__name__)

_client: Optional[Groq] = None


def get_groq_client() -> Groq:
    global _client
    if _client is None:
        api_key = os.getenv("GROQ_API_KEY")
        if not api_key:
            logger.error("GROQ_API_KEY is not set in .env — LLM features will fall back to heuristics")
            raise ValueError("GROQ_API_KEY is not set in .env")
        _client = Groq(api_key=api_key, max_retries=2)
    return _client


async def groq_chat(
    system_prompt: str,
    user_prompt: str,
    model: str = "llama-3.3-70b-versatile",
    temperature: float = 0.1,
    max_tokens: int = 2048,
) -> str:
    client = get_groq_client()
    response = await asyncio.to_thread(
        client.chat.completions.create,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        model=model,
        temperature=temperature,
        max_tokens=max_tokens,
    )
    return response.choices[0].message.content or ""
