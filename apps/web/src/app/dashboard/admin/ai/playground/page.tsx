"use client";
import { useAuth } from "@/providers/auth-provider";
import { useState } from "react";
import Link from "next/link";
import { Brain } from "lucide-react";

const TUTORS = [
  { key: "nova", name: "Nova", desc: "General knowledge & curiosity" },
  { key: "pixel", name: "Pixel", desc: "Digital arts & creativity" },
  { key: "atlas", name: "Atlas", desc: "Geography & world exploration" },
  { key: "lyra", name: "Lyra", desc: "Music & rhythm" },
  { key: "sage", name: "Sage", desc: "Science & experiments" },
  { key: "echo", name: "Echo", desc: "Language & communication" },
  { key: "bolt", name: "Bolt", desc: "Math & logic puzzles" },
  { key: "flora", name: "Flora", desc: "Nature & biology" },
  { key: "cosmo", name: "Cosmo", desc: "Space & astronomy" },
  { key: "spark", name: "Spark", desc: "Engineering & building" },
  { key: "wave", name: "Wave", desc: "Social-emotional learning" },
  { key: "dash", name: "Dash", desc: "Physical education & movement" },
  { key: "prism", name: "Prism", desc: "Visual arts & colors" },
  { key: "rhythm", name: "Rhythm", desc: "Dance & performing arts" },
];

const MODELS = [
  { id: "claude-opus-4-7", provider: "Anthropic", label: "Claude Opus 4.7" },
  { id: "claude-sonnet-4-6", provider: "Anthropic", label: "Claude Sonnet 4.6" },
  { id: "claude-haiku-4-5", provider: "Anthropic", label: "Claude Haiku 4.5" },
  { id: "gpt-5.5", provider: "OpenAI", label: "GPT-5.5" },
  { id: "gpt-5.5-mini", provider: "OpenAI", label: "GPT-5.5 Mini" },
  { id: "gemini-3.0-pro", provider: "Google", label: "Gemini 3.0 Pro" },
  { id: "gemini-3.0-flash", provider: "Google", label: "Gemini 3.0 Flash" },
];

interface Message {
  role: "user" | "assistant" | "system";
  content: string;
}

