"""
ChatEngine — Conversational interface to BardPrime.

The Bard speaks in character — poetic, warm, musical. It can detect emotions
from the user's messages and offer to compose songs.

Supported providers: anthropic, openai, ollama, ollama_cloud
"""

from __future__ import annotations

import json
import logging
import re
from dataclasses import dataclass
from typing import Optional

from core.config import Config
from core.emotion_mapper import EmotionMapper
from core.llm_client import LLMClientError, call_chat_completion, provider_label

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
    fallback_used: bool = False
    provider_error: str = ""
    provider_label: str = ""


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

        if len(self.history) > 20:
            self.history = self.history[-16:]

        fallback_used = False
        provider_error = ""
        label = provider_label(self.cfg.llm.provider)

        try:
            raw = self._call_llm()
        except LLMClientError as exc:
            provider_error = str(exc)
            fallback_used = True
            log.error("Chat provider failed: %s", exc)
            raw = self._provider_failure_response(user_message, provider_error)

        response = self._parse_response(raw, user_message)
        response.fallback_used = fallback_used
        response.provider_error = provider_error
        response.provider_label = label

        self.history.append({"role": "assistant", "content": response.message})
        return response

    def _call_llm(self) -> str:
        return call_chat_completion(
            self.cfg.llm,
            self.history,
            system=BARD_SYSTEM,
            temperature=0.8,
            max_tokens=512,
            timeout=45,
        )

    def _parse_response(self, raw: str, user_message: str) -> ChatResponse:
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

        should_sing = False
        song_topic = ""
        sing_match = re.search(r"\[SING(?::\s*(.+?))?\]", raw)
        if sing_match:
            should_sing = True
            song_topic = sing_match.group(1) or user_message[:100]

        clean = re.sub(r"\[EMOTION:.*?\]", "", raw)
        clean = re.sub(r"\[SING(?::.*?)?\]", "", clean)
        clean = clean.strip()

        if not emotion.primary or emotion.primary == "neutral":
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

    @staticmethod
    def _provider_failure_response(user_message: str, provider_error: str) -> str:
        lower = user_message.lower()
        if any(w in lower for w in ["sing", "song", "music", "compose"]):
            return (
                "I want to turn that into music, but I can't reach my selected AI brain right now. "
                f"{provider_error} Open Settings and test the connection, then ask me again.\n"
                "[EMOTION: valence=-0.1 arousal=0.4 dominance=0.3 primary=concern]"
            )
        return (
            "I can't reach my selected AI brain right now, so I can't give you a real response yet. "
            f"{provider_error} Open Settings and test the connection, then try again.\n"
            "[EMOTION: valence=-0.1 arousal=0.3 dominance=0.3 primary=concern]"
        )
