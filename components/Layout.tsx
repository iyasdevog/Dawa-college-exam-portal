
import React, { useEffect } from 'react';
import { ViewType } from '../types';
import HamburgerMenu from './HamburgerMenu';
import {
  useMobile,
  useMobileNavigation
} from '../hooks/useMobile';

interface LayoutProps {
  children: React.ReactNode;
  activeView: ViewType;
  setView: (view: ViewType) => void;
  onLogout: () => void;
  isCloudActive?: boolean;
}

/**
 * Enhanced Layout component with comprehensive mobile responsiveness
 * Implements Requirements 1.4, 1.6, 1.7 - Mobile header, status indicators, and orientation handling
 * Validates Properties 3, 4, 5 - Mobile header display, navigation consistency, orientation adaptation
 */
const Layout: React.FC<LayoutProps> = ({ children, activeView, setView, onLogout, isCloudActive = true }) => {
  const {
    isMobile,
    isTablet,
    screenSize,
    orientation,
    isTouchDevice,
    preferences
  } = useMobile();

  const { isMobileMenuOpen } = useMobileNavigation();

  const navItems = [
    { id: 'dashboard', icon: 'fa-chart-line', label: 'Dashboard' },
    { id: 'entry', icon: 'fa-edit', label: 'Marks Entry' },
    { id: 'class-report', icon: 'fa-table', label: 'Class Report' },
    { id: 'student-card', icon: 'fa-id-card', label: 'Score Cards' },
    { id: 'management', icon: 'fa-sliders', label: 'Management' },
  ];

  // Enhanced orientation change handling - Requirement 1.7
  useEffect(() => {
    const handleOrientationChange = () => {
      // Preserve scroll position and active element during orientation change
      const scrollPosition = window.pageYOffset || document.documentElement.scrollTop;
      const activeElement = document.activeElement as HTMLElement;

      // Add transition class for smooth layout changes
      document.body.classList.add('orientation-changing');

      // Force layout recalculation after orientation change
      setTimeout(() => {
        window.dispatchEvent(new Event('resize'));

        // Restore scroll position and focus after layout update
        setTimeout(() => {
          window.scrollTo({
            top: scrollPosition,
            behavior: 'auto' // Use auto during orientation change
          });

          // Restore focus if element still exists and is focusable
          if (activeElement && document.contains(activeElement) && typeof activeElement.focus === 'function') {
            try {
              activeElement.focus();
            } catch (e) {
              // Ignore focus errors during orientation change
            }
          }

          document.body.classList.remove('orientation-changing');
        }, 50);
      }, 100);
    };

    window.addEventListener('orientationchange', handleOrientationChange);
    return () => window.removeEventListener('orientationchange', handleOrientationChange);
  }, []);

  // Get view title with mobile-friendly formatting
  const getViewTitle = (view: ViewType): string => {
    const titles: Record<ViewType, string> = {
      'dashboard': 'Dashboard',
      'entry': 'Marks Entry',
      'class-report': 'Class Report',
      'student-card': 'Score Cards',
      'management': 'Management',
      'public': 'Public Portal'
    };
    return titles[view] || view.replace('-', ' ');
  };

  // Mobile-optimized cloud status component
  const CloudStatusIndicator = () => {
    const baseClasses = "flex items-center gap-1.5 px-2 py-1 rounded-lg border transition-all duration-300";
    const mobileClasses = isMobile ? "text-xs" : "text-[10px]";

    if (isCloudActive) {
      return (
        <div className={`${baseClasses} bg-emerald-50 text-emerald-700 border-emerald-200 ${mobileClasses}`}>
          <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></div>
          <span className="font-bold uppercase tracking-wide">
            {isMobile ? 'Online' : 'Cloud Synced'}
          </span>
        </div>
      );
    }

    return (
      <div className={`${baseClasses} bg-amber-50 text-amber-700 border-amber-200 ${mobileClasses}`}>
        <div className="w-1.5 h-1.5 bg-amber-500 rounded-full"></div>
        <span className="font-bold uppercase tracking-wide">
          {isMobile ? 'Offline' : 'Local Mode'}
        </span>
      </div>
    );
  };

  // Mobile-optimized header component with orientation adaptation
  const MobileHeader = () => (
    <header
      className={`
        sticky top-0 z-30 bg-white border-b border-slate-200 print:hidden
        transition-all duration-300 ease-in-out
        ${isMobile ? 'h-16 px-4' : 'h-20 px-6 md:px-8'}
        ${isMobileMenuOpen ? 'shadow-lg' : 'shadow-sm'}
        ${orientation === 'landscape' && isMobile ? 'mobile-landscape' : ''}
        ${orientation === 'portrait' && isMobile ? 'mobile-portrait' : ''}
      `}
    >
      <div className="flex items-center justify-between h-full">
        {/* Left Section - Navigation and Title */}
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {/* Mobile Hamburger Menu */}
          {isMobile && (
            <HamburgerMenu
              activeView={activeView}
              setView={setView}
              onLogout={onLogout}
              isCloudActive={isCloudActive}
            />
          )}

          {/* Page Title - Mobile Optimized */}
          <h1 className={`
            font-black text-slate-900 tracking-tight truncate
            ${isMobile ? 'text-lg' : 'text-xl md:text-2xl'}
          `}>
            {getViewTitle(activeView)}
          </h1>

          {/* Cloud Status - Mobile Priority */}
          <div className={isMobile ? 'ml-auto' : 'ml-4'}>
            <CloudStatusIndicator />
          </div>
        </div>

        {/* Right Section - Desktop Only Info */}
        {!isMobile && (
          <div className="flex items-center gap-4">
            {/* Faculty Terminal Info - Hidden on tablet and below */}
            <div className="hidden xl:block text-right">
              <p className="text-xs font-black text-slate-900 uppercase tracking-widest">
                Faculty Terminal
              </p>
              <p className="text-[10px] text-slate-400 mt-1 uppercase font-bold tracking-widest">
                Node ID: IDA-2025-01
              </p>
            </div>

            {/* Connection Status Icon */}
            <div className={`
              p-3 rounded-xl flex items-center justify-center shadow-inner transition-all
              ${isCloudActive
                ? 'bg-emerald-100 text-emerald-600 hover:bg-emerald-200'
                : 'bg-amber-100 text-amber-600 hover:bg-amber-200'
              }
            `}>
              <i className={`
                fa-solid text-lg transition-transform hover:scale-110
                ${isCloudActive ? 'fa-cloud' : 'fa-database'}
              `}></i>
            </div>
          </div>
        )}
      </div>

      {/* Mobile-specific secondary info bar */}
      {isMobile && (
        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-emerald-500 to-blue-500 opacity-20"></div>
      )}
    </header>
  );

  // Desktop sidebar component
  const DesktopSidebar = () => (
    <aside className="w-64 bg-slate-900 text-white flex-shrink-0 flex flex-col print:hidden">
      <div className="p-8">
        <h1 className="text-xl font-black tracking-tighter flex items-center gap-3">
          <i className="fa-solid fa-graduation-cap text-emerald-400"></i>
          AIC Da'wa College
        </h1>
        <p className="text-[10px] text-slate-400 mt-2 uppercase font-black tracking-[0.3em]">
          Exam Portal
        </p>
      </div>

      <nav className="mt-4 px-4 space-y-2 flex-1">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setView(item.id as ViewType)}
            className={`
              w-full flex items-center gap-4 px-5 py-4 rounded-2xl transition-all
              touch-target-min
              ${activeView === item.id
                ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-500/20'
                : 'text-slate-400 hover:bg-slate-800 hover:text-white'
              }
            `}
          >
            <i className={`fa-solid ${item.icon} w-5 text-sm`}></i>
            <span className="font-bold text-sm">{item.label}</span>
          </button>
        ))}
      </nav>

      <div className="p-6 border-t border-slate-800">
        <button
          onClick={onLogout}
          className="w-full flex items-center gap-4 px-5 py-4 rounded-2xl text-red-400 hover:bg-red-500/10 transition-all touch-target-min"
        >
          <i className="fa-solid fa-right-from-bracket w-5"></i>
          <span className="font-bold text-sm">Exit Admin</span>
        </button>
      </div>
    </aside>
  );

  return (
    <div className={`
      flex min-h-screen bg-slate-50 print:block print:bg-white
      ${isMobile ? 'flex-col' : 'flex-row'}
      ${orientation === 'landscape' && isMobile ? 'landscape-mobile mobile-landscape' : ''}
      ${orientation === 'portrait' && isMobile ? 'mobile-portrait' : ''}
      ${preferences.reducedMotion ? 'motion-reduce' : ''}
    `}>
      {/* Desktop Sidebar - Hidden on Mobile */}
      {!isMobile && <DesktopSidebar />}

      {/* Main Content Area with Enhanced Orientation Support */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden main-content">
        <MobileHeader />

        {/* Content Area with Mobile-Optimized Padding and Orientation Adaptation */}
        <div className={`
          flex-1 overflow-y-auto touch-scroll
          ${isMobile
            ? 'p-4 mobile-content-spacing-md'
            : isTablet
              ? 'p-6 mobile-content-spacing-lg'
              : 'p-6 lg:p-10 mobile-content-spacing-xl'
          }
          ${isTouchDevice ? 'touch-scroll' : ''}
        `}>
          <div className={`
            ${isMobile ? 'space-y-4' : 'space-y-6'}
            ${screenSize === 'xs' ? 'max-w-full' : ''}
            ${orientation === 'landscape' && isMobile ? 'mobile-grid-adaptive' : 'mobile-grid-adaptive'}
            orientation-optimized
          `}>
            {children}
          </div>
        </div>
      </main>
    </div>
  );
};

export default Layout;
