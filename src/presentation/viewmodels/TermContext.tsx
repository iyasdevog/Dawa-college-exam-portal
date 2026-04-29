import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { dataService } from '../../infrastructure/services/dataService';
import { BaseDataService } from '../../infrastructure/services/modules/BaseDataService';
import { GlobalSettings } from '../../domain/entities/types';

interface TermContextType {
    currentAcademicYear: string; // Viewing Year
    currentSemester: 'Odd' | 'Even' | 'Bridge'; // Viewing Semester
    systemAcademicYear: string; // Global System Year
    systemSemester: 'Odd' | 'Even' | 'Bridge'; // Global System Semester
    activeTerm: string; // Viewing Term Key
    systemTerm: string; // Global Term Key
    isHistoricalTerm: boolean; // Computed: viewing !== system
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

export const TermProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [currentAcademicYear, setCurrentAcademicYear] = useState<string>('2025-2026');
    const [currentSemester, setCurrentSemester] = useState<'Odd' | 'Even' | 'Bridge'>('Odd');
    const [systemAcademicYear, setSystemAcademicYear] = useState<string>('2025-2026');
    const [systemSemester, setSystemSemester] = useState<'Odd' | 'Even' | 'Bridge'>('Odd');
    const [termOptions, setTermOptions] = useState<string[]>(['2025-2026']);
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
        const settingsRef = doc(dataService.getDb(), 'settings', 'global_admin_settings');
        const unsubscribe = onSnapshot(settingsRef, (docSnap) => {
            if (docSnap.exists()) {
                const settings = docSnap.data() as GlobalSettings;
                
                // Update System State
                if (settings.currentAcademicYear) setSystemAcademicYear(settings.currentAcademicYear);
                if (settings.currentSemester) setSystemSemester(settings.currentSemester as 'Odd' | 'Even');

                // Update Viewing State ONLY if user hasn't manually picked a different term
                if (!hasManuallySwitched) {
                    if (settings.currentAcademicYear) setCurrentAcademicYear(settings.currentAcademicYear);
                    if (settings.currentSemester) setCurrentSemester(settings.currentSemester as 'Odd' | 'Even');
                }
                
                BaseDataService.updateStaticSettings(settings);

                const availableYears = settings.availableYears || [];
                const uniqueYears = Array.from(new Set(availableYears.map(tk => {
                    const lastHyphenIndex = tk.lastIndexOf('-');
                    if (tk.endsWith('-Odd') || tk.endsWith('-Even')) {
                        return tk.substring(0, lastHyphenIndex);
                    }
                    return tk;
                }))).sort().reverse();
                setTermOptions(uniqueYears);
            }
            setIsLoading(false);
        }, (error) => {
            console.error('Error in settings listener:', error);
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
    const isHistoricalTerm = activeTerm !== systemTerm;

    const contextValue = useMemo(() => ({
        currentAcademicYear,
        currentSemester,
        systemAcademicYear,
        systemSemester,
        activeTerm,
        systemTerm,
        isHistoricalTerm,
        setTerm,
        updateSystemTerm,
        refreshTerms,
        isLoading,
        termOptions
    }), [currentAcademicYear, currentSemester, systemAcademicYear, systemSemester, activeTerm, systemTerm, isHistoricalTerm, isLoading, termOptions]);

    return (
        <TermContext.Provider value={contextValue}>
            {children}
        </TermContext.Provider>
    );
};
