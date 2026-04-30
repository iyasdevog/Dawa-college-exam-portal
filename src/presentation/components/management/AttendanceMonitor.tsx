import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { AttendanceRecord, StudentRecord, SubjectConfig } from '../../../domain/entities/types';
import { dataService } from '../../../infrastructure/services/dataService';
import { useMobile } from '../../hooks/useMobile';
import { useTerm } from '../../viewmodels/TermContext';

interface AttendanceMonitorProps {
    students: StudentRecord[];
    subjects: SubjectConfig[];
}

const AttendanceMonitor: React.FC<AttendanceMonitorProps> = ({ students, subjects }) => {
    const { isMobile } = useMobile();
    const { activeTerm } = useTerm();
    const [records, setRecords] = useState<AttendanceRecord[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedClass, setSelectedClass] = useState('All');
    const [selectedSubject, setSelectedSubject] = useState('All');
    const [searchTerm, setSearchTerm] = useState('');
    const [viewingRecord, setViewingRecord] = useState<AttendanceRecord | null>(null);
    const [viewMode, setViewMode] = useState<'records' | 'analytics'>('records');
    const [selectedAnalyticsClass, setSelectedAnalyticsClass] = useState<string | null>(null);

    const classes = useMemo(() => ['All', ...new Set(students.map(s => s.className))].sort(), [students]);

    // Analytics Calculation
    const analyticsData = useMemo(() => {
        const classStats: Record<string, { present: number; total: number; subjects: Record<string, { present: number; total: number }> }> = {};

        records.forEach(record => {
            const className = record.className;
            const subjectId = record.subjectId;
            const present = record.presentStudentIds.length;
            const total = present + record.absentStudentIds.length;

            if (!classStats[className]) {
                classStats[className] = { present: 0, total: 0, subjects: {} };
            }

            classStats[className].present += present;
            classStats[className].total += total;

            if (!classStats[className].subjects[subjectId]) {
                classStats[className].subjects[subjectId] = { present: 0, total: 0 };
            }
            classStats[className].subjects[subjectId].present += present;
            classStats[className].subjects[subjectId].total += total;
        });

        // Convert the nested maps to pre-sorted arrays immediately within the useMemo
        // This avoids running Object.entries().sort() on the entire list on every React render
        return Object.entries(classStats)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([className, stats]) => ({
                className,
                present: stats.present,
                total: stats.total,
                subjectsList: Object.entries(stats.subjects)
                    .sort(([, a], [, b]) => b.total - a.total)
                    .map(([subId, subStats]) => ({
                        subId,
                        present: subStats.present,
                        total: subStats.total
                    }))
            }));
    }, [records]);
    
    // O(1) Lookup Maps for optimal rendering
    const subjectMap = useMemo(() => {
        const map: Record<string, SubjectConfig> = {};
        subjects.forEach(s => map[s.id] = s);
        return map;
    }, [subjects]);

    const studentMap = useMemo(() => {
        const map: Record<string, StudentRecord> = {};
        students.forEach(s => map[s.id] = s);
        return map;
    }, [students]);

    const loadRecords = useCallback(async () => {
        setIsLoading(true);
        try {
            const data = await dataService.getAllAttendanceRecords(activeTerm);
            const parts = activeTerm.split('-');
            const targetSem = parts.pop();
            const targetYear = parts.join('-');
            const termFiltered = data.filter(record => {
                if (record.academicYear && record.semester) {
                    return record.academicYear === targetYear && record.semester === targetSem;
                }
                return true;
            });
            setRecords(termFiltered);
        } catch (error) {
            console.error('Error loading attendance records:', error);
        } finally {
            setIsLoading(false);
        }
    }, [activeTerm]);

    useEffect(() => {
        loadRecords();
    }, [loadRecords]);

    const handleDeleteRecord = useCallback(async (record: AttendanceRecord) => {
        const subject = subjects.find(s => s.id === record.subjectId);
        const confirmMsg = `Are you sure you want to delete the attendance record for ${subject?.name || 'this subject'} in ${record.className} on ${record.date}?`;
        
        if (window.confirm(confirmMsg)) {
            try {
                setIsLoading(true);
                await dataService.deleteAttendancePeriod(record.id);
                await loadRecords();
            } catch (error) {
                console.error('Error deleting record:', error);
                alert('Failed to delete attendance record.');
                setIsLoading(false);
            }
        }
    }, [subjects, loadRecords]);

    const filteredRecords = useMemo(() => {
        const query = searchTerm.toLowerCase();
        
        return records.filter(record => {
            const matchesClass = selectedClass === 'All' || record.className === selectedClass;
            const matchesSubject = selectedSubject === 'All' || record.subjectId === selectedSubject;

            if (!matchesClass || !matchesSubject) return false;

            if (query) {
                const subject = subjectMap[record.subjectId];
                return (subject?.name.toLowerCase().includes(query)) || 
                       (record.className.toLowerCase().includes(query));
            }
            return true;
        });
    }, [records, selectedClass, selectedSubject, searchTerm, subjectMap]);

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center py-24 bg-white rounded-[2rem] border border-slate-200">
                <div className="loader-ring mb-4"></div>
                <p className="text-slate-500 font-bold">Fetching academic records...</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Stats Overview */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-emerald-50 p-6 rounded-[2rem] border border-emerald-100">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-emerald-100 rounded-2xl flex items-center justify-center text-emerald-600">
                            <i className="fa-solid fa-check-double text-xl"></i>
                        </div>
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600">Total Entries</p>
                            <h3 className="text-2xl font-black text-emerald-900">{records.length}</h3>
                        </div>
                    </div>
                </div>
                <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-200">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-slate-200 rounded-2xl flex items-center justify-center text-slate-600">
                            <i className="fa-solid fa-users text-xl"></i>
                        </div>
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-600">Classes Monitored</p>
                            <h3 className="text-2xl font-black text-slate-900">{classes.length - 1}</h3>
                        </div>
                    </div>
                </div>
                <div className="bg-amber-50 p-6 rounded-[2rem] border border-amber-100">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-amber-100 rounded-2xl flex items-center justify-center text-amber-600">
                            <i className="fa-solid fa-clock-rotate-left text-xl"></i>
                        </div>
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-amber-600">Latest Update</p>
                            <h3 className="text-sm font-black text-amber-900">{records[0]?.date || 'N/A'}</h3>
                        </div>
                    </div>
                </div>
            </div>

            {/* View Mode Toggle */}
            <div className="flex bg-slate-100 p-1.5 rounded-2xl w-full sm:w-fit self-center">
                <button
                    onClick={() => setViewMode('records')}
                    className={`flex-1 sm:flex-none px-6 py-2.5 rounded-xl font-black text-xs uppercase tracking-widest transition-all ${viewMode === 'records' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                    <i className="fa-solid fa-list-ul mr-2"></i> Period Records
                </button>
                <button
                    onClick={() => setViewMode('analytics')}
                    className={`flex-1 sm:flex-none px-6 py-2.5 rounded-xl font-black text-xs uppercase tracking-widest transition-all ${viewMode === 'analytics' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                    <i className="fa-solid fa-chart-line mr-2"></i> Class Analytics
                </button>
            </div>

            {viewMode === 'analytics' ? (
                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    {/* Class Cards Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                        {analyticsData.map(({ className, present, total, subjectsList }) => {
                            const percentage = total > 0 ? (present / total) * 100 : 0;
                            const isSelected = selectedAnalyticsClass === className;

                            return (
                                <div 
                                    key={className}
                                    onClick={() => setSelectedAnalyticsClass(isSelected ? null : className)}
                                    className={`group cursor-pointer rounded-[2.5rem] border-2 transition-all duration-300 overflow-hidden relative ${isSelected ? 'bg-slate-900 border-slate-900 shadow-2xl scale-[1.02]' : 'bg-white border-slate-100 hover:border-emerald-200 hover:shadow-xl'}`}
                                >
                                    {/* Stats Icon Background Bubble */}
                                    <div className={`absolute -top-6 -right-6 w-24 h-24 rounded-full transition-colors ${isSelected ? 'bg-white/5 font-black' : 'bg-slate-50 group-hover:bg-emerald-50'}`} />
                                    
                                    <div className="p-8 relative z-10">
                                        <div className="flex justify-between items-start mb-6">
                                            <div>
                                                <p className={`text-[10px] font-black uppercase tracking-[0.2em] mb-1 ${isSelected ? 'text-slate-400' : 'text-emerald-600'}`}>Class Performance</p>
                                                <h3 className={`text-2xl font-black tracking-tight ${isSelected ? 'text-white' : 'text-slate-900'}`}>{className}</h3>
                                            </div>
                                            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl transition-all shadow-sm ${isSelected ? 'bg-emerald-500 text-white rotate-12' : 'bg-slate-50 text-slate-400 group-hover:bg-emerald-500 group-hover:text-white group-hover:rotate-12'}`}>
                                                <i className="fa-solid fa-chart-simple"></i>
                                            </div>
                                        </div>

                                        <div className="space-y-4">
                                            <div className="flex items-end justify-between">
                                                <div>
                                                    <p className={`text-[10px] font-bold uppercase tracking-tight mb-0.5 ${isSelected ? 'text-slate-400' : 'text-slate-500'}`}>Avg. Attendance</p>
                                                    <h4 className={`text-3xl font-black ${isSelected ? 'text-white' : 'text-slate-900'}`}>{Math.round(percentage)}%</h4>
                                                </div>
                                                <div className="text-right">
                                                    <p className={`text-[10px] font-bold uppercase tracking-tight mb-0.5 ${isSelected ? 'text-slate-400' : 'text-slate-500'}`}>Total Periods</p>
                                                    <h4 className={`text-lg font-black ${isSelected ? 'text-white' : 'text-slate-900'}`}>{total}</h4>
                                                </div>
                                            </div>

                                            {/* Progress Bar */}
                                            <div className={`h-2.5 w-full rounded-full overflow-hidden ${isSelected ? 'bg-white/10' : 'bg-slate-100'}`}>
                                                <div 
                                                    className={`h-full transition-all duration-1000 ${percentage > 85 ? 'bg-emerald-500' : percentage > 75 ? 'bg-amber-500' : 'bg-rose-500'}`}
                                                    style={{ width: `${percentage}%` }}
                                                />
                                            </div>
                                            
                                            <div className="flex items-center justify-between pt-2">
                                                <span className={`text-[9px] font-black uppercase tracking-widest ${isSelected ? 'text-emerald-400' : 'text-slate-400 group-hover:text-emerald-600'}`}>
                                                    {isSelected ? 'Click to collapse' : 'View Subject Breakdown'}
                                                </span>
                                                <i className={`fa-solid ${isSelected ? 'fa-chevron-up' : 'fa-chevron-right'} text-sm ${isSelected ? 'text-white' : 'text-slate-300'}`}></i>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Expandable Subject Breakdown */}
                                    {isSelected && (
                                        <div className="px-8 pb-8 pt-2 animate-in slide-in-from-top-4 duration-300">
                                            <div className="bg-white/5 rounded-3xl p-4 border border-white/10 space-y-4">
                                                <h5 className="text-[9px] font-black uppercase tracking-widest text-slate-400 border-b border-white/10 pb-2">Individual Subjects</h5>
                                                <div className="space-y-3">
                                                    {subjectsList.map(({ subId, present: subPresent, total: subTotal }) => {
                                                        const subject = subjectMap[subId];
                                                        const subPerc = subTotal > 0 ? (subPresent / subTotal) * 100 : 0;
                                                        return (
                                                            <div key={subId} className="flex items-center justify-between gap-4">
                                                                <div className="flex-1 min-w-0">
                                                                    <p className="text-xs font-bold text-white truncate">{subject?.name || 'Unknown'}</p>
                                                                    <div className="flex items-center gap-2 mt-1">
                                                                        <div className="flex-1 h-1 bg-white/10 rounded-full overflow-hidden">
                                                                            <div 
                                                                                className={`h-full ${subPerc > 80 ? 'bg-emerald-500' : subPerc > 60 ? 'bg-amber-500' : 'bg-rose-500'}`}
                                                                                style={{ width: `${subPerc}%` }}
                                                                            />
                                                                        </div>
                                                                        <span className="text-[10px] font-black text-slate-400 w-8 text-right">{Math.round(subPerc)}%</span>
                                                                    </div>
                                                                </div>
                                                                <div className="text-right">
                                                                    <p className="text-[9px] font-black text-white">{subPresent}/{subTotal}</p>
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            ) : (
                <>
                {/* Filters */}
                <div className="bg-white p-6 rounded-[2.5rem] border border-slate-200 shadow-sm flex flex-col md:flex-row gap-4 items-center">
                    <div className="relative flex-1 w-full">
                        <i className="fa-solid fa-magnifying-glass absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"></i>
                        <input
                            type="text"
                            placeholder="Search by subject or class..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all font-medium"
                        />
                    </div>
                    <div className="flex gap-2 w-full md:w-auto">
                        <select
                            value={selectedClass}
                            onChange={(e) => setSelectedClass(e.target.value)}
                            className="flex-1 md:w-40 p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 outline-none"
                        >
                            {/* Corrected mapping to use pre-sorted classes array */}
                            {classes.map(c => <option key={c} value={c}>{c === 'All' ? 'All Classes' : c}</option>)}
                        </select>
                        <select
                            value={selectedSubject}
                            onChange={(e) => setSelectedSubject(e.target.value)}
                            className="flex-1 md:w-48 p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 outline-none"
                        >
                            <option value="All">All Subjects</option>
                            {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                    </div>
                </div>

            {/* Records List */}
            <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50">
                                <th className="p-5 text-[10px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-100">Date/Time</th>
                                <th className="p-5 text-[10px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-100">Class</th>
                                <th className="p-5 text-[10px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-100">Subject</th>
                                <th className="p-5 text-[10px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-100">Presence</th>
                                <th className="p-5 text-[10px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-100 text-center">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {filteredRecords.map((record) => {
                                const subject = subjectMap[record.subjectId];
                                const total = record.presentStudentIds.length + record.absentStudentIds.length;
                                const ratio = total > 0 ? (record.presentStudentIds.length / total) * 100 : 0;

                                return (
                                    <tr key={record.id} className="group hover:bg-slate-50/50 transition-colors">
                                        <td className="p-5">
                                            <p className="font-black text-slate-900">{record.date}</p>
                                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">
                                                {new Date(record.markedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </p>
                                        </td>
                                        <td className="p-5">
                                            <span className="px-3 py-1 bg-slate-100 text-slate-600 rounded-full text-[10px] font-black uppercase tracking-widest">
                                                {record.className}
                                            </span>
                                        </td>
                                        <td className="p-5 font-bold text-slate-800">{subject?.name || 'Unknown'}</td>
                                        <td className="p-5">
                                            <div className="flex items-center gap-3">
                                                <div className="flex-1 h-2 w-24 bg-slate-100 rounded-full overflow-hidden">
                                                    <div
                                                        className={`h-full transition-all duration-1000 ${ratio > 75 ? 'bg-emerald-500' : ratio > 50 ? 'bg-amber-500' : 'bg-rose-500'}`}
                                                        style={{ width: `${ratio}%` }}
                                                    ></div>
                                                </div>
                                                <span className="text-xs font-black text-slate-500">{Math.round(ratio)}%</span>
                                            </div>
                                            <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-tighter">
                                                {record.presentStudentIds.length} Present / {record.absentStudentIds.length} Absent
                                            </p>
                                        </td>
                                        <td className="p-5 text-center">
                                            <div className="flex items-center justify-center gap-2">
                                                <button
                                                    onClick={() => setViewingRecord(record)}
                                                    className="w-10 h-10 bg-white border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-900 hover:text-white hover:border-slate-900 transition-all shadow-sm"
                                                    title="View Details"
                                                >
                                                    <i className="fa-solid fa-eye"></i>
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteRecord(record)}
                                                    className="w-10 h-10 bg-white border border-slate-200 rounded-xl text-slate-400 hover:bg-rose-500 hover:text-white hover:border-rose-500 transition-all shadow-sm"
                                                    title="Delete Record"
                                                >
                                                    <i className="fa-solid fa-trash-can"></i>
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
                {filteredRecords.length === 0 && (
                    <div className="p-20 text-center bg-white">
                        <i className="fa-solid fa-folder-open text-5xl text-slate-100 mb-4"></i>
                        <p className="text-slate-400 font-bold">No matching attendance records found</p>
                    </div>
                )}
                </div>
                </>
            )}

            {/* Detail Modal */}
            {viewingRecord && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="bg-white rounded-[3rem] w-full max-w-2xl max-h-[80vh] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300 flex flex-col">
                        <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                            <div>
                                <h3 className="text-xl font-black text-slate-900 tracking-tight">Record Details</h3>
                                <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">
                                    {viewingRecord.className} • {subjectMap[viewingRecord.subjectId]?.name}
                                </p>
                            </div>
                            <button
                                onClick={() => setViewingRecord(null)}
                                className="w-12 h-12 rounded-2xl bg-white border border-slate-200 text-slate-400 hover:text-rose-500 transition-colors shadow-sm"
                            >
                                <i className="fa-solid fa-xmark text-lg"></i>
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-8 pt-4">
                            <div className="grid grid-cols-2 gap-4 mb-8">
                                <div className="p-6 bg-emerald-50 rounded-[2rem] border border-emerald-100">
                                    <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-1">Present Students</p>
                                    <h4 className="text-3xl font-black text-emerald-900">{viewingRecord.presentStudentIds.length}</h4>
                                </div>
                                <div className="p-6 bg-rose-50 rounded-[2rem] border border-rose-100">
                                    <p className="text-[10px] font-black text-rose-600 uppercase tracking-widest mb-1">Absent Students</p>
                                    <h4 className="text-3xl font-black text-rose-900">{viewingRecord.absentStudentIds.length}</h4>
                                </div>
                            </div>

                            <div className="space-y-6">
                                <div>
                                    <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                                        <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                                        Absentee List
                                    </h5>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                        {viewingRecord.absentStudentIds.length > 0 ? (
                                            viewingRecord.absentStudentIds.map(id => {
                                                const student = studentMap[id];
                                                return (
                                                    <div key={id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                                                        <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center text-rose-500 font-bold text-xs ring-1 ring-rose-100">
                                                            {student?.adNo.slice(-2) || '??'}
                                                        </div>
                                                        <div className="min-w-0">
                                                            <p className="font-bold text-slate-800 text-sm truncate">{student?.name || 'Unknown Student'}</p>
                                                            <p className="text-[9px] text-slate-400 font-black uppercase">{student?.adNo}</p>
                                                        </div>
                                                    </div>
                                                );
                                            })
                                        ) : (
                                            <div className="col-span-full p-8 text-center bg-emerald-50 rounded-2xl border border-emerald-100 italic text-emerald-600 font-bold text-sm">
                                                All students present! Excellent attendance.
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {viewingRecord.presentStudentIds.length > 0 && (
                                    <div>
                                        <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                            Present Students
                                        </h5>
                                        <div className="flex flex-wrap gap-2">
                                            {viewingRecord.presentStudentIds.map(id => {
                                                const student = studentMap[id];
                                                return (
                                                    <div key={id} className="px-3 py-1.5 bg-slate-50 text-slate-600 rounded-lg text-xs font-bold border border-slate-100">
                                                        {student?.name.split(' ')[0]}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="p-8 bg-slate-50 border-t border-slate-200">
                            <p className="text-[10px] text-slate-400 font-bold text-center uppercase tracking-widest">
                                Marked by {viewingRecord.markedBy} • Record ID: {viewingRecord.id}
                            </p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AttendanceMonitor;
