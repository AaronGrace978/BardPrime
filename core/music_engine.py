"""
MusicEngine — Orchestrates the full BardPrime composition pipeline.

1. Gather context from StoryWeaver
2. Generate lyrics via LyricsEngine
3. Produce audio via SingingEngine (or SoulComposer fallback)
4. Persist to SongLibrary
"""

from __future__ import annotations

import logging
import time
import uuid
from dataclasses import dataclass, field
from pathlib import Path
from typing import Callable, Optional

from core.config import Config
from core.emotion_mapper import EmotionMapper
from core.genre_styles import GenreLibrary
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
        save_path = str(self.cfg.songs_dir / f"{song_id}.mp3")

        if self.cfg.elevenlabs.available:
            if req.instrumental:
                sing_result = self.singing_engine.generate_instrumental(
                    lyrics_result.music_prompt, req.duration_ms
                )
            else:
                sing_result = self.singing_engine.sing(
                    lyrics=lyrics_result.lyrics,
                    music_prompt=lyrics_result.music_prompt,
                    duration_ms=req.duration_ms,
                    save_path=save_path,
                )
        else:
            progress("ElevenLabs not available — generating instrumental bed...")
            sing_result = SingResult(
                error="ElevenLabs not configured",
                success=False,
            )

        if sing_result.success:
            if not sing_result.file_path:
                sing_result.file_path = self.singing_engine._save_audio(
                    sing_result.audio_b64, save_path
                )
            progress("Saving to your library...")
        else:
            progress(f"Note: {sing_result.error}")

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
            file_path=sing_result.file_path,
            engine=sing_result.engine,
            user_name=req.user_name,
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
