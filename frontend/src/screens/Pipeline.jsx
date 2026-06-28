import { useState, useEffect, useCallback } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  MarkerType,
  useReactFlow,
  ReactFlowProvider,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Play, Layout as LayoutIcon, ZoomIn, ZoomOut } from 'lucide-react';
import { getPipeline, getAnalysesList, analyseBinary } from '../api/client';
import useAppStore from '../store/useAppStore';

const stageColors = {
  pending: { bg: 'var(--rcai-elevated)', dot: 'var(--rcai-text-muted)', edge: 'var(--rcai-border)' },
  running: { bg: 'var(--rcai-elevated)', dot: 'var(--rcai-accent)', edge: 'var(--rcai-accent)' },
  complete: { bg: 'var(--rcai-elevated)', dot: 'var(--rcai-success)', edge: 'var(--rcai-success)' },
  failed: { bg: 'var(--rcai-elevated)', dot: 'var(--rcai-danger)', edge: 'var(--rcai-danger)' },
};

function PipelineNode({ data }) {
  const colors = stageColors[data.status] || stageColors.pending;
  return (
    <div
      className="rounded-xl border border-rcai-border overflow-hidden cursor-pointer transition-all duration-200 hover:border-rcai-accent/50"
      style={{ background: colors.bg, width: 220 }}
    >
      <div className="flex items-center gap-2 px-3 py-2 border-b border-rcai-border">
        <span className="w-2 h-2 rounded-full" style={{ background: colors.dot }} />
        <span className="text-xs font-display text-rcai-text-secondary">Stage {data.stageNumber}</span>
      </div>
      <div className="px-3 py-2">
        <p className="text-sm font-medium text-rcai-text-primary">{data.label}</p>
        {data.summary && (
          <p className="text-xs text-rcai-text-secondary mt-1 line-clamp-2">{data.summary}</p>
        )}
      </div>
    </div>
  );
}

const nodeTypes = { pipeline: PipelineNode };

const initialNodes = [
  { id: '1', type: 'pipeline', position: { x: 0, y: 0 }, data: { label: 'Input File', stageNumber: 1, status: 'pending' } },
  { id: '2', type: 'pipeline', position: { x: 0, y: 120 }, data: { label: 'Binary Inspector', stageNumber: 2, status: 'pending' } },
  { id: '3', type: 'pipeline', position: { x: 0, y: 240 }, data: { label: 'Crash Trigger Engine', stageNumber: 3, status: 'pending' } },
  { id: '4', type: 'pipeline', position: { x: 0, y: 360 }, data: { label: 'Stack Trace Parser', stageNumber: 4, status: 'pending' } },
  { id: '5', type: 'pipeline', position: { x: 0, y: 480 }, data: { label: 'Feature Extractor', stageNumber: 5, status: 'pending' } },
  { id: '6', type: 'pipeline', position: { x: 0, y: 600 }, data: { label: 'Root Cause Classifier', stageNumber: 6, status: 'pending' } },
  { id: '7', type: 'pipeline', position: { x: 0, y: 720 }, data: { label: 'CVE Matcher', stageNumber: 7, status: 'pending' } },
  { id: '8', type: 'pipeline', position: { x: 0, y: 840 }, data: { label: 'Risk Scorer', stageNumber: 8, status: 'pending' } },
  { id: '9', type: 'pipeline', position: { x: 0, y: 960 }, data: { label: 'Output: RCA Report', stageNumber: 9, status: 'pending' } },
];

