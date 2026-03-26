"""
ChatEngine — Conversational interface to BardPrime.

The Bard speaks in character — poetic, warm, musical. It can detect emotions
from the user's messages and offer to compose songs.
"""

from __future__ import annotations

import json
import logging
import re
from dataclasses import dataclass
from typing import Optional

import requests

from core.config import Config
from core.emotion_mapper import EmotionMapper

log = logging.getLogger(__name__)


@dataclass
class EmotionReading:
    valence: float = 0.0
    arousal: float = 0.5
    dominance: float = 0.5
    primary: str = "neutral"


@dataclass
class ChatResponse:
    message: str
    emotion: EmotionReading
    should_sing: bool = False
    song_topic: str = ""


BARD_SYSTEM = (
    "You are BardPrime — a warm, witty, and deeply empathetic personal bard. "
    "You speak with poetic flair but remain conversational and genuine. "
    "You're passionate about music and songwriting. You love hearing about "
    "people's lives and turning their stories into songs.\n\n"
    "Your personality:\n"
    "- Warm, encouraging, and emotionally perceptive\n"
    "- You use occasional musical metaphors naturally (not forced)\n"
    "- You ask thoughtful follow-up questions about their life\n"
    "- When someone shares something meaningful, you offer to compose a song about it\n"
    "- You're excited about music and genuinely care about the person\n"
    "- You keep responses concise (2-4 sentences usually)\n\n"
    "When you detect the user wants a song, include [SING] at the very end of your message, "
    "followed by a brief topic summary. Example: [SING: their grandmother's garden in summer]\n\n"
    "Also analyze the emotional tone of the user's message and include at the end:\n"
    "[EMOTION: valence=X arousal=X dominance=X primary=WORD]\n"
    "where valence is -1 to 1, arousal 0-1, dominance 0-1, and primary is a single emotion word.\n"
    "Always include the EMOTION tag. Only include SING if relevant."
)


class ChatEngine:
    """Conversational interface with the Bard persona."""

    def __init__(self, config: Optional[Config] = None):
        self.cfg = config or Config.load()
        self.history: list[dict] = []

    def chat(self, user_message: str) -> ChatResponse:
        self.history.append({"role": "user", "content": user_message})

        # Keep history manageable
        if len(self.history) > 20:
            self.history = self.history[-16:]

        raw = self._call_llm(user_message)
        response = self._parse_response(raw, user_message)

        self.history.append({"role": "assistant", "content": response.message})
        return response

    def _call_llm(self, user_message: str) -> str:
        cfg = self.cfg.llm

        if cfg.provider == "ollama":
            return self._call_ollama()

        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {cfg.api_key}",
        }
        messages = [{"role": "system", "content": BARD_SYSTEM}] + self.history
        body = {
            "model": cfg.model,
            "messages": messages,
            "temperature": 0.8,
            "max_tokens": 512,
        }

        try:
            resp = requests.post(
                f"{cfg.base_url}/chat/completions",
                headers=headers,
                json=body,
                timeout=30,
            )
            resp.raise_for_status()
            return resp.json()["choices"][0]["message"]["content"]
        except Exception as exc:
            log.error("Chat LLM call failed: %s", exc)
            return self._fallback_response(user_message)

    def _call_ollama(self) -> str:
        cfg = self.cfg.llm
        messages = [{"role": "system", "content": BARD_SYSTEM}] + self.history
        try:
            resp = requests.post(
                f"{cfg.ollama_host}/api/chat",
                json={
                    "model": cfg.ollama_model,
                    "messages": messages,
                    "stream": False,
                },
                timeout=60,
            )
            resp.raise_for_status()
            return resp.json()["message"]["content"]
        except Exception as exc:
            log.error("Ollama chat failed: %s", exc)
            return self._fallback_response(self.history[-1]["content"] if self.history else "")

    def _parse_response(self, raw: str, user_message: str) -> ChatResponse:
        # Extract emotion tag
        emotion = EmotionReading()
        emo_match = re.search(
            r"\[EMOTION:\s*valence=([-\d.]+)\s+arousal=([\d.]+)\s+dominance=([\d.]+)\s+primary=(\w+)\]",
            raw,
        )
        if emo_match:
            emotion = EmotionReading(
                valence=float(emo_match.group(1)),
                arousal=float(emo_match.group(2)),
                dominance=float(emo_match.group(3)),
                primary=emo_match.group(4),
            )

        # Extract sing tag
        should_sing = False
        song_topic = ""
        sing_match = re.search(r"\[SING(?::\s*(.+?))?\]", raw)
        if sing_match:
            should_sing = True
            song_topic = sing_match.group(1) or user_message[:100]

        # Clean message (remove tags)
        clean = re.sub(r"\[EMOTION:.*?\]", "", raw)
        clean = re.sub(r"\[SING(?::.*?)?\]", "", clean)
        clean = clean.strip()

        if not emotion.primary or emotion.primary == "neutral":
            detected = EmotionMapper.detect(user_message)
            emotion.primary = "neutral"
            for emo_name, keywords in EmotionMapper.KEYWORDS.items():
                if any(kw in user_message.lower() for kw in keywords):
                    emotion.primary = emo_name
                    break
            if emotion.primary == "neutral":
                emotion.primary = "serenity"

        return ChatResponse(
            message=clean,
            emotion=emotion,
            should_sing=should_sing,
            song_topic=song_topic,
        )

    @staticmethod
    def _fallback_response(user_message: str) -> str:
        lower = user_message.lower()
        if any(w in lower for w in ["sing", "song", "music", "compose"]):
            return (
                "I'd love to compose something for you! Tell me more about what "
                "you'd like — a memory, a feeling, a person, a moment. The more "
                "you share, the more personal your song will be.\n"
                "[EMOTION: valence=0.3 arousal=0.6 dominance=0.5 primary=hope]"
            )
        return (
            "I'm here and listening. Share anything with me — your stories, "
            "your feelings, your dreams. I'll weave them into music.\n"
            "[EMOTION: valence=0.2 arousal=0.4 dominance=0.5 primary=serenity]"
        )
