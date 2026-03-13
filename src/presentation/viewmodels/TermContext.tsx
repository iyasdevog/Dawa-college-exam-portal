import React, { createContext, useContext, useState, useEffect } from 'react';
import { GlobalSettings } from '../../domain/entities/types';
import { DataService } from '../../infrastructure/services/dataService';

interface TermContextType {
    currentAcademicYear: string;
    currentSemester: 'Odd' | 'Even';
    activeTerm: string;
    setTerm: (academicYear: string, semester: 'Odd' | 'Even') => void;
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

    useEffect(() => {
        const fetchInitialData = async () => {
            try {
                const dataService = new DataService();
                const [settings, availableYears] = await Promise.all([
                    dataService.getGlobalSettings(),
                    dataService.getAvailableAcademicYears()
                ]);

                setCurrentAcademicYear(settings.currentAcademicYear);
                setCurrentSemester(settings.currentSemester);
                setTermOptions(availableYears);
            } catch (error) {
                console.error('Error fetching initial data for TermContext', error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchInitialData();
    }, []);


    const setTerm = (year: string, semester: 'Odd' | 'Even') => {
        setCurrentAcademicYear(year);
        setCurrentSemester(semester);
    };

    const activeTerm = `${currentAcademicYear}-${currentSemester}`;

    return (
        <TermContext.Provider value={{
            currentAcademicYear,
            currentSemester,
            activeTerm,
            setTerm,
            isLoading,
            termOptions
        }}>
            {children}
        </TermContext.Provider>
    );
};
