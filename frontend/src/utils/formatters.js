export const chartTooltipStyle = {
  contentStyle: {
    background: 'var(--rcai-card)',
    border: '1px solid var(--rcai-border)',
    borderRadius: 8,
    fontSize: 12,
  },
  itemStyle: { color: 'var(--rcai-text-primary)' },
  labelStyle: { color: 'var(--rcai-text-secondary)' },
};

export const formatBytes = (bytes) => {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let i = 0;
  let size = bytes;
  while (size >= 1024 && i < units.length - 1) {
    size /= 1024;
    i++;
  }
  return `${size.toFixed(1)} ${units[i]}`;
};

export const formatDate = (dateStr) => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};
