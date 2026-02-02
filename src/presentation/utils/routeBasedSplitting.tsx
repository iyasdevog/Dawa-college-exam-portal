import React, { Suspense, lazy, ComponentType } from 'react';

/**
 * Route-based code splitting utilities
 * This module provides utilities for implementing route-based code splitting
 * to optimize bundle sizes and improve initial load performance
 */

// Loading fallback component for route-based splits
const RouteLoadingFallback: React.FC<{ routeName: string }> = ({ routeName }) => (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-8">
        <div className="loader-ring mb-8"></div>
        <h2 className="text-white text-xl font-black tracking-tighter">Loading {routeName}</h2>
        <p className="text-emerald-400 text-[10px] font-black uppercase tracking-[0.3em] mt-4 animate-pulse">
            Route-Based Optimization
        </p>
    </div>
);

// Error boundary for route loading failures
interface RouteErrorBoundaryState {
    hasError: boolean;
    error?: Error;
}

class RouteErrorBoundary extends React.Component<
    { children: React.ReactNode; routeName: string; onRetry: () => void },
    RouteErrorBoundaryState
> {
    constructor(props: { children: React.ReactNode; routeName: string; onRetry: () => void }) {
        super(props);
        this.state = { hasError: false };
    }

    static getDerivedStateFromError(error: Error): RouteErrorBoundaryState {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
        console.error(`Route loading error for ${this.props.routeName}:`, error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-8">
                    <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mb-8">
                        <i className="fa-solid fa-exclamation-triangle text-red-400 text-2xl"></i>
                    </div>
                    <h2 className="text-white text-xl font-black tracking-tighter mb-4">
                        Failed to Load {this.props.routeName}
                    </h2>
                    <p className="text-red-400 text-sm mb-8 text-center max-w-md">
                        {this.state.error?.message || 'An error occurred while loading this route'}
                    </p>
                    <button
                        onClick={() => {
                            this.setState({ hasError: false });
                            this.props.onRetry();
                        }}
                        className="px-6 py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-colors"
                    >
                        Retry Loading
                    </button>
                </div>
            );
        }

        return this.props.children;
    }
}

/**
 * Higher-order component for route-based code splitting
 * Wraps lazy-loaded components with proper error boundaries and loading states
 */
export function withRouteSplitting<P extends object>(
    importFn: () => Promise<{ default: ComponentType<P> }>,
    routeName: string,
    preloadCondition?: () => boolean
) {
    // Create lazy component
    const LazyComponent = lazy(importFn);

    // Preload component if condition is met
    if (preloadCondition && preloadCondition()) {
        // Preload in the background
        importFn().catch(error => {
            console.warn(`Failed to preload route ${routeName}:`, error);
        });
    }

    // Return wrapped component
    return React.forwardRef<any, P>((props, ref) => {
        const handleRetry = () => {
            // Force re-render to retry loading
            window.location.reload();
        };

        return (
            <RouteErrorBoundary routeName={routeName} onRetry={handleRetry}>
                <Suspense fallback={<RouteLoadingFallback routeName={routeName} />}>
                    <LazyComponent {...props} ref={ref} />
                </Suspense>
            </RouteErrorBoundary>
        );
    });
}

/**
 * Preload routes based on user interaction patterns
 */
export const preloadRoutes = {
    /**
     * Preload admin routes when user shows intent to access admin features
     */
    admin: () => {
        // Preload admin components
        import('../../components/Dashboard').catch(() => { });
        import('../../components/FacultyEntry').catch(() => { });
        import('../../components/Management').catch(() => { });
    },

    /**
     * Preload public routes when user accesses public portal
     */
    public: () => {
        // Preload public components
        import('../../components/PublicPortal').catch(() => { });
        import('../../components/ClassResults').catch(() => { });
        import('../../components/StudentScorecard').catch(() => { });
    },

    /**
     * Preload reporting routes when user navigates to reports
     */
    reports: () => {
        // Preload reporting components
        import('../../components/ClassResults').catch(() => { });
        import('../../components/StudentScorecard').catch(() => { });
    }
};

/**
 * Route-based splitting configuration
 * Defines which routes should be split and their preload conditions
 */
export const routeConfig = {
    dashboard: {
        component: () => import('../../components/Dashboard'),
        preload: () => {
            // Preload dashboard when user is authenticated
            return localStorage.getItem('isAuthenticated') === 'true';
        }
    },
    facultyEntry: {
        component: () => import('../../components/FacultyEntry'),
        preload: () => {
            // Preload when user has admin privileges
            return localStorage.getItem('userRole') === 'admin';
        }
    },
    management: {
        component: () => import('../../components/Management'),
        preload: () => {
            // Preload when user has admin privileges
            return localStorage.getItem('userRole') === 'admin';
        }
    },
    publicPortal: {
        component: () => import('../../components/PublicPortal'),
        preload: () => {
            // Always preload public portal as it's the entry point
            return true;
        }
    },
    classResults: {
        component: () => import('../../components/ClassResults'),
        preload: () => {
            // Preload when user is viewing results
            return window.location.hash.includes('results');
        }
    },
    studentScorecard: {
        component: () => import('../../components/StudentScorecard'),
        preload: () => {
            // Preload when user is viewing student details
            return window.location.hash.includes('student');
        }
    }
};

/**
 * Create route components with splitting
 */
export const createSplitRoutes = () => {
    return {
        Dashboard: withRouteSplitting(
            routeConfig.dashboard.component,
            'Dashboard',
            routeConfig.dashboard.preload
        ),
        FacultyEntry: withRouteSplitting(
            routeConfig.facultyEntry.component,
            'Faculty Entry',
            routeConfig.facultyEntry.preload
        ),
        Management: withRouteSplitting(
            routeConfig.management.component,
            'Management',
            routeConfig.management.preload
        ),
        PublicPortal: withRouteSplitting(
            routeConfig.publicPortal.component,
            'Public Portal',
            routeConfig.publicPortal.preload
        ),
        ClassResults: withRouteSplitting(
            routeConfig.classResults.component,
            'Class Results',
            routeConfig.classResults.preload
        ),
        StudentScorecard: withRouteSplitting(
            routeConfig.studentScorecard.component,
            'Student Scorecard',
            routeConfig.studentScorecard.preload
        )
    };
};

/**
 * Bundle analysis helper
 * Provides information about loaded chunks for debugging
 */
export const bundleAnalysis = {
    getLoadedChunks: () => {
        // This would be populated by webpack/vite chunk loading
        return Object.keys(window as any).filter(key => key.startsWith('__webpack'));
    },

    logChunkInfo: () => {
        console.group('Bundle Analysis');
        console.log('Loaded chunks:', bundleAnalysis.getLoadedChunks());
        console.log('Performance entries:', performance.getEntriesByType('navigation'));
        console.groupEnd();
    }
};