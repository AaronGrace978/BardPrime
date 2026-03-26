import { useState } from "react";
import { motion } from "framer-motion";
import { Play, Pause, Square, X, Music, Clock, Download } from "lucide-react";
import { save } from "@tauri-apps/plugin-dialog";
import { useStore } from "../store";
import { api } from "../api/client";

export function SongPlayer() {
  const song = useStore((s) => s.currentSong);
  const playing = useStore((s) => s.playing);
  const paused = useStore((s) => s.paused);
  const setPlaying = useStore((s) => s.setPlaying);
  const setPaused = useStore((s) => s.setPaused);
  const setCurrentSong = useStore((s) => s.setCurrentSong);
  const [showLyrics, setShowLyrics] = useState(false);

  if (!song) return null;

  const handlePlay = async () => {
    if (paused) {
      try { await api.resumeAudio(); setPaused(false); setPlaying(true); } catch {}
    } else if (song.file_path) {
      try { await api.playAudioFile(song.file_path); setPlaying(true); setPaused(false); } catch {}
    }
  };

  const handlePause = async () => {
    try { await api.pauseAudio(); setPaused(true); setPlaying(false); } catch {}
  };

  const handleStop = async () => {
    try { await api.stopAudio(); } catch {}
    setPlaying(false);
    setPaused(false);
  };

  const handleClose = async () => {
    try { await api.stopAudio(); } catch {}
    setCurrentSong(null);
    setPlaying(false);
    setPaused(false);
  };

  const handleExport = async () => {
    if (!song.file_path) return;
    const ext = song.file_path.split(".").pop() || "mp3";
    const dest = await save({
      defaultPath: `${song.title}.${ext}`,
      filters: [{ name: "Audio", extensions: ["mp3", "wav", "ogg"] }],
    });
    if (dest) {
      try { await api.exportSong(song.file_path, dest); } catch {}
    }
  };

  return (
    <motion.div initial={{ y: 80 }} animate={{ y: 0 }}
      className="fixed bottom-0 inset-x-0 h-16 bg-bard-900/95 border-t border-bard-700/40 backdrop-blur-xl flex items-center px-6 gap-4 z-40">

      <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-gold-500/20 to-bard-600/30 border border-bard-700/40 flex items-center justify-center">
        <Music className="w-5 h-5 text-gold-400" />
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-white truncate">{song.title}</p>
        <p className="text-[10px] text-bard-500 truncate">{song.genre} • {song.emotion}</p>
      </div>

      <div className="flex items-center gap-1 text-xs text-bard-500">
        <Clock className="w-3 h-3" />
        {Math.floor(song.duration_sec / 60)}:{Math.round(song.duration_sec % 60).toString().padStart(2, "0")}
      </div>

      {song.lyrics && (
        <button onClick={() => setShowLyrics(!showLyrics)}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${showLyrics ? "bg-gold-500/15 text-gold-400 border border-gold-500/30" : "text-bard-400 hover:text-bard-200"}`}>
          Lyrics
        </button>
      )}

      {song.file_path && (
        <button onClick={handleExport}
          className="p-2 rounded-lg text-bard-400 hover:text-emerald-400 hover:bg-emerald-500/10 transition-all"
          title="Export song">
          <Download className="w-4 h-4" />
        </button>
      )}

      {(playing || paused) && (
        <button onClick={handleStop}
          className="p-2 rounded-lg text-bard-400 hover:text-red-400 hover:bg-red-500/10 transition-all"
          title="Stop">
          <Square className="w-4 h-4" />
        </button>
      )}

      <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
        onClick={playing ? handlePause : handlePlay}
        className={`w-10 h-10 rounded-full flex items-center justify-center ${playing ? "bg-amber-500" : paused ? "bg-emerald-500" : "bg-gold-500"} text-bard-950`}>
        {playing ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
      </motion.button>

      <button onClick={handleClose} className="p-1.5 hover:bg-bard-800 rounded-lg transition-colors">
        <X className="w-4 h-4 text-bard-500" />
      </button>

      {showLyrics && song.lyrics && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          className="absolute bottom-full left-0 right-0 mb-2 mx-6 max-h-64 overflow-y-auto p-5 bg-bard-900/95 rounded-2xl border border-bard-700/40 backdrop-blur-xl shadow-2xl">
          <pre className="text-sm text-bard-200 whitespace-pre-wrap font-body leading-relaxed">{song.lyrics}</pre>
        </motion.div>
      )}
    </motion.div>
  );
}
