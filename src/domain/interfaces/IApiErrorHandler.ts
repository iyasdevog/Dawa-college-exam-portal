import { TimeRange } from './IErrorReporter';

/**
 * Domain interface for API error handling and retry mechanisms
 * Implements Requirements 5.2 - API error handling and retry mechanisms
 * Part of Clean Architecture - Domain layer defines contracts for infrastructure
 */

export type ApiErrorType =
    | 'network_error'
    | 'timeout_error'
    | 'server_error'
    | 'client_error'
    | 'authentication_error'
    | 'authorization_error'
    | 'rate_limit_error'
    | 'validation_error'
    | 'unknown_error';

export interface ApiError {
    type: ApiErrorType;
    message: string;
    statusCode?: number;
    originalError?: Error;
    endpoint?: string;
    method?: string;
    timestamp: Date;
    retryCount: number;
    isRetryable: boolean;
}

export interface RetryConfig {
    maxRetries: number;
    baseDelay: number; // milliseconds
    maxDelay: number; // milliseconds
    backoffMultiplier: number;
    retryableErrors: ApiErrorType[];
    retryableStatusCodes: number[];
}

export interface CircuitBreakerConfig {
    failureThreshold: number; // number of failures before opening circuit
    recoveryTimeout: number; // milliseconds to wait before trying again
    monitoringPeriod: number; // milliseconds to monitor for failures
}

export interface CircuitBreakerState {
    state: 'closed' | 'open' | 'half-open';
    failureCount: number;
    lastFailureTime?: Date;
    nextAttemptTime?: Date;
}

export interface ApiRequest<T = any> {
    url: string;
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
    headers?: Record<string, string>;
    body?: T;
    timeout?: number;
}

export interface ApiResponse<T = any> {
    data: T;
    status: number;
    statusText: string;
    headers: Record<string, string>;
}

export interface IApiErrorHandler {
    /**
     * Execute API request with error handling and retry logic
     */
    executeRequest<T = any, R = any>(
        request: ApiRequest<T>,
        retryConfig?: Partial<RetryConfig>
    ): Promise<ApiResponse<R>>;

    /**
     * Handle API error and determine if retry should be attempted
     */
    handleError(error: Error, context: {
        endpoint: string;
        method: string;
        retryCount: number;
    }): ApiError;

    /**
     * Check if error is retryable based on configuration
     */
    isRetryableError(error: ApiError): boolean;

    /**
     * Calculate delay for next retry attempt (exponential backoff)
     */
    calculateRetryDelay(retryCount: number, config: RetryConfig): number;

    /**
     * Get circuit breaker state for an endpoint
     */
    getCircuitBreakerState(endpoint: string): CircuitBreakerState;

    /**
     * Record successful request (resets circuit breaker if needed)
     */
    recordSuccess(endpoint: string): void;

    /**
     * Record failed request (updates circuit breaker state)
     */
    recordFailure(endpoint: string, error: ApiError): void;

    /**
     * Check if circuit breaker allows request
     */
    canExecuteRequest(endpoint: string): boolean;

    /**
     * Get user-friendly error message for display
     */
    getUserFriendlyMessage(error: ApiError): string;

    /**
     * Get error statistics for monitoring
     */
    getErrorStatistics(timeRange?: TimeRange): Promise<ApiErrorStatistics>;
}

export interface ApiErrorStatistics {
    totalRequests: number;
    totalErrors: number;
    errorRate: number;
    errorsByType: Record<ApiErrorType, number>;
    errorsByEndpoint: Record<string, {
        totalRequests: number;
        totalErrors: number;
        errorRate: number;
        averageResponseTime: number;
        circuitBreakerState: CircuitBreakerState;
    }>;
    retryStatistics: {
        totalRetries: number;
        successfulRetries: number;
        failedRetries: number;
        averageRetryCount: number;
    };
}