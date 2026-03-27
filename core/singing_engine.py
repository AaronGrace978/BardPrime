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
import json
import logging
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Callable, Optional

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
        on_progress: Optional[Callable[[str], None]] = None,
    ) -> SingResult:
        if not self.cfg.elevenlabs.available:
            return SingResult(error="ElevenLabs API key not configured", success=False)

        progress = on_progress or (lambda msg: None)

        progress("Creating composition plan...")
        result = self._sing_with_plan(lyrics, music_prompt, duration_ms)
        if not result.success:
            log.warning("Plan-based singing failed, trying simple generation: %s", result.error)
            progress("Retrying with direct vocal render...")
            result = self._sing_simple(lyrics, music_prompt, duration_ms)

        if result.success and save_path:
            progress("Saving rendered audio...")
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
            plan = self._post_json(
                f"{base}/music/plan",
                {
                    "prompt": music_prompt,
                    "model_id": self.cfg.elevenlabs.music_model,
                    "music_length_ms": duration_ms,
                },
            )
        except requests.RequestException as exc:
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
            render_bytes = self._post_audio(
                f"{base}/music/stream",
                {
                    "composition_plan": plan,
                    "model_id": self.cfg.elevenlabs.music_model,
                },
            )
            audio_b64 = base64.b64encode(render_bytes).decode()
            return SingResult(
                audio_b64=audio_b64,
                duration_sec=duration_ms / 1000.0,
                engine=f"{self._engine_prefix}_plan",
                success=bool(audio_b64),
                error="" if audio_b64 else "No audio in response",
            )
        except requests.RequestException as exc:
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
            render_bytes = self._post_audio(
                f"{base}/music/stream",
                {
                    "prompt": combined_prompt,
                    "model_id": self.cfg.elevenlabs.music_model,
                    "music_length_ms": min(duration_ms, 600_000),
                },
            )
            audio_b64 = base64.b64encode(render_bytes).decode()
            return SingResult(
                audio_b64=audio_b64,
                duration_sec=duration_ms / 1000.0,
                engine=f"{self._engine_prefix}_simple",
                success=bool(audio_b64),
                error="" if audio_b64 else "No audio returned",
            )
        except requests.RequestException as exc:
            return SingResult(error=f"Simple generation failed: {exc}", success=False)

    def generate_instrumental(
        self, music_prompt: str, duration_ms: int = 60_000, on_progress: Optional[Callable[[str], None]] = None
    ) -> SingResult:
        """Instrumental-only generation (no vocals)."""
        base = self.cfg.elevenlabs.base_url
        progress = on_progress or (lambda msg: None)
        progress("Rendering instrumental track...")

        try:
            render_bytes = self._post_audio(
                f"{base}/music/stream",
                {
                    "prompt": music_prompt,
                    "model_id": self.cfg.elevenlabs.music_model,
                    "music_length_ms": min(duration_ms, 600_000),
                    "force_instrumental": True,
                },
            )
            audio_b64 = base64.b64encode(render_bytes).decode()
            return SingResult(
                audio_b64=audio_b64,
                duration_sec=duration_ms / 1000.0,
                engine=f"{self._engine_prefix}_instrumental",
                success=bool(audio_b64),
            )
        except requests.RequestException as exc:
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

    def _post_json(self, url: str, payload: dict) -> dict:
        last_exc: Exception | None = None
        for attempt in range(2):
            try:
                resp = requests.post(
                    url,
                    headers=self._headers(),
                    json=payload,
                    timeout=30,
                )
                self._raise_for_status(resp)
                return resp.json()
            except requests.RequestException as exc:
                last_exc = exc
                if not self._is_retryable(exc, getattr(exc, "response", None)) or attempt == 1:
                    raise
                time.sleep(1.5)
        raise requests.RequestException(str(last_exc) if last_exc else "Request failed")

    def _post_audio(self, url: str, payload: dict) -> bytes:
        last_exc: Exception | None = None
        for attempt in range(2):
            try:
                resp = requests.post(
                    url,
                    headers=self._headers(),
                    json=payload,
                    timeout=300,
                )
                self._raise_for_status(resp)
                self._validate_audio_response(resp)
                return resp.content
            except requests.RequestException as exc:
                last_exc = exc
                if not self._is_retryable(exc, getattr(exc, "response", None)) or attempt == 1:
                    raise
                time.sleep(2.0)
        raise requests.RequestException(str(last_exc) if last_exc else "Request failed")

    def _raise_for_status(self, resp: requests.Response):
        if resp.ok:
            return
        detail = self._response_detail(resp)
        raise requests.HTTPError(
            f"status {resp.status_code}: {detail}",
            response=resp,
        )

    def _validate_audio_response(self, resp: requests.Response):
        content_type = resp.headers.get("content-type", "").lower()
        if "application/json" in content_type or "text/" in content_type:
            raise requests.RequestException(
                f"Expected audio bytes but received {content_type}: {self._response_detail(resp)}"
            )
        if len(resp.content) < 1024:
            raise requests.RequestException(
                f"Received an unexpectedly small audio payload ({len(resp.content)} bytes)."
            )

    @staticmethod
    def _is_retryable(exc: requests.RequestException, resp: Optional[requests.Response]) -> bool:
        if isinstance(exc, (requests.Timeout, requests.ConnectionError)):
            return True
        if resp is not None and resp.status_code in {429, 500, 502, 503, 504}:
            return True
        return False

    @staticmethod
    def _response_detail(resp: requests.Response) -> str:
        try:
            data = resp.json()
            return json.dumps(data)[:300]
        except ValueError:
            return resp.text[:300]
