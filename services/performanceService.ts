/**
 * Performance Monitoring Service
 * Tracks mobile performance metrics, input lag, and system resource usage
 */

export interface PerformanceMetrics {
    inputLag: number;
    responseTime: number;
    memoryUsage: number;
    renderTime: number;
    interactionCount: number;
    errorCount: number;
    timestamp: number;
    userAgent: string;
    viewport: {
        width: number;
        height: number;
    };
}

export interface InputMetrics {
    inputId: string;
    startTime: number;
    endTime: number;
    lag: number;
    type: 'touch' | 'keyboard' | 'focus' | 'blur';
    elementType: string;
}

export interface MemoryInfo {
    usedJSHeapSize: number;
    totalJSHeapSize: number;
    jsHeapSizeLimit: number;
    percentage: number;
}

export interface ErrorMetrics {
    message: string;
    stack?: string;
    timestamp: number;
    userAgent: string;
    url: string;
    componentStack?: string;
    errorBoundary?: string;
}

class PerformanceMonitoringService {
    private metrics: PerformanceMetrics[] = [];
    private inputMetrics: InputMetrics[] = [];
    private errorMetrics: ErrorMetrics[] = [];
    private observers: PerformanceObserver[] = [];
    private isMonitoring = false;
    private maxMetricsHistory = 100;
    private performanceThresholds = {
        inputLag: 100, // ms
        responseTime: 200, // ms
        memoryUsage: 80, // percentage
        renderTime: 16, // ms (60fps)
    };

    /**
     * Initialize performance monitoring
     */
    public startMonitoring(): void {
        if (this.isMonitoring) return;

        this.isMonitoring = true;
        this.setupPerformanceObservers();
        this.startMemoryMonitoring();
        this.setupErrorHandling();

        console.log('🚀 Performance monitoring started');
    }

    /**
     * Stop performance monitoring
     */
    public stopMonitoring(): void {
        if (!this.isMonitoring) return;

        this.isMonitoring = false;
        this.observers.forEach(observer => observer.disconnect());
        this.observers = [];

        console.log('🛑 Performance monitoring stopped');
    }

    /**
     * Setup Performance Observer for various metrics
     */
    private setupPerformanceObservers(): void {
        // Monitor Long Tasks (input blocking)
        if ('PerformanceObserver' in window) {
            try {
                const longTaskObserver = new PerformanceObserver((list) => {
                    for (const entry of list.getEntries()) {
                        if (entry.entryType === 'longtask') {
                            this.recordInputLag(entry.duration);
                        }
                    }
                });
                longTaskObserver.observe({ entryTypes: ['longtask'] });
                this.observers.push(longTaskObserver);
            } catch (error) {
                console.warn('Long task monitoring not supported:', error);
            }

            // Monitor Layout Shifts
            try {
                const layoutShiftObserver = new PerformanceObserver((list) => {
                    for (const entry of list.getEntries()) {
                        if (entry.entryType === 'layout-shift' && !(entry as any).hadRecentInput) {
                            this.recordLayoutShift((entry as any).value);
                        }
                    }
                });
                layoutShiftObserver.observe({ entryTypes: ['layout-shift'] });
                this.observers.push(layoutShiftObserver);
            } catch (error) {
                console.warn('Layout shift monitoring not supported:', error);
            }

            // Monitor First Input Delay
            try {
                const fidObserver = new PerformanceObserver((list) => {
                    for (const entry of list.getEntries()) {
                        if (entry.entryType === 'first-input') {
                            this.recordFirstInputDelay((entry as any).processingStart - entry.startTime);
                        }
                    }
                });
                fidObserver.observe({ entryTypes: ['first-input'] });
                this.observers.push(fidObserver);
            } catch (error) {
                console.warn('First input delay monitoring not supported:', error);
            }
        }
    }

