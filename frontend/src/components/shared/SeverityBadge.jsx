import { severityBgClasses } from '../../utils/severity';

export default function SeverityBadge({ severity = 'Info' }) {
  const colorClass = severityBgClasses[severity] || severityBgClasses.Info;
  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded ${colorClass}`}>
      {severity}
    </span>
  );
}
