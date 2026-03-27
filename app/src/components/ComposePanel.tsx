import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Wand2, Music, Play, RefreshCw, ChevronDown, Mic2, FileAudio, Sparkles, Volume2, XCircle, CheckCircle2 } from "lucide-react";
import { useStore } from "../store";
import { api } from "../api/client";
import { MoodSelector } from "./MoodSelector";

const GENRES = [
  { name: "pop", emoji: "🎤", label: "Pop", color: "from-pink-400 to-rose-500" },
  { name: "folk", emoji: "🪕", label: "Folk", color: "from-green-400 to-lime-500" },
  { name: "rock", emoji: "🎸", label: "Rock", color: "from-red-400 to-orange-500" },
  { name: "r&b", emoji: "💜", label: "R&B", color: "from-indigo-400 to-purple-500" },
  { name: "hip-hop", emoji: "🎤", label: "Hip-Hop", color: "from-purple-400 to-violet-500" },
  { name: "country", emoji: "🤠", label: "Country", color: "from-amber-400 to-yellow-500" },
  { name: "electronic", emoji: "🎹", label: "Electronic", color: "from-cyan-400 to-blue-500" },
  { name: "jazz", emoji: "🎷", label: "Jazz", color: "from-amber-500 to-yellow-600" },
  { name: "ballad", emoji: "💔", label: "Ballad", color: "from-rose-400 to-pink-600" },
  { name: "indie", emoji: "🎵", label: "Indie", color: "from-teal-400 to-emerald-500" },
  { name: "epic", emoji: "⚔️", label: "Epic", color: "from-violet-500 to-purple-700" },
  { name: "lullaby", emoji: "🌙", label: "Lullaby", color: "from-blue-300 to-indigo-400" },
  { name: "classical", emoji: "🎻", label: "Classical", color: "from-slate-400 to-gray-600" },
];

