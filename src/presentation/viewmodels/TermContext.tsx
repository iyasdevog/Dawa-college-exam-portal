import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { dataService } from '../../infrastructure/services/dataService';

interface TermContextType {
    currentAcademicYear: string;
    currentSemester: 'Odd' | 'Even';
    activeTerm: string;
    setTerm: (academicYear: string, semester: 'Odd' | 'Even') => void;
    refreshTerms: () => Promise<void>;
    isLoading: boolean;
    termOptions: string[]; // List of available academic years to select, e.g. ["2023-2024", "2024-2025"]
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
    const [currentSemester, setCurrentSemester] = useState<'Odd' | 'Even'>('Odd');
    const [termOptions, setTermOptions] = useState<string[]>(['2025-2026']);
    const [isLoading, setIsLoading] = useState(true);

    const refreshTerms = async () => {
        try {
            // This function is now mostly used to refresh termOptions (available years)
            // as the current year/semester are synced via onSnapshot
            const availableTerms = await dataService.getAvailableTerms();
            setTermOptions(availableTerms);
        } catch (error) {
            console.error('Error refreshing terms in TermContext', error);
        }
    };

    useEffect(() => {
        setIsLoading(true);
        
        // 1. Listen for real-time changes to global settings
        const settingsRef = doc(dataService.getDb(), 'settings', 'global_admin_settings');
        const unsubscribe = onSnapshot(settingsRef, (docSnap) => {
            if (docSnap.exists()) {
                const settings = docSnap.data();
                if (settings.currentAcademicYear) setCurrentAcademicYear(settings.currentAcademicYear);
                if (settings.currentSemester) setCurrentSemester(settings.currentSemester);
                
                // If settings has availableYears, sync it locally too
                if (settings.availableYears) {
                    setTermOptions(settings.availableYears);
                }
            }
            setIsLoading(false);
        }, (error) => {
            console.error('Error in settings listener:', error);
            setIsLoading(false);
        });

        // 2. Initial load for available terms (not all might be in global settings yet)
        refreshTerms();

        return () => unsubscribe();
    }, []);


    const setTerm = (year: string, semester: 'Odd' | 'Even') => {
        setCurrentAcademicYear(year);
        setCurrentSemester(semester);
    };

    const activeTerm = `${currentAcademicYear}-${currentSemester}`;

    const contextValue = useMemo(() => ({
        currentAcademicYear,
        currentSemester,
        activeTerm,
        setTerm,
        refreshTerms,
        isLoading,
        termOptions
    }), [currentAcademicYear, currentSemester, activeTerm, isLoading, termOptions]);

    return (
        <TermContext.Provider value={contextValue}>
            {children}
        </TermContext.Provider>
    );
};