export default function AIPlaygroundPage() {
  const { accessToken } = useAuth();
  const [selectedTutor, setSelectedTutor] = useState(TUTORS[0].key);
  const [selectedModel, setSelectedModel] = useState(MODELS[0].id);
  const [systemPrompt, setSystemPrompt] = useState("You are an AI tutor helping a child learn. Be encouraging, patient, and use simple language.");
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [temperature, setTemperature] = useState(0.7);
  const [maxTokens, setMaxTokens] = useState(500);

  const tutor = TUTORS.find((t) => t.key === selectedTutor);

  const handleSend = async () => {
    if (!input.trim() || loading) return;
    const userMessage: Message = { role: "user", content: input.trim() };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/brain/playground", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          model: selectedModel,
          tutorKey: selectedTutor,
          systemPrompt,
          messages: newMessages,
          temperature,
          maxTokens,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setMessages([...newMessages, { role: "assistant", content: data.response || data.content || "No response received." }]);
      } else {
        setMessages([...newMessages, { role: "assistant", content: `[Playground endpoint not yet connected. Model: ${selectedModel}, Tutor: ${selectedTutor}]\n\nThis is a simulated response. The AI playground will be functional once the brain-svc playground endpoint is deployed.` }]);
      }
    } catch {
      setMessages([...newMessages, { role: "assistant", content: "[Simulated response] The playground API is not yet available. This page allows testing AI tutor prompts once connected." }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center gap-3 text-sm vi-text-muted">
        <Link href="/dashboard/admin/ai" className="hover:text-[hsl(var(--visual-primary))] transition">AI & Brain Models</Link>
        <span>/</span>
        <span className="vi-text font-medium">Prompt Playground</span>
      </div>

      <div>
        <h1 className="text-2xl font-heading font-bold vi-text">AI Prompt Playground</h1>
        <p className="text-sm vi-text-muted mt-1">Test and refine AI tutor prompts with different models and configurations.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="space-y-4">
          <div className="vi-card p-5 space-y-4">
            <h3 className="font-heading font-bold vi-text">Configuration</h3>

            <div>
              <label htmlFor="pg-tutor" className="block text-sm font-medium vi-text mb-1">Tutor</label>
              <select
                id="pg-tutor"
                value={selectedTutor}
                onChange={(e) => setSelectedTutor(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border vi-border text-sm bg-white focus:border-purple-400 outline-none"
              >
                {TUTORS.map((t) => (
                  <option key={t.key} value={t.key}>{t.name} — {t.desc}</option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="pg-model" className="block text-sm font-medium vi-text mb-1">Model</label>
              <select
                id="pg-model"
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border vi-border text-sm bg-white focus:border-purple-400 outline-none"
              >
                {MODELS.map((m) => (
                  <option key={m.id} value={m.id}>{m.label} ({m.provider})</option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="pg-temp" className="block text-sm font-medium vi-text mb-1">Temperature: {temperature}</label>
              <input
                id="pg-temp"
                type="range"
                min="0"
                max="2"
                step="0.1"
                value={temperature}
                onChange={(e) => setTemperature(parseFloat(e.target.value))}
                className="w-full accent-purple-600"
              />
            </div>

            <div>
              <label htmlFor="pg-tokens" className="block text-sm font-medium vi-text mb-1">Max Tokens: {maxTokens}</label>
              <input
                id="pg-tokens"
                type="range"
                min="100"
                max="4000"
                step="100"
                value={maxTokens}
                onChange={(e) => setMaxTokens(parseInt(e.target.value))}
                className="w-full accent-purple-600"
              />
            </div>
          </div>

          <div className="vi-card p-5 space-y-3">
            <h3 className="font-heading font-bold vi-text">System Prompt</h3>
            <textarea
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              rows={6}
              className="w-full px-3 py-2 rounded-xl border vi-border text-sm focus:border-purple-400 outline-none resize-none"
            />
          </div>
        </div>

        <div className="lg:col-span-2">
          <div className="vi-card flex flex-col h-[600px]">
            <div className="p-4 border-b vi-border flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Brain size={18} strokeWidth={2.5} className="text-[hsl(var(--visual-primary))]" aria-hidden="true" />
                <span className="font-semibold vi-text">{tutor?.name}</span>
                <span className="text-xs vi-surface-soft vi-text-muted px-2 py-0.5 rounded-full">{selectedModel}</span>
              </div>
              <button
                onClick={() => setMessages([])}
                className="text-xs vi-text-muted hover:vi-text-muted transition"
              >
                Clear Chat
              </button>
            </div>

            <div className="flex-1 overflow-auto p-4 space-y-4">
              {messages.length === 0 && (
                <div className="flex items-center justify-center h-full vi-text-muted text-sm">
                  Start a conversation to test the AI tutor prompt...
                </div>
              )}
              {messages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm ${
                    msg.role === "user"
                      ? "bg-purple-600 text-white"
                      : "vi-surface-soft vi-text"
                  }`}>
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                  </div>
                </div>
              ))}
              {loading && (
                <div className="flex justify-start">
                  <div className="vi-surface-soft rounded-2xl px-4 py-3 text-sm vi-text-muted animate-pulse">
                    Thinking...
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 border-t vi-border">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
                  placeholder="Type a message..."
                  className="flex-1 px-4 py-2.5 rounded-xl border vi-border text-sm focus:border-purple-400 focus:ring-2 focus:ring-purple-100 outline-none"
                />
                <button
                  onClick={handleSend}
                  disabled={!input.trim() || loading}
                  className="px-5 py-2.5 rounded-xl bg-purple-600 text-white font-semibold text-sm hover:bg-purple-700 transition disabled:opacity-50"
                >
                  Send
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
