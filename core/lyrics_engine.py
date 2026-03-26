"""
LyricsEngine — The heart of BardPrime.

Generates deeply personalized song lyrics using an LLM, informed by the user's
life journal, emotional state, chosen genre, and topic.

Supported providers: anthropic, openai, ollama, ollama_cloud
"""

from __future__ import annotations

import json
import logging
import re
from dataclasses import dataclass, field
from typing import Optional

import requests

from core.config import Config
from core.emotion_mapper import EmotionMapper, MusicalEmotion
from core.genre_styles import GenreLibrary, GenreStyle

log = logging.getLogger(__name__)


@dataclass
class LyricsRequest:
    topic: str = ""
    emotion: str = "joy"
    genre: str = "pop"
    journal_context: str = ""
    user_name: str = ""
    extra_instructions: str = ""
    verse_count: int = 2
    include_bridge: bool = True


@dataclass
class LyricsResult:
    lyrics: str
    title: str
    music_prompt: str
    structure: list[str] = field(default_factory=list)
    mood_tags: list[str] = field(default_factory=list)


class LyricsEngine:
    """Generates personalized lyrics via LLM."""

    def __init__(self, config: Optional[Config] = None):
        self.cfg = config or Config.load()

    def generate(self, req: LyricsRequest) -> LyricsResult:
        emotion_params: MusicalEmotion = EmotionMapper.get(req.emotion)
        genre_style: GenreStyle = GenreLibrary.get(req.genre)

        system_prompt = self._build_system_prompt()
        user_prompt = self._build_user_prompt(req, emotion_params, genre_style)

        raw = self._call_llm(system_prompt, user_prompt)
        return self._parse_response(raw, emotion_params, genre_style)

    def _build_system_prompt(self) -> str:
        return (
            "You are BardPrime — a legendary personal bard and master songwriter. "
            "You craft deeply personal, emotionally resonant songs about people's lives. "
            "Your lyrics are vivid, specific, and moving. You avoid clichés and generic phrases. "
            "Every song you write feels like it was written by someone who truly knows the person.\n\n"
            "When given a topic, emotion, genre, and personal context, you produce:\n"
            "1. A song TITLE\n"
            "2. Complete LYRICS with clear section markers ([Verse 1], [Chorus], [Verse 2], [Bridge], [Outro])\n"
            "3. A detailed MUSIC_PROMPT describing the ideal musical accompaniment\n"
            "4. A list of MOOD_TAGS (3-5 single-word emotion/vibe tags)\n\n"
            "Respond ONLY in valid JSON with keys: title, lyrics, music_prompt, mood_tags (array of strings).\n"
            "The lyrics should have section markers on their own lines. "
            "Write lyrics that are singable — natural rhythm, clear syllable counts, rhyme where the genre expects it."
        )

    def _build_user_prompt(
        self, req: LyricsRequest, emo: MusicalEmotion, genre: GenreStyle
    ) -> str:
        parts = []

        if req.user_name:
            parts.append(f"This song is for {req.user_name}.")

        parts.append(f"TOPIC: {req.topic or 'a personal reflection on life'}")
        parts.append(f"EMOTION: {req.emotion} — {emo.lyrical_tone}")
        parts.append(f"GENRE: {req.genre} — {genre.description}")
        parts.append(f"TEMPO: ~{emo.tempo_bpm} BPM, Key of {emo.key} {emo.scale}")
        parts.append(f"INSTRUMENTS: {', '.join(emo.instruments)}")

        structure_parts = ["[Verse 1]"]
        structure_parts.append("[Chorus]")
        for i in range(2, req.verse_count + 1):
            structure_parts.append(f"[Verse {i}]")
            structure_parts.append("[Chorus]")
        if req.include_bridge:
            structure_parts.append("[Bridge]")
            structure_parts.append("[Chorus]")
        structure_parts.append("[Outro]")
        parts.append(f"STRUCTURE: {' → '.join(structure_parts)}")

        if genre.lyric_tips:
            parts.append(f"GENRE TIPS: {genre.lyric_tips}")

        if req.journal_context:
            parts.append(
                f"\nPERSONAL CONTEXT (use these real details to make lyrics deeply personal):\n"
                f"{req.journal_context[:2000]}"
            )

        if req.extra_instructions:
            parts.append(f"\nADDITIONAL INSTRUCTIONS: {req.extra_instructions}")

        parts.append(
            "\nWrite the song now. Make it deeply personal, vivid, and emotionally authentic. "
            "The music_prompt should describe the ideal instrumental accompaniment in detail "
            "(style, tempo, key, instruments, texture, dynamics, production style). "
            "Include 'with clear intelligible sung lyrics' in the music_prompt."
        )

        return "\n".join(parts)

    def _call_llm(self, system: str, user: str) -> str:
        cfg = self.cfg.llm

        if cfg.provider == "anthropic":
            return self._call_anthropic(system, user)
        if cfg.provider in ("ollama", "ollama_cloud"):
            return self._call_ollama(system, user)
        return self._call_openai_compat(system, user)

    def _call_openai_compat(self, system: str, user: str) -> str:
        """OpenAI and any OpenAI-compatible API."""
        cfg = self.cfg.llm
        base = cfg.base_url or "https://api.openai.com/v1"
        model = cfg.model or "gpt-5.4-mini"

        try:
            resp = requests.post(
                f"{base}/chat/completions",
                headers={
                    "Content-Type": "application/json",
                    "Authorization": f"Bearer {cfg.api_key}",
                },
                json={
                    "model": model,
                    "messages": [
                        {"role": "system", "content": system},
                        {"role": "user", "content": user},
                    ],
                    "temperature": cfg.temperature,
                    "max_tokens": cfg.max_tokens,
                },
                timeout=60,
            )
            resp.raise_for_status()
            return resp.json()["choices"][0]["message"]["content"]
        except Exception as exc:
            log.error("OpenAI-compat LLM call failed: %s", exc)
            return self._fallback_lyrics()

    def _call_anthropic(self, system: str, user: str) -> str:
        """Anthropic Messages API (Claude)."""
        cfg = self.cfg.llm
        model = cfg.model or "claude-sonnet-4-6-20260217"

        try:
            resp = requests.post(
                "https://api.anthropic.com/v1/messages",
                headers={
                    "Content-Type": "application/json",
                    "x-api-key": cfg.api_key,
                    "anthropic-version": "2023-06-01",
                },
                json={
                    "model": model,
                    "max_tokens": cfg.max_tokens,
                    "system": system,
                    "messages": [{"role": "user", "content": user}],
                    "temperature": cfg.temperature,
                },
                timeout=60,
            )
            resp.raise_for_status()
            data = resp.json()
            return data["content"][0]["text"]
        except Exception as exc:
            log.error("Anthropic call failed: %s", exc)
            return self._fallback_lyrics()

    def _call_ollama(self, system: str, user: str) -> str:
        """Ollama local or cloud. Cloud uses https://ollama.com with Bearer auth."""
        cfg = self.cfg.llm

        if cfg.provider == "ollama_cloud":
            host = "https://ollama.com"
            headers = {}
            if cfg.ollama_api_key:
                headers["Authorization"] = f"Bearer {cfg.ollama_api_key}"
        else:
            host = cfg.ollama_host or "http://localhost:11434"
            headers = {}

        model = cfg.ollama_model or "llama3"

        try:
            resp = requests.post(
                f"{host}/api/chat",
                headers=headers,
                json={
                    "model": model,
                    "messages": [
                        {"role": "system", "content": system},
                        {"role": "user", "content": user},
                    ],
                    "stream": False,
                },
                timeout=120,
            )
            resp.raise_for_status()
            return resp.json()["message"]["content"]
        except Exception as exc:
            log.error("Ollama call failed: %s", exc)
            return self._fallback_lyrics()

    def _parse_response(
        self, raw: str, emo: MusicalEmotion, genre: GenreStyle
    ) -> LyricsResult:
        try:
            match = re.search(r"\{[\s\S]*\}", raw)
            if match:
                data = json.loads(match.group())
            else:
                data = json.loads(raw)

            lyrics = data.get("lyrics", "")
            sections = re.findall(r"\[([^\]]+)\]", lyrics)

            return LyricsResult(
                lyrics=lyrics,
                title=data.get("title", "Untitled Ballad"),
                music_prompt=data.get("music_prompt", emo.prompt_fragment()),
                structure=sections,
                mood_tags=data.get("mood_tags", []),
            )
        except (json.JSONDecodeError, KeyError) as exc:
            log.warning("Failed to parse LLM response as JSON: %s", exc)
            return LyricsResult(
                lyrics=raw,
                title="A Song For You",
                music_prompt=emo.prompt_fragment(),
                structure=[],
                mood_tags=[emo.lyrical_tone.split(",")[0].strip()],
            )

    @staticmethod
    def _fallback_lyrics() -> str:
        return json.dumps({
            "title": "The Road Ahead",
            "lyrics": (
                "[Verse 1]\n"
                "Every sunrise tells a story\n"
                "Written in the colors of the dawn\n"
                "Every heartbeat keeps the melody\n"
                "Playing softly, carrying us on\n\n"
                "[Chorus]\n"
                "We are the songs unsung\n"
                "The words that dance upon our tongue\n"
                "Every moment, every breath\n"
                "A verse that conquers even death\n\n"
                "[Verse 2]\n"
                "Through the valleys and the mountains\n"
                "Through the laughter and the tears\n"
                "Every chapter of our journey\n"
                "Is a symphony across the years\n\n"
                "[Bridge]\n"
                "So let the music play forever\n"
                "Let the bard sing what is true\n"
                "For in this grand and wild adventure\n"
                "The greatest song I know is you\n\n"
                "[Chorus]\n"
                "We are the songs unsung\n"
                "The words that dance upon our tongue\n"
                "Every moment, every breath\n"
                "A verse that conquers even death"
            ),
            "music_prompt": (
                "Uplifting indie folk with acoustic guitar, warm piano, soft strings, "
                "gentle drums, 100 BPM, key of G major, with clear intelligible sung lyrics"
            ),
            "mood_tags": ["hopeful", "warm", "reflective"],
        })
