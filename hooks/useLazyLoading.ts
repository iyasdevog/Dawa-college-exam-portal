import { useState, useEffect, useMemo, useCallback } from 'react';
import { StudentRecord } from '../types';

interface LazyLoadingConfig {
    pageSize: number;
    initialLoad: number;
    loadMoreThreshold: number;
}

const DEFAULT_CONFIG: LazyLoadingConfig = {
    pageSize: 10,
    initialLoad: 5,
    loadMoreThreshold: 3
};

/**
 * Custom hook for lazy loading large student lists to improve performance
 * @param students - Complete list of students
 * @param config - Configuration for lazy loading behavior
 * @returns Object with visible students, loading state, and load more function
 */
export function useLazyLoading(
    students: StudentRecord[],
    config: Partial<LazyLoadingConfig> = {}
) {
    const finalConfig = { ...DEFAULT_CONFIG, ...config };
    const [loadedCount, setLoadedCount] = useState(finalConfig.initialLoad);
    const [isLoadingMore, setIsLoadingMore] = useState(false);

    // Reset loaded count when students array changes
    useEffect(() => {
        setLoadedCount(finalConfig.initialLoad);
    }, [students.length, finalConfig.initialLoad]);

    // Memoized visible students to prevent unnecessary re-renders
    const visibleStudents = useMemo(() => {
        return students.slice(0, Math.min(loadedCount, students.length));
    }, [students, loadedCount]);

    // Check if more students can be loaded
    const hasMore = useMemo(() => {
        return loadedCount < students.length;
    }, [loadedCount, students.length]);

    // Load more students function
    const loadMore = useCallback(async () => {
        if (!hasMore || isLoadingMore) return;

        setIsLoadingMore(true);

        // Simulate async loading for better UX
        await new Promise(resolve => setTimeout(resolve, 200));

        setLoadedCount(prev => Math.min(prev + finalConfig.pageSize, students.length));
        setIsLoadingMore(false);
    }, [hasMore, isLoadingMore, finalConfig.pageSize, students.length]);

    // Auto-load more when approaching the end
    const checkAutoLoad = useCallback((currentIndex: number) => {
        const remainingItems = loadedCount - currentIndex;
        if (remainingItems <= finalConfig.loadMoreThreshold && hasMore && !isLoadingMore) {
            loadMore();
        }
    }, [loadedCount, finalConfig.loadMoreThreshold, hasMore, isLoadingMore, loadMore]);

    return {
        visibleStudents,
        loadedCount,
        totalCount: students.length,
        hasMore,
        isLoadingMore,
        loadMore,
        checkAutoLoad,
        loadingProgress: Math.round((loadedCount / students.length) * 100)
    };
}

/**
 * Custom hook for virtual scrolling optimization
 * @param items - Array of items to virtualize
 * @param itemHeight - Height of each item in pixels
 * @param containerHeight - Height of the container in pixels
 * @param overscan - Number of items to render outside visible area
 * @returns Object with visible items and scroll handlers
 */
export function useVirtualScrolling<T>(
    items: T[],
    itemHeight: number,
    containerHeight: number,
    overscan: number = 3
) {
    const [scrollTop, setScrollTop] = useState(0);

    const visibleRange = useMemo(() => {
        const visibleCount = Math.ceil(containerHeight / itemHeight);
        const startIndex = Math.floor(scrollTop / itemHeight);
        const endIndex = Math.min(startIndex + visibleCount + overscan, items.length);
        const adjustedStartIndex = Math.max(0, startIndex - overscan);

        return {
            startIndex: adjustedStartIndex,
            endIndex,
            visibleItems: items.slice(adjustedStartIndex, endIndex)
        };
    }, [items, itemHeight, containerHeight, scrollTop, overscan]);

    const handleScroll = useCallback((event: React.UIEvent<HTMLDivElement>) => {
        setScrollTop(event.currentTarget.scrollTop);
    }, []);

    const totalHeight = items.length * itemHeight;
    const offsetY = visibleRange.startIndex * itemHeight;

    return {
        visibleItems: visibleRange.visibleItems,
        startIndex: visibleRange.startIndex,
        endIndex: visibleRange.endIndex,
        totalHeight,
        offsetY,
        handleScroll
    };
}