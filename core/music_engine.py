"""
MusicEngine — Orchestrates the full BardPrime composition pipeline.

1. Gather context from StoryWeaver
2. Generate lyrics via LyricsEngine
3. Produce audio via SingingEngine (or SoulComposer fallback)
4. Persist to SongLibrary
"""

from __future__ import annotations

import logging
import uuid
from dataclasses import dataclass, field
from pathlib import Path
from typing import Callable, Optional

from core.config import Config
from core.emotion_mapper import EmotionMapper
from core.genre_styles import GenreLibrary
from core.llm_client import configuration_error
from core.lyrics_engine import LyricsEngine, LyricsRequest, LyricsResult
from core.singing_engine import SingingEngine, SingResult
from core.song_library import SongLibrary, SongRecord
from core.story_weaver import StoryWeaver

log = logging.getLogger(__name__)


@dataclass
class ComposeRequest:
    topic: str = ""
    emotion: str = "joy"
    genre: str = "pop"
    user_name: str = ""
    extra_instructions: str = ""
    instrumental: bool = False
    duration_sec: float = 60.0
    verse_count: int = 2
    include_bridge: bool = True
    custom_lyrics: str = ""

    @property
    def duration_ms(self) -> int:
        return int(self.duration_sec * 1000)


@dataclass
class ComposeResult:
    song_id: str = ""
    title: str = ""
    lyrics: str = ""
    music_prompt: str = ""
    audio_b64: str = ""
    file_path: str = ""
    duration_sec: float = 0.0
    engine: str = ""
    genre: str = ""
    emotion: str = ""
    mood_tags: list[str] = field(default_factory=list)
    success: bool = False
    error: str = ""
    render_status: str = "failed"
    render_error: str = ""
    actual_duration_sec: float = 0.0


@dataclass
class ComposePreflightResult:
    success: bool
    errors: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)
    output_path: str = ""


ProgressCallback = Callable[[str], None]


