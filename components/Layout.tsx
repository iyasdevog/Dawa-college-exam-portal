
import React from 'react';
import { ViewType } from '../types';

interface LayoutProps {
  children: React.ReactNode;
  activeView: ViewType;
  setView: (view: ViewType) => void;
  onLogout: () => void;
  isCloudActive?: boolean;
}

const Layout: React.FC<LayoutProps> = ({ children, activeView, setView, onLogout, isCloudActive = true }) => {
  const navItems = [
    { id: 'dashboard', icon: 'fa-chart-line', label: 'Dashboard' },
    { id: 'entry', icon: 'fa-edit', label: 'Marks Entry' },
    { id: 'class-report', icon: 'fa-table', label: 'Class Report' },
    { id: 'student-card', icon: 'fa-id-card', label: 'Score Cards' },
    { id: 'management', icon: 'fa-sliders', label: 'Management' },
  ];

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-slate-50">
      <aside className="w-full md:w-64 bg-slate-900 text-white flex-shrink-0 flex flex-col">
        <div className="p-8">
          <h1 className="text-2xl font-black tracking-tighter flex items-center gap-3">
            <i className="fa-solid fa-graduation-cap text-emerald-400"></i>
            EDUMARK
          </h1>
          <p className="text-[10px] text-slate-400 mt-2 uppercase font-black tracking-[0.3em]">Institutional Node</p>
        </div>
        
        <nav className="mt-4 px-4 space-y-2 flex-1">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setView(item.id as ViewType)}
              className={`w-full flex items-center gap-4 px-5 py-4 rounded-2xl transition-all ${
                activeView === item.id 
                ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-500/20' 
                : 'text-slate-400 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <i className={`fa-solid ${item.icon} w-5 text-sm`}></i>
              <span className="font-bold text-sm">{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="p-6 border-t border-slate-800">
          <button onClick={onLogout} className="w-full flex items-center gap-4 px-5 py-4 rounded-2xl text-red-400 hover:bg-red-500/10 transition-all">
            <i className="fa-solid fa-right-from-bracket w-5"></i>
            <span className="font-bold text-sm">Exit Admin</span>
          </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="h-20 bg-white border-b border-slate-200 flex items-center justify-between px-8 sticky top-0 z-10">
          <div className="flex items-center gap-6">
            <h2 className="text-xl font-black text-slate-900 capitalize tracking-tight">{activeView.replace('-', ' ')}</h2>
            
            {isCloudActive ? (
              <div className="flex items-center gap-2 px-4 py-1.5 bg-emerald-50 text-emerald-600 rounded-full border border-emerald-100 animate-in fade-in duration-500">
                <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></div>
                <span className="text-[10px] font-black uppercase tracking-widest">Global Cloud Synced</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 px-4 py-1.5 bg-amber-50 text-amber-600 rounded-full border border-amber-100 animate-in shake duration-500">
                <div className="w-1.5 h-1.5 bg-amber-500 rounded-full"></div>
                <span className="text-[10px] font-black uppercase tracking-widest">Local Mode (Offline)</span>
              </div>
            )}
          </div>
          
          <div className="flex items-center gap-5">
            <div className="hidden lg:block text-right">
              <p className="text-xs font-black text-slate-900 uppercase tracking-widest">Faculty Terminal</p>
              <p className="text-[10px] text-slate-400 mt-1 uppercase font-bold tracking-widest">Node ID: IDA-2025-01</p>
            </div>
            <div className={`p-3 rounded-2xl flex items-center justify-center shadow-inner ${isCloudActive ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'}`}>
              <i className={`fa-solid ${isCloudActive ? 'fa-cloud' : 'fa-database'} text-lg`}></i>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-6 md:p-10">
          {children}
        </div>
      </main>
    </div>
  );
};

export default Layout;
