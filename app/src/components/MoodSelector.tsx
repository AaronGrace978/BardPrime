import { motion } from "framer-motion";

const MOODS: { name: string; emoji: string; color: string }[] = [
  { name: "joy", emoji: "☀️", color: "bg-yellow-500/15 text-yellow-300 border-yellow-500/30" },
  { name: "melancholy", emoji: "🌧️", color: "bg-blue-500/15 text-blue-300 border-blue-500/30" },
  { name: "love", emoji: "❤️", color: "bg-pink-500/15 text-pink-300 border-pink-500/30" },
  { name: "nostalgia", emoji: "🍂", color: "bg-amber-500/15 text-amber-300 border-amber-500/30" },
  { name: "hope", emoji: "🌅", color: "bg-orange-500/15 text-orange-300 border-orange-500/30" },
  { name: "anger", emoji: "🔥", color: "bg-red-500/15 text-red-300 border-red-500/30" },
  { name: "serenity", emoji: "🌊", color: "bg-teal-500/15 text-teal-300 border-teal-500/30" },
  { name: "wonder", emoji: "✨", color: "bg-purple-500/15 text-purple-300 border-purple-500/30" },
  { name: "grief", emoji: "🕯️", color: "bg-slate-500/15 text-slate-300 border-slate-500/30" },
  { name: "triumph", emoji: "🏆", color: "bg-gold-500/15 text-gold-300 border-gold-500/30" },
];

interface Props { selected: string; onChange: (v: string) => void; }

export function MoodSelector({ selected, onChange }: Props) {
  return (
    <div className="flex flex-wrap gap-2">
      {MOODS.map((m) => (
        <motion.button key={m.name} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
          onClick={() => onChange(m.name)}
          className={`px-4 py-2 rounded-full text-sm font-semibold border transition-all ${
            selected === m.name ? m.color : "bg-bard-800/40 text-bard-400 border-bard-700/30 hover:bg-bard-700/30"
          }`}>
          <span className="mr-1.5">{m.emoji}</span>{m.name}
        </motion.button>
      ))}
    </div>
  );
}
