import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { AttendanceRecord, StudentRecord, SubjectConfig, TimetableEntry } from '../../../domain/entities/types';
import { SYSTEM_CLASSES } from '../../../domain/entities/constants';
import { dataService } from '../../../infrastructure/services/dataService';
import { useMobile } from '../../hooks/useMobile';
import { useTerm } from '../../viewmodels/TermContext';
import StudentAttendanceStats from './StudentAttendanceStats';
import PrincipalMonitor from './PrincipalMonitor';
import RecoveryTab from '../faculty/RecoveryTab';

interface AttendanceMonitorProps {
    students: StudentRecord[];
    subjects: SubjectConfig[];
    onEditRecord?: (record: AttendanceRecord) => void;
}

const AttendanceMonitor: React.FC<AttendanceMonitorProps> = ({ students, subjects, onEditRecord }) => {
    const { isMobile } = useMobile();
    const { activeTerm } = useTerm();
    const [records, setRecords] = useState<AttendanceRecord[]>([]);
    const [leavePermissions, setLeavePermissions] = useState<any[]>([]);
    const [timetables, setTimetables] = useState<TimetableEntry[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedClass, setSelectedClass] = useState<string>('All');
    const [selectedSubject, setSelectedSubject] = useState('All');
    const [searchTerm, setSearchTerm] = useState('');
    const [viewingRecord, setViewingRecord] = useState<AttendanceRecord | null>(null);
    const [viewMode, setViewMode] = useState<'records' | 'analytics' | 'student-stats' | 'subject-report' | 'principal-monitor' | 'recovery'>('records');
    const [selectedAnalyticsClass, setSelectedAnalyticsClass] = useState<string | null>(null);
    const [timelineDate, setTimelineDate] = useState<'today' | 'tomorrow'>('today');
    const [facultyFilter, setFacultyFilter] = useState('All');

    const [termClasses, setTermClasses] = useState<string[]>([]);
    useEffect(() => {
        dataService.getClassesByTerm(activeTerm).then(res => setTermClasses(res)).catch(() => {});
    }, [activeTerm]);

    const classes = useMemo(() => {
        const studentClasses = students.map(s => s.className).filter(Boolean);
        const subjectClasses = subjects.flatMap(s => s.targetClasses || []).filter(Boolean);
        const base = termClasses.length > 0 ? termClasses : [...SYSTEM_CLASSES, ...studentClasses, ...subjectClasses];
        return ['All', ...new Set(base)].sort();
    }, [students, subjects, termClasses]);

    const uniqueFaculty = useMemo(() => {
        return ['All', ...new Set(subjects.map(s => s.facultyName).filter(Boolean) as string[])].sort();
    }, [subjects]);

    const [reportSubjectId, setReportSubjectId] = useState<string | null>(null);
    const [reportClassName, setReportClassName] = useState<string | null>(null);
    const [isReportLoading, setIsReportLoading] = useState(false);
    const [subjectReportRecords, setSubjectReportRecords] = useState<AttendanceRecord[]>([]);

    const filteredSubjectsForReport = useMemo(() => {
        const result: Array<SubjectConfig & { reportClass: string }> = [];
        subjects.forEach(s => {
            const matchesFaculty = facultyFilter === 'All' || !facultyFilter || s.facultyName === facultyFilter;
            const matchesSearch = !searchTerm || s.name.toLowerCase().includes(searchTerm.toLowerCase());
            
            if (matchesFaculty && matchesSearch) {
                const targetClasses = s.targetClasses || [];
                if (targetClasses.length === 0) {
                    result.push({ ...s, reportClass: 'All' });
                } else {
                    targetClasses.forEach(cls => {
                        result.push({ ...s, reportClass: cls });
                    });
                }
            }
        });
        return result.sort((a, b) => a.name.localeCompare(b.name) || a.reportClass.localeCompare(b.reportClass));
    }, [subjects, facultyFilter, searchTerm]);

    const loadSubjectReport = useCallback(async (subjectId: string, className: string) => {
        setIsReportLoading(true);
        setReportSubjectId(subjectId);
        setReportClassName(className);
        try {
            const data = await dataService.getAttendanceForSubject(subjectId, activeTerm, className);
            setSubjectReportRecords(data.sort((a, b) => b.date.localeCompare(a.date)));
        } catch (error) {
            console.error('Error loading subject report:', error);
        } finally {
            setIsReportLoading(false);
        }
    }, [activeTerm]);

    // Set default class on load
    useEffect(() => {
        if (selectedClass === 'All' && classes.length > 1) {
            setSelectedClass(classes[1]); // Set to first actual class (index 0 is 'All')
        }
    }, [classes]);

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
            const [data, tData, lData] = await Promise.all([
                dataService.getAllAttendanceRecords(activeTerm),
                dataService.getAllTimetables(activeTerm),
                dataService.getAllLeavePermissions(activeTerm)
            ]);
            setRecords(data);
            setTimetables(tData || []);
            setLeavePermissions(lData || []);
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
        return records
            .filter(record => {
                const matchesClass = selectedClass === 'All' || record.className === selectedClass;
                const matchesSubject = selectedSubject === 'All' || record.subjectId === selectedSubject;
                if (!matchesClass || !matchesSubject) return false;
                if (query) {
                    const subject = subjectMap[record.subjectId];
                    return (subject?.name.toLowerCase().includes(query)) || (record.className.toLowerCase().includes(query));
                }
                return true;
            })
            .sort((a, b) => {
                const dateCompare = b.date.localeCompare(a.date);
                if (dateCompare !== 0) return dateCompare;
                return (b.markedAt || 0) - (a.markedAt || 0);
            });
    }, [records, selectedClass, selectedSubject, searchTerm, subjectMap]);

    const getLocalDateString = useCallback((offsetDays: number = 0) => {
        const d = new Date();
        d.setDate(d.getDate() + offsetDays);
        return d.toISOString().split('T')[0];
    }, []);

    const todayStr = useMemo(() => getLocalDateString(0), [getLocalDateString]);
    const tomorrowStr = useMemo(() => getLocalDateString(1), [getLocalDateString]);

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
                    // 1. Try to find the exact scheduled subject record
                    const matchingRecord = dayRecords.find(r => r.subjectId === sp.subjectId && r.className === sp.className && !matchedRecordIds.has(r.id));
                    
                    if (matchingRecord) {
                        matchedRecordIds.add(matchingRecord.id);
                        results.push({ period: sp, record: matchingRecord, type: 'scheduled', sortByTime: startTime });
                    } else {
                        // 2. Check if a substitution was marked specifically replacing this subject
                        const substitutionRecord = dayRecords.find(r => r.substitutedSubjectId === sp.subjectId && r.className === sp.className && !matchedRecordIds.has(r.id));
                        
                        if (substitutionRecord) {
                            matchedRecordIds.add(substitutionRecord.id);
                            results.push({ period: sp, record: substitutionRecord, type: 'substitution', sortByTime: startTime });
                        } else {
                            // 3. Check if ANY record was marked in this time slot for this class (Takeover)
                            const takeoverRecord = dayRecords.find(r => {
                                if (matchedRecordIds.has(r.id)) return false;
                                if (r.className !== sp.className) return false;
                                const markedTime = new Date(r.markedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
                                return markedTime >= startTime && markedTime <= endTime;
                            });
                            
                            if (takeoverRecord) {
                                matchedRecordIds.add(takeoverRecord.id);
                                results.push({ period: sp, record: takeoverRecord, type: 'takeover', sortByTime: startTime });
                            } else {
                                results.push({ period: sp, record: null, type: 'scheduled', sortByTime: startTime });
                            }
                        }
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

    const activeSchedule = useMemo(() => 
        buildDailyTimetable(timelineDate === 'today' ? todayStr : tomorrowStr), 
    [buildDailyTimetable, timelineDate, todayStr, tomorrowStr]);

    const upcomingPeriods = useMemo(() => {
        if (!activeSchedule) return [];
        const now = new Date();
        const currentTime = timelineDate === 'tomorrow' ? '00:00' : now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0');
        return activeSchedule.filter(item => 
            item.type !== 'free' && 
            !item.record && 
            item.sortByTime > currentTime
        );
    }, [activeSchedule, timelineDate]);

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

            <div className="flex bg-slate-100 p-1.5 rounded-2xl w-full lg:w-fit self-center overflow-x-auto no-scrollbar scroll-smooth snap-x">
                <button
                    onClick={() => setViewMode('records')}
                    className={`px-6 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all snap-start flex-shrink-0 ${viewMode === 'records' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
                >
                    Attendance Feed
                </button>
                <button
                    onClick={() => setViewMode('analytics')}
                    className={`px-6 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all snap-start flex-shrink-0 ${viewMode === 'analytics' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
                >
                    Class Stats
                </button>
                <button
                    onClick={() => setViewMode('student-stats')}
                    className={`px-6 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all snap-start flex-shrink-0 ${viewMode === 'student-stats' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
                >
                    Individual Analytics
                </button>
                <button
                    onClick={() => setViewMode('subject-report')}
                    className={`px-6 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all snap-start flex-shrink-0 ${viewMode === 'subject-report' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
                >
                    Subject Report
                </button>
                <button
                    onClick={() => setViewMode('principal-monitor')}
                    className={`px-6 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all snap-start flex-shrink-0 ${viewMode === 'principal-monitor' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
                >
                    Principal Monitor
                </button>
                <button
                    onClick={() => setViewMode('recovery')}
                    className={`px-6 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all snap-start flex-shrink-0 ${viewMode === 'recovery' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
                >
                    Recovery & Transfer
                </button>
            </div>

            {viewMode === 'subject-report' ? (
                <div className="space-y-6 animate-in fade-in duration-500">
                    <div className="bg-white p-6 rounded-[2.5rem] border border-slate-200 flex flex-col md:flex-row gap-4 items-center shadow-sm">
                        <div className="relative flex-1 w-full">
                            <i className="fa-solid fa-search absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"></i>
                            <input
                                type="text"
                                placeholder="Search subjects..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-11 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold focus:ring-4 focus:ring-slate-900/5 outline-none transition-all"
                            />
                        </div>
                        <div className="flex gap-4 w-full md:w-auto">
                            <select
                                value={facultyFilter}
                                onChange={(e) => setFacultyFilter(e.target.value)}
                                className="flex-1 md:w-64 px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-black text-[10px] uppercase tracking-widest outline-none"
                            >
                                <option value="All">All Faculties</option>
                                {uniqueFaculty.filter(f => f !== 'All').map(f => <option key={f} value={f}>{f}</option>)}
                            </select>
                        </div>
                    </div>

                    {!reportSubjectId ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                            {filteredSubjectsForReport.map(sub => (
                                <div 
                                    key={`${sub.id}-${sub.reportClass}`} 
                                    onClick={() => loadSubjectReport(sub.id, sub.reportClass)}
                                    className="bg-white p-8 rounded-[2.5rem] border border-slate-100 hover:border-emerald-300 hover:shadow-xl hover:-translate-y-1 transition-all cursor-pointer group"
                                >
                                    <div className="flex justify-between items-start mb-6">
                                        <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400 group-hover:bg-emerald-50 group-hover:text-emerald-500 transition-colors">
                                            <i className="fa-solid fa-book-open text-xl"></i>
                                        </div>
                                        <div className="flex flex-col items-end gap-1">
                                            <span className="px-3 py-1 bg-slate-50 border border-slate-100 rounded-lg text-[9px] font-black uppercase tracking-widest text-slate-400">{sub.subjectType}</span>
                                            <span className="px-2 py-0.5 bg-emerald-50 text-emerald-600 rounded-md text-[8px] font-black uppercase tracking-wider">{sub.reportClass}</span>
                                        </div>
                                    </div>
                                    <h3 className="text-xl font-black text-slate-900 mb-1 group-hover:text-emerald-600 transition-colors">{sub.name}</h3>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4">{sub.facultyName || 'No faculty'}</p>
                                    
                                    <div className="flex items-center justify-between mt-auto pt-4 border-t border-slate-50">
                                        <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-600 rounded-full border border-emerald-100">
                                            <i className="fa-solid fa-layer-group text-[10px]"></i>
                                            <span className="text-[10px] font-black uppercase tracking-widest">{records.filter(r => r.subjectId === sub.id && r.className === sub.reportClass).length} Sessions</span>
                                        </div>
                                        <div className="flex items-center gap-2 text-emerald-600 text-[10px] font-black uppercase tracking-widest">
                                            View <i className="fa-solid fa-arrow-right ml-1 group-hover:translate-x-1 transition-transform"></i>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                            {subjectReportRecords.map((session, idx) => (
                                <div key={idx} className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
                                    <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-emerald-500 rounded-full opacity-60"></div>
                                    <div className="flex justify-between items-start mb-4">
                                        <div>
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Session #{subjectReportRecords.length - idx}</p>
                                            <h4 className="text-lg font-bold text-slate-900 leading-tight">{getDayOfWeek(session.date)}</h4>
                                            <p className="text-[10px] font-bold text-slate-500 mt-1">{new Date(session.date).toLocaleDateString()}</p>
                                        </div>
                                        <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400 group-hover:bg-emerald-50 group-hover:text-emerald-500 transition-colors">
                                            <i className="fa-solid fa-calendar-check text-xl"></i>
                                        </div>
                                    </div>
                                    
                                    <div className="grid grid-cols-3 gap-2 mt-6">
                                        <div className="bg-emerald-50/50 p-3 rounded-2xl border border-emerald-100/50">
                                            <p className="text-[9px] font-black text-emerald-600 uppercase tracking-widest mb-1">Present</p>
                                            <p className="text-xl font-black text-emerald-700">{session.presentStudentIds.length}</p>
                                        </div>
                                        <div className="bg-rose-50/50 p-3 rounded-2xl border border-rose-100/50">
                                            <p className="text-[9px] font-black text-rose-600 uppercase tracking-widest mb-1">Absent</p>
                                            <p className="text-xl font-black text-rose-700">{session.absentStudentIds.length}</p>
                                        </div>
                                        <div className="bg-amber-50/50 p-3 rounded-2xl border border-amber-100/50">
                                            <p className="text-[9px] font-black text-amber-600 uppercase tracking-widest mb-1">Recovered</p>
                                            <p className="text-xl font-black text-amber-700">{session.recoveredStudentIds?.length || 0}</p>
                                        </div>
                                    </div>

                                    <div className="flex gap-2 mt-4">
                                        <button 
                                            onClick={() => setViewingRecord(session)}
                                            className="flex-1 px-4 py-2 bg-slate-100 text-slate-900 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-200 transition-all"
                                        >
                                            View
                                        </button>
                                        {onEditRecord && (
                                            <button 
                                                onClick={() => onEditRecord(session)}
                                                className="px-4 py-2 bg-emerald-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-emerald-700 transition-all flex items-center gap-2"
                                            >
                                                <i className="fa-solid fa-pen-to-square"></i>
                                                Edit
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            ) : viewMode === 'student-stats' ? (
                <StudentAttendanceStats students={students} subjects={subjects} />
            ) : viewMode === 'analytics' ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in duration-500">
                    {analyticsData.map(({ className, present, total, subjectsList }) => {
                        const percentage = total > 0 ? (present / total) * 100 : 0;
                        const isSelected = selectedAnalyticsClass === className;
                        return (
                            <React.Fragment key={className}>
                                <div 
                                    onClick={() => setSelectedAnalyticsClass(isSelected ? null : className)}
                                    className={`cursor-pointer rounded-[2.5rem] border-2 transition-all p-8 flex flex-col justify-between ${isSelected ? 'bg-slate-900 border-slate-900 shadow-2xl col-span-full' : 'bg-white border-slate-100 hover:border-emerald-200'}`}
                                >
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <h3 className={`text-2xl font-black mb-1 ${isSelected ? 'text-white' : 'text-slate-900'}`}>{className}</h3>
                                            <p className={`text-[10px] font-bold uppercase tracking-widest ${isSelected ? 'text-slate-400' : 'text-slate-400'}`}>Cumulative Average</p>
                                        </div>
                                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl ${isSelected ? 'bg-white/10 text-emerald-400' : 'bg-slate-50 text-slate-400'}`}>
                                            <i className="fa-solid fa-chart-pie"></i>
                                        </div>
                                    </div>
                                    
                                    <div className="my-6">
                                        <h4 className={`text-5xl font-black ${isSelected ? 'text-emerald-400' : 'text-slate-900'}`}>{Math.round(percentage)}%</h4>
                                        <div className="mt-4 h-2 bg-slate-100/10 rounded-full overflow-hidden">
                                            <div className="h-full bg-emerald-500" style={{ width: `${percentage}%` }} />
                                        </div>
                                    </div>

                                    {isSelected && subjectsList.length > 0 && (
                                        <div className="mt-6 pt-6 border-t border-white/5 space-y-4 animate-in slide-in-from-top-4 duration-300">
                                            <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-4 text-center">Subject Breakdown</h5>
                                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                                {subjectsList.map(sub => {
                                                    const subPercentage = sub.total > 0 ? (sub.present / sub.total) * 100 : 0;
                                                    return (
                                                        <div key={sub.subId} className="p-4 bg-white/5 rounded-2xl border border-white/5 flex items-center justify-between">
                                                            <div className="min-w-0">
                                                                <p className="text-[10px] font-black text-white truncate">{subjectMap[sub.subId]?.name || 'Unknown'}</p>
                                                                <p className="text-[9px] font-bold text-slate-500">{sub.present}/{sub.total} sessions</p>
                                                            </div>
                                                            <span className={`text-xs font-black ${subPercentage >= 75 ? 'text-emerald-400' : subPercentage >= 60 ? 'text-amber-400' : 'text-rose-400'}`}>
                                                                {Math.round(subPercentage)}%
                                                            </span>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </React.Fragment>
                        );
                    })}
                </div>
            ) : viewMode === 'principal-monitor' ? (
                <PrincipalMonitor 
                    students={students} 
                    subjects={subjects} 
                    records={records} 
                    leavePermissions={leavePermissions}
                    onRefresh={loadRecords}
                />
            ) : viewMode === 'recovery' ? (
                <RecoveryTab />
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
                                <div className="flex gap-2 items-center">
                                    <span className="px-3 py-1 bg-slate-200/50 rounded-full text-[8px] font-black uppercase tracking-widest text-slate-500 border border-slate-200">
                                        Term: {activeTerm}
                                    </span>
                                    <div className="px-4 py-1.5 bg-white border border-slate-200 rounded-full text-[10px] font-black uppercase tracking-widest text-slate-400 shadow-sm">
                                        Last 10 Records
                                    </div>
                                </div>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <tbody className="divide-y divide-slate-50">
                                        {filteredRecords.slice(0, 10).map(record => (
                                            <tr key={record.id} className="hover:bg-slate-50 transition-all text-center">
                                                <td className="p-6 whitespace-nowrap">
                                                    <div className="text-xs font-black text-slate-400 uppercase">{new Date(record.date).toLocaleDateString([], { month: 'short', day: 'numeric'})}</div>
                                                    <div className="text-sm font-bold">{new Date(record.markedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })}</div>
                                                </td>
                                                <td className="p-6">
                                                    <span className="px-3 py-1 bg-slate-100 rounded-xl text-[10px] font-black">{record.className}</span>
                                                </td>
                                                <td className="p-6">
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
                        <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                            <div className="p-6 border-b border-slate-100 space-y-4">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <h4 className="font-black text-[11px] text-slate-900 uppercase tracking-widest flex items-center gap-2">
                                            <i className="fa-solid fa-calendar-check text-emerald-500"></i>
                                            {timelineDate === 'today' ? "Today's Table" : "Tomorrow's Table"}
                                        </h4>
                                        <p className="text-[10px] font-bold text-slate-400 mt-0.5">{timelineDate === 'today' ? todayStr : tomorrowStr}</p>
                                    </div>
                                    <div className="flex bg-slate-100 p-1 rounded-xl">
                                        <button 
                                            onClick={() => setTimelineDate('today')}
                                            className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all ${timelineDate === 'today' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400'}`}
                                        >Today</button>
                                        <button 
                                            onClick={() => setTimelineDate('tomorrow')}
                                            className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all ${timelineDate === 'tomorrow' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400'}`}
                                        >Tmr</button>
                                    </div>
                                </div>
                                <select
                                    value={selectedClass}
                                    onChange={(e) => setSelectedClass(e.target.value)}
                                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-100 rounded-xl font-black text-[10px] uppercase tracking-wider"
                                >
                                    <option value="All">All Classes</option>
                                    {classes.filter(c => c !== 'All').map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                            </div>

                            {upcomingPeriods.length > 0 && (
                                <div className="p-4 bg-blue-50/30 border-b border-slate-100">
                                    <p className="text-[9px] font-black text-blue-600 uppercase tracking-widest mb-3 flex items-center gap-2">
                                        <i className="fa-solid fa-bolt-lightning"></i>
                                        Upcoming Classes
                                    </p>
                                    <div className="space-y-2">
                                        {upcomingPeriods.slice(0, 3).map((item, i) => (
                                            <div key={i} className="flex items-center gap-3 bg-white p-3 rounded-2xl shadow-sm border border-blue-100">
                                                <div className="text-[10px] font-black text-blue-500 tabular-nums">{item.sortByTime}</div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-[11px] font-black text-slate-900 truncate">{subjectMap[item.period?.subjectId]?.name || item.period?.subjectName}</p>
                                                    <p className="text-[8px] font-bold text-slate-400 uppercase">{item.period?.className}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div className="divide-y divide-slate-100 max-h-[500px] overflow-y-auto hide-scrollbar">
                                {activeSchedule.map((item, i) => {
                                    const isMarked = !!item.record;
                                    const isTakeover = item.type === 'takeover' || item.type === 'substitution';
                                    const isFree = item.type === 'free';
                                    const nowStr = new Date().getHours().toString().padStart(2, '0') + ':' + new Date().getMinutes().toString().padStart(2, '0');
                                    const isUpcoming = timelineDate === 'tomorrow' || item.sortByTime > nowStr;
                                    const isLeave = item.period?.subjectName?.toLowerCase().includes('leave') || item.period?.leave;
                                    
                                    const subjectId = item.record?.subjectId || item.period?.subjectId;
                                    const facultyName = subjectId ? subjectMap[subjectId]?.facultyName : null;

                                    let color = 'text-slate-400 bg-slate-50 border-slate-100';
                                    let tag = facultyName || 'Free';
                                    let tagColor = 'bg-slate-100 text-slate-400';
                                    let borderL = 'border-l-transparent';
                                    let dot = 'bg-slate-200';

                                    if (isMarked) {
                                        if (isTakeover) {
                                            color = 'text-indigo-700 bg-indigo-50 border-indigo-100';
                                            tag = `TAKEOVER: ${facultyName || 'Faculty'}`;
                                            tagColor = 'bg-indigo-100 text-indigo-800';
                                            borderL = 'border-l-indigo-500';
                                            dot = 'bg-indigo-500';
                                        } else {
                                            color = 'text-emerald-700 bg-emerald-50 border-emerald-100';
                                            tag = facultyName || 'Marked';
                                            tagColor = 'bg-emerald-100 text-emerald-800';
                                            borderL = 'border-l-emerald-500';
                                            dot = 'bg-emerald-500';
                                        }
                                    } else if (isLeave) {
                                        color = 'text-amber-700 bg-amber-50 border-amber-100';
                                        tag = 'Leave';
                                        tagColor = 'bg-amber-100 text-amber-800';
                                        borderL = 'border-l-amber-500';
                                        dot = 'bg-amber-500';
                                    } else if (isUpcoming) {
                                        color = 'text-blue-700 bg-blue-50 border-blue-100';
                                        tag = facultyName || 'Upcoming';
                                        tagColor = 'bg-blue-100 text-blue-800';
                                        borderL = 'border-l-blue-500';
                                        dot = 'bg-blue-500';
                                    } else if (!isFree) {
                                        color = 'text-rose-700 bg-rose-50 border-rose-100';
                                        tag = facultyName || 'Unmarked';
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
                            <div className="text-left">
                                <h3 className="text-3xl font-black text-slate-900 tracking-tighter">{subjectMap[viewingRecord.subjectId]?.name || 'Unknown'}</h3>
                                <p className="text-slate-400 font-bold text-sm">{viewingRecord.className} • {new Date(viewingRecord.date).toLocaleDateString()}</p>
                            </div>
                            <button onClick={() => setViewingRecord(null)} className="w-12 h-12 rounded-2xl bg-white border border-slate-200 text-slate-400 hover:text-rose-500 transition-all flex items-center justify-center">
                                <i className="fa-solid fa-xmark text-xl"></i>
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-10 space-y-10 hide-scrollbar">
                            <div className="grid grid-cols-3 gap-4">
                                <div className="p-6 bg-emerald-50 rounded-[2.5rem] border border-emerald-100 text-center">
                                    <p className="text-[10px] font-black text-emerald-600 uppercase mb-2">Present</p>
                                    <h4 className="text-4xl font-black text-emerald-900">{viewingRecord.presentStudentIds.length}</h4>
                                </div>
                                <div className="p-6 bg-rose-50 rounded-[2.5rem] border border-rose-100 text-center">
                                    <p className="text-[10px] font-black text-rose-600 uppercase mb-2">Absent</p>
                                    <h4 className="text-4xl font-black text-rose-900">{viewingRecord.absentStudentIds.length}</h4>
                                </div>
                                <div className="p-6 bg-amber-50 rounded-[2.5rem] border border-amber-100 text-center">
                                    <p className="text-[10px] font-black text-amber-600 uppercase mb-2">Recovered</p>
                                    <h4 className="text-4xl font-black text-amber-900">{viewingRecord.recoveredStudentIds?.length || 0}</h4>
                                </div>
                            </div>
                            <div className="space-y-4 text-left">
                                <h5 className="text-[11px] font-black text-slate-900 uppercase tracking-widest flex items-center gap-3">
                                    <span className="w-3 h-3 rounded-full bg-rose-500"></span>
                                    Absent Students
                                </h5>
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                    {viewingRecord.absentStudentIds.length > 0 ? (
                                                        viewingRecord.absentStudentIds.map(id => {
                                                            const isAuthLeave = viewingRecord.principalApprovedAbsences?.includes(id);
                                                            const isRecovered = viewingRecord.recoveredStudentIds?.includes(id);
                                                            return (
                                                                <div key={id} className={`p-4 rounded-2xl border transition-all ${isRecovered ? 'bg-amber-50/50 border-amber-100 ring-2 ring-amber-50' : isAuthLeave ? 'bg-blue-50/50 border-blue-100 ring-2 ring-blue-50' : 'bg-slate-50 border-slate-100'}`}>
                                                                    <div className="flex items-center gap-4">
                                                                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-[10px] border shadow-sm ${isRecovered ? 'bg-amber-500 text-white border-amber-400' : isAuthLeave ? 'bg-blue-600 text-white border-blue-500' : 'bg-white text-rose-500 border-slate-200'}`}>
                                                                            {isRecovered ? <i className="fa-solid fa-arrows-rotate"></i> : isAuthLeave ? <i className="fa-solid fa-shield-check"></i> : studentMap[id]?.adNo.slice(-3)}
                                                                        </div>
                                                                        <div className="min-w-0 flex-1">
                                                                            <div className="flex items-center gap-2">
                                                                                <p className="font-black text-slate-800 text-sm truncate">{studentMap[id]?.name}</p>
                                                                                {isRecovered && (
                                                                                    <span className="text-[8px] font-black uppercase text-amber-600 tracking-widest bg-amber-100 px-1.5 py-0.5 rounded-md">Recovered</span>
                                                                                )}
                                                                                {isAuthLeave && !isRecovered && (
                                                                                    <span className="text-[8px] font-black uppercase text-blue-600 tracking-widest bg-blue-100 px-1.5 py-0.5 rounded-md">Auth</span>
                                                                                )}
                                                                            </div>
                                                                            <p className="text-[9px] font-bold text-slate-400 uppercase">{studentMap[id]?.adNo}</p>
                                                                        </div>
                                                                        {(viewingRecord.recoveredReasons?.[id] || viewingRecord.absentReasons?.[id]) && (
                                                                            <i className="fa-solid fa-comment-dots text-slate-300" title={viewingRecord.recoveredReasons?.[id] || viewingRecord.absentReasons?.[id]}></i>
                                                                        )}
                                                                    </div>
                                                                    {(viewingRecord.recoveredReasons?.[id] || viewingRecord.absentReasons?.[id]) && (
                                                                        <div className="mt-2 text-[9px] font-bold text-slate-500 italic bg-white/50 p-2 rounded-lg border border-slate-100">
                                                                            "{viewingRecord.recoveredReasons?.[id] || viewingRecord.absentReasons?.[id]}"
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            );
                                                        })
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
