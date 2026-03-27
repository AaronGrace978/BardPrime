"""
StoryWeaver — The memory and narrative system of BardPrime.

Manages the user's life journal, extracts themes, and provides rich context
to the lyrics engine so every song is deeply personal.
"""

from __future__ import annotations

import json
import logging
import re
import shutil
import uuid
from dataclasses import dataclass, field, asdict
from datetime import datetime
from pathlib import Path
from typing import Optional

from core.config import Config

log = logging.getLogger(__name__)


@dataclass
class JournalAttachment:
    id: str = ""
    file_name: str = ""
    stored_path: str = ""
    source_path: str = ""
    source_type: str = "document"
    extracted_text: str = ""
    created_at: str = ""

    def __post_init__(self):
        if not self.id:
            self.id = str(uuid.uuid4())
        if not self.created_at:
            self.created_at = datetime.utcnow().isoformat()


@dataclass
class JournalEntry:
    id: str = ""
    timestamp: str = ""
    text: str = ""
    tags: list[str] = field(default_factory=list)
    emotion: str = ""
    people: list[str] = field(default_factory=list)
    places: list[str] = field(default_factory=list)
    attachments: list[JournalAttachment] = field(default_factory=list)
    source_type: str = "journal"
    source_name: str = ""

    def __post_init__(self):
        if not self.id:
            self.id = str(uuid.uuid4())
        if not self.timestamp:
            self.timestamp = datetime.utcnow().isoformat()
        self.attachments = [
            a if isinstance(a, JournalAttachment) else JournalAttachment(**a)
            for a in self.attachments
        ]


@dataclass
class LifeTheme:
    name: str
    mentions: int = 0
    emotions: list[str] = field(default_factory=list)
    recent_entries: list[str] = field(default_factory=list)


