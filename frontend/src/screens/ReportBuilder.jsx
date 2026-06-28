import { useState, useEffect } from 'react';
import { Download, FileText, FileJson, FileType } from 'lucide-react';
import { generateReport, exportReportMarkdown, exportReportPdf, getAnalysesList } from '../api/client';
import SeverityBadge from '../components/shared/SeverityBadge';
import useAppStore from '../store/useAppStore';

export default function ReportBuilder() {
  const [analyses, setAnalyses] = useState([]);
  const [analysisId, setAnalysisId] = useState(null);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
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

  const handleGenerate = async () => {
    if (!analysisId) return;
    setLoading(true);
    try {
      const res = await generateReport(analysisId);
      setReport(res.data);
    } catch (e) { console.error('Report generation failed', e); }
    setLoading(false);
  };

  useEffect(() => { if (analysisId) handleGenerate(); }, [analysisId]);

  const handleExportJSON = () => {
    if (!report) return;
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rcai-report-${analysisId}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportMarkdown = async () => {
    try {
      const res = await exportReportMarkdown(analysisId);
      const blob = new Blob([res.data], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `rcai-report-${analysisId}.md`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) { console.error('Markdown export failed', e); }
  };

  const handleExportPDF = async () => {
    try {
      const res = await exportReportPdf(analysisId);
      const blob = new Blob([res.data], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `rcai-report-${analysisId}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) { console.error('PDF export failed', e); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <select
          value={analysisId || ''}
          onChange={(e) => { const id = Number(e.target.value); setAnalysisId(id); setCurrentAnalysisId(id); }}
          aria-label="Select analysis"
          className="bg-rcai-elevated border border-rcai-border text-rcai-text-primary text-sm rounded-lg px-3 py-1.5 max-w-64"
        >
          {analyses.length === 0 && <option value="">No analyses</option>}
          {analyses.map((a) => (
            <option key={a.id} value={a.id}>
              {a.file_name || `Analysis #${a.id}`} — {a.root_cause || a.severity || a.status}
            </option>
          ))}
        </select>
        <div className="flex gap-2">
          <button
            onClick={handleExportJSON}
            disabled={!report}
            className="bg-rcai-accent hover:bg-blue-500 text-white rounded-lg px-4 py-1.5 text-sm transition-all flex items-center gap-2 disabled:opacity-50"
          >
            <FileJson size={16} /> Export JSON
          </button>
          <button
            onClick={handleExportMarkdown}
            disabled={!report}
            className="border border-rcai-border hover:bg-rcai-elevated text-rcai-text-secondary rounded-lg px-4 py-1.5 text-sm transition-all flex items-center gap-2 disabled:opacity-50"
          >
            <FileType size={16} /> Export MD
          </button>
          <button
            onClick={handleExportPDF}
            disabled={!report}
            className="bg-rcai-danger hover:bg-red-500 text-white rounded-lg px-4 py-1.5 text-sm transition-all flex items-center gap-2 disabled:opacity-50"
          >
            <Download size={16} /> Export PDF
          </button>
        </div>
      </div>

      {loading && <div className="text-sm text-rcai-text-secondary">Generating report...</div>}

      {!analysisId && (
        <div className="rounded-xl bg-rcai-card border border-rcai-border p-6 text-center">
          <p className="text-rcai-text-secondary">No analyses available. Run an analysis first.</p>
        </div>
      )}

      {report && (
        <div className="rounded-xl bg-rcai-card border border-rcai-border p-4">
          <div className="flex items-center gap-3 mb-4">
            <FileText size={20} className="text-rcai-accent" />
            <h3 className="font-display text-lg font-semibold text-rcai-text-primary">RCA Report</h3>
          </div>

          {report.analysis && (
            <div className="grid grid-cols-2 gap-4 text-sm mb-4">
              <div>
                <span className="text-rcai-text-muted">Root Cause: </span>
                <span className="text-rcai-text-primary">{report.analysis.root_cause || 'Unknown'}</span>
              </div>
              <div>
                <span className="text-rcai-text-muted">Severity: </span>
                <SeverityBadge severity={report.analysis.severity || 'Info'} />
              </div>
              <div>
                <span className="text-rcai-text-muted">CVSS Score: </span>
                <span className="text-rcai-text-primary">{report.analysis.cvss_score || 'N/A'}</span>
              </div>
              <div>
                <span className="text-rcai-text-muted">CVE ID: </span>
                <span className="text-rcai-text-primary">{report.analysis.cve_id || 'None'}</span>
              </div>
            </div>
          )}

          {report.stages && (
            <div>
              <h4 className="text-sm font-semibold text-rcai-text-primary mb-2">Pipeline Stages</h4>
              <div className="space-y-1">
                {report.stages.map((stage, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs text-rcai-text-secondary">
                    <span className={`w-1.5 h-1.5 rounded-full ${
                      stage.status === 'complete' ? 'bg-rcai-success' : 'bg-rcai-text-muted'
                    }`} />
                    <span className="font-display">{stage.stage_name}</span>
                    <span className="text-rcai-text-muted"> - {stage.status}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
