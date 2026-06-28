import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { Plus, Save, Trash2, Pencil } from 'lucide-react';
import SeverityBadge from '../components/shared/SeverityBadge';
import { getSecurityIntel, getAnalysesList, getNotes, createNote, updateNote, deleteNote, lookupCVE } from '../api/client';
import useAppStore from '../store/useAppStore';

const cvssColor = (score) => {
  if (score >= 9) return '#EF4444';
  if (score >= 7) return '#F59E0B';
  if (score >= 4) return '#3B82F6';
  if (score > 0) return '#10B981';
  return '#8B5CF6';
};

export default function SecurityIntel() {
  const navigate = useNavigate();
  const [analyses, setAnalyses] = useState([]);
  const [analysisId, setAnalysisId] = useState(null);
  const [data, setData] = useState(null);
  const [notes, setNotes] = useState([]);
  const [newNoteText, setNewNoteText] = useState('');
  const [editNoteId, setEditNoteId] = useState(null);
  const [editNoteText, setEditNoteText] = useState('');
  const [nvd, setNvd] = useState(null);
  const [nvdLoading, setNvdLoading] = useState(false);

  const storeId = useAppStore((s) => s.currentAnalysisId);
  const setCurrentAnalysisId = useAppStore((s) => s.setCurrentAnalysisId);

  useEffect(() => {
    getAnalysesList().then((res) => {
      const list = res.data || [];
      setAnalyses(list);
      if (!analysisId) {
        if (storeId && list.some((a) => a.id === storeId)) {
          setAnalysisId(storeId);
        } else if (list.length > 0) {
          setAnalysisId(list[0].id);
        }
      }
    }).catch(() => {});
  }, [storeId]);

  useEffect(() => {
    if (!analysisId) return;
    setNvd(null);
    getSecurityIntel(analysisId).then((res) => setData(res.data)).catch(() => {});
    getNotes(analysisId).then((res) => setNotes(res.data || [])).catch(() => {});
  }, [analysisId]);

  // Fetch live NVD details (published/modified dates, references) when a CVE is linked.
  useEffect(() => {
    const cve = data?.cve_id;
    if (!cve) { setNvd(null); return; }
    setNvdLoading(true);
    lookupCVE(cve, true)
      .then((res) => setNvd(res.data))
      .catch(() => setNvd(null))
      .finally(() => setNvdLoading(false));
  }, [data?.cve_id]);

  const handleAddNote = async () => {
    if (!newNoteText.trim() || !analysisId) return;
    try {
      const res = await createNote(analysisId, newNoteText);
      setNotes((prev) => [res.data, ...prev]);
      setNewNoteText('');
    } catch {}
  };

  const handleSaveEdit = async (noteId) => {
    if (!editNoteText.trim()) return;
    try {
      const res = await updateNote(noteId, editNoteText);
      setNotes((prev) => prev.map((n) => (n.id === noteId ? res.data : n)));
      setEditNoteId(null);
      setEditNoteText('');
    } catch {}
  };

  const handleDeleteNote = async (noteId) => {
    try {
      await deleteNote(noteId);
      setNotes((prev) => prev.filter((n) => n.id !== noteId));
    } catch {}
  };

  const score = data?.cvss_score || 0;
  const color = cvssColor(score);
  const circumference = 2 * Math.PI * 54;
  const offset = circumference - (score / 10) * circumference;

  const attackChars = [
    ['Attack Vector', data?.attack_vector || 'Local'],
    ['Attack Complexity', data?.attack_complexity || 'Low'],
    ['Privileges Required', data?.privileges_required || 'None'],
    ['User Interaction', data?.user_interaction || 'None'],
    ['Scope', data?.scope || 'Unchanged'],
  ];

  const cia = data?.cia || {};
  const ciaData = [
    { name: 'Confidentiality', value: cia.confidentiality === 'High' ? 2 : cia.confidentiality === 'Low' ? 1 : 0 },
    { name: 'Integrity', value: cia.integrity === 'High' ? 2 : cia.integrity === 'Low' ? 1 : 0 },
    { name: 'Availability', value: cia.availability === 'High' ? 2 : cia.availability === 'Low' ? 1 : 0 },
  ];

  const similarVulns = data?.similar_vulnerabilities || [];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <select
          value={analysisId || ''}
          onChange={(e) => { const id = Number(e.target.value); setAnalysisId(id); setCurrentAnalysisId(id); }}
          aria-label="Select analysed crash"
          className="bg-rcai-elevated border border-rcai-border text-rcai-text-primary text-sm rounded-lg px-3 py-1.5 max-w-64"
        >
          {analyses.length === 0 && <option value="">No analyses</option>}
          {analyses.map((a) => (
            <option key={a.id} value={a.id}>
              {a.file_name || `Analysis #${a.id}`} — {a.root_cause || a.severity || a.status}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-7 space-y-4">
          <div className="rounded-xl bg-rcai-card border border-rcai-border p-6 flex flex-col items-center">
            <h3 className="font-display text-sm font-semibold text-rcai-text-primary mb-4">CVSS Score</h3>
            <svg width="140" height="140" viewBox="0 0 120 120" className="-rotate-90">
              <circle cx="60" cy="60" r="54" fill="none" stroke="var(--rcai-border)" strokeWidth="8" />
              <circle
                cx="60" cy="60" r="54"
                fill="none" stroke={color} strokeWidth="8"
                strokeDasharray={circumference}
                strokeDashoffset={offset}
                strokeLinecap="round"
              />
            </svg>
            <div className="text-center mt-2">
              <span className="font-display text-4xl font-bold text-rcai-text-primary">{score}</span>
              <div className="mt-1"><SeverityBadge severity={data?.severity || 'Info'} /></div>
            </div>
            {data?.cvss_vector && (
              <p className="text-xs text-rcai-text-muted mt-3 font-mono">{data.cvss_vector}</p>
            )}
          </div>

          <div className="rounded-xl bg-rcai-card border border-rcai-border p-4">
            <h3 className="font-display text-sm font-semibold text-rcai-text-primary mb-3">Attack Characteristics</h3>
            <table className="w-full text-sm">
              <tbody>
                {attackChars.map(([prop, val]) => (
                  <tr key={prop} className="border-b border-rcai-border last:border-0">
                    <td className="py-2 text-rcai-text-muted">{prop}</td>
                    <td className="py-2 text-rcai-text-secondary text-right">{val}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="rounded-xl bg-rcai-card border border-rcai-border p-4">
            <h3 className="font-display text-sm font-semibold text-rcai-text-primary mb-3">Affected Component</h3>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <span className="text-rcai-text-muted">Root Cause</span>
              <span className="text-rcai-text-secondary">{data?.root_cause || 'Unknown'}</span>
              <span className="text-rcai-text-muted">Severity</span>
              <span><SeverityBadge severity={data?.severity || 'Info'} /></span>
              <span className="text-rcai-text-muted">CWE</span>
              <span className="text-rcai-text-secondary">
                {data?.cwe_id ? (
                  <a href={`https://cwe.mitre.org/data/definitions/${data.cwe_id.split('-')[1]}.html`} target="_blank" rel="noopener noreferrer" className="text-rcai-accent hover:underline">
                    {data.cwe_id}: {data.cwe_description}
                  </a>
                ) : 'N/A'}
              </span>
              <span className="text-rcai-text-muted">CVE ID</span>
              <span className="text-rcai-text-secondary">{data?.cve_id || 'None'}</span>
              <span className="text-rcai-text-muted">Patch Available</span>
              {data?.cve_id ? (
                <a href={`https://nvd.nist.gov/vuln/detail/${data.cve_id}`} target="_blank" rel="noopener noreferrer" className="text-rcai-accent hover:underline">
                  Check NVD references
                </a>
              ) : (
                <span className="text-rcai-text-muted">Unknown</span>
              )}
            </div>
          </div>
        </div>

        <div className="col-span-5 space-y-4">
          <div className="rounded-xl bg-rcai-card border border-rcai-border p-4">
            <h3 className="font-display text-sm font-semibold text-rcai-text-primary mb-4">CIA Impact</h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={ciaData} layout="vertical" margin={{ left: 20 }}>
                <XAxis type="number" domain={[0, 2]} tick={{ fill: 'var(--rcai-text-secondary)', fontSize: 11 }} tickFormatter={(v) => ['None', 'Low', 'High'][v] || v} />
                <YAxis type="category" dataKey="name" tick={{ fill: 'var(--rcai-text-secondary)', fontSize: 11 }} width={120} />
                <Tooltip formatter={(v) => ['None', 'Low', 'High'][v] || v} contentStyle={{ background: '#111827', border: '1px solid #1E2D45', borderRadius: 8, fontSize: 12 }} itemStyle={{ color: '#F1F5F9' }} labelStyle={{ color: '#94A3B8' }} />
                <Bar dataKey="value" fill="#EF4444" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="rounded-xl bg-rcai-card border border-rcai-border p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-display text-sm font-semibold text-rcai-text-primary">NVD Description</h3>
              {nvdLoading && <span className="text-xs text-rcai-text-muted">Fetching NVD…</span>}
            </div>
            {data?.cve_id ? (
              <div className="space-y-3">
                <a
                  href={`https://nvd.nist.gov/vuln/detail/${data.cve_id}`}
                  target="_blank" rel="noopener noreferrer"
                  className="font-display text-sm text-rcai-accent hover:underline"
                >
                  {data.cve_id}
                </a>
                <p className="text-sm text-rcai-text-secondary">
                  {nvd?.description || data.summary || 'No description available.'}
                </p>
                {(nvd?.published || nvd?.modified) && (
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {nvd.published && (
                      <>
                        <span className="text-rcai-text-muted">Published</span>
                        <span className="text-rcai-text-secondary">{new Date(nvd.published).toLocaleDateString()}</span>
                      </>
                    )}
                    {nvd.modified && (
                      <>
                        <span className="text-rcai-text-muted">Last Modified</span>
                        <span className="text-rcai-text-secondary">{new Date(nvd.modified).toLocaleDateString()}</span>
                      </>
                    )}
                  </div>
                )}
                {nvd?.references?.length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold text-rcai-text-muted uppercase tracking-wider mb-1">References ({nvd.references.length})</h4>
                    <div className="space-y-1 max-h-32 overflow-y-auto">
                      {nvd.references.slice(0, 8).map((ref, i) => (
                        <a key={i} href={ref} target="_blank" rel="noopener noreferrer" className="block text-xs text-rcai-accent hover:underline truncate">
                          {ref}
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-rcai-text-muted">No CVE linked to this analysis.</p>
            )}
          </div>

          <div className="rounded-xl bg-rcai-card border border-rcai-border p-4">
            <h3 className="font-display text-sm font-semibold text-rcai-text-primary mb-3">Similar Vulnerabilities</h3>
            {similarVulns.length === 0 ? (
              <p className="text-sm text-rcai-text-muted">No similar vulnerabilities found.</p>
            ) : (
              <div className="space-y-2">
                {similarVulns.map((vuln) => (
                  <div
                    key={vuln.id}
                    onClick={() => { setAnalysisId(vuln.id); setCurrentAnalysisId(vuln.id); }}
                    className="flex items-center justify-between p-2 rounded-lg hover:bg-rcai-elevated cursor-pointer transition-all"
                  >
                    <div>
                      <p className="text-sm text-rcai-text-primary">{vuln.file_name || `Analysis #${vuln.id}`}</p>
                      <p className="text-xs text-rcai-text-muted">{vuln.root_cause}</p>
                    </div>
                    {vuln.severity && <SeverityBadge severity={vuln.severity} />}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex gap-3">
        {data?.cve_id && (
          <a
            href={`https://nvd.nist.gov/vuln/detail/${data.cve_id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-rcai-accent hover:bg-blue-500 text-white rounded-lg px-4 py-2 text-sm transition-all duration-200"
          >
            View on NVD
          </a>
        )}
        <button
          onClick={() => { if (analysisId) setCurrentAnalysisId(analysisId); navigate('/exploit'); }}
          className="bg-rcai-danger hover:bg-red-500 text-white rounded-lg px-4 py-2 text-sm transition-all duration-200 flex items-center gap-2"
        >
          Open in Exploit Lab
        </button>
      </div>

      <div className="rounded-xl bg-rcai-card border border-rcai-border p-4">
        <h3 className="font-display text-sm font-semibold text-rcai-text-primary mb-3">Analyst Notes</h3>
        {analysisId && (
          <div className="flex gap-2 mb-4">
            <textarea
              value={newNoteText}
              onChange={(e) => setNewNoteText(e.target.value)}
              placeholder="Add a note about this analysis..."
              className="flex-1 bg-rcai-bg border border-rcai-border rounded-lg px-3 py-2 text-sm text-rcai-text-primary placeholder-rcai-text-muted resize-none h-20"
            />
            <button onClick={handleAddNote} aria-label="Add note" className="bg-rcai-accent hover:bg-blue-500 text-white rounded-lg px-3 py-2 text-sm transition-all self-end">
              <Plus size={16} />
            </button>
          </div>
        )}
        <div className="space-y-2 max-h-48 overflow-y-auto">
          {notes.length === 0 && (
            <p className="text-sm text-rcai-text-muted">No notes yet for this analysis.</p>
          )}
          {notes.map((note) => (
            <div key={note.id} className="flex gap-2 bg-rcai-bg rounded-lg p-3">
              <div className="flex-1">
                {editNoteId === note.id ? (
                  <div className="flex gap-2">
                    <textarea
                      value={editNoteText}
                      onChange={(e) => setEditNoteText(e.target.value)}
                      className="flex-1 bg-rcai-elevated border border-rcai-border rounded px-2 py-1 text-sm text-rcai-text-primary resize-none h-16"
                    />
                    <button onClick={() => handleSaveEdit(note.id)} aria-label="Save note" className="text-rcai-accent hover:text-blue-400">
                      <Save size={14} />
                    </button>
                  </div>
                ) : (
                  <>
                    <p className="text-sm text-rcai-text-secondary whitespace-pre-wrap">{note.note}</p>
                    <p className="text-xs text-rcai-text-muted mt-1">{new Date(note.created_at).toLocaleString()}</p>
                  </>
                )}
              </div>
              <div className="flex gap-1 shrink-0">
                <button
                  onClick={() => { setEditNoteId(note.id); setEditNoteText(note.note); }}
                  aria-label="Edit note"
                  className="text-rcai-text-muted hover:text-rcai-text-secondary"
                >
                  <Pencil size={14} />
                </button>
                <button onClick={() => handleDeleteNote(note.id)} aria-label="Delete note" className="text-rcai-text-muted hover:text-rcai-danger">
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
