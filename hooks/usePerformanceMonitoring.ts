import { useEffect, useRef, useCallback, useState } from 'react';
import { performanceService, PerformanceMetrics, InputMetrics } from '../services/performanceService';

/**
 * Hook for monitoring component performance and input interactions
 */
export function usePerformanceMonitoring(componentName: string) {
    const [isMonitoring, setIsMonitoring] = useState(false);
    const renderStartTime = useRef<number>(0);
    const interactionCount = useRef<number>(0);

    // Start monitoring when component mounts
    useEffect(() => {
        renderStartTime.current = performance.now();

        if (!isMonitoring) {
            performanceService.startMonitoring();
            setIsMonitoring(true);
        }

        // Record render completion
        const renderEndTime = performance.now();
        const renderTime = renderEndTime - renderStartTime.current;

        if (renderTime > 16) { // Slower than 60fps
            console.warn(`⚠️ Slow render in ${componentName}: ${renderTime.toFixed(2)}ms`);
        }

        return () => {
            // Component unmounting - could stop monitoring if needed
            // performanceService.stopMonitoring();
        };
    }, [componentName, isMonitoring]);

    /**
     * Measure input lag for form interactions
     */
    const measureInputLag = useCallback((
        elementId: string,
        type: InputMetrics['type'] = 'touch',
        elementType: string = 'input'
    ) => {
        interactionCount.current++;
        return performanceService.measureInputLag(elementId, type, elementType);
    }, []);

    /**
     * Measure async operation performance
     */
    const measureAsyncOperation = useCallback(async <T>(
        operation: () => Promise<T>,
        operationName: string
    ): Promise<T> => {
        return performanceService.measureResponseTime(operation, operationName);
    }, []);

    /**
     * Get current performance summary
     */
    const getPerformanceSummary = useCallback(() => {
        return performanceService.getPerformanceSummary();
    }, []);

    /**
     * Record custom performance metric
     */
    const recordCustomMetric = useCallback((metricName: string, value: number, unit: string = 'ms') => {
        console.log(`📊 ${componentName} - ${metricName}: ${value.toFixed(2)}${unit}`);
    }, [componentName]);

    return {
        measureInputLag,
        measureAsyncOperation,
        getPerformanceSummary,
        recordCustomMetric,
        interactionCount: interactionCount.current,
        isMonitoring,
    };
}

/**
 * Hook for monitoring input field performance specifically
 */
export function useInputPerformance(inputId: string, inputType: string = 'text') {
    const measureLag = useRef<(() => void) | null>(null);

    const handleFocus = useCallback((event: React.FocusEvent) => {
        measureLag.current = performanceService.measureInputLag(
            inputId,
            'focus',
            inputType
        );
    }, [inputId, inputType]);

    const handleBlur = useCallback((event: React.FocusEvent) => {
        if (measureLag.current) {
            measureLag.current();
            measureLag.current = null;
        }
    }, []);

    const handleTouchStart = useCallback((event: React.TouchEvent) => {
        measureLag.current = performanceService.measureInputLag(
            inputId,
            'touch',
            inputType
        );
    }, [inputId, inputType]);

    const handleTouchEnd = useCallback((event: React.TouchEvent) => {
        if (measureLag.current) {
            measureLag.current();
            measureLag.current = null;
        }
    }, []);

    const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
        measureLag.current = performanceService.measureInputLag(
            inputId,
            'keyboard',
            inputType
        );
    }, [inputId, inputType]);

    const handleKeyUp = useCallback((event: React.KeyboardEvent) => {
        if (measureLag.current) {
            measureLag.current();
            measureLag.current = null;
        }
    }, []);

    return {
        inputProps: {
            onFocus: handleFocus,
            onBlur: handleBlur,
            onTouchStart: handleTouchStart,
            onTouchEnd: handleTouchEnd,
            onKeyDown: handleKeyDown,
            onKeyUp: handleKeyUp,
        },
    };
}

/**
 * Hook for monitoring memory usage
 */
export function useMemoryMonitoring(warningThreshold: number = 80) {
    const [memoryInfo, setMemoryInfo] = useState(performanceService.getMemoryInfo());
    const [isHighMemory, setIsHighMemory] = useState(false);

    useEffect(() => {
        const checkMemory = () => {
            const info = performanceService.getMemoryInfo();
            setMemoryInfo(info);

            if (info && info.percentage > warningThreshold) {
                setIsHighMemory(true);
                console.warn(`⚠️ High memory usage: ${info.percentage.toFixed(1)}%`);
            } else {
                setIsHighMemory(false);
            }
        };

        // Check memory every 5 seconds
        const interval = setInterval(checkMemory, 5000);
        checkMemory(); // Initial check

        return () => clearInterval(interval);
    }, [warningThreshold]);

    return {
        memoryInfo,
        isHighMemory,
        memoryPercentage: memoryInfo?.percentage || 0,
    };
}

/**
 * Hook for performance-aware rendering
 */
export function usePerformanceAwareRendering() {
    const [shouldOptimize, setShouldOptimize] = useState(false);
    const performanceTier = useRef(performanceService.getDevicePerformanceTier());

    useEffect(() => {
        const summary = performanceService.getPerformanceSummary();

        // Optimize rendering if:
        // - Device is low performance
        // - High memory usage
        // - High input lag
        const shouldOpt =
            performanceTier.current === 'low' ||
            summary.currentMemoryUsage > 70 ||
            summary.averageInputLag > 100;

        setShouldOptimize(shouldOpt);
    }, []);

    return {
        shouldOptimize,
        performanceTier: performanceTier.current,
        // Optimization suggestions
        optimizations: {
            reduceAnimations: shouldOptimize,
            lazyLoadImages: shouldOptimize,
            debounceInputs: shouldOptimize,
            virtualizeList: shouldOptimize && performanceTier.current === 'low',
        },
    };
}

/**
 * Hook for tracking component lifecycle performance
 */
export function useComponentPerformance(componentName: string) {
    const mountTime = useRef<number>(0);
    const updateCount = useRef<number>(0);
    const [renderMetrics, setRenderMetrics] = useState<{
        mountTime: number;
        updateCount: number;
        lastRenderTime: number;
    }>({
        mountTime: 0,
        updateCount: 0,
        lastRenderTime: 0,
    });

    useEffect(() => {
        // Component mounted
        mountTime.current = performance.now();

        return () => {
            // Component unmounting
            const unmountTime = performance.now();
            const totalLifetime = unmountTime - mountTime.current;

            console.log(`📊 ${componentName} lifecycle: ${totalLifetime.toFixed(2)}ms total, ${updateCount.current} updates`);
        };
    }, [componentName]);

    useEffect(() => {
        // Component updated
        const renderStart = performance.now();
        updateCount.current++;

        // Use setTimeout to measure after render completion
        setTimeout(() => {
            const renderEnd = performance.now();
            const renderTime = renderEnd - renderStart;

            setRenderMetrics({
                mountTime: mountTime.current,
                updateCount: updateCount.current,
                lastRenderTime: renderTime,
            });

            if (renderTime > 16) {
                console.warn(`⚠️ Slow render in ${componentName}: ${renderTime.toFixed(2)}ms`);
            }
        }, 0);
    });

    return renderMetrics;
}