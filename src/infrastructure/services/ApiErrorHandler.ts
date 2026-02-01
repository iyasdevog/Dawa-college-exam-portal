import {
    IApiErrorHandler,
    ApiError,
    ApiErrorType,
    ApiRequest,
    ApiResponse,
    RetryConfig,
    CircuitBreakerConfig,
    CircuitBreakerState,
    TimeRange,
    ApiErrorStatistics
} from '../../domain/interfaces/IApiErrorHandler';

/**
 * Infrastructure implementation of API error handling and retry mechanisms
 * Implements Requirements 5.2 - API error handling and retry mechanisms
 * Validates Property 14: API Error Handling
 */
export class ApiErrorHandler implements IApiErrorHandler {
    private circuitBreakers = new Map<string, CircuitBreakerState>();
    private errorHistory: Array<{ endpoint: string; error: ApiError; timestamp: Date }> = [];
    private requestHistory: Array<{ endpoint: string; success: boolean; responseTime: number; timestamp: Date }> = [];
    private readonly maxHistorySize = 1000;

    private readonly defaultRetryConfig: RetryConfig = {
        maxRetries: 3,
        baseDelay: 1000, // 1 second
        maxDelay: 30000, // 30 seconds
        backoffMultiplier: 2,
        retryableErrors: [
            'network_error',
            'timeout_error',
            'server_error',
            'rate_limit_error'
        ],
        retryableStatusCodes: [408, 429, 500, 502, 503, 504]
    };

    private readonly defaultCircuitBreakerConfig: CircuitBreakerConfig = {
        failureThreshold: 5,
        recoveryTimeout: 60000, // 1 minute
        monitoringPeriod: 300000 // 5 minutes
    };

    async executeRequest<T = any, R = any>(
        request: ApiRequest<T>,
        retryConfig?: Partial<RetryConfig>
    ): Promise<ApiResponse<R>> {
        const config = { ...this.defaultRetryConfig, ...retryConfig };
        const endpoint = this.getEndpointKey(request.url, request.method);

        // Check circuit breaker
        if (!this.canExecuteRequest(endpoint)) {
            const error = this.createApiError(
                'server_error',
                'Service temporarily unavailable due to repeated failures',
                503,
                new Error('Circuit breaker is open'),
                request.url,
                request.method,
                0
            );
            throw error;
        }

        let lastError: ApiError | null = null;
        const startTime = Date.now();

        for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
            try {
                // Add delay for retry attempts
                if (attempt > 0) {
                    const delay = this.calculateRetryDelay(attempt - 1, config);
                    await this.sleep(delay);
                }

                const response = await this.performRequest<T, R>(request);
                const responseTime = Date.now() - startTime;

                // Record successful request
                this.recordSuccess(endpoint);
                this.addToRequestHistory(endpoint, true, responseTime);

                return response;

            } catch (error) {
                const apiError = this.handleError(error as Error, {
                    endpoint: request.url,
                    method: request.method,
                    retryCount: attempt
                });

                lastError = apiError;

                // Check if error is retryable
                if (attempt < config.maxRetries && this.isRetryableError(apiError)) {
                    console.warn(`[API ERROR HANDLER] Retrying request (${attempt + 1}/${config.maxRetries}):`, {
                        endpoint: request.url,
                        method: request.method,
                        error: apiError.message,
                        nextRetryIn: this.calculateRetryDelay(attempt, config)
                    });
                    continue;
                }

                // Record failure and break retry loop
                this.recordFailure(endpoint, apiError);
                this.addToRequestHistory(endpoint, false, Date.now() - startTime);
                break;
            }
        }

        // All retries exhausted, throw the last error
        if (lastError) {
            throw lastError;
        }

