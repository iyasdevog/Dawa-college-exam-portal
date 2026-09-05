import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { dataService } from '../../infrastructure/services/dataService';
import { BaseDataService } from '../../infrastructure/services/modules/BaseDataService';
import type { GlobalSettings } from '../../domain/entities/types';

interface TermContextType {
    currentAcademicYear: string; // Viewing Year
    currentSemester: 'Odd' | 'Even' | 'Bridge'; // Viewing Semester
    systemAcademicYear: string; // Global System Year
    systemSemester: 'Odd' | 'Even' | 'Bridge'; // Global System Semester
    activeTerm: string; // Viewing Term Key
    systemTerm: string; // Global Term Key
    isHistoricalTerm: boolean; // Computed: viewing term is chronologically before system term
    isUpcomingTerm: boolean; // Computed: viewing term is chronologically after system term
    isCurrentSystemTerm: boolean; // Computed: viewing term === system term
    isAttendanceEntryAllowed: boolean; // Computed: activeTerm is open for attendance entry
    isMarksEntryAllowed: boolean; // Computed: activeTerm is open for marks entry
    activeAttendanceTerm: string; // Term configured for attendance entry
    activeMarksTerm: string; // Term configured for marks entry
    globalSettings: GlobalSettings | null;
    setTerm: (academicYear: string, semester: 'Odd' | 'Even' | 'Bridge') => void;
    updateSystemTerm: (academicYear: string, semester: 'Odd' | 'Even' | 'Bridge') => Promise<void>;
    refreshTerms: () => Promise<void>;
    isLoading: boolean;
    termOptions: string[];
}

const TermContext = createContext<TermContextType | undefined>(undefined);

export const useTerm = () => {
    const context = useContext(TermContext);
    if (!context) {
        throw new Error('useTerm must be used within a TermProvider');
    }
    return context;
};

function getTermWeight(termKey: string): number {
    if (!termKey) return 0;
    const parts = termKey.split('-');
    if (parts.length < 2) return 0;
    const startYear = parseInt(parts[0], 10) || 0;
    const sem = parts[parts.length - 1];
    let semWeight = 0.1;
    if (sem === 'Even') semWeight = 0.2;
    if (sem === 'Bridge') semWeight = 0.15;
    return startYear + semWeight;
}

export const TermProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [currentAcademicYear, setCurrentAcademicYear] = useState<string>('2025-2026');
    const [currentSemester, setCurrentSemester] = useState<'Odd' | 'Even' | 'Bridge'>('Odd');
    const [systemAcademicYear, setSystemAcademicYear] = useState<string>('2025-2026');
    const [systemSemester, setSystemSemester] = useState<'Odd' | 'Even' | 'Bridge'>('Odd');
    const [termOptions, setTermOptions] = useState<string[]>(['2025-2026']);
    const [globalSettings, setGlobalSettings] = useState<GlobalSettings | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [hasManuallySwitched, setHasManuallySwitched] = useState(false);

    const refreshTerms = async () => {
        try {
            const availableTerms = await dataService.getAvailableTerms();
            const uniqueYears = Array.from(new Set(availableTerms.map(tk => {
                const lastHyphenIndex = tk.lastIndexOf('-');
                if (tk.endsWith('-Odd') || tk.endsWith('-Even')) {
                    return tk.substring(0, lastHyphenIndex);
                }
                return tk;
            }))).sort().reverse();
            setTermOptions(uniqueYears);
        } catch (error) {
            console.error('Error refreshing terms in TermContext', error);
        }
    };

    useEffect(() => {
        setIsLoading(true);
        const unsubscribe = dataService.subscribeToGlobalSettings((settings) => {
            setGlobalSettings(settings);

            // Update System State
            if (settings.currentAcademicYear) setSystemAcademicYear(settings.currentAcademicYear);
            if (settings.currentSemester) setSystemSemester(settings.currentSemester as 'Odd' | 'Even' | 'Bridge');

            // Update Viewing State ONLY if user hasn't manually picked a different term
            if (!hasManuallySwitched) {
                if (settings.currentAcademicYear) setCurrentAcademicYear(settings.currentAcademicYear);
                if (settings.currentSemester) setCurrentSemester(settings.currentSemester as 'Odd' | 'Even' | 'Bridge');
            }
            
            BaseDataService.updateStaticSettings(settings);
            refreshTerms();
            setIsLoading(false);
        });

        refreshTerms();
        return () => unsubscribe();
    }, [hasManuallySwitched]);

    const setTerm = (year: string, semester: 'Odd' | 'Even' | 'Bridge') => {
        setCurrentAcademicYear(year);
        setCurrentSemester(semester);
        setHasManuallySwitched(true);
        dataService.invalidateCache();
    };

    const updateSystemTerm = async (year: string, semester: 'Odd' | 'Even' | 'Bridge') => {
        try {
            const settings = await dataService.getGlobalSettings();
            await dataService.updateGlobalSettings({
                ...settings,
                currentAcademicYear: year,
                currentSemester: semester
            });
            dataService.invalidateCache();
        } catch (error) {
            console.error('Error updating system term:', error);
            throw error;
        }
    };

    const activeTerm = `${currentAcademicYear}-${currentSemester}`;
    const systemTerm = `${systemAcademicYear}-${systemSemester}`;

    const activeWeight = getTermWeight(activeTerm);
    const systemWeight = getTermWeight(systemTerm);

    const isHistoricalTerm = activeWeight < systemWeight;
    const isUpcomingTerm = activeWeight > systemWeight;
    const isCurrentSystemTerm = activeTerm === systemTerm;

    const configuredAttendanceTerm = globalSettings?.activeAttendanceTerm || systemTerm;
    const configuredMarksTerm = globalSettings?.activeMarksTerm || systemTerm;

    const allowedAttendanceTerms = globalSettings?.allowedAttendanceTerms && globalSettings.allowedAttendanceTerms.length > 0
        ? globalSettings.allowedAttendanceTerms
        : [configuredAttendanceTerm];

    const allowedMarksTerms = globalSettings?.allowedMarksTerms && globalSettings.allowedMarksTerms.length > 0
        ? globalSettings.allowedMarksTerms
        : [configuredMarksTerm];

    const isAttendanceEntryAllowed = allowedAttendanceTerms.includes(activeTerm);
    const isMarksEntryAllowed = allowedMarksTerms.includes(activeTerm);

    const contextValue = useMemo(() => ({
        currentAcademicYear,
        currentSemester,
        systemAcademicYear,
        systemSemester,
        activeTerm,
        systemTerm,
        isHistoricalTerm,
        isUpcomingTerm,
        isCurrentSystemTerm,
        isAttendanceEntryAllowed,
        isMarksEntryAllowed,
        activeAttendanceTerm: configuredAttendanceTerm,
        activeMarksTerm: configuredMarksTerm,
        globalSettings,
        setTerm,
        updateSystemTerm,
        refreshTerms,
        isLoading,
        termOptions
    }), [
        currentAcademicYear,
        currentSemester,
        systemAcademicYear,
        systemSemester,
        activeTerm,
        systemTerm,
        isHistoricalTerm,
        isUpcomingTerm,
        isCurrentSystemTerm,
        isAttendanceEntryAllowed,
        isMarksEntryAllowed,
        configuredAttendanceTerm,
        configuredMarksTerm,
        globalSettings,
        isLoading,
        termOptions
    ]);

    return (
        <TermContext.Provider value={contextValue}>
            {children}
        </TermContext.Provider>
    );
};
