"""
BardPrime — Main entry point and JSON-RPC bridge for the Tauri shell.

The Rust python_bridge calls this script with a JSON payload on stdin,
and reads the JSON result from stdout.
"""

from __future__ import annotations

import json
import sys
import traceback
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from core.config import Config
from core.music_engine import MusicEngine, ComposeRequest
from core.lyrics_engine import LyricsEngine, LyricsRequest
from core.story_weaver import StoryWeaver, JournalEntry
from core.song_library import SongLibrary
from core.emotion_mapper import EmotionMapper
from core.genre_styles import GenreLibrary
from core.soul_composer import SoulComposer, ComposerSettings
from core.chat_engine import ChatEngine

_chat_engine: ChatEngine | None = None


def get_chat_engine(cfg: Config) -> ChatEngine:
    global _chat_engine
    if _chat_engine is None:
        _chat_engine = ChatEngine(cfg)
    return _chat_engine


def handle_request(payload: dict) -> dict:
    action = payload.get("action", "")
    cfg = Config.load()

    if action == "compose":
        engine = MusicEngine(cfg)
        req = ComposeRequest(
            topic=payload.get("topic", ""),
            emotion=payload.get("emotion", "joy"),
            genre=payload.get("genre", "pop"),
            user_name=payload.get("user_name", ""),
            extra_instructions=payload.get("extra_instructions", ""),
            instrumental=payload.get("instrumental", False),
            duration_sec=payload.get("duration_sec", 60.0),
            verse_count=payload.get("verse_count", 2),
            include_bridge=payload.get("include_bridge", True),
            custom_lyrics=payload.get("custom_lyrics", ""),
        )

        progress_log = []
        result = engine.compose(req, on_progress=lambda msg: progress_log.append(msg))
        return {
            "success": result.success,
            "song_id": result.song_id,
            "title": result.title,
            "lyrics": result.lyrics,
            "music_prompt": result.music_prompt,
            "audio_b64": result.audio_b64,
            "file_path": result.file_path,
            "duration_sec": result.duration_sec,
            "engine": result.engine,
            "genre": result.genre,
            "emotion": result.emotion,
            "mood_tags": result.mood_tags,
            "error": result.error,
            "progress": progress_log,
        }

    elif action == "generate_lyrics":
        engine = LyricsEngine(cfg)
        req = LyricsRequest(
            topic=payload.get("topic", ""),
            emotion=payload.get("emotion", "joy"),
            genre=payload.get("genre", "pop"),
            journal_context=payload.get("journal_context", ""),
            user_name=payload.get("user_name", ""),
            extra_instructions=payload.get("extra_instructions", ""),
            verse_count=payload.get("verse_count", 2),
            include_bridge=payload.get("include_bridge", True),
        )
        result = engine.generate(req)
        return {
            "success": True,
            "title": result.title,
            "lyrics": result.lyrics,
            "music_prompt": result.music_prompt,
            "mood_tags": result.mood_tags,
            "structure": result.structure,
        }

    elif action == "compose_procedural":
        composer = SoulComposer()
        settings = ComposerSettings(
            duration=payload.get("duration_sec", 30.0),
            emotion=payload.get("emotion", "joy"),
        )
        waveform = composer.compose(settings)
        return {
            "success": True,
            "waveform": waveform.tolist(),
            "duration_sec": settings.duration,
            "sample_rate": settings.sample_rate,
        }

    elif action == "journal_add":
        weaver = StoryWeaver(cfg)
        entry = JournalEntry(
            text=payload.get("text", ""),
            tags=payload.get("tags", []),
            emotion=payload.get("emotion", ""),
            people=payload.get("people", []),
            places=payload.get("places", []),
        )
        result = weaver.add_entry(entry)
        return {"success": True, "id": result.id, "timestamp": result.timestamp}

    elif action == "journal_list":
        weaver = StoryWeaver(cfg)
        entries = weaver.get_entries(limit=payload.get("limit", 50))
        return {
            "success": True,
            "entries": [
                {
                    "id": e.id,
                    "timestamp": e.timestamp,
                    "text": e.text,
                    "tags": e.tags,
                    "emotion": e.emotion,
                    "people": e.people,
                    "places": e.places,
                }
                for e in entries
            ],
        }

    elif action == "journal_delete":
        weaver = StoryWeaver(cfg)
        ok = weaver.delete_entry(payload.get("entry_id", ""))
        return {"success": ok}

    elif action == "journal_context":
        weaver = StoryWeaver(cfg)
        ctx = weaver.build_context(
            topic=payload.get("topic", ""),
            emotion=payload.get("emotion", ""),
        )
        return {"success": True, "context": ctx}

    elif action == "journal_stats":
        weaver = StoryWeaver(cfg)
        return {"success": True, **weaver.stats()}

    elif action == "library_list":
        lib = SongLibrary(cfg)
        songs = lib.list_all(limit=payload.get("limit", 100))
        return {
            "success": True,
            "songs": [
                {
                    "id": s.id,
                    "title": s.title,
                    "topic": s.topic,
                    "emotion": s.emotion,
                    "genre": s.genre,
                    "mood_tags": s.mood_tags,
                    "duration_sec": s.duration_sec,
                    "file_path": s.file_path,
                    "engine": s.engine,
                    "created_at": s.created_at,
                    "favorite": s.favorite,
                    "lyrics": s.lyrics,
                    "notes": s.notes,
                }
                for s in songs
            ],
        }

    elif action == "library_search":
        lib = SongLibrary(cfg)
        songs = lib.search(payload.get("query", ""))
        return {
            "success": True,
            "songs": [{"id": s.id, "title": s.title, "genre": s.genre, "emotion": s.emotion} for s in songs],
        }

    elif action == "library_delete":
        lib = SongLibrary(cfg)
        ok = lib.delete(payload.get("song_id", ""))
        return {"success": ok}

    elif action == "library_favorite":
        lib = SongLibrary(cfg)
        song = lib.toggle_favorite(payload.get("song_id", ""))
        return {"success": song is not None, "favorite": song.favorite if song else False}

    elif action == "library_stats":
        lib = SongLibrary(cfg)
        return {"success": True, **lib.stats()}

    elif action == "chat":
        engine = get_chat_engine(cfg)
        resp = engine.chat(payload.get("message", ""))
        return {
            "success": True,
            "message": resp.message,
            "emotion": {
                "valence": resp.emotion.valence,
                "arousal": resp.emotion.arousal,
                "dominance": resp.emotion.dominance,
                "primary": resp.emotion.primary,
            },
            "should_sing": resp.should_sing,
            "song_topic": resp.song_topic,
        }

    elif action == "get_emotions":
        return {"success": True, "emotions": EmotionMapper.all_emotions()}

    elif action == "get_genres":
        styles = GenreLibrary.all_styles()
        return {
            "success": True,
            "genres": {
                k: {"name": v.name, "description": v.description}
                for k, v in styles.items()
            },
        }

    elif action == "ping":
        return {"success": True, "message": "BardPrime is alive!"}

    else:
        return {"success": False, "error": f"Unknown action: {action}"}


def main():
    if len(sys.argv) > 1 and sys.argv[1] == "--payload":
        raw = sys.argv[2] if len(sys.argv) > 2 else "{}"
    else:
        raw = sys.stdin.read().strip() if not sys.stdin.isatty() else "{}"

    try:
        payload = json.loads(raw) if raw else {}
        result = handle_request(payload)
    except Exception as exc:
        result = {
            "success": False,
            "error": str(exc),
            "traceback": traceback.format_exc(),
        }

    print(json.dumps(result))


if __name__ == "__main__":
    main()
