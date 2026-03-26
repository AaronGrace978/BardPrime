import { create } from "zustand";
import type { Song, JournalEntry, Panel, ComposeResult, GenreInfo, ChatMessage } from "../types";

interface BardState {
  activePanel: Panel;
  setActivePanel: (p: Panel) => void;

  composing: boolean;
  composeProgress: string;
  lastResult: ComposeResult | null;
  setComposing: (v: boolean) => void;
  setComposeProgress: (m: string) => void;
  setLastResult: (r: ComposeResult | null) => void;

  songs: Song[];
  setSongs: (s: Song[]) => void;
  removeSong: (id: string) => void;
  toggleFavorite: (id: string) => void;

  entries: JournalEntry[];
  setEntries: (e: JournalEntry[]) => void;
  removeEntry: (id: string) => void;

  emotions: string[];
  genres: Record<string, GenreInfo>;
  setEmotions: (e: string[]) => void;
  setGenres: (g: Record<string, GenreInfo>) => void;

  settingsOpen: boolean;
  setSettingsOpen: (v: boolean) => void;
  hasElevenlabsKey: boolean;
  hasLlmKey: boolean;
  musicModel: string;
  setHasElevenlabsKey: (v: boolean) => void;
  setHasLlmKey: (v: boolean) => void;
  setMusicModel: (m: string) => void;

  currentSong: Song | null;
  playing: boolean;
  paused: boolean;
  setCurrentSong: (s: Song | null) => void;
  setPlaying: (v: boolean) => void;
  setPaused: (v: boolean) => void;

  // Chat → Compose bridge
  composeTopic: string;
  setComposeTopic: (t: string) => void;

  // Chat
  chatMessages: ChatMessage[];
  addChatMessage: (m: ChatMessage) => void;

  // Visualizer
  waveform: number[];
  currentEmotion: { valence: number; arousal: number; dominance: number };
  setWaveform: (w: number[]) => void;
  setCurrentEmotion: (e: { valence: number; arousal: number; dominance: number }) => void;
}

export const useStore = create<BardState>((set) => ({
  activePanel: "chat",
  setActivePanel: (p) => set({ activePanel: p }),

  composing: false, composeProgress: "", lastResult: null,
  setComposing: (v) => set({ composing: v }),
  setComposeProgress: (m) => set({ composeProgress: m }),
  setLastResult: (r) => set({ lastResult: r }),

  songs: [],
  setSongs: (s) => set({ songs: s }),
  removeSong: (id) => set((s) => ({ songs: s.songs.filter((x) => x.id !== id) })),
  toggleFavorite: (id) => set((s) => ({ songs: s.songs.map((x) => x.id === id ? { ...x, favorite: !x.favorite } : x) })),

  entries: [],
  setEntries: (e) => set({ entries: e }),
  removeEntry: (id) => set((s) => ({ entries: s.entries.filter((x) => x.id !== id) })),

  emotions: [], genres: {},
  setEmotions: (e) => set({ emotions: e }),
  setGenres: (g) => set({ genres: g }),

  settingsOpen: false,
  setSettingsOpen: (v) => set({ settingsOpen: v }),
  hasElevenlabsKey: false, hasLlmKey: false, musicModel: "",
  setHasElevenlabsKey: (v) => set({ hasElevenlabsKey: v }),
  setHasLlmKey: (v) => set({ hasLlmKey: v }),
  setMusicModel: (m) => set({ musicModel: m }),

  currentSong: null, playing: false, paused: false,
  setCurrentSong: (s) => set({ currentSong: s }),
  setPlaying: (v) => set({ playing: v }),
  setPaused: (v) => set({ paused: v }),

  composeTopic: "",
  setComposeTopic: (t) => set({ composeTopic: t }),

  chatMessages: [{
    id: "0", role: "assistant",
    content: "Welcome, friend. I am your Bard — tell me about your life, and I'll turn your stories into songs. What would you like me to sing about today?",
    timestamp: new Date(),
  }],
  addChatMessage: (m) => set((s) => ({ chatMessages: [...s.chatMessages, m] })),

  waveform: [],
  currentEmotion: { valence: 0, arousal: 0.5, dominance: 0.5 },
  setWaveform: (w) => set({ waveform: w }),
  setCurrentEmotion: (e) => set({ currentEmotion: e }),
}));
