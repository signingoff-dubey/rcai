import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Filter, RefreshCw, GitBranch, Shield } from 'lucide-react';
import Plot from 'react-plotly.js';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import SeverityBadge from '../components/shared/SeverityBadge';
import { getClusters } from '../api/client';
import { severityColors } from '../utils/severity';
import useAppStore from '../store/useAppStore';

const projectColorMap = {
  NASM: '#3B82F6',
  mruby: '#8B5CF6',
  Lua: '#10B981',
  libtiff: '#F59E0B',
  libsixel: '#EF4444',
};

const causeColorMap = {
  'Stack Overflow': '#EF4444',
  'Heap Buffer Overflow': '#F59E0B',
  'Use-After-Free': '#8B5CF6',
  'Type Confusion': '#3B82F6',
  'Null Pointer Dereference': '#10B981',
  'Integer Overflow': '#EC4899',
  'Out-of-Bounds Read': '#14B8A6',
  'Double Free': '#F97316',
  'Memory Leak': '#6B7280',
  'Format String Bug': '#A855F7',
};

export default function CrashClusters() {
  const navigate = useNavigate();
  const setCurrentAnalysisId = useAppStore((s) => s.setCurrentAnalysisId);
  const [clusters, setClusters] = useState([]);
  const [selected, setSelected] = useState(null);
  const [filter, setFilter] = useState('All');
  const [colorBy, setColorBy] = useState('severity');
  const [selectionRange, setSelectionRange] = useState(null);
  const [analysisMode, setAnalysisMode] = useState(null);
  const [selectedClusters, setSelectedClusters] = useState([]);
  const plotRef = useRef(null);

  const [insights, setInsights] = useState([]);

  useEffect(() => {
    getClusters().then((res) => {
      setClusters(res.data.clusters || []);
      setInsights(res.data.insights || []);
    }).catch((err) => console.error('Failed to load clusters:', err));
  }, []);

  const filtered = filter === 'All'
    ? clusters
    : clusters.filter((c) => c.project === filter);

  const getColor = (c) => {
    if (colorBy === 'severity') return severityColors[c.severity] || '#475569';
    if (colorBy === 'root_cause') return causeColorMap[c.root_cause] || '#475569';
    return projectColorMap[c.project] || '#475569';
  };

  const plotData = [{
    x: filtered.map((c) => c.tsne_x ?? 0),
    y: filtered.map((c) => c.tsne_y ?? 0),
    text: filtered.map((c) => `${c.folder_name || c.file_name || 'Crash'}<br>${c.root_cause || ''}<br>CVSS: ${c.cvss_score ?? 'N/A'}`),
    mode: 'markers',
    type: 'scatter',
    marker: {
      size: filtered.map((c) => (c.cvss_score || 5) * 3),
      color: filtered.map((c) => getColor(c)),
      line: { color: '#0A0E1A', width: 1 },
    },
    hoverinfo: 'text',
    ids: filtered.map((c) => c.id),
  }];

  const handlePlotClick = (e) => {
    if (e.points?.[0]) {
      const idx = e.points[0].pointIndex;
      const pointId = e.points[0].id;
      const found = clusters.find((c) => c.id === pointId) || clusters[idx];
      if (found) setSelected(found);
    }
  };

  const handleResetFilters = () => {
    setFilter('All');
    setColorBy('severity');
    setSelected(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        {['All', 'NASM', 'mruby', 'Lua', 'libtiff', 'libsixel'].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-xs transition-all ${
              filter === f ? 'bg-rcai-accent text-white' : 'bg-rcai-elevated text-rcai-text-secondary hover:bg-rcai-border'
            }`}
          >
            {f}
          </button>
        ))}
        <div className="w-px h-5 bg-rcai-border mx-1" />
        <span className="text-xs text-rcai-text-muted">Colour by:</span>
        {['severity', 'root_cause', 'project'].map((mode) => (
          <button
            key={mode}
            onClick={() => setColorBy(mode)}
            className={`px-2 py-1 rounded text-xs transition-all ${
              colorBy === mode ? 'bg-rcai-accent text-white' : 'text-rcai-text-secondary hover:text-rcai-text-primary'
            }`}
          >
            {mode === 'severity' ? 'Severity' : mode === 'root_cause' ? 'Root Cause' : 'Project'}
          </button>
        ))}
        <button
          onClick={handleResetFilters}
          className="flex items-center gap-1 px-2 py-1 rounded text-xs text-rcai-text-secondary hover:text-rcai-text-primary hover:bg-rcai-elevated transition-all ml-1"
        >
          <RefreshCw size={12} /> Reset
        </button>
      </div>

      {analysisMode && selectedClusters.length > 1 && (() => {
        const causes = {};
        const severities = {};
        const projects = {};
        selectedClusters.forEach((c) => {
          if (c.root_cause) causes[c.root_cause] = (causes[c.root_cause] || 0) + 1;
          if (c.severity) severities[c.severity] = (severities[c.severity] || 0) + 1;
          if (c.project) projects[c.project] = (projects[c.project] || 0) + 1;
        });
        const top = (obj) => Object.entries(obj).sort((a, b) => b[1] - a[1]);
        const scores = selectedClusters.map((c) => c.cvss_score || 0);
        const avg = scores.length ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1) : 'N/A';
        const dominantCause = top(causes)[0];
        const sharedProject = top(projects).length === 1 ? top(projects)[0][0] : null;
        return (
          <div className="rounded-xl bg-rcai-elevated border border-rcai-purple/30 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-rcai-purple animate-pulse" />
                <span className="text-sm font-display text-rcai-text-primary">Cluster Analysis · {selectedClusters.length} crashes</span>
              </div>
              <button onClick={() => { setAnalysisMode(null); setSelected(null); setSelectedClusters([]); }} className="text-xs text-rcai-text-secondary hover:text-rcai-text-primary underline">Dismiss</button>
            </div>

            <p className="text-sm text-rcai-text-secondary leading-relaxed">
              {dominantCause
                ? `${dominantCause[1]} of ${selectedClusters.length} selected crashes share the root cause "${dominantCause[0]}"${sharedProject ? `, all in ${sharedProject}` : ''}. Average CVSS ${avg}.`
                : 'Selected crashes have no common root cause.'}
            </p>

            <div className="rounded-lg bg-rcai-card border border-rcai-border p-3">
              <p className="text-xs text-rcai-text-muted mb-2">Root Cause Distribution</p>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={top(causes).map(([name, count]) => ({ name, count }))} margin={{ top: 4, right: 8, left: -20, bottom: 4 }}>
                  <XAxis dataKey="name" tick={{ fill: '#94A3B8', fontSize: 10 }} interval={0} angle={-15} textAnchor="end" height={50} />
                  <YAxis allowDecimals={false} tick={{ fill: '#94A3B8', fontSize: 10 }} />
                  <Tooltip cursor={{ fill: '#1A2235' }} contentStyle={{ background: '#111827', border: '1px solid #1E2D45', borderRadius: 8, fontSize: 12 }} />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {top(causes).map(([name], i) => (
                      <Cell key={i} fill={causeColorMap[name] || '#3B82F6'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-lg bg-rcai-card border border-rcai-border p-3">
                <p className="text-xs text-rcai-text-muted mb-1">By Root Cause</p>
                {top(causes).map(([k, v]) => (
                  <div key={k} className="flex justify-between text-xs text-rcai-text-secondary">
                    <span className="truncate mr-2">{k}</span><span>{v}</span>
                  </div>
                ))}
              </div>
              <div className="rounded-lg bg-rcai-card border border-rcai-border p-3">
                <p className="text-xs text-rcai-text-muted mb-1">By Severity</p>
                {top(severities).map(([k, v]) => (
                  <div key={k} className="flex justify-between text-xs text-rcai-text-secondary">
                    <span className="truncate mr-2" style={{ color: severityColors[k] }}>{k}</span><span>{v}</span>
                  </div>
                ))}
              </div>
              <div className="rounded-lg bg-rcai-card border border-rcai-border p-3">
                <p className="text-xs text-rcai-text-muted mb-1">By Project</p>
                {top(projects).map(([k, v]) => (
                  <div key={k} className="flex justify-between text-xs text-rcai-text-secondary">
                    <span className="truncate mr-2">{k}</span><span>{v}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );
      })()}

      <div className="relative">
        <div className="rounded-xl bg-rcai-card border border-rcai-border p-2">
          <Plot
            key={`${filter}-${colorBy}`}
            ref={plotRef}
            data={plotData}
            layout={{
              paper_bgcolor: 'var(--rcai-card)',
              plot_bgcolor: 'var(--rcai-card)',
              width: undefined,
              height: 500,
              margin: { l: 60, r: 30, t: 20, b: 55 },
              xaxis: {
                title: { text: 't-SNE dimension 1', font: { color: '#94A3B8', size: 11 } },
                showgrid: true, gridcolor: '#1E2D45', zeroline: false,
                showticklabels: true, tickfont: { color: '#94A3B8', size: 10 },
                autorange: true, showline: true, linecolor: '#1E2D45', mirror: true,
              },
              yaxis: {
                title: { text: 't-SNE dimension 2', font: { color: '#94A3B8', size: 11 } },
                showgrid: true, gridcolor: '#1E2D45', zeroline: false,
                showticklabels: true, tickfont: { color: '#94A3B8', size: 10 },
                autorange: true, scaleanchor: 'x', scaleratio: 1,
                showline: true, linecolor: '#1E2D45', mirror: true,
              },
              hovermode: 'closest',
              dragmode: 'select',
            }}
            config={{ displayModeBar: false, responsive: true, scrollZoom: true }}
            style={{ width: '100%', height: '100%' }}
            onClick={handlePlotClick}
            onSelected={(e) => {
              if (e.points && e.points.length > 1) {
                const selectedIds = e.points.map((p) => p.id).filter(Boolean);
                if (selectedIds.length > 0) {
                  const picked = clusters.filter((c) => selectedIds.includes(c.id));
                  if (picked.length > 1) {
                    setAnalysisMode(null);
                    setSelectedClusters(picked);
                    setSelected({
                      id: 'group',
                      file_name: `Cluster: ${picked.length} crashes`,
                      root_cause: [...new Set(picked.map((c) => c.root_cause))].join(', '),
                      severity: 'Info',
                      cvss_score: Math.max(...picked.map((c) => c.cvss_score || 0)),
                    });
                  }
                }
              }
            }}
          />
        </div>

        {filtered.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <p className="text-rcai-text-muted text-sm">No crash data available</p>
          </div>
        )}

        <AnimatePresence>
          {selected && (
            <motion.div
              initial={{ x: 300, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 300, opacity: 0 }}
              className="absolute top-0 right-0 w-72 rounded-xl bg-rcai-card border border-rcai-border p-4 shadow-2xl"
            >
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-display text-sm font-semibold text-rcai-text-primary">{selected.folder_name || selected.file_name || 'Crash'}</h4>
                <button onClick={() => setSelected(null)} className="text-rcai-text-secondary hover:text-rcai-text-primary">
                  <X size={16} />
                </button>
              </div>
              {selected.id !== 'group' && (
                <>
                  <SeverityBadge severity={selected.severity} />
                  <div className="mt-2 text-sm text-rcai-text-secondary space-y-1">
                    <p>Root Cause: {selected.root_cause || 'N/A'}</p>
                    <p>CVSS: {selected.cvss_score || 'N/A'}</p>
                    {selected.cve_id && <p>CVE: {selected.cve_id}</p>}
                    {selected.summary && <p className="text-xs mt-1">{selected.summary}</p>}
                  </div>
                  <div className="mt-3 flex flex-col gap-2">
                    <button
                      onClick={() => { if (selected?.id) setCurrentAnalysisId(selected.id); navigate('/pipeline'); }}
                      className="w-full flex items-center gap-2 justify-center border border-rcai-border hover:bg-rcai-elevated text-rcai-text-secondary rounded-lg px-3 py-1.5 text-xs transition-all"
                    >
                      <GitBranch size={12} /> View in Pipeline
                    </button>
                    <button
                      onClick={() => { if (selected?.id) setCurrentAnalysisId(selected.id); navigate('/security'); }}
                      className="w-full flex items-center gap-2 justify-center border border-rcai-border hover:bg-rcai-elevated text-rcai-text-secondary rounded-lg px-3 py-1.5 text-xs transition-all"
                    >
                      <Shield size={12} /> View Security Intel
                    </button>
                  </div>
                </>
              )}
              {selected.id === 'group' && (
                <>
                  <p className="text-sm text-rcai-text-secondary mb-3">{selected.root_cause}</p>
                  <p className="text-xs text-rcai-text-muted mb-3">CVSS max: {selected.cvss_score || 'N/A'}</p>
                  <button
                    onClick={() => { setAnalysisMode('cluster'); setSelected(null); }}
                    className="w-full flex items-center gap-2 justify-center bg-rcai-purple hover:bg-purple-600 text-white rounded-lg px-3 py-1.5 text-xs transition-all"
                  >
                    <GitBranch size={12} /> Analyse Cluster
                  </button>
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {filtered.length > 0 && (() => {
        const counts = {};
        filtered.forEach((c) => {
          const k = c.root_cause || 'Unknown';
          counts[k] = (counts[k] || 0) + 1;
        });
        const data = Object.entries(counts)
          .map(([name, count]) => ({ name, count }))
          .sort((a, b) => b.count - a.count);
        return (
          <div className="rounded-xl bg-rcai-card border border-rcai-border p-4">
            <p className="text-sm font-display text-rcai-text-primary mb-3">
              Root Cause Distribution {filter !== 'All' ? `· ${filter}` : ''} ({filtered.length} crashes)
            </p>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={data} margin={{ top: 4, right: 8, left: -20, bottom: 40 }}>
                <XAxis dataKey="name" tick={{ fill: '#94A3B8', fontSize: 10 }} interval={0} angle={-20} textAnchor="end" height={70} />
                <YAxis allowDecimals={false} tick={{ fill: '#94A3B8', fontSize: 10 }} />
                <Tooltip cursor={{ fill: '#1A2235' }} contentStyle={{ background: '#111827', border: '1px solid #1E2D45', borderRadius: 8, fontSize: 12 }} />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {data.map((d, i) => (
                    <Cell key={i} fill={causeColorMap[d.name] || '#3B82F6'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        );
      })()}

      <div className="grid grid-cols-3 gap-4">
        {insights.map((insight, i) => (
          <div key={i} className="rounded-xl bg-rcai-card border border-rcai-border p-3">
            <p className="text-xs text-rcai-text-secondary leading-relaxed">{insight}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
