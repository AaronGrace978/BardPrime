import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Library, Search, Heart, Play, Trash2, Music, Star, Download } from "lucide-react";
import { save } from "@tauri-apps/plugin-dialog";
import { useStore } from "../store";
import { api } from "../api/client";

export function LibraryPanel() {
  const songs = useStore((s) => s.songs);
  const setSongs = useStore((s) => s.setSongs);
  const removeSong = useStore((s) => s.removeSong);
  const toggleFav = useStore((s) => s.toggleFavorite);
  const setCurrentSong = useStore((s) => s.setCurrentSong);

  const [search, setSearch] = useState("");
  const [showFavs, setShowFavs] = useState(false);

  useEffect(() => {
    (async () => { try { const r = await api.libraryList(); if (r.songs) setSongs(r.songs); } catch {} })();
  }, []);

  const filtered = songs.filter((s) => {
    if (showFavs && !s.favorite) return false;
    if (search) {
      const q = search.toLowerCase();
      return s.title.toLowerCase().includes(q) || s.topic.toLowerCase().includes(q) || s.genre.toLowerCase().includes(q);
    }
    return true;
  });

  const handleDelete = async (id: string) => {
    try { await api.libraryDelete(id); removeSong(id); } catch {}
  };

  const handleFav = async (id: string) => {
    try { await api.libraryFavorite(id); toggleFav(id); } catch {}
  };

  const handleExport = async (song: { title: string; file_path: string }) => {
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
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-display font-bold text-white flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-500/20">
            <Library className="w-5 h-5 text-white" />
          </div>
          Song Library
        </h2>
        <p className="text-bard-400 mt-1 ml-[52px]">Your collection of personally crafted songs</p>
      </div>

      {/* Search + filter */}
      <div className="flex gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-bard-500" />
          <input className="input pl-10 text-sm" placeholder="Search songs..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <button onClick={() => setShowFavs(!showFavs)}
          className={`px-4 py-2 rounded-xl font-semibold text-sm border transition-all flex items-center gap-2 ${
            showFavs ? "bg-amber-500/15 text-amber-400 border-amber-500/30" : "bg-bard-800/60 text-bard-400 border-bard-700/40 hover:text-white"
          }`}>
          <Star className="w-4 h-4" /> Favorites
        </button>
      </div>

      {/* Songs grid */}
      {filtered.length === 0 ? (
        <div className="card p-12 text-center">
          <Music className="w-12 h-12 text-bard-600 mx-auto mb-3" />
          <p className="text-bard-400 text-sm">{songs.length === 0 ? "No songs yet. Go to Compose to create your first!" : "No matches found."}</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <AnimatePresence>
            {filtered.map((song) => (
              <motion.div key={song.id} layout initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="card-interactive p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold text-white truncate">{song.title}</h3>
                    <p className="text-xs text-bard-500 truncate mt-0.5">{song.genre} • {song.emotion}</p>
                  </div>
                  <button onClick={() => handleFav(song.id)}
                    className={`p-1.5 rounded-lg transition-colors ${song.favorite ? "text-amber-400" : "text-bard-600 hover:text-amber-400"}`}>
                    <Heart className={`w-4 h-4 ${song.favorite ? "fill-current" : ""}`} />
                  </button>
                </div>

                {song.lyrics && (
                  <p className="text-xs text-bard-400 line-clamp-2 leading-relaxed">{song.lyrics}</p>
                )}

                <div className="flex items-center gap-2 text-[10px] text-bard-600">
                  <span>{new Date(song.created_at).toLocaleDateString()}</span>
                  <span>•</span>
                  <span>{Math.floor(song.duration_sec / 60)}:{(song.duration_sec % 60).toString().padStart(2, "0")}</span>
                </div>

                <div className="flex gap-2">
                  <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                    onClick={() => setCurrentSong(song)}
                    className="flex-1 py-2 rounded-xl text-sm font-semibold bg-gold-500/15 text-gold-400 border border-gold-500/30 hover:bg-gold-500/25 transition-colors flex items-center justify-center gap-1.5">
                    <Play className="w-3.5 h-3.5" /> Play
                  </motion.button>
                  {song.file_path && (
                    <button onClick={() => handleExport(song)}
                      className="px-3 py-2 rounded-xl text-bard-600 hover:text-emerald-400 hover:bg-emerald-500/10 border border-bard-700/30 transition-all"
                      title="Export">
                      <Download className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button onClick={() => handleDelete(song.id)}
                    className="px-3 py-2 rounded-xl text-bard-600 hover:text-red-400 hover:bg-red-500/10 border border-bard-700/30 transition-all">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