const horizontalNodes = [
  { id: '1', type: 'pipeline', position: { x: 0, y: 0 }, data: { label: 'Input File', stageNumber: 1, status: 'pending' } },
  { id: '2', type: 'pipeline', position: { x: 250, y: 0 }, data: { label: 'Binary Inspector', stageNumber: 2, status: 'pending' } },
  { id: '3', type: 'pipeline', position: { x: 500, y: 0 }, data: { label: 'Crash Trigger Engine', stageNumber: 3, status: 'pending' } },
  { id: '4', type: 'pipeline', position: { x: 750, y: 0 }, data: { label: 'Stack Trace Parser', stageNumber: 4, status: 'pending' } },
  { id: '5', type: 'pipeline', position: { x: 1000, y: 0 }, data: { label: 'Feature Extractor', stageNumber: 5, status: 'pending' } },
  { id: '6', type: 'pipeline', position: { x: 1250, y: 0 }, data: { label: 'Root Cause Classifier', stageNumber: 6, status: 'pending' } },
  { id: '7', type: 'pipeline', position: { x: 1500, y: 0 }, data: { label: 'CVE Matcher', stageNumber: 7, status: 'pending' } },
  { id: '8', type: 'pipeline', position: { x: 1750, y: 0 }, data: { label: 'Risk Scorer', stageNumber: 8, status: 'pending' } },
  { id: '9', type: 'pipeline', position: { x: 2000, y: 0 }, data: { label: 'Output: RCA Report', stageNumber: 9, status: 'pending' } },
];

const baseEdges = Array.from({ length: 8 }, (_, i) => ({
  id: `e${i + 1}-${i + 2}`,
  source: `${i + 1}`,
  target: `${i + 2}`,
  animated: true,
  style: { stroke: 'var(--rcai-border)', strokeWidth: 2 },
  markerEnd: { type: MarkerType.ArrowClosed, color: 'var(--rcai-border)' },
}));

