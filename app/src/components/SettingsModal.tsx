import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Brain, Music, CheckCircle, AlertCircle, Server, Globe, Cpu, Zap, Cloud, ChevronDown, Palette, RefreshCw } from "lucide-react";
import { useStore } from "../store";
import type { ThemeId } from "../store";
import { api } from "../api/client";

const THEMES: {
  id: ThemeId; label: string; tagline: string;
  bg: string; card: string; accent: string; glow: string; text: string;
}[] = [
  { id: "bard", label: "Bard", tagline: "Mystical & scholarly",
    bg: "#0a0812", card: "#1f1836", accent: "#d4a843", glow: "rgba(212,168,67,0.3)", text: "#c4b1eb" },
  { id: "obsidian", label: "Obsidian", tagline: "Futuristic void",
    bg: "#020204", card: "#0e0e16", accent: "#00e6dc", glow: "rgba(0,230,220,0.25)", text: "#a5a5be" },
  { id: "velvet", label: "Velvet", tagline: "Jazz lounge luxury",
    bg: "#100610", card: "#30121e", accent: "#e0b4a0", glow: "rgba(224,180,160,0.25)", text: "#dc92aa" },
  { id: "aurora", label: "Aurora", tagline: "Northern lights",
    bg: "#040a0e", card: "#101e28", accent: "#dc64dc", glow: "rgba(80,220,180,0.15)", text: "#5f9bb4" },
  { id: "forge", label: "Forge", tagline: "Industrial heat",
    bg: "#0c0a08", card: "#1c1814", accent: "#f59e28", glow: "rgba(245,158,40,0.3)", text: "#877866" },
  { id: "sakura", label: "Sakura", tagline: "Cherry blossom",
    bg: "#0e0810", card: "#201426", accent: "#f096aa", glow: "rgba(240,150,170,0.2)", text: "#b28abe" },
  { id: "ocean", label: "Ocean", tagline: "Deep sea glow",
    bg: "#040810", card: "#0c1426", accent: "#3ce1c3", glow: "rgba(60,225,195,0.2)", text: "#346ea8" },
  { id: "noir", label: "Noir", tagline: "Cinematic drama",
    bg: "#040404", card: "#0a0a0a", accent: "#ebebeb", glow: "rgba(200,30,40,0.15)", text: "#696969" },
];

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
  const llmConfigured = useStore((s) => s.llmConfigured);
  const setHasElevenlabsKey = useStore((s) => s.setHasElevenlabsKey);
  const setHasLlmKey = useStore((s) => s.setHasLlmKey);
  const setLlmConfigured = useStore((s) => s.setLlmConfigured);
  const musicModel = useStore((s) => s.musicModel);
  const setMusicModel = useStore((s) => s.setMusicModel);
  const storedProvider = useStore((s) => s.llmProvider);
  const setLlmProvider = useStore((s) => s.setLlmProvider);
  const theme = useStore((s) => s.theme);
  const setTheme = useStore((s) => s.setTheme);

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
  const [ollamaCloudModel, setOllamaCloudModel] = useState(MODEL_OPTIONS.ollama_cloud[0].id);
  const [availableOllamaModels, setAvailableOllamaModels] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [refreshingModels, setRefreshingModels] = useState(false);
  const [voiceTesting, setVoiceTesting] = useState(false);
  const [llmSaved, setLlmSaved] = useState(false);
  const [existingCloudKey, setExistingCloudKey] = useState("");
  const [testResult, setTestResult] = useState<{ success: boolean; provider: string; model: string; message: string; error: string } | null>(null);
  const [voiceTestResult, setVoiceTestResult] = useState<{ success: boolean; engine: string; error: string; duration_sec: number } | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const configJson = await api.getLlmConfig();
        if (!configJson) return;
        const cfg = JSON.parse(configJson);
        const nextProvider = (cfg.provider || storedProvider || "ollama") as LLMProvider;
        setProvider(nextProvider);
        const savedLocalModel = cfg.ollama_local_model || cfg.ollama_model;
        const savedCloudModel = cfg.ollama_cloud_model || cfg.ollama_model;

        if (cfg.ollama_host) setOllamaHost(cfg.ollama_host);
        if (savedLocalModel) setOllamaLocalModel(savedLocalModel);
        if (savedCloudModel) setOllamaCloudModel(savedCloudModel);
        if (cfg.ollama_api_key) setExistingCloudKey(cfg.ollama_api_key);

        if (nextProvider === "ollama") {
          return;
        }

        if (nextProvider === "ollama_cloud") {
          return;
        }

        const options = MODEL_OPTIONS[nextProvider];
        if (options?.length) {
          setSelectedModel(cfg.model || options[0].id);
        }
      } catch {}
    })();
  }, []);

  useEffect(() => {
    if (provider !== "ollama") return;
    void refreshOllamaModels();
  }, [provider]);

  const handleProviderChange = (p: LLMProvider) => {
    setProvider(p);
    setTestResult(null);
    const opts = MODEL_OPTIONS[p];
    if (p !== "ollama" && p !== "ollama_cloud" && opts && !opts.some((opt) => opt.id === selectedModel)) {
      setSelectedModel(opts[0].id);
    }
  };

  const refreshOllamaModels = async () => {
    setRefreshingModels(true);
    try {
      const result = await api.listOllamaModels(ollamaHost);
      const names = result.models?.map((m) => m.name).filter(Boolean) || [];
      setAvailableOllamaModels(names);
      if (names.length > 0 && !names.includes(ollamaLocalModel)) {
        setOllamaLocalModel(names[0]);
      }
    } catch {
      setAvailableOllamaModels([]);
    }
    setRefreshingModels(false);
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

  const isProviderConfigured = (nextProvider: LLMProvider) => {
    if (nextProvider === "ollama") {
      return Boolean(ollamaHost.trim() && ollamaLocalModel.trim());
    }
    if (nextProvider === "ollama_cloud") {
      return Boolean(ollamaCloudModel && (llmKey.trim() || existingCloudKey.trim()));
    }
    return Boolean(selectedModel && (llmKey.trim() || hasLlmKey));
  };

  const saveLlm = async () => {
    setSaving(true);
    setTestResult(null);
    try {
      const config = JSON.stringify({
        provider,
        base_url: provider === "openai" ? "https://api.openai.com/v1" : "",
        model: provider === "anthropic" || provider === "openai" ? selectedModel : "",
        ollama_host: provider === "ollama" ? ollamaHost : "",
        ollama_model: provider === "ollama" ? ollamaLocalModel : provider === "ollama_cloud" ? ollamaCloudModel : "",
        ollama_local_model: ollamaLocalModel,
        ollama_cloud_model: ollamaCloudModel,
        ollama_api_key: provider === "ollama_cloud" ? (llmKey.trim() || existingCloudKey) : existingCloudKey,
      });
      await api.setLlmConfig(config);
      setLlmProvider(provider);
      setLlmConfigured(isProviderConfigured(provider));

      if ((provider === "anthropic" || provider === "openai") && llmKey.trim()) {
        await api.setLlmKey(llmKey);
        setHasLlmKey(true);
      }
      if (provider === "ollama_cloud" && llmKey.trim()) setExistingCloudKey(llmKey.trim());
      setLlmKey("");
      setLlmSaved(true);
      setTimeout(() => setLlmSaved(false), 2000);
    } catch {}
    setSaving(false);
  };

  const handleTestLlm = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const result = await api.testLlmConnection();
      setTestResult(result);
      if (result.success) setLlmConfigured(true);
    } catch {
      setTestResult({
        success: false,
        provider,
        model: provider === "ollama" ? ollamaLocalModel : provider === "ollama_cloud" ? ollamaCloudModel : selectedModel,
        message: "",
        error: "Connection test failed before the provider could respond. Save your settings and try again.",
      });
    }
    setTesting(false);
  };

  const handleTestVoice = async () => {
    setVoiceTesting(true);
    setVoiceTestResult(null);
    try {
      const result = await api.testVoicePipeline();
      setVoiceTestResult(result);
    } catch {
      setVoiceTestResult({
        success: false,
        engine: "elevenlabs",
        error: "Voice pipeline test failed before the render could complete.",
        duration_sec: 0,
      });
    }
    setVoiceTesting(false);
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
          {/* Theme */}
          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-bard-200 flex items-center gap-2">
              <Palette className="w-4 h-4 text-gold-400" /> Theme
            </h3>
            <p className="text-xs text-bard-500">Each theme transforms the entire visual experience</p>
            <div className="grid grid-cols-4 gap-2.5">
              {THEMES.map((t) => {
                const active = theme === t.id;
                return (
                  <button key={t.id} onClick={() => setTheme(t.id)}
                    className={`group relative overflow-hidden text-left transition-all duration-300 ${
                      active ? "ring-2 scale-[1.02] z-10" : "hover:scale-[1.01]"
                    }`}
                    style={{
                      borderRadius: "12px",
                      border: active ? `2px solid ${t.accent}` : "1px solid rgba(255,255,255,0.06)",
                      boxShadow: active ? `0 0 20px -4px ${t.glow}` : "none",
                    }}>
                    {/* Mini preview */}
                    <div className="relative h-16 overflow-hidden" style={{
                      background: t.bg,
                      borderRadius: "11px 11px 0 0",
                    }}>
                      {/* Simulated mesh glow */}
                      <div className="absolute inset-0 opacity-60"
                        style={{
                          background: `radial-gradient(ellipse at 30% 20%, ${t.glow}, transparent 60%), radial-gradient(ellipse at 70% 80%, ${t.glow.replace(/[\d.]+\)$/, '0.1)')}, transparent 50%)`,
                        }} />
                      {/* Mini card preview */}
                      <div className="absolute left-2 top-3 right-2 h-6 rounded-sm"
                        style={{
                          background: t.card,
                          border: `1px solid rgba(255,255,255,0.06)`,
                        }}>
                        <div className="flex items-center gap-1 px-1.5 h-full">
                          <div className="w-2 h-2 rounded-full" style={{ background: t.accent }} />
                          <div className="flex-1 h-1 rounded-full" style={{ background: t.text, opacity: 0.3 }} />
                        </div>
                      </div>
                      {/* Accent glow dot */}
                      <div className="absolute bottom-1.5 right-2 w-3 h-1 rounded-full"
                        style={{
                          background: t.accent,
                          boxShadow: `0 0 8px ${t.glow}`,
                        }} />
                    </div>
                    {/* Label */}
                    <div className="px-2.5 py-2" style={{ background: t.bg }}>
                      <div className="flex items-center gap-1.5">
                        <div className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                          style={{ background: t.accent, boxShadow: `0 0 6px ${t.glow}` }} />
                        <span className="text-[11px] font-bold truncate" style={{ color: active ? t.accent : "#ccc" }}>
                          {t.label}
                        </span>
                      </div>
                      <p className="text-[9px] mt-0.5 truncate" style={{ color: t.text }}>
                        {t.tagline}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

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
                    {availableOllamaModels.length > 0 ? (
                      <div className="relative">
                        <select
                          value={ollamaLocalModel}
                          onChange={(e) => setOllamaLocalModel(e.target.value)}
                          className="input text-sm w-full appearance-none pr-8 bg-bard-800/60 border-bard-700/50 text-white cursor-pointer"
                        >
                          {availableOllamaModels.map((modelName) => (
                            <option key={modelName} value={modelName}>{modelName}</option>
                          ))}
                        </select>
                        <ChevronDown className="w-3.5 h-3.5 text-bard-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      </div>
                    ) : (
                      <input className="input text-sm" value={ollamaLocalModel} onChange={(e) => setOllamaLocalModel(e.target.value)} placeholder="llama3.2, mistral, deepseek-r1..." />
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-bard-500">
                    <Server className="w-3.5 h-3.5" />
                    Runs 100% locally. No API key needed.
                  </div>
                  <div className="flex items-center justify-between gap-3 text-xs">
                    <span className="text-bard-500">
                      {availableOllamaModels.length > 0
                        ? `Installed models: ${availableOllamaModels.join(", ")}`
                        : "No installed models detected yet. Pull one in Ollama, then refresh."}
                    </span>
                    <button
                      onClick={refreshOllamaModels}
                      disabled={refreshingModels}
                      className="flex items-center gap-1.5 text-bard-300 hover:text-white disabled:opacity-50"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${refreshingModels ? "animate-spin" : ""}`} />
                      Refresh
                    </button>
                  </div>
                  {llmSaved && <div className="flex items-center gap-1.5 text-emerald-400 text-xs"><CheckCircle className="w-3.5 h-3.5" /> Config saved!</div>}
                  {testResult && (
                    <div className={`text-xs rounded-lg px-3 py-2 border ${
                      testResult.success ? "text-emerald-300 border-emerald-500/30 bg-emerald-500/10" : "text-amber-300 border-amber-500/30 bg-amber-500/10"
                    }`}>
                      {testResult.success ? `${testResult.provider} connected: ${testResult.message}` : testResult.error}
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-2">
                    <button onClick={saveLlm} disabled={saving}
                      className="w-full py-2.5 rounded-xl font-semibold text-sm bg-gradient-to-r from-purple-500 to-violet-500 text-white shadow-lg disabled:opacity-50">
                      Save Config
                    </button>
                    <button onClick={handleTestLlm} disabled={saving || testing || !isProviderConfigured("ollama")}
                      className="w-full py-2.5 rounded-xl font-semibold text-sm bg-bard-700/70 text-bard-100 border border-bard-600/40 disabled:opacity-50">
                      {testing ? "Testing..." : "Test Connection"}
                    </button>
                  </div>
                </motion.div>
              ) : (
                <motion.div key={provider} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                  className="space-y-3 p-4 bg-bard-800/40 rounded-xl border border-bard-700/30">
                  <ModelSelect
                    provider={provider}
                    value={provider === "ollama_cloud" ? ollamaCloudModel : selectedModel}
                    onChange={provider === "ollama_cloud" ? setOllamaCloudModel : setSelectedModel}
                  />
                  <div className="flex items-center gap-2">
                    {llmSaved ? (
                      <div className="flex items-center gap-1.5 text-emerald-400 text-xs"><CheckCircle className="w-3.5 h-3.5" /> Config saved!</div>
                    ) : ((provider === "ollama_cloud" && (llmKey.trim() || existingCloudKey.trim())) || (provider !== "ollama_cloud" && hasLlmKey && storedProvider === provider)) ? (
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
                      {existingCloudKey ? "Cloud key saved. Enter a new one only if you want to replace it." : "Get your key at ollama.com/settings/keys. Run `ollama signin` first."}
                    </div>
                  )}
                  {testResult && (
                    <div className={`text-xs rounded-lg px-3 py-2 border ${
                      testResult.success ? "text-emerald-300 border-emerald-500/30 bg-emerald-500/10" : "text-amber-300 border-amber-500/30 bg-amber-500/10"
                    }`}>
                      {testResult.success ? `${testResult.provider} connected: ${testResult.message}` : testResult.error}
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-2">
                    <button onClick={saveLlm} disabled={saving || (needsApiKey && !llmKey.trim() && !(provider === "ollama_cloud" ? existingCloudKey.trim() : hasLlmKey && storedProvider === provider))}
                      className="w-full py-2.5 rounded-xl font-semibold text-sm bg-gradient-to-r from-violet-500 to-purple-500 text-white shadow-lg disabled:opacity-50">
                      Save Config
                    </button>
                    <button onClick={handleTestLlm} disabled={saving || testing || !isProviderConfigured(provider)}
                      className="w-full py-2.5 rounded-xl font-semibold text-sm bg-bard-700/70 text-bard-100 border border-bard-600/40 disabled:opacity-50">
                      {testing ? "Testing..." : "Test Connection"}
                    </button>
                  </div>
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
              {voiceTestResult && (
                <div className={`text-xs rounded-lg px-3 py-2 border ${
                  voiceTestResult.success ? "text-emerald-300 border-emerald-500/30 bg-emerald-500/10" : "text-amber-300 border-amber-500/30 bg-amber-500/10"
                }`}>
                  {voiceTestResult.success
                    ? `Voice pipeline ready via ${voiceTestResult.engine}.`
                    : voiceTestResult.error}
                </div>
              )}
              <button
                onClick={handleTestVoice}
                disabled={voiceTesting || !hasElevenlabsKey}
                className="w-full py-2.5 rounded-xl font-semibold text-sm bg-bard-700/70 text-bard-100 border border-bard-600/40 disabled:opacity-50"
              >
                {voiceTesting ? "Testing Voice..." : "Test Voice Pipeline"}
              </button>
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
