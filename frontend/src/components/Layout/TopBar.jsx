import { ChevronRight } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';

const screenTitles = {
  '/': 'Dashboard',
  '/explorer': 'File Explorer',
  '/pipeline': 'Pipeline',
  '/security': 'Security Intel',
  '/exploit': 'Vulnerability Research & Reproduction Lab',
  '/clusters': 'Crash Clusters',
  '/timeline': 'Timeline',
  '/cve': 'CVE Lookup',
  '/report': 'Report Builder',
  '/settings': 'Settings',
};

const breadcrumbPaths = {
  '/explorer': [{ label: 'Files', path: '/explorer' }],
};

export default function TopBar() {
  const location = useLocation();
  const navigate = useNavigate();
  const title = screenTitles[location.pathname] || 'RCAi';
  const crumbs = breadcrumbPaths[location.pathname] || [];

  return (
    <header className="h-14 border-b border-rcai-border flex items-center justify-between px-6 bg-rcai-bg">
      <div className="flex items-center gap-2">
        <h1 className="font-display text-lg font-semibold text-rcai-text-primary">{title}</h1>
        {crumbs.length > 0 && (
          <div className="flex items-center gap-1.5 ml-2 text-xs text-rcai-text-muted">
            <ChevronRight size={12} />
            {crumbs.map((c, i) => (
              <span key={i}>
                {i > 0 && <ChevronRight size={10} className="inline mx-1" />}
                <button
                  onClick={() => navigate(c.path)}
                  className="hover:text-rcai-text-secondary transition-colors"
                >
                  {c.label}
                </button>
              </span>
            ))}
          </div>
        )}
      </div>
    </header>
  );
}
