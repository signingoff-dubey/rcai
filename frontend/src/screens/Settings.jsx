import { Info, Shield, Server, Palette, Check, Sparkles } from 'lucide-react';
import useAppStore from '../store/useAppStore';

const themes = [
  {
    id: 'default',
    name: 'Default Dark',
    description: 'Original deep navy theme',
    preview: { bg: '#0A0E1A', card: '#111827', border: '#1E2D45', accent: '#3B82F6' },
  },
  {
    id: 'glass',
    name: 'Glass Morphism',
    description: 'Translucent blur, frosted cards',
    preview: { bg: '#080c18', card: 'rgba(17,24,39,0.55)', border: 'rgba(255,255,255,0.08)', accent: '#60A5FA' },
  },
  {
    id: 'skeuomorphism',
    name: 'Skeuomorphism',
    description: 'Gradients, gloss, beveled edges',
    preview: { bg: '#0f0f23', card: '#16163a', border: '#2a2a5e', accent: '#4488ff' },
  },
  {
    id: 'clay',
    name: 'Clay Morphism',
    description: 'Soft matte, diffused shadows',
    preview: { bg: '#141824', card: '#232838', border: '#3a4058', accent: '#6C8CFF' },
  },
  {
    id: 'neobrutalism',
    name: 'Neo Brutalism',
    description: 'Bold borders, high contrast',
    preview: { bg: '#0D0D0D', card: '#1A1A1A', border: '#FFFFFF', accent: '#FF3B30' },
  },
];

function ThemeTile({ theme, active, onSelect }) {
  return (
    <button
      onClick={() => onSelect(theme.id)}
      className={`relative rounded-xl p-3 text-left transition-all duration-200 ${
        active
          ? 'ring-2 ring-rcai-accent bg-rcai-elevated border border-rcai-accent'
          : 'bg-rcai-card border border-rcai-border hover:border-rcai-accent/50'
      }`}
    >
      {active && (
        <span className="absolute top-2 right-2 w-5 h-5 rounded-full bg-rcai-accent flex items-center justify-center">
          <Check size={12} className="text-white" />
        </span>
      )}
      <div className="flex items-center gap-3 mb-2">
        <div
          className="w-10 h-10 rounded-lg flex items-center justify-center"
          style={{ background: theme.preview.accent }}
        >
          <Sparkles size={16} className="text-white" />
        </div>
        <div>
          <div className="font-display text-sm font-semibold text-rcai-text-primary">
            {theme.name}
          </div>
          <div className="text-xs text-rcai-text-muted">{theme.description}</div>
        </div>
      </div>
      <div className="flex gap-1.5 mt-1">
        <div className="w-5 h-5 rounded" style={{ background: theme.preview.bg }} />
        <div className="w-5 h-5 rounded" style={{ background: theme.preview.card }} />
        <div className="w-5 h-5 rounded" style={{ background: theme.preview.border, border: '1px solid rgba(255,255,255,0.1)' }} />
        <div className="w-5 h-5 rounded" style={{ background: theme.preview.accent }} />
      </div>
    </button>
  );
}

export default function Settings() {
  const theme = useAppStore((s) => s.theme);
  const setTheme = useAppStore((s) => s.setTheme);

  return (
    <div className="max-w-2xl space-y-4">
      <div className="rounded-xl bg-rcai-card border border-rcai-border p-4">
        <div className="flex items-center gap-2 mb-3">
          <Server size={18} className="text-rcai-accent" />
          <h3 className="font-display text-sm font-semibold text-rcai-text-primary">API Configuration</h3>
        </div>
        <p className="text-sm text-rcai-text-secondary mb-3">
          API keys are configured server-side via the .env file. They are never exposed to the frontend.
        </p>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="text-rcai-text-muted">Backend URL</div>
          <div className="text-rcai-text-secondary font-mono text-xs">http://localhost:8000</div>
          <div className="text-rcai-text-muted">Groq API Key</div>
          <div className="text-rcai-text-secondary font-mono text-xs">........ (set in .env)</div>
          <div className="text-rcai-text-muted">CORS Origin</div>
          <div className="text-rcai-text-secondary font-mono text-xs">http://localhost:5173</div>
        </div>
      </div>

      <div className="rounded-xl bg-rcai-card border border-rcai-border p-4">
        <div className="flex items-center gap-2 mb-3">
          <Shield size={18} className="text-rcai-success" />
          <h3 className="font-display text-sm font-semibold text-rcai-text-primary">Security</h3>
        </div>
        <p className="text-sm text-rcai-text-secondary">
          All AI processing happens server-side. The Groq API key is stored in the backend .env file
          and is never transmitted to the browser. Frontend API calls are proxied through the Vite dev
          server and FastAPI backend.
        </p>
      </div>

      <div className="rounded-xl bg-rcai-card border border-rcai-border p-4">
        <div className="flex items-center gap-2 mb-4">
          <Palette size={18} className="text-rcai-purple" />
          <h3 className="font-display text-sm font-semibold text-rcai-text-primary">Appearance</h3>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {themes.map((t) => (
            <ThemeTile key={t.id} theme={t} active={theme === t.id} onSelect={setTheme} />
          ))}
        </div>
      </div>

      <div className="rounded-xl bg-rcai-card border border-rcai-border p-4">
        <div className="flex items-center gap-2 mb-3">
          <Info size={18} className="text-rcai-accent" />
          <h3 className="font-display text-sm font-semibold text-rcai-text-primary">About</h3>
        </div>
        <div className="space-y-1 text-sm">
          <p className="text-rcai-text-primary font-semibold">RCAi: Software Failure Root Cause Analysis Platform</p>
          <p className="text-rcai-text-secondary">Version 1.0.0</p>
          <p className="text-rcai-text-secondary">Built for IEEE DataPort Hackathon: Problem Statement #12</p>
          <p className="text-rcai-text-secondary">Stack: React 18 + Tailwind CSS + FastAPI + Groq AI</p>
        </div>
      </div>
    </div>
  );
}
