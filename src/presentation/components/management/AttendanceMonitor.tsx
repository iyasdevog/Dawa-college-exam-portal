import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { AttendanceRecord, StudentRecord, SubjectConfig, TimetableEntry } from '../../../domain/entities/types';
import { dataService } from '../../../infrastructure/services/dataService';
import { useMobile } from '../../hooks/useMobile';
import { useTerm } from '../../viewmodels/TermContext';
import StudentAttendanceStats from './StudentAttendanceStats';

interface AttendanceMonitorProps {
    students: StudentRecord[];
    subjects: SubjectConfig[];
}

const AttendanceMonitor: React.FC<AttendanceMonitorProps> = ({ students, subjects }) => {
    const { isMobile } = useMobile();
    const { activeTerm } = useTerm();
    const [records, setRecords] = useState<AttendanceRecord[]>([]);
    const [timetables, setTimetables] = useState<TimetableEntry[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedClass, setSelectedClass] = useState('All');
    const [selectedSubject, setSelectedSubject] = useState('All');
    const [searchTerm, setSearchTerm] = useState('');
    const [viewingRecord, setViewingRecord] = useState<AttendanceRecord | null>(null);
    const [viewMode, setViewMode] = useState<'records' | 'analytics' | 'student-stats'>('records');
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
            const [data, tData] = await Promise.all([
                dataService.getAllAttendanceRecords(activeTerm),
                dataService.getAllTimetables(activeTerm)
            ]);
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
            setTimetables(tData || []);
        } catch (error) {
            console.error('Error loading attendance records/timetables:', error);
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

    const getLocalDateString = useCallback((offsetDays: number = 0) => {
        const d = new Date();
        d.setDate(d.getDate() - offsetDays);
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }, []);

    const todayStr = useMemo(() => getLocalDateString(0), [getLocalDateString]);
    const yesterdayStr = useMemo(() => getLocalDateString(1), [getLocalDateString]);
    const dayBeforeStr = useMemo(() => getLocalDateString(2), [getLocalDateString]);

    const getDayOfWeek = (dateStr: string) => {
        const d = new Date(dateStr);
        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        return days[d.getDay()];
    };

    const buildDailyTimetable = useCallback((dateStr: string) => {
        const dayOfWeek = getDayOfWeek(dateStr);
        // Do not filter by selected class and selected subject initially. We just want records of the day.
        const dayRecords = records.filter(r => r.date === dateStr && (selectedClass === 'All' || r.className === selectedClass));
        
        // Find ALL time slots globally for this day, to establish the school's gap scale
        const allDayTimetables = timetables.filter(t => t.day.toLowerCase() === dayOfWeek.toLowerCase());
        
        const STANDARD_PERIODS = [
            { startTime: '05:30', endTime: '06:30' },
            { startTime: '06:30', endTime: '07:30' },
            { startTime: '07:30', endTime: '08:30' },
            { startTime: '09:00', endTime: '10:00' },
            { startTime: '10:00', endTime: '10:55' },
            { startTime: '11:05', endTime: '12:00' },
            { startTime: '12:00', endTime: '13:00' },
            { startTime: '14:00', endTime: '14:55' },
            { startTime: '15:05', endTime: '16:00' }
        ];

        const results: any[] = [];
        const matchedRecordIds = new Set<string>();

        STANDARD_PERIODS.forEach(slot => {
            const { startTime, endTime } = slot;
                
            const scheduledPeriods = allDayTimetables.filter(t => 
                t.startTime === startTime && 
                t.endTime === endTime && 
                (selectedClass === 'All' || t.className === selectedClass)
            );

            if (scheduledPeriods.length > 0) {
                scheduledPeriods.forEach(sp => {
                    const matchingRecord = dayRecords.find(r => r.subjectId === sp.subjectId && r.className === sp.className && !matchedRecordIds.has(r.id));
                    if (matchingRecord) {
                        matchedRecordIds.add(matchingRecord.id);
                        results.push({ period: sp, record: matchingRecord, type: 'scheduled', sortByTime: startTime });
                    } else {
                        results.push({ period: sp, record: null, type: 'scheduled', sortByTime: startTime });
                    }
                });
            } else {
                // If no scheduled periods, check if a manual attendance was taken during this slot
                const manualRecord = dayRecords.find(r => {
                    if (matchedRecordIds.has(r.id)) return false;
                    const markedTime = new Date(r.markedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
                    // Special case for selected class or all classes
                    if (selectedClass !== 'All' && r.className !== selectedClass) return false;
                    return markedTime >= startTime && markedTime <= endTime;
                });

                if (manualRecord) {
                    matchedRecordIds.add(manualRecord.id);
                    results.push({ 
                        period: null, 
                        record: manualRecord, 
                        type: 'manual-matched', 
                        startTime, 
                        endTime, 
                        sortByTime: startTime 
                    });
                } else {
                    results.push({ 
                        period: { subjectId: null, startTime, endTime, className: selectedClass !== 'All' ? selectedClass : 'All' }, 
                        record: null, 
                        type: 'free', 
                        sortByTime: startTime 
                    });
                }
            }
        });

        // Unscheduled/Extra (attendance marked but not in timetable)
        dayRecords.forEach(r => {
            if (!matchedRecordIds.has(r.id)) {
                const timeStr = new Date(r.markedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
                results.push({ period: null, record: r, type: 'unscheduled', sortByTime: timeStr });
            }
        });

        return results.sort((a, b) => a.sortByTime.localeCompare(b.sortByTime));
    }, [records, timetables, selectedClass]);

    const todayMerged = useMemo(() => buildDailyTimetable(todayStr), [buildDailyTimetable, todayStr]);
    const yesterdayMerged = useMemo(() => buildDailyTimetable(yesterdayStr), [buildDailyTimetable, yesterdayStr]);
    const dayBeforeMerged = useMemo(() => buildDailyTimetable(dayBeforeStr), [buildDailyTimetable, dayBeforeStr]);

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

            <div className="flex bg-slate-100 p-1.5 rounded-2xl w-full lg:w-fit self-center overflow-x-auto no-scrollbar">
                <button
                    onClick={() => setViewMode('records')}
                    className={`flex-1 lg:flex-none px-6 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all whitespace-nowrap ${viewMode === 'records' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                    <i className="fa-solid fa-list-ul mr-2"></i> Period Records
                </button>
                <button
                    onClick={() => setViewMode('analytics')}
                    className={`flex-1 lg:flex-none px-6 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all whitespace-nowrap ${viewMode === 'analytics' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                    <i className="fa-solid fa-chart-pie mr-2"></i> Class Analytics
                </button>
                <button
                    onClick={() => setViewMode('student-stats')}
                    className={`flex-1 lg:flex-none px-6 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all whitespace-nowrap ${viewMode === 'student-stats' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                    <i className="fa-solid fa-chart-user mr-2"></i> Student Analytics
                </button>
            </div>

            {viewMode === 'student-stats' ? (
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <StudentAttendanceStats 
                        students={students}
                        subjects={subjects}
                    />
                </div>
            ) : viewMode === 'analytics' ? (
                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    {/* Class Cards Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                        {analyticsData.map(({ className, present, total, subjectsList }) => {
                            const percentage = total > 0 ? (present / total) * 100 : 0;
                            const isSelected = selectedAnalyticsClass === className;

                            return (
                                <React.Fragment key={className}>
                                    <div 
                                        onClick={() => setSelectedAnalyticsClass(isSelected ? null : className)}
                                        className={`group cursor-pointer rounded-[2.5rem] border-2 transition-all duration-300 overflow-hidden relative ${isSelected ? 'bg-slate-900 border-slate-900 shadow-2xl scale-[1.02]' : 'bg-white border-slate-100 hover:border-emerald-200 hover:shadow-xl'}`}
                                    >
                                        {/* Stats Icon Background Bubble */}
                                        <div className={`absolute -top-6 -right-6 w-24 h-24 rounded-full transition-colors ${isSelected ? 'bg-white/5 font-black' : 'bg-slate-50 group-hover:bg-emerald-50'}`} />
                                        
                                        <div className="p-8 relative z-10 text-slate-900">
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
                                                        <p className={`text-[10px] font-bold uppercase tracking-tight mb-0.5 ${isSelected ? 'text-slate-200/50' : 'text-slate-400'}`}>Entries</p>
                                                        <p className={`text-xs font-black ${isSelected ? 'text-white' : 'text-slate-700'}`}>{subjectsList.length} subjects</p>
                                                    </div>
                                                </div>

                                                <div className="relative h-2 bg-slate-100 rounded-full overflow-hidden">
                                                    <div 
                                                        className="absolute h-full bg-emerald-500 rounded-full transition-all duration-1000"
                                                        style={{ width: `${percentage}%` }}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Expandable Subject Breakdown */}
                                    {isSelected && (
                                        <div className="px-8 pb-8 pt-2 animate-in slide-in-from-top-4 duration-300">
                                            <div className="bg-slate-800 rounded-3xl p-6 border border-white/10 space-y-4">
                                                <h5 className="text-[9px] font-black uppercase tracking-widest text-slate-400 border-b border-white/10 pb-2">Individual Subjects</h5>
                                                <div className="space-y-4">
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
                                </React.Fragment>
                            );
                        })}
                    </div>
                </div>
            ) : (
                <>
                {/* Filters */}
                <div className="bg-white p-6 rounded-[2.5rem] border border-slate-200 shadow-sm flex flex-col md:flex-row gap-4 items-center mb-6">
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
                            value={selectedSubject}
                            onChange={(e) => setSelectedSubject(e.target.value)}
                            className="flex-1 md:w-48 p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 outline-none"
                        >
                            <option value="All">All Subjects</option>
                            {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                    </div>
                </div>

            {/* Main Layout: 2/3 Updates, 1/3 Timetable Status */}
            <div className="flex flex-col lg:flex-row gap-8">
                
                {/* Left Side: Recent Updates (2/3 width) */}
                <div className="lg:w-2/3 space-y-6">
                    <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden">
                        <div className="bg-slate-50 border-b border-slate-100 p-6 flex justify-between items-center">
                            <h3 className="text-lg font-black text-slate-800">Recent Updates (Top 10)</h3>
                        </div>
                        {filteredRecords.length === 0 ? (
                            <div className="p-12 text-center bg-white">
                                <i className="fa-solid fa-folder-open text-4xl text-slate-100 mb-4"></i>
                                <p className="text-slate-400 font-bold">No records found.</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-white">
                                            <th className="p-5 text-[10px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-100">Date/Time</th>
                                            <th className="p-5 text-[10px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-100 min-w-[120px]">Class</th>
                                            <th className="p-5 text-[10px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-100">Subject & Presence</th>
                                            <th className="p-5 text-[10px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-100 text-center">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50">
                                        {filteredRecords.slice(0, 10).map((record) => {
                                            const subject = subjectMap[record.subjectId];
                                            const total = record.presentStudentIds.length + record.absentStudentIds.length;
                                            const ratio = total > 0 ? (record.presentStudentIds.length / total) * 100 : 0;

                                            return (
                                                <tr key={record.id} className="group hover:bg-slate-50/50 transition-colors">
                                                    <td className="p-5 align-top pt-8">
                                                        <div className="flex flex-col gap-1">
                                                            <p className="text-sm font-black text-slate-700">{new Date(record.markedAt).toLocaleDateString([], { month: 'short', day: 'numeric'})}</p>
                                                            <p className="font-bold text-slate-500 bg-slate-50 rounded-xl px-2 py-1 inline-flex items-center gap-1 text-[11px] border border-slate-100 shadow-sm w-fit">
                                                                <i className="fa-regular fa-clock text-emerald-500"></i>
                                                                {new Date(record.markedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                            </p>
                                                        </div>
                                                    </td>
                                                    <td className="p-5 align-top pt-8">
                                                        <span className="px-3 py-1.5 bg-slate-100 text-slate-700 rounded-xl text-xs font-black uppercase tracking-widest border border-slate-200">
                                                            {record.className}
                                                        </span>
                                                    </td>
                                                    <td className="p-5">
                                                        <div className="flex flex-col gap-2">
                                                            <div className="flex items-center gap-2">
                                                                <span className={`w-2 h-2 rounded-full ${record.isSpecialDay ? 'bg-amber-500' : 'bg-emerald-500'}`}></span>
                                                                <p className="font-black text-slate-800 text-sm md:text-base line-clamp-1">{subject?.name || 'Unknown Subject'}</p>
                                                                {record.isSpecialDay ? (
                                                                    <span className="px-2 py-0.5 bg-amber-50 text-amber-600 border border-amber-100 rounded-md text-[10px] font-black uppercase tracking-widest hidden sm:inline-block">
                                                                        {record.specialDayType || 'Special'}
                                                                    </span>
                                                                ) : (
                                                                    <span className="px-2 py-0.5 bg-emerald-50 text-emerald-600 border border-emerald-100 rounded-md text-[10px] font-black uppercase tracking-widest hidden sm:inline-block">Marked</span>
                                                                )}
                                                            </div>
                                                            {record.isSpecialDay && record.specialDayNote && (
                                                                <p className="text-[11px] text-slate-500 italic mt-0.5 line-clamp-1">{record.specialDayNote}</p>
                                                            )}
                                                            <div className="pl-4 border-l-2 border-slate-100 mt-1">
                                                                <div className="flex items-center gap-3 mb-1">
                                                                    <div className="flex-1 h-1.5 w-24 sm:w-32 bg-slate-100 rounded-full overflow-hidden">
                                                                        <div
                                                                            className={`h-full transition-all duration-1000 ${ratio > 75 ? 'bg-emerald-500' : ratio > 50 ? 'bg-amber-500' : 'bg-rose-500'}`}
                                                                            style={{ width: `${ratio}%` }}
                                                                        ></div>
                                                                    </div>
                                                                    <span className="text-[10px] font-black text-slate-500">{Math.round(ratio)}%</span>
                                                                </div>
                                                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter flex gap-2">
                                                                    <span className="text-emerald-600">{record.presentStudentIds.length} Present</span>
                                                                    <span className="text-slate-300">•</span>
                                                                    <span className="text-rose-500">{record.absentStudentIds.length} Absent</span>
                                                                </p>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="p-5 text-center align-middle">
                                                        <div className="flex items-center justify-center gap-2">
                                                            <button
                                                                onClick={() => setViewingRecord(record)}
                                                                className="w-8 h-8 bg-white border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-900 hover:text-white hover:border-slate-900 transition-all shadow-sm flex items-center justify-center"
                                                                title="View Details"
                                                            >
                                                                <i className="fa-solid fa-eye text-xs"></i>
                                                            </button>
                                                            <button
                                                                onClick={() => handleDeleteRecord(record)}
                                                                className="w-8 h-8 bg-white border border-slate-200 rounded-lg text-slate-400 hover:bg-rose-500 hover:text-white hover:border-rose-500 transition-all shadow-sm flex items-center justify-center"
                                                                title="Delete Record"
                                                            >
                                                                <i className="fa-solid fa-trash-can text-xs"></i>
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>

                {/* Right Side: Daily Status (1/3 width) */}
                <div className="lg:w-1/3 flex flex-col gap-6">
                    <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Monitor Class Timetable</label>
                        <select
                            value={selectedClass}
                            onChange={(e) => setSelectedClass(e.target.value)}
                            className="w-full sm:w-auto px-4 py-2 bg-slate-100 border border-slate-200 rounded-xl font-black text-slate-700 outline-none text-sm focus:ring-4 focus:ring-slate-500/10"
                        >
                            <option value="All">All Classes</option>
                            {classes.filter(c => c !== 'All').map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                    </div>

                    {[
                        { title: "Today", date: todayStr, data: todayMerged },
                        { title: "Yesterday", date: yesterdayStr, data: yesterdayMerged },
                        { title: "Day Before", date: dayBeforeStr, data: dayBeforeMerged }
                    ].map((section, idx) => (
                        <div key={idx} className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                            <div className="bg-slate-50/50 p-6 pb-4 flex justify-between items-start border-b border-slate-100">
                                <div>
                                    <h3 className="text-xl font-black text-slate-900 tracking-tight">{section.title}</h3>
                                    <p className="text-[11px] font-bold text-slate-400 mt-1">{section.date}</p>
                                </div>
                                <span className="text-xs font-black bg-slate-200/60 text-slate-600 px-3 py-1.5 rounded-xl border border-slate-200">
                                    {section.data.length} Periods
                                </span>
                            </div>
                            
                            {section.data.length === 0 ? (
                                <div className="p-8 text-center bg-white flex-1 flex flex-col items-center justify-center">
                                    <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mb-4 border border-slate-100">
                                        <i className="fa-solid fa-calendar-xmark text-2xl text-slate-300"></i>
                                    </div>
                                    <p className="text-slate-400 font-bold text-sm">No periods scheduled or marked.</p>
                                </div>
                            ) : (
                                <div className="divide-y divide-slate-100 flex-1 overflow-y-auto max-h-[500px] bg-white hide-scrollbar">
                                    {section.data.map((item, i) => {
                                        const isMarked = !!item.record;
                                        const subjectId = item.period ? item.period.subjectId : item.record?.subjectId;
                                        const subjectName = subjectId ? (subjectMap[subjectId]?.name || 'Unknown Subject') : (item.period?.subjectName || 'Unknown');
                                        
                                        const formatTime12h = (time24: string) => {
                                            const [h, m] = time24.split(':');
                                            const hr = parseInt(h);
                                            const suffix = hr >= 12 ? 'PM' : 'AM';
                                            const hr12 = hr % 12 || 12;
                                            return `${hr12}:${m} ${suffix}`;
                                        };

                                        // Calculate timing display (Single Time like "12:19 PM" or formatted "10:00 AM")
                                        let timeDisplay = '';
                                        if (item.type === 'unscheduled' && item.record) {
                                            timeDisplay = formatTime12h(new Date(item.record.markedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }));
                                        } else if (item.period?.startTime && item.period?.endTime) {
                                            timeDisplay = `${formatTime12h(item.period.startTime)} - ${formatTime12h(item.period.endTime)}`;
                                        } else if (item.startTime && item.endTime) {
                                            // For manual-matched
                                            timeDisplay = `${formatTime12h(item.startTime)} - ${formatTime12h(item.endTime)}`;
                                        }

                                        let rowBgColor = 'bg-white';
                                        if (item.type !== 'free') {
                                            if (item.record?.isSpecialDay) {
                                                rowBgColor = 'bg-amber-50/50 hover:bg-amber-100/50';
                                            } else if (isMarked) {
                                                rowBgColor = 'bg-emerald-50/50 hover:bg-emerald-100/50';
                                            } else {
                                                rowBgColor = 'bg-rose-50/50 hover:bg-rose-100/50';
                                            }
                                        }

                                        return (
                                            <div key={i} className={`px-6 py-4 border-l-4 transition-all flex items-center gap-4 ${rowBgColor} ${
                                                item.type === 'free' ? 'border-transparent' : 
                                                item.record?.isSpecialDay ? 'border-amber-400' :
                                                isMarked ? 'border-emerald-400' : 'border-rose-400'
                                            }`}>
                                                <div className={`px-2 py-1.5 rounded-lg text-[9px] font-black w-24 text-center shrink-0 border ${
                                                    item.type === 'free' ? 'bg-slate-50 border-slate-100 text-slate-500' :
                                                    item.record?.isSpecialDay ? 'bg-amber-100 border-amber-200 text-amber-700' :
                                                    isMarked ? 'bg-emerald-100 border-emerald-200 text-emerald-700' :
                                                    'bg-rose-100 border-rose-200 text-rose-700'
                                                }`}>
                                                    {timeDisplay}
                                                </div>
                                                
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2 mb-1.5">
                                                        {item.type === 'free' ? (
                                                            <span className="w-2.5 h-2.5 rounded-full bg-slate-200"></span>
                                                        ) : item.record?.isSpecialDay ? (
                                                            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 ring-2 ring-amber-100"></span>
                                                        ) : isMarked ? (
                                                            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-emerald-100"></span>
                                                        ) : (
                                                            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 ring-2 ring-rose-100"></span>
                                                        )}
                                                        <p className={`text-base font-black truncate tracking-tight ${item.type === 'free' ? 'text-slate-400 italic' : 'text-slate-900'}`}>
                                                            {subjectName}
                                                            {isMarked && item.record && (
                                                                <span className="ml-2 text-xs font-bold text-slate-400">
                                                                    at {new Date(item.record.markedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                                </span>
                                                            )}
                                                        </p>
                                                    </div>
                                                    
                                                    <div className="flex items-center gap-2 ml-4">
                                                        {item.type !== 'free' && (
                                                            <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md bg-slate-100 text-slate-500 border border-slate-200">
                                                                {item.period?.className || item.record?.className || 'N/A'}
                                                            </span>
                                                        )}
                                                        
                                                        {item.type === 'unscheduled' && !item.record?.isSpecialDay ? (
                                                            <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-600 border border-emerald-100">
                                                                EXTRA
                                                            </span>
                                                        ) : item.record?.isSpecialDay ? (
                                                            <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md bg-amber-50 text-amber-600 border border-amber-100">
                                                                {item.record.specialDayType || 'SPECIAL'}
                                                            </span>
                                                        ) : item.type === 'free' ? (
                                                            <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md bg-slate-100 text-slate-400 border border-slate-200">
                                                                FREE
                                                            </span>
                                                        ) : !isMarked && (
                                                            <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md bg-rose-50 text-rose-600 border border-rose-100">
                                                                NOT TAKEN
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                                
                                                {isMarked && item.record && (
                                                    <button
                                                        onClick={() => setViewingRecord(item.record as AttendanceRecord)}
                                                        className="w-10 h-10 rounded-xl bg-white border border-slate-200 text-slate-400 hover:bg-slate-900 hover:text-white hover:border-slate-900 transition-all shadow-sm flex items-center justify-center shrink-0 group"
                                                    >
                                                        <i className="fa-solid fa-eye text-sm group-hover:scale-110 transition-transform"></i>
                                                    </button>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
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
