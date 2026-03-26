import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Sparkles, Music, Heart, Mic2, RefreshCw, Volume2, Bot, User } from "lucide-react";
import { useStore } from "../store";
import { api } from "../api/client";
import type { ChatMessage } from "../types";

const QUICK_PROMPTS = [
  { icon: Music, label: "Sing for me", prompt: "Compose and sing me a beautiful, personal song" },
  { icon: Sparkles, label: "Surprise me", prompt: "Surprise me with something unique — a song about something unexpected" },
  { icon: Heart, label: "Something emotional", prompt: "Create something deeply emotional and moving about life" },
  { icon: Mic2, label: "Tell my story", prompt: "Use my journal entries to write a song about my life so far" },
];

export function ChatPanel() {
  const messages = useStore((s) => s.chatMessages);
  const addMessage = useStore((s) => s.addChatMessage);
  const setCurrentEmotion = useStore((s) => s.setCurrentEmotion);
  const setActivePanel = useStore((s) => s.setActivePanel);
  const setComposeTopic = useStore((s) => s.setComposeTopic);

  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const send = async (text?: string) => {
    const msg = text || input;
    if (!msg.trim()) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(), role: "user", content: msg, timestamp: new Date(),
    };
    addMessage(userMsg);
    setInput("");
    setThinking(true);

    try {
      const resp = await api.chat(msg);
      const assistantMsg: ChatMessage = {
        id: (Date.now() + 1).toString(), role: "assistant", content: resp.message,
        emotion: resp.emotion, timestamp: new Date(),
        shouldSing: resp.should_sing, songTopic: resp.song_topic,
      };
      addMessage(assistantMsg);
      if (resp.emotion) {
        setCurrentEmotion({ valence: resp.emotion.valence, arousal: resp.emotion.arousal, dominance: resp.emotion.dominance });
      }
    } catch {
      addMessage({
        id: (Date.now() + 1).toString(), role: "assistant",
        content: "I'm having trouble connecting to my mind right now. Please check that your LLM is configured in Settings — I support DeepSeek, OpenAI, and Ollama.",
        timestamp: new Date(),
      });
    }
    setThinking(false);
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  };

  return (
    <div className="h-full flex flex-col max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-5">
        <h2 className="text-2xl font-display font-bold text-white flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg shadow-violet-500/20">
            <Bot className="w-5 h-5 text-white" />
          </div>
          Talk to Your Bard
        </h2>
        <p className="text-bard-400 mt-1 ml-[52px]">
          Tell me your stories and I'll weave them into song
        </p>
      </div>

      {/* Quick prompts */}
      <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
        {QUICK_PROMPTS.map((item, i) => (
          <motion.button key={i} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
            onClick={() => send(item.prompt)}
            className="flex items-center gap-2 px-4 py-2 rounded-full bg-bard-800/60 border border-bard-700/40 shadow-md hover:border-violet-500/40 hover:bg-bard-700/40 transition-all whitespace-nowrap">
            <item.icon className="w-4 h-4 text-violet-400" />
            <span className="text-sm font-medium text-bard-300">{item.label}</span>
          </motion.button>
        ))}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-4 mb-4 card-chat p-4">
        <AnimatePresence>
          {messages.map((m) => (
            <motion.div key={m.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className={`flex gap-3 ${m.role === "user" ? "flex-row-reverse" : ""}`}>
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
                m.role === "user" ? "bg-bard-700/60 text-gold-400" : "bg-gradient-to-br from-violet-500 to-purple-600 text-white"
              }`}>
                {m.role === "user" ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
              </div>
              <div className={`flex-1 ${m.role === "user" ? "text-right" : ""}`}>
                <div className={`inline-block max-w-[80%] px-4 py-3 rounded-2xl ${
                  m.role === "user"
                    ? "bg-bard-700/60 text-white rounded-tr-md"
                    : "bg-bard-800/80 text-bard-100 rounded-tl-md border border-bard-700/30"
                }`}>
                  <p className="text-sm whitespace-pre-wrap leading-relaxed">{m.content}</p>
                </div>
                {m.role === "assistant" && m.emotion && (
                  <div className="flex items-center gap-2 mt-2 ml-1">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      m.emotion.valence > 0 ? "bg-emerald-500/15 text-emerald-400" :
                      m.emotion.valence < 0 ? "bg-blue-500/15 text-blue-400" :
                      "bg-bard-700/50 text-bard-400"
                    }`}>{m.emotion.primary}</span>
                    {m.shouldSing && (
                      <button onClick={() => {
                        if (m.songTopic) setComposeTopic(m.songTopic);
                        setActivePanel("compose");
                      }}
                        className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-gold-500/15 text-gold-400 text-xs font-medium hover:bg-gold-500/25 transition-colors">
                        <Music className="w-3 h-3" /> Compose this song
                      </button>
                    )}
                  </div>
                )}
                <p className="text-[10px] text-bard-600 mt-1 mx-1">
                  {m.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {thinking && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
              <RefreshCw className="w-4 h-4 text-white animate-spin" />
            </div>
            <div className="flex items-center gap-2 px-4 py-3 bg-bard-800/60 rounded-2xl border border-bard-700/30">
              <div className="flex gap-1">
                <div className="w-2 h-2 bg-violet-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                <div className="w-2 h-2 bg-violet-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                <div className="w-2 h-2 bg-violet-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
              <span className="text-sm text-bard-400">The Bard is thinking...</span>
            </div>
          </motion.div>
        )}
        <div ref={endRef} />
      </div>

      {/* Input */}
      <div className="card p-3">
        <div className="flex items-end gap-3">
          <textarea value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={handleKey}
            placeholder="Tell me your story, ask me to sing, or just chat..."
            rows={1}
            className="flex-1 px-4 py-3 bg-bard-900/80 rounded-xl border border-bard-700/50 text-white placeholder:text-bard-500 focus:border-violet-500/50 focus:ring-2 focus:ring-violet-500/20 resize-none transition-all outline-none"
            style={{ minHeight: "48px", maxHeight: "120px" }} />
          <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
            onClick={() => send()} disabled={!input.trim() || thinking}
            className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all ${
              input.trim() && !thinking
                ? "bg-gradient-to-br from-violet-500 to-purple-600 text-white shadow-lg shadow-violet-500/20"
                : "bg-bard-800 text-bard-600 cursor-not-allowed"
            }`}>
            <Send className="w-5 h-5" />
          </motion.button>
        </div>
        <p className="text-[10px] text-bard-600 mt-2 text-center">
          Powered by DeepSeek / OpenAI / Ollama • ElevenLabs Music
        </p>
      </div>
    </div>
  );
}
