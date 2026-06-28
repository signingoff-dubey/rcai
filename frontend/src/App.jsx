import { lazy, Suspense, useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import Sidebar from './components/Layout/Sidebar';
import TopBar from './components/Layout/TopBar';
import useAppStore from './store/useAppStore';

const Dashboard = lazy(() => import('./screens/Dashboard'));
const FileExplorer = lazy(() => import('./screens/FileExplorer'));
const Pipeline = lazy(() => import('./screens/Pipeline'));
const SecurityIntel = lazy(() => import('./screens/SecurityIntel'));
const ExploitLab = lazy(() => import('./screens/ExploitLab'));
const CrashClusters = lazy(() => import('./screens/CrashClusters'));
const Timeline = lazy(() => import('./screens/Timeline'));
const CVELookup = lazy(() => import('./screens/CVELookup'));
const ReportBuilder = lazy(() => import('./screens/ReportBuilder'));
const Settings = lazy(() => import('./screens/Settings'));

export default function App() {
  const theme = useAppStore((s) => s.theme);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  return (
    <div className="min-h-screen bg-rcai-bg flex">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <TopBar />
        <main className="flex-1 overflow-y-auto p-6">
          <Suspense fallback={<div className="text-rcai-text-secondary p-8">Loading...</div>}>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/explorer" element={<FileExplorer />} />
              <Route path="/pipeline" element={<Pipeline />} />
              <Route path="/security" element={<SecurityIntel />} />
              <Route path="/exploit" element={<ExploitLab />} />
              <Route path="/clusters" element={<CrashClusters />} />
              <Route path="/timeline" element={<Timeline />} />
              <Route path="/cve" element={<CVELookup />} />
              <Route path="/report" element={<ReportBuilder />} />
              <Route path="/settings" element={<Settings />} />
            </Routes>
          </Suspense>
        </main>
      </div>
    </div>
  );
}
