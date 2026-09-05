import React from 'react';
import { ViewType } from '../../domain/entities/types';
import type { User } from '../../domain/entities/User';
import { useMobileNavigation, useTouchInteraction } from '../hooks/useMobile';

interface BottomNavigationBarProps {
  activeView: ViewType;
  setView: (view: ViewType) => void;
  currentUser?: User | null;
}

const BottomNavigationBar: React.FC<BottomNavigationBarProps> = ({ activeView, setView, currentUser }) => {
  const { getTouchProps } = useTouchInteraction();

  // Define important items for bottom nav
  const importantNavItems = [
    { id: 'dashboard', icon: 'fa-chart-line', label: 'Dashboard' },
    { id: 'attendance', icon: 'fa-clipboard-user', label: 'Attendance' },
    { id: 'entry', icon: 'fa-edit', label: 'Marks' },
    { id: 'class-report', icon: 'fa-table', label: 'Report' }
  ].slice(0, 4); // Keep maximum 4-5 items in bottom nav

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-lg border-t border-slate-200 z-40 pb-safe shadow-[0_-8px_20px_-6px_rgba(0,0,0,0.1)] print:hidden">
      <div className="flex items-center justify-around h-16 max-w-md mx-auto">
        {importantNavItems.map((item) => {
          const isActive = activeView === item.id;
          return (
            <button
              key={item.id}
              {...getTouchProps(() => setView(item.id as ViewType))}
              className={`flex flex-col items-center justify-center w-full h-full space-y-1 transition-all duration-300 ${
                isActive ? 'text-emerald-600' : 'text-slate-400 hover:text-slate-900'
              }`}
            >
              <div className={`relative flex items-center justify-center w-10 h-10 rounded-2xl transition-all duration-300 ${
                isActive ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/30 -translate-y-1' : 'bg-transparent'
              }`}>
                <i className={`fa-solid ${item.icon} ${isActive ? 'text-lg' : 'text-xl'} transition-all`}></i>
              </div>
              <span className={`text-[9px] font-black uppercase tracking-widest transition-all ${isActive ? 'text-emerald-700 opacity-100' : 'opacity-60'}`}>
                {item.label}
              </span>
              {isActive && <div className="absolute bottom-1 w-1 h-1 bg-emerald-600 rounded-full animate-pulse"></div>}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default BottomNavigationBar;
