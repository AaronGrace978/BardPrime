"""
SongLibrary — Persistence layer for all songs BardPrime creates.
"""

from __future__ import annotations

import json
import logging
from dataclasses import dataclass, field, asdict
from datetime import datetime
from pathlib import Path
from typing import Optional

from core.config import Config

log = logging.getLogger(__name__)


@dataclass
class SongRecord:
    id: str = ""
    title: str = ""
    lyrics: str = ""
    music_prompt: str = ""
    topic: str = ""
    emotion: str = ""
    genre: str = ""
    mood_tags: list[str] = field(default_factory=list)
    duration_sec: float = 0.0
    file_path: str = ""
    engine: str = ""
    user_name: str = ""
    created_at: str = ""
    favorite: bool = False
    notes: str = ""

    def __post_init__(self):
        if not self.created_at:
            self.created_at = datetime.utcnow().isoformat()


class SongLibrary:
    """Manages the collection of generated songs."""

    def __init__(self, config: Optional[Config] = None):
        self.cfg = config or Config.load()
        self.library_path = self.cfg.library_path
        self._songs: list[SongRecord] = []
        self._load()

    def _load(self):
        if self.library_path.exists():
            try:
                data = json.loads(self.library_path.read_text(encoding="utf-8"))
                self._songs = [SongRecord(**s) for s in data.get("songs", [])]
            except Exception as exc:
                log.warning("Failed to load library: %s", exc)
                self._songs = []

    def _save(self):
        self.library_path.parent.mkdir(parents=True, exist_ok=True)
        data = {"songs": [asdict(s) for s in self._songs]}
        self.library_path.write_text(
            json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8"
        )

    def save(self, song: SongRecord) -> SongRecord:
        existing = next((s for s in self._songs if s.id == song.id), None)
        if existing:
            idx = self._songs.index(existing)
            self._songs[idx] = song
        else:
            self._songs.insert(0, song)
        self._save()
        return song

    def get(self, song_id: str) -> Optional[SongRecord]:
        return next((s for s in self._songs if s.id == song_id), None)

    def list_all(self, limit: int = 100) -> list[SongRecord]:
        return self._songs[:limit]

    def search(self, query: str) -> list[SongRecord]:
        q = query.lower()
        return [
            s for s in self._songs
            if q in s.title.lower()
            or q in s.lyrics.lower()
            or q in s.topic.lower()
            or q in s.genre.lower()
            or q in s.emotion.lower()
            or any(q in tag.lower() for tag in s.mood_tags)
        ]

    def delete(self, song_id: str) -> bool:
        before = len(self._songs)
        song = self.get(song_id)
        if song and song.file_path:
            p = Path(song.file_path)
            if p.exists():
                try:
                    p.unlink()
                except Exception:
                    pass
        self._songs = [s for s in self._songs if s.id != song_id]
        if len(self._songs) < before:
            self._save()
            return True
        return False

    def toggle_favorite(self, song_id: str) -> Optional[SongRecord]:
        song = self.get(song_id)
        if song:
            song.favorite = not song.favorite
            self._save()
        return song

    def update_notes(self, song_id: str, notes: str) -> Optional[SongRecord]:
        song = self.get(song_id)
        if song:
            song.notes = notes
            self._save()
        return song

    def favorites(self) -> list[SongRecord]:
        return [s for s in self._songs if s.favorite]

    def by_genre(self, genre: str) -> list[SongRecord]:
        return [s for s in self._songs if s.genre.lower() == genre.lower()]

    def by_emotion(self, emotion: str) -> list[SongRecord]:
        return [s for s in self._songs if s.emotion.lower() == emotion.lower()]

    def stats(self) -> dict:
        genres = {}
        emotions = {}
        for s in self._songs:
            genres[s.genre] = genres.get(s.genre, 0) + 1
            emotions[s.emotion] = emotions.get(s.emotion, 0) + 1
        return {
            "total_songs": len(self._songs),
            "favorites": len(self.favorites()),
            "genres": genres,
            "emotions": emotions,
        }
