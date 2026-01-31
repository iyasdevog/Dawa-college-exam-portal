import { useState, useEffect } from 'react';

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
    const debouncedValue = useDebounce(value, delay);

    useEffect(() => {
        if (debouncedValue === null || debouncedValue === undefined || debouncedValue === '') {
            setIsValid(null);
            setIsValidating(false);
            return;
        }

        setIsValidating(true);

        const validate = async () => {
            try {
                const result = await validationFn(debouncedValue);
                setIsValid(result);
            } catch (error) {
                console.error('Validation error:', error);
                setIsValid(false);
            } finally {
                setIsValidating(false);
            }
        };

        validate();
    }, [debouncedValue, validationFn]);

    return {
        isValidating,
        isValid,
        debouncedValue
    };
}