import {
    IErrorReporter,
    ApplicationError,
    PerformanceMetric,
    SecurityEvent,
    TimeRange,
    ErrorStatistics,
    ErrorType,
    ErrorSeverity
} from '../../domain/interfaces/IErrorReporter';

/**
 * Infrastructure implementation of error reporting service
 * Implements Requirements 5.3, 5.4 - Performance monitoring and secure error logging
 * Validates Property 15: Secure Error Logging
 */
export class ErrorReportingService implements IErrorReporter {
    private errors: ApplicationError[] = [];
    private performanceMetrics: PerformanceMetric[] = [];
    private securityEvents: SecurityEvent[] = [];
    private readonly maxStoredErrors = 1000;
    private readonly maxStoredMetrics = 500;
    private readonly maxStoredEvents = 200;

    // Sensitive data patterns to filter out
    private readonly sensitivePatterns = [
        /password/i,
        /token/i,
        /api[_-]?key/i,
        /secret/i,
        /credential/i,
        /auth/i,
        /session/i,
        /cookie/i,
        /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/, // Credit card numbers
        /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/, // Email addresses
        /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/, // Phone numbers
    ];

    async reportError(error: ApplicationError): Promise<void> {
        try {
            // Sanitize error data to remove sensitive information
            const sanitizedError = this.sanitizeError(error);

            // Add to local storage with rotation
            this.errors.push(sanitizedError);
            if (this.errors.length > this.maxStoredErrors) {
                this.errors = this.errors.slice(-this.maxStoredErrors);
            }

            // Log to console in development
            if (process.env.NODE_ENV === 'development') {
                console.error('[ERROR REPORTER]', {
                    id: sanitizedError.id,
                    type: sanitizedError.type,
                    severity: sanitizedError.severity,
                    message: sanitizedError.message,
                    context: sanitizedError.context,
                    timestamp: sanitizedError.timestamp
                });
            }

            // In production, this would send to external monitoring service
            // Example: Sentry, LogRocket, DataDog, etc.
            if (process.env.NODE_ENV === 'production') {
                await this.sendToExternalService(sanitizedError);
            }

            // Store in localStorage for offline capability
            this.persistToLocalStorage('errors', this.errors.slice(-100)); // Keep last 100 errors

        } catch (reportingError) {
            // Fail silently to avoid infinite error loops
            console.warn('[ERROR REPORTER] Failed to report error:', reportingError);
        }
    }

    async reportPerformanceMetric(metric: PerformanceMetric): Promise<void> {
        try {
            // Add to local storage with rotation
            this.performanceMetrics.push(metric);
            if (this.performanceMetrics.length > this.maxStoredMetrics) {
                this.performanceMetrics = this.performanceMetrics.slice(-this.maxStoredMetrics);
            }

            // Log significant performance issues
            if (this.isPerformanceIssue(metric)) {
                console.warn('[PERFORMANCE ALERT]', {
                    name: metric.name,
                    value: metric.value,
                    unit: metric.unit,
                    timestamp: metric.timestamp
                });
            }

            // Store in localStorage
            this.persistToLocalStorage('performance', this.performanceMetrics.slice(-50));

        } catch (error) {
            console.warn('[ERROR REPORTER] Failed to report performance metric:', error);
        }
    }

    async reportSecurityEvent(event: SecurityEvent): Promise<void> {
        try {
            // Sanitize security event data
            const sanitizedEvent = this.sanitizeSecurityEvent(event);

            // Add to local storage with rotation
            this.securityEvents.push(sanitizedEvent);
            if (this.securityEvents.length > this.maxStoredEvents) {
                this.securityEvents = this.securityEvents.slice(-this.maxStoredEvents);
            }

            // Always log security events
            console.warn('[SECURITY EVENT]', {
                id: sanitizedEvent.id,
                type: sanitizedEvent.type,
                severity: sanitizedEvent.severity,
                description: sanitizedEvent.description,
                timestamp: sanitizedEvent.timestamp
            });

            // Store in localStorage
            this.persistToLocalStorage('security', this.securityEvents.slice(-20));

            // In production, immediately send critical security events
            if (event.severity === 'critical' && process.env.NODE_ENV === 'production') {
                await this.sendSecurityAlert(sanitizedEvent);
            }

        } catch (error) {
            console.warn('[ERROR REPORTER] Failed to report security event:', error);
        }
    }