export function ComposePanel() {
  const [topic, setTopic] = useState("");
  const [emotion, setEmotion] = useState("joy");
  const [genre, setGenre] = useState("pop");
  const [showGenres, setShowGenres] = useState(false);
  const [instrumental, setInstrumental] = useState(false);
  const [duration, setDuration] = useState(60);
  const [lyrics, setLyrics] = useState("");
  const [userName, setUserName] = useState("");
  const [extraInstructions, setExtraInstructions] = useState("");
  const [composeError, setComposeError] = useState("");
  const [composeWarnings, setComposeWarnings] = useState<string[]>([]);

  const composing = useStore((s) => s.composing);
  const progress = useStore((s) => s.composeProgress);
  const lastResult = useStore((s) => s.lastResult);
  const setComposing = useStore((s) => s.setComposing);
  const setComposeProgress = useStore((s) => s.setComposeProgress);
  const setLastResult = useStore((s) => s.setLastResult);
  const setCurrentSong = useStore((s) => s.setCurrentSong);
  const composeTopic = useStore((s) => s.composeTopic);
  const setComposeTopic = useStore((s) => s.setComposeTopic);
  const hasElevenlabsKey = useStore((s) => s.hasElevenlabsKey);

  const [jobId, setJobId] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (composing) {
      setElapsed(0);
      timerRef.current = setInterval(() => setElapsed((t) => t + 1), 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = null;
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [composing]);

  useEffect(() => {
    if (composeTopic) {
      setTopic(composeTopic);
      setComposeTopic("");
    }
  }, [composeTopic]);

  const selectedGenre = GENRES.find((g) => g.name === genre) ?? GENRES[0];

  const handleCompose = async () => {
    if (!topic.trim() || composing) return;
    setComposeError("");
    setComposeWarnings([]);
    setLastResult(null);
    try {
      const req = {
        topic, emotion, genre, user_name: userName || undefined,
        extra_instructions: extraInstructions || undefined,
        instrumental, duration_sec: duration,
        custom_lyrics: lyrics || undefined,
      };
      const preflight = await api.composePreflight(req);
      if (!preflight.success) {
        setComposeError(preflight.errors.join(" "));
        return;
      }
      setComposeWarnings(preflight.warnings || []);
      setComposing(true);
      const id = await api.startCompose({
        ...req,
      });
      setJobId(id);
    } catch {
      setComposeError("BardPrime couldn't start the composition job.");
      setComposing(false);
    }
  };

  const handleCancel = async () => {
    if (jobId) {
      try { await api.cancelCompose(jobId); } catch {}
    }
    setComposing(false);
    setComposeProgress("");
    setJobId(null);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-display font-bold text-white flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-gold-500 to-gold-400 flex items-center justify-center shadow-lg shadow-gold-500/20">
            <Wand2 className="w-5 h-5 text-bard-950" />
          </div>
          Compose a Song
        </h2>
        <p className="text-bard-400 mt-1 ml-[52px]">Describe your story and the Bard will craft a personalized song</p>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Main input */}
        <div className="col-span-2 space-y-4">
          <div className="card p-6 space-y-5">
            {composeError && (
              <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                {composeError}
              </div>
            )}
            {composeWarnings.length > 0 && (
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
                {composeWarnings.join(" ")}
              </div>
            )}
            <label>
              <span className="text-sm font-semibold text-bard-200 mb-2 flex items-center gap-2">
                <Music className="w-4 h-4 text-gold-400" /> What should I sing about?
              </span>
              <textarea value={topic} onChange={(e) => setTopic(e.target.value)}
                placeholder="A memory of summer nights with your best friend, the feeling of finally reaching a goal, a love letter to your city..."
                className="textarea mt-2 h-32" />
            </label>

            {/* Lyrics */}
            {!instrumental && (
              <label>
                <span className="text-sm font-semibold text-bard-200 mb-2 flex items-center gap-2">
                  <Mic2 className="w-4 h-4 text-amber-400" /> Custom Lyrics
                  <span className="text-xs font-normal text-bard-500">(optional — leave empty to auto-generate)</span>
                </span>
                <textarea value={lyrics} onChange={(e) => setLyrics(e.target.value)}
                  placeholder={"[Verse 1]\nYour lyrics here...\n\n[Chorus]\n..."}
                  className="textarea mt-2 h-28 font-mono text-sm" />
              </label>
            )}

            {/* Genre selector */}
            <div className="relative">
              <span className="text-sm font-semibold text-bard-200 mb-2 block">Genre</span>
              <button onClick={() => setShowGenres(!showGenres)}
                className="w-full flex items-center justify-between px-4 py-3 bg-bard-900/80 rounded-xl border border-bard-700/50 hover:border-bard-600/60 transition-all">
                <div className="flex items-center gap-3">
                  <span className={`w-10 h-10 rounded-xl bg-gradient-to-br ${selectedGenre.color} flex items-center justify-center text-xl shadow-sm`}>
                    {selectedGenre.emoji}
                  </span>
                  <span className="font-semibold text-white">{selectedGenre.label}</span>
                </div>
                <ChevronDown className={`w-5 h-5 text-bard-400 transition-transform ${showGenres ? "rotate-180" : ""}`} />
              </button>
              <AnimatePresence>
                {showGenres && (
                  <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                    className="absolute z-50 w-full mt-2 py-2 bg-bard-800 rounded-2xl border border-bard-700/50 shadow-2xl max-h-72 overflow-auto">
                    {GENRES.map((g) => (
                      <button key={g.name} onClick={() => { setGenre(g.name); setShowGenres(false); }}
                        className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-bard-700/50 transition-colors ${genre === g.name ? "bg-bard-700/40" : ""}`}>
                        <span className={`w-8 h-8 rounded-lg bg-gradient-to-br ${g.color} flex items-center justify-center text-lg shadow-sm`}>{g.emoji}</span>
                        <span className="font-semibold text-white">{g.label}</span>
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Mood */}
            <div>
              <span className="text-sm font-semibold text-bard-200 mb-3 block">Mood</span>
              <MoodSelector selected={emotion} onChange={setEmotion} />
            </div>
          </div>

          {/* Result */}
          <AnimatePresence>
            {lastResult && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }} className="card p-6 space-y-4">
                {lastResult.success && (
                <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                  className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  </div>
                  <div>
                    <span className="text-sm font-semibold text-emerald-300">Song completed!</span>
                    <p className="text-xs text-emerald-400/70">Your song is ready to play</p>
                  </div>
                </motion.div>
              )}
              <h3 className="font-semibold text-white flex items-center gap-2">
                  <FileAudio className="w-5 h-5 text-emerald-400" />
                  {lastResult.title || "Generated Track"}
                </h3>
                {!lastResult.success && lastResult.error && (
                  <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-300 text-sm">{lastResult.error}</div>
                )}
                {lastResult.lyrics && (
                  <div className="p-4 bg-bard-900/50 rounded-xl border border-bard-700/30">
                    <span className="text-[10px] text-bard-500 uppercase tracking-wider font-semibold">Lyrics</span>
                    <pre className="text-sm text-bard-200 mt-2 whitespace-pre-wrap font-body leading-relaxed max-h-40 overflow-y-auto">{lastResult.lyrics}</pre>
                  </div>
                )}
                <div className="flex items-center gap-2 text-[11px] text-bard-500">
                  <span className={`px-2 py-1 rounded-full border ${
                    lastResult.render_status === "ready"
                      ? "text-emerald-300 border-emerald-500/30 bg-emerald-500/10"
                      : "text-amber-300 border-amber-500/30 bg-amber-500/10"
                  }`}>
                    {lastResult.render_status || (lastResult.success ? "ready" : "failed")}
                  </span>
                  {lastResult.actual_duration_sec > 0 && (
                    <span>{Math.floor(lastResult.actual_duration_sec / 60)}:{Math.round(lastResult.actual_duration_sec % 60).toString().padStart(2, "0")} actual</span>
                  )}
                </div>
                {lastResult.success && lastResult.file_path && (
                  <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                    onClick={() => setCurrentSong({
                      id: lastResult.song_id, title: lastResult.title, lyrics: lastResult.lyrics,
                      music_prompt: lastResult.music_prompt, topic, emotion: lastResult.emotion,
                      genre: lastResult.genre, mood_tags: lastResult.mood_tags,
                      duration_sec: lastResult.duration_sec, file_path: lastResult.file_path,
                      engine: lastResult.engine, created_at: new Date().toISOString(), favorite: false, notes: "",
                      render_status: lastResult.render_status, render_error: lastResult.render_error,
                      actual_duration_sec: lastResult.actual_duration_sec, waveform_peaks: [], file_missing: false,
                    })}
                    className="w-full py-3 rounded-xl font-semibold flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-white shadow-lg shadow-emerald-500/20">
                    <Play className="w-5 h-5" /> Play Song
                  </motion.button>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Right sidebar — settings */}
        <div className="space-y-4">
          <div className="card p-5 space-y-4">
            <h3 className="font-semibold text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-gold-400" /> Song Settings
            </h3>

            {!instrumental && !hasElevenlabsKey && (
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
                Singing requires an `ElevenLabs` key in Settings. Without it, BardPrime can still write lyrics, but it will not render a full vocal track.
              </div>
            )}

            <div>
              <label className="block text-sm text-bard-400 mb-1">Your Name</label>
              <input className="input text-sm" placeholder="For personalization" value={userName} onChange={(e) => setUserName(e.target.value)} />
            </div>

            <div>
              <label className="block text-sm text-bard-400 mb-1">Extra Instructions</label>
              <input className="input text-sm" placeholder="e.g. 'Include a guitar solo'" value={extraInstructions} onChange={(e) => setExtraInstructions(e.target.value)} />
            </div>

            <label className={`flex items-center justify-between p-4 rounded-xl cursor-pointer transition-colors border ${
              instrumental ? "bg-bard-700/40 border-bard-600/50" : "bg-bard-800/40 border-bard-700/30 hover:bg-bard-700/30"
            }`}>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-bard-700/60 flex items-center justify-center">
                  <Music className="w-4 h-4 text-bard-300" />
                </div>
                <div>
                  <span className="text-sm font-semibold text-white">Instrumental Only</span>
                  <p className="text-xs text-bard-500">No vocals</p>
                </div>
              </div>
              <input type="checkbox" checked={instrumental} onChange={(e) => setInstrumental(e.target.checked)} />
            </label>
          </div>

          {/* Duration */}
          <div className="card p-5 space-y-4">
            <h3 className="font-semibold text-white flex items-center gap-2">
              <Volume2 className="w-4 h-4 text-cyan-400" /> Duration
            </h3>
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="font-semibold text-white">{duration}s</span>
                <span className="text-bard-400">{Math.floor(duration / 60)}:{(duration % 60).toString().padStart(2, "0")}</span>
              </div>
              <input type="range" min={15} max={180} step={15} value={duration} onChange={(e) => setDuration(+e.target.value)} />
              <div className="flex justify-between text-[10px] text-bard-600 font-medium"><span>15s</span><span>3 min</span></div>
            </div>
          </div>

          {/* Compose / Cancel buttons */}
          {composing ? (
            <div className="space-y-2">
              <div className="w-full py-4 rounded-2xl font-bold flex flex-col items-center justify-center gap-1 bg-bard-700/40 text-bard-400">
                <div className="flex items-center gap-2 text-lg">
                  <RefreshCw className="w-5 h-5 animate-spin" />{progress || "Composing..."}
                </div>
                <span className="text-xs font-normal text-bard-500">
                  {Math.floor(elapsed / 60)}:{(elapsed % 60).toString().padStart(2, "0")} elapsed
                </span>
              </div>
              <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                onClick={handleCancel}
                className="w-full py-3 rounded-xl font-semibold flex items-center justify-center gap-2 text-sm bg-red-500/15 text-red-400 border border-red-500/30 hover:bg-red-500/25 transition-all">
                <XCircle className="w-4 h-4" /> Cancel Composition
              </motion.button>
            </div>
          ) : (
            <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
              onClick={handleCompose} disabled={!topic.trim()}
              className={`w-full py-4 rounded-2xl font-bold flex items-center justify-center gap-2 text-lg transition-all ${
                !topic.trim()
                  ? "bg-bard-700/40 cursor-not-allowed text-bard-600"
                  : "bg-gradient-to-r from-gold-500 to-gold-400 text-bard-950 shadow-lg shadow-gold-500/20 hover:shadow-xl"
              }`}>
              <Wand2 className="w-5 h-5" />Compose My Song
            </motion.button>
          )}
        </div>
      </div>
    </div>
  );
}
