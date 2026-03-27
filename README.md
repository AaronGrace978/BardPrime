# BardPrime — Your Personal Bard

A **Tauri 2** desktop app that learns your story and composes personalized songs—lyrics from your choice of LLM, vocals and music through **ElevenLabs**, with a **seekable library player**, **life journal** (including document attachments), and **chat** that uses the same brain as lyrics.

## Architecture

```
BardPrime/
├── app/                          # Tauri 2 desktop shell
│   ├── src/                      # React + TypeScript + Tailwind + Zustand
│   │   ├── components/           # UI (compose, library, player, journal, settings)
│   │   ├── store/                # App state + playback queue
│   │   ├── api/                  # Tauri IPC client
│   │   └── types/                # Shared TS types
│   └── src-tauri/                # Rust: commands, Python bridge, keychain
│       └── src/
│           ├── main.rs           # IPC, compose progress, events
│           ├── python_bridge.rs  # Python discovery (dev + packaged)
│           └── secrets.rs        # OS keychain for API keys
├── core/                         # Python engines (invoked by bardprime.py)
│   ├── llm_client.py             # Unified LLM calls + Ollama discovery/tests
│   ├── chat_engine.py            # Companion chat
│   ├── lyrics_engine.py          # Song lyrics
│   ├── music_engine.py           # Compose orchestration + preflight
│   ├── singing_engine.py         # ElevenLabs singing + instrumental
│   ├── story_weaver.py           # Journal, attachments, memory for context
│   ├── song_library.py           # Song persistence + metadata
│   ├── soul_composer.py          # Procedural fallback
│   ├── emotion_mapper.py
│   ├── genre_styles.py
│   └── config.py
├── scripts/
│   └── smoke_test.py             # Quick backend sanity checks
├── docs/
│   └── release_checklist.md      # Build, product, and packaging gates
├── bardprime.py                  # JSON-RPC entry from Rust
├── data/                         # Local songs, journal, attachments (runtime)
├── requirements.txt
└── .env.example
```

## How it works

1. **Journal** — Save memories; attach or import `.txt`, `.md`, `.json`, `.pdf`, and more. Extracted text feeds composition and chat context.
2. **Compose** — Pick topic, emotion, genre. The app runs **preflight** (LLM + ElevenLabs + paths) before spending API credits; **live progress** streams from the pipeline.
3. **Listen** — Library playback uses **HTML audio** with **seek**, **waveform scrubbing**, **queue** (prev/next), and **keyboard shortcuts** (Space, arrows).
4. **Chat** — Same provider settings as lyrics; connection **Test** in Settings helps catch misconfiguration (including **wrong or missing Ollama model**).

## Tech stack

| Layer | Technology |
|--------|-------------|
| UI | React 18, TypeScript, Vite 6, Tailwind CSS, Framer Motion, Zustand |
| Desktop | Tauri 2 (Rust) |
| Lyrics & chat | Anthropic, OpenAI, **Ollama (local)**, **Ollama Cloud** (via unified `llm_client`) |
| Vocals / music | ElevenLabs Music API |
| Fallback audio | Procedural engine (NumPy), no cloud required |
| Storage | JSON on disk, OS keychain for secrets |

## Setup

### Prerequisites

- **Node.js** 18+
- **Rust** (stable, via [rustup](https://rustup.rs/))
- **Python** 3.10+
- **Tauri CLI** (project uses `@tauri-apps/cli` via `npx` / `npm run tauri`; optional global: `cargo install tauri-cli --version "^2.0.0"`)

### Install

```bash
pip install -r requirements.txt
cd app
npm install
```

### API keys and providers

- **LLM** — Configure in **Settings**: Anthropic, OpenAI, local **Ollama**, or **Ollama Cloud**. Keys are stored in the **OS keychain** when set in the app.
- **ElevenLabs** — Required for full sung output; instrumental-only paths may still use the pipeline depending on mode.

**Without cloud keys**, you can still use **local Ollama** for lyrics/chat (install a model and select it in Settings—**Refresh models** lists what Ollama reports). Local Ollama and Ollama Cloud keep their own saved model selections so switching providers does not overwrite the other. Procedural fallback remains available when APIs are absent.

### Environment (optional)

- **`BARDPRIME_ROOT`** — Root folder containing `bardprime.py` (helps packaged or nonstandard layouts).
- **`BARDPRIME_PYTHON`** — Explicit Python executable for the embedded bridge.

See `.env.example` for additional variables.

### Run (development)

```bash
cd app
npm run tauri dev
```

### Build (production binary)

```bash
cd app
npm run tauri build
```

Frontend-only check: `cd app && npm run build`. Rust check: `cd app/src-tauri && cargo check`.

## Features (current)

**Music & composition**

- Compose with **preflight** checks and **stage progress**; failed renders surface clear errors and metadata (`render_status`, duration when known).
- **ElevenLabs** singing / instrumental path with retries and validation of audio responses.
- **13 genres** and **12 emotions** (see in-app).

**Playback**

- **Seek** and **waveform** scrubbing, **queue** navigation, **keyboard** controls.
- Library shows **render status**, errors, duration, engine; missing files are flagged instead of failing silently.

**Journal & memory**

- Save entries with tags; **attach** files or **import** documents into new entries.
- Text from attachments is folded into **context** for more relevant songs and chat.

**LLM reliability**

- **Test connection** for the active provider; **list local Ollama models** and pick a real installed model (avoids “model not found” surprises).
- Centralized **`llm_client`** with clearer errors and sensible Ollama behavior.

**Security & packaging**

- Secrets in **keychain**; Python/script discovery tuned for **dev and packaged** runs.

## Testing & release

- **Smoke test**: `python scripts/smoke_test.py` (from repo root, with Python deps installed).
- **Release checklist**: [docs/release_checklist.md](docs/release_checklist.md) — build gates, product checks, packaging notes.

## Inspired by

- **AGIPrime** — SPARK-driven personalized singing ideas  
- **SoundPrime** — Soul Music Engine and procedural audio research
