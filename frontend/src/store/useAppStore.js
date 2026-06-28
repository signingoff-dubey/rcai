import { create } from 'zustand';

const useAppStore = create((set) => ({
  analyses: [],
  selectedFile: null,
  selectedAnalysis: null,
  currentAnalysisId: null,
  sidebarCollapsed: false,
  loading: false,
  theme: localStorage.getItem('rcai-theme') || 'default',

  setAnalyses: (analyses) => set({ analyses }),
  setSelectedFile: (file) => set({ selectedFile: file }),
  setSelectedAnalysis: (analysis) => set({ selectedAnalysis: analysis }),
  setCurrentAnalysisId: (id) => set({ currentAnalysisId: id }),
  setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
  setLoading: (loading) => set({ loading }),
  setTheme: (theme) => {
    localStorage.setItem('rcai-theme', theme);
    document.documentElement.setAttribute('data-theme', theme);
    set({ theme });
  },
}));

export default useAppStore;
