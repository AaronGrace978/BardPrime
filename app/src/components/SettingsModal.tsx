import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Brain, Music, CheckCircle, AlertCircle, Server, Globe, Cpu, Zap, Cloud, ChevronDown } from "lucide-react";
import { useStore } from "../store";
import { api } from "../api/client";

type LLMProvider = "anthropic" | "openai" | "ollama" | "ollama_cloud";

const PROVIDERS: { id: LLMProvider; label: string; icon: typeof Brain; desc: string; color: string }[] = [
  { id: "anthropic", label: "Anthropic", icon: Brain, desc: "Claude Sonnet 4.6 / Opus", color: "from-orange-500 to-amber-600" },
  { id: "openai", label: "OpenAI", icon: Globe, desc: "GPT-5.4 / GPT-4.1", color: "from-emerald-500 to-green-500" },
  { id: "ollama", label: "Ollama", icon: Server, desc: "Local, free, private", color: "from-purple-500 to-violet-500" },
  { id: "ollama_cloud", label: "Ollama Cloud", icon: Cloud, desc: "Qwen, Devstral, GLM...", color: "from-sky-500 to-blue-500" },
];

const MODEL_OPTIONS: Record<string, { id: string; label: string }[]> = {
  anthropic: [
    { id: "claude-sonnet-4-6-20260217", label: "Claude Sonnet 4.6 (latest)" },
    { id: "claude-opus-4-6-20260217", label: "Claude Opus 4.6" },
    { id: "claude-sonnet-4-5-20250918", label: "Claude Sonnet 4.5" },
    { id: "claude-haiku-4-5-20250918", label: "Claude Haiku 4.5 (fast)" },
  ],
  openai: [
    { id: "gpt-5.4", label: "GPT-5.4 (latest)" },
    { id: "gpt-5.4-mini", label: "GPT-5.4 Mini" },
    { id: "gpt-5", label: "GPT-5" },
    { id: "gpt-4.1", label: "GPT-4.1" },
    { id: "gpt-4.1-mini", label: "GPT-4.1 Mini" },
    { id: "gpt-4.1-nano", label: "GPT-4.1 Nano (cheapest)" },
  ],
  ollama_cloud: [
    { id: "qwen3.5:122b", label: "Qwen 3.5 122B" },
    { id: "minimax-m2.7", label: "MiniMax M2.7" },
    { id: "qwen3-coder-next", label: "Qwen3 Coder Next" },
    { id: "nemotron-3-super:120b", label: "Nemotron 3 Super 120B" },
    { id: "kimi-k2.5", label: "Kimi K2.5" },
    { id: "glm-5", label: "GLM-5 744B" },
    { id: "devstral-small-2:24b", label: "Devstral Small 2 24B" },
    { id: "qwen3-next:80b", label: "Qwen3 Next 80B" },
    { id: "gemini-3-flash-preview", label: "Gemini 3 Flash Preview" },
    { id: "deepseek-v3.2", label: "DeepSeek V3.2" },
    { id: "devstral-2:123b", label: "Devstral 2 123B" },
    { id: "minimax-m2.5", label: "MiniMax M2.5" },
  ],
};

function ModelSelect({ provider, value, onChange }: { provider: LLMProvider; value: string; onChange: (v: string) => void }) {
  const options = MODEL_OPTIONS[provider];
  if (!options) return null;

  return (
    <div>
      <label className="block text-xs text-bard-400 mb-1">Model</label>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="input text-sm w-full appearance-none pr-8 bg-bard-800/60 border-bard-700/50 text-white cursor-pointer"
        >
          {options.map((m) => (
            <option key={m.id} value={m.id}>{m.label}</option>
          ))}
        </select>
        <ChevronDown className="w-3.5 h-3.5 text-bard-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
      </div>
    </div>
  );
}