    /**
     * Start monitoring memory usage
     */
    private startMemoryMonitoring(): void {
        const checkMemory = () => {
            if (!this.isMonitoring) return;

            const memoryInfo = this.getMemoryInfo();
            if (memoryInfo && memoryInfo.percentage > this.performanceThresholds.memoryUsage) {
                console.warn(`⚠️ High memory usage detected: ${memoryInfo.percentage.toFixed(1)}%`);
                this.recordPerformanceMetric({
                    inputLag: 0,
                    responseTime: 0,
                    memoryUsage: memoryInfo.percentage,
                    renderTime: 0,
                    interactionCount: 0,
                    errorCount: this.errorMetrics.length,
                    timestamp: Date.now(),
                    userAgent: navigator.userAgent,
                    viewport: {
                        width: window.innerWidth,
                        height: window.innerHeight,
                    },
                });
            }

            setTimeout(checkMemory, 5000); // Check every 5 seconds
        };

        checkMemory();
    }

    /**
     * Setup global error handling
     */
    private setupErrorHandling(): void {
        // Handle unhandled promise rejections
        window.addEventListener('unhandledrejection', (event) => {
            this.recordError({
                message: `Unhandled Promise Rejection: ${event.reason}`,
                timestamp: Date.now(),
                userAgent: navigator.userAgent,
                url: window.location.href,
            });
        });

        // Handle JavaScript errors
        window.addEventListener('error', (event) => {
            this.recordError({
                message: event.message,
                stack: event.error?.stack,
                timestamp: Date.now(),
                userAgent: navigator.userAgent,
                url: window.location.href,
            });
        });
    }

    /**
     * Measure input lag for a specific interaction
     */
    public measureInputLag(elementId: string, type: InputMetrics['type'], elementType: string): () => void {
        const startTime = performance.now();

        return () => {
            const endTime = performance.now();
            const lag = endTime - startTime;

            const inputMetric: InputMetrics = {
                inputId: elementId,
                startTime,
                endTime,
                lag,
                type,
                elementType,
            };

            this.inputMetrics.push(inputMetric);

            // Keep only recent metrics
            if (this.inputMetrics.length > this.maxMetricsHistory) {
                this.inputMetrics = this.inputMetrics.slice(-this.maxMetricsHistory);
            }

            // Warn if lag exceeds threshold
            if (lag > this.performanceThresholds.inputLag) {
                console.warn(`⚠️ High input lag detected: ${lag.toFixed(2)}ms for ${elementType}`);
            }
        };
    }

    /**
     * Measure response time for async operations
     */
    public async measureResponseTime<T>(
        operation: () => Promise<T>,
        operationName: string
    ): Promise<T> {
        const startTime = performance.now();

        try {
            const result = await operation();
            const endTime = performance.now();
            const responseTime = endTime - startTime;

            this.recordPerformanceMetric({
                inputLag: 0,
                responseTime,
                memoryUsage: this.getMemoryInfo()?.percentage || 0,
                renderTime: 0,
                interactionCount: this.inputMetrics.length,
                errorCount: this.errorMetrics.length,
                timestamp: Date.now(),
                userAgent: navigator.userAgent,
                viewport: {
                    width: window.innerWidth,
                    height: window.innerHeight,
                },
            });

            if (responseTime > this.performanceThresholds.responseTime) {
                console.warn(`⚠️ Slow response time: ${responseTime.toFixed(2)}ms for ${operationName}`);
            }

            return result;
        } catch (error) {
            this.recordError({
                message: `Operation failed: ${operationName} - ${error}`,
                stack: error instanceof Error ? error.stack : undefined,
                timestamp: Date.now(),
                userAgent: navigator.userAgent,
                url: window.location.href,
            });
            throw error;
        }
    }

