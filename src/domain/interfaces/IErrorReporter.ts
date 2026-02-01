/**
 * Domain interface for error reporting service
 * Implements Requirements 5.3, 5.4 - Performance monitoring and secure error logging
 * Part of Clean Architecture - Domain layer defines contracts for infrastructure
 */

export type ErrorType =
    | 'javascript_error'
    | 'api_error'
    | 'network_error'
    | 'validation_error'
    | 'authentication_error'
    | 'authorization_error'
    | 'performance_error'
    | 'security_error';

export type ErrorSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface ErrorContext {
    component?: string;
    action?: string;
    url?: string;
    userAgent?: string;
    componentStack?: string;
    level?: string;
    retryCount?: number;
    additionalData?: Record<string, any>;
}

export interface ApplicationError {
    id: string;
    type: ErrorType;
    severity: ErrorSeverity;
    message: string;
    stack?: string;
    context: ErrorContext;
    timestamp: Date;
    userId?: string;
}

export interface IErrorReporter {
    /**
     * Report an error to the monitoring system
     * Must not expose sensitive data in logs
     */
    reportError(error: ApplicationError): Promise<void>;

    /**
     * Report a performance metric
     */
    reportPerformanceMetric(metric: PerformanceMetric): Promise<void>;

    /**
     * Report a security event
     */
    reportSecurityEvent(event: SecurityEvent): Promise<void>;

    /**
     * Get error statistics for monitoring
     */
    getErrorStatistics(timeRange?: TimeRange): Promise<ErrorStatistics>;
}

export interface PerformanceMetric {
    id: string;
    name: string;
    value: number;
    unit: 'ms' | 'bytes' | 'count' | 'percentage';
    timestamp: Date;
    context?: Record<string, any>;
}

export interface SecurityEvent {
    id: string;
    type: 'authentication_failure' | 'authorization_violation' | 'suspicious_activity' | 'data_breach_attempt';
    severity: ErrorSeverity;
    description: string;
    timestamp: Date;
    userId?: string;
    ipAddress?: string;
    userAgent?: string;
}

export interface TimeRange {
    start: Date;
    end: Date;
}

export interface ErrorStatistics {
    totalErrors: number;
    errorsByType: Record<ErrorType, number>;
    errorsBySeverity: Record<ErrorSeverity, number>;
    topErrors: Array<{
        message: string;
        count: number;
        lastOccurrence: Date;
    }>;
    performanceMetrics: {
        averageResponseTime: number;
        errorRate: number;
        uptime: number;
    };
}