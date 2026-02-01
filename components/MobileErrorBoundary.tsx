import React, { Component, ErrorInfo, ReactNode } from 'react';
import { performanceService } from '../services/performanceService';

interface Props {
    children: ReactNode;
    fallback?: ReactNode;
    onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
    hasError: boolean;
    error: Error | null;
    errorInfo: ErrorInfo | null;
    errorId: string | null;
}

/**
 * Mobile-optimized Error Boundary Component
 * Catches JavaScript errors in mobile components and provides user-friendly fallbacks
 */
export class MobileErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = {
            hasError: false,
            error: null,
            errorInfo: null,
            errorId: null,
        };
    }

    static getDerivedStateFromError(error: Error): Partial<State> {
        // Update state so the next render will show the fallback UI
        return {
            hasError: true,
            error,
            errorId: `ERR-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        // Log error to performance service
        performanceService.recordError({
            message: error.message,
            stack: error.stack,
            timestamp: Date.now(),
            userAgent: navigator.userAgent,
            url: window.location.href,
            componentStack: errorInfo.componentStack,
            errorBoundary: 'MobileErrorBoundary',
        });

        // Update state with error info
        this.setState({
            errorInfo,
        });

        // Call custom error handler if provided
        if (this.props.onError) {
            this.props.onError(error, errorInfo);
        }

        // Log to console for development
        console.error('🚨 Mobile Error Boundary caught an error:', error, errorInfo);
    }

    private handleRetry = () => {
        this.setState({
            hasError: false,
            error: null,
            errorInfo: null,
            errorId: null,
        });
    };

    private handleReportError = () => {
        const { error, errorInfo, errorId } = this.state;

        if (error && errorId) {
            // Create error report
            const errorReport = {
                errorId,
                message: error.message,
                stack: error.stack,
                componentStack: errorInfo?.componentStack,
                userAgent: navigator.userAgent,
                url: window.location.href,
                timestamp: new Date().toISOString(),
                performanceSummary: performanceService.getPerformanceSummary(),
            };

            // Copy to clipboard for easy reporting
            navigator.clipboard?.writeText(JSON.stringify(errorReport, null, 2))
                .then(() => {
                    alert('Error report copied to clipboard. Please share this with the technical team.');
                })
                .catch(() => {
                    // Fallback: show error details in alert
                    alert(`Error ID: ${errorId}\nPlease report this error to the technical team.`);
                });
        }
    };

    private isMobileDevice(): boolean {
        return performanceService.isMobileDevice();
    }

    render() {
        if (this.state.hasError) {
            // Custom fallback UI provided
            if (this.props.fallback) {
                return this.props.fallback;
            }

            // Default mobile-optimized error UI
            return (
                <div className="min-h-screen bg-gradient-to-br from-red-50 to-red-100 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-xl border-2 border-red-200 p-6 max-w-md w-full">
                        {/* Error Icon */}
                        <div className="text-center mb-6">
                            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                <i className="fa-solid fa-exclamation-triangle text-2xl text-red-600"></i>
                            </div>
                            <h2 className="text-xl font-bold text-red-800 mb-2">
                                Oops! Something went wrong
                            </h2>
                            <p className="text-red-600 text-sm">
                                {this.isMobileDevice()
                                    ? 'The mobile interface encountered an unexpected error.'
                                    : 'The application encountered an unexpected error.'
                                }
                            </p>
                        </div>

                        {/* Error Details (Development Mode) */}
                        {process.env.NODE_ENV === 'development' && this.state.error && (
                            <div className="mb-6 p-4 bg-red-50 rounded-lg border border-red-200">
                                <h3 className="font-bold text-red-800 text-sm mb-2">Error Details:</h3>
                                <p className="text-xs text-red-700 font-mono break-all">
                                    {this.state.error.message}
                                </p>
                                {this.state.errorId && (
                                    <p className="text-xs text-red-600 mt-2">
                                        Error ID: {this.state.errorId}
                                    </p>
                                )}
                            </div>
                        )}

                        {/* Mobile-Optimized Action Buttons */}
                        <div className="space-y-3">
                            <button
                                onClick={this.handleRetry}
                                className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold rounded-xl transition-all duration-200 transform active:scale-95 shadow-lg"
                                style={{ minHeight: '48px' }}
                            >
                                <i className="fa-solid fa-refresh mr-2"></i>
                                Try Again
                            </button>

                            <button
                                onClick={this.handleReportError}
                                className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold rounded-xl transition-all duration-200 transform active:scale-95 shadow-lg"
                                style={{ minHeight: '48px' }}
                            >
                                <i className="fa-solid fa-bug mr-2"></i>
                                Report Error
                            </button>

                            <button
                                onClick={() => window.location.reload()}
                                className="w-full py-3 px-4 bg-slate-600 hover:bg-slate-700 active:bg-slate-800 text-white font-bold rounded-xl transition-all duration-200 transform active:scale-95 shadow-lg"
                                style={{ minHeight: '48px' }}
                            >
                                <i className="fa-solid fa-rotate-right mr-2"></i>
                                Reload Page
                            </button>
                        </div>

                        {/* Help Text */}
                        <div className="mt-6 p-4 bg-slate-50 rounded-lg">
                            <h4 className="font-bold text-slate-700 text-sm mb-2">
                                <i className="fa-solid fa-lightbulb mr-1"></i>
                                What can you do?
                            </h4>
                            <ul className="text-xs text-slate-600 space-y-1">
                                <li>• Try refreshing the page</li>
                                <li>• Check your internet connection</li>
                                <li>• Clear your browser cache</li>
                                <li>• Report the error if it persists</li>
                            </ul>
                        </div>

                        {/* Performance Info (Development Mode) */}
                        {process.env.NODE_ENV === 'development' && (
                            <div className="mt-4 p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                                <h4 className="font-bold text-yellow-800 text-xs mb-2">Performance Info:</h4>
                                <div className="text-xs text-yellow-700 space-y-1">
                                    <div>Device: {this.isMobileDevice() ? 'Mobile' : 'Desktop'}</div>
                                    <div>Memory: {performanceService.getMemoryInfo()?.percentage.toFixed(1) || 'N/A'}%</div>
                                    <div>Performance Tier: {performanceService.getDevicePerformanceTier()}</div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

/**
 * Higher-order component for wrapping components with error boundary
 */
export function withMobileErrorBoundary<P extends object>(
    Component: React.ComponentType<P>,
    fallback?: ReactNode
) {
    return function WrappedComponent(props: P) {
        return (
            <MobileErrorBoundary fallback={fallback}>
                <Component {...props} />
            </MobileErrorBoundary>
        );
    };
}

export default MobileErrorBoundary;