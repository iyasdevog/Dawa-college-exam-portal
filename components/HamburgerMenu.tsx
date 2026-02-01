import React, { useEffect } from 'react';
import { ViewType } from '../types';
import { useMobileNavigation, useTouchInteraction } from '../hooks/useMobile';

interface HamburgerMenuProps {
    activeView: ViewType;
    setView: (view: ViewType) => void;
    onLogout: () => void;
    isCloudActive?: boolean;
}

interface NavigationItem {
    id: ViewType;
    icon: string;
    label: string;
}

const HamburgerMenu: React.FC<HamburgerMenuProps> = ({
    activeView,
    setView,
    onLogout,
    isCloudActive = true
}) => {
    const {
        isMobileMenuOpen,
        toggleMobileMenu,
        closeMobileMenu,
        shouldShowMobileMenu
    } = useMobileNavigation();

    const { getTouchProps } = useTouchInteraction();

    const navItems: NavigationItem[] = [
        { id: 'dashboard', icon: 'fa-chart-line', label: 'Dashboard' },
        { id: 'entry', icon: 'fa-edit', label: 'Marks Entry' },
        { id: 'class-report', icon: 'fa-table', label: 'Class Report' },
        { id: 'student-card', icon: 'fa-id-card', label: 'Score Cards' },
        { id: 'management', icon: 'fa-sliders', label: 'Management' },
    ];

    // Handle navigation item click
    const handleNavItemClick = (view: ViewType) => {
        setView(view);
        closeMobileMenu();
    };

    // Handle logout click
    const handleLogoutClick = () => {
        onLogout();
        closeMobileMenu();
    };

    // Close menu on escape key
    useEffect(() => {
        const handleEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape' && isMobileMenuOpen) {
                closeMobileMenu();
            }
        };

        if (isMobileMenuOpen) {
            document.addEventListener('keydown', handleEscape);
            return () => document.removeEventListener('keydown', handleEscape);
        }
    }, [isMobileMenuOpen, closeMobileMenu]);

    // Don't render on desktop
    if (!shouldShowMobileMenu) {
        return null;
    }

    return (
        <>
            {/* Hamburger Button */}
            <button
                {...getTouchProps(toggleMobileMenu)}
                className={`
          relative z-50 flex flex-col justify-center items-center
          w-12 h-12 bg-slate-900 rounded-xl
          transition-all duration-300 ease-in-out
          touch-target-min
          ${isMobileMenuOpen ? 'bg-emerald-600' : 'hover:bg-slate-800'}
        `}
                aria-label={isMobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
                aria-expanded={isMobileMenuOpen}
                aria-controls="mobile-navigation"
            >
                {/* Hamburger Lines */}
                <div className="relative w-6 h-4 flex flex-col justify-between">
                    {/* Top Line */}
                    <span
                        className={`
              block h-0.5 w-full bg-white rounded-full
              transition-all duration-300 ease-in-out origin-center
              ${isMobileMenuOpen
                                ? 'rotate-45 translate-y-1.5'
                                : 'rotate-0 translate-y-0'
                            }
            `}
                    />

                    {/* Middle Line */}
                    <span
                        className={`
              block h-0.5 w-full bg-white rounded-full
              transition-all duration-300 ease-in-out
              ${isMobileMenuOpen ? 'opacity-0 scale-0' : 'opacity-100 scale-100'}
            `}
                    />

                    {/* Bottom Line */}
                    <span
                        className={`
              block h-0.5 w-full bg-white rounded-full
              transition-all duration-300 ease-in-out origin-center
              ${isMobileMenuOpen
                                ? '-rotate-45 -translate-y-1.5'
                                : 'rotate-0 translate-y-0'
                            }
            `}
                    />
                </div>
            </button>

            {/* Overlay */}
            <div
                className={`
          fixed inset-0 bg-black/50 backdrop-blur-sm z-40
          transition-all duration-300 ease-in-out
          ${isMobileMenuOpen
                        ? 'opacity-100 visible'
                        : 'opacity-0 invisible'
                    }
        `}
                onClick={closeMobileMenu}
                aria-hidden="true"
            />

            {/* Navigation Menu */}
            <nav
                id="mobile-navigation"
                className={`
          fixed top-0 left-0 bottom-0 w-80 max-w-[85vw]
          bg-slate-900 text-white z-50
          transform transition-transform duration-300 ease-in-out
          overflow-y-auto
          ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
                aria-label="Mobile navigation"
            >
                {/* Header */}
                <div className="p-6 pt-8 border-b border-slate-800">
                    <div className="flex items-center justify-between mb-4">
                        <h1 className="text-lg font-black tracking-tighter flex items-center gap-3">
                            <i className="fa-solid fa-graduation-cap text-emerald-400 text-xl"></i>
                            AIC Da'wa College
                        </h1>

                        {/* Close Button */}
                        <button
                            {...getTouchProps(closeMobileMenu)}
                            className="
                w-10 h-10 flex items-center justify-center
                text-slate-400 hover:text-white hover:bg-slate-800
                rounded-lg transition-all duration-200
                touch-target-min
              "
                            aria-label="Close navigation menu"
                        >
                            <i className="fa-solid fa-times text-lg"></i>
                        </button>
                    </div>

                    <p className="text-xs text-slate-400 uppercase font-black tracking-[0.2em]">
                        Exam Portal
                    </p>

                    {/* Cloud Status */}
                    <div className="mt-4">
                        {isCloudActive ? (
                            <div className="flex items-center gap-2 px-3 py-2 bg-emerald-900/30 text-emerald-300 rounded-lg border border-emerald-800/30">
                                <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></div>
                                <span className="text-xs font-bold uppercase tracking-wide">
                                    Cloud Synced
                                </span>
                            </div>
                        ) : (
                            <div className="flex items-center gap-2 px-3 py-2 bg-amber-900/30 text-amber-300 rounded-lg border border-amber-800/30">
                                <div className="w-2 h-2 bg-amber-400 rounded-full"></div>
                                <span className="text-xs font-bold uppercase tracking-wide">
                                    Local Mode
                                </span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Navigation Items */}
                <div className="p-4 space-y-2 flex-1">
                    {navItems.map((item) => (
                        <button
                            key={item.id}
                            {...getTouchProps(() => handleNavItemClick(item.id))}
                            className={`
                w-full flex items-center gap-4 px-4 py-4 rounded-xl
                transition-all duration-200 text-left
                touch-target-min
                ${activeView === item.id
                                    ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-500/20'
                                    : 'text-slate-300 hover:bg-slate-800 hover:text-white active:bg-slate-700'
                                }
              `}
                            aria-current={activeView === item.id ? 'page' : undefined}
                        >
                            <div className="w-6 flex justify-center">
                                <i className={`fa-solid ${item.icon} text-sm`}></i>
                            </div>
                            <span className="font-semibold text-sm">{item.label}</span>

                            {/* Active Indicator */}
                            {activeView === item.id && (
                                <div className="ml-auto w-2 h-2 bg-white rounded-full"></div>
                            )}
                        </button>
                    ))}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-slate-800">
                    {/* Node ID Info */}
                    <div className="mb-4 p-3 bg-slate-800/50 rounded-lg">
                        <p className="text-xs font-bold text-slate-300 uppercase tracking-wide">
                            Faculty Terminal
                        </p>
                        <p className="text-xs text-slate-500 mt-1 font-mono">
                            Node ID: IDA-2025-01
                        </p>
                    </div>

                    {/* Logout Button */}
                    <button
                        {...getTouchProps(handleLogoutClick)}
                        className="
              w-full flex items-center gap-4 px-4 py-4 rounded-xl
              text-red-400 hover:bg-red-500/10 active:bg-red-500/20
              transition-all duration-200
              touch-target-min
            "
                    >
                        <div className="w-6 flex justify-center">
                            <i className="fa-solid fa-right-from-bracket text-sm"></i>
                        </div>
                        <span className="font-semibold text-sm">Exit Admin</span>
                    </button>
                </div>
            </nav>
        </>
    );
};

export default HamburgerMenu;