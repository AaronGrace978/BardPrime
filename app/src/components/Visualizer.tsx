import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { Activity, Volume2 } from "lucide-react";
import { useStore } from "../store";

export function Visualizer() {
  const waveform = useStore((s) => s.waveform);
  const playing = useStore((s) => s.playing);
  const emotion = useStore((s) => s.currentEmotion);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const getColors = () => {
    const hue = ((emotion.valence + 1) / 2) * 120;
    const sat = 50 + emotion.arousal * 30;
    const lit = 55 - emotion.dominance * 10;
    return {
      primary: `hsl(${hue}, ${sat}%, ${lit}%)`,
      secondary: `hsl(${hue + 30}, ${sat - 10}%, ${lit + 10}%)`,
      faded: `hsla(${hue + 30}, ${sat - 10}%, ${lit + 10}%, 0.4)`,
      glow: `hsla(${hue}, ${sat}%, ${lit}%, 0.25)`,
    };
  };

  const getLabel = () => {
    if (emotion.valence > 0.3 && emotion.arousal > 0.5) return "Energetic Joy";
    if (emotion.valence > 0.3) return "Peaceful";
    if (emotion.valence < -0.3 && emotion.arousal > 0.5) return "Intense";
    if (emotion.valence < -0.3) return "Melancholic";
    if (emotion.arousal > 0.7) return "Excited";
    if (emotion.arousal < 0.3) return "Calm";
    return "Neutral";
  };

  useEffect(() => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = canvas.offsetWidth * dpr;
    canvas.height = canvas.offsetHeight * dpr;
    ctx.scale(dpr, dpr);

    let raf: number;
    const colors = getColors();

    const draw = () => {
      const w = canvas.offsetWidth;
      const h = canvas.offsetHeight;

      // Dark background with subtle gradient
      const bg = ctx.createLinearGradient(0, 0, w, 0);
      bg.addColorStop(0, "rgba(17, 14, 29, 0.95)");
      bg.addColorStop(0.5, "rgba(10, 8, 18, 0.98)");
      bg.addColorStop(1, "rgba(17, 14, 29, 0.95)");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);

      // Subtle grid
      ctx.strokeStyle = "rgba(255, 255, 255, 0.015)";
      ctx.lineWidth = 1;
      for (let x = 40; x < w; x += 40) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
      }

      // Center line
      ctx.strokeStyle = "rgba(255, 255, 255, 0.04)";
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(0, h / 2); ctx.lineTo(w, h / 2); ctx.stroke();

      // Bars
      const barCount = 80;
      const barW = (w / barCount) - 2;
      const maxH = h * 0.75;

      for (let i = 0; i < barCount; i++) {
        let barH: number;
        if (waveform.length > 0 && playing) {
          const idx = Math.floor((i / barCount) * waveform.length);
          barH = Math.abs(waveform[idx] || 0) * maxH;
        } else {
          const t = Date.now() / 1000;
          const w1 = Math.sin(t * 1.5 + i * 0.15) * 0.3;
          const w2 = Math.sin(t * 2.3 + i * 0.1) * 0.2;
          const w3 = Math.sin(t * 0.8 + i * 0.25) * 0.1;
          barH = 8 + (w1 + w2 + w3) * 20;
        }

        const x = i * (barW + 2) + 1;
        const y = h / 2 - barH / 2;

        const grad = ctx.createLinearGradient(x, y + barH, x, y);
        grad.addColorStop(0, colors.faded);
        grad.addColorStop(0.5, colors.primary);
        grad.addColorStop(1, colors.faded);
        ctx.fillStyle = grad;

        const r = Math.min(2, barW / 2);
        ctx.beginPath();
        ctx.roundRect(x, y, barW, barH, r);
        ctx.fill();

        if (playing && barH > maxH * 0.3) {
          ctx.shadowColor = colors.glow;
          ctx.shadowBlur = 8;
          ctx.fill();
          ctx.shadowBlur = 0;
        }
      }

      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, [waveform, playing, emotion]);

  const colors = getColors();

  return (
    <div className="h-full flex flex-col">
      <div className="h-9 flex items-center justify-between px-5 border-b border-bard-700/30 bg-bard-900/40">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Activity className="w-3.5 h-3.5 text-bard-500" />
            <span className="text-[10px] font-semibold text-bard-500 uppercase tracking-wider">Waveform</span>
          </div>
          {playing && (
            <motion.div className="flex items-center gap-1.5"
              initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}>
              <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <Volume2 className="w-3 h-3 text-emerald-400" />
                <span className="text-[10px] font-semibold text-emerald-400">Playing</span>
              </div>
            </motion.div>
          )}
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full shadow-sm" style={{ backgroundColor: colors.primary }} />
            <span className="text-xs font-semibold text-bard-400">{getLabel()}</span>
          </div>
          <div className="flex items-center gap-2 text-[10px] text-bard-500 font-mono font-semibold">
            <span className="px-1.5 py-0.5 bg-bard-800/80 rounded border border-bard-700/50">V:{emotion.valence.toFixed(2)}</span>
            <span className="px-1.5 py-0.5 bg-bard-800/80 rounded border border-bard-700/50">A:{emotion.arousal.toFixed(2)}</span>
            <span className="px-1.5 py-0.5 bg-bard-800/80 rounded border border-bard-700/50">D:{emotion.dominance.toFixed(2)}</span>
          </div>
        </div>
      </div>
      <canvas ref={canvasRef} className="flex-1 w-full" />
    </div>
  );
}
