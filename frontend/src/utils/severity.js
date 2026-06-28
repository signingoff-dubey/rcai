export const severityColors = {
  Critical: '#EF4444',
  High: '#F59E0B',
  Medium: '#3B82F6',
  Low: '#10B981',
  Info: '#8B5CF6',
};

export const severityBgClasses = {
  Critical: 'bg-rcai-danger text-white',
  High: 'bg-rcai-warning text-black',
  Medium: 'bg-rcai-accent text-white',
  Low: 'bg-rcai-success text-white',
  Info: 'bg-rcai-purple text-white',
};

export const severityFromScore = (score) => {
  if (score >= 9.0) return 'Critical';
  if (score >= 7.0) return 'High';
  if (score >= 4.0) return 'Medium';
  if (score >= 0.1) return 'Low';
  return 'Info';
};