    /**
     * Get current memory information
     */
    public getMemoryInfo(): MemoryInfo | null {
        if ('memory' in performance) {
            const memory = (performance as any).memory;
            const percentage = (memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100;

            return {
                usedJSHeapSize: memory.usedJSHeapSize,
                totalJSHeapSize: memory.totalJSHeapSize,
                jsHeapSizeLimit: memory.jsHeapSizeLimit,
                percentage,
            };
        }
        return null;
    }

    /**
     * Record performance metric
     */
    private recordPerformanceMetric(metric: PerformanceMetrics): void {
        this.metrics.push(metric);

        // Keep only recent metrics
        if (this.metrics.length > this.maxMetricsHistory) {
            this.metrics = this.metrics.slice(-this.maxMetricsHistory);
        }
    }

    /**
     * Record input lag
     */
    private recordInputLag(lag: number): void {
        this.recordPerformanceMetric({
            inputLag: lag,
            responseTime: 0,
            memoryUsage: this.getMemoryInfo()?.percentage || 0,
            renderTime: 0,
            interactionCount: this.inputMetrics.length,
            errorCount: this.errorMetrics.length,
            timestamp: Date.now(),
            userAgent: navigator.userAgent,
            viewport: {
                width: window.innerWidth,
                height: window.innerHeight,
            },
        });
    }

    /**
     * Record layout shift
     */
    private recordLayoutShift(value: number): void {
        if (value > 0.1) { // Significant layout shift
            console.warn(`⚠️ Layout shift detected: ${value.toFixed(3)}`);
        }
    }

    /**
     * Record first input delay
     */
    private recordFirstInputDelay(delay: number): void {
        console.log(`📊 First Input Delay: ${delay.toFixed(2)}ms`);
        this.recordInputLag(delay);
    }

    /**
     * Record error
     */
    public recordError(error: ErrorMetrics): void {
        this.errorMetrics.push(error);

        // Keep only recent errors
        if (this.errorMetrics.length > this.maxMetricsHistory) {
            this.errorMetrics = this.errorMetrics.slice(-this.maxMetricsHistory);
        }

        console.error('🚨 Error recorded:', error);
    }

    /**
     * Get performance summary
     */
    public getPerformanceSummary(): {
        averageInputLag: number;
        averageResponseTime: number;
        currentMemoryUsage: number;
        totalErrors: number;
        totalInteractions: number;
        recentMetrics: PerformanceMetrics[];
    } {
        const recentMetrics = this.metrics.slice(-10);

        return {
            averageInputLag: this.calculateAverage(recentMetrics.map(m => m.inputLag)),
            averageResponseTime: this.calculateAverage(recentMetrics.map(m => m.responseTime)),
            currentMemoryUsage: this.getMemoryInfo()?.percentage || 0,
            totalErrors: this.errorMetrics.length,
            totalInteractions: this.inputMetrics.length,
            recentMetrics,
        };
    }

    /**
     * Get detailed metrics for debugging
     */
    public getDetailedMetrics(): {
        metrics: PerformanceMetrics[];
        inputMetrics: InputMetrics[];
        errorMetrics: ErrorMetrics[];
        thresholds: typeof this.performanceThresholds;
    } {
        return {
            metrics: [...this.metrics],
            inputMetrics: [...this.inputMetrics],
            errorMetrics: [...this.errorMetrics],
            thresholds: { ...this.performanceThresholds },
        };
    }

    /**
     * Check if device is likely mobile
     */
    public isMobileDevice(): boolean {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
            window.innerWidth <= 768;
    }

    /**
     * Get device performance tier (rough estimation)
     */
    public getDevicePerformanceTier(): 'high' | 'medium' | 'low' {
        const memory = this.getMemoryInfo();
        const cores = navigator.hardwareConcurrency || 1;

        if (memory && memory.jsHeapSizeLimit > 1000000000 && cores >= 4) {
            return 'high';
        } else if (memory && memory.jsHeapSizeLimit > 500000000 && cores >= 2) {
            return 'medium';
        } else {
            return 'low';
        }
    }

    /**
     * Calculate average of an array of numbers
     */
    private calculateAverage(numbers: number[]): number {
        if (numbers.length === 0) return 0;
        return numbers.reduce((sum, num) => sum + num, 0) / numbers.length;
    }

    /**
     * Clear all metrics (useful for testing)
     */
    public clearMetrics(): void {
        this.metrics = [];
        this.inputMetrics = [];
        this.errorMetrics = [];
    }
}

// Export singleton instance
export const performanceService = new PerformanceMonitoringService();