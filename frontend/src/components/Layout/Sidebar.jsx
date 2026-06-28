import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  LayoutDashboard, FolderOpen, GitBranch, Shield,
  Bomb, ScatterChart, Clock, Search, FileText, Settings, Menu
} from 'lucide-react';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/explorer', icon: FolderOpen, label: 'File Explorer' },
  { to: '/pipeline', icon: GitBranch, label: 'Pipeline' },
  { to: '/security', icon: Shield, label: 'Security Intel' },
  { to: '/exploit', icon: Bomb, label: 'Exploit Lab', danger: true },
  { to: '/clusters', icon: ScatterChart, label: 'Crash Clusters' },
  { to: '/timeline', icon: Clock, label: 'Timeline' },
  { to: '/cve', icon: Search, label: 'CVE Lookup' },
  { to: '/report', icon: FileText, label: 'Report Builder' },
  { to: '/settings', icon: Settings, label: 'Settings' },
];

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <motion.aside
      animate={{ width: collapsed ? 64 : 256 }}
      className="h-screen bg-rcai-card border-r border-rcai-border flex flex-col overflow-hidden shrink-0"
    >
      <div className="h-14 flex items-center px-4 border-b border-rcai-border gap-3">
        <button
          onClick={() => setCollapsed(!collapsed)}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-expanded={!collapsed}
          className="text-rcai-text-secondary hover:text-rcai-text-primary transition-colors"
        >
          <Menu size={20} />
        </button>
        {!collapsed && (
          <span className="font-display text-lg font-bold text-rcai-accent">RCAi</span>
        )}
      </div>
      <nav aria-label="Main navigation" className="flex-1 py-2 overflow-y-auto">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            title={collapsed ? item.label : undefined}
            className={({ isActive }) =>
              `flex items-center h-10 px-4 gap-3 text-sm transition-all duration-200 ${
                isActive
                  ? 'bg-rcai-elevated text-rcai-text-primary border-l-2 border-rcai-accent'
                  : 'text-rcai-text-secondary hover:bg-rcai-elevated hover:text-rcai-text-primary'
              } ${item.danger ? 'text-rcai-danger' : ''}`
            }
          >
            <item.icon size={18} />
            {!collapsed && <span>{item.label}</span>}
          </NavLink>
        ))}
      </nav>
    </motion.aside>
  );
}
