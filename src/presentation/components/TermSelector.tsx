import React from 'react';
import { useTerm } from '../viewmodels/TermContext';

interface TermSelectorProps {
    className?: string;
    variant?: 'light' | 'dark';
}

export const TermSelector: React.FC<TermSelectorProps> = ({ className = '', variant = 'light' }) => {
    const { currentAcademicYear, currentSemester, setTerm, termOptions } = useTerm();

    const isDark = variant === 'dark';
    const containerClasses = isDark
        ? 'bg-white/10 text-white border border-white/20'
        : 'bg-slate-100 text-slate-700 shadow-inner';

    const iconClasses = isDark ? 'text-emerald-400' : 'text-emerald-600';
    const selectClasses = isDark ? 'text-white' : 'text-slate-700';

    return (
        <div className={`flex items-center gap-2 p-2 rounded-xl text-sm font-bold ${containerClasses} ${className}`}>
            <i className={`fa-solid fa-calendar-days ${iconClasses}`}></i>
            <select
                className={`bg-transparent border-none outline-none cursor-pointer pr-2 ${selectClasses}`}
                value={`${currentAcademicYear}|${currentSemester}`}
                onChange={(e) => {
                    const [year, sem] = e.target.value.split('|');
                    setTerm(year, sem as 'Odd' | 'Even');
                }}
            >
                {termOptions.map((year) => (
                    <optgroup key={year} label={year} className="bg-slate-800 text-white">
                        <option value={`${year}|Odd`}>{year} - Odd / Sem 1</option>
                        <option value={`${year}|Even`}>{year} - Even / Sem 2</option>
                    </optgroup>
                ))}
            </select>
        </div>
    );
};
