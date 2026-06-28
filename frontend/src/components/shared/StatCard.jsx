export default function StatCard({ icon: Icon, label, value, delta, color = 'text-rcai-accent' }) {
  return (
    <div className="rounded-xl bg-rcai-card border border-rcai-border p-4 transition-all duration-200 hover:border-rcai-accent/50">
      <div className="flex items-center justify-between mb-3">
        <Icon size={20} className={color} />
        {delta !== undefined && (
          <span className={`text-xs font-medium ${delta >= 0 ? 'text-rcai-success' : 'text-rcai-danger'}`}>
            {delta >= 0 ? '↑' : '↓'} {Math.abs(delta)}%
          </span>
        )}
      </div>
      <div className="font-display text-2xl font-bold text-rcai-text-primary">{value}</div>
      <div className="text-sm text-rcai-text-secondary mt-1">{label}</div>
    </div>
  );
}
