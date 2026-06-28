import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import SeverityBadge from '../components/shared/SeverityBadge';
import { getTimelineEvents } from '../api/client';
import useAppStore from '../store/useAppStore';

const colorMap = { Critical: '#EF4444', High: '#F59E0B', Medium: '#3B82F6', Low: '#10B981', Info: '#8B5CF6' };
const severityToCvss = { Critical: 9.5, High: 7.5, Medium: 5.0, Low: 2.5, Info: 1.0 };
const getDotSize = (e) => {
  const score = e.cvss_score || severityToCvss[e.severity] || 5;
  return Math.max(4, score * 1.6);
};

const projectColors = {
  NASM: '#3B82F6',
  mruby: '#8B5CF6',
  Lua: '#10B981',
  libtiff: '#F59E0B',
  libsixel: '#EF4444',
};

export default function Timeline() {
  const navigate = useNavigate();
  const setCurrentAnalysisId = useAppStore((s) => s.setCurrentAnalysisId);
  const [events, setEvents] = useState([]);
  const [insights, setInsights] = useState([]);
  const [selected, setSelected] = useState(null);
  const [yearRange, setYearRange] = useState([2016, 2024]);
  const [projectFilters, setProjectFilters] = useState([]);
  const [severityFilters, setSeverityFilters] = useState([]);
  const [hovered, setHovered] = useState(null);

  useEffect(() => {
    getTimelineEvents().then((res) => {
      const data = res.data || {};
      if (Array.isArray(data)) {
        setEvents(data);
        setInsights([]);
      } else {
        setEvents(data.events || []);
        setInsights(data.insights || []);
      }
    }).catch(() => {});
  }, []);

  const allProjects = [...new Set(events.map((e) => e.project))];
  const allSeverities = [...new Set(events.map((e) => e.severity))];

  const toggleProjectFilter = (p) => {
    setProjectFilters((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]
    );
  };

  const toggleSeverityFilter = (s) => {
    setSeverityFilters((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]
    );
  };

  const filtered = events.filter((e) => {
    if (e.year < yearRange[0] || e.year > yearRange[1]) return false;
    if (projectFilters.length > 0 && !projectFilters.includes(e.project)) return false;
    if (severityFilters.length > 0 && !severityFilters.includes(e.severity)) return false;
    return true;
  });

  const years = [...new Set(filtered.map((e) => e.year))].sort();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4 flex-wrap">
        <span className="text-sm text-rcai-text-secondary">Year:</span>
        <input
          type="range"
          min={2016}
          max={2024}
          value={yearRange[0]}
          onChange={(e) => setYearRange([Number(e.target.value), yearRange[1]])}
          className="w-24 accent-rcai-accent"
        />
        <span className="text-sm text-rcai-text-primary font-mono w-10">{yearRange[0]}</span>
        <span className="text-rcai-text-muted">{"\u2014"}</span>
        <input
          type="range"
          min={2016}
          max={2024}
          value={yearRange[1]}
          onChange={(e) => setYearRange([yearRange[0], Number(e.target.value)])}
          className="w-24 accent-rcai-accent"
        />
        <span className="text-sm text-rcai-text-primary font-mono w-10">{yearRange[1]}</span>

        <div className="w-px h-5 bg-rcai-border mx-2" />

        <span className="text-xs text-rcai-text-muted">Project:</span>
        {allProjects.map((p) => (
          <button
            key={p}
            onClick={() => toggleProjectFilter(p)}
            className={`px-2 py-0.5 rounded text-xs transition-all ${
              projectFilters.includes(p)
                ? 'bg-rcai-accent text-white'
                : 'bg-rcai-elevated text-rcai-text-secondary hover:bg-rcai-border'
            }`}
          >
            {p}
          </button>
        ))}

        <div className="w-px h-5 bg-rcai-border mx-2" />

        <span className="text-xs text-rcai-text-muted">Severity:</span>
        {allSeverities.map((s) => (
          <button
            key={s}
            onClick={() => toggleSeverityFilter(s)}
            className={`px-2 py-0.5 rounded text-xs transition-all ${
              severityFilters.includes(s)
                ? 'bg-rcai-accent text-white'
                : 'bg-rcai-elevated text-rcai-text-secondary hover:bg-rcai-border'
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      <div className="rounded-xl bg-rcai-card border border-rcai-border p-8">
        {filtered.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-sm text-rcai-text-muted">No events match the current filters</p>
          </div>
        ) : (
          <svg width="100%" height="120" className="overflow-visible">
            <line x1="0" y1="60" x2="100%" y2="60" stroke="var(--rcai-border)" strokeWidth="2" />

            {years.map((year, i) => {
              const x = ((year - yearRange[0]) / (yearRange[1] - yearRange[0] || 1)) * 90 + 5;
              const yearEvents = filtered.filter((e) => e.year === year);
              return (
                <g key={year}>
                  <text x={`${x}%`} y="50" textAnchor="middle" fill="var(--rcai-text-muted)" fontSize="11" fontFamily="JetBrains Mono">
                    {year}
                  </text>
                  {yearEvents.map((e, j) => {
                    const cy = 60 - (j * 20);
                    const isHovered = hovered === `${year}-${j}`;
                    return (
                      <g key={e.id || `${year}-${j}`}>
                        <circle
                          cx={`${x}%`}
                          cy={cy}
                          r={isHovered ? getDotSize(e) + 4 : getDotSize(e)}
                          fill={colorMap[e.severity] || '#475569'}
                          stroke={isHovered ? '#F1F5F9' : 'var(--rcai-bg)'}
                          strokeWidth={isHovered ? 3 : 2}
                          className="cursor-pointer transition-all duration-150"
                          onClick={() => setSelected(e)}
                          onMouseEnter={() => setHovered(`${year}-${j}`)}
                          onMouseLeave={() => setHovered(null)}
                        />
                        {isHovered && (
                          <g>
                            <rect
                              x={`calc(${x}% - 70px)`}
                              y={cy - 45}
                              width="140"
                              height="36"
                              rx="4"
                              fill="var(--rcai-elevated)"
                              stroke="var(--rcai-border)"
                            />
                            <text
                              x={`${x}%`}
                              y={cy - 30}
                              textAnchor="middle"
                              fill="var(--rcai-text-primary)"
                              fontSize="10"
                              fontFamily="JetBrains Mono"
                            >
                              {e.id || 'N/A'}
                            </text>
                            <text
                              x={`${x}%`}
                              y={cy - 18}
                              textAnchor="middle"
                              fill="var(--rcai-text-secondary)"
                              fontSize="9"
                            >
                              {e.severity} | {e.cause || e.root_cause || ''}
                            </text>
                          </g>
                        )}
                      </g>
                    );
                  })}
                </g>
              );
            })}
          </svg>
        )}
      </div>

      <AnimatePresence>
        {selected && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="rounded-xl bg-rcai-card border border-rcai-border p-4"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-3">
                <h3 className="font-display text-lg font-semibold text-rcai-text-primary">{selected.id}</h3>
                <SeverityBadge severity={selected.severity} />
              </div>
              <span className="text-sm text-rcai-text-muted" style={{ color: projectColors[selected.project] || '#94A3B8' }}>
                {selected.project}
              </span>
            </div>
            <p className="text-sm text-rcai-text-secondary mb-2">{selected.desc || selected.summary || ''}</p>
            <p className="text-xs text-rcai-text-muted mb-3">Root Cause: {selected.cause || selected.root_cause || 'N/A'}</p>
            <button
              onClick={() => { if (selected?.analysis_id) setCurrentAnalysisId(selected.analysis_id); navigate('/security'); }}
              className="bg-rcai-accent hover:bg-blue-500 text-white rounded-lg px-4 py-1.5 text-xs transition-all"
            >
              View Full Analysis
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {insights.length > 0 && (
        <div>
          <h3 className="font-display text-sm font-semibold text-rcai-text-primary mb-3">Insights</h3>
          <div className="grid grid-cols-2 gap-4">
            {insights.map((insight, i) => (
              <div key={i} className="rounded-xl bg-rcai-card border border-rcai-border p-3">
                <div className="flex items-start gap-2">
                  <span className="text-xs text-rcai-accent mt-0.5">{"\u25B6"}</span>
                  <p className="text-xs text-rcai-text-secondary leading-relaxed">{insight}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
