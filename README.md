# BardPrime — Your Personal Bard

A desktop application that acts as your personal bard — it learns your life story
and composes deeply personal songs about you, your experiences, and anything you
want it to sing about.

## Architecture

```
BardPrime/
├── app/                        # Tauri 2 desktop app
│   ├── src/                    # React + TypeScript + Tailwind frontend
│   │   ├── components/         # UI components
│   │   ├── store/              # Zustand state management
│   │   ├── api/                # Tauri IPC client
│   │   └── types/              # TypeScript types
│   └── src-tauri/              # Rust backend
│       └── src/
│           ├── main.rs         # Tauri commands & app entry
│           ├── python_bridge.rs# Python process management
│           └── secrets.rs      # OS keychain for API keys
├── core/                       # Python engine
│   ├── config.py               # Configuration
│   ├── lyrics_engine.py        # LLM-powered lyrics generation
│   ├── music_engine.py         # Full composition orchestrator
│   ├── singing_engine.py       # ElevenLabs singing pipeline
│   ├── soul_composer.py        # Procedural music (no API needed)
│   ├── story_weaver.py         # Life journal & narrative memory
│   ├── emotion_mapper.py       # Emotion → musical parameters
│   ├── genre_styles.py         # Genre definitions & templates
│   └── song_library.py         # Song persistence
├── bardprime.py                # Python entry point / RPC handler
├── data/                       # Local data (songs, journal)
├── requirements.txt
└── .env.example
```

## How It Works

1. **Tell your story** — Write journal entries about your life, memories,
   feelings, and experiences.

2. **Choose your vibe** — Pick a topic, emotion, and genre for your song.

3. **The Bard composes** — BardPrime uses your journal context + an LLM to
   write deeply personalized lyrics, then generates actual sung music via
   ElevenLabs.

4. **Build your collection** — Every song is saved to your personal library
   with full lyrics, metadata, and audio.

## Tech Stack

| Layer     | Technology                         |
|-----------|------------------------------------|
| Frontend  | React 18, TypeScript, Tailwind CSS, Framer Motion, Zustand |
| Desktop   | Tauri 2 (Rust)                     |
| Audio     | ElevenLabs Music API, rodio        |
| Lyrics    | DeepSeek / OpenAI / Ollama (LLM)   |
| Fallback  | Procedural music via NumPy         |
| Storage   | JSON files, OS keychain for secrets |

## Setup

### Prerequisites

- **Node.js** 18+
- **Rust** (latest stable via rustup)
- **Python** 3.10+
- **Tauri CLI**: `cargo install tauri-cli --version "^2.0.0"`

### Install

```bash
# Python dependencies
pip install -r requirements.txt

# Frontend dependencies
cd app
npm install
```

### API Keys

BardPrime needs two API keys for the full experience:

1. **LLM Key** (for lyrics) — Get one from [DeepSeek](https://platform.deepseek.com/)
   or use OpenAI / local Ollama.
2. **ElevenLabs Key** (for singing) — Get one from [ElevenLabs](https://elevenlabs.io/).

You can enter these through the Settings panel in the app (stored securely in
your OS keychain), or set them in a `.env` file.

**Without API keys:** BardPrime still works — it uses fallback lyrics and can
generate procedural instrumental music. But the magic is in the personalized
singing.

### Run

```bash
cd app
npm run tauri dev
```

### Build

```bash
cd app
npm run tauri build
```

## Features

- **Personalized Lyrics** — LLM-powered songwriting that uses your life journal
  for deeply personal songs
- **13 Genres** — Pop, Folk, Rock, R&B, Hip-Hop, Country, Electronic, Jazz,
  Ballad, Indie, Classical, Lullaby, Epic/Cinematic
- **12 Emotions** — Joy, Melancholy, Love, Triumph, Nostalgia, Wonder, Anger,
  Serenity, Hope, Epic, Playful, Longing
- **ElevenLabs Singing** — Real vocal music generation with the plan → lyrics
  injection → render pipeline
- **Life Journal** — Tag entries with emotions, people, and places for richer
  song context
- **Song Library** — Browse, search, favorite, and replay your songs
- **Procedural Fallback** — Mathematical music generation when offline or
  without API keys
- **Secure Secrets** — API keys stored in OS keychain, never in plain text
- **Beautiful UI** — Dark, bard-themed interface with smooth animations

## Inspired By

- **AGIPrime** — SPARK-driven personalized singing system
- **SoundPrime** — Soul Music Engine and procedural audio research
