import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { motion, AnimatePresence } from "framer-motion";
import { Music, Sparkles, Brain, Settings } from "lucide-react";
import { persistedSongId, useStore } from "./store";
import { api } from "./api/client";
import { Sidebar } from "./components/Sidebar";
import { ChatPanel } from "./components/ChatPanel";
import { ComposePanel } from "./components/ComposePanel";
import { LibraryPanel } from "./components/LibraryPanel";
import { JournalPanel } from "./components/JournalPanel";
import { Visualizer } from "./components/Visualizer";
import { SettingsModal } from "./components/SettingsModal";
import { SongPlayer } from "./components/SongPlayer";
import type { ComposeResult } from "./types";

export default function App() {
  const activePanel = useStore((s) => s.activePanel);
  const songs = useStore((s) => s.songs);
  const settingsOpen = useStore((s) => s.settingsOpen);
  const setSettingsOpen = useStore((s) => s.setSettingsOpen);
  const playing = useStore((s) => s.playing);
  const currentSong = useStore((s) => s.currentSong);
  const hasElevenlabsKey = useStore((s) => s.hasElevenlabsKey);
  const hasLlmKey = useStore((s) => s.hasLlmKey);
  const llmConfigured = useStore((s) => s.llmConfigured);
  const musicModel = useStore((s) => s.musicModel);
  const llmProvider = useStore((s) => s.llmProvider);
  const lastResult = useStore((s) => s.lastResult);
  const theme = useStore((s) => s.theme);
  const setEmotions = useStore((s) => s.setEmotions);
  const setGenres = useStore((s) => s.setGenres);
  const setHasElevenlabsKey = useStore((s) => s.setHasElevenlabsKey);
  const setHasLlmKey = useStore((s) => s.setHasLlmKey);
  const setLlmConfigured = useStore((s) => s.setLlmConfigured);
  const setComposing = useStore((s) => s.setComposing);
  const setComposeProgress = useStore((s) => s.setComposeProgress);
  const setLastResult = useStore((s) => s.setLastResult);
  const setMusicModel = useStore((s) => s.setMusicModel);
  const setLlmProvider = useStore((s) => s.setLlmProvider);
  const setCurrentSong = useStore((s) => s.setCurrentSong);
  const setSongs = useStore((s) => s.setSongs);
  const [journalCount, setJournalCount] = useState(0);

  const getLlmConfigured = (provider: string, hasApiKey: boolean, cfg?: Record<string, unknown>) => {
    if (provider === "ollama") {
      const host = typeof cfg?.ollama_host === "string" ? cfg.ollama_host : "http://localhost:11434";
      const model = typeof cfg?.ollama_local_model === "string"
        ? cfg.ollama_local_model
        : typeof cfg?.ollama_model === "string"
          ? cfg.ollama_model
          : "llama3";
      return Boolean(host.trim() && model.trim());
    }
    if (provider === "ollama_cloud") {
      const model = typeof cfg?.ollama_cloud_model === "string"
        ? cfg.ollama_cloud_model
        : typeof cfg?.ollama_model === "string"
          ? cfg.ollama_model
          : "";
      const cloudKey = typeof cfg?.ollama_api_key === "string" ? cfg.ollama_api_key : "";
      return Boolean(model.trim() && cloudKey.trim());
    }
    const model = typeof cfg?.model === "string" ? cfg.model : "";
    return Boolean(hasApiKey && model.trim());
  };

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  useEffect(() => {
    (async () => {
      try {
        const [emo, gen, el, llm, model, llmCfg, library, journal] = await Promise.all([
          api.getEmotions(), api.getGenres(), api.hasElevenlabsKey(), api.hasLlmKey(), api.getMusicModel(), api.getLlmConfig(), api.libraryList(250), api.journalStats(),
        ]);
        if (emo.emotions) setEmotions(emo.emotions);
        if (gen.genres) setGenres(gen.genres);
        setHasElevenlabsKey(el);
        setHasLlmKey(llm);
        if (model) setMusicModel(model);
        if (library.songs) setSongs(library.songs);
        if (journal.total_entries !== undefined) setJournalCount(journal.total_entries);
        let configured = true;
        if (llmCfg) {
          try {
            const cfg = JSON.parse(llmCfg);
            const provider = cfg.provider || "ollama";
            setLlmProvider(provider);
            configured = getLlmConfigured(provider, llm, cfg);
          } catch {}
        }
        setLlmConfigured(configured);
      } catch {}
    })();
  }, []);

  useEffect(() => {
    const uns: (() => void)[] = [];
    listen<{ job_id: string; step: string }>("compose_progress", (e) => {
      setComposeProgress(e.payload.step);
    }).then((u) => uns.push(u));
    listen<ComposeResult>("compose_complete", (e) => {
      setComposing(false); setLastResult(e.payload); setComposeProgress("");
    }).then((u) => uns.push(u));
    listen<{ job_id: string; error: string }>("compose_error", (e) => {
      setComposing(false); setComposeProgress("");
      setLastResult({ job_id: e.payload.job_id, success: false, error: e.payload.error,
        song_id: "", title: "", lyrics: "", music_prompt: "", audio_b64: "",
        file_path: "", duration_sec: 0, engine: "", genre: "", emotion: "", mood_tags: [],
        render_status: "failed", render_error: e.payload.error, actual_duration_sec: 0 });
    }).then((u) => uns.push(u));
    return () => uns.forEach((u) => u());
  }, []);

  useEffect(() => {
    if (!persistedSongId || currentSong || songs.length === 0) return;
    const restored = songs.find((song) => song.id === persistedSongId);
    if (restored) setCurrentSong(restored);
  }, [songs, currentSong, setCurrentSong]);

  return (
    <div className="h-screen flex flex-col bg-mesh">
      {/* Header */}
      <header className="h-14 flex items-center justify-between px-6 bg-bard-900/80 border-b border-bard-700/30 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-gold-500 to-gold-400 flex items-center justify-center shadow-lg shadow-gold-500/20">
              <Music className="w-4.5 h-4.5 text-bard-950" />
            </div>
            <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-bard-500 border-2 border-bard-900 flex items-center justify-center">
              <Sparkles className="w-2 h-2 text-white" />
            </div>
          </div>
          <div>
            <h1 className="text-lg font-display font-bold shimmer-text">BardPrime</h1>
            <p className="text-[10px] text-bard-400 -mt-0.5 tracking-wider uppercase">Your Personal Bard</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Status pills */}
          <div className="flex items-center gap-2">
            <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-semibold ${
              llmConfigured ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" : "bg-bard-800 border-bard-700/50 text-bard-500"
            }`}>
              <div className={`status-dot ${llmConfigured ? "status-active" : "status-inactive"}`} />
              <Brain className="w-3 h-3" />
              <span>{({anthropic: "Claude", openai: "OpenAI", ollama: "Ollama", ollama_cloud: "Ollama Cloud"} as Record<string, string>)[llmProvider] || "LLM"}</span>
            </div>
            <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-semibold ${
              hasElevenlabsKey ? "bg-amber-500/10 border-amber-500/30 text-amber-400" : "bg-bard-800 border-bard-700/50 text-bard-500"
            }`}>
              <div className={`status-dot ${hasElevenlabsKey ? "status-active" : "status-warning"}`} />
              <Music className="w-3 h-3" />
              <span>{musicModel && musicModel !== "music_v1" ? musicModel : "Singing"}</span>
            </div>
          </div>

          <button onClick={() => setSettingsOpen(true)}
            className="p-2 hover:bg-bard-700/40 rounded-xl transition-colors">
            <Settings className="w-5 h-5 text-bard-400" />
          </button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        <Sidebar />
        <main className="flex-1 flex flex-col overflow-hidden">
          <div className="px-6 pt-4">
            <div className="flex items-center gap-2 text-[11px] text-bard-400 flex-wrap">
              <span className="px-2 py-1 rounded-full border border-bard-700/40 bg-bard-900/40">
                Journal: {journalCount} entries
              </span>
              <span className="px-2 py-1 rounded-full border border-bard-700/40 bg-bard-900/40">
                Library: {songs.length} tracks
              </span>
              <span className={`px-2 py-1 rounded-full border ${songs.some((song) => song.file_missing) ? "border-amber-500/30 bg-amber-500/10 text-amber-300" : "border-bard-700/40 bg-bard-900/40"}`}>
                Missing audio: {songs.filter((song) => song.file_missing).length}
              </span>
              {lastResult?.error && (
                <span className="px-2 py-1 rounded-full border border-red-500/30 bg-red-500/10 text-red-300">
                  Last compose error: {lastResult.error}
                </span>
              )}
            </div>
          </div>
          <div className="flex-1 overflow-auto p-6">
            <AnimatePresence mode="wait">
              <motion.div key={activePanel}
                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.2 }}>
                {activePanel === "chat" && <ChatPanel />}
                {activePanel === "compose" && <ComposePanel />}
                {activePanel === "library" && <LibraryPanel />}
                {activePanel === "journal" && <JournalPanel />}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Visualizer */}
          <div className="h-36 border-t border-bard-700/30 bg-bard-900/60 backdrop-blur-md">
            <Visualizer />
          </div>
        </main>
      </div>

      {currentSong && <SongPlayer />}
      {settingsOpen && <SettingsModal />}
    </div>
  );
}
