import SeverityBadge from './SeverityBadge';

export default function CrashCard({ crash, onClick }) {
  return (
    <div
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick?.(); } }}
      className="rounded-xl bg-rcai-card border border-rcai-border p-4 cursor-pointer transition-all duration-200 hover:border-rcai-accent/50"
    >
      <div className="flex items-center justify-between mb-2">
        <span className="font-display text-sm font-semibold text-rcai-text-primary">{crash.name}</span>
        <SeverityBadge severity={crash.severity} />
      </div>
      <p className="text-sm text-rcai-text-secondary line-clamp-2">{crash.summary}</p>
      <div className="flex items-center gap-2 mt-2 text-xs text-rcai-text-muted">
        <span>{crash.project}</span>
        <span>·</span>
        <span>{crash.rootCause}</span>
      </div>
    </div>
  );
}
