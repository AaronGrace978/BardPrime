import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { BookHeart, Plus, Trash2, Tag, MapPin, Users, Sparkles } from "lucide-react";
import { useStore } from "../store";
import { api } from "../api/client";

export function JournalPanel() {
  const entries = useStore((s) => s.entries);
  const setEntries = useStore((s) => s.setEntries);
  const removeEntry = useStore((s) => s.removeEntry);

  const [showAdd, setShowAdd] = useState(false);
  const [text, setText] = useState("");
  const [tags, setTags] = useState("");
  const [emotion, setEmotion] = useState("joy");
  const [people, setPeople] = useState("");
  const [places, setPlaces] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => { try { const r = await api.journalList(); if (r.entries) setEntries(r.entries); } catch {} })();
  }, []);

  const handleAdd = async () => {
    if (!text.trim()) return;
    setSaving(true);
    try {
      await api.journalAdd(
        text, tags.split(",").map((t) => t.trim()).filter(Boolean),
        emotion, people.split(",").map((t) => t.trim()).filter(Boolean),
        places.split(",").map((t) => t.trim()).filter(Boolean),
      );
      const r = await api.journalList();
      if (r.entries) setEntries(r.entries);
      setText(""); setTags(""); setPeople(""); setPlaces(""); setShowAdd(false);
    } catch {}
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    try { await api.journalDelete(id); removeEntry(id); } catch {}
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-display font-bold text-white flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-pink-400 to-rose-500 flex items-center justify-center shadow-lg shadow-pink-500/20">
              <BookHeart className="w-5 h-5 text-white" />
            </div>
            Life Journal
          </h2>
          <p className="text-bard-400 mt-1 ml-[52px]">Your stories become the Bard's inspiration for songs</p>
        </div>
        <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
          onClick={() => setShowAdd(!showAdd)}
          className="px-4 py-2.5 rounded-xl font-semibold text-sm bg-gradient-to-r from-pink-500 to-rose-500 text-white shadow-lg shadow-pink-500/20 flex items-center gap-2">
          <Plus className="w-4 h-4" /> New Entry
        </motion.button>
      </div>

      {/* Add form */}
      <AnimatePresence>
        {showAdd && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }} className="card p-6 space-y-4">
            <textarea className="textarea h-32" placeholder="What happened today? A memory, a feeling, a moment..."
              value={text} onChange={(e) => setText(e.target.value)} />
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-bard-400 mb-1 flex items-center gap-1"><Tag className="w-3 h-3" /> Tags</label>
                <input className="input text-sm" placeholder="summer, adventure" value={tags} onChange={(e) => setTags(e.target.value)} />
              </div>
              <div>
                <label className="block text-xs text-bard-400 mb-1 flex items-center gap-1"><Sparkles className="w-3 h-3" /> Emotion</label>
                <select className="input text-sm" value={emotion} onChange={(e) => setEmotion(e.target.value)}>
                  {["joy", "love", "melancholy", "nostalgia", "hope", "anger", "serenity", "wonder", "grief", "triumph"].map((e) => (
                    <option key={e} value={e}>{e}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-bard-400 mb-1 flex items-center gap-1"><Users className="w-3 h-3" /> People</label>
                <input className="input text-sm" placeholder="Mom, Alex" value={people} onChange={(e) => setPeople(e.target.value)} />
              </div>
              <div>
                <label className="block text-xs text-bard-400 mb-1 flex items-center gap-1"><MapPin className="w-3 h-3" /> Places</label>
                <input className="input text-sm" placeholder="Paris, Grandma's house" value={places} onChange={(e) => setPlaces(e.target.value)} />
              </div>
            </div>
            <div className="flex gap-3">
              <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                onClick={handleAdd} disabled={!text.trim() || saving}
                className="flex-1 py-3 rounded-xl font-semibold bg-gradient-to-r from-pink-500 to-rose-500 text-white disabled:opacity-50">
                {saving ? "Saving..." : "Save Entry"}
              </motion.button>
              <button onClick={() => setShowAdd(false)} className="px-4 py-3 rounded-xl text-bard-400 hover:text-white bg-bard-800/60 border border-bard-700/40">
                Cancel
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Entries */}
      {entries.length === 0 ? (
        <div className="card p-12 text-center">
          <BookHeart className="w-12 h-12 text-bard-600 mx-auto mb-3" />
          <p className="text-bard-400 text-sm">No journal entries yet. Your life stories help the Bard write personal songs.</p>
        </div>
      ) : (
        <div className="space-y-3">
          <AnimatePresence>
            {entries.map((entry) => (
              <motion.div key={entry.id} layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -20 }} className="card p-5 space-y-3">
                <div className="flex items-start justify-between">
                  <p className="text-sm text-bard-200 leading-relaxed flex-1">{entry.text}</p>
                  <button onClick={() => handleDelete(entry.id)} className="p-1.5 rounded-lg text-bard-600 hover:text-red-400 hover:bg-red-500/10 transition-all ml-3">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {entry.emotion && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-pink-500/15 text-pink-400 border border-pink-500/20">{entry.emotion}</span>
                  )}
                  {entry.tags?.map((t, i) => (
                    <span key={i} className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-bard-700/40 text-bard-400 border border-bard-700/30">#{t}</span>
                  ))}
                  {entry.people?.map((p, i) => (
                    <span key={i} className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-violet-500/10 text-violet-400 border border-violet-500/20">{p}</span>
                  ))}
                  {entry.places?.map((p, i) => (
                    <span key={i} className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">{p}</span>
                  ))}
                </div>
                <p className="text-[10px] text-bard-600">{new Date(entry.timestamp).toLocaleString()}</p>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
