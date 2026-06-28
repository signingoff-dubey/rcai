import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileWarning, ShieldAlert, Zap, FolderOpen, Upload, Download, RefreshCw, Search, Activity } from 'lucide-react';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import StatCard from '../components/shared/StatCard';
import SeverityBadge from '../components/shared/SeverityBadge';
import { getDashboardSummary, batchAnalyse, getDashboardInsights } from '../api/client';
import { severityColors } from '../utils/severity';

const severityNames = ['Critical', 'High', 'Medium', 'Low', 'Info'];

export default function Dashboard() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [batchRunning, setBatchRunning] = useState(false);
  const [insights, setInsights] = useState([]);

  useEffect(() => {
    getDashboardSummary().then((res) => setData(res.data)).catch(() => {});
    getDashboardInsights().then((res) => setInsights(res.data?.insights || [])).catch(() => {});
  }, []);

  if (!data) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="rounded-xl bg-rcai-card border border-rcai-border p-4 animate-pulse">
              <div className="h-4 bg-rcai-elevated rounded w-1/3 mb-3" />
              <div className="h-8 bg-rcai-elevated rounded w-1/2 mb-2" />
              <div className="h-3 bg-rcai-elevated rounded w-2/3" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const severityDist = data.severityDistribution || {};
  const pieData = severityNames
    .filter((name) => (severityDist[name] || 0) > 0)
    .map((name) => ({ name, value: severityDist[name] || 0, color: severityColors[name] }));

  if (pieData.length === 0) {
    severityNames.forEach((name) => {
      pieData.push({ name, value: 0, color: severityColors[name] });
    });
  }

  const causeData = data.rootCauseDistribution || [];
  const topComponents = causeData.slice(0, 5);
  const recentActivity = data.recentActivity || [];
  const deltas = data.deltas || {};
  const statusBreakdown = data.statusBreakdown || {};

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 mb-2">
        <Activity size={16} className="text-rcai-success" />
        <span className="text-xs text-rcai-text-muted">
          {statusBreakdown.completed || 0} analysed &middot; {statusBreakdown.running || 0} running &middot; {statusBreakdown.pending || 0} pending &middot; {statusBreakdown.new || 0} new
        </span>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <StatCard icon={FileWarning} label="Total Crashes Analysed" value={data.totalCrashes ?? 0} delta={deltas.crashes} color="text-rcai-accent" />
        <StatCard icon={ShieldAlert} label="CVEs Identified" value={data.cvesIdentified ?? 0} delta={deltas.cves} color="text-rcai-warning" />
        <StatCard icon={Zap} label="Highest CVSS Score" value={data.highestCvss ? `${data.highestCvss}` : '\u2014'} color="text-rcai-danger" />
        <StatCard icon={FolderOpen} label="Projects in Workspace" value={data.projectsInWorkspace ?? 0} delta={deltas.projects} color="text-rcai-purple" />
      </div>

      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-5 rounded-xl bg-rcai-card border border-rcai-border p-4">
          <h3 className="font-display text-sm font-semibold text-rcai-text-primary mb-4">Crashes by Severity</h3>
          {pieData.every((d) => d.value === 0) ? (
            <p className="text-sm text-rcai-text-muted text-center py-10">No analysis data yet</p>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={90} dataKey="value" paddingAngle={3}>
                  {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="col-span-4 rounded-xl bg-rcai-card border border-rcai-border p-4">
          <h3 className="font-display text-sm font-semibold text-rcai-text-primary mb-4">Root Cause Distribution</h3>
          {causeData.length === 0 ? (
            <p className="text-sm text-rcai-text-muted text-center py-10">Run analyses to see distribution</p>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={causeData} layout="vertical" margin={{ left: 20 }}>
                <XAxis type="number" tick={{ fill: 'var(--rcai-text-secondary)', fontSize: 11 }} />
                <YAxis type="category" dataKey="cause" tick={{ fill: 'var(--rcai-text-secondary)', fontSize: 11 }} width={100} />
                <Tooltip />
                <Bar dataKey="count" fill="var(--rcai-accent)" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="col-span-3 rounded-xl bg-rcai-card border border-rcai-border p-4">
          <h3 className="font-display text-sm font-semibold text-rcai-text-primary mb-4">Top Vulnerable Components</h3>
          <div className="space-y-3">
            {topComponents.length === 0 && (
              <p className="text-sm text-rcai-text-muted">No data yet</p>
            )}
            {topComponents.map((item, i) => (
              <div key={i} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-rcai-accent" />
                  <span className="text-sm text-rcai-text-secondary">{item.cause}</span>
                </div>
                <span className="font-display text-sm text-rcai-text-primary">{item.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {insights.length > 0 && (
        <div className="rounded-xl bg-rcai-card border border-rcai-accent/20 p-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="w-2 h-2 rounded-full bg-rcai-purple animate-pulse" />
            <h3 className="font-display text-sm font-semibold text-rcai-text-primary">AI Insights</h3>
          </div>
          <div className="space-y-2">
            {insights.map((insight, i) => (
              <p key={i} className="text-sm text-rcai-text-secondary pl-4 border-l-2 border-rcai-purple/30">{insight}</p>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-7 rounded-xl bg-rcai-card border border-rcai-border p-4">
          <h3 className="font-display text-sm font-semibold text-rcai-text-primary mb-4">Recent Activity</h3>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {recentActivity.length === 0 && (
              <p className="text-sm text-rcai-text-muted">No recent activity. Upload a dataset to get started.</p>
            )}
            {recentActivity.map((item) => (
              <div
                key={item.id}
                onClick={() => navigate(`/explorer?crash=${encodeURIComponent(item.file_name || item.id)}`)}
                className="flex items-center justify-between p-2 rounded-lg hover:bg-rcai-elevated cursor-pointer transition-all duration-200"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-xs text-rcai-text-muted font-mono shrink-0">
                    {item.created_at ? new Date(item.created_at).toLocaleDateString() : ''}
                  </span>
                  <span className="text-sm text-rcai-text-primary truncate">{item.file_name || 'Unknown'}</span>
                  {item.severity && <SeverityBadge severity={item.severity} />}
                  {item.is_new === 1 && (
                    <span className="text-xs bg-rcai-accent/20 text-rcai-accent px-1.5 py-0.5 rounded font-semibold">NEW</span>
                  )}
                </div>
                <span className="text-xs text-rcai-text-secondary shrink-0 ml-2">{item.root_cause || item.status}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="col-span-5 rounded-xl bg-rcai-card border border-rcai-border p-4 space-y-3">
          <h3 className="font-display text-sm font-semibold text-rcai-text-primary mb-4">Quick Actions</h3>
          <button onClick={() => navigate('/explorer')} className="w-full bg-rcai-accent hover:bg-blue-500 text-white rounded-lg px-4 py-2 text-sm transition-all duration-200 flex items-center gap-2 justify-center">
            <Upload size={16} /> Upload Dataset
          </button>
          <button
            onClick={async () => {
              if (batchRunning) return;
              setBatchRunning(true);
              try {
                const res = await batchAnalyse();
                getDashboardSummary().then((r) => setData(r.data)).catch(() => {});
                alert(`Batch analysis complete: ${res.data.analysed} files analysed out of ${res.data.total}`);
              } catch {}
              setBatchRunning(false);
            }}
            disabled={batchRunning}
            className="w-full border border-rcai-border hover:bg-rcai-elevated text-rcai-text-secondary rounded-lg px-4 py-2 text-sm transition-all duration-200 flex items-center gap-2 justify-center disabled:opacity-50"
          >
            <RefreshCw size={16} className={batchRunning ? 'animate-spin' : ''} /> {batchRunning ? 'Analysing...' : 'Run Full Analysis'}
          </button>
          <button onClick={() => navigate('/report')} className="w-full border border-rcai-border hover:bg-rcai-elevated text-rcai-text-secondary rounded-lg px-4 py-2 text-sm transition-all duration-200 flex items-center gap-2 justify-center">
            <Download size={16} /> Export Report
          </button>
          <button onClick={() => navigate('/cve')} className="w-full border border-rcai-border hover:bg-rcai-elevated text-rcai-text-secondary rounded-lg px-4 py-2 text-sm transition-all duration-200 flex items-center gap-2 justify-center">
            <Search size={16} /> Fetch CVE Updates
          </button>
        </div>
      </div>
    </div>
  );
}
