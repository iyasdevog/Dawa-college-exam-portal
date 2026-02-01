import { useState, useEffect, useCallback, useMemo } from 'react';

/**
 * Custom hook for debouncing values to reduce API calls and improve performance
 * @param value - The value to debounce
 * @param delay - Delay in milliseconds
 * @returns The debounced value
 */
export function useDebounce<T>(value: T, delay: number): T {
    const [debouncedValue, setDebouncedValue] = useState<T>(value);

    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedValue(value);
        }, delay);

        return () => {
            clearTimeout(handler);
        };
    }, [value, delay]);

    return debouncedValue;
}

/**
 * Custom hook for debounced input validation with loading state
 * Enhanced for task 3.2 with better performance and reduced API calls
 * @param value - The input value to validate
 * @param validationFn - Function to validate the value
 * @param delay - Debounce delay in milliseconds (default: 300ms)
 * @returns Object with validation result and loading state
 */
export function useDebouncedValidation<T>(
    value: T,
    validationFn: (value: T) => boolean | Promise<boolean>,
    delay: number = 300
) {
    const [isValidating, setIsValidating] = useState(false);
    const [isValid, setIsValid] = useState<boolean | null>(null);
    const [validationCache, setValidationCache] = useState<Map<string, boolean>>(new Map());
    const debouncedValue = useDebounce(value, delay);

    useEffect(() => {
        if (debouncedValue === null || debouncedValue === undefined || debouncedValue === '') {
            setIsValid(null);
            setIsValidating(false);
            return;
        }

        // Check cache first to avoid redundant validations
        const cacheKey = String(debouncedValue);
        if (validationCache.has(cacheKey)) {
            setIsValid(validationCache.get(cacheKey)!);
            setIsValidating(false);
            return;
        }

        setIsValidating(true);

        const validate = async () => {
            try {
                const result = await validationFn(debouncedValue);
                setIsValid(result);

                // Cache the result for future use
                setValidationCache(prev => {
                    const newCache = new Map(prev);
                    newCache.set(cacheKey, result);

                    // Limit cache size to prevent memory leaks
                    if (newCache.size > 50) {
                        const firstKey = newCache.keys().next().value;
                        newCache.delete(firstKey);
                    }

                    return newCache;
                });
            } catch (error) {
                console.error('Validation error:', error);
                setIsValid(false);
            } finally {
                setIsValidating(false);
            }
        };

        validate();
    }, [debouncedValue, validationFn, validationCache]);

    return {
        isValidating,
        isValid,
        debouncedValue,
        clearCache: () => setValidationCache(new Map())
    };
}

/**
 * Enhanced debounced input hook for marks entry with performance optimizations
 * Reduces API calls and improves input responsiveness
 */
export function useDebouncedMarksInput(
    initialValue: string = '',
    onValueChange: (value: string) => void,
    delay: number = 150
) {
    const [inputValue, setInputValue] = useState(initialValue);
    const [isProcessing, setIsProcessing] = useState(false);
    const debouncedValue = useDebounce(inputValue, delay);

    // Update external value when debounced value changes
    useEffect(() => {
        if (debouncedValue !== initialValue) {
            setIsProcessing(true);
            onValueChange(debouncedValue);

            // Brief processing state for visual feedback
            setTimeout(() => setIsProcessing(false), 100);
        }
    }, [debouncedValue, onValueChange, initialValue]);

    // Update input value when initial value changes (external update)
    useEffect(() => {
        setInputValue(initialValue);
    }, [initialValue]);

    const handleInputChange = useCallback((value: string) => {
        // Only allow numeric input for marks
        if (value && !/^\d*$/.test(value)) {
            return;
        }
        setInputValue(value);
    }, []);

    return {
        inputValue,
        isProcessing,
        handleInputChange,
        debouncedValue
    };
}

/**
 * Debounced search hook with intelligent caching
 */
export function useDebouncedSearch<T>(
    items: T[],
    searchFn: (item: T, query: string) => boolean,
    delay: number = 200
) {
    const [query, setQuery] = useState('');
    const [isSearching, setIsSearching] = useState(false);
    const [searchCache, setSearchCache] = useState<Map<string, T[]>>(new Map());
    const debouncedQuery = useDebounce(query, delay);

    const filteredItems = useMemo(() => {
        if (!debouncedQuery.trim()) {
            setIsSearching(false);
            return items;
        }

        // Check cache first
        const cacheKey = debouncedQuery.toLowerCase();
        if (searchCache.has(cacheKey)) {
            setIsSearching(false);
            return searchCache.get(cacheKey)!;
        }

        setIsSearching(true);

        // Perform search
        const results = items.filter(item => searchFn(item, debouncedQuery));

        // Cache results
        setSearchCache(prev => {
            const newCache = new Map(prev);
            newCache.set(cacheKey, results);

            // Limit cache size
            if (newCache.size > 20) {
                const firstKey = newCache.keys().next().value;
                newCache.delete(firstKey);
            }

            return newCache;
        });

        setIsSearching(false);
        return results;
    }, [items, debouncedQuery, searchFn, searchCache]);

    return {
        query,
        setQuery,
        filteredItems,
        isSearching,
        clearCache: () => setSearchCache(new Map())
    };
}