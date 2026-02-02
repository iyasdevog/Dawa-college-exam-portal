import { useState, useEffect, useCallback } from 'react';

// Simplified hook to track online status only
export function useOfflineCapability() {
    const [isOnline, setIsOnline] = useState(navigator.onLine);

    useEffect(() => {
        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => setIsOnline(false);

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    const saveDraft = useCallback(async (
        studentId: string,
        subjectId: string,
        ta: string,
        ce: string
    ) => {
        // Simple localStorage backup
        try {
            const key = `draft_${studentId}_${subjectId}`;
            localStorage.setItem(key, JSON.stringify({ ta, ce, timestamp: Date.now() }));
            return key;
        } catch (e) {
            console.error("Failed to save draft locally", e);
            return null;
        }
    }, []);

    const getDraft = useCallback((studentId: string, subjectId: string) => {
        try {
            const key = `draft_${studentId}_${subjectId}`;
            const data = localStorage.getItem(key);
            return data ? JSON.parse(data) : null;
        } catch (e) {
            return null;
        }
    }, []);

    const deleteDraft = useCallback((studentId: string, subjectId: string) => {
        try {
            const key = `draft_${studentId}_${subjectId}`;
            localStorage.removeItem(key);
            return true;
        } catch (e) {
            console.error("Failed to delete draft locally", e);
            return false;
        }
    }, []);

    return {
        isOnline,
        saveDraft,
        getDraft,
        deleteDraft
    };
}