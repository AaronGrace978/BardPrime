# BardPrime Release Checklist

## Build Gates

- `npm run build` succeeds in `app/`
- `cargo check` succeeds in `app/src-tauri/`
- `python scripts/smoke_test.py` succeeds

## Product Gates

- Chat responds with the selected provider or shows a clear actionable error
- `Test Connection` works for the active LLM provider
- `Test Voice Pipeline` works when ElevenLabs is configured
- Compose preflight blocks invalid settings before a render starts
- Compose emits real stage progress and does not save failed renders as ready songs
- Library playback supports seek, queue navigation, and keyboard shortcuts
- Library flags missing audio files instead of failing silently
- Journal can save entries, import documents, and attach files to existing entries

## Packaging Gates

- Packaged app finds `bardprime.py` or `BARDPRIME_ROOT` correctly
- Packaged app can discover Python or a configured `BARDPRIME_PYTHON`
- Keychain-backed provider settings persist across restarts
- Initial health bar shows provider state, journal count, and missing audio count
