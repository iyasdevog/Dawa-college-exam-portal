import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { ViewType } from '../../domain/entities/types';
import type { User } from '../../domain/entities/User';
import { useMobileNavigation, useTouchInteraction } from '../hooks/useMobile';
import { keyboardNavigation, screenReaderAnnouncer, ariaHelpers } from '../utils/accessibility';
import { versionService } from '../../infrastructure/services/versionService';

interface HamburgerMenuProps {
    activeView: ViewType;
    setView: (view: ViewType) => void;
    onLogout: () => void;
    isCloudActive?: boolean;
    currentUser?: User | null;
}

interface NavigationItem {
    id: ViewType;
    icon: string;
    label: string;
    description?: string;
}

const HamburgerMenu: React.FC<HamburgerMenuProps> = ({
    activeView,
    setView,
    onLogout,
    isCloudActive = true,
    currentUser
}) => {
    const {
        isMobileMenuOpen,
        toggleMobileMenu,
        closeMobileMenu,
        shouldShowMobileMenu
    } = useMobileNavigation();

    const { getTouchProps } = useTouchInteraction();

    const navItems: NavigationItem[] = [
        { id: 'dashboard', icon: 'fa-chart-line', label: 'Dashboard', description: 'View academic performance overview' },
        { id: 'attendance', icon: 'fa-clipboard-user', label: 'Attendance', description: 'Manage student attendance' },
        { id: 'entry', icon: 'fa-edit', label: 'Marks Entry', description: 'Enter and manage student marks' },
        { id: 'class-report', icon: 'fa-table', label: 'Class Report', description: 'Generate class performance reports' },
        { id: 'student-card', icon: 'fa-id-card', label: 'Score Cards', description: 'View individual student scorecards' },
        ...(currentUser?.role === 'admin' ? [
            { id: 'applications', icon: 'fa-file-signature', label: 'Applications', description: 'Process student revaluation and supplementary requests' } as NavigationItem,
            { id: 'management', icon: 'fa-sliders', label: 'Management', description: 'System administration and settings' } as NavigationItem
        ] : []),
    ];

    // Handle navigation item click
    const handleNavItemClick = (view: ViewType, label: string) => {
        setView(view);
        closeMobileMenu();
        screenReaderAnnouncer.announceNavigation(label);
    };

    // Handle logout click
    const handleLogoutClick = () => {
        onLogout();
        closeMobileMenu();
        screenReaderAnnouncer.announce('Logged out successfully', 'polite');
    };

    // Close menu on escape key and manage focus trap
    useEffect(() => {
        if (isMobileMenuOpen) {
            const menuElement = document.getElementById('mobile-navigation');
            if (menuElement) {
                // Enable focus trap
                const disableFocusTrap = keyboardNavigation.enableFocusTrap(menuElement);

                return () => {
                    disableFocusTrap();
                };
            }
        }
    }, [isMobileMenuOpen]);

    // Announce menu state changes
    useEffect(() => {
        if (isMobileMenuOpen) {
            screenReaderAnnouncer.announce('Navigation menu opened', 'polite');
        }
    }, [isMobileMenuOpen]);

    // Don't render on desktop
    if (!shouldShowMobileMenu) {
        return null;
    }

    const menuContent = (
        <>
            {/* Overlay */}
            <div
                className={`
          fixed inset-0 bg-black/50 backdrop-blur-sm z-[2000]
          transition-all duration-300 ease-in-out print:hidden
          ${isMobileMenuOpen
                        ? 'opacity-100 visible'
                        : 'opacity-0 invisible'
                    }
        `}
                onClick={closeMobileMenu}
                aria-hidden="true"
                role="presentation"
            />

            {/* Navigation Menu */}
            <nav
                id="mobile-navigation"
                className={`
          fixed top-0 left-0 bottom-0 w-80 max-w-[85vw]
          bg-slate-900/95 backdrop-blur-xl text-white z-[2001]
          transform transition-all duration-300 ease-in-out
          overflow-y-auto print:hidden shadow-2xl border-r border-slate-800
          ${isMobileMenuOpen ? 'translate-x-0 opacity-100' : '-translate-x-full opacity-0'}
        `}
                aria-label="Mobile navigation"
            >
                {/* Header */}
                <div className="p-8 pt-10 border-b border-slate-800/50">
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 bg-emerald-500 rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-500/20">
                                <i className="fa-solid fa-graduation-cap text-white text-2xl"></i>
                            </div>
                            <div>
                                <h1 className="text-lg font-black tracking-tighter leading-none">
                                    AIC Da'wa
                                </h1>
                                <p className="text-[10px] text-emerald-400 font-black uppercase tracking-[0.2em] mt-1">
                                    Exam Portal
                                </p>
                            </div>
                        </div>

                        {/* Close Button */}
                        <button
                            {...getTouchProps(closeMobileMenu)}
                            className="
                w-10 h-10 flex items-center justify-center
                text-slate-400 hover:text-white bg-slate-800/50
                rounded-xl transition-all duration-200
                touch-target-min border border-slate-700/50
              "
                            {...ariaHelpers.button('Close navigation menu')}
                        >
                            <i className="fa-solid fa-times text-lg" aria-hidden="true"></i>
                        </button>
                    </div>

                    {/* Cloud Status */}
                    <div className="mt-2">
                        {isCloudActive ? (
                            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 text-emerald-400 rounded-full border border-emerald-500/20">
                                <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.6)]"></div>
                                <span className="text-[9px] font-black uppercase tracking-wider">
                                    Cloud Active
                                </span>
                            </div>
                        ) : (
                            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-amber-500/10 text-amber-400 rounded-full border border-amber-500/20">
                                <div className="w-1.5 h-1.5 bg-amber-400 rounded-full"></div>
                                <span className="text-[9px] font-black uppercase tracking-wider">
                                    Offline Mode
                                </span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Navigation Items */}
                <div className="p-6 space-y-3 flex-1">
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-4 ml-2">Main Menu</p>
                    {navItems.map((item, index) => {
                        const isActive = activeView === item.id;
                        return (
                            <button
                                key={item.id}
                                {...getTouchProps(() => handleNavItemClick(item.id, item.label))}
                                className={`
                    w-full flex items-center gap-4 px-5 py-5 rounded-2xl
                    transition-all duration-300 text-left relative overflow-hidden group
                    ${isActive
                                        ? 'bg-emerald-600 text-white shadow-xl shadow-emerald-600/20'
                                        : 'text-slate-400 hover:bg-slate-800/50 hover:text-white'
                                    }
                  `}
                                {...ariaHelpers.button(
                                    `${item.label}. ${item.description || ''}`,
                                    undefined,
                                    undefined
                                )}
                                aria-current={isActive ? 'page' : undefined}
                            >
                                <div className={`w-10 h-10 flex items-center justify-center rounded-xl transition-all duration-300 ${
                                    isActive ? 'bg-white/20' : 'bg-slate-800/50 group-hover:bg-slate-700'
                                }`}>
                                    <i className={`fa-solid ${item.icon} ${isActive ? 'text-lg' : 'text-base'}`}></i>
                                </div>
                                <div className="flex-1">
                                    <span className={`font-black text-sm block ${isActive ? 'text-white' : 'text-slate-300'}`}>
                                        {item.label}
                                    </span>
                                    {item.description && !isActive && (
                                        <span className="text-[10px] text-slate-500 font-medium truncate block max-w-[180px]">
                                            {item.description}
                                        </span>
                                    )}
                                </div>

                                {isActive && (
                                    <div className="w-1.5 h-1.5 bg-white rounded-full shadow-[0_0_8px_rgba(255,255,255,0.8)]"></div>
                                )}
                            </button>
                        );
                    })}
                </div>

                {/* Footer */}
                <div className="p-6 mt-auto border-t border-slate-800/50 bg-slate-950/50 space-y-3">
                    <button
                        onClick={async () => {
                            closeMobileMenu();
                            await versionService.forceClearCacheAndReload();
                        }}
                        className="
                          w-full flex items-center gap-4 px-5 py-4 rounded-2xl
                          text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 active:bg-emerald-500/30
                          transition-all duration-300 border border-emerald-500/20
                          touch-target-min
                        "
                    >
                        <div className="w-10 h-10 bg-emerald-500/20 rounded-xl flex items-center justify-center">
                            <i className="fa-solid fa-arrows-rotate text-emerald-400"></i>
                        </div>
                        <span className="font-black text-sm uppercase tracking-widest">Update App & Clear Cache</span>
                    </button>

                    <button
                        {...getTouchProps(handleLogoutClick)}
                        className="
              w-full flex items-center gap-4 px-5 py-5 rounded-2xl
              text-red-400 bg-red-500/5 hover:bg-red-500/10 active:bg-red-500/20
              transition-all duration-300 border border-red-500/10
              touch-target-min
            "
                        {...ariaHelpers.button('Exit admin panel and return to public portal')}
                    >
                        <div className="w-10 h-10 bg-red-500/10 rounded-xl flex items-center justify-center">
                            <i className="fa-solid fa-right-from-bracket text-base"></i>
                        </div>
                        <span className="font-black text-sm uppercase tracking-widest">Sign Out</span>
                    </button>
                </div>
            </nav>
        </>
    );

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
                {...ariaHelpers.button(
                    isMobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu',
                    isMobileMenuOpen,
                    'mobile-navigation'
                )}
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

            {createPortal(menuContent, document.body)}
        </>
    );
};

export default HamburgerMenu;