    async getErrorStatistics(timeRange?: TimeRange): Promise<ErrorStatistics> {
        const filteredErrors = timeRange
            ? this.errors.filter(error =>
                error.timestamp >= timeRange.start && error.timestamp <= timeRange.end
            )
            : this.errors;

        const errorsByType = filteredErrors.reduce((acc, error) => {
            acc[error.type] = (acc[error.type] || 0) + 1;
            return acc;
        }, {} as Record<ErrorType, number>);

        const errorsBySeverity = filteredErrors.reduce((acc, error) => {
            acc[error.severity] = (acc[error.severity] || 0) + 1;
            return acc;
        }, {} as Record<ErrorSeverity, number>);

        // Get top errors by frequency
        const errorCounts = filteredErrors.reduce((acc, error) => {
            const key = error.message;
            if (!acc[key]) {
                acc[key] = { count: 0, lastOccurrence: error.timestamp };
            }
            acc[key].count++;
            if (error.timestamp > acc[key].lastOccurrence) {
                acc[key].lastOccurrence = error.timestamp;
            }
            return acc;
        }, {} as Record<string, { count: number; lastOccurrence: Date }>);

        const topErrors = Object.entries(errorCounts)
            .map(([message, data]) => ({ message, ...data }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 10);

        // Calculate performance metrics
        const recentMetrics = this.performanceMetrics.slice(-100);
        const averageResponseTime = recentMetrics.length > 0
            ? recentMetrics.reduce((sum, metric) => sum + metric.value, 0) / recentMetrics.length
            : 0;

        const totalRequests = recentMetrics.length;
        const errorRate = totalRequests > 0 ? (filteredErrors.length / totalRequests) * 100 : 0;

        return {
            totalErrors: filteredErrors.length,
            errorsByType,
            errorsBySeverity,
            topErrors,
            performanceMetrics: {
                averageResponseTime,
                errorRate,
                uptime: this.calculateUptime()
            }
        };
    }

    private sanitizeError(error: ApplicationError): ApplicationError {
        return {
            ...error,
            message: this.sanitizeString(error.message),
            stack: error.stack ? this.sanitizeString(error.stack) : undefined,
            context: {
                ...error.context,
                additionalData: error.context.additionalData
                    ? this.sanitizeObject(error.context.additionalData)
                    : undefined
            }
        };
    }

    private sanitizeSecurityEvent(event: SecurityEvent): SecurityEvent {
        return {
            ...event,
            description: this.sanitizeString(event.description),
            // Remove sensitive IP information in production
            ipAddress: process.env.NODE_ENV === 'production'
                ? this.maskIpAddress(event.ipAddress)
                : event.ipAddress
        };
    }

    private sanitizeString(input: string): string {
        let sanitized = input;

        this.sensitivePatterns.forEach(pattern => {
            sanitized = sanitized.replace(pattern, '[REDACTED]');
        });

        return sanitized;
    }

    private sanitizeObject(obj: Record<string, any>): Record<string, any> {
        const sanitized: Record<string, any> = {};

        for (const [key, value] of Object.entries(obj)) {
            if (this.isSensitiveKey(key)) {
                sanitized[key] = '[REDACTED]';
            } else if (typeof value === 'string') {
                sanitized[key] = this.sanitizeString(value);
            } else if (typeof value === 'object' && value !== null) {
                sanitized[key] = this.sanitizeObject(value);
            } else {
                sanitized[key] = value;
            }
        }

        return sanitized;
    }

    private isSensitiveKey(key: string): boolean {
        return this.sensitivePatterns.some(pattern => pattern.test(key));
    }

    private maskIpAddress(ip?: string): string | undefined {
        if (!ip) return undefined;

        // Mask last octet of IPv4 addresses
        if (ip.includes('.')) {
            const parts = ip.split('.');
            if (parts.length === 4) {
                return `${parts[0]}.${parts[1]}.${parts[2]}.xxx`;
            }
        }

        // For IPv6 or other formats, just return masked
        return 'xxx.xxx.xxx.xxx';
    }

    private isPerformanceIssue(metric: PerformanceMetric): boolean {
        // Define performance thresholds
        const thresholds: Record<string, number> = {
            'response_time': 2000, // 2 seconds
            'load_time': 3000, // 3 seconds
            'memory_usage': 100 * 1024 * 1024, // 100MB
            'bundle_size': 5 * 1024 * 1024, // 5MB
        };

        const threshold = thresholds[metric.name];
        return threshold !== undefined && metric.value > threshold;
    }

    private calculateUptime(): number {
        // Simple uptime calculation based on error frequency
        const recentErrors = this.errors.filter(error =>
            error.timestamp > new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
        );

        const criticalErrors = recentErrors.filter(error => error.severity === 'critical').length;

        // Assume 99% uptime minus 1% for each critical error in last 24h
        return Math.max(0, 99 - criticalErrors);
    }

    private persistToLocalStorage(key: string, data: any[]): void {
        try {
            localStorage.setItem(`error_reporter_${key}`, JSON.stringify(data));
        } catch (error) {
            // Storage quota exceeded or not available
            console.warn(`[ERROR REPORTER] Failed to persist ${key} to localStorage:`, error);
        }
    }

    private async sendToExternalService(error: ApplicationError): Promise<void> {
        // In a real implementation, this would send to services like:
        // - Sentry: Sentry.captureException()
        // - LogRocket: LogRocket.captureException()
        // - DataDog: DD_LOGS.logger.error()
        // - Custom API endpoint

        console.log('[ERROR REPORTER] Would send to external service:', {
            id: error.id,
            type: error.type,
            severity: error.severity,
            timestamp: error.timestamp
        });
    }

    private async sendSecurityAlert(event: SecurityEvent): Promise<void> {
        // In a real implementation, this would immediately alert security team
        console.warn('[SECURITY ALERT] Critical security event:', {
            id: event.id,
            type: event.type,
            severity: event.severity,
            timestamp: event.timestamp
        });
    }

    // Public method to load persisted data on initialization
    public loadPersistedData(): void {
        try {
            const errors = localStorage.getItem('error_reporter_errors');
            if (errors) {
                this.errors = JSON.parse(errors);
            }

            const performance = localStorage.getItem('error_reporter_performance');
            if (performance) {
                this.performanceMetrics = JSON.parse(performance);
            }

            const security = localStorage.getItem('error_reporter_security');
            if (security) {
                this.securityEvents = JSON.parse(security);
            }
        } catch (error) {
            console.warn('[ERROR REPORTER] Failed to load persisted data:', error);
        }
    }

    // Public method to clear all stored data
    public clearAllData(): void {
        this.errors = [];
        this.performanceMetrics = [];
        this.securityEvents = [];

        localStorage.removeItem('error_reporter_errors');
        localStorage.removeItem('error_reporter_performance');
        localStorage.removeItem('error_reporter_security');
    }
}