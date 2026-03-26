"""
Maps emotional states to musical parameters — tempo, key, scale, dynamics,
instrumentation hints, and lyrical tone.
"""

from __future__ import annotations

import random
from dataclasses import dataclass
from typing import Optional


@dataclass
class MusicalEmotion:
    tempo_bpm: int
    key: str
    scale: str
    dynamics: str          # pp, p, mp, mf, f, ff
    energy: float          # 0-1
    warmth: float          # 0-1
    complexity: float      # 0-1
    instruments: list[str]
    lyrical_tone: str
    color: str             # hex for UI

    def prompt_fragment(self) -> str:
        return (
            f"{self.tempo_bpm} BPM, key of {self.key} {self.scale}, "
            f"{self.dynamics} dynamics, energy {self.energy:.1f}, "
            f"instruments: {', '.join(self.instruments)}"
        )


EMOTION_MAP: dict[str, MusicalEmotion] = {
    "joy": MusicalEmotion(
        tempo_bpm=128, key="C", scale="major", dynamics="f",
        energy=0.9, warmth=0.85, complexity=0.5,
        instruments=["acoustic guitar", "piano", "hand claps", "strings"],
        lyrical_tone="celebratory, uplifting, grateful",
        color="#FFD700",
    ),
    "melancholy": MusicalEmotion(
        tempo_bpm=72, key="Am", scale="minor", dynamics="p",
        energy=0.3, warmth=0.6, complexity=0.7,
        instruments=["piano", "cello", "soft synth pad", "rain ambience"],
        lyrical_tone="reflective, bittersweet, introspective",
        color="#4A6FA5",
    ),
    "love": MusicalEmotion(
        tempo_bpm=90, key="F", scale="major", dynamics="mp",
        energy=0.55, warmth=0.95, complexity=0.6,
        instruments=["acoustic guitar", "violin", "piano", "soft vocals"],
        lyrical_tone="tender, intimate, adoring",
        color="#E8527A",
    ),
    "triumph": MusicalEmotion(
        tempo_bpm=140, key="D", scale="major", dynamics="ff",
        energy=1.0, warmth=0.7, complexity=0.8,
        instruments=["orchestra", "drums", "brass", "electric guitar", "choir"],
        lyrical_tone="victorious, powerful, anthemic",
        color="#FF4500",
    ),
    "nostalgia": MusicalEmotion(
        tempo_bpm=84, key="G", scale="mixolydian", dynamics="mp",
        energy=0.4, warmth=0.8, complexity=0.55,
        instruments=["acoustic guitar", "harmonica", "piano", "light strings"],
        lyrical_tone="wistful, warm memories, gentle longing",
        color="#C4A35A",
    ),
    "wonder": MusicalEmotion(
        tempo_bpm=100, key="Eb", scale="lydian", dynamics="mf",
        energy=0.65, warmth=0.75, complexity=0.85,
        instruments=["celesta", "harp", "strings", "synth shimmer", "choir"],
        lyrical_tone="awestruck, curious, expansive",
        color="#7B68EE",
    ),
    "anger": MusicalEmotion(
        tempo_bpm=155, key="Em", scale="phrygian", dynamics="ff",
        energy=0.95, warmth=0.2, complexity=0.7,
        instruments=["distorted guitar", "heavy drums", "bass", "synth stabs"],
        lyrical_tone="fierce, defiant, raw",
        color="#DC143C",
    ),
    "serenity": MusicalEmotion(
        tempo_bpm=65, key="Db", scale="major", dynamics="pp",
        energy=0.15, warmth=0.9, complexity=0.4,
        instruments=["ambient pad", "piano", "flute", "nature sounds"],
        lyrical_tone="peaceful, meditative, content",
        color="#87CEEB",
    ),
    "hope": MusicalEmotion(
        tempo_bpm=108, key="A", scale="major", dynamics="mf",
        energy=0.7, warmth=0.85, complexity=0.6,
        instruments=["piano", "acoustic guitar", "strings", "light drums"],
        lyrical_tone="optimistic, forward-looking, resilient",
        color="#50C878",
    ),
    "epic": MusicalEmotion(
        tempo_bpm=95, key="Cm", scale="harmonic minor", dynamics="ff",
        energy=0.85, warmth=0.5, complexity=0.95,
        instruments=["full orchestra", "choir", "war drums", "pipe organ", "brass"],
        lyrical_tone="legendary, mythic, grand",
        color="#8B008B",
    ),
    "playful": MusicalEmotion(
        tempo_bpm=132, key="Bb", scale="major", dynamics="mf",
        energy=0.8, warmth=0.7, complexity=0.45,
        instruments=["ukulele", "xylophone", "pizzicato strings", "claps", "whistling"],
        lyrical_tone="witty, lighthearted, fun",
        color="#FF8C00",
    ),
    "longing": MusicalEmotion(
        tempo_bpm=78, key="Fm", scale="dorian", dynamics="p",
        energy=0.35, warmth=0.65, complexity=0.7,
        instruments=["cello", "piano", "acoustic guitar", "distant reverb vocals"],
        lyrical_tone="yearning, aching, deeply felt",
        color="#6A5ACD",
    ),
}


