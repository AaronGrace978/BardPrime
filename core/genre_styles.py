"""
Genre definitions — musical style templates for BardPrime.
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass
class GenreStyle:
    name: str
    description: str
    typical_instruments: list[str]
    tempo_range: tuple[int, int]
    lyric_tips: str
    production_style: str


_GENRES: dict[str, GenreStyle] = {
    "pop": GenreStyle(
        name="Pop",
        description="Catchy, radio-friendly with strong hooks and memorable melodies",
        typical_instruments=["synth", "electric guitar", "bass", "drums", "keys"],
        tempo_range=(100, 130),
        lyric_tips="Strong, singable chorus with repetition. Conversational verses. Universal themes made personal.",
        production_style="polished, modern pop production with layered vocals and punchy drums",
    ),
    "folk": GenreStyle(
        name="Folk",
        description="Storytelling-driven with acoustic warmth and narrative depth",
        typical_instruments=["acoustic guitar", "banjo", "fiddle", "upright bass", "harmonica"],
        tempo_range=(80, 120),
        lyric_tips="Narrative storytelling with vivid imagery. Poetic language. Each verse advances the story.",
        production_style="warm acoustic production with natural room ambience and intimate mic placement",
    ),
    "rock": GenreStyle(
        name="Rock",
        description="Driving energy with powerful guitars and anthemic choruses",
        typical_instruments=["electric guitar", "bass", "drums", "organ", "backing vocals"],
        tempo_range=(110, 150),
        lyric_tips="Bold, direct statements. Anthemic chorus with power. Raw emotional honesty.",
        production_style="guitar-driven rock production with big drums, distorted guitars, and arena-scale reverb",
    ),
    "r&b": GenreStyle(
        name="R&B / Soul",
        description="Smooth, soulful grooves with rich vocal harmonies",
        typical_instruments=["rhodes piano", "bass guitar", "drums", "strings", "horns"],
        tempo_range=(70, 110),
        lyric_tips="Emotionally rich, intimate lyrics. Smooth melodic flow. Extended vowels for vocal runs.",
        production_style="smooth R&B production with warm bass, silky keys, and lush vocal layering",
    ),
    "hip-hop": GenreStyle(
        name="Hip-Hop",
        description="Rhythmic vocal delivery over beats with clever wordplay",
        typical_instruments=["808 bass", "hi-hats", "synth pads", "samples", "piano"],
        tempo_range=(80, 140),
        lyric_tips="Internal rhymes and wordplay. Rhythmic flow with varied cadence. Personal and authentic.",
        production_style="modern hip-hop production with hard-hitting 808s, crisp hi-hats, and atmospheric pads",
    ),
    "country": GenreStyle(
        name="Country",
        description="Heartfelt storytelling with twang and down-home warmth",
        typical_instruments=["acoustic guitar", "steel guitar", "fiddle", "banjo", "bass"],
        tempo_range=(85, 130),
        lyric_tips="Conversational, story-driven. Concrete imagery from everyday life. Honest and relatable.",
        production_style="Nashville-style production with steel guitar, organic drums, and warm vocal presence",
    ),
    "electronic": GenreStyle(
        name="Electronic",
        description="Synthesizer-driven with pulsing rhythms and atmospheric textures",
        typical_instruments=["synthesizers", "drum machine", "vocoder", "arpeggiated synth", "sub bass"],
        tempo_range=(110, 145),
        lyric_tips="Repetitive, hypnotic phrasing. Abstract and evocative imagery. Less is more.",
        production_style="electronic production with layered synths, sidechain compression, atmospheric builds and drops",
    ),
    "jazz": GenreStyle(
        name="Jazz",
        description="Sophisticated harmonies with swing feel and improvisational spirit",
        typical_instruments=["piano", "upright bass", "drums", "saxophone", "trumpet"],
        tempo_range=(90, 160),
        lyric_tips="Poetic, sophisticated language. Clever metaphors. Conversational swing rhythm.",
        production_style="jazz trio/quartet production with warm vintage tone, room mics, and organic feel",
    ),
    "ballad": GenreStyle(
        name="Ballad",
        description="Slow, emotional power song that builds to a climactic peak",
        typical_instruments=["piano", "strings", "acoustic guitar", "soft drums", "choir"],
        tempo_range=(60, 85),
        lyric_tips="Deeply emotional, builds intensity. Start intimate, build to powerful. Tell a complete emotional journey.",
        production_style="cinematic ballad production building from solo piano to full orchestral arrangement",
    ),
    "indie": GenreStyle(
        name="Indie",
        description="Alternative, artistic expression with unconventional structure",
        typical_instruments=["jangly guitar", "synth", "bass", "drums", "glockenspiel"],
        tempo_range=(90, 130),
        lyric_tips="Poetic, abstract imagery. Unexpected metaphors. Authentic vulnerability over polish.",
        production_style="lo-fi to mid-fi indie production with textural guitars, dreamy reverb, and imperfect charm",
    ),
    "classical": GenreStyle(
        name="Classical / Orchestral",
        description="Grand orchestral composition with dramatic dynamics",
        typical_instruments=["full orchestra", "choir", "solo violin", "piano", "harp"],
        tempo_range=(60, 140),
        lyric_tips="Operatic phrasing with dramatic arcs. Formal but emotionally overwhelming. Latin or vernacular.",
        production_style="orchestral production with concert-hall acoustics, dynamic range, and cinematic scope",
    ),
    "lullaby": GenreStyle(
        name="Lullaby",
        description="Gentle, soothing melodies designed to comfort and calm",
        typical_instruments=["music box", "soft piano", "harp", "gentle strings", "flute"],
        tempo_range=(55, 75),
        lyric_tips="Simple, reassuring words. Repetitive and soothing. Warm, protective imagery.",
        production_style="intimate, whisper-soft production with delicate instrumentation and warm low-end",
    ),
    "epic": GenreStyle(
        name="Epic / Cinematic",
        description="Massive, sweeping compositions that feel like a movie soundtrack",
        typical_instruments=["orchestra", "choir", "war drums", "brass", "electric guitar", "pipe organ"],
        tempo_range=(80, 130),
        lyric_tips="Mythic, legendary language. Grand statements. Themes of heroism and destiny.",
        production_style="Hans Zimmer-style cinematic production with massive percussion, soaring strings, and wall-of-sound choir",
    ),
}


class GenreLibrary:
    @classmethod
    def get(cls, name: str) -> GenreStyle:
        return _GENRES.get(name.lower(), _GENRES["pop"])

    @classmethod
    def all_genres(cls) -> list[str]:
        return list(_GENRES.keys())

    @classmethod
    def all_styles(cls) -> dict[str, GenreStyle]:
        return dict(_GENRES)
