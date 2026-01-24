
import React from 'react';
import { ViewType } from '../types';

interface LayoutProps {
  children: React.ReactNode;
  activeView: ViewType;
  setView: (view: ViewType) => void;
  onLogout: () => void;
}

const Layout: React.FC<LayoutProps> = ({ children, activeView, setView, onLogout }) => {
  const navItems = [
    { id: 'dashboard', icon: 'fa-chart-line', label: 'Dashboard' },
    { id: 'entry', icon: 'fa-edit', label: 'Marks Entry' },
    { id: 'class-report', icon: 'fa-table', label: 'Class Report' },
    { id: 'student-card', icon: 'fa-id-card', label: 'Score Cards' },
    { id: 'management', icon: 'fa-sliders', label: 'Management' },
  ];

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-slate-50">
      {/* Sidebar */}
      <aside className="w-full md:w-64 bg-slate-900 text-white flex-shrink-0 flex flex-col">
        <div className="p-6">
          <h1 className="text-xl font-bold tracking-tight flex items-center gap-3">
            <i className="fa-solid fa-graduation-cap text-emerald-400"></i>
            EDUMARK
          </h1>
          <p className="text-xs text-slate-400 mt-1 uppercase tracking-widest">Faculty Admin</p>
        </div>
        
        <nav className="mt-4 px-4 space-y-1 flex-1">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setView(item.id as ViewType)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
                activeView === item.id 
                ? 'bg-emerald-600 text-white' 
                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <i className={`fa-solid ${item.icon} w-5`}></i>
              <span className="font-medium">{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-slate-800">
          <button 
            onClick={onLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-red-400 hover:bg-red-500/10 transition-all"
          >
            <i className="fa-solid fa-right-from-bracket w-5"></i>
            <span className="font-medium">Exit Admin</span>
          </button>
        </div>

        <div className="p-6 text-xs text-slate-500 border-t border-slate-800 hidden md:block">
          &copy; 2024 EduMark Systems
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 sticky top-0 z-10">
          <div className="flex items-center gap-4">
            <h2 className="text-lg font-semibold text-slate-800 capitalize">
              {activeView.replace('-', ' ')}
            </h2>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden sm:block text-right">
              <p className="text-sm font-medium leading-none">Admin Portal</p>
              <p className="text-xs text-slate-500 mt-1">Session: 2025-26</p>
            </div>
            <div className="bg-emerald-100 p-2 rounded-full w-10 h-10 flex items-center justify-center text-emerald-600">
              <i className="fa-solid fa-user-shield"></i>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 md:p-8">
          {children}
        </div>
      </main>
    </div>
  );
};

export default Layout;
