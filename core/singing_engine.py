"""
SingingEngine — Turns lyrics + music prompt into actual sung audio.

Primary path: ElevenLabs Music API (plan → inject lyrics → detailed render).
Fallback: ElevenLabs simple music generation with lyrics baked into the prompt.
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

    def _sing_with_plan(
        self, lyrics: str, music_prompt: str, duration_ms: int
    ) -> SingResult:
        """ElevenLabs plan → inject lyrics → detailed render."""
        base = self.cfg.elevenlabs.base_url
        headers = {
            "xi-api-key": self.cfg.elevenlabs.api_key,
            "Content-Type": "application/json",
        }

        try:
            plan_resp = requests.post(
                f"{base}/music/plan",
                headers=headers,
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
            sections = plan.get("sections", plan.get("composition_plan", {}).get("sections", []))
            lyric_blocks = [b.strip() for b in lyrics.split("\n\n") if b.strip()]

            for i, section in enumerate(sections):
                if i < len(lyric_blocks):
                    section["lyrics"] = lyric_blocks[i]

            if "composition_plan" in plan:
                plan["composition_plan"]["sections"] = sections
        except Exception as exc:
            log.warning("Failed to inject lyrics into plan: %s", exc)

        try:
            render_resp = requests.post(
                f"{base}/music/detailed",
                headers=headers,
                json={
                    "composition_plan": plan.get("composition_plan", plan),
                    "model_id": self.cfg.elevenlabs.music_model,
                },
                timeout=180,
            )
            render_resp.raise_for_status()

            content_type = render_resp.headers.get("content-type", "")
            if "audio" in content_type or "octet" in content_type:
                audio_b64 = base64.b64encode(render_resp.content).decode()
                duration = duration_ms / 1000.0
                return SingResult(
                    audio_b64=audio_b64,
                    duration_sec=duration,
                    engine=f"{self._engine_prefix}_plan",
                    success=True,
                )
            else:
                data = render_resp.json()
                audio_b64 = data.get("audio", data.get("audio_base64", ""))
                return SingResult(
                    audio_b64=audio_b64,
                    duration_sec=duration_ms / 1000.0,
                    engine=f"{self._engine_prefix}_plan",
                    success=bool(audio_b64),
                    error="" if audio_b64 else "No audio in response",
                )
        except Exception as exc:
            return SingResult(error=f"Detailed render failed: {exc}", success=False)

    def _sing_simple(
        self, lyrics: str, music_prompt: str, duration_ms: int
    ) -> SingResult:
        """Fallback: single-prompt music generation with lyrics in the prompt."""
        base = self.cfg.elevenlabs.base_url
        headers = {
            "xi-api-key": self.cfg.elevenlabs.api_key,
            "Content-Type": "application/json",
        }

        combined_prompt = (
            f"{music_prompt}\n\nLyrics to sing:\n{lyrics[:1500]}"
        )

        try:
            resp = requests.post(
                f"{base}/music",
                headers=headers,
                json={
                    "prompt": combined_prompt,
                    "model_id": self.cfg.elevenlabs.music_model,
                    "duration_seconds": min(duration_ms / 1000.0, 300),
                },
                timeout=180,
            )
            resp.raise_for_status()

            content_type = resp.headers.get("content-type", "")
            if "audio" in content_type or "octet" in content_type:
                audio_b64 = base64.b64encode(resp.content).decode()
            else:
                data = resp.json()
                audio_b64 = data.get("audio", data.get("audio_base64", ""))

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
        headers = {
            "xi-api-key": self.cfg.elevenlabs.api_key,
            "Content-Type": "application/json",
        }

        prompt = f"{music_prompt} (instrumental only, no vocals)"

        try:
            resp = requests.post(
                f"{base}/music",
                headers=headers,
                json={
                    "prompt": prompt,
                    "model_id": self.cfg.elevenlabs.music_model,
                    "duration_seconds": min(duration_ms / 1000.0, 300),
                },
                timeout=180,
            )
            resp.raise_for_status()

            content_type = resp.headers.get("content-type", "")
            if "audio" in content_type or "octet" in content_type:
                audio_b64 = base64.b64encode(resp.content).decode()
            else:
                data = resp.json()
                audio_b64 = data.get("audio", data.get("audio_base64", ""))

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
