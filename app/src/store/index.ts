import { create } from "zustand";
import type { Song, JournalEntry, Panel, ComposeResult, GenreInfo, ChatMessage } from "../types";

export type ThemeId = "bard" | "obsidian" | "velvet" | "aurora" | "forge" | "sakura" | "ocean" | "noir";

interface BardState {
  theme: ThemeId;
  setTheme: (t: ThemeId) => void;

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
  llmConfigured: boolean;
  musicModel: string;
  llmProvider: string;
  setHasElevenlabsKey: (v: boolean) => void;
  setHasLlmKey: (v: boolean) => void;
  setLlmConfigured: (v: boolean) => void;
  setMusicModel: (m: string) => void;
  setLlmProvider: (p: string) => void;

  currentSong: Song | null;
  playbackQueue: Song[];
  playbackIndex: number;
  playing: boolean;
  paused: boolean;
  setCurrentSong: (s: Song | null) => void;
  setPlaybackQueue: (songs: Song[], currentSongId?: string) => void;
  playNext: () => void;
  playPrevious: () => void;
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

function loadTheme(): ThemeId {
  try {
    const saved = localStorage.getItem("bardprime-theme");
    if (saved && ["bard", "obsidian", "velvet", "aurora", "forge", "sakura", "ocean", "noir"].includes(saved)) {
      return saved as ThemeId;
    }
  } catch {}
  return "bard";
}

function loadCurrentSongId(): string {
  try {
    return localStorage.getItem("bardprime-current-song-id") || "";
  } catch {}
  return "";
}

const persistedSongId = loadCurrentSongId();

export const useStore = create<BardState>((set) => ({
  theme: loadTheme(),
  setTheme: (t) => {
    localStorage.setItem("bardprime-theme", t);
    document.documentElement.setAttribute("data-theme", t);
    set({ theme: t });
  },

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
  hasElevenlabsKey: false, hasLlmKey: false, llmConfigured: true, musicModel: "", llmProvider: "ollama",
  setHasElevenlabsKey: (v) => set({ hasElevenlabsKey: v }),
  setHasLlmKey: (v) => set({ hasLlmKey: v }),
  setLlmConfigured: (v) => set({ llmConfigured: v }),
  setMusicModel: (m) => set({ musicModel: m }),
  setLlmProvider: (p) => set({ llmProvider: p }),

  currentSong: null, playbackQueue: [], playbackIndex: -1, playing: false, paused: false,
  setCurrentSong: (s) => {
    try {
      if (s?.id) localStorage.setItem("bardprime-current-song-id", s.id);
      else localStorage.removeItem("bardprime-current-song-id");
    } catch {}
    set((state) => {
      if (!s) return { currentSong: null, playbackIndex: -1 };
      const queueIndex = state.playbackQueue.findIndex((song) => song.id === s.id);
      return { currentSong: s, playbackIndex: queueIndex >= 0 ? queueIndex : state.playbackIndex };
    });
  },
  setPlaybackQueue: (songs, currentSongId) => set(() => {
    const playbackIndex = currentSongId ? songs.findIndex((song) => song.id === currentSongId) : 0;
    const currentSong = playbackIndex >= 0 ? songs[playbackIndex] : (songs[0] || null);
    try {
      if (currentSong?.id) localStorage.setItem("bardprime-current-song-id", currentSong.id);
    } catch {}
    return { playbackQueue: songs, playbackIndex, currentSong };
  }),
  playNext: () => set((state) => {
    if (state.playbackQueue.length === 0) return {};
    const nextIndex = Math.min(state.playbackIndex + 1, state.playbackQueue.length - 1);
    const nextSong = state.playbackQueue[nextIndex];
    try {
      if (nextSong?.id) localStorage.setItem("bardprime-current-song-id", nextSong.id);
    } catch {}
    return { playbackIndex: nextIndex, currentSong: nextSong };
  }),
  playPrevious: () => set((state) => {
    if (state.playbackQueue.length === 0) return {};
    const prevIndex = Math.max(state.playbackIndex - 1, 0);
    const prevSong = state.playbackQueue[prevIndex];
    try {
      if (prevSong?.id) localStorage.setItem("bardprime-current-song-id", prevSong.id);
    } catch {}
    return { playbackIndex: prevIndex, currentSong: prevSong };
  }),
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

export { persistedSongId };
