import { useState, useEffect, useCallback, useRef } from 'react';
import { offlineStorageService, OfflineStatus, OfflineDraft } from '../services/offlineStorageService';
import { serviceWorkerService } from '../services/serviceWorkerService';

export interface UseOfflineCapabilityOptions {
    autoSaveInterval?: number; // Auto-save interval in milliseconds
    enableAutoSync?: boolean; // Enable automatic sync when online
    enableDraftRecovery?: boolean; // Enable draft recovery on component mount
}

export interface OfflineCapabilityState {
    isOnline: boolean;
    status: OfflineStatus;
    drafts: OfflineDraft[];
    isSyncing: boolean;
    isAutoSaving: boolean;
    lastAutoSave: number | null;
}

export interface OfflineCapabilityActions {
    saveDraft: (studentId: string, subjectId: string, ta: string, ce: string, studentName: string, subjectName: string, className: string) => Promise<string>;
    deleteDraft: (draftId: string) => Promise<void>;
    getDraftForStudent: (studentId: string, subjectId: string) => OfflineDraft | null;
    saveMarksOffline: (studentId: string, subjectId: string, ta: number, ce: number, studentName: string, subjectName: string, className: string) => Promise<string>;
    triggerSync: () => Promise<void>;
    clearAllDrafts: () => Promise<void>;
    refreshStatus: () => Promise<void>;
}

