"""
SingingEngine — Turns lyrics + music prompt into actual sung audio.

Primary path: ElevenLabs Music API (plan → inject lyrics → stream render).
Fallback: ElevenLabs simple streaming with lyrics baked into the prompt.

API reference:
  POST /v1/music/plan      — create composition plan (free, no credits)
  POST /v1/music/stream    — stream audio from prompt OR composition_plan
"""

from __future__ import annotations

import base64
import logging
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

import requests

from core.config import Config

log = logging.getLogger(__name__)


@dataclass
class SingResult:
    audio_b64: str = ""
    file_path: str = ""
    duration_sec: float = 0.0
    engine: str = "elevenlabs"
    success: bool = False
    error: str = ""


class SingingEngine:
    """Produces sung audio from lyrics and a music prompt."""

    def __init__(self, config: Optional[Config] = None):
        self.cfg = config or Config.load()
        self._model_tag = self.cfg.elevenlabs.music_model
        if self._model_tag and self._model_tag != "music_v1":
            self._engine_prefix = f"elevenlabs:{self._model_tag}"
        else:
            self._engine_prefix = "elevenlabs"

    def sing(
        self,
        lyrics: str,
        music_prompt: str,
        duration_ms: int = 60_000,
        save_path: Optional[str] = None,
    ) -> SingResult:
        if not self.cfg.elevenlabs.available:
            return SingResult(error="ElevenLabs API key not configured", success=False)

        result = self._sing_with_plan(lyrics, music_prompt, duration_ms)
        if not result.success:
            log.warning("Plan-based singing failed, trying simple generation: %s", result.error)
            result = self._sing_simple(lyrics, music_prompt, duration_ms)

        if result.success and save_path:
            result.file_path = self._save_audio(result.audio_b64, save_path)

        return result

    def _headers(self) -> dict:
        return {
            "xi-api-key": self.cfg.elevenlabs.api_key,
            "Content-Type": "application/json",
        }

    def _sing_with_plan(
        self, lyrics: str, music_prompt: str, duration_ms: int
    ) -> SingResult:
        """ElevenLabs plan → inject lyrics → stream render."""
        base = self.cfg.elevenlabs.base_url

        try:
            plan_resp = requests.post(
                f"{base}/music/plan",
                headers=self._headers(),
                json={
                    "prompt": music_prompt,
                    "model_id": self.cfg.elevenlabs.music_model,
                    "music_length_ms": duration_ms,
                },
                timeout=30,
            )
            plan_resp.raise_for_status()
            plan = plan_resp.json()
        except Exception as exc:
            return SingResult(error=f"Plan request failed: {exc}", success=False)

        try:
            sections = plan.get("sections", [])
            lyric_blocks = [b.strip() for b in lyrics.split("\n\n") if b.strip()]

            for i, section in enumerate(sections):
                if i < len(lyric_blocks):
                    lines = [line for line in lyric_blocks[i].split("\n") if line.strip()]
                    section["lines"] = lines

            plan["sections"] = sections
        except Exception as exc:
            log.warning("Failed to inject lyrics into plan: %s", exc)

        try:
            render_resp = requests.post(
                f"{base}/music/stream",
                headers=self._headers(),
                json={
                    "composition_plan": plan,
                    "model_id": self.cfg.elevenlabs.music_model,
                },
                timeout=300,
            )
            render_resp.raise_for_status()

            audio_b64 = base64.b64encode(render_resp.content).decode()
            return SingResult(
                audio_b64=audio_b64,
                duration_sec=duration_ms / 1000.0,
                engine=f"{self._engine_prefix}_plan",
                success=bool(audio_b64),
                error="" if audio_b64 else "No audio in response",
            )
        except Exception as exc:
            return SingResult(error=f"Stream render failed: {exc}", success=False)

    def _sing_simple(
        self, lyrics: str, music_prompt: str, duration_ms: int
    ) -> SingResult:
        """Fallback: single-prompt music generation with lyrics in the prompt."""
        base = self.cfg.elevenlabs.base_url

        combined_prompt = (
            f"{music_prompt}\n\nLyrics to sing:\n{lyrics[:1500]}"
        )

        try:
            resp = requests.post(
                f"{base}/music/stream",
                headers=self._headers(),
                json={
                    "prompt": combined_prompt,
                    "model_id": self.cfg.elevenlabs.music_model,
                    "music_length_ms": min(duration_ms, 600_000),
                },
                timeout=300,
            )
            resp.raise_for_status()

            audio_b64 = base64.b64encode(resp.content).decode()
            return SingResult(
                audio_b64=audio_b64,
                duration_sec=duration_ms / 1000.0,
                engine=f"{self._engine_prefix}_simple",
                success=bool(audio_b64),
                error="" if audio_b64 else "No audio returned",
            )
        except Exception as exc:
            return SingResult(error=f"Simple generation failed: {exc}", success=False)

    def generate_instrumental(
        self, music_prompt: str, duration_ms: int = 60_000
    ) -> SingResult:
        """Instrumental-only generation (no vocals)."""
        base = self.cfg.elevenlabs.base_url

        try:
            resp = requests.post(
                f"{base}/music/stream",
                headers=self._headers(),
                json={
                    "prompt": music_prompt,
                    "model_id": self.cfg.elevenlabs.music_model,
                    "music_length_ms": min(duration_ms, 600_000),
                    "force_instrumental": True,
                },
                timeout=300,
            )
            resp.raise_for_status()

            audio_b64 = base64.b64encode(resp.content).decode()
            return SingResult(
                audio_b64=audio_b64,
                duration_sec=duration_ms / 1000.0,
                engine=f"{self._engine_prefix}_instrumental",
                success=bool(audio_b64),
            )
        except Exception as exc:
            return SingResult(error=f"Instrumental generation failed: {exc}", success=False)

    def _save_audio(self, audio_b64: str, path: str) -> str:
        try:
            audio_bytes = base64.b64decode(audio_b64)
            out = Path(path)
            out.parent.mkdir(parents=True, exist_ok=True)
            out.write_bytes(audio_bytes)
            log.info("Saved audio to %s (%d bytes)", path, len(audio_bytes))
            return str(out)
        except Exception as exc:
            log.error("Failed to save audio: %s", exc)
            return ""
