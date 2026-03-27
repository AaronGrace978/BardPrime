import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { convertFileSrc } from "@tauri-apps/api/core";
import { AlertCircle, Download, Music, Pause, Play, SkipBack, SkipForward, Square, StepBack, StepForward, X } from "lucide-react";
import { save } from "@tauri-apps/plugin-dialog";
import { useStore } from "../store";
import { api } from "../api/client";

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds <= 0) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

async function computeWaveformPeaks(filePath: string, bars = 80) {
  const response = await fetch(convertFileSrc(filePath));
  const buffer = await response.arrayBuffer();
  const audioContext = new AudioContext();
  try {
    const decoded = await audioContext.decodeAudioData(buffer.slice(0));
    const channel = decoded.getChannelData(0);
    const blockSize = Math.max(1, Math.floor(channel.length / bars));
    const peaks: number[] = [];
    let maxPeak = 0;

    for (let i = 0; i < bars; i++) {
      const start = i * blockSize;
      const end = Math.min(start + blockSize, channel.length);
      let peak = 0;
      for (let j = start; j < end; j++) {
        peak = Math.max(peak, Math.abs(channel[j] || 0));
      }
      peaks.push(peak);
      maxPeak = Math.max(maxPeak, peak);
    }

    if (maxPeak > 0) {
      return peaks.map((peak) => peak / maxPeak);
    }
    return peaks;
  } finally {
    await audioContext.close();
  }
}

