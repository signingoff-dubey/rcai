import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
});

export const getDashboardSummary = () => api.get('/dashboard/summary');

export const uploadFiles = (formData) =>
  api.post('/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });

export const getFileTree = () => api.get('/files');

export const getProjects = () => api.get('/files/projects');

export const getFileMetadata = (fileId) => api.get(`/files/${fileId}/metadata`);

export const getFileChildren = (fileId) => api.get(`/files/${fileId}/children`);

export const getFolderChildren = (fileId) => api.get(`/files/${fileId}/folder-children`);

export const deleteFile = (fileId) => api.delete(`/files/${fileId}`);

export const analyseBinary = (binaryId) => api.post(`/analyse/${binaryId}`);

export const getPipeline = (analysisId) => api.get(`/pipeline/${analysisId}`);

export const getSecurityIntel = (analysisId) => api.get(`/security/${analysisId}`);

export const getExploitContext = (analysisId) => api.get(`/exploit/${analysisId}`);

export const minimisePoc = (analysisId, data) =>
  api.post(`/exploit/${analysisId}/minimise`, data);

export const runReproduction = (analysisId, data) =>
  api.post(`/exploit/${analysisId}/run`, data);

export const getClusters = () => api.get('/clusters');

export const getTimeline = () => api.get('/timeline');

export const getTimelineEvents = () => api.get('/timeline/events');

export const lookupCVE = (cveId, nvd = false) => api.get(`/cve/${cveId}${nvd ? '?nvd=true' : ''}`);

export const listCVEs = () => api.get('/cve');

export const generateReport = (analysisId) => api.get(`/report/${analysisId}`);

export const getFileContent = (fileId) => api.get(`/files/${fileId}/content`);

export const exportReportMarkdown = (analysisId) =>
  api.get(`/report/${analysisId}/markdown`, { responseType: 'blob' });

export const exportReportPdf = (analysisId) =>
  api.get(`/report/${analysisId}/pdf`, { responseType: 'blob' });

export const seedDataset = () => api.post('/seed');

export const getAnalysesList = () => api.get('/analyses');

export const getNotes = (analysisId) => api.get(`/notes/${analysisId}`);

export const createNote = (analysisId, note) => api.post(`/notes/${analysisId}`, { note });

export const updateNote = (noteId, note) => api.put(`/notes/${noteId}`, { note });

export const deleteNote = (noteId) => api.delete(`/notes/${noteId}`);

export const batchAnalyse = () => api.post('/analyse/batch');

export const getDashboardInsights = () => api.get('/dashboard/insights');

export const getFileExplanation = (fileId) => api.post(`/explain/${fileId}`);

export default api;
