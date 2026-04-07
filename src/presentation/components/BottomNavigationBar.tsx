import React from 'react';
import { ViewType } from '../../domain/entities/types';
import { User } from '../../domain/entities/User';
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
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 z-40 pb-safe shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] print:hidden">
      <div className="flex items-center justify-around h-16">
        {importantNavItems.map((item) => {
          const isActive = activeView === item.id;
          return (
            <button
              key={item.id}
              {...getTouchProps(() => setView(item.id as ViewType))}
              className={`flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors ${
                isActive ? 'text-emerald-600' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <div className={`relative flex items-center justify-center w-8 h-8 rounded-full transition-all ${
                isActive ? 'bg-emerald-100' : 'bg-transparent'
              }`}>
                <i className={`fa-solid ${item.icon} ${isActive ? 'scale-110' : ''} transition-transform`}></i>
              </div>
              <span className={`text-[10px] font-bold tracking-wide ${isActive ? 'text-emerald-700' : ''}`}>
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default BottomNavigationBar;