function PipelineInner() {
  const [analyses, setAnalyses] = useState([]);
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(baseEdges);
  const [selectedNode, setSelectedNode] = useState(null);
  const [analysisId, setAnalysisId] = useState(null);
  const [pipelineData, setPipelineData] = useState(null);
  const [autoLayout, setAutoLayout] = useState(false);
  const [loading, setLoading] = useState(false);
  const { fitView } = useReactFlow();

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
    setLoading(true);
    getPipeline(analysisId).then((res) => {
      setPipelineData(res.data);
      const stages = res.data.stages || [];
      setNodes((nds) =>
        nds.map((n, i) => {
          const stage = stages[i];
          return {
            ...n,
            data: {
              ...n.data,
              status: stage?.status || 'pending',
              summary: stage?.output_data
                ? (() => { try { const o = JSON.parse(stage.output_data); return o.root_cause || o.severity || o.signal || JSON.stringify(o).slice(0, 60); } catch { return ''; } })()
                : '',
            },
          };
        })
      );
      setEdges((eds) =>
        eds.map((e, i) => {
          const stage = stages[i + 1];
          const colors = stageColors[stage?.status] || stageColors.pending;
          return {
            ...e,
            style: { stroke: colors.edge, strokeWidth: 2 },
            markerEnd: { type: MarkerType.ArrowClosed, color: colors.edge },
          };
        })
      );
    }).catch(() => {}).finally(() => setLoading(false));
  }, [analysisId, setNodes, setEdges]);

  useEffect(() => {
    const base = autoLayout ? horizontalNodes : initialNodes;
    const stages = pipelineData?.stages || [];
    setNodes(base.map((n, i) => {
      const stage = stages[i];
      return {
        ...n,
        data: {
          ...n.data,
          status: stage?.status || 'pending',
          summary: stage?.output_data
            ? (() => { try { const o = JSON.parse(stage.output_data); return o.root_cause || o.severity || o.signal || JSON.stringify(o).slice(0, 60); } catch { return ''; } })()
            : '',
        },
      };
    }));
  }, [autoLayout, pipelineData, setNodes]);

  const onNodeClick = useCallback((_, node) => {
    if (!pipelineData) return;
    const stage = pipelineData.stages?.[parseInt(node.id) - 1];
    setSelectedNode({ ...node.data, stage });
  }, [pipelineData]);

  const handleRerun = async () => {
    if (!analysisId) return;
    setLoading(true);
    try {
      const analysis = analyses.find((a) => a.id === analysisId);
      if (analysis) {
        await analyseBinary(analysis.file_id);
        const res = await getPipeline(analysisId);
        setPipelineData(res.data);
        const stages = res.data.stages || [];
        setNodes((nds) =>
          nds.map((n, i) => ({
            ...n,
            data: { ...n.data, status: stages[i]?.status || 'pending' },
          }))
        );
      }
    } catch {}
    setLoading(false);
  };

  return (
    <div className="flex gap-4 h-[calc(100vh-8rem)]">
      <div className="flex-1 relative rounded-xl overflow-hidden bg-rcai-card border border-rcai-border">
        <div className="absolute top-3 left-3 z-10 flex items-center gap-2">
          <select
            value={analysisId || ''}
            onChange={(e) => { const id = Number(e.target.value); setAnalysisId(id); setCurrentAnalysisId(id); }}
            className="bg-rcai-elevated border border-rcai-border text-rcai-text-primary text-sm rounded-lg px-3 py-1.5 max-w-48"
          >
            {analyses.length === 0 && <option value="">No analyses</option>}
            {analyses.map((a) => (
              <option key={a.id} value={a.id}>
                {a.file_name || `Analysis #${a.id}`} — {a.root_cause || a.status}
              </option>
            ))}
          </select>
          <button
            onClick={handleRerun}
            disabled={loading || !analysisId}
            className="flex items-center gap-1 border border-rcai-border hover:bg-rcai-elevated text-rcai-text-secondary rounded-lg px-3 py-1.5 text-sm transition-all disabled:opacity-50"
          >
            <Play size={14} /> {loading ? 'Running...' : 'Re-run'}
          </button>
          <button
            onClick={() => setAutoLayout(!autoLayout)}
            className={`flex items-center gap-1 border rounded-lg px-3 py-1.5 text-sm transition-all ${
              autoLayout
                ? 'bg-rcai-accent text-white border-rcai-accent'
                : 'border-rcai-border hover:bg-rcai-elevated text-rcai-text-secondary'
            }`}
          >
            <LayoutIcon size={14} /> Auto-layout
          </button>
        </div>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={onNodeClick}
          nodeTypes={nodeTypes}
          fitView
          minZoom={0.5}
          maxZoom={2}
          nodesDraggable={false}
          nodesConnectable={false}
        >
          <Background color="var(--rcai-border)" gap={24} />
          <Controls />
          <MiniMap
            nodeStrokeColor="var(--rcai-border)"
            nodeColor="var(--rcai-elevated)"
            maskColor="rgba(10, 14, 26, 0.8)"
            style={{ background: 'var(--rcai-bg)' }}
          />
        </ReactFlow>
      </div>

      <AnimatePresence>
        {selectedNode && (
          <motion.div
            initial={{ x: 300, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 300, opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="w-96 shrink-0 rounded-xl bg-rcai-card border border-rcai-border p-4 overflow-y-auto"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display text-lg font-semibold text-rcai-text-primary">{selectedNode.label}</h3>
              <button onClick={() => setSelectedNode(null)} className="text-rcai-text-secondary hover:text-rcai-text-primary">
                <X size={18} />
              </button>
            </div>

            {selectedNode.stage && (
              <div className="space-y-4">
                <div>
                  <h4 className="text-xs font-semibold text-rcai-text-muted uppercase tracking-wider mb-2">Input</h4>
                  <pre className="text-xs text-rcai-text-secondary bg-rcai-bg rounded-lg p-3 overflow-x-auto max-h-40 overflow-y-auto">
                    {(() => { try { return JSON.stringify(JSON.parse(selectedNode.stage.input_data || '{}'), null, 2); } catch { return selectedNode.stage.input_data || 'None'; } })()}
                  </pre>
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-rcai-text-muted uppercase tracking-wider mb-2">Output</h4>
                  <pre className="text-xs text-rcai-text-secondary bg-rcai-bg rounded-lg p-3 overflow-x-auto max-h-40 overflow-y-auto">
                    {(() => { try { return JSON.stringify(JSON.parse(selectedNode.stage.output_data || '{}'), null, 2); } catch { return selectedNode.stage.output_data || 'None'; } })()}
                  </pre>
                </div>
                {selectedNode.stage.explanation && (
                  <div>
                    <h4 className="text-xs font-semibold text-rcai-text-muted uppercase tracking-wider mb-2">Explanation</h4>
                    <p className="text-sm text-rcai-text-secondary">{selectedNode.stage.explanation}</p>
                  </div>
                )}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function Pipeline() {
  return (
    <ReactFlowProvider>
      <PipelineInner />
    </ReactFlowProvider>
  );
}
