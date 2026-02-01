import React, { Component, ErrorInfo, ReactNode } from 'react';
import { IErrorReporter } from '../../domain/interfaces/IErrorReporter';

interface Props {
    children: ReactNode;
    fallback?: ReactNode;
    onError?: (error: Error, errorInfo: ErrorInfo) => void;
    errorReporter?: IErrorReporter;
    level: 'application' | 'feature' | 'component';
    featureName?: string;
}

interface State {
    hasError: boolean;
    error: Error | null;
    errorInfo: ErrorInfo | null;
    errorId: string | null;
}

/**
 * Application-level Error Boundary Component
 * Implements Requirements 5.1, 5.5 - Comprehensive error boundaries with graceful degradation
 * Validates Property 13: Error Boundary Protection
 */
export class ApplicationErrorBoundary extends Component<Props, State> {
    private retryCount = 0;
    private readonly maxRetries = 3;

    constructor(props: Props) {
        super(props);
        this.state = {
            hasError: false,
            error: null,
            errorInfo: null,
            errorId: null
        };
    }

    static getDerivedStateFromError(error: Error): Partial<State> {
        // Update state so the next render will show the fallback UI
        return {
            hasError: true,
            error,
            errorId: `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        // Log error details
        console.error(`[${this.props.level.toUpperCase()} ERROR BOUNDARY]`, {
            error: error.message,
            stack: error.stack,
            componentStack: errorInfo.componentStack,
            featureName: this.props.featureName,
            errorId: this.state.errorId,
            timestamp: new Date().toISOString(),
            retryCount: this.retryCount
        });

        // Update state with error info
        this.setState({
            errorInfo
        });

        // Report error through domain service if available
        if (this.props.errorReporter) {
            this.props.errorReporter.reportError({
                id: this.state.errorId || 'unknown',
                type: 'javascript_error',
                severity: this.props.level === 'application' ? 'critical' : 'high',
                message: error.message,
                stack: error.stack,
                context: {
                    component: this.props.featureName || 'unknown',
                    componentStack: errorInfo.componentStack,
                    level: this.props.level,
                    retryCount: this.retryCount,
                    userAgent: navigator.userAgent,
                    url: window.location.href
                },
                timestamp: new Date(),
                userId: undefined // Will be populated by error reporter if available
            });
        }

        // Call custom error handler if provided
        if (this.props.onError) {
            this.props.onError(error, errorInfo);
        }
    }

    handleRetry = () => {
        if (this.retryCount < this.maxRetries) {
            this.retryCount++;
            console.log(`[${this.props.level.toUpperCase()} ERROR BOUNDARY] Retry attempt ${this.retryCount}/${this.maxRetries}`);

            this.setState({
                hasError: false,
                error: null,
                errorInfo: null,
                errorId: null
            });
        }
    };

    handleReload = () => {
        window.location.reload();
    };

    render() {
        if (this.state.hasError) {
            // Custom fallback UI provided
            if (this.props.fallback) {
                return this.props.fallback;
            }

            // Default fallback UI based on error boundary level
            return this.renderDefaultFallback();
        }

        return this.props.children;
    }

    private renderDefaultFallback() {
        const { level, featureName } = this.props;
        const { error, errorId } = this.state;
        const canRetry = this.retryCount < this.maxRetries;

        if (level === 'application') {
            return (
                <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
                    <div className="max-w-md w-full bg-white rounded-2xl shadow-lg p-8 text-center">
                        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
                            <i className="fa-solid fa-exclamation-triangle text-red-600 text-2xl"></i>
                        </div>

                        <h1 className="text-xl font-bold text-slate-900 mb-2">
                            Application Error
                        </h1>

                        <p className="text-slate-600 mb-6">
                            The application encountered an unexpected error. Our team has been notified.
                        </p>

                        <div className="bg-slate-50 rounded-lg p-4 mb-6 text-left">
                            <p className="text-xs font-mono text-slate-500 mb-2">Error ID: {errorId}</p>
                            <p className="text-sm text-slate-700">{error?.message}</p>
                        </div>

                        <div className="space-y-3">
                            {canRetry && (
                                <button
                                    onClick={this.handleRetry}
                                    className="w-full bg-emerald-600 text-white py-3 rounded-xl font-bold hover:bg-emerald-700 transition-colors"
                                >
                                    Try Again ({this.maxRetries - this.retryCount} attempts left)
                                </button>
                            )}

                            <button
                                onClick={this.handleReload}
                                className="w-full bg-slate-200 text-slate-700 py-3 rounded-xl font-bold hover:bg-slate-300 transition-colors"
                            >
                                Reload Application
                            </button>
                        </div>
                    </div>
                </div>
            );
        }

        if (level === 'feature') {
            return (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 m-4">
                    <div className="flex items-start gap-4">
                        <div className="w-8 h-8 bg-amber-100 rounded-full flex items-center justify-center flex-shrink-0">
                            <i className="fa-solid fa-exclamation-triangle text-amber-600"></i>
                        </div>

                        <div className="flex-1">
                            <h3 className="font-bold text-amber-900 mb-2">
                                {featureName ? `${featureName} Unavailable` : 'Feature Unavailable'}
                            </h3>

                            <p className="text-amber-800 text-sm mb-4">
                                This feature is temporarily unavailable due to a technical issue.
                            </p>

                            <div className="bg-amber-100 rounded-lg p-3 mb-4">
                                <p className="text-xs font-mono text-amber-700 mb-1">Error ID: {errorId}</p>
                                <p className="text-xs text-amber-800">{error?.message}</p>
                            </div>

                            <div className="flex gap-2">
                                {canRetry && (
                                    <button
                                        onClick={this.handleRetry}
                                        className="px-4 py-2 bg-amber-600 text-white rounded-lg font-medium hover:bg-amber-700 transition-colors text-sm"
                                    >
                                        Retry ({this.maxRetries - this.retryCount} left)
                                    </button>
                                )}

                                <button
                                    onClick={() => window.location.reload()}
                                    className="px-4 py-2 bg-amber-200 text-amber-800 rounded-lg font-medium hover:bg-amber-300 transition-colors text-sm"
                                >
                                    Refresh Page
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            );
        }

        // Component level error boundary
        return (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 m-2">
                <div className="flex items-center gap-3">
                    <i className="fa-solid fa-exclamation-circle text-red-500"></i>
                    <div className="flex-1">
                        <p className="text-red-800 font-medium text-sm">Component Error</p>
                        <p className="text-red-600 text-xs">{error?.message}</p>
                    </div>
                    {canRetry && (
                        <button
                            onClick={this.handleRetry}
                            className="px-3 py-1 bg-red-600 text-white rounded text-xs font-medium hover:bg-red-700 transition-colors"
                        >
                            Retry
                        </button>
                    )}
                </div>
            </div>
        );
    }
}

/**
 * Feature-level Error Boundary Component
 * Wraps major application features with isolated error handling
 */
export const FeatureErrorBoundary: React.FC<{
    children: ReactNode;
    featureName: string;
    errorReporter?: IErrorReporter;
    onError?: (error: Error, errorInfo: ErrorInfo) => void;
}> = ({ children, featureName, errorReporter, onError }) => {
    return (
        <ApplicationErrorBoundary
            level="feature"
            featureName={featureName}
            errorReporter={errorReporter}
            onError={onError}
        >
            {children}
        </ApplicationErrorBoundary>
    );
};

/**
 * Component-level Error Boundary Component
 * Wraps individual components with lightweight error handling
 */
export const ComponentErrorBoundary: React.FC<{
    children: ReactNode;
    componentName?: string;
    errorReporter?: IErrorReporter;
}> = ({ children, componentName, errorReporter }) => {
    return (
        <ApplicationErrorBoundary
            level="component"
            featureName={componentName}
            errorReporter={errorReporter}
        >
            {children}
        </ApplicationErrorBoundary>
    );
};

export default ApplicationErrorBoundary;