export function useOfflineCapability(options: UseOfflineCapabilityOptions = {}): [OfflineCapabilityState, OfflineCapabilityActions] {
    const {
        autoSaveInterval = 30000, // 30 seconds
        enableAutoSync = true,
        enableDraftRecovery = true
    } = options;

    // State
    const [state, setState] = useState<OfflineCapabilityState>({
        isOnline: navigator.onLine,
        status: {
            isOnline: navigator.onLine,
            lastSync: null,
            pendingEntries: 0,
            pendingDrafts: 0
        },
        drafts: [],
        isSyncing: false,
        isAutoSaving: false,
        lastAutoSave: null
    });

    // Refs for managing intervals and timeouts
    const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const statusUpdateIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const pendingAutoSaves = useRef<Map<string, NodeJS.Timeout>>(new Map());

    // Initialize offline capability
    useEffect(() => {
        initializeOfflineCapability();

        return () => {
            // Cleanup
            if (autoSaveTimeoutRef.current) {
                clearTimeout(autoSaveTimeoutRef.current);
            }
            if (statusUpdateIntervalRef.current) {
                clearInterval(statusUpdateIntervalRef.current);
            }
            pendingAutoSaves.current.forEach(timeout => clearTimeout(timeout));
        };
    }, []);

    // Setup online/offline listeners
    useEffect(() => {
        const cleanup = serviceWorkerService.onOnlineStatusChange(handleOnlineStatusChange);

        // Setup service worker event listeners
        serviceWorkerService.on('syncComplete', handleSyncComplete);

        return () => {
            cleanup();
            serviceWorkerService.off('syncComplete', handleSyncComplete);
        };
    }, [enableAutoSync]);

    // Initialize offline capability
    const initializeOfflineCapability = async () => {
        try {
            // Load initial status and drafts
            await refreshStatus();

            // Setup periodic status updates
            statusUpdateIntervalRef.current = setInterval(refreshStatus, 60000); // Every minute

            // Recover drafts if enabled
            if (enableDraftRecovery) {
                await loadDrafts();
            }

            console.log('OfflineCapability: Initialized successfully');
        } catch (error) {
            console.error('OfflineCapability: Initialization failed:', error);
        }
    };

    // Handle online/offline status changes
    const handleOnlineStatusChange = useCallback(async (isOnline: boolean) => {
        setState(prev => ({ ...prev, isOnline }));

        if (isOnline && enableAutoSync) {
            // Auto-sync when coming back online
            await triggerSync();
        }

        await refreshStatus();
    }, [enableAutoSync]);

    // Handle sync completion
    const handleSyncComplete = useCallback(async (data: any) => {
        console.log('OfflineCapability: Sync completed:', data);
        setState(prev => ({ ...prev, isSyncing: false }));
        await refreshStatus();
    }, []);

    // Refresh status from storage
    const refreshStatus = useCallback(async () => {
        try {
            const [status, drafts] = await Promise.all([
                offlineStorageService.getOfflineStatus(),
                offlineStorageService.getDrafts()
            ]);

            setState(prev => ({
                ...prev,
                status,
                drafts,
                isOnline: navigator.onLine
            }));
        } catch (error) {
            console.error('OfflineCapability: Failed to refresh status:', error);
        }
    }, []);

    // Load drafts
    const loadDrafts = useCallback(async () => {
        try {
            const drafts = await offlineStorageService.getDrafts();
            setState(prev => ({ ...prev, drafts }));
        } catch (error) {
            console.error('OfflineCapability: Failed to load drafts:', error);
        }
    }, []);

    // Save draft with auto-save capability
    const saveDraft = useCallback(async (
        studentId: string,
        subjectId: string,
        ta: string,
        ce: string,
        studentName: string,
        subjectName: string,
        className: string
    ): Promise<string> => {
        try {
            setState(prev => ({ ...prev, isAutoSaving: true }));

            const draftId = await offlineStorageService.saveDraft(
                studentId,
                subjectId,
                ta,
                ce,
                studentName,
                subjectName,
                className,
                true // Mark as auto-saved
            );

            setState(prev => ({
                ...prev,
                isAutoSaving: false,
                lastAutoSave: Date.now()
            }));

            // Refresh drafts
            await loadDrafts();

            console.log('OfflineCapability: Draft saved:', draftId);
            return draftId;
        } catch (error) {
            setState(prev => ({ ...prev, isAutoSaving: false }));
            console.error('OfflineCapability: Failed to save draft:', error);
            throw error;
        }
    }, [loadDrafts]);

    // Auto-save draft with debouncing
    const autoSaveDraft = useCallback((
        studentId: string,
        subjectId: string,
        ta: string,
        ce: string,
        studentName: string,
        subjectName: string,
        className: string
    ) => {
        const key = `${studentId}_${subjectId}`;

        // Clear existing timeout for this student/subject
        const existingTimeout = pendingAutoSaves.current.get(key);
        if (existingTimeout) {
            clearTimeout(existingTimeout);
        }

        // Set new timeout
        const timeout = setTimeout(async () => {
            try {
                await saveDraft(studentId, subjectId, ta, ce, studentName, subjectName, className);
                pendingAutoSaves.current.delete(key);
            } catch (error) {
                console.error('OfflineCapability: Auto-save failed:', error);
            }
        }, autoSaveInterval);

        pendingAutoSaves.current.set(key, timeout);
    }, [saveDraft, autoSaveInterval]);

    // Delete draft
    const deleteDraft = useCallback(async (draftId: string): Promise<void> => {
        try {
            await offlineStorageService.deleteDraft(draftId);
            await loadDrafts();
            console.log('OfflineCapability: Draft deleted:', draftId);
        } catch (error) {
            console.error('OfflineCapability: Failed to delete draft:', error);
            throw error;
        }
    }, [loadDrafts]);

    // Get draft for specific student and subject
    const getDraftForStudent = useCallback((studentId: string, subjectId: string): OfflineDraft | null => {
        return state.drafts.find(draft =>
            draft.studentId === studentId && draft.subjectId === subjectId
        ) || null;
    }, [state.drafts]);

    // Save marks offline (for when online save fails)
    const saveMarksOffline = useCallback(async (
        studentId: string,
        subjectId: string,
        ta: number,
        ce: number,
        studentName: string,
        subjectName: string,
        className: string
    ): Promise<string> => {
        try {
            const entryId = await offlineStorageService.saveMarksEntry(
                studentId,
                subjectId,
                ta,
                ce,
                studentName,
                subjectName,
                className
            );

            await refreshStatus();
            console.log('OfflineCapability: Marks saved offline:', entryId);
            return entryId;
        } catch (error) {
            console.error('OfflineCapability: Failed to save marks offline:', error);
            throw error;
        }
    }, [refreshStatus]);

    // Trigger sync
    const triggerSync = useCallback(async (): Promise<void> => {
        if (!navigator.onLine) {
            console.log('OfflineCapability: Cannot sync - device is offline');
            return;
        }

        try {
            setState(prev => ({ ...prev, isSyncing: true }));
            await offlineStorageService.triggerSync();
            console.log('OfflineCapability: Sync triggered');
        } catch (error) {
            setState(prev => ({ ...prev, isSyncing: false }));
            console.error('OfflineCapability: Sync failed:', error);
            throw error;
        }
    }, []);

    // Clear all drafts
    const clearAllDrafts = useCallback(async (): Promise<void> => {
        try {
            const drafts = await offlineStorageService.getDrafts();

            for (const draft of drafts) {
                await offlineStorageService.deleteDraft(draft.id);
            }

            await loadDrafts();
            console.log('OfflineCapability: All drafts cleared');
        } catch (error) {
            console.error('OfflineCapability: Failed to clear drafts:', error);
            throw error;
        }
    }, [loadDrafts]);

    // Actions object
    const actions: OfflineCapabilityActions = {
        saveDraft,
        deleteDraft,
        getDraftForStudent,
        saveMarksOffline,
        triggerSync,
        clearAllDrafts,
        refreshStatus
    };

    // Enhanced actions with auto-save
    const enhancedActions = {
        ...actions,
        autoSaveDraft
    };

    return [state, enhancedActions];
}

// Hook for auto-saving form data
export function useAutoSave<T>(
    data: T,
    saveFunction: (data: T) => Promise<void>,
    options: {
        delay?: number;
        enabled?: boolean;
    } = {}
) {
    const { delay = 2000, enabled = true } = options;
    const [isSaving, setIsSaving] = useState(false);
    const [lastSaved, setLastSaved] = useState<number | null>(null);
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);
    const previousDataRef = useRef<T>(data);

    useEffect(() => {
        if (!enabled) return;

        // Check if data has actually changed
        const hasChanged = JSON.stringify(data) !== JSON.stringify(previousDataRef.current);
        if (!hasChanged) return;

        // Clear existing timeout
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
        }

        // Set new timeout
        timeoutRef.current = setTimeout(async () => {
            try {
                setIsSaving(true);
                await saveFunction(data);
                setLastSaved(Date.now());
                previousDataRef.current = data;
            } catch (error) {
                console.error('AutoSave: Failed to save:', error);
            } finally {
                setIsSaving(false);
            }
        }, delay);

        return () => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
        };
    }, [data, saveFunction, delay, enabled]);

    return { isSaving, lastSaved };
}