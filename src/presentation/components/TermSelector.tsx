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
                        const parts = val.split('-');
                        if (parts.length >= 3) {
                            setTerm(`${parts[0]}-${parts[1]}`, parts[2] as 'Odd' | 'Even');
                        } else if (parts.length === 2) {
                            setTerm(parts[0], parts[1] as 'Odd' | 'Even');
                        } else {
                            setTerm(val, 'Odd');
                        }
                    }
                }}
            >
                {termOptions.map((termKey) => {
                    const parts = termKey.split('-');
                    let year, semester;
                    if (parts.length >= 3) {
                        year = `${parts[0]}-${parts[1]}`;
                        semester = parts[2];
                    } else if (parts.length === 2) {
                        year = parts[0];
                        semester = parts[1];
                    } else {
                        year = termKey;
                        semester = '';
                    }
                    return (
                        <option key={termKey} value={termKey} className="bg-slate-800 text-white">
                            {semester ? `${year} - ${semester}` : year}
                        </option>
                    );
                })}
            </select>
        </div>
    );
};
