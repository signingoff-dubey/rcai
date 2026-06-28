import { useState, useEffect, useRef } from 'react';
import { Search, Globe, Loader, ExternalLink, X } from 'lucide-react';
import SeverityBadge from '../components/shared/SeverityBadge';
import { lookupCVE, listCVEs } from '../api/client';
import axios from 'axios';

const severityFromScore = (score) => {
  if (!score && score !== 0) return 'Info';
  if (score >= 9) return 'Critical';
  if (score >= 7) return 'High';
  if (score >= 4) return 'Medium';
  if (score > 0) return 'Low';
  return 'Info';
};

export default function CVELookup() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(null);
  const [nvdDetail, setNvdDetail] = useState(null);
  const [builtCVEs, setBuiltCVEs] = useState([]);
  const debounceRef = useRef(null);

  useEffect(() => {
    listCVEs()
      .then((res) => setBuiltCVEs(res.data || []))
      .catch(() => setBuiltCVEs([]));
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query || query.trim().length < 2) {
      setResults([]);
      setSelected(null);
      setNvdDetail(null);
      return;
    }
    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await axios.get(`/api/cve/search?q=${encodeURIComponent(query.trim())}`);
        setResults(res.data?.results || []);
      } catch {
        setResults([]);
      }
      setLoading(false);
    }, 400);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query]);

  const handleSelect = async (item) => {
    setSelected(item);
    setNvdDetail(null);
    if (item.cve_id) {
      try {
        const res = await lookupCVE(item.cve_id);
        setNvdDetail(res.data);
      } catch {}
    }
  };

  const clearSearch = () => {
    setQuery('');
    setResults([]);
    setSelected(null);
    setNvdDetail(null);
  };

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-rcai-text-muted" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search CVEs by keyword, CVE ID, or project name..."
          className="w-full bg-rcai-card border border-rcai-border rounded-lg pl-10 pr-10 py-3 text-sm text-rcai-text-primary placeholder-rcai-text-muted focus:outline-none focus:border-rcai-accent transition-colors"
        />
        {query && (
          <button onClick={clearSearch} className="absolute right-3 top-1/2 -translate-y-1/2 text-rcai-text-muted hover:text-rcai-text-primary">
            <X size={16} />
          </button>
        )}
        {loading && <Loader size={16} className="absolute right-10 top-1/2 -translate-y-1/2 text-rcai-accent animate-spin" />}
      </div>

      {results.length > 0 && !selected && (
        <div className="rounded-xl bg-rcai-card border border-rcai-border overflow-hidden">
          <div className="px-3 py-2 border-b border-rcai-border text-xs text-rcai-text-muted">{results.length} result{results.length !== 1 ? 's' : ''}</div>
          {results.map((item, i) => (
            <div
              key={item.cve_id || i}
              onClick={() => handleSelect(item)}
              className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-rcai-elevated transition-colors border-b border-rcai-border last:border-0"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-display text-sm font-semibold text-rcai-text-primary">{item.cve_id || 'Local Match'}</span>
                  {item.severity && <SeverityBadge severity={item.severity} />}
                  {item.source && (
                    <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                      item.source === 'nvd' ? 'bg-rcai-success/20 text-rcai-success' : 'bg-rcai-accent/20 text-rcai-accent'
                    }`}>
                      {item.source.toUpperCase()}
                    </span>
                  )}
                </div>
                <p className="text-xs text-rcai-text-secondary mt-0.5 truncate">{item.description || item.summary || item.root_cause || item.file_name || ''}</p>
              </div>
              {(item.cvss_score || item.cvss_score === 0) && (
                <span className="font-display text-lg font-bold" style={{ color: item.cvss_score >= 7 ? '#EF4444' : item.cvss_score >= 4 ? '#F59E0B' : '#10B981' }}>
                  {item.cvss_score}
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {query && !loading && results.length === 0 && (
        <div className="rounded-xl bg-rcai-card border border-rcai-border p-8 text-center">
          <Search size={32} className="mx-auto mb-3 text-rcai-text-muted" />
          <p className="text-sm text-rcai-text-secondary">No CVEs found for "{query}"</p>
          <p className="text-xs text-rcai-text-muted mt-1">Try a different keyword or CVE ID (e.g., CVE-2023-xxxx)</p>
        </div>
      )}

      {!query && !selected && (
        builtCVEs.length > 0 ? (
          <div className="rounded-xl bg-rcai-card border border-rcai-border overflow-hidden">
            <div className="px-3 py-2 border-b border-rcai-border text-xs text-rcai-text-muted flex items-center gap-2">
              <Globe size={12} /> Identified CVEs in workspace · {builtCVEs.length}
            </div>
            {builtCVEs.map((item, i) => (
              <div
                key={item.cve_id || i}
                onClick={() => handleSelect(item)}
                className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-rcai-elevated transition-colors border-b border-rcai-border last:border-0"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-display text-sm font-semibold text-rcai-text-primary">{item.cve_id}</span>
                    {item.severity && <SeverityBadge severity={item.severity} />}
                  </div>
                  <p className="text-xs text-rcai-text-secondary mt-0.5 truncate">{item.summary || item.root_cause || item.file_name || ''}</p>
                </div>
                {(item.cvss_score || item.cvss_score === 0) && (
                  <span className="font-display text-lg font-bold" style={{ color: item.cvss_score >= 7 ? '#EF4444' : item.cvss_score >= 4 ? '#F59E0B' : '#10B981' }}>
                    {item.cvss_score}
                  </span>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-xl bg-rcai-card border border-rcai-border p-8 text-center">
            <Globe size={32} className="mx-auto mb-3 text-rcai-text-muted" />
            <p className="text-sm text-rcai-text-secondary">Type a keyword or CVE ID to search</p>
            <p className="text-xs text-rcai-text-muted mt-1">Results update as you type — searches local analyses and NVD database</p>
          </div>
        )
      )}

      {selected && (
        <div className="rounded-xl bg-rcai-card border border-rcai-border p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <h3 className="font-display text-lg font-semibold text-rcai-text-primary">{selected.cve_id || 'Local Match'}</h3>
              {selected.severity && <SeverityBadge severity={selected.severity} />}
              {selected.cvss_score && (
                <span className="font-display text-sm font-bold px-2 py-0.5 rounded" style={{ background: selected.cvss_score >= 7 ? '#EF444422' : '#3B82F622', color: selected.cvss_score >= 7 ? '#EF4444' : '#3B82F6' }}>
                  {selected.cvss_score}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setSelected(null)} className="text-rcai-text-muted hover:text-rcai-text-primary transition-colors">
                <X size={18} />
              </button>
              {selected.cve_id && (
                <a href={`https://nvd.nist.gov/vuln/detail/${selected.cve_id}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-rcai-accent hover:underline">
                  <ExternalLink size={12} /> NVD
                </a>
              )}
            </div>
          </div>

          {selected.summary && (
            <p className="text-sm text-rcai-text-secondary mb-4">{selected.summary}</p>
          )}

          {nvdDetail && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                {nvdDetail.published && (
                  <>
                    <span className="text-rcai-text-muted">Published</span>
                    <span className="text-rcai-text-secondary">{new Date(nvdDetail.published).toLocaleDateString()}</span>
                  </>
                )}
                {nvdDetail.lastModified && (
                  <>
                    <span className="text-rcai-text-muted">Last Modified</span>
                    <span className="text-rcai-text-secondary">{new Date(nvdDetail.lastModified).toLocaleDateString()}</span>
                  </>
                )}
                {nvdDetail.description && (
                  <>
                    <span className="text-rcai-text-muted col-span-2">Description</span>
                    <span className="text-rcai-text-secondary col-span-2 text-xs">{nvdDetail.description}</span>
                  </>
                )}
              </div>

              {nvdDetail.references && nvdDetail.references.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-rcai-text-muted uppercase tracking-wider mb-2">References ({nvdDetail.references.length})</h4>
                  <div className="space-y-1">
                    {nvdDetail.references.slice(0, 10).map((ref, i) => (
                      <a key={i} href={ref} target="_blank" rel="noopener noreferrer" className="block text-xs text-rcai-accent hover:underline truncate">
                        {ref}
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {selected.file_name && (
            <div className="mt-4 pt-4 border-t border-rcai-border">
              <p className="text-xs text-rcai-text-muted">Matched in project: <span className="text-rcai-text-secondary">{selected.project_name} / {selected.file_name}</span></p>
              {selected.root_cause && <p className="text-xs text-rcai-text-muted mt-1">Root Cause: <span className="text-rcai-text-secondary">{selected.root_cause}</span></p>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}