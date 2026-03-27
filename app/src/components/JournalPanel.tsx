import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { open } from "@tauri-apps/plugin-dialog";
import { BookHeart, Link2, Paperclip, Plus, Tag, Trash2, Upload, MapPin, Users, Sparkles } from "lucide-react";
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
  const [importing, setImporting] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [pendingAttachments, setPendingAttachments] = useState<string[]>([]);

  const loadEntries = async () => {
    const r = await api.journalList();
    if (r.entries) setEntries(r.entries);
  };

  useEffect(() => {
    void loadEntries().catch(() => setErrorMessage("Couldn't load your journal entries."));
  }, []);

  const pickFiles = async () => {
    const files = await open({
      multiple: true,
      filters: [{ name: "Documents", extensions: ["txt", "md", "pdf", "json", "jsonl", "log", "csv"] }],
    });
    if (!files) return [];
    return Array.isArray(files) ? files : [files];
  };

  const handlePickAttachments = async () => {
    setErrorMessage("");
    const files = await pickFiles();
    if (files.length > 0) {
      setPendingAttachments((current) => [...current, ...files]);
    }
  };

  const clearMessages = () => {
    setStatusMessage("");
    setErrorMessage("");
  };

  const handleAdd = async () => {
    if (!text.trim()) return;
    setSaving(true);
    clearMessages();
    try {
      const result = await api.journalAdd(
        text, tags.split(",").map((t) => t.trim()).filter(Boolean),
        emotion, people.split(",").map((t) => t.trim()).filter(Boolean),
        places.split(",").map((t) => t.trim()).filter(Boolean),
      );
      for (const filePath of pendingAttachments) {
        await api.journalAttach(result.id, filePath);
      }
      await loadEntries();
      setText(""); setTags(""); setPeople(""); setPlaces(""); setPendingAttachments([]); setShowAdd(false);
      setStatusMessage(`Saved entry${pendingAttachments.length ? " with attachments" : ""}.`);
    } catch {
      setErrorMessage("BardPrime couldn't save that journal entry.");
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    clearMessages();
    try {
      await api.journalDelete(id);
      removeEntry(id);
      setStatusMessage("Entry deleted.");
    } catch {
      setErrorMessage("BardPrime couldn't delete that journal entry.");
    }
  };

  const handleAttachToEntry = async (id: string) => {
    clearMessages();
    try {
      const files = await pickFiles();
      for (const filePath of files) {
        await api.journalAttach(id, filePath);
      }
      if (files.length > 0) {
        await loadEntries();
        setStatusMessage(`Attached ${files.length} document${files.length === 1 ? "" : "s"} to your journal.`);
      }
    } catch {
      setErrorMessage("BardPrime couldn't attach that document.");
    }
  };

  const handleImportDocument = async () => {
    setImporting(true);
    clearMessages();
    try {
      const files = await pickFiles();
      for (const filePath of files) {
        await api.journalImportDocument(filePath, emotion, tags.split(",").map((t) => t.trim()).filter(Boolean));
      }
      if (files.length > 0) {
        await loadEntries();
        setStatusMessage(`Imported ${files.length} document${files.length === 1 ? "" : "s"} into your journal.`);
      }
    } catch {
      setErrorMessage("BardPrime couldn't import that document.");
    }
    setImporting(false);
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
        <div className="flex gap-2">
          <button
            onClick={handleImportDocument}
            disabled={importing}
            className="px-4 py-2.5 rounded-xl font-semibold text-sm bg-bard-800/70 text-bard-200 border border-bard-700/40 flex items-center gap-2 disabled:opacity-50"
          >
            <Upload className="w-4 h-4" /> {importing ? "Importing..." : "Import Document"}
          </button>
          <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
            onClick={() => setShowAdd(!showAdd)}
            className="px-4 py-2.5 rounded-xl font-semibold text-sm bg-gradient-to-r from-pink-500 to-rose-500 text-white shadow-lg shadow-pink-500/20 flex items-center gap-2">
            <Plus className="w-4 h-4" /> New Entry
          </motion.button>
        </div>
      </div>

      {statusMessage && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
          {statusMessage}
        </div>
      )}
      {errorMessage && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {errorMessage}
        </div>
      )}

      {/* Add form */}
      <AnimatePresence>
        {showAdd && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }} className="card p-6 space-y-4">
            <textarea className="textarea h-32" placeholder="What happened today? A memory, a feeling, a moment..."
              value={text} onChange={(e) => setText(e.target.value)} />
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-bard-400 mb-1 flex items-center gap-1"><Tag className="w-3 h-3" /> Tags</label>
                <input className="input text-sm" placeholder="summer, adventure" value={tags} onChange={(e) => setTags(e.target.value)} />
              </div>
              <div>
                <label className="text-xs text-bard-400 mb-1 flex items-center gap-1"><Sparkles className="w-3 h-3" /> Emotion</label>
                <select className="input text-sm" value={emotion} onChange={(e) => setEmotion(e.target.value)}>
                  {["joy", "love", "melancholy", "nostalgia", "hope", "anger", "serenity", "wonder", "grief", "triumph"].map((e) => (
                    <option key={e} value={e}>{e}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-bard-400 mb-1 flex items-center gap-1"><Users className="w-3 h-3" /> People</label>
                <input className="input text-sm" placeholder="Mom, Alex" value={people} onChange={(e) => setPeople(e.target.value)} />
              </div>
              <div>
                <label className="text-xs text-bard-400 mb-1 flex items-center gap-1"><MapPin className="w-3 h-3" /> Places</label>
                <input className="input text-sm" placeholder="Paris, Grandma's house" value={places} onChange={(e) => setPlaces(e.target.value)} />
              </div>
            </div>
            <div className="space-y-3">
              <button
                onClick={handlePickAttachments}
                className="w-full py-2.5 rounded-xl font-semibold text-sm bg-bard-800/60 text-bard-200 border border-bard-700/40 flex items-center justify-center gap-2"
              >
                <Paperclip className="w-4 h-4" /> Attach Documents
              </button>
              {pendingAttachments.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {pendingAttachments.map((filePath) => (
                    <span key={filePath} className="px-2 py-1 rounded-full text-[11px] bg-bard-800/70 text-bard-300 border border-bard-700/40">
                      {filePath.split(/[/\\]/).pop()}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <div className="flex gap-3">
              <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                onClick={handleAdd} disabled={!text.trim() || saving}
                className="flex-1 py-3 rounded-xl font-semibold bg-gradient-to-r from-pink-500 to-rose-500 text-white disabled:opacity-50">
                {saving ? "Saving..." : "Save Entry"}
              </motion.button>
              <button onClick={() => { setShowAdd(false); setPendingAttachments([]); }} className="px-4 py-3 rounded-xl text-bard-400 hover:text-white bg-bard-800/60 border border-bard-700/40">
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
                  <div className="flex items-center gap-1 ml-3">
                    <button onClick={() => handleAttachToEntry(entry.id)} className="p-1.5 rounded-lg text-bard-600 hover:text-bard-200 hover:bg-bard-700/30 transition-all">
                      <Link2 className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleDelete(entry.id)} className="p-1.5 rounded-lg text-bard-600 hover:text-red-400 hover:bg-red-500/10 transition-all">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
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
                  {entry.attachments?.map((attachment) => (
                    <span key={attachment.id} className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-bard-800/70 text-bard-300 border border-bard-700/40 flex items-center gap-1">
                      <Paperclip className="w-3 h-3" /> {attachment.file_name}
                    </span>
                  ))}
                </div>
                {entry.source_name && (
                  <p className="text-[11px] text-bard-500">Imported from {entry.source_name}</p>
                )}
                <p className="text-[10px] text-bard-600">{new Date(entry.timestamp).toLocaleString()}</p>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