export function SongPlayer() {
  const song = useStore((s) => s.currentSong);
  const playbackQueue = useStore((s) => s.playbackQueue);
  const playbackIndex = useStore((s) => s.playbackIndex);
  const playing = useStore((s) => s.playing);
  const paused = useStore((s) => s.paused);
  const setPlaying = useStore((s) => s.setPlaying);
  const setPaused = useStore((s) => s.setPaused);
  const setCurrentSong = useStore((s) => s.setCurrentSong);
  const playNext = useStore((s) => s.playNext);
  const playPrevious = useStore((s) => s.playPrevious);
  const setWaveform = useStore((s) => s.setWaveform);
  const [showLyrics, setShowLyrics] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [loadError, setLoadError] = useState("");
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const canPlayPrevious = playbackIndex > 0;
  const canPlayNext = playbackIndex >= 0 && playbackIndex < playbackQueue.length - 1;
  const effectiveDuration = duration || song?.actual_duration_sec || song?.duration_sec || 0;
  const peaks = useMemo(() => {
    if (!song) return [];
    if (song.waveform_peaks?.length) return song.waveform_peaks;
    return [];
  }, [song]);

  useEffect(() => {
    if (!song) return;
    setShowLyrics(false);
    setCurrentTime(0);
    setDuration(song.actual_duration_sec || song.duration_sec || 0);
    setLoadError("");
    setWaveform(song.waveform_peaks || []);

    if (!song.file_path || song.file_missing) {
      audioRef.current = null;
      setPlaying(false);
      setPaused(false);
      setLoadError(song.file_missing ? "This song's audio file is missing from disk." : "This song was saved without rendered audio.");
      void api.libraryUpdateMetadata(song.id, undefined, song.waveform_peaks, true).catch(() => {});
      return;
    }

    const audio = new Audio(convertFileSrc(song.file_path));
    let cancelled = false;
    audio.preload = "metadata";
    audioRef.current = audio;

    if (song.waveform_peaks?.length) {
      setWaveform(song.waveform_peaks);
    } else {
      void computeWaveformPeaks(song.file_path).then((nextPeaks) => {
        if (cancelled || nextPeaks.length === 0) return;
        setWaveform(nextPeaks);
        void api.libraryUpdateMetadata(song.id, undefined, nextPeaks, false).catch(() => {});
      }).catch(() => {});
    }

    const syncDuration = () => {
      if (Number.isFinite(audio.duration) && audio.duration > 0) {
        setDuration(audio.duration);
        if (Math.abs((song.actual_duration_sec || song.duration_sec || 0) - audio.duration) > 0.5) {
          void api.libraryUpdateMetadata(song.id, audio.duration, song.waveform_peaks, false).catch(() => {});
        }
      }
    };
    const syncTime = () => setCurrentTime(audio.currentTime);
    const onPlay = () => {
      setPlaying(true);
      setPaused(false);
      setLoadError("");
    };
    const onPause = () => {
      const ended = audio.ended || (audio.duration > 0 && audio.currentTime >= audio.duration);
      setPlaying(false);
      setPaused(!ended && audio.currentTime > 0);
    };
    const onEnded = () => {
      setCurrentTime(audio.duration || effectiveDuration || 0);
      if (canPlayNext) {
        playNext();
      } else {
        setPlaying(false);
        setPaused(false);
      }
    };
    const onError = () => {
      setLoadError("BardPrime couldn't load this audio file.");
      setPlaying(false);
      setPaused(false);
      void api.libraryUpdateMetadata(song.id, undefined, song.waveform_peaks, true).catch(() => {});
    };

    audio.addEventListener("loadedmetadata", syncDuration);
    audio.addEventListener("durationchange", syncDuration);
    audio.addEventListener("timeupdate", syncTime);
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("error", onError);

    audio.load();
    void audio.play().catch(() => {
      setPlaying(false);
      setPaused(false);
    });

    return () => {
      cancelled = true;
      audio.pause();
      audio.currentTime = 0;
      audio.removeEventListener("loadedmetadata", syncDuration);
      audio.removeEventListener("durationchange", syncDuration);
      audio.removeEventListener("timeupdate", syncTime);
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("error", onError);
      if (audioRef.current === audio) {
        audioRef.current = null;
      }
    };
  }, [song, setPaused, setPlaying, setWaveform, playNext, canPlayNext, effectiveDuration]);

  useEffect(() => {
    if (!song) return;
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return;

      if (event.code === "Space") {
        event.preventDefault();
        void (playing ? handlePause() : handlePlay());
      } else if (event.code === "ArrowLeft") {
        event.preventDefault();
        if (event.shiftKey) handleQueuePrevious();
        else handleSkip(-10);
      } else if (event.code === "ArrowRight") {
        event.preventDefault();
        if (event.shiftKey) handleQueueNext();
        else handleSkip(10);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [song, playing, canPlayNext, canPlayPrevious]);

  if (!song) return null;

  const handlePlay = async () => {
    if (!audioRef.current) return;
    try {
      await audioRef.current.play();
    } catch {
      setLoadError("Playback was blocked. Try pressing play again.");
    }
  };

  const handlePause = async () => {
    audioRef.current?.pause();
  };

  const handleStop = async () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    setCurrentTime(0);
    setPlaying(false);
    setPaused(false);
  };

  const handleClose = async () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    setCurrentSong(null);
    setWaveform([]);
    setPlaying(false);
    setPaused(false);
  };

  const handleSeek = (value: number) => {
    setCurrentTime(value);
    if (audioRef.current) {
      audioRef.current.currentTime = value;
    }
  };

  const handleSkip = (delta: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    const max = effectiveDuration;
    const next = Math.min(Math.max(audio.currentTime + delta, 0), max);
    audio.currentTime = next;
    setCurrentTime(next);
  };

  const handleQueuePrevious = () => {
    if (audioRef.current && audioRef.current.currentTime > 3) {
      handleSeek(0);
      return;
    }
    if (!canPlayPrevious) return;
    playPrevious();
  };

  const handleQueueNext = () => {
    if (!canPlayNext) return;
    playNext();
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
    <motion.div initial={{ y: 96 }} animate={{ y: 0 }}
      className="fixed bottom-0 inset-x-0 bg-bard-900/95 border-t border-bard-700/40 backdrop-blur-xl px-6 py-3 z-40">

      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-gold-500/20 to-bard-600/30 border border-bard-700/40 flex items-center justify-center flex-shrink-0">
          <Music className="w-5 h-5 text-gold-400" />
        </div>

        <div className="min-w-0 w-56">
          <p className="text-sm font-semibold text-white truncate">{song.title}</p>
          <p className="text-[10px] text-bard-500 truncate">{song.genre} • {song.emotion}</p>
        </div>

        <div className="flex-1 min-w-0 space-y-2">
          {peaks.length > 0 && (
            <div className="flex items-end gap-[2px] h-10 cursor-pointer">
              {peaks.map((peak, index) => {
                const peakTime = peaks.length > 1 ? (index / (peaks.length - 1)) * Math.max(effectiveDuration, 1) : 0;
                const active = peakTime <= currentTime;
                return (
                  <button
                    key={`${song.id}-${index}`}
                    onClick={() => handleSeek(peakTime)}
                    className={`flex-1 rounded-sm transition-colors ${active ? "bg-gold-400/80" : "bg-bard-600/60 hover:bg-bard-500/80"}`}
                    style={{ height: `${Math.max(12, peak * 100)}%` }}
                    title={formatTime(peakTime)}
                  />
                );
              })}
            </div>
          )}

          <div className="flex items-center gap-3">
            <span className="text-[11px] text-bard-500 tabular-nums w-10 text-right">{formatTime(currentTime)}</span>
            <input
              type="range"
              min={0}
              max={Math.max(effectiveDuration, 1)}
              step={0.1}
              value={Math.min(currentTime, Math.max(effectiveDuration, 1))}
              onChange={(e) => handleSeek(Number(e.target.value))}
              disabled={!song.file_path || song.file_missing}
              className="flex-1 accent-gold-500 disabled:opacity-40"
            />
            <span className="text-[11px] text-bard-500 tabular-nums w-10">{formatTime(effectiveDuration)}</span>
          </div>

          {loadError ? (
            <div className="flex items-center gap-1.5 text-[11px] text-amber-400">
              <AlertCircle className="w-3.5 h-3.5" />
              {loadError}
            </div>
          ) : (
            <div className="text-[11px] text-bard-500">
              Space toggles play. Arrow keys skip 10 seconds. Shift plus arrows jumps tracks.
            </div>
          )}
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={handleQueuePrevious}
            disabled={!canPlayPrevious && currentTime <= 3}
            className="p-2 rounded-lg text-bard-400 hover:text-bard-200 hover:bg-bard-800 transition-all disabled:opacity-40"
            title="Previous track"
          >
            <StepBack className="w-4 h-4" />
          </button>

          <button
            onClick={() => handleSkip(-10)}
            disabled={!song.file_path || song.file_missing}
            className="p-2 rounded-lg text-bard-400 hover:text-bard-200 hover:bg-bard-800 transition-all disabled:opacity-40"
            title="Back 10 seconds"
          >
            <SkipBack className="w-4 h-4" />
          </button>

          {(playing || paused) && (
            <button onClick={handleStop}
              className="p-2 rounded-lg text-bard-400 hover:text-red-400 hover:bg-red-500/10 transition-all"
              title="Stop">
              <Square className="w-4 h-4" />
            </button>
          )}

          <motion.button whileHover={{ scale: song.file_path && !song.file_missing ? 1.08 : 1 }} whileTap={{ scale: song.file_path && !song.file_missing ? 0.92 : 1 }}
            onClick={playing ? handlePause : handlePlay}
            disabled={!song.file_path || song.file_missing}
            className={`w-11 h-11 rounded-full flex items-center justify-center text-bard-950 disabled:opacity-40 ${
              playing ? "bg-amber-500" : paused ? "bg-emerald-500" : "bg-gold-500"
            }`}>
            {playing ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
          </motion.button>

          <button
            onClick={() => handleSkip(10)}
            disabled={!song.file_path || song.file_missing}
            className="p-2 rounded-lg text-bard-400 hover:text-bard-200 hover:bg-bard-800 transition-all disabled:opacity-40"
            title="Forward 10 seconds"
          >
            <SkipForward className="w-4 h-4" />
          </button>

          <button
            onClick={handleQueueNext}
            disabled={!canPlayNext}
            className="p-2 rounded-lg text-bard-400 hover:text-bard-200 hover:bg-bard-800 transition-all disabled:opacity-40"
            title="Next track"
          >
            <StepForward className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center gap-1.5">
          {song.lyrics && (
            <button onClick={() => setShowLyrics(!showLyrics)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${showLyrics ? "bg-gold-500/15 text-gold-400 border border-gold-500/30" : "text-bard-400 hover:text-bard-200"}`}>
              Lyrics
            </button>
          )}

          {song.file_path && !song.file_missing && (
            <button onClick={handleExport}
              className="p-2 rounded-lg text-bard-400 hover:text-emerald-400 hover:bg-emerald-500/10 transition-all"
              title="Export song">
              <Download className="w-4 h-4" />
            </button>
          )}

          <button onClick={handleClose} className="p-1.5 hover:bg-bard-800 rounded-lg transition-colors">
            <X className="w-4 h-4 text-bard-500" />
          </button>
        </div>
      </div>

      {showLyrics && song.lyrics && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          className="absolute bottom-full left-0 right-0 mb-2 mx-6 max-h-64 overflow-y-auto p-5 bg-bard-900/95 rounded-2xl border border-bard-700/40 backdrop-blur-xl shadow-2xl">
          <pre className="text-sm text-bard-200 whitespace-pre-wrap font-body leading-relaxed">{song.lyrics}</pre>
        </motion.div>
      )}
    </motion.div>
  );
}
