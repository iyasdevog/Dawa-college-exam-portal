import React from 'react';
import { ViewType } from '../../domain/entities/types';
import HamburgerMenu from './HamburgerMenu';
import { User } from '../../domain/entities/User';
import { useMobile, useMobileNavigation } from '../hooks/useMobile';

interface LayoutProps {
  children: React.ReactNode;
  activeView: ViewType;
  setView: (view: ViewType) => void;
  onLogout: () => void;
  isCloudActive?: boolean;
  currentUser?: User | null;
}

const Layout: React.FC<LayoutProps> = ({ children, activeView, setView, onLogout, isCloudActive = true, currentUser }) => {
  const { isMobile, isTablet } = useMobile();
  const { isMobileMenuOpen } = useMobileNavigation();

  const navItems = [
    { id: 'dashboard', icon: 'fa-chart-line', label: 'Dashboard' },
    { id: 'entry', icon: 'fa-edit', label: 'Marks Entry' },
    { id: 'class-report', icon: 'fa-table', label: 'Class Report' },
    { id: 'student-card', icon: 'fa-id-card', label: 'Score Cards' },
    { id: 'doura-monitoring', icon: 'fa-book-quran', label: 'Doura Monitoring' },
    ...(currentUser?.role === 'admin' ? [{ id: 'management', icon: 'fa-sliders', label: 'Management' }] : []),
  ];

  const getViewTitle = (view: ViewType): string => {
    const titles: Record<ViewType, string> = {
      'dashboard': 'Dashboard',
      'entry': 'Marks Entry',
      'class-report': 'Class Report',
      'student-card': 'Score Cards',
      'management': 'Management',
      'doura-monitoring': 'Doura Monitoring',
      'public': 'Public Portal'
    };
    return titles[view] || view.replace('-', ' ');
  };

  const CloudStatusIndicator = () => (
    <div className={`flex items-center gap-1.5 px-2 py-1 rounded-lg border ${isCloudActive ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'} ${isMobile ? 'text-xs' : 'text-[10px]'}`}>
      <div className={`w-1.5 h-1.5 rounded-full ${isCloudActive ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`}></div>
      <span className="font-bold uppercase tracking-wide">{isCloudActive ? (isMobile ? 'Online' : 'Cloud Synced') : (isMobile ? 'Offline' : 'Local Mode')}</span>
    </div>
  );

  const MobileHeader = () => (
    <header className={`sticky top-0 z-30 bg-white border-b border-slate-200 transition-all duration-300 ease-in-out print:hidden ${isMobile ? 'h-16 px-4' : 'h-20 px-6 md:px-8'} ${isMobileMenuOpen ? 'shadow-lg' : 'shadow-sm'}`}>
      <div className="flex items-center justify-between h-full">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {isMobile && <HamburgerMenu activeView={activeView} setView={setView} onLogout={onLogout} isCloudActive={isCloudActive} currentUser={currentUser} />}
          <h1 className={`font-black text-slate-900 tracking-tight truncate ${isMobile ? 'text-lg' : 'text-xl md:text-2xl'}`}>{getViewTitle(activeView)}</h1>
          <div className={`${isMobile ? 'ml-auto' : 'ml-4'} min-w-[44px] min-h-[44px] flex items-center justify-center`}>
            <CloudStatusIndicator />
          </div>
        </div>
        {!isMobile && (
          <div className="flex items-center gap-4">
            <div className="hidden xl:block text-right">
              <p className="text-xs font-black text-slate-900 uppercase tracking-widest">Faculty Terminal</p>
              <p className="text-[10px] text-slate-400 mt-1 uppercase font-bold tracking-widest">Node ID: IDA-2025-01</p>
            </div>
            <button className={`p-3 rounded-xl flex items-center justify-center shadow-inner transition-all w-12 h-12 ${isCloudActive ? 'bg-emerald-100 text-emerald-600 hover:bg-emerald-200' : 'bg-amber-100 text-amber-600 hover:bg-amber-200'}`}>
              <i className={`fa-solid text-lg ${isCloudActive ? 'fa-cloud' : 'fa-database'}`}></i>
            </button>
          </div>
        )}
      </div>
    </header>
  );

  const DesktopSidebar = () => (
    <aside className="w-64 bg-slate-900 text-white flex-shrink-0 flex flex-col print:hidden">
      <div className="p-8">
        <h1 className="text-xl font-black tracking-tighter flex items-center gap-3">
          <i className="fa-solid fa-graduation-cap text-emerald-400"></i>
          AIC Da'wa College
        </h1>
        <p className="text-[10px] text-slate-400 mt-2 uppercase font-black tracking-[0.3em]">Exam Portal</p>
      </div>
      <nav className="mt-4 px-4 space-y-2 flex-1">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setView(item.id as ViewType)}
            className={`w-full flex items-center gap-4 px-5 py-4 rounded-2xl transition-all min-h-[44px] ${activeView === item.id ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-500/20' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
          >
            <i className={`fa-solid ${item.icon} w-5 text-sm`}></i>
            <span className="font-bold text-sm">{item.label}</span>
          </button>
        ))}
      </nav>
      <div className="p-6 border-t border-slate-800">
        <button onClick={onLogout} className="w-full flex items-center gap-4 px-5 py-4 rounded-2xl text-red-400 hover:bg-red-500/10 transition-all min-h-[44px]">
          <i className="fa-solid fa-right-from-bracket w-5"></i>
          <span className="font-bold text-sm">Exit Admin</span>
        </button>
      </div>
    </aside>
  );

  return (
    <div className={`flex min-h-screen bg-slate-50 print:block print:bg-white w-full max-w-[100vw] overflow-x-hidden ${isMobile ? 'flex-col' : 'flex-row'}`}>
      {!isMobile && <DesktopSidebar />}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <MobileHeader />
        <div className={`flex-1 overflow-y-auto ${isMobile ? 'p-4' : isTablet ? 'p-6' : 'p-6 lg:p-10'}`}>
          <div className={`${isMobile ? 'space-y-4' : 'space-y-6'} max-w-full`}>
            {children}
          </div>
        </div>
      </main>
    </div>
  );
};

export default Layout;
