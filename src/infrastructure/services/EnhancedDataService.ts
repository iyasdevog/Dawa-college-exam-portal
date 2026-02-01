import { ApiErrorHandler } from './ApiErrorHandler';
import { IApiErrorHandler, ApiError } from '../../domain/interfaces/IApiErrorHandler';
import { IErrorReporter } from '../../domain/interfaces/IErrorReporter';
import { StudentRecord, SubjectConfig, SupplementaryExam } from '../../domain/entities/types';

/**
 * Enhanced Data Service with comprehensive error handling and retry mechanisms
 * Implements Requirements 5.2 - API error handling and retry mechanisms
 * Validates Property 14: API Error Handling
 */
export class EnhancedDataService {
    private apiErrorHandler: IApiErrorHandler;
    private errorReporter?: IErrorReporter;

    constructor(errorReporter?: IErrorReporter) {
        this.apiErrorHandler = new ApiErrorHandler();
        this.errorReporter = errorReporter;
    }

    /**
     * Execute Firebase operation with error handling and retry logic
     */
    async executeFirebaseOperation<T>(
        operation: () => Promise<T>,
        operationName: string,
        context?: Record<string, any>
    ): Promise<T> {
        const maxRetries = 3;
        let lastError: Error | null = null;

        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                // Add delay for retry attempts
                if (attempt > 0) {
                    const delay = this.calculateFirebaseRetryDelay(attempt - 1);
                    await this.sleep(delay);
                    console.log(`[ENHANCED DATA SERVICE] Retrying ${operationName} (attempt ${attempt + 1}/${maxRetries + 1})`);
                }

                const result = await operation();

                // Report success if this was a retry
                if (attempt > 0) {
                    console.log(`[ENHANCED DATA SERVICE] ${operationName} succeeded after ${attempt} retries`);
                }

                return result;

            } catch (error) {
                lastError = error as Error;
                const isRetryable = this.isFirebaseErrorRetryable(error as Error);

                // Create API error for reporting
                const apiError: ApiError = {
                    type: this.getFirebaseErrorType(error as Error),
                    message: this.getUserFriendlyFirebaseMessage(error as Error),
                    originalError: error as Error,
                    endpoint: operationName,
                    method: 'FIREBASE',
                    timestamp: new Date(),
                    retryCount: attempt,
                    isRetryable
                };

                // Report error
                if (this.errorReporter) {
                    await this.errorReporter.reportError({
                        id: `firebase_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                        type: 'api_error',
                        severity: attempt >= maxRetries ? 'high' : 'medium',
                        message: apiError.message,
                        context: {
                            operation: operationName,
                            attempt: attempt + 1,
                            maxRetries: maxRetries + 1,
                            isRetryable,
                            ...context
                        },
                        timestamp: new Date()
                    });
                }

                // Check if we should retry
                if (attempt < maxRetries && isRetryable) {
                    console.warn(`[ENHANCED DATA SERVICE] ${operationName} failed, retrying...`, {
                        error: apiError.message,
                        attempt: attempt + 1,
                        nextRetryIn: this.calculateFirebaseRetryDelay(attempt)
                    });
                    continue;
                }

                // All retries exhausted or error is not retryable
                console.error(`[ENHANCED DATA SERVICE] ${operationName} failed after ${attempt + 1} attempts:`, apiError.message);
                break;
            }
        }

        // Throw the last error with user-friendly message
        if (lastError) {
            throw new Error(this.getUserFriendlyFirebaseMessage(lastError));
        }

        throw new Error(`Unexpected error in ${operationName}`);
    }

    /**
     * Execute HTTP API request with full error handling and retry logic
     */
    async executeApiRequest<T = any, R = any>(
        url: string,
        method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' = 'GET',
        body?: T,
        headers?: Record<string, string>
    ): Promise<R> {
        try {
            const response = await this.apiErrorHandler.executeRequest<T, R>({
                url,
                method,
                body,
                headers,
                timeout: 30000
            });

            return response.data;

        } catch (error) {
            const apiError = error as ApiError;

            // Report API error
            if (this.errorReporter) {
                await this.errorReporter.reportError({
                    id: `api_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                    type: 'api_error',
                    severity: this.getErrorSeverity(apiError),
                    message: apiError.message,
                    context: {
                        endpoint: url,
                        method,
                        statusCode: apiError.statusCode,
                        retryCount: apiError.retryCount,
                        errorType: apiError.type
                    },
                    timestamp: new Date()
                });
            }

            // Throw user-friendly error
            throw new Error(this.apiErrorHandler.getUserFriendlyMessage(apiError));
        }
    }

    /**
     * Get API error statistics for monitoring
     */
    async getApiErrorStatistics() {
        return await this.apiErrorHandler.getErrorStatistics();
    }

    /**
     * Get circuit breaker states for monitoring
     */
    getCircuitBreakerStates() {
        return this.apiErrorHandler.getCircuitBreakerStates();
    }

    /**
     * Check if a specific endpoint can execute requests
     */
    canExecuteRequest(endpoint: string): boolean {
        return this.apiErrorHandler.canExecuteRequest(endpoint);
    }

    /**
     * Manually record a successful operation for circuit breaker
     */
    recordSuccess(endpoint: string): void {
        this.apiErrorHandler.recordSuccess(endpoint);
    }

    /**
     * Clear error history and reset circuit breakers
     */
    clearErrorHistory(): void {
        this.apiErrorHandler.clearHistory();
    }

    // Private helper methods

    private isFirebaseErrorRetryable(error: Error): boolean {
        const retryableErrors = [
            'unavailable',
            'deadline-exceeded',
            'resource-exhausted',
            'internal',
            'unknown',
            'cancelled'
        ];

        const errorMessage = error.message.toLowerCase();
        return retryableErrors.some(retryableError => errorMessage.includes(retryableError));
    }

    private getFirebaseErrorType(error: Error): 'network_error' | 'server_error' | 'authentication_error' | 'authorization_error' | 'validation_error' | 'unknown_error' {
        const message = error.message.toLowerCase();

        if (message.includes('permission-denied')) {
            return 'authorization_error';
        }
        if (message.includes('unauthenticated')) {
            return 'authentication_error';
        }
        if (message.includes('invalid-argument') || message.includes('failed-precondition')) {
            return 'validation_error';
        }
        if (message.includes('unavailable') || message.includes('deadline-exceeded')) {
            return 'network_error';
        }
        if (message.includes('internal') || message.includes('unknown')) {
            return 'server_error';
        }

        return 'unknown_error';
    }

    private getUserFriendlyFirebaseMessage(error: Error): string {
        const message = error.message.toLowerCase();

        if (message.includes('permission-denied')) {
            return 'You do not have permission to perform this action. Please check your access rights.';
        }
        if (message.includes('unauthenticated')) {
            return 'Your session has expired. Please log in again.';
        }
        if (message.includes('not-found')) {
            return 'The requested data was not found.';
        }
        if (message.includes('already-exists')) {
            return 'This data already exists. Please use a different identifier.';
        }
        if (message.includes('invalid-argument')) {
            return 'The provided data is invalid. Please check your input and try again.';
        }
        if (message.includes('failed-precondition')) {
            return 'The operation cannot be completed due to current system state. Please try again later.';
        }
        if (message.includes('resource-exhausted')) {
            return 'The system is currently busy. Please try again in a few moments.';
        }
        if (message.includes('deadline-exceeded')) {
            return 'The operation took too long to complete. Please try again.';
        }
        if (message.includes('unavailable')) {
            return 'The service is temporarily unavailable. Please try again later.';
        }
        if (message.includes('cancelled')) {
            return 'The operation was cancelled. Please try again if needed.';
        }

        return 'An unexpected error occurred. Please try again or contact support if the problem persists.';
    }

    private calculateFirebaseRetryDelay(retryCount: number): number {
        // Exponential backoff with jitter for Firebase operations
        const baseDelay = 1000; // 1 second
        const maxDelay = 10000; // 10 seconds
        const backoffMultiplier = 2;

        const exponentialDelay = baseDelay * Math.pow(backoffMultiplier, retryCount);
        const jitteredDelay = exponentialDelay * (0.5 + Math.random() * 0.5);
        return Math.min(jitteredDelay, maxDelay);
    }

    private getErrorSeverity(error: ApiError): 'low' | 'medium' | 'high' | 'critical' {
        if (error.type === 'authentication_error' || error.type === 'authorization_error') {
            return 'high';
        }
        if (error.type === 'server_error' && error.statusCode && error.statusCode >= 500) {
            return 'high';
        }
        if (error.type === 'network_error') {
            return 'medium';
        }
        if (error.type === 'validation_error') {
            return 'low';
        }
        return 'medium';
    }

    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Export singleton instance
export const enhancedDataService = new EnhancedDataService();