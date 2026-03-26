import { motion } from "framer-motion";
import { MessageCircle, Feather, Library, BookHeart } from "lucide-react";
import { useStore } from "../store";
import type { Panel } from "../types";

const TABS: { id: Panel; icon: typeof Feather; label: string; color: string }[] = [
  { id: "chat", icon: MessageCircle, label: "Chat", color: "from-violet-400 to-purple-600" },
  { id: "compose", icon: Feather, label: "Compose", color: "from-gold-500 to-gold-400" },
  { id: "library", icon: Library, label: "Library", color: "from-amber-400 to-orange-500" },
  { id: "journal", icon: BookHeart, label: "Journal", color: "from-pink-400 to-rose-500" },
];

export function Sidebar() {
  const active = useStore((s) => s.activePanel);
  const setActive = useStore((s) => s.setActivePanel);
  const songs = useStore((s) => s.songs);

  return (
    <aside className="w-20 bg-bard-900/80 border-r border-bard-700/30 backdrop-blur-md flex flex-col items-center py-4 gap-1">
      {TABS.map((tab) => {
        const Icon = tab.icon;
        const isActive = active === tab.id;

        return (
          <button key={tab.id} onClick={() => setActive(tab.id)}
            className={`relative w-16 h-16 rounded-2xl flex flex-col items-center justify-center gap-1 transition-all duration-300 ${
              isActive ? "text-white" : "text-bard-500 hover:bg-bard-800/60 hover:text-bard-300"
            }`}>
            {isActive && (
              <motion.div layoutId="sidebar-active"
                className="absolute inset-1 rounded-xl bg-bard-800/80 border border-bard-600/50 shadow-lg"
                transition={{ type: "spring", bounce: 0.2, duration: 0.6 }} />
            )}
            {isActive && (
              <motion.div layoutId="sidebar-accent"
                className={`absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 rounded-r-full bg-gradient-to-b ${tab.color}`}
                transition={{ type: "spring", bounce: 0.2, duration: 0.6 }} />
            )}
            <Icon className={`w-5 h-5 relative z-10 transition-colors ${isActive ? "text-gold-400" : ""}`} />
            <span className={`text-[10px] font-semibold relative z-10 ${isActive ? "text-bard-200" : ""}`}>
              {tab.label}
            </span>
            {tab.id === "library" && songs.length > 0 && (
              <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-gold-500 text-bard-950 text-[9px] font-bold flex items-center justify-center z-20">
                {songs.length}
              </span>
            )}
          </button>
        );
      })}

      <div className="flex-1" />

      {/* Bard pulse */}
      <div className="relative group">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-bard-700/60 to-bard-800/60 border border-bard-600/30 flex items-center justify-center">
          <div className="w-6 h-6 rounded-full bg-gradient-to-br from-gold-500 to-bard-500 animate-pulse shadow-lg shadow-gold-500/20" />
        </div>
        <div className="absolute left-full ml-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity">
          <div className="bg-bard-950 text-white text-xs px-3 py-1.5 rounded-lg whitespace-nowrap font-medium border border-bard-700/50">
            Bard Active
          </div>
        </div>
      </div>
    </aside>
  );
}