export function SettingsModal() {
  const setSettingsOpen = useStore((s) => s.setSettingsOpen);
  const hasElevenlabsKey = useStore((s) => s.hasElevenlabsKey);
  const hasLlmKey = useStore((s) => s.hasLlmKey);
  const setHasElevenlabsKey = useStore((s) => s.setHasElevenlabsKey);
  const setHasLlmKey = useStore((s) => s.setHasLlmKey);
  const musicModel = useStore((s) => s.musicModel);
  const setMusicModel = useStore((s) => s.setMusicModel);
  const storedProvider = useStore((s) => s.llmProvider);
  const setLlmProvider = useStore((s) => s.setLlmProvider);

  const [elKey, setElKey] = useState("");
  const [llmKey, setLlmKey] = useState("");
  const [finetuneId, setFinetuneId] = useState(musicModel);
  const [provider, setProvider] = useState<LLMProvider>((storedProvider || "ollama") as LLMProvider);
  const [selectedModel, setSelectedModel] = useState(() => {
    const opts = MODEL_OPTIONS[storedProvider];
    return opts?.[0]?.id || "";
  });
  const [ollamaHost, setOllamaHost] = useState("http://localhost:11434");
  const [ollamaLocalModel, setOllamaLocalModel] = useState("llama3");
  const [saving, setSaving] = useState(false);
  const [llmSaved, setLlmSaved] = useState(false);

  const handleProviderChange = (p: LLMProvider) => {
    setProvider(p);
    const opts = MODEL_OPTIONS[p];
    if (opts) setSelectedModel(opts[0].id);
  };

  const saveEl = async () => {
    if (!elKey.trim()) return;
    setSaving(true);
    try { await api.setElevenlabsKey(elKey); setHasElevenlabsKey(true); setElKey(""); } catch {}
    setSaving(false);
  };

  const saveFinetune = async () => {
    setSaving(true);
    try {
      await api.setMusicModel(finetuneId.trim());
      setMusicModel(finetuneId.trim());
    } catch {}
    setSaving(false);
  };

  const saveLlm = async () => {
    setSaving(true);
    try {
      const config = JSON.stringify({
        provider,
        base_url: provider === "openai" ? "https://api.openai.com/v1" : "",
        model: provider === "anthropic" || provider === "openai" ? selectedModel : "",
        ollama_host: provider === "ollama" ? ollamaHost : "",
        ollama_model: provider === "ollama" ? ollamaLocalModel : provider === "ollama_cloud" ? selectedModel : "",
        ollama_api_key: provider === "ollama_cloud" && llmKey.trim() ? llmKey.trim() : "",
      });
      await api.setLlmConfig(config);
      setLlmProvider(provider);

      if ((provider === "anthropic" || provider === "openai") && llmKey.trim()) {
        await api.setLlmKey(llmKey);
      }
      setLlmKey("");
      setHasLlmKey(true);
      setLlmSaved(true);
      setTimeout(() => setLlmSaved(false), 2000);
    } catch {}
    setSaving(false);
  };

  const needsApiKey = provider === "anthropic" || provider === "openai" || provider === "ollama_cloud";

  const keyPlaceholders: Record<string, string> = {
    anthropic: "sk-ant-...",
    openai: "sk-proj-...",
    ollama_cloud: "Ollama API key from ollama.com/settings/keys",
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={() => setSettingsOpen(false)}>
      <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }}
        className="w-full max-w-lg bg-bard-900 rounded-2xl border border-bard-700/50 shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-bard-700/30">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-gold-500 to-gold-400 flex items-center justify-center">
              <Cpu className="w-4 h-4 text-bard-950" />
            </div>
            <h2 className="text-lg font-display font-bold text-white">Settings</h2>
          </div>
          <button onClick={() => setSettingsOpen(false)} className="p-2 hover:bg-bard-800 rounded-xl transition-colors">
            <X className="w-5 h-5 text-bard-400" />
          </button>
        </div>

        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          {/* LLM Provider */}
          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-bard-200 flex items-center gap-2">
              <Brain className="w-4 h-4 text-violet-400" /> AI Brain (LLM)
            </h3>
            <p className="text-xs text-bard-500">Choose how BardPrime thinks and writes lyrics</p>

            <div className="grid grid-cols-2 gap-2">
              {PROVIDERS.map((p) => (
                <button key={p.id} onClick={() => handleProviderChange(p.id)}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    provider === p.id
                      ? "bg-bard-800/80 border-violet-500/50 shadow-lg"
                      : "bg-bard-800/30 border-bard-700/30 hover:border-bard-600/50"
                  }`}>
                  <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${p.color} flex items-center justify-center mb-2`}>
                    <p.icon className="w-4 h-4 text-white" />
                  </div>
                  <span className="text-sm font-semibold text-white block">{p.label}</span>
                  <span className="text-[10px] text-bard-500">{p.desc}</span>
                </button>
              ))}
            </div>

            {/* Provider config */}
            <AnimatePresence mode="wait">
              {provider === "ollama" ? (
                <motion.div key="ollama-local" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                  className="space-y-3 p-4 bg-bard-800/40 rounded-xl border border-bard-700/30">
                  <div>
                    <label className="block text-xs text-bard-400 mb-1">Ollama Host</label>
                    <input className="input text-sm" value={ollamaHost} onChange={(e) => setOllamaHost(e.target.value)} placeholder="http://localhost:11434" />
                  </div>
                  <div>
                    <label className="block text-xs text-bard-400 mb-1">Model</label>
                    <input className="input text-sm" value={ollamaLocalModel} onChange={(e) => setOllamaLocalModel(e.target.value)} placeholder="llama3, mistral, deepseek-r1..." />
                  </div>
                  <div className="flex items-center gap-2 text-xs text-bard-500">
                    <Server className="w-3.5 h-3.5" />
                    Runs 100% locally. No API key needed.
                  </div>
                  {llmSaved && <div className="flex items-center gap-1.5 text-emerald-400 text-xs"><CheckCircle className="w-3.5 h-3.5" /> Config saved!</div>}
                  <button onClick={saveLlm} disabled={saving}
                    className="w-full py-2.5 rounded-xl font-semibold text-sm bg-gradient-to-r from-purple-500 to-violet-500 text-white shadow-lg disabled:opacity-50">
                    Save Config
                  </button>
                </motion.div>
              ) : (
                <motion.div key={provider} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                  className="space-y-3 p-4 bg-bard-800/40 rounded-xl border border-bard-700/30">
                  <ModelSelect provider={provider} value={selectedModel} onChange={setSelectedModel} />
                  <div className="flex items-center gap-2">
                    {llmSaved ? (
                      <div className="flex items-center gap-1.5 text-emerald-400 text-xs"><CheckCircle className="w-3.5 h-3.5" /> Config saved!</div>
                    ) : hasLlmKey && storedProvider === provider ? (
                      <div className="flex items-center gap-1.5 text-emerald-400 text-xs"><CheckCircle className="w-3.5 h-3.5" /> Configured</div>
                    ) : (
                      <div className="flex items-center gap-1.5 text-amber-400 text-xs"><AlertCircle className="w-3.5 h-3.5" /> API key required</div>
                    )}
                  </div>
                  {needsApiKey && (
                    <div>
                      <label className="block text-xs text-bard-400 mb-1">API Key</label>
                      <input type="password" className="input text-sm w-full" placeholder={keyPlaceholders[provider] || "API key..."}
                        value={llmKey} onChange={(e) => setLlmKey(e.target.value)} />
                    </div>
                  )}
                  {provider === "ollama_cloud" && (
                    <div className="flex items-center gap-2 text-xs text-bard-500">
                      <Cloud className="w-3.5 h-3.5" />
                      Get your key at ollama.com/settings/keys. Run `ollama signin` first.
                    </div>
                  )}
                  <button onClick={saveLlm} disabled={saving || (needsApiKey && !llmKey.trim() && !(hasLlmKey && storedProvider === provider))}
                    className="w-full py-2.5 rounded-xl font-semibold text-sm bg-gradient-to-r from-violet-500 to-purple-500 text-white shadow-lg disabled:opacity-50">
                    Save Config
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </section>

          {/* ElevenLabs */}
          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-bard-200 flex items-center gap-2">
              <Music className="w-4 h-4 text-amber-400" /> ElevenLabs (Singing Voice)
            </h3>
            <p className="text-xs text-bard-500">Required for high-quality singing. Without it, the Bard uses procedural synthesis.</p>

            <div className="p-4 bg-bard-800/40 rounded-xl border border-bard-700/30 space-y-3">
              <div className="flex items-center gap-2">
                {hasElevenlabsKey ? (
                  <div className="flex items-center gap-1.5 text-emerald-400 text-xs"><CheckCircle className="w-3.5 h-3.5" /> Key saved</div>
                ) : (
                  <div className="flex items-center gap-1.5 text-amber-400 text-xs"><AlertCircle className="w-3.5 h-3.5" /> No key configured</div>
                )}
              </div>
              <div className="flex gap-2">
                <input type="password" className="input text-sm flex-1" placeholder="xi_..."
                  value={elKey} onChange={(e) => setElKey(e.target.value)} />
                <button onClick={saveEl} disabled={saving || !elKey.trim()}
                  className="px-4 py-2 rounded-xl font-semibold text-sm bg-amber-500 text-bard-950 disabled:opacity-50">Save</button>
              </div>
            </div>
          </section>

          {/* Music Model / Finetune */}
          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-bard-200 flex items-center gap-2">
              <Zap className="w-4 h-4 text-gold-400" /> Music Model / Finetune
            </h3>
            <p className="text-xs text-bard-500">
              Use a custom finetuned ElevenLabs model. Leave blank for the default base model.
            </p>

            <div className="p-4 bg-bard-800/40 rounded-xl border border-bard-700/30 space-y-3">
              <div className="flex items-center gap-2">
                {musicModel ? (
                  <div className="flex items-center gap-1.5 text-gold-400 text-xs">
                    <Zap className="w-3.5 h-3.5" />
                    <span className="font-semibold">{musicModel}</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 text-bard-500 text-xs">
                    <Music className="w-3.5 h-3.5" /> Using default model (music_v1)
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                <input className="input text-sm flex-1"
                  placeholder="Finetune ID (e.g. ActivatePrime)"
                  value={finetuneId} onChange={(e) => setFinetuneId(e.target.value)} />
                <button onClick={saveFinetune} disabled={saving}
                  className="px-4 py-2 rounded-xl font-semibold text-sm bg-gold-500 text-bard-950 disabled:opacity-50">Save</button>
              </div>
              <p className="text-[10px] text-bard-600">
                Find your finetune ID in the ElevenLabs dashboard under your music model settings.
              </p>
            </div>
          </section>

          {/* Info */}
          <div className="p-4 bg-bard-800/30 rounded-xl border border-bard-700/20 text-xs text-bard-500 space-y-1">
            <p>API keys are stored securely in your OS keychain (Windows Credential Manager / macOS Keychain).</p>
            <p>Ollama Local runs 100% on your machine — your data never leaves.</p>
            <p>Ollama Cloud runs on ollama.com servers. Sign in with `ollama signin`.</p>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