class EmotionMapper:
    """Resolves user-described feelings into concrete musical parameters."""

    KEYWORDS: dict[str, list[str]] = {
        "joy": ["happy", "joyful", "excited", "elated", "cheerful", "glad", "ecstatic", "delighted"],
        "melancholy": ["sad", "melancholy", "blue", "down", "gloomy", "depressed", "somber"],
        "love": ["love", "romantic", "affection", "adore", "crush", "passion", "devotion"],
        "triumph": ["triumph", "victory", "winning", "proud", "accomplished", "champion"],
        "nostalgia": ["nostalgic", "memory", "remember", "past", "childhood", "old times"],
        "wonder": ["wonder", "amazed", "curious", "awe", "magical", "mysterious", "discovery"],
        "anger": ["angry", "furious", "rage", "frustrated", "mad", "livid"],
        "serenity": ["calm", "serene", "peaceful", "relaxed", "zen", "tranquil", "still"],
        "hope": ["hope", "hopeful", "optimistic", "bright", "looking forward", "faith"],
        "epic": ["epic", "legendary", "heroic", "grand", "monumental", "mythic", "saga"],
        "playful": ["playful", "silly", "fun", "goofy", "whimsical", "lighthearted"],
        "longing": ["longing", "yearning", "missing", "ache", "desire", "craving"],
    }

    @classmethod
    def detect(cls, text: str) -> MusicalEmotion:
        text_lower = text.lower()
        scores: dict[str, int] = {}
        for emotion, keywords in cls.KEYWORDS.items():
            scores[emotion] = sum(1 for kw in keywords if kw in text_lower)

        best = max(scores, key=scores.get)  # type: ignore[arg-type]
        if scores[best] == 0:
            best = random.choice(list(EMOTION_MAP.keys()))

        return EMOTION_MAP[best]

    @classmethod
    def get(cls, name: str) -> MusicalEmotion:
        return EMOTION_MAP.get(name, EMOTION_MAP["joy"])

    @classmethod
    def blend(cls, emotions: list[str]) -> MusicalEmotion:
        """Average multiple emotions into a composite."""
        sources = [EMOTION_MAP[e] for e in emotions if e in EMOTION_MAP]
        if not sources:
            return EMOTION_MAP["joy"]
        if len(sources) == 1:
            return sources[0]

        n = len(sources)
        return MusicalEmotion(
            tempo_bpm=round(sum(s.tempo_bpm for s in sources) / n),
            key=sources[0].key,
            scale=sources[0].scale,
            dynamics=sources[0].dynamics,
            energy=sum(s.energy for s in sources) / n,
            warmth=sum(s.warmth for s in sources) / n,
            complexity=sum(s.complexity for s in sources) / n,
            instruments=list({inst for s in sources for inst in s.instruments}),
            lyrical_tone=", ".join(dict.fromkeys(s.lyrical_tone for s in sources)),
            color=sources[0].color,
        )

    @classmethod
    def all_emotions(cls) -> list[str]:
        return list(EMOTION_MAP.keys())
