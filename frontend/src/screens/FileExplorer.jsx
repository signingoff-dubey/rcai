import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import MonacoEditor from '@monaco-editor/react';
import {
  Upload, File, Folder, FileType, FileCode, ChevronRight, ChevronDown,
  Play, Eye, Link2, Trash2, Copy, Search, AlertCircle, Download, FolderOpen, X,
  FileText, Network, Shield, Bug
} from 'lucide-react';
import { getFileTree, uploadFiles, getFileMetadata, analyseBinary, getFileContent, getProjects, deleteFile, getFolderChildren, getFileExplanation } from '../api/client';
import SeverityBadge from '../components/shared/SeverityBadge';
import { formatBytes } from '../utils/formatters';
import useAppStore from '../store/useAppStore';

const typeIcons = {
  folder: Folder,
  ruby: FileCode,
  lua: FileCode,
  binary: FileType,
  text: File,
};

const fileLanguageMap = {
  ruby: 'ruby',
  lua: 'lua',
  text: 'plaintext',
};

function LogsModal({ file, onClose }) {
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [isBinary, setIsBinary] = useState(false);

  useEffect(() => {
    if (!file?.id) return;
    setLoading(true);
    getFileContent(file.id).then((res) => {
      const data = res.data;
      if (data.content) {
        setContent(data.content);
        setIsBinary(false);
      } else if (data.binary) {
        setIsBinary(true);
        setContent('[Binary file — raw contents not displayable]\n\nFile: ' + (file?.name || 'N/A'));
      } else {
        setContent('No content available');
      }
    }).catch(() => {
      setContent('Error loading file content');
    }).finally(() => setLoading(false));
  }, [file?.id]);

  const lang = fileLanguageMap[file?.fileType] || 'plaintext';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div className="bg-rcai-card border border-rcai-border rounded-xl w-4/5 h-4/5 flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-rcai-border">
          <div className="flex items-center gap-2">
            <FileText size={16} className="text-rcai-accent" />
            <h3 className="font-display text-sm font-semibold text-rcai-text-primary">{file?.name}</h3>
            {isBinary && <span className="text-xs bg-rcai-warning/20 text-rcai-warning px-2 py-0.5 rounded">BINARY</span>}
          </div>
          <button onClick={onClose} className="text-rcai-text-muted hover:text-rcai-text-primary transition-colors">
            <X size={18} />
          </button>
        </div>
        <div className="flex-1 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <p className="text-sm text-rcai-text-muted">Loading...</p>
            </div>
          ) : isBinary ? (
            <div className="flex items-center justify-center h-full p-8">
              <div className="text-center">
                <FileCode size={48} className="mx-auto mb-4 text-rcai-text-muted" />
                <p className="text-rcai-text-secondary mb-2">Binary file — raw view not available</p>
                <p className="text-xs text-rcai-text-muted">Size: {formatBytes(file?.size || 0)}</p>
              </div>
            </div>
          ) : (
            <MonacoEditor
              height="100%"
              defaultLanguage={lang}
              theme="vs-dark"
              value={content}
              options={{ readOnly: true, minimap: { enabled: false }, fontSize: 12, wordWrap: 'on' }}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function ELFMetadataPanel({ metadata, onAnalyse, onDelete }) {
  const navigate = useNavigate();
  const elf = metadata.elf_metadata;
  const analysis = metadata.analysis;
  const [showLogs, setShowLogs] = useState(false);
  const [explanation, setExplanation] = useState(null);
  const [loadingExplanation, setLoadingExplanation] = useState(false);
  const [analysing, setAnalysing] = useState(false);
  const setCurrentAnalysisId = useAppStore((s) => s.setCurrentAnalysisId);

  const handleAnalyseClick = async () => {
    if (analysing) return;
    setAnalysing(true);
    try {
      const res = await analyseBinary(metadata.id);
      const analysisId = res.data?.analysis_id;
      if (analysisId) {
        setCurrentAnalysisId(analysisId);
        setTimeout(() => navigate('/pipeline'), 300);
      }
    } catch {}
    setAnalysing(false);
  };

  return (
    <div className="space-y-4 w-full">
      {showLogs && <LogsModal file={metadata} onClose={() => setShowLogs(false)} />}
      <div className="flex items-center gap-2">
        <FileType size={20} className="text-rcai-accent" />
        <h3 className="font-display text-lg font-semibold text-rcai-text-primary">{metadata.name}</h3>
        {analysis?.severity && <SeverityBadge severity={analysis.severity} />}
        {metadata.is_new === 1 && (
          <span className="text-xs bg-rcai-accent/20 text-rcai-accent px-2 py-0.5 rounded font-semibold">NEW</span>
        )}
      </div>
      <div className="text-xs text-rcai-text-muted">{metadata.project_name} / {metadata.folder_name || ''}</div>

      <div className="rounded-xl bg-rcai-bg border border-rcai-border p-4">
        <h4 className="text-xs font-semibold text-rcai-text-muted uppercase tracking-wider mb-3">ELF Metadata</h4>
        <div className="grid grid-cols-2 gap-y-3 text-sm">
          <span className="text-rcai-text-muted">Architecture</span>
          <span className="text-rcai-text-primary font-mono">{elf?.architecture || 'N/A'}</span>
          <span className="text-rcai-text-muted">Class</span>
          <span className="text-rcai-text-primary font-mono">{elf?.class || 'N/A'}</span>
          <span className="text-rcai-text-muted">Endianness</span>
          <span className="text-rcai-text-primary font-mono">{elf?.endianness || 'N/A'}</span>
          <span className="text-rcai-text-muted">Entry Point</span>
          <span className="text-rcai-text-primary font-mono">{elf?.entry_point || 'N/A'}</span>
          <span className="text-rcai-text-muted">Debug Symbols</span>
          <span className={`text-xs font-semibold px-2 py-0.5 rounded ${elf?.debug_symbols ? 'bg-rcai-success text-white' : 'bg-rcai-text-muted text-white'}`}>
            {elf?.debug_symbols ? 'YES' : 'NO'}
          </span>
          <span className="text-rcai-text-muted">Linked Libraries</span>
          <span className="text-rcai-text-primary font-mono text-xs">{elf?.linked_libraries?.join(', ') || 'None'}</span>
        </div>
      </div>

      {analysis && (
        <div className="rounded-xl bg-rcai-bg border border-rcai-border p-4">
          <h4 className="text-xs font-semibold text-rcai-text-muted uppercase tracking-wider mb-3">Analysis Results</h4>
          <div className="grid grid-cols-2 gap-y-3 text-sm">
            <span className="text-rcai-text-muted">Root Cause</span>
            <span className="text-rcai-text-primary">{analysis.root_cause || 'N/A'}</span>
            <span className="text-rcai-text-muted">CVSS Score</span>
            <span className="text-rcai-text-primary">{analysis.cvss_score || 'N/A'}</span>
            <span className="text-rcai-text-muted">CVE ID</span>
            <span className="text-rcai-accent">{analysis.cve_id || 'None'}</span>
            <span className="text-rcai-text-muted">Confidence</span>
            <span className="text-rcai-text-primary">{analysis.confidence ? `${Math.round(analysis.confidence * 100)}%` : 'N/A'}</span>
          </div>
          <div className="flex gap-2 mt-4">
            <button onClick={() => { setCurrentAnalysisId(analysis.id); navigate('/pipeline'); }} className="border border-rcai-border hover:bg-rcai-elevated text-rcai-text-secondary rounded-lg px-3 py-1.5 text-xs transition-all flex items-center gap-1">
              <Network size={12} /> Pipeline
            </button>
            <button onClick={() => { setCurrentAnalysisId(analysis.id); navigate('/security'); }} className="border border-rcai-border hover:bg-rcai-elevated text-rcai-text-secondary rounded-lg px-3 py-1.5 text-xs transition-all flex items-center gap-1">
              <Shield size={12} /> Security Intel
            </button>
            <button onClick={() => { setCurrentAnalysisId(analysis.id); navigate('/exploit'); }} className="border border-rcai-border hover:bg-rcai-elevated text-rcai-text-secondary rounded-lg px-3 py-1.5 text-xs transition-all flex items-center gap-1">
              <Bug size={12} /> Exploit Lab
            </button>
            <button onClick={() => { setCurrentAnalysisId(analysis.id); navigate('/report'); }} className="border border-rcai-border hover:bg-rcai-elevated text-rcai-text-secondary rounded-lg px-3 py-1.5 text-xs transition-all flex items-center gap-1">
              <FileText size={12} /> Report
            </button>
          </div>
        </div>
      )}

      <div className="flex gap-3">
        <button onClick={() => setShowLogs(true)} className="border border-rcai-border hover:bg-rcai-elevated text-rcai-text-secondary rounded-lg px-4 py-2 text-sm transition-all flex items-center gap-2">
          <Eye size={14} /> View
        </button>
        <button onClick={handleAnalyseClick} disabled={analysing} className="bg-rcai-accent hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg px-4 py-2 text-sm transition-all flex items-center gap-2">
          <Play size={14} /> {analysing ? 'Analysing...' : 'Analyse'}
        </button>
        <button onClick={() => onDelete?.(metadata)} className="border border-rcai-border hover:bg-rcai-elevated text-rcai-danger hover:text-red-400 rounded-lg px-4 py-2 text-sm transition-all flex items-center gap-2">
          <Trash2 size={14} /> Delete
        </button>
      </div>
      {explanation && (
        <div className="rounded-xl bg-rcai-bg border border-rcai-border p-4">
          <h4 className="text-xs font-semibold text-rcai-text-muted uppercase tracking-wider mb-2">AI Explanation</h4>
          <p className="text-sm text-rcai-text-primary leading-relaxed">{explanation}</p>
        </div>
      )}
    </div>
  );
}

function PocFilePanel({ file, metadata, onPairBinary, onAnalyse, onDelete }) {
  const navigate = useNavigate();
  const analysis = metadata?.analysis;
  const lang = fileLanguageMap[file.fileType] || 'plaintext';
  const [content, setContent] = useState('');
  const [loadingContent, setLoadingContent] = useState(true);
  const [showLogs, setShowLogs] = useState(false);
  const [analysing, setAnalysing] = useState(false);
  const setCurrentAnalysisId = useAppStore((s) => s.setCurrentAnalysisId);

  useEffect(() => {
    if (!file.id) return;
    setLoadingContent(true);
    getFileContent(file.id).then((res) => {
      const data = res.data;
      if (data.content) {
        setContent(data.content);
      } else {
        setContent(`# ${file.name}\n# Content not displayable\n# Size: ${formatBytes(file.size)}`);
      }
    }).catch(() => {
      setContent(`# ${file.name}\n# Could not load file content\n`);
    }).finally(() => setLoadingContent(false));
  }, [file.id]);

  const handleAnalyseClick = async () => {
    if (analysing) return;
    setAnalysing(true);
    try {
      const res = await analyseBinary(file.id);
      const analysisId = res.data?.analysis_id;
      if (analysisId) {
        setCurrentAnalysisId(analysisId);
        setTimeout(() => navigate('/pipeline'), 300);
      }
    } catch {}
    setAnalysing(false);
  };

  return (
    <div className="space-y-4 w-full">
      {showLogs && <LogsModal file={file} onClose={() => setShowLogs(false)} />}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileCode size={20} className="text-rcai-accent" />
          <h3 className="font-display text-lg font-semibold text-rcai-text-primary">{file.name}</h3>
          {file.is_new === 1 && (
            <span className="text-xs bg-rcai-accent/20 text-rcai-accent px-2 py-0.5 rounded font-semibold">NEW</span>
          )}
        </div>
        <span className="text-xs text-rcai-text-muted">{formatBytes(file.size)}</span>
      </div>
      <div className="text-xs text-rcai-text-muted">{file.project_name} / {file.folder_name || ''}</div>

      <div className="bg-rcai-warning/10 border border-rcai-warning/30 rounded-lg p-3 flex items-center gap-2">
        <AlertCircle size={14} className="text-rcai-warning" />
        <span className="text-xs text-rcai-warning">Crash trigger file from {file.project_name || 'the'} crash corpus</span>
      </div>

      {loadingContent ? (
        <div className="h-64 rounded-lg border border-rcai-border flex items-center justify-center">
          <p className="text-sm text-rcai-text-muted">Loading file content...</p>
        </div>
      ) : (
        <div className="h-64 rounded-lg overflow-hidden border border-rcai-border">
          <MonacoEditor
            height="100%"
            defaultLanguage={lang}
            theme="vs-dark"
            value={content}
            options={{ readOnly: true, minimap: { enabled: false }, fontSize: 12 }}
          />
        </div>
      )}

      <div className="flex gap-3">
        <button onClick={() => setShowLogs(true)} className="border border-rcai-border hover:bg-rcai-elevated text-rcai-text-secondary rounded-lg px-4 py-2 text-sm transition-all flex items-center gap-2">
          <Eye size={14} /> View
        </button>
        <button onClick={handleAnalyseClick} disabled={analysing} className="bg-rcai-accent hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg px-4 py-2 text-sm transition-all flex items-center gap-2">
          <Play size={14} /> {analysing ? 'Analysing...' : 'Analyse'}
        </button>
        <button onClick={() => onDelete?.(file)} className="border border-rcai-border hover:bg-rcai-elevated text-rcai-danger hover:text-red-400 rounded-lg px-4 py-2 text-sm transition-all flex items-center gap-2">
          <Trash2 size={14} /> Delete
        </button>
      </div>
    </div>
  );
}

function FileDetail({ file, metadata, onPairBinary, onAnalyse, onDelete }) {
  if (file.fileType === 'binary') {
    return <ELFMetadataPanel metadata={metadata || file} onAnalyse={onAnalyse} onDelete={onDelete} />;
  }
  if (['ruby', 'lua', 'text', 'python'].includes(file.fileType)) {
    return <PocFilePanel file={file} metadata={metadata} onPairBinary={onPairBinary} onAnalyse={onAnalyse} onDelete={onDelete} />;
  }
  return (
    <div className="w-full">
      <div className="flex items-center gap-2 mb-4">
        <Folder size={20} className="text-rcai-accent" />
        <h3 className="font-display text-lg font-semibold text-rcai-text-primary">{file.name}</h3>
        {file.is_new === 1 && (
          <span className="text-xs bg-rcai-accent/20 text-rcai-accent px-2 py-0.5 rounded font-semibold">NEW</span>
        )}
      </div>
      <div className="text-xs text-rcai-text-muted mb-4">{file.project_name} / {file.folder_name || ''}</div>
      <div className="grid grid-cols-2 gap-4 text-sm">
        <div className="text-rcai-text-muted">Type</div>
        <div className="text-rcai-text-secondary">{file.fileType}</div>
        <div className="text-rcai-text-muted">Size</div>
        <div className="text-rcai-text-secondary">{formatBytes(file.size)}</div>
        <div className="text-rcai-text-muted">Status</div>
        <div className="text-rcai-text-secondary">
          {file.is_new === 1 ? 'New (unseen)' : file.analysed ? 'Analysed' : 'Pending'}
        </div>
      </div>
    </div>
  );
}

export default function FileExplorer() {
  const navigate = useNavigate();
  const [files, setFiles] = useState([]);
  const [projects, setProjects] = useState([]);
  const [selected, setSelected] = useState(null);
  const [metadata, setMetadata] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [expandedProjects, setExpandedProjects] = useState({});
  const [expandedFolders, setExpandedFolders] = useState({});
  const [contextMenu, setContextMenu] = useState(null);
  const [analysing, setAnalysing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState('');
  const fileInputRef = useRef(null);
  const cmRef = useRef(null);
  const setCurrentAnalysisId = useAppStore((s) => s.setCurrentAnalysisId);

  const refreshData = useCallback(() => {
    getFileTree().then((res) => setFiles(res.data || [])).catch(() => {});
    getProjects().then((res) => setProjects(res.data || [])).catch(() => {});
  }, []);

  useEffect(() => { refreshData(); }, [refreshData]);

  useEffect(() => {
    if (!selected) { setMetadata(null); return; }
    if (['binary', 'ruby', 'lua', 'text', 'python'].includes(selected.fileType)) {
      getFileMetadata(selected.id).then((res) => setMetadata(res.data)).catch(() => setMetadata(null));
    } else {
      setMetadata(null);
    }
  }, [selected]);

  useEffect(() => {
    const handleClick = () => setContextMenu(null);
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      await uploadFiles(formData);
      refreshData();
    } catch {}
    setUploading(false);
  };

  const handleDelete = async (file) => {
    setContextMenu(null);
    setSelected(null);
    try {
      await deleteFile(file.id);
      refreshData();
    } catch {}
  };

  const handleCopyPath = (file) => {
    navigator.clipboard.writeText(file.path || '');
    setContextMenu(null);
  };

  const handleAnalyse = async (file) => {
    setContextMenu(null);
    setSelected(file);
    setAnalysing(true);
    setAnalysisProgress('Running analysis pipeline...');
    try {
      const res = await analyseBinary(file.id);
      const analysisId = res.data?.analysis_id;
      if (analysisId) setCurrentAnalysisId(analysisId);
      setAnalysisProgress(`Complete: ${res.data.root_cause || 'analysed'}`);
      refreshData();
      const metaRes = await getFileMetadata(file.id);
      setMetadata(metaRes.data);
    } catch {
      setAnalysisProgress('Analysis failed');
    }
    setTimeout(() => { setAnalysing(false); setAnalysisProgress(''); }, 1500);
  };

  const handleContextMenu = useCallback((e, file) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, file });
  }, []);

  const toggleProject = (projectId) => {
    setExpandedProjects((prev) => ({ ...prev, [projectId]: !prev[projectId] }));
  };

  const toggleFolder = (folderKey) => {
    setExpandedFolders((prev) => ({ ...prev, [folderKey]: !prev[folderKey] }));
  };

  const filesByProject = {};
  files.forEach((f) => {
    const key = f.project_name || 'Unknown';
    if (!filesByProject[key]) filesByProject[key] = [];
    filesByProject[key].push(f);
  });

  const filesByProjectAndFolder = {};
  Object.entries(filesByProject).forEach(([proj, projFiles]) => {
    const folders = {};
    projFiles.forEach((f) => {
      const folder = f.folder_name || '__root__';
      if (!folders[folder]) folders[folder] = [];
      folders[folder].push(f);
    });
    filesByProjectAndFolder[proj] = folders;
  });

  const selectedFile = selected;

  const handlePairBinary = useCallback((pocFile) => {
    const binaryInProject = files.find(
      (f) => f.project_name === pocFile.project_name && f.fileType === 'binary'
    );
    if (binaryInProject) {
      setSelected(binaryInProject);
    } else {
      alert(`No binary found in project "${pocFile.project_name}" to pair with.`);
    }
  }, [files]);

  return (
    <div className="flex gap-4 h-[calc(100vh-8rem)]">
      <div className="w-72 shrink-0 flex flex-col gap-4">
        <div
          onClick={() => fileInputRef.current?.click()}
          className="rounded-xl bg-rcai-card border-2 border-dashed border-rcai-border p-6 text-center cursor-pointer hover:border-rcai-accent/50 transition-all"
        >
          <Upload size={24} className="mx-auto mb-2 text-rcai-text-secondary" />
          <p className="text-sm text-rcai-text-secondary">Drop dataset folder or .zip here</p>
          {uploading && (
            <div className="mt-2 h-1 bg-rcai-border rounded overflow-hidden">
              <div className="h-full bg-rcai-accent rounded animate-pulse" style={{ width: '60%' }} />
            </div>
          )}
        </div>
        <input ref={fileInputRef} type="file" className="hidden" accept=".zip,.rb,.lua,.txt,.bin,.six,.elf,.so" onChange={handleUpload} />

        <div className="flex-1 rounded-xl bg-rcai-card border border-rcai-border p-2 overflow-y-auto">
          {projects.length === 0 && files.length === 0 && (
            <p className="text-sm text-rcai-text-muted p-2">No files. Upload a dataset.</p>
          )}

          {Object.entries(filesByProjectAndFolder).map(([projectName, folders]) => {
            const projectInfo = projects.find((p) => p.name === projectName);
            const projectId = projectInfo?.id;
            const isExpanded = expandedProjects[projectName] !== false;
            return (
              <div key={projectName}>
                <div
                  onClick={() => toggleProject(projectName)}
                  className="flex items-center gap-2 px-2 py-1.5 rounded text-sm cursor-pointer transition-colors hover:bg-rcai-elevated text-rcai-text-primary"
                >
                  {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  <FolderOpen size={16} className="text-rcai-accent" />
                  <span className="flex-1 truncate font-semibold">{projectName}</span>
                  {projectInfo && projectInfo.new_count > 0 && (
                    <span className="text-xs bg-rcai-accent/20 text-rcai-accent px-1.5 py-0.5 rounded font-semibold">{projectInfo.new_count} new</span>
                  )}
                  <span className="text-xs text-rcai-text-muted">{projectInfo?.file_count || Object.values(folders).flat().length}</span>
                </div>

                {isExpanded && (
                  <div className="ml-4">
                    {Object.entries(folders).map(([folderName, folderFiles]) => {
                      const folderKey = `${projectName}:${folderName}`;
                      const isFolderExpanded = expandedFolders[folderKey] !== false;
                      const folderNewCount = folderFiles.filter((f) => f.is_new === 1).length;
                      return (
                        <div key={folderKey}>
                          <div
                            onClick={() => toggleFolder(folderKey)}
                            className="flex items-center gap-2 px-2 py-1 rounded text-xs cursor-pointer transition-colors hover:bg-rcai-elevated text-rcai-text-secondary"
                          >
                            {isFolderExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                            <Folder size={14} />
                            <span className="flex-1 truncate">{folderName === '__root__' ? 'Files' : folderName}</span>
                            {folderNewCount > 0 && (
                              <span className="text-xs bg-rcai-accent/20 text-rcai-accent px-1 font-semibold">{folderNewCount}</span>
                            )}
                          </div>
                          {isFolderExpanded && (
                            <div className="ml-4">
                              {folderFiles.map((file) => (
                                <div
                                  key={file.id}
                                  onClick={() => setSelected(file)}
                                  onContextMenu={(e) => handleContextMenu(e, file)}
                                  className={`flex items-center gap-2 px-2 py-1 rounded text-xs cursor-pointer transition-colors ${
                                    selected?.id === file.id
                                      ? 'bg-rcai-elevated text-rcai-text-primary'
                                      : 'text-rcai-text-secondary hover:bg-rcai-elevated'
                                  }`}
                                >
                                  {React.createElement(typeIcons[file.fileType] || File, { size: 14 })}
                                  <span className="flex-1 truncate">{file.name}</span>
                                  {file.is_new === 1 && (
                                    <span className="text-xxs bg-rcai-accent/20 text-rcai-accent px-1 font-semibold" style={{ fontSize: '9px' }}>N</span>
                                  )}
                                  {file.analysed ? (
                                    <span className="text-xs text-rcai-success">{"\u25CF"}</span>
                                  ) : (
                                    <span className="text-xs text-rcai-text-muted">{"\u25CB"}</span>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {contextMenu && (
        <div
          ref={cmRef}
          style={{ position: 'fixed', left: contextMenu.x, top: contextMenu.y, zIndex: 100 }}
          className="bg-rcai-card border border-rcai-border rounded-lg shadow-xl py-1 w-40"
        >
          {contextMenu.file.fileType === 'binary' && (
            <button
              onClick={() => handleAnalyse(contextMenu.file)}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-rcai-text-secondary hover:bg-rcai-elevated hover:text-rcai-text-primary transition-colors"
            >
              <Play size={14} /> Analyse
            </button>
          )}
          <button
            onClick={() => handleDelete(contextMenu.file)}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-rcai-danger hover:bg-rcai-elevated transition-colors"
          >
            <Trash2 size={14} /> Delete
          </button>
          <button
            onClick={() => handleCopyPath(contextMenu.file)}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-rcai-text-secondary hover:bg-rcai-elevated hover:text-rcai-text-primary transition-colors"
          >
            <Copy size={14} /> Copy Path
          </button>
        </div>
      )}

      <div className="flex-1 rounded-xl bg-rcai-card border border-rcai-border p-6 overflow-y-auto">
        {analysing && (
          <div className="mb-4 rounded-xl bg-rcai-bg border border-rcai-border p-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-2 h-2 rounded-full bg-rcai-accent animate-pulse" />
              <span className="text-sm text-rcai-text-secondary">{analysisProgress}</span>
            </div>
            <div className="h-2 bg-rcai-border rounded overflow-hidden">
              <div className="h-full bg-rcai-accent rounded animate-pulse" style={{ width: '40%' }} />
            </div>
          </div>
        )}

        {!selected ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-rcai-text-secondary">Select a file from the left panel</p>
          </div>
        ) : selectedFile.fileType === 'folder' ? (
          <div className="space-y-4">
            <h3 className="font-display text-lg font-semibold text-rcai-text-primary">
              <Folder size={20} className="inline mr-2 text-rcai-accent" />
              {selectedFile.name}
            </h3>
            <div className="grid grid-cols-3 gap-4 w-full">
              {files.filter((f) => f.project_id === selectedFile.id).map((child) => {
                if (child.id === selectedFile.id) return null;
                const CIcon = typeIcons[child.fileType] || File;
                return (
                  <div
                    key={child.id}
                    onClick={() => setSelected(child)}
                    className="rounded-xl bg-rcai-bg border border-rcai-border p-4 cursor-pointer hover:border-rcai-accent/50 transition-all"
                  >
                    <CIcon size={20} className="text-rcai-accent mb-2" />
                    <p className="text-sm text-rcai-text-primary truncate">{child.name}</p>
                    <div className="flex items-center gap-2 mt-1">
                      {child.is_new === 1 && (
                        <span className="text-xs bg-rcai-accent/20 text-rcai-accent px-1.5 py-0.5 rounded font-semibold">NEW</span>
                      )}
                      <span className={`text-xs px-2 py-0.5 rounded ${
                        child.analysed ? 'bg-rcai-success/20 text-rcai-success' : 'bg-rcai-text-muted/20 text-rcai-text-muted'
                      }`}>
                        {child.analysed ? 'Analysed' : 'Pending'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <FileDetail file={selected} metadata={metadata} onPairBinary={handlePairBinary} onAnalyse={() => handleAnalyse(selected)} onDelete={handleDelete} />
        )}
      </div>
    </div>
  );
}