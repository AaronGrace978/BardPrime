import { invoke } from "@tauri-apps/api/core";
import type { Song, JournalEntry, ComposeRequest, GenreInfo, LyricsResult } from "../types";

export const api = {
  ping: () => invoke<{ success: boolean; message: string }>("ping"),

  // Chat
  chat: (message: string) =>
    invoke<{
      success: boolean;
      message: string;
      emotion: { valence: number; arousal: number; dominance: number; primary: string };
      should_sing: boolean;
      song_topic: string;
    }>("chat", { message }),

  // Composition
  startCompose: (req: ComposeRequest) => invoke<string>("start_compose", { req }),
  cancelCompose: (jobId: string) => invoke<boolean>("cancel_compose", { jobId }),
  generateLyrics: (topic: string, emotion: string, genre: string, userName?: string, extraInstructions?: string, journalContext?: string) =>
    invoke<LyricsResult>("generate_lyrics", { topic, emotion, genre, userName, extraInstructions, journalContext }),
  composeProcedural: (emotion: string, durationSec?: number) =>
    invoke<{ success: boolean; waveform: number[]; duration_sec: number; sample_rate: number }>(
      "start_compose_procedural", { emotion, durationSec }
    ),

  // Journal
  journalAdd: (text: string, tags: string[], emotion: string, people: string[], places: string[]) =>
    invoke<{ success: boolean; id: string }>("journal_add", { text, tags, emotion, people, places }),
  journalList: (limit?: number) =>
    invoke<{ success: boolean; entries: JournalEntry[] }>("journal_list", { limit: limit ?? 50 }),
  journalDelete: (entryId: string) => invoke<{ success: boolean }>("journal_delete", { entryId }),
  journalStats: () => invoke<{ success: boolean; total_entries: number; themes: number; people: number; places: number }>("journal_stats"),

  // Library
  libraryList: (limit?: number) => invoke<{ success: boolean; songs: Song[] }>("library_list", { limit: limit ?? 100 }),
  librarySearch: (query: string) => invoke<{ success: boolean; songs: Song[] }>("library_search", { query }),
  libraryDelete: (songId: string) => invoke<{ success: boolean }>("library_delete", { songId }),
  libraryFavorite: (songId: string) => invoke<{ success: boolean; favorite: boolean }>("library_favorite", { songId }),
  libraryStats: () => invoke<{ success: boolean; total_songs: number; favorites: number; genres: Record<string, number>; emotions: Record<string, number> }>("library_stats"),

  // Metadata
  getEmotions: () => invoke<{ success: boolean; emotions: string[] }>("get_emotions"),
  getGenres: () => invoke<{ success: boolean; genres: Record<string, GenreInfo> }>("get_genres"),

  // Secrets
  setElevenlabsKey: (apiKey: string) => invoke<boolean>("set_elevenlabs_key", { apiKey }),
  setLlmKey: (apiKey: string) => invoke<boolean>("set_llm_key", { apiKey }),
  hasElevenlabsKey: () => invoke<boolean>("has_elevenlabs_key"),
  hasLlmKey: () => invoke<boolean>("has_llm_key"),
  setLlmConfig: (configJson: string) => invoke<boolean>("set_llm_config", { configJson }),
  getLlmConfig: () => invoke<string>("get_llm_config"),
  setMusicModel: (model: string) => invoke<boolean>("set_music_model", { model }),
  getMusicModel: () => invoke<string>("get_music_model"),

  // Playback
  playAudioFile: (filePath: string) => invoke<boolean>("play_audio_file", { filePath }),
  stopAudio: () => invoke<boolean>("stop_audio"),
  pauseAudio: () => invoke<boolean>("pause_audio"),
  resumeAudio: () => invoke<boolean>("resume_audio"),

  // Export
  exportSong: (source: string, destination: string) => invoke<boolean>("export_song", { source, destination }),
};
