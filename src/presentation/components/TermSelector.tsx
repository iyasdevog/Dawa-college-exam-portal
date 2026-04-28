import React from 'react';
import { useTerm } from '../viewmodels/TermContext';

interface TermSelectorProps {
    className?: string;
    variant?: 'light' | 'dark';
    value?: string;
    onChange?: (termKey: string) => void;
}

export const TermSelector: React.FC<TermSelectorProps> = ({ 
    className = '', 
    variant = 'light',
    value: controlledValue,
    onChange: controlledOnChange
}) => {
    const { currentAcademicYear, currentSemester, setTerm, termOptions } = useTerm();

    const isDark = variant === 'dark';
    const containerClasses = isDark
        ? 'bg-white/10 text-white border border-white/20'
        : 'bg-slate-100 text-slate-700 shadow-inner';

    const iconClasses = isDark ? 'text-emerald-400' : 'text-emerald-600';
    const selectClasses = isDark ? 'text-white' : 'text-slate-700';

    // If controlled, we expect value to be "Year-Semester" or similar, but the internal select uses "Year|Semester"
    // Wait, let's keep it simple: internal select uses "Year-Semester" as well
    const currentValue = controlledValue || `${currentAcademicYear}-${currentSemester}`;

    return (
        <div className={`flex items-center gap-2 p-2 rounded-xl text-sm font-bold ${containerClasses} ${className}`}>
            <i className={`fa-solid fa-calendar-days ${iconClasses}`}></i>
            <select
                className={`bg-transparent border-none outline-none cursor-pointer pr-2 ${selectClasses}`}
                value={currentValue}
                onChange={(e) => {
                    const val = e.target.value;
                    if (controlledOnChange) {
                        controlledOnChange(val);
                    } else {
                        // Better split logic: The semester is always the last part after the last hyphen
                        const lastHyphenIndex = val.lastIndexOf('-');
                        if (lastHyphenIndex !== -1) {
                            const year = val.substring(0, lastHyphenIndex);
                            const sem = val.substring(lastHyphenIndex + 1);
                            setTerm(year, sem as 'Odd' | 'Even');
                        } else {
                            setTerm(val, 'Odd');
                        }
                    }
                }}
            >
                {/* 
                    Consistent Term Selection:
                    We iterate over 'availableYears' (e.g., ["2025-2026", "2026"]) 
                    and show both semesters for each year. 
                */}
                {termOptions.map((yearOrTerm) => {
                    // Robust extraction of the Year part
                    const lastHyphenIndex = yearOrTerm.lastIndexOf('-');
                    let year = yearOrTerm;
                    
                    // If it's a full key (has suffix), extract base year
                    if (yearOrTerm.endsWith('-Odd') || yearOrTerm.endsWith('-Even')) {
                        year = yearOrTerm.substring(0, lastHyphenIndex);
                    }

                    return (
                        <React.Fragment key={year}>
                            <option value={`${year}-Odd`} className="bg-slate-800 text-white">
                                {year} - Odd Semester
                            </option>
                            <option value={`${year}-Even`} className="bg-slate-800 text-white">
                                {year} - Even Semester
                            </option>
                        </React.Fragment>
                    );
                })}
            </select>
        </div>
    );
};
