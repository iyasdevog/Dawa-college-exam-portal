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
            setRecords(data);
            setTimetables(tData || []);
        } catch (error) {
            console.error('Error loading records:', error);
        } finally {
            setIsLoading(false);
        }
    }, [activeTerm]);

    useEffect(() => {
        loadRecords();
    }, [loadRecords]);

    const filteredRecords = useMemo(() => {
        const query = searchTerm.toLowerCase();
        return records.filter(record => {
            const matchesClass = selectedClass === 'All' || record.className === selectedClass;
            const matchesSubject = selectedSubject === 'All' || record.subjectId === selectedSubject;
            if (!matchesClass || !matchesSubject) return false;
            if (query) {
                const subject = subjectMap[record.subjectId];
                return (subject?.name.toLowerCase().includes(query)) || (record.className.toLowerCase().includes(query));
            }
            return true;
        });
    }, [records, selectedClass, selectedSubject, searchTerm, subjectMap]);

    const getLocalDateString = useCallback((offsetDays: number = 0) => {
        const d = new Date();
        d.setDate(d.getDate() - offsetDays);
        return d.toISOString().split('T')[0];
    }, []);

    const todayStr = useMemo(() => getLocalDateString(0), [getLocalDateString]);
    const yesterdayStr = useMemo(() => getLocalDateString(1), [getLocalDateString]);

    const getDayOfWeek = (dateStr: string) => {
        const d = new Date(dateStr);
        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        return days[d.getDay()];
    };

    const buildDailyTimetable = useCallback((dateStr: string) => {
        const dayOfWeek = getDayOfWeek(dateStr);
        const dayRecords = records.filter(r => r.date === dateStr && (selectedClass === 'All' || r.className === selectedClass));
        const dayTimetables = timetables.filter(t => t.day.toLowerCase() === dayOfWeek.toLowerCase() && (selectedClass === 'All' || t.className === selectedClass));
        
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
            const scheduledPeriods = dayTimetables.filter(t => t.startTime === startTime);

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
                const manualRecord = dayRecords.find(r => {
                    if (matchedRecordIds.has(r.id)) return false;
                    const markedTime = new Date(r.markedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
                    return markedTime >= startTime && markedTime <= endTime;
                });
                if (manualRecord) {
                    matchedRecordIds.add(manualRecord.id);
                    results.push({ period: null, record: manualRecord, type: 'manual', sortByTime: startTime, startTime, endTime });
                } else {
                    results.push({ 
                        period: { subjectId: null, startTime, endTime, className: selectedClass !== 'All' ? selectedClass : '---' }, 
                        record: null, 
                        type: 'free', 
                        sortByTime: startTime 
                    });
                }
            }
        });

        return results.sort((a, b) => a.sortByTime.localeCompare(b.sortByTime));
    }, [records, timetables, selectedClass]);

    const todaySchedule = useMemo(() => buildDailyTimetable(todayStr), [buildDailyTimetable, todayStr]);

    const upcomingPeriods = useMemo(() => {
        if (!todaySchedule) return [];
        const now = new Date();
        const currentTime = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0');
        return todaySchedule.filter(item => 
            item.type !== 'free' && 
            !item.record && 
            item.sortByTime > currentTime
        );
    }, [todaySchedule]);

    const formatTime12h = (time24: string) => {
        if (!time24) return '';
        const [h, m] = time24.split(':');
        const hr = parseInt(h);
        return `${hr % 12 || 12}:${m} ${hr >= 12 ? 'PM' : 'AM'}`;
    };

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center py-24 bg-white rounded-[2rem]">
                <div className="loader-ring mb-4"></div>
                <p className="text-slate-500 font-bold">Synchronizing academic records...</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Stats Overview */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-emerald-50 p-6 rounded-[2.5rem] border border-emerald-100 shadow-sm">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-emerald-500 text-white rounded-2xl flex items-center justify-center">
                            <i className="fa-solid fa-check-double text-lg"></i>
                        </div>
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-600 mb-0.5">Total Entries</p>
                            <h3 className="text-2xl font-black text-emerald-900">{records.length}</h3>
                        </div>
                    </div>
                </div>
                <div className="bg-blue-50 p-6 rounded-[2.5rem] border border-blue-100 shadow-sm">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-blue-500 text-white rounded-2xl flex items-center justify-center">
                            <i className="fa-solid fa-users text-lg"></i>
                        </div>
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-600 mb-0.5">Classes Active</p>
                            <h3 className="text-2xl font-black text-blue-900">{classes.length - 1}</h3>
                        </div>
                    </div>
                </div>
                <div className="bg-amber-50 p-6 rounded-[2.5rem] border border-amber-100 shadow-sm">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-amber-500 text-white rounded-2xl flex items-center justify-center">
                            <i className="fa-solid fa-calendar-day text-lg"></i>
                        </div>
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-600 mb-0.5">Term</p>
                            <h3 className="text-sm font-black text-amber-900 tracking-tight">{activeTerm}</h3>
                        </div>
                    </div>
                </div>
            </div>

            <div className="flex bg-slate-100 p-1.5 rounded-2xl w-full lg:w-fit self-center overflow-x-auto no-scrollbar">
                <button
                    onClick={() => setViewMode('records')}
                    className={`px-6 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${viewMode === 'records' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
                >
                    Attendance Feed
                </button>
                <button
                    onClick={() => setViewMode('analytics')}
                    className={`px-6 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${viewMode === 'analytics' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
                >
                    Class Stats
                </button>
                <button
                    onClick={() => setViewMode('student-stats')}
                    className={`px-6 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${viewMode === 'student-stats' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
                >
                    Individual Analytics
                </button>
            </div>

            {viewMode === 'student-stats' ? (
                <StudentAttendanceStats students={students} subjects={subjects} />
            ) : viewMode === 'analytics' ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in duration-500">
                    {analyticsData.map(({ className, present, total }) => {
                        const percentage = total > 0 ? (present / total) * 100 : 0;
                        const isSelected = selectedAnalyticsClass === className;
                        return (
                            <div 
                                key={className}
                                onClick={() => setSelectedAnalyticsClass(isSelected ? null : className)}
                                className={`cursor-pointer rounded-[2.5rem] border-2 transition-all p-8 ${isSelected ? 'bg-slate-900 border-slate-900 shadow-2xl' : 'bg-white border-slate-100 hover:border-emerald-200'}`}
                            >
                                <h3 className={`text-2xl font-black mb-4 ${isSelected ? 'text-white' : 'text-slate-900'}`}>{className}</h3>
                                <h4 className={`text-4xl font-black ${isSelected ? 'text-emerald-400' : 'text-slate-900'}`}>{Math.round(percentage)}%</h4>
                                <div className="mt-4 h-2 bg-slate-100 rounded-full overflow-hidden">
                                    <div className="h-full bg-emerald-500" style={{ width: `${percentage}%` }} />
                                </div>
                            </div>
                        );
                    })}
                </div>
            ) : (
                <div className="flex flex-col lg:flex-row gap-8">
                    <div className="flex-1 space-y-6">
                        <div className="bg-white p-6 rounded-[2.5rem] border border-slate-200 flex flex-col md:flex-row gap-4 items-center">
                            <input
                                type="text"
                                placeholder="Search entries..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="flex-1 w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold"
                            />
                            <select
                                value={selectedClass}
                                onChange={(e) => setSelectedClass(e.target.value)}
                                className="w-full md:w-48 px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-black"
                            >
                                <option value="All">All Classes</option>
                                {classes.filter(c => c !== 'All').map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </div>
                        <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden">
                            <div className="p-6 border-b border-slate-50 bg-slate-50/50 flex justify-between items-center">
                                <h3 className="text-lg font-black text-slate-900">Attendance Log</h3>
                            </div>
                            <div className="overflow-x-auto text-center">
                                <table className="w-full">
                                    <tbody className="divide-y divide-slate-50 text-center">
                                        {filteredRecords.slice(0, 10).map(record => (
                                            <tr key={record.id} className="hover:bg-slate-50 transition-all text-center">
                                                <td className="p-6 whitespace-nowrap text-center">
                                                    <div className="text-xs font-black text-slate-400 uppercase">{new Date(record.date).toLocaleDateString([], { month: 'short', day: 'numeric'})}</div>
                                                    <div className="text-sm font-bold">{formatTime12h(record.time || '')}</div>
                                                </td>
                                                <td className="p-6 text-center">
                                                    <span className="px-3 py-1 bg-slate-100 rounded-xl text-[10px] font-black">{record.className}</span>
                                                </td>
                                                <td className="p-6 text-center">
                                                    <div className="font-black text-sm">{subjectMap[record.subjectId]?.name || 'Unknown'}</div>
                                                    <div className="text-[10px] font-bold text-emerald-500">{record.presentStudentIds.length} Present</div>
                                                </td>
                                                <td className="p-6">
                                                    <button onClick={() => setViewingRecord(record)} className="w-10 h-10 rounded-2xl bg-white border border-slate-200 flex items-center justify-center mx-auto">
                                                        <i className="fa-solid fa-eye"></i>
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>

                    <div className="lg:w-1/3 space-y-6">
                        {upcomingPeriods.length > 0 && (
                            <div className="bg-white rounded-[2.5rem] border border-blue-100 shadow-sm overflow-hidden ring-4 ring-blue-50/30">
                                <div className="p-6 bg-blue-50/20 border-b border-blue-50 flex justify-between items-center">
                                    <h4 className="font-black text-[10px] text-blue-900 uppercase tracking-widest">Upcoming Table</h4>
                                    <span className="px-3 py-1 bg-blue-100 text-blue-600 rounded-full text-[9px] font-black uppercase">Next Up</span>
                                </div>
                                <div className="divide-y divide-blue-50">
                                    {upcomingPeriods.map((item, i) => (
                                        <div key={i} className="p-5 flex items-center gap-4 hover:bg-blue-50/30 transition-all">
                                            <div className="w-12 h-14 bg-white border-2 border-blue-100 rounded-2xl flex flex-col items-center justify-center text-blue-900 shrink-0">
                                                <span className="text-sm font-black">{item.sortByTime.split(':')[0]}</span>
                                                <span className="text-[8px] font-black uppercase tracking-tighter">{item.sortByTime.split(':')[1]}</span>
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <h5 className="text-xs font-black truncate">{subjectMap[item.period?.subjectId]?.name || item.period?.subjectName}</h5>
                                                <p className="text-[9px] text-slate-400 font-bold uppercase">{item.period?.className}</p>
                                            </div>
                                            <span className="px-3 py-1 bg-blue-50 text-blue-500 rounded-xl text-[8px] font-black uppercase">Blue</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden">
                            <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                                <h4 className="font-black text-[11px] text-slate-900 uppercase tracking-widest">Today's Table</h4>
                                <span className="px-3 py-1 bg-slate-50 text-slate-400 rounded-full text-[9px] font-black">{todaySchedule.length} Slots</span>
                            </div>
                            <div className="divide-y divide-slate-100 max-h-[600px] overflow-y-auto hide-scrollbar">
                                {todaySchedule.map((item, i) => {
                                    const isMarked = !!item.record;
                                    const isFree = item.type === 'free';
                                    const nowStr = new Date().getHours().toString().padStart(2, '0') + ':' + new Date().getMinutes().toString().padStart(2, '0');
                                    const isUpcoming = item.sortByTime > nowStr;
                                    const isLeave = item.period?.subjectName?.toLowerCase().includes('leave') || item.period?.leave;
                                    
                                    let color = 'text-slate-400 bg-slate-50 border-slate-100';
                                    let tag = 'Free';
                                    let tagColor = 'bg-slate-100 text-slate-400';
                                    let borderL = 'border-l-transparent';
                                    let dot = 'bg-slate-200';

                                    if (isMarked) {
                                        color = 'text-emerald-700 bg-emerald-50 border-emerald-100';
                                        tag = 'Marked';
                                        tagColor = 'bg-emerald-100 text-emerald-800';
                                        borderL = 'border-l-emerald-500';
                                        dot = 'bg-emerald-500';
                                    } else if (isLeave) {
                                        color = 'text-amber-700 bg-amber-50 border-amber-100';
                                        tag = 'Leave';
                                        tagColor = 'bg-amber-100 text-amber-800';
                                        borderL = 'border-l-amber-500';
                                        dot = 'bg-amber-500';
                                    } else if (isUpcoming) {
                                        color = 'text-blue-700 bg-blue-50 border-blue-100';
                                        tag = 'Upcoming';
                                        tagColor = 'bg-blue-100 text-blue-800';
                                        borderL = 'border-l-blue-500';
                                        dot = 'bg-blue-500';
                                    } else if (!isFree) {
                                        color = 'text-rose-700 bg-rose-50 border-rose-100';
                                        tag = 'Unmarked';
                                        tagColor = 'bg-rose-100 text-rose-800';
                                        borderL = 'border-l-rose-500';
                                        dot = 'bg-rose-500';
                                    }

                                    return (
                                        <div key={i} className={`p-5 flex items-center gap-4 border-l-4 transition-all ${borderL}`}>
                                            <div className={`w-20 px-2 py-2 rounded-2xl border font-black text-[9px] text-center tabular-nums ${color}`}>
                                                {formatTime12h(item.sortByTime)}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <div className={`w-2 h-2 rounded-full ${dot} ${isUpcoming && !isMarked ? 'animate-pulse' : ''}`}></div>
                                                    <h5 className={`text-xs font-black truncate ${isFree ? 'text-slate-300 italic' : 'text-slate-900'}`}>{item.record?.subjectId ? subjectMap[item.record.subjectId]?.name : (item.period?.subjectId ? subjectMap[item.period.subjectId]?.name : (item.period?.subjectName || (isFree ? 'FREE PERIOD' : '---')))}</h5>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[9px] font-black text-slate-400 bg-slate-50 px-2 py-0.5 rounded-lg border border-slate-100">{item.period?.className || '---'}</span>
                                                    <span className={`text-[8px] font-black uppercase px-2 py-1 rounded-lg ${tagColor}`}>{tag}</span>
                                                </div>
                                            </div>
                                            {isMarked && (
                                                <button onClick={() => setViewingRecord(item.record)} className="w-8 h-8 rounded-xl bg-white border border-slate-200 text-slate-400 flex items-center justify-center shrink-0">
                                                    <i className="fa-solid fa-eye text-xs"></i>
                                                </button>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {viewingRecord && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300">
                    <div className="bg-white rounded-[3rem] w-full max-w-2xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col">
                        <div className="p-8 border-b border-slate-100 flex justify-between items-start bg-slate-50/50">
                            <div>
                                <h3 className="text-3xl font-black text-slate-900 tracking-tighter">{subjectMap[viewingRecord.subjectId]?.name || 'Unknown'}</h3>
                                <p className="text-slate-400 font-bold text-sm">{viewingRecord.className} • {new Date(viewingRecord.date).toLocaleDateString()}</p>
                            </div>
                            <button onClick={() => setViewingRecord(null)} className="w-12 h-12 rounded-2xl bg-white border border-slate-200 text-slate-400 hover:text-rose-500 transition-all flex items-center justify-center">
                                <i className="fa-solid fa-xmark text-xl"></i>
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-10 space-y-10 hide-scrollbar">
                            <div className="grid grid-cols-2 gap-6">
                                <div className="p-8 bg-emerald-50 rounded-[2.5rem] border border-emerald-100 text-center">
                                    <p className="text-[10px] font-black text-emerald-600 uppercase mb-2">Present</p>
                                    <h4 className="text-5xl font-black text-emerald-900">{viewingRecord.presentStudentIds.length}</h4>
                                </div>
                                <div className="p-8 bg-rose-50 rounded-[2.5rem] border border-rose-100 text-center">
                                    <p className="text-[10px] font-black text-rose-600 uppercase mb-2">Absent</p>
                                    <h4 className="text-5xl font-black text-rose-900">{viewingRecord.absentStudentIds.length}</h4>
                                </div>
                            </div>
                            <div className="space-y-4">
                                <h5 className="text-[11px] font-black text-slate-900 uppercase tracking-widest flex items-center gap-3">
                                    <span className="w-3 h-3 rounded-full bg-rose-500"></span>
                                    Absent Students
                                </h5>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-left">
                                    {viewingRecord.absentStudentIds.length > 0 ? (
                                        viewingRecord.absentStudentIds.map(id => (
                                            <div key={id} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center gap-4">
                                                <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-rose-500 font-black text-[10px] border border-slate-200">{studentMap[id]?.adNo.slice(-3)}</div>
                                                <div className="min-w-0">
                                                    <p className="font-black text-slate-800 text-sm truncate">{studentMap[id]?.name}</p>
                                                    <p className="text-[9px] font-bold text-slate-400 uppercase">{studentMap[id]?.adNo}</p>
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        <p className="text-center col-span-full py-8 text-emerald-600 font-bold">No absentees!</p>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AttendanceMonitor;