        // This should never happen, but TypeScript requires it
        throw new Error('Unexpected error in API request execution');
    }

    handleError(error: Error, context: {
        endpoint: string;
        method: string;
        retryCount: number;
    }): ApiError {
        let errorType: ApiErrorType = 'unknown_error';
        let statusCode: number | undefined;
        let isRetryable = false;

        // Determine error type based on error characteristics
        if (error.name === 'TypeError' && error.message.includes('fetch')) {
            errorType = 'network_error';
            isRetryable = true;
        } else if (error.name === 'AbortError' || error.message.includes('timeout')) {
            errorType = 'timeout_error';
            isRetryable = true;
        } else if (error.message.includes('401') || error.message.includes('Unauthorized')) {
            errorType = 'authentication_error';
            statusCode = 401;
            isRetryable = false;
        } else if (error.message.includes('403') || error.message.includes('Forbidden')) {
            errorType = 'authorization_error';
            statusCode = 403;
            isRetryable = false;
        } else if (error.message.includes('429') || error.message.includes('rate limit')) {
            errorType = 'rate_limit_error';
            statusCode = 429;
            isRetryable = true;
        } else if (error.message.includes('400') || error.message.includes('Bad Request')) {
            errorType = 'validation_error';
            statusCode = 400;
            isRetryable = false;
        } else if (error.message.includes('5')) {
            errorType = 'server_error';
            statusCode = parseInt(error.message.match(/\d{3}/)?.[0] || '500');
            isRetryable = true;
        }

        const apiError: ApiError = {
            type: errorType,
            message: this.sanitizeErrorMessage(error.message),
            statusCode,
            originalError: error,
            endpoint: context.endpoint,
            method: context.method,
            timestamp: new Date(),
            retryCount: context.retryCount,
            isRetryable
        };

        // Add to error history
        this.addToErrorHistory(context.endpoint, apiError);

        return apiError;
    }

    isRetryableError(error: ApiError): boolean {
        return error.isRetryable &&
            this.defaultRetryConfig.retryableErrors.includes(error.type) &&
            (!error.statusCode || this.defaultRetryConfig.retryableStatusCodes.includes(error.statusCode));
    }

    calculateRetryDelay(retryCount: number, config: RetryConfig): number {
        const exponentialDelay = config.baseDelay * Math.pow(config.backoffMultiplier, retryCount);
        const jitteredDelay = exponentialDelay * (0.5 + Math.random() * 0.5); // Add jitter
        return Math.min(jitteredDelay, config.maxDelay);
    }

    getCircuitBreakerState(endpoint: string): CircuitBreakerState {
        const key = this.getEndpointKey(endpoint, 'GET'); // Use GET as default for state checking
        return this.circuitBreakers.get(key) || {
            state: 'closed',
            failureCount: 0
        };
    }

    recordSuccess(endpoint: string): void {
        const key = this.getEndpointKey(endpoint, 'GET');
        const state = this.circuitBreakers.get(key);

        if (state) {
            // Reset failure count and close circuit if it was half-open
            this.circuitBreakers.set(key, {
                state: 'closed',
                failureCount: 0,
                lastFailureTime: undefined,
                nextAttemptTime: undefined
            });
        }
    }

    recordFailure(endpoint: string, error: ApiError): void {
        const key = this.getEndpointKey(endpoint, error.method || 'GET');
        const currentState = this.circuitBreakers.get(key) || {
            state: 'closed' as const,
            failureCount: 0
        };

        const newFailureCount = currentState.failureCount + 1;
        const now = new Date();

        if (newFailureCount >= this.defaultCircuitBreakerConfig.failureThreshold) {
            // Open the circuit breaker
            this.circuitBreakers.set(key, {
                state: 'open',
                failureCount: newFailureCount,
                lastFailureTime: now,
                nextAttemptTime: new Date(now.getTime() + this.defaultCircuitBreakerConfig.recoveryTimeout)
            });

            console.warn(`[CIRCUIT BREAKER] Opened circuit for ${endpoint} after ${newFailureCount} failures`);
        } else {
            // Increment failure count
            this.circuitBreakers.set(key, {
                ...currentState,
                failureCount: newFailureCount,
                lastFailureTime: now
            });
        }
    }

    canExecuteRequest(endpoint: string): boolean {
        const key = this.getEndpointKey(endpoint, 'GET');
        const state = this.circuitBreakers.get(key);

        if (!state || state.state === 'closed') {
            return true;
        }

        if (state.state === 'open') {
            const now = new Date();
            if (state.nextAttemptTime && now >= state.nextAttemptTime) {
                // Move to half-open state
                this.circuitBreakers.set(key, {
                    ...state,
                    state: 'half-open'
                });
                return true;
            }
            return false;
        }

        // Half-open state - allow one request
        return true;
    }

    getUserFriendlyMessage(error: ApiError): string {
        const baseMessages: Record<ApiErrorType, string> = {
            network_error: 'Unable to connect to the server. Please check your internet connection and try again.',
            timeout_error: 'The request took too long to complete. Please try again.',
            server_error: 'The server is experiencing issues. Please try again in a few moments.',
            client_error: 'There was an issue with your request. Please check your input and try again.',
            authentication_error: 'Your session has expired. Please log in again.',
            authorization_error: 'You do not have permission to perform this action.',
            rate_limit_error: 'Too many requests. Please wait a moment before trying again.',
            validation_error: 'Please check your input and try again.',
            unknown_error: 'An unexpected error occurred. Please try again.'
        };

        let message = baseMessages[error.type] || baseMessages.unknown_error;

        // Add retry information if applicable
        if (error.isRetryable && error.retryCount > 0) {
            message += ` (Attempt ${error.retryCount + 1})`;
        }

        return message;
    }

    async getErrorStatistics(timeRange?: TimeRange): Promise<ApiErrorStatistics> {
        const now = new Date();
        const defaultStart = new Date(now.getTime() - 24 * 60 * 60 * 1000); // Last 24 hours
        const start = timeRange?.start || defaultStart;
        const end = timeRange?.end || now;

        const filteredErrors = this.errorHistory.filter(entry =>
            entry.timestamp >= start && entry.timestamp <= end
        );

        const filteredRequests = this.requestHistory.filter(entry =>
            entry.timestamp >= start && entry.timestamp <= end
        );

        const totalRequests = filteredRequests.length;
        const totalErrors = filteredErrors.length;
        const errorRate = totalRequests > 0 ? (totalErrors / totalRequests) * 100 : 0;

        // Group errors by type
        const errorsByType = filteredErrors.reduce((acc, entry) => {
            acc[entry.error.type] = (acc[entry.error.type] || 0) + 1;
            return acc;
        }, {} as Record<ApiErrorType, number>);

        // Group by endpoint
        const endpointStats = new Map<string, {
            totalRequests: number;
            totalErrors: number;
            errorRate: number;
            averageResponseTime: number;
            circuitBreakerState: CircuitBreakerState;
        }>();

        // Calculate endpoint statistics
        for (const request of filteredRequests) {
            const endpoint = request.endpoint;
            const stats = endpointStats.get(endpoint) || {
                totalRequests: 0,
                totalErrors: 0,
                errorRate: 0,
                averageResponseTime: 0,
                circuitBreakerState: this.getCircuitBreakerState(endpoint)
            };

            stats.totalRequests++;
            if (!request.success) {
                stats.totalErrors++;
            }
            stats.averageResponseTime = (stats.averageResponseTime * (stats.totalRequests - 1) + request.responseTime) / stats.totalRequests;
            stats.errorRate = (stats.totalErrors / stats.totalRequests) * 100;

            endpointStats.set(endpoint, stats);
        }

        // Calculate retry statistics
        const totalRetries = filteredErrors.reduce((sum, entry) => sum + entry.error.retryCount, 0);
        const successfulRetries = filteredErrors.filter(entry => entry.error.retryCount > 0).length;
        const failedRetries = totalRetries - successfulRetries;
        const averageRetryCount = filteredErrors.length > 0 ? totalRetries / filteredErrors.length : 0;

        return {
            totalRequests,
            totalErrors,
            errorRate,
            errorsByType,
            errorsByEndpoint: Object.fromEntries(endpointStats),
            retryStatistics: {
                totalRetries,
                successfulRetries,
                failedRetries,
                averageRetryCount
            }
        };
    }

    private async performRequest<T, R>(request: ApiRequest<T>): Promise<ApiResponse<R>> {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), request.timeout || 30000);

        try {
            const response = await fetch(request.url, {
                method: request.method,
                headers: {
                    'Content-Type': 'application/json',
                    ...request.headers
                },
                body: request.body ? JSON.stringify(request.body) : undefined,
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();

            return {
                data,
                status: response.status,
                statusText: response.statusText,
                headers: Object.fromEntries(response.headers.entries())
            };

        } catch (error) {
            clearTimeout(timeoutId);
            throw error;
        }
    }

    private createApiError(
        type: ApiErrorType,
        message: string,
        statusCode: number | undefined,
        originalError: Error,
        endpoint: string,
        method: string,
        retryCount: number
    ): ApiError {
        return {
            type,
            message,
            statusCode,
            originalError,
            endpoint,
            method,
            timestamp: new Date(),
            retryCount,
            isRetryable: this.defaultRetryConfig.retryableErrors.includes(type)
        };
    }

    private getEndpointKey(url: string, method: string): string {
        // Extract base endpoint without query parameters
        const baseUrl = url.split('?')[0];
        return `${method.toUpperCase()}:${baseUrl}`;
    }

    private sanitizeErrorMessage(message: string): string {
        // Remove sensitive information from error messages
        return message
            .replace(/api[_-]?key[=:]\s*[^\s&]+/gi, 'api_key=[REDACTED]')
            .replace(/token[=:]\s*[^\s&]+/gi, 'token=[REDACTED]')
            .replace(/password[=:]\s*[^\s&]+/gi, 'password=[REDACTED]')
            .replace(/secret[=:]\s*[^\s&]+/gi, 'secret=[REDACTED]');
    }

    private addToErrorHistory(endpoint: string, error: ApiError): void {
        this.errorHistory.push({
            endpoint,
            error,
            timestamp: new Date()
        });

        // Maintain history size limit
        if (this.errorHistory.length > this.maxHistorySize) {
            this.errorHistory = this.errorHistory.slice(-this.maxHistorySize);
        }
    }

    private addToRequestHistory(endpoint: string, success: boolean, responseTime: number): void {
        this.requestHistory.push({
            endpoint,
            success,
            responseTime,
            timestamp: new Date()
        });

        // Maintain history size limit
        if (this.requestHistory.length > this.maxHistorySize) {
            this.requestHistory = this.requestHistory.slice(-this.maxHistorySize);
        }
    }

    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // Public methods for testing and monitoring
    public clearHistory(): void {
        this.errorHistory = [];
        this.requestHistory = [];
        this.circuitBreakers.clear();
    }

    public getCircuitBreakerStates(): Map<string, CircuitBreakerState> {
        return new Map(this.circuitBreakers);
    }

    public forceCircuitBreakerState(endpoint: string, state: CircuitBreakerState): void {
        const key = this.getEndpointKey(endpoint, 'GET');
        this.circuitBreakers.set(key, state);
    }
}