class MusicEngine:
    """Full-stack composition: story → lyrics → music → library."""

    def __init__(self, config: Optional[Config] = None):
        self.cfg = config or Config.load()
        self.lyrics_engine = LyricsEngine(self.cfg)
        self.singing_engine = SingingEngine(self.cfg)
        self.story_weaver = StoryWeaver(self.cfg)
        self.song_library = SongLibrary(self.cfg)

    def compose(
        self,
        req: ComposeRequest,
        on_progress: Optional[ProgressCallback] = None,
    ) -> ComposeResult:
        song_id = str(uuid.uuid4())
        progress = on_progress or (lambda msg: None)
        save_path = str(self.cfg.songs_dir / f"{song_id}.mp3")

        progress("Checking your setup...")
        preflight = self.preflight(req, save_path=save_path)
        if not preflight.success:
            return ComposeResult(
                song_id=song_id,
                title=req.topic or "Untitled Song",
                genre=req.genre,
                emotion=req.emotion,
                success=False,
                error=" ".join(preflight.errors),
                render_status="failed",
                render_error=" ".join(preflight.errors),
            )

        progress("Gathering your story...")
        journal_context = self.story_weaver.build_context(
            topic=req.topic, emotion=req.emotion
        )

        if req.custom_lyrics:
            progress("Using your custom lyrics...")
            lyrics_result = LyricsResult(
                lyrics=req.custom_lyrics,
                title=req.topic or "Custom Song",
                music_prompt=self._build_music_prompt(req),
                structure=[],
                mood_tags=[req.emotion],
            )
        else:
            progress("The Bard is writing your song...")
            lyrics_result = self.lyrics_engine.generate(
                LyricsRequest(
                    topic=req.topic,
                    emotion=req.emotion,
                    genre=req.genre,
                    journal_context=journal_context,
                    user_name=req.user_name,
                    extra_instructions=req.extra_instructions,
                    verse_count=req.verse_count,
                    include_bridge=req.include_bridge,
                )
            )

        if req.instrumental:
            lyrics_result.lyrics = ""
            if "sung lyrics" in lyrics_result.music_prompt:
                lyrics_result.music_prompt = lyrics_result.music_prompt.replace(
                    "with clear intelligible sung lyrics", "instrumental only"
                )

        progress("Composing the music...")

        if req.instrumental:
            sing_result = self.singing_engine.generate_instrumental(
                lyrics_result.music_prompt, req.duration_ms, on_progress=progress
            )
        else:
            sing_result = self.singing_engine.sing(
                lyrics=lyrics_result.lyrics,
                music_prompt=lyrics_result.music_prompt,
                duration_ms=req.duration_ms,
                save_path=save_path,
                on_progress=progress,
            )

        if sing_result.success:
            if not sing_result.file_path:
                sing_result.file_path = self.singing_engine._save_audio(
                    sing_result.audio_b64, save_path
                )
            if not sing_result.file_path:
                sing_result.success = False
                sing_result.error = "Audio render completed without a saved file."

        if not sing_result.success:
            progress(f"Note: {sing_result.error}")
            return ComposeResult(
                song_id=song_id,
                title=lyrics_result.title,
                lyrics=lyrics_result.lyrics,
                music_prompt=lyrics_result.music_prompt,
                duration_sec=req.duration_sec,
                engine=sing_result.engine,
                genre=req.genre,
                emotion=req.emotion,
                mood_tags=lyrics_result.mood_tags,
                success=False,
                error=sing_result.error,
                render_status="failed",
                render_error=sing_result.error,
                actual_duration_sec=sing_result.duration_sec,
            )

        progress("Saving to your library...")

        record = SongRecord(
            id=song_id,
            title=lyrics_result.title,
            lyrics=lyrics_result.lyrics,
            music_prompt=lyrics_result.music_prompt,
            topic=req.topic,
            emotion=req.emotion,
            genre=req.genre,
            mood_tags=lyrics_result.mood_tags,
            duration_sec=req.duration_sec,
            actual_duration_sec=sing_result.duration_sec or req.duration_sec,
            file_path=sing_result.file_path,
            engine=sing_result.engine,
            user_name=req.user_name,
            render_status="ready",
            render_error="",
        )
        self.song_library.save(record)

        progress("Your song is ready!")

        return ComposeResult(
            song_id=song_id,
            title=lyrics_result.title,
            lyrics=lyrics_result.lyrics,
            music_prompt=lyrics_result.music_prompt,
            audio_b64=sing_result.audio_b64,
            file_path=sing_result.file_path,
            duration_sec=sing_result.duration_sec or req.duration_sec,
            engine=sing_result.engine,
            genre=req.genre,
            emotion=req.emotion,
            mood_tags=lyrics_result.mood_tags,
            success=sing_result.success,
            error=sing_result.error,
            render_status="ready",
            render_error="",
            actual_duration_sec=sing_result.duration_sec or req.duration_sec,
        )

    def preflight(
        self,
        req: ComposeRequest,
        save_path: Optional[str] = None,
    ) -> ComposePreflightResult:
        errors: list[str] = []
        warnings: list[str] = []
        output_path = save_path or str(self.cfg.songs_dir / f"{uuid.uuid4()}.mp3")

        if not req.topic.strip():
            errors.append("Please enter a topic for your song.")

        if req.duration_sec <= 0 or req.duration_sec > self.cfg.audio.max_duration:
            errors.append(
                f"Duration must be between 1 and {int(self.cfg.audio.max_duration)} seconds."
            )

        if not req.custom_lyrics.strip() and not req.instrumental:
            llm_issue = configuration_error(self.cfg.llm)
            if llm_issue:
                errors.append(llm_issue)

        if not self.cfg.elevenlabs.available:
            if req.instrumental:
                warnings.append(
                    "ElevenLabs is not configured. Instrumental rendering may fail unless you use procedural compose."
                )
            else:
                errors.append(
                    "ElevenLabs is not configured, so BardPrime cannot render a sung track yet."
                )

        try:
            output = Path(output_path)
            output.parent.mkdir(parents=True, exist_ok=True)
            probe_path = output.with_suffix(output.suffix + ".tmp")
            probe_path.write_bytes(b"")
            probe_path.unlink(missing_ok=True)
        except Exception as exc:
            errors.append(f"Output path is not writable: {exc}")

        if req.instrumental and req.custom_lyrics.strip():
            warnings.append("Custom lyrics will be ignored for instrumental-only renders.")

        return ComposePreflightResult(
            success=len(errors) == 0,
            errors=errors,
            warnings=warnings,
            output_path=output_path,
        )

    def _build_music_prompt(self, req: ComposeRequest) -> str:
        emo = EmotionMapper.get(req.emotion)
        genre = GenreLibrary.get(req.genre)
        return (
            f"{genre.production_style}, {emo.tempo_bpm} BPM, key of {emo.key} {emo.scale}, "
            f"instruments: {', '.join(emo.instruments)}, "
            f"with clear intelligible sung lyrics"
        )

    def get_lyrics_only(self, req: ComposeRequest) -> LyricsResult:
        """Generate lyrics without producing audio."""
        journal_context = self.story_weaver.build_context(
            topic=req.topic, emotion=req.emotion
        )
        return self.lyrics_engine.generate(
            LyricsRequest(
                topic=req.topic,
                emotion=req.emotion,
                genre=req.genre,
                journal_context=journal_context,
                user_name=req.user_name,
                extra_instructions=req.extra_instructions,
                verse_count=req.verse_count,
                include_bridge=req.include_bridge,
            )
        )

    def test_voice_pipeline(self) -> SingResult:
        if not self.cfg.elevenlabs.available:
            return SingResult(
                success=False,
                engine="elevenlabs",
                error="ElevenLabs is not configured. Add your API key in Settings first.",
            )

        return self.singing_engine.sing(
            lyrics=(
                "[Verse 1]\n"
                "BardPrime is awake tonight\n"
                "Testing every signal light\n\n"
                "[Chorus]\n"
                "If you can hear this line ring true\n"
                "The voice pipeline is working for you"
            ),
            music_prompt=(
                "Warm modern pop test vocal, clear intelligible sung lyrics, "
                "gentle piano, soft drums, short phrase-based melody"
            ),
            duration_ms=12_000,
        )
