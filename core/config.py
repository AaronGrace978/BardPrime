"""
BardPrime configuration — single source of truth for all tunables.
"""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

_ROOT = Path(__file__).resolve().parent.parent


@dataclass
class ElevenLabsConfig:
    api_key: str = os.getenv("ELEVENLABS_API_KEY", "")
    voice_id: str = os.getenv("ELEVENLABS_VOICE_ID", "")
    music_model: str = os.getenv("ELEVENLABS_MUSIC_MODEL", "music_v1")
    tts_model: str = "eleven_multilingual_v2"
    base_url: str = "https://api.elevenlabs.io/v1"
    enabled: bool = True

    @property
    def available(self) -> bool:
        return bool(self.api_key and self.enabled)


@dataclass
class LLMConfig:
    provider: str = os.getenv("LLM_PROVIDER", "ollama")  # anthropic | openai | ollama | ollama_cloud
    api_key: str = os.getenv("LLM_API_KEY", "")
    base_url: str = os.getenv("LLM_BASE_URL", "")
    model: str = os.getenv("LLM_MODEL", "")
    ollama_host: str = os.getenv("OLLAMA_HOST", "http://localhost:11434")
    ollama_model: str = os.getenv("OLLAMA_MODEL", "llama3")
    ollama_api_key: str = os.getenv("OLLAMA_API_KEY", "")
    temperature: float = 0.85
    max_tokens: int = 2048


@dataclass
class AudioConfig:
    sample_rate: int = 44100
    default_duration: float = 30.0
    max_duration: float = 300.0
    output_format: str = "mp3"
    use_gpu: bool = os.getenv("USE_GPU", "false").lower() == "true"


@dataclass
class Config:
    elevenlabs: ElevenLabsConfig = field(default_factory=ElevenLabsConfig)
    llm: LLMConfig = field(default_factory=LLMConfig)
    audio: AudioConfig = field(default_factory=AudioConfig)

    data_dir: Path = _ROOT / "data"
    songs_dir: Path = _ROOT / "data" / "songs"
    journal_dir: Path = _ROOT / "data" / "journal"
    library_path: Path = _ROOT / "data" / "library.json"

    def ensure_dirs(self):
        for d in [self.data_dir, self.songs_dir, self.journal_dir]:
            d.mkdir(parents=True, exist_ok=True)

    @classmethod
    def load(cls) -> "Config":
        cfg = cls()
        cfg.ensure_dirs()
        return cfg
