import React, { useState, useEffect, useMemo } from 'react';
import { TimetableEntry, SubjectConfig, StudentRecord } from '../../../domain/entities/types';
import { dataService } from '../../../infrastructure/services/dataService';
import { DAYS } from '../../../domain/entities/constants';

interface MasterTimetableProps {
    subjects: SubjectConfig[];
    students: StudentRecord[];
}

const MasterTimetable: React.FC<MasterTimetableProps> = ({ subjects, students }) => {
    const [allTimetables, setAllTimetables] = useState<TimetableEntry[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [viewType, setViewType] = useState<'class' | 'faculty'>('class');
    const [filterValue, setFilterValue] = useState('');

    const classes = useMemo(() => [...new Set(students.map(s => s.className))], [students]);
    const faculties = useMemo(() => [...new Set(subjects.map(s => s.facultyName).filter(Boolean))], [subjects]);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setIsLoading(true);
        try {
            const data = await dataService.getAllTimetables();
            setAllTimetables(data);
        } catch (error) {
            console.error('Error loading Master Timetable:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const groupedData = useMemo(() => {
        if (viewType === 'class') {
            const data: Record<string, TimetableEntry[]> = {};
            classes.forEach(c => {
                data[c] = allTimetables.filter(t => t.className === c);
            });
            return data;
        } else {
            const data: Record<string, TimetableEntry[]> = {};
            const activeFaculties = filterValue ? [filterValue] : faculties;
            activeFaculties.forEach(f => {
                // To get faculty data, we need to map subjectId to subject and check facultyName
                data[f] = allTimetables.filter(t => {
                    const sub = subjects.find(s => s.id === t.subjectId);
                    return sub?.facultyName === f;
                });
            });
            return data;
        }
    }, [allTimetables, viewType, filterValue, classes, faculties, subjects]);

    const handleExportCSV = () => {
        if (!allTimetables.length) return;

        const header = ['Class', 'Day', 'Subject', 'Faculty', 'Start Time', 'End Time'];
        const rows = allTimetables.map(entry => {
            const sub = subjects.find(s => s.id === entry.subjectId);
            return [
                entry.className,
                entry.day,
                entry.subjectName,
                sub?.facultyName || 'Staff',
                entry.startTime,
                entry.endTime
            ].map(cell => `"${cell}"`).join(',');
        });

        const csvContent = [header.join(','), ...rows].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', 'master_timetable.csv');
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="loader-ring"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header / Controls */}
            <div className="bg-slate-50 p-6 rounded-3xl border border-slate-200">
                <div className="flex flex-wrap items-center justify-between gap-6">
                    <div className="flex bg-white p-1.5 rounded-2xl border border-slate-200 shadow-sm">
                        <button
                            onClick={() => { setViewType('class'); setFilterValue(''); }}
                            className={`px-6 py-2.5 rounded-xl text-xs font-black transition-all ${viewType === 'class' ? 'bg-emerald-600 text-white shadow-lg' : 'text-slate-400'}`}
                        >
                            Class View
                        </button>
                        <button
                            onClick={() => { setViewType('faculty'); setFilterValue(''); }}
                            className={`px-6 py-2.5 rounded-xl text-xs font-black transition-all ${viewType === 'faculty' ? 'bg-emerald-600 text-white shadow-lg' : 'text-slate-400'}`}
                        >
                            Faculty View
                        </button>
                    </div>

                    <div className="flex-1 max-w-md">
                        {viewType === 'faculty' ? (
                            <select
                                value={filterValue}
                                onChange={(e) => setFilterValue(e.target.value)}
                                className="w-full p-3 bg-white border border-slate-200 rounded-2xl text-xs font-black text-slate-700 focus:ring-4 focus:ring-emerald-500/10 appearance-none transition-all"
                            >
                                <option value="">All Faculty Schedules</option>
                                {faculties.map(f => <option key={f} value={f}>{f}</option>)}
                            </select>
                        ) : (
                            <select
                                value={filterValue}
                                onChange={(e) => setFilterValue(e.target.value)}
                                className="w-full p-3 bg-white border border-slate-200 rounded-2xl text-xs font-black text-slate-700 focus:ring-4 focus:ring-emerald-500/10 appearance-none transition-all"
                            >
                                <option value="">Entire Institution (All Classes)</option>
                                {classes.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                        )}
                    </div>

                    <div className="flex gap-2">
                        <button
                            onClick={handleExportCSV}
                            className="px-4 py-3 bg-slate-800 text-white rounded-xl text-[10px] font-black hover:bg-slate-900 transition-all uppercase tracking-wider flex items-center gap-2 shadow-md"
                        >
                            <i className="fa-solid fa-file-csv"></i>
                            Download Master
                        </button>
                        <button
                            onClick={loadData}
                            className="p-3 bg-slate-100 text-slate-500 rounded-xl hover:bg-slate-200 transition-all"
                        >
                            <i className="fa-solid fa-sync-alt"></i>
                        </button>
                    </div>
                </div>
            </div>

            {/* Timetable Grids */}
            <div className="space-y-8">
                {Object.entries(groupedData).map(([title, entries]) => {
                    if (filterValue && title !== filterValue) return null;
                    if (entries.length === 0) return null;

                    return (
                        <div key={title} className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <div className="px-8 py-5 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                                <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center gap-3">
                                    <span className="w-2 h-6 bg-emerald-500 rounded-full"></span>
                                    {title}
                                </h3>
                                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">
                                    {entries.length} Assigned Periods
                                </div>
                            </div>
                            <div className="p-4 overflow-x-auto">
                                <table className="w-full text-left border-collapse min-w-[800px]">
                                    <thead>
                                        <tr>
                                            <th className="p-4 text-[10px] font-black uppercase text-slate-400 tracking-widest border-b border-slate-100 bg-slate-50/30">Day</th>
                                            {/* We assume a standard 8-period model or similar for the Master View display */}
                                            {Array.from({ length: 8 }).map((_, i) => (
                                                <th key={i} className="p-4 text-[10px] font-black uppercase text-slate-400 tracking-widest border-b border-slate-100 bg-slate-50/30">
                                                    Slot {i + 1}
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {DAYS.map(day => (
                                            <tr key={day} className="hover:bg-slate-50/20 transition-colors">
                                                <td className="p-4 font-black text-slate-900 border-b border-slate-100 bg-slate-50/10 w-32">{day}</td>
                                                {Array.from({ length: 8 }).map((_, slotIndex) => {
                                                    // Find entry for this day and slot. 
                                                    // Note: TimetableEntry doesn't share a global slot index perfectly if classes have different break configurations,
                                                    // but we'll try to match by relative order of periods.
                                                    const dayEntries = entries.filter(e => e.day === day);
                                                    // This is a simplification: assuming entries are stored in chronological order.
                                                    // A better way would be comparing startTimes if available globally.
                                                    const entry = dayEntries[slotIndex];

                                                    return (
                                                        <td key={slotIndex} className="p-2 border-b border-slate-100 min-w-[140px]">
                                                            {entry ? (
                                                                <div className="bg-emerald-50 text-emerald-700 p-3 rounded-2xl border border-emerald-100 shadow-sm">
                                                                    <div className="text-[10px] font-black leading-tight truncate">{entry.subjectName}</div>
                                                                    <div className="flex justify-between items-center mt-1.5 pt-1.5 border-t border-emerald-100/50">
                                                                        <span className="text-[8px] font-bold text-emerald-600/60 uppercase tracking-tighter shrink-0">
                                                                            {viewType === 'class'
                                                                                ? (subjects.find(s => s.id === entry.subjectId)?.facultyName || 'Staff')
                                                                                : entry.className}
                                                                        </span>
                                                                        <span className="text-[7px] font-black text-emerald-500/40 tabular-nums">
                                                                            {entry.startTime}
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                            ) : (
                                                                <div className="h-10 border-2 border-dashed border-slate-50/50 rounded-2xl"></div>
                                                            )}
                                                        </td>
                                                    );
                                                })}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    );
                })}
            </div>

            {Object.keys(groupedData).length === 0 && (
                <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-[3rem] p-24 text-center">
                    <i className="fa-solid fa-calendar-xmark text-6xl text-slate-200 mb-6 font-thin"></i>
                    <h3 className="text-slate-400 font-black uppercase tracking-widest text-sm">No Timetables Found</h3>
                    <p className="text-slate-300 text-xs mt-2 font-bold italic tracking-tight">Generate and apply class timetables to see them in the Master View</p>
                </div>
            )}
        </div>
    );
};

export default MasterTimetable;