class StoryWeaver:
    """Manages the user's life narrative for personalized songwriting."""

    def __init__(self, config: Optional[Config] = None):
        self.cfg = config or Config.load()
        self.journal_path = self.cfg.journal_dir / "journal.json"
        self.attachments_dir = self.cfg.journal_dir / "attachments"
        self._entries: list[JournalEntry] = []
        self._load()

    def _load(self):
        if self.journal_path.exists():
            try:
                data = json.loads(self.journal_path.read_text(encoding="utf-8"))
                self._entries = [JournalEntry(**e) for e in data.get("entries", [])]
            except Exception as exc:
                log.warning("Failed to load journal: %s", exc)
                self._entries = []

    def _save(self):
        self.cfg.journal_dir.mkdir(parents=True, exist_ok=True)
        self.attachments_dir.mkdir(parents=True, exist_ok=True)
        data = {"entries": [asdict(e) for e in self._entries]}
        self.journal_path.write_text(
            json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8"
        )

    def add_entry(self, entry: JournalEntry) -> JournalEntry:
        self._entries.append(entry)
        self._save()
        return entry

    def get_entries(self, limit: int = 50) -> list[JournalEntry]:
        return sorted(self._entries, key=lambda e: e.timestamp, reverse=True)[:limit]

    def delete_entry(self, entry_id: str) -> bool:
        before = len(self._entries)
        self._entries = [e for e in self._entries if e.id != entry_id]
        if len(self._entries) < before:
            self._save()
            return True
        return False

    def update_entry(
        self,
        entry_id: str,
        text: Optional[str] = None,
        tags: Optional[list[str]] = None,
        emotion: Optional[str] = None,
        people: Optional[list[str]] = None,
        places: Optional[list[str]] = None,
    ) -> Optional[JournalEntry]:
        for e in self._entries:
            if e.id == entry_id:
                if text is not None:
                    e.text = text
                if tags is not None:
                    e.tags = tags
                if emotion is not None:
                    e.emotion = emotion
                if people is not None:
                    e.people = people
                if places is not None:
                    e.places = places
                self._save()
                return e
        return None

    def attach_document(self, entry_id: str, file_path: str) -> Optional[JournalEntry]:
        entry = next((e for e in self._entries if e.id == entry_id), None)
        if not entry:
            return None
        attachment = self._store_attachment(file_path)
        entry.attachments.append(attachment)
        self._save()
        return entry

    def import_document(
        self,
        file_path: str,
        emotion: str = "",
        tags: Optional[list[str]] = None,
        people: Optional[list[str]] = None,
        places: Optional[list[str]] = None,
    ) -> JournalEntry:
        attachment = self._store_attachment(file_path)
        extracted = attachment.extracted_text.strip()
        summary = extracted[:2500] if extracted else f"Imported document: {attachment.file_name}"
        entry = JournalEntry(
            text=summary,
            tags=tags or [],
            emotion=emotion,
            people=people or [],
            places=places or [],
            attachments=[attachment],
            source_type="document_import",
            source_name=attachment.file_name,
        )
        self._entries.append(entry)
        self._save()
        return entry

    def build_context(self, topic: str = "", emotion: str = "", max_chars: int = 2000) -> str:
        """Build a rich narrative context string for the lyrics engine."""
        relevant = self._find_relevant(topic, emotion)
        if not relevant:
            return ""

        parts = ["Life context for songwriting:"]
        char_count = 0

        for entry in relevant:
            snippet = entry.text[:300]
            source_label = f" ({entry.source_name})" if entry.source_name else ""
            line = f"- [{entry.timestamp[:10]}]{source_label} {snippet}"
            if entry.people:
                line += f" (people: {', '.join(entry.people)})"
            if entry.places:
                line += f" (places: {', '.join(entry.places)})"

            if char_count + len(line) > max_chars:
                break
            parts.append(line)
            char_count += len(line)

            for attachment in entry.attachments[:2]:
                attachment_snippet = attachment.extracted_text[:200].strip()
                if not attachment_snippet:
                    continue
                attachment_line = f"  attached:{attachment.file_name} — {attachment_snippet}"
                if char_count + len(attachment_line) > max_chars:
                    break
                parts.append(attachment_line)
                char_count += len(attachment_line)

        themes = self.extract_themes()
        if themes:
            theme_strs = [f"{t.name} (×{t.mentions})" for t in themes[:5]]
            parts.append(f"\nRecurring life themes: {', '.join(theme_strs)}")

        return "\n".join(parts)

    def _find_relevant(self, topic: str, emotion: str) -> list[JournalEntry]:
        topic_lower = topic.lower()
        emotion_lower = emotion.lower()

        scored: list[tuple[float, JournalEntry]] = []
        for entry in self._entries:
            score = 0.0
            attachment_text = " ".join(a.extracted_text for a in entry.attachments)
            text_lower = f"{entry.text} {attachment_text}".lower()
            if topic_lower and topic_lower in text_lower:
                score += 3.0
            for tag in entry.tags:
                if topic_lower and topic_lower in tag.lower():
                    score += 2.0
                if emotion_lower and emotion_lower in tag.lower():
                    score += 1.5
            if emotion_lower and emotion_lower == entry.emotion.lower():
                score += 2.0
            score += 0.5  # recency bonus baseline
            scored.append((score, entry))

        scored.sort(key=lambda x: x[0], reverse=True)
        return [entry for _, entry in scored[:10]]

    def extract_themes(self) -> list[LifeTheme]:
        """Extract recurring themes from all journal entries."""
        word_freq: dict[str, LifeTheme] = {}
        stop_words = {
            "the", "a", "an", "is", "was", "are", "were", "been", "be",
            "have", "has", "had", "do", "does", "did", "will", "would",
            "could", "should", "may", "might", "must", "shall", "can",
            "for", "and", "nor", "but", "or", "yet", "so", "in", "on",
            "at", "to", "from", "by", "with", "about", "into", "through",
            "of", "it", "its", "my", "your", "his", "her", "our", "their",
            "this", "that", "these", "those", "i", "me", "we", "us", "you",
            "he", "she", "they", "them", "what", "which", "who", "whom",
            "not", "no", "just", "very", "really", "also", "too",
        }

        for entry in self._entries:
            words = entry.text.lower().split()
            seen = set()
            for word in words:
                clean = "".join(c for c in word if c.isalpha())
                if len(clean) < 3 or clean in stop_words:
                    continue
                if clean not in seen:
                    seen.add(clean)
                    if clean not in word_freq:
                        word_freq[clean] = LifeTheme(name=clean)
                    word_freq[clean].mentions += 1
                    if entry.emotion and entry.emotion not in word_freq[clean].emotions:
                        word_freq[clean].emotions.append(entry.emotion)

        themes = sorted(word_freq.values(), key=lambda t: t.mentions, reverse=True)
        return [t for t in themes[:20] if t.mentions >= 2]

    def get_people(self) -> list[str]:
        people = set()
        for entry in self._entries:
            people.update(entry.people)
        return sorted(people)

    def get_places(self) -> list[str]:
        places = set()
        for entry in self._entries:
            places.update(entry.places)
        return sorted(places)

    def stats(self) -> dict:
        return {
            "total_entries": len(self._entries),
            "themes": len(self.extract_themes()),
            "people": len(self.get_people()),
            "places": len(self.get_places()),
            "attachments": sum(len(e.attachments) for e in self._entries),
            "earliest": self._entries[-1].timestamp if self._entries else None,
            "latest": self._entries[0].timestamp if self._entries else None,
        }

    def _store_attachment(self, file_path: str) -> JournalAttachment:
        source = Path(file_path)
        if not source.exists():
            raise FileNotFoundError(f"Attachment not found: {file_path}")

        self.attachments_dir.mkdir(parents=True, exist_ok=True)
        unique_name = f"{uuid.uuid4()}-{source.name}"
        destination = self.attachments_dir / unique_name
        shutil.copy2(source, destination)

        return JournalAttachment(
            file_name=source.name,
            stored_path=str(destination),
            source_path=str(source),
            source_type="document",
            extracted_text=self._extract_document_text(destination),
        )

    def _extract_document_text(self, path: Path) -> str:
        suffix = path.suffix.lower()
        if suffix in {".txt", ".md", ".json", ".jsonl", ".log", ".csv", ".py"}:
            try:
                return path.read_text(encoding="utf-8", errors="ignore")[:12000]
            except Exception:
                return ""

        if suffix == ".pdf":
            try:
                raw = path.read_bytes().decode("latin-1", errors="ignore")
                chunks = [match.strip() for match in re.findall(r"\(([^()]*)\)", raw)]
                return " ".join(chunks)[:12000]
            except Exception:
                return ""

        return ""
