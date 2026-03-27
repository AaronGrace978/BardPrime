from __future__ import annotations

import tempfile
from pathlib import Path

from core.config import Config
from core.music_engine import ComposeRequest, MusicEngine
from core.song_library import SongLibrary, SongRecord
from core.story_weaver import JournalEntry, StoryWeaver


def build_test_config(root: Path) -> Config:
    cfg = Config()
    cfg.data_dir = root / "data"
    cfg.songs_dir = cfg.data_dir / "songs"
    cfg.journal_dir = cfg.data_dir / "journal"
    cfg.library_path = cfg.data_dir / "library.json"
    cfg.ensure_dirs()
    return cfg


def main():
    with tempfile.TemporaryDirectory() as temp_dir:
        root = Path(temp_dir)
        cfg = build_test_config(root)

        weaver = StoryWeaver(cfg)
        weaver.add_entry(JournalEntry(text="A summer memory with Alex by the lake", emotion="nostalgia"))
        imported_doc = root / "memory.txt"
        imported_doc.write_text("The first kiss felt like starlight and a racing heartbeat.", encoding="utf-8")
        weaver.import_document(str(imported_doc), emotion="love", tags=["memory", "kiss"])
        entries = weaver.get_entries()
        assert len(entries) == 2, "Journal import should create a second entry"
        assert any(entry.attachments for entry in entries), "Imported document should be attached"
        assert "starlight" in weaver.build_context(topic="kiss", emotion="love").lower()

        library = SongLibrary(cfg)
        missing_path = cfg.songs_dir / "missing.mp3"
        ready_path = cfg.songs_dir / "ready.mp3"
        ready_path.write_bytes(b"0" * 2048)
        library.save(SongRecord(id="missing", title="Broken", render_status="ready", file_path=str(missing_path)))
        library.save(SongRecord(id="ready", title="Working", render_status="ready", file_path=str(ready_path)))
        songs = library.list_all()
        assert any(song.file_missing for song in songs if song.id == "missing"), "Missing song should be flagged"
        assert any(not song.file_missing for song in songs if song.id == "ready"), "Existing song should stay valid"

        engine = MusicEngine(cfg)
        vocal_preflight = engine.preflight(ComposeRequest(topic="Test song", emotion="joy", genre="pop"))
        assert not vocal_preflight.success, "Vocal preflight should fail without ElevenLabs"

        instrumental_preflight = engine.preflight(
            ComposeRequest(topic="Instrumental test", emotion="joy", genre="pop", instrumental=True, custom_lyrics="")
        )
        assert instrumental_preflight.output_path.endswith(".mp3"), "Preflight should return an output path"

        print("BardPrime smoke tests passed")


if __name__ == "__main__":
    main()
