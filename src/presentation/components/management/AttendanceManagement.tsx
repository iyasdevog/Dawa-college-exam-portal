import React, { useState, useEffect, useMemo, useCallback, memo } from 'react';
import { StudentRecord, SubjectConfig, AttendanceRecord, SpecialDay, TimetableEntry } from '../../../domain/entities/types';
import { SYSTEM_CLASSES } from '../../../domain/entities/constants';
import { dataService } from '../../../infrastructure/services/dataService';
import { useMobile } from '../../hooks/useMobile';
import { useTerm } from '../../viewmodels/TermContext';

interface AttendanceManagementProps {
    subjects: SubjectConfig[];
    students: StudentRecord[];
    currentUser?: any;
    onRefresh: () => void;
    presetRecord?: AttendanceRecord | null;
    onClearPreset?: () => void;
}

// Memoized student row - re-renders ONLY when this student's attendance status changes
const StudentAttendanceRow = memo(({ 
    student, 
    isPresent, 
    onToggle,
    reason,
    onReasonChange,
    isAuthorized,
    onToggleAuthorization,
    onCyclePermission,
    permissionType,
    isRecovered,
    onToggleRecovery,
    recoveredReason,
    onRecoveredReasonChange
}: { 
    student: StudentRecord, 
    isPresent: boolean, 
    onToggle: (id: string) => void,
    reason: string,
    onReasonChange: (id: string, reason: string) => void,
    isAuthorized?: boolean,
    onToggleAuthorization?: (id: string) => void,
    onCyclePermission?: (id: string) => void,
    permissionType?: 'Principal' | 'Medical' | 'Other',
    isRecovered?: boolean,
    onToggleRecovery?: (id: string) => void,
    recoveredReason?: string,
    onRecoveredReasonChange?: (id: string, reason: string) => void
}) => (
    <div className="border-b border-slate-50 last:border-0">
        <div
            onClick={() => onToggle(student.id)}
            className="flex items-center justify-between p-5 hover:bg-slate-50/50 transition-all cursor-pointer active:bg-slate-100/80 touch-pan-y"
        >
            <div className="flex-1 select-none pr-4">
                <div className="flex items-center flex-wrap gap-2">
                    <div className="font-black text-slate-800 text-lg leading-tight">{student.name}</div>
                    {permissionType === 'Principal' && (
                        <span className={`bg-emerald-600 text-white text-[7px] font-black uppercase tracking-[0.2em] px-2 py-0.5 rounded-full shadow-sm animate-in zoom-in-75 duration-300 flex items-center gap-1 ${isPresent ? 'opacity-40 grayscale-[0.5]' : ''}`}>
                            <i className="fa-solid fa-crown"></i>
                            Principal Permission
                        </span>
                    )}
                    {permissionType === 'Medical' && (
                        <span className={`bg-amber-500 text-white text-[7px] font-black uppercase tracking-[0.2em] px-2 py-0.5 rounded-full shadow-sm animate-in zoom-in-75 duration-300 flex items-center gap-1 ${isPresent ? 'opacity-40 grayscale-[0.5]' : ''}`}>
                            <i className="fa-solid fa-house-medical"></i>
                            Medical Permission
                        </span>
                    )}
                    {permissionType === 'Other' && (
                        <span className={`bg-indigo-500 text-white text-[7px] font-black uppercase tracking-[0.2em] px-2 py-0.5 rounded-full shadow-sm animate-in zoom-in-75 duration-300 flex items-center gap-1 ${isPresent ? 'opacity-40 grayscale-[0.5]' : ''}`}>
                            <i className="fa-solid fa-file-circle-check"></i>
                            Other Permission
                        </span>
                    )}
                    {(isAuthorized && !permissionType) && (
                        <span className="bg-blue-600 text-white text-[7px] font-black uppercase tracking-[0.2em] px-2 py-0.5 rounded-full shadow-sm animate-in zoom-in-75 duration-300 flex items-center gap-1">
                            <i className="fa-solid fa-shield-check"></i>
                            Authorized
                        </span>
                    )}
                </div>
                <div className="text-[10px] text-slate-400 mt-1 font-bold flex items-center gap-2">
                    <span className="bg-slate-100 text-slate-500 px-2 py-0.5 rounded-md uppercase tracking-tighter border border-slate-200/50">{student.className}</span>
                    <span className="opacity-50">#{student.adNo}</span>
                </div>
            </div>
            <div className={`w-16 h-8 rounded-full relative transition-all duration-300 shadow-inner flex-shrink-0 ${isPresent ? 'bg-emerald-500 shadow-emerald-600/20' : 'bg-slate-200 shadow-slate-300/50'}`}>
                <div className={`absolute top-1 w-6 h-6 bg-white rounded-full transition-all duration-300 shadow-xl flex items-center justify-center ${isPresent ? 'right-1' : 'left-1'}`}>
                    <i className={`fa-solid ${isPresent ? 'fa-check text-emerald-500' : 'fa-xmark text-slate-300'} text-[10px]`}></i>
                </div>
            </div>
        </div>
        {!isPresent && (
            <div className="px-5 pb-5 animate-in fade-in slide-in-from-top-3 duration-300">
                <div className="flex flex-col sm:flex-row gap-3">
                    <div className="relative flex-1 group">
                        <i className="fa-solid fa-comment-dots absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-300 text-xs group-focus-within:text-rose-400 transition-colors"></i>
                        <input
                            type="text"
                            placeholder="Reason for absence..."
                            value={reason}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) => onReasonChange(student.id, e.target.value)}
                            className="w-full text-sm pl-10 pr-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:bg-white focus:border-rose-100 focus:ring-4 focus:ring-rose-50 outline-none font-bold text-slate-600 placeholder:text-slate-300 transition-all shadow-sm"
                        />
                    </div>
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            if (onCyclePermission) onCyclePermission(student.id);
                            else onToggleAuthorization?.(student.id);
                        }}
                        className={`px-6 py-3 rounded-2xl border-2 flex items-center justify-center gap-3 transition-all active:scale-95 ${
                            isAuthorized || permissionType 
                                ? (permissionType === 'Principal' ? 'bg-emerald-600 border-emerald-600 shadow-emerald-200' : 
                                   permissionType === 'Medical' ? 'bg-amber-500 border-amber-500 shadow-amber-200' : 
                                   permissionType === 'Other' ? 'bg-indigo-600 border-indigo-600 shadow-indigo-200' : 
                                   'bg-blue-600 border-blue-600 shadow-blue-200') + ' text-white shadow-lg'
                                : 'bg-white border-slate-100 text-slate-400 hover:border-blue-200 hover:text-blue-500 hover:bg-blue-50/30'
                        }`}
                        title="Toggle/Cycle Permission"
                    >
                        <i className={`fa-solid ${isAuthorized || permissionType ? 'fa-shield-check' : 'fa-shield'} text-sm`}></i>
                        <span className="text-[10px] font-black uppercase tracking-[0.2em] whitespace-nowrap">
                            {permissionType || (isAuthorized ? 'Auth' : 'Permission')}
                        </span>
                    </button>
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            if (onToggleRecovery) onToggleRecovery(student.id);
                        }}
                        className={`px-6 py-3 rounded-2xl border-2 flex items-center justify-center gap-3 transition-all active:scale-95 ${
                            isRecovered
                                ? 'bg-amber-500 border-amber-500 text-white shadow-lg shadow-amber-200'
                                : 'bg-white border-slate-100 text-slate-400 hover:border-amber-200 hover:text-amber-600 hover:bg-amber-50/30'
                        }`}
                    >
                        <i className={`fa-solid ${isRecovered ? 'fa-arrows-rotate' : 'fa-clock-rotate-left'} text-sm`}></i>
                        <span className="text-[10px] font-black uppercase tracking-[0.2em]">
                            {isRecovered ? 'Recovered' : 'Recover'}
                        </span>
                    </button>
                </div>
                {isRecovered && (
                    <div className="mt-3 relative group">
                        <i className="fa-solid fa-tasks absolute left-3.5 top-1/2 -translate-y-1/2 text-amber-300 text-xs group-focus-within:text-amber-500 transition-colors"></i>
                        <input
                            type="text"
                            placeholder="Special task completed (Recovery reason)..."
                            value={recoveredReason || ''}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) => onRecoveredReasonChange?.(student.id, e.target.value)}
                            className="w-full text-sm pl-10 pr-4 py-3 bg-amber-50/30 border-2 border-amber-100/50 rounded-2xl focus:bg-white focus:border-amber-200 focus:ring-4 focus:ring-amber-50 outline-none font-bold text-slate-600 placeholder:text-amber-300 transition-all"
                        />
                    </div>
                )}
            </div>
        )}
    </div>
));

const AttendanceManagement: React.FC<AttendanceManagementProps> = ({ subjects, students, currentUser, onRefresh, presetRecord, onClearPreset }) => {
    const { isMobile } = useMobile();
    const { currentAcademicYear, currentSemester, activeTerm } = useTerm();
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [selectedClass, setSelectedClass] = useState('');
    const [selectedSubject, setSelectedSubject] = useState('');
    const [selectedSession, setSelectedSession] = useState('1');
    const [attendanceData, setAttendanceData] = useState<Record<string, boolean>>({});
    const [absentReasons, setAbsentReasons] = useState<Record<string, string>>({});
    const [recoveredStudentIds, setRecoveredStudentIds] = useState<Set<string>>(new Set());
    const [recoveredReasons, setRecoveredReasons] = useState<Record<string, string>>({});
    const [isSaving, setIsSaving] = useState(false);
    const [specialMode, setSpecialMode] = useState<'none' | 'day' | 'period'>('none');
    const [specialDayType, setSpecialDayType] = useState<'Leave' | 'Program'>('Leave');
    const [specialDayNote, setSpecialDayNote] = useState('');
    const [reports, setReports] = useState<Record<string, number>>({});
    const [recentRecords, setRecentRecords] = useState<AttendanceRecord[]>([]);
    const [showHistory, setShowHistory] = useState(false);
    const [historySearch, setHistorySearch] = useState('');

    const [allTimetables, setAllTimetables] = useState<TimetableEntry[]>([]);
    const [currentTime, setCurrentTime] = useState(new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' }));
    
    const [isAdditional, setIsAdditional] = useState(false);
    const [substitutedSubjectId, setSubstitutedSubjectId] = useState('');
    const [showAllSubjects, setShowAllSubjects] = useState(false);

    const [searchQuery, setSearchQuery] = useState('');

    const [termClasses, setTermClasses] = useState<string[]>([]);

    useEffect(() => {
        let isMounted = true;
        const loadClasses = async () => {
            try {
                const fetched = await dataService.getClassesByTerm(activeTerm);
                if (isMounted && fetched && fetched.length > 0) {
                    setTermClasses(fetched);
                }
            } catch (err) {
                console.error('Error fetching classes for attendance:', err);
            }
        };
        loadClasses();
        return () => { isMounted = false; };
    }, [activeTerm]);

    // Cascading Reset: When class changes, clear subject if it's no longer valid
    useEffect(() => {
        if (selectedClass && !showAllSubjects) {
            const valid = subjects.some(s => s.id === selectedSubject && (s.targetClasses || []).includes(selectedClass));
            if (!valid) setSelectedSubject('');
        }
        setSearchQuery('');
    }, [selectedClass, showAllSubjects]);
    const [authorizedAbsences, setAuthorizedAbsences] = useState<Set<string>>(new Set());
    const [leavePermissions, setLeavePermissions] = useState<Record<string, 'Principal' | 'Medical' | 'Other'>>({});
    const [showLeaveModal, setShowLeaveModal] = useState(false);
    const [leaveStudentId, setLeaveStudentId] = useState('');
    const [leaveType, setLeaveType] = useState<'Principal' | 'Medical' | 'Other'>('Principal');
    const [leaveDate, setLeaveDate] = useState(new Date().toISOString().split('T')[0]);
    const [leaveApprovedBy, setLeaveApprovedBy] = useState('');
    const [leaveNote, setLeaveNote] = useState('');

    const facultyList = useMemo(() => {
        const names = subjects.map(s => s.facultyName).filter(Boolean) as string[];
        const uniqueNames = [...new Set(names)];
        if (currentUser?.name && !uniqueNames.includes(currentUser.name)) {
            uniqueNames.push(currentUser.name);
        }
        return uniqueNames.sort();
    }, [subjects, currentUser]);

    const classes = useMemo(() => {
        const studentClasses = students.map(s => s.className).filter(Boolean);
        const subjectClasses = subjects.flatMap(s => s.targetClasses || []).filter(Boolean);
        
        const baseList = termClasses.length > 0 
            ? termClasses 
            : [...SYSTEM_CLASSES, ...studentClasses, ...subjectClasses];
        
        let list = [...new Set(baseList)].filter(Boolean);
        list.sort();

        if (currentUser && (currentUser.role === 'teacher' || currentUser.role === 'faculty') && currentUser.assignedClasses && currentUser.assignedClasses.length > 0) {
            list = list.filter(c => currentUser.assignedClasses.includes(c));
        }

        return list;
    }, [students, subjects, termClasses, currentUser, activeTerm]);

    const filteredSubjects = useMemo(() => {
        if (showAllSubjects) return subjects;
        return subjects.filter(s => (s.targetClasses || []).includes(selectedClass));
    }, [subjects, selectedClass, showAllSubjects]);
    
    const subjectsMap = useMemo(() => {
        const map = new Map<string, SubjectConfig>();
        subjects.forEach(s => map.set(s.id, s));
        return map;
    }, [subjects]);

    const filteredStudents = useMemo(() => {
        const subject = subjectsMap.get(selectedSubject);
        const isSharedSubject = subject?.electiveType === 'cross-class';

        // Base list: If shared/cross-class subject, use all students in the portal (then filter by enrollment)
        // Otherwise, filter by selected class.
        let list = isSharedSubject 
            ? students.filter(s => subject?.targetClasses?.includes(s.className))
            : students.filter(s => s.className === selectedClass);
        
        // Optimize for elective subjects: strictly show only enrolled students
        if (subject && subject.subjectType === 'elective') {
            if (subject.enrolledStudents) {
                list = list.filter(s => subject.enrolledStudents.includes(s.id));
            } else if (!isSharedSubject) {
                // If elective but no enrollment defined, and not shared, 
                // we treat it as "whole class" elective (rare but possible).
            }
        }

        // Apply quick search
        if (searchQuery.trim() !== '') {
            const query = searchQuery.toLowerCase();
            list = list.filter(s => 
                s.name.toLowerCase().includes(query) || 
                (s.adNo && s.adNo.toLowerCase().includes(query))
            );
        }

        return list;
    }, [students, selectedClass, selectedSubject, subjectsMap, searchQuery]);

    useEffect(() => {
        const loadAllTimetables = async () => {
            const data = await dataService.getAllTimetables(activeTerm);
            setAllTimetables(data);
        };
        loadAllTimetables();

        const timer = setInterval(() => {
            setCurrentTime(new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' }));
        }, 60000);
        return () => clearInterval(timer);
    }, []);

    const dayName = useMemo(() => {
        return new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(new Date());
    }, []);

    const liveClasses = useMemo(() => {
        return allTimetables.filter(t => {
            if (t.day !== dayName) return false;
            // Ensure strictly HH:mm comparison
            const currentHM = currentTime.substring(0, 5);
            return currentHM >= t.startTime && currentHM <= t.endTime;
        });
    }, [allTimetables, currentTime, dayName]);

    const upcomingClasses = useMemo(() => {
        return allTimetables
            .filter(t => t.day === dayName && t.startTime > currentTime.substring(0, 5))
            .sort((a, b) => a.startTime.localeCompare(b.startTime))
            .slice(0, 4);
    }, [allTimetables, currentTime, dayName]);

    const loadAttendance = useCallback(async () => {
        if (!selectedClass || !selectedSubject || !selectedDate) return;
        try {
            console.log(`[Attendance] Fetching: Class=${selectedClass}, Sub=${selectedSubject}, Session=${selectedSession}, Date=${selectedDate}`);
            const records = await dataService.getAttendanceByClassAndDate(selectedClass, selectedDate);
            console.log(`[Attendance] Found ${records.length} records for this date/class`);
            
            const effectiveSubjectId = selectedSession === '1' ? selectedSubject : `${selectedSubject}_${selectedSession}`;
            const record = records.find(r => r.subjectId === effectiveSubjectId);
            const initialAttendance: Record<string, boolean> = {};
            const initialReasons: Record<string, string> = {};
            const authorizedSet = new Set<string>();

            if (record) {
                record.absentStudentIds.forEach(id => {
                    initialAttendance[id] = false;
                    if (record.absentReasons?.[id]) initialReasons[id] = record.absentReasons[id];
                    if (record.principalApprovedAbsences?.includes(id)) authorizedSet.add(id);
                });
                const recoveredSet = new Set(record.recoveredStudentIds || []);
                setRecoveredStudentIds(recoveredSet);
                setRecoveredReasons(record.recoveredReasons || {});
                setAuthorizedAbsences(authorizedSet);
            } else {
                console.log(`[Attendance] No record for subject: ${effectiveSubjectId}. Defaulting to all present.`);
                filteredStudents.forEach(s => initialAttendance[s.id] = true);
                setAuthorizedAbsences(new Set());
                setRecoveredStudentIds(new Set());
                setRecoveredReasons({});
            }
            const permissions = await dataService.getLeavePermissions(selectedDate, activeTerm);
            const permMap: Record<string, any> = {};
            permissions.forEach(p => {
                if (p.className === selectedClass) {
                    permMap[p.studentId] = p.type;
                }
            });
            setLeavePermissions(permMap);

            // AUTO-MARK: If record is new (no record found), mark students with permissions as absent
            if (!record) {
                Object.keys(permMap).forEach(studentId => {
                    initialAttendance[studentId] = false;
                    authorizedSet.add(studentId);
                });
            }

            setAttendanceData(initialAttendance);
            setAbsentReasons(initialReasons);
            setAuthorizedAbsences(authorizedSet);
        } catch (error) {
            console.error('[Attendance] Load failed:', error);
        }
    }, [selectedClass, selectedSubject, selectedSession, selectedDate, filteredStudents, activeTerm]);

    const loadRecentHistory = useCallback(async () => {
        try {
            const allRecords = await dataService.getAllAttendanceRecords(activeTerm);
            // Get records from last 3 days
            const threeDaysAgo = Date.now() - (3 * 24 * 60 * 60 * 1000);
            const recent = allRecords
                .filter(r => r.markedAt >= threeDaysAgo)
                .slice(0, 30);
            setRecentRecords(recent);
        } catch (error) {
            console.error('Error loading recent history:', error);
        }
    }, [activeTerm]);

    useEffect(() => {
        loadAttendance();
        loadRecentHistory();
    }, [loadAttendance, loadRecentHistory]);

    useEffect(() => {
        if (presetRecord) {
            setSelectedClass(presetRecord.className);
            setSelectedSubject(presetRecord.subjectId.split('_')[0]);
            setSelectedSession(presetRecord.subjectId.includes('_') ? presetRecord.subjectId.split('_')[1] : '1');
            setSelectedDate(presetRecord.date);
            if (onClearPreset) onClearPreset();
        }
    }, [presetRecord, onClearPreset]);

    const handleSelectRecentRecord = (record: AttendanceRecord) => {
        const actualSubjectId = record.subjectId.split('_')[0];
        const sessionNum = record.subjectId.includes('_') ? record.subjectId.split('_')[1] : '1';
        setSelectedClass(record.className);
        setSelectedSubject(actualSubjectId);
        setSelectedSession(sessionNum);
        setSelectedDate(record.date);
        setShowHistory(false);
        setHistorySearch('');
    };

    const filteredHistory = useMemo(() => {
        if (!historySearch.trim()) return recentRecords;
        const q = historySearch.toLowerCase();
        return recentRecords.filter(r => {
            const actualSubjectId = r.subjectId.split('_')[0];
            const sub = subjectsMap.get(actualSubjectId);
            return (sub?.name || '').toLowerCase().includes(q) || 
                   r.className.toLowerCase().includes(q) ||
                   r.date.includes(q);
        });
    }, [recentRecords, historySearch, subjectsMap]);

    const handleSelectLiveClass = (entry: TimetableEntry) => {
        setSelectedClass(entry.className);
        setSelectedSubject(entry.subjectId);
        setSelectedDate(new Date().toISOString().split('T')[0]);
        setSearchQuery('');
        setSpecialMode('none');
    };

    const handleToggleAttendance = useCallback((studentId: string) => {
        setAttendanceData(prev => {
            const newState = { ...prev, [studentId]: !prev[studentId] };
            // Clear reason and authorization if student becomes present
            if (newState[studentId]) {
                setAbsentReasons(r => {
                    const next = { ...r };
                    delete next[studentId];
                    return next;
                });
                setAuthorizedAbsences(prevSet => {
                    const next = new Set(prevSet);
                    next.delete(studentId);
                    return next;
                });
            }
            return newState;
        });
    }, []);

    const handleToggleAuthorization = useCallback((studentId: string) => {
        setAuthorizedAbsences(prev => {
            const next = new Set(prev);
            if (next.has(studentId)) {
                next.delete(studentId);
                // Also clear type if toggled off
                setLeavePermissions(perms => {
                    const nextP = { ...perms };
                    delete nextP[studentId];
                    return nextP;
                });
            } else {
                next.add(studentId);
            }
            return next;
        });
    }, []);

    const handleCyclePermission = useCallback((studentId: string) => {
        const types: (any)[] = [undefined, 'Principal', 'Medical', 'Other'];
        
        setLeavePermissions(prev => {
            const currentType = prev[studentId];
            const currentIndex = types.indexOf(currentType);
            const nextType = types[(currentIndex + 1) % types.length];
            
            const next = { ...prev };
            if (nextType) {
                next[studentId] = nextType;
                setAuthorizedAbsences(auth => {
                    const newSet = new Set(auth);
                    newSet.add(studentId);
                    return newSet;
                });
            } else {
                delete next[studentId];
                setAuthorizedAbsences(auth => {
                    const newSet = new Set(auth);
                    newSet.delete(studentId);
                    return newSet;
                });
            }
            return next;
        });
    }, []);


    const handleToggleRecovery = useCallback((studentId: string) => {
        setRecoveredStudentIds(prev => {
            const next = new Set(prev);
            if (next.has(studentId)) {
                next.delete(studentId);
                setRecoveredReasons(reasons => {
                    const nextR = { ...reasons };
                    delete nextR[studentId];
                    return nextR;
                });
            } else {
                next.add(studentId);
            }
            return next;
        });
    }, []);

    const handleRecoveredReasonChange = useCallback((studentId: string, reason: string) => {
        setRecoveredReasons(prev => ({ ...prev, [studentId]: reason }));
    }, []);

    const handleReasonChange = useCallback((studentId: string, reason: string) => {
        setAbsentReasons(prev => ({ ...prev, [studentId]: reason }));
    }, []);

    const handleSaveAttendance = useCallback(async () => {
        if (!selectedSubject) return;

        const effectiveSubjectId = selectedSession === '1' ? selectedSubject : `${selectedSubject}_${selectedSession}`;
        const subject = subjectsMap.get(selectedSubject);
        const isSharedSubject = subject?.electiveType === 'cross-class';

        setIsSaving(true);
        try {
            if (isSharedSubject) {
                const classGroups: Record<string, { present: string[], absent: string[], reasons: Record<string, string> }> = {};
                filteredStudents.forEach(s => {
                    if (!classGroups[s.className]) classGroups[s.className] = { present: [], absent: [], reasons: {} };
                    if (attendanceData[s.id] ?? true) {
                        classGroups[s.className].present.push(s.id);
                    } else {
                        classGroups[s.className].absent.push(s.id);
                        if (absentReasons[s.id]) {
                            classGroups[s.className].reasons[s.id] = absentReasons[s.id];
                        }
                    }
                });
                await Promise.all(Object.entries(classGroups).map(([className, data]) =>
                    dataService.markAttendance({
                        date: selectedDate,
                        subjectId: effectiveSubjectId,
                        className,
                        presentStudentIds: data.present,
                        absentStudentIds: data.absent,
                        absentReasons: data.reasons,
                        recoveredStudentIds: Array.from(recoveredStudentIds).filter(id => data.absent.includes(id)),
                        recoveredReasons: Object.fromEntries(
                            Object.entries(recoveredReasons).filter(([id]) => data.absent.includes(id))
                        ),
                        markedBy: currentUser?.name || 'System Admin',
                        markedAt: Date.now(),
                        academicYear: currentAcademicYear,
                        semester: currentSemester,
                        principalApprovedAbsences: Array.from(authorizedAbsences).filter(id => data.absent.includes(id)),
                        granularPermissions: Object.fromEntries(
                            Array.from(authorizedAbsences)
                                .filter(id => data.absent.includes(id))
                                .map(id => [id, leavePermissions[id] || 'Principal'])
                        )
                    })
                ));
            } else {
                if (!selectedClass) { alert('Please select a class.'); setIsSaving(false); return; }
                const presentIds = filteredStudents.filter(s => attendanceData[s.id] ?? true).map(s => s.id);
                const absentIds = filteredStudents.filter(s => !(attendanceData[s.id] ?? true)).map(s => s.id);
                
                const recordReasons: Record<string, string> = {};
                absentIds.forEach(id => {
                    if (absentReasons[id]) recordReasons[id] = absentReasons[id];
                });

                await dataService.markAttendance({
                    date: selectedDate,
                    subjectId: effectiveSubjectId,
                    className: selectedClass,
                    presentStudentIds: presentIds,
                    absentStudentIds: absentIds,
                    absentReasons: recordReasons,
                    recoveredStudentIds: Array.from(recoveredStudentIds).filter(id => absentIds.includes(id)),
                    recoveredReasons: Object.fromEntries(
                        Object.entries(recoveredReasons).filter(([id]) => absentIds.includes(id))
                    ),
                    principalApprovedAbsences: Array.from(authorizedAbsences),
                    granularPermissions: Object.fromEntries(
                        Array.from(authorizedAbsences).map(id => [id, leavePermissions[id] || 'Principal'])
                    ),
                    markedBy: currentUser?.name || 'System Admin',
                    markedAt: Date.now(),
                    isAdditional: isAdditional,
                    substitutedSubjectId: substitutedSubjectId || undefined,
                    academicYear: currentAcademicYear,
                    semester: currentSemester
                });
            }
            alert('Attendance saved!');
            // Reset additional class flags after save
            setIsAdditional(false);
            setSubstitutedSubjectId('');
            onRefresh();
        } catch (error) {
            console.error('Attendance save error:', error);
            alert('Failed to save attendance. Please check your connection and try again.');
        } finally {
            setIsSaving(false);
        }
    }, [selectedSubject, selectedSession, selectedClass, selectedDate, filteredStudents, attendanceData, subjects, currentUser, currentAcademicYear, currentSemester, onRefresh]);

    const handleSaveSpecialDay = async () => {
        if (!selectedDate || !specialDayNote) return;

        setIsSaving(true);
        try {
            await dataService.markSpecialDay({
                date: selectedDate,
                type: specialDayType,
                note: specialDayNote,
                className: selectedClass || undefined
            });
            alert(`${specialDayType} marked for ${selectedDate}`);
            setSpecialMode('none');
            setSpecialDayNote('');
            onRefresh();
        } catch (error) {
            alert('Failed to save special day.');
        } finally {
            setIsSaving(false);
        }
    };

    const handleSaveSpecialPeriod = useCallback(async () => {
        if (!selectedSubject || !selectedClass || !selectedDate || !specialDayNote) return;
        const effectiveSubjectId = selectedSession === '1' ? selectedSubject : `${selectedSubject}_${selectedSession}`;

        setIsSaving(true);
        try {
            await dataService.markAttendance({
                date: selectedDate,
                subjectId: effectiveSubjectId,
                className: selectedClass,
                presentStudentIds: filteredStudents.map(s => s.id),
                absentStudentIds: [],
                markedBy: currentUser?.name || 'System Admin',
                markedAt: Date.now(),
                isSpecialDay: true,
                specialDayType,
                specialDayNote,
                academicYear: currentAcademicYear,
                semester: currentSemester
            });
            alert('Special Event Period marked successfully!');
            setSpecialMode('none');
            setSpecialDayNote('');
            onRefresh();
        } catch (error) {
            console.error('Attendance save error:', error);
            alert('Failed to save special period.');
        } finally {
            setIsSaving(false);
        }
    }, [selectedSubject, selectedSession, selectedClass, selectedDate, specialDayType, specialDayNote, filteredStudents, currentUser, currentAcademicYear, currentSemester, onRefresh]);

    const handleSavePermission = async () => {
        if (!leaveStudentId || !leaveDate) return;
        setIsSaving(true);
        try {
            const student = students.find(s => s.id === leaveStudentId);
            await dataService.saveLeavePermission({
                studentId: leaveStudentId,
                studentName: student?.name || 'Unknown',
                className: student?.className || 'Unknown',
                date: leaveDate,
                type: leaveType,
                termKey: activeTerm,
                approvedBy: leaveApprovedBy || currentUser?.name || 'Principal',
                note: leaveNote
            });
            alert('Leave permission saved successfully!');
            setShowLeaveModal(false);
            setLeaveStudentId('');
            setLeaveApprovedBy('');
            setLeaveNote('');
            loadAttendance();
        } catch (error) {
            alert('Failed to save leave permission.');
        } finally {
            setIsSaving(false);
        }
    };


    return (
        <div className="space-y-6">
            {/* Live & Upcoming Classes Feed - Improved Visibility */}
            <div className="space-y-3">
                <div className="flex items-center justify-between px-2">
                    <div className="flex flex-1 items-center gap-4">
                        <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Live Today</h4>
                        <div className="relative flex-1 max-w-xs group">
                            <i className="fa-solid fa-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[10px]"></i>
                            <input 
                                type="text"
                                placeholder="Search recent records (last 3 days)..."
                                value={historySearch}
                                onChange={(e) => {
                                    setHistorySearch(e.target.value);
                                    if (!showHistory) setShowHistory(true);
                                }}
                                onFocus={() => setShowHistory(true)}
                                className="w-full text-[10px] font-bold pl-8 pr-3 py-2 bg-slate-100 border-none rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-slate-600 placeholder:text-slate-400 transition-all"
                            />
                            
                            {showHistory && historySearch.trim() && (
                                <div className="absolute top-full left-0 right-0 mt-3 bg-white rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.15)] border border-slate-100 z-50 max-h-80 overflow-y-auto no-scrollbar animate-in fade-in slide-in-from-top-4 duration-300 ring-4 ring-slate-900/5">
                                    <div className="sticky top-0 bg-slate-50 px-4 py-2 border-b border-slate-100 flex justify-between items-center">
                                        <span className="text-[8px] font-black uppercase tracking-widest text-slate-400">Search Results</span>
                                        <button onClick={() => setHistorySearch('')} className="text-slate-400 hover:text-slate-600"><i className="fa-solid fa-times text-[10px]"></i></button>
                                    </div>
                                    {filteredHistory.length === 0 ? (
                                        <div className="p-8 text-[10px] font-bold text-slate-400 text-center flex flex-col items-center gap-2">
                                            <i className="fa-solid fa-ghost text-lg text-slate-200"></i>
                                            No matching records
                                        </div>
                                    ) : (
                                        filteredHistory.map(record => {
                                            const actualSubjectId = record.subjectId.split('_')[0];
                                            const sessionText = record.subjectId.includes('_') ? ` (S${record.subjectId.split('_')[1]})` : '';
                                            const sub = subjectsMap.get(actualSubjectId);
                                            return (
                                                <button
                                                    key={record.id}
                                                    onClick={() => handleSelectRecentRecord(record)}
                                                    className="w-full text-left p-4 hover:bg-emerald-50/50 border-b border-slate-50 last:border-none transition-all group active:scale-[0.98]"
                                                >
                                                    <div className="flex justify-between items-center mb-1">
                                                        <div className="font-black text-slate-900 text-xs truncate group-hover:text-emerald-700 transition-colors">{(sub?.name || actualSubjectId) + sessionText}</div>
                                                        <div className="text-[9px] font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">{record.date}</div>
                                                    </div>
                                                    <div className="flex justify-between items-center">
                                                        <div className="text-xs font-bold text-slate-400 group-hover:text-slate-600 transition-colors">{record.className}</div>
                                                        <div className="text-[10px] font-black text-slate-300 group-hover:text-emerald-500 transition-colors uppercase tracking-tight">Load & Edit <i className="fa-solid fa-arrow-right ml-1"></i></div>
                                                    </div>
                                                </button>
                                            );
                                        })
                                    )}
                                </div>
                            )}
                        </div>
                        <button 
                            onClick={() => {
                                setShowHistory(!showHistory);
                                setHistorySearch('');
                            }}
                            className={`text-[10px] font-black uppercase tracking-[0.2em] transition-colors shrink-0 ${showHistory && !historySearch ? 'text-emerald-600 underline' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                            <i className="fa-solid fa-clock-rotate-left mr-1.5 shadow-sm"></i>
                            {showHistory && !historySearch ? 'Hide History' : 'History List'}
                        </button>
                    </div>
                    <div className="text-[10px] font-bold text-emerald-500 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-100 uppercase tracking-tighter ml-4">
                        {dayName}, {currentTime.substring(0, 5)}
                    </div>
                </div>

                {allTimetables.length === 0 ? (
                    <div className="mx-2 p-4 bg-slate-50 border border-dashed border-slate-200 rounded-2xl text-center">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">No timetables found. Generate and apply one to see live feed.</p>
                    </div>
                ) : (liveClasses.length === 0 && upcomingClasses.length === 0) ? (
                    <div className="mx-2 p-4 bg-slate-50 border border-slate-200 rounded-2xl text-center">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">No sessions scheduled for the remainder of today.</p>
                    </div>
                ) : (
                    <div className="flex gap-4 overflow-x-auto pb-4 no-scrollbar -mx-2 px-2">
                        {liveClasses.map(entry => (
                            <div
                                key={entry.id}
                                onClick={() => handleSelectLiveClass(entry)}
                                className={`flex-shrink-0 w-64 p-5 rounded-[2rem] border-2 transition-all cursor-pointer group relative overflow-hidden ${selectedClass === entry.className && selectedSubject === entry.subjectId ? 'bg-emerald-600 border-emerald-500 shadow-xl scale-[1.02]' : 'bg-white border-emerald-100 hover:border-emerald-300 shadow-sm'}`}
                            >
                                <div className="absolute top-0 right-0 p-4">
                                    <div className={`w-2 h-2 rounded-full animate-pulse ${selectedClass === entry.className && selectedSubject === entry.subjectId ? 'bg-white' : 'bg-emerald-500'}`}></div>
                                </div>
                                <div className="space-y-3 relative z-10">
                                    <div>
                                        <span className={`text-[8px] font-black uppercase tracking-widest ${selectedClass === entry.className && selectedSubject === entry.subjectId ? 'text-emerald-100' : 'text-emerald-600'}`}>Ongoing Now</span>
                                        <h5 className={`text-base font-black leading-tight ${selectedClass === entry.className && selectedSubject === entry.subjectId ? 'text-white' : 'text-slate-900 group-hover:text-emerald-700'}`}>{entry.subjectName}</h5>
                                    </div>
                                    <div className="flex items-end justify-between">
                                        <div>
                                            <div className={`text-[10px] font-bold ${selectedClass === entry.className && selectedSubject === entry.subjectId ? 'text-emerald-100' : 'text-slate-400'}`}>{entry.className}</div>
                                            <div className={`text-[10px] font-black ${selectedClass === entry.className && selectedSubject === entry.subjectId ? 'text-white' : 'text-slate-900'}`}>{entry.startTime} - {entry.endTime}</div>
                                        </div>
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${selectedClass === entry.className && selectedSubject === entry.subjectId ? 'bg-white text-emerald-600' : 'bg-emerald-50 text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white'}`}>
                                            <i className="fa-solid fa-chevron-right text-[10px]"></i>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                        {upcomingClasses.map(entry => (
                            <div
                                key={entry.id}
                                onClick={() => handleSelectLiveClass(entry)}
                                className={`flex-shrink-0 w-64 p-5 rounded-[2rem] border-2 transition-all cursor-pointer group ${selectedClass === entry.className && selectedSubject === entry.subjectId ? 'bg-slate-800 border-slate-700 shadow-xl scale-[1.02]' : 'bg-white border-slate-100 hover:border-slate-300 shadow-sm'}`}
                            >
                                <div className="space-y-3">
                                    <div>
                                        <span className={`text-[8px] font-black uppercase tracking-widest ${selectedClass === entry.className && selectedSubject === entry.subjectId ? 'text-slate-400' : 'text-slate-400'}`}>Upcoming</span>
                                        <h5 className={`text-base font-black leading-tight ${selectedClass === entry.className && selectedSubject === entry.subjectId ? 'text-white' : 'text-slate-900 group-hover:text-slate-700'}`}>{entry.subjectName}</h5>
                                    </div>
                                    <div className="flex items-end justify-between">
                                        <div>
                                            <div className={`text-[10px] font-bold ${selectedClass === entry.className && selectedSubject === entry.subjectId ? 'text-slate-500' : 'text-slate-400'}`}>{entry.className}</div>
                                            <div className={`text-[10px] font-black ${selectedClass === entry.className && selectedSubject === entry.subjectId ? 'text-white' : 'text-slate-900'}`}>{entry.startTime}</div>
                                        </div>
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${selectedClass === entry.className && selectedSubject === entry.subjectId ? 'bg-white text-slate-800' : 'bg-slate-50 text-slate-400 group-hover:bg-slate-800 group-hover:text-white'}`}>
                                            <i className="fa-solid fa-calendar-check text-[10px]"></i>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {showHistory && !historySearch.trim() && (
                    <div className="mx-2 p-6 bg-slate-800 rounded-[2.5rem] border border-slate-700 shadow-2xl animate-in zoom-in-95 duration-300">
                        <div className="flex justify-between items-center mb-6 px-2">
                            <div>
                                <h5 className="text-white text-sm font-black tracking-tight">Recent Activity</h5>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-0.5">Last 3 Days Overview</p>
                            </div>
                            <button onClick={() => setShowHistory(false)} className="text-slate-400 hover:text-white transition-colors">
                                <i className="fa-solid fa-circle-xmark text-lg"></i>
                            </button>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                            {recentRecords.map(record => {
                                const actualSubjectId = record.subjectId.split('_')[0];
                                const sessionText = record.subjectId.includes('_') ? ` (S${record.subjectId.split('_')[1]})` : '';
                                const sub = subjectsMap.get(actualSubjectId);
                                return (
                                    <div 
                                        key={record.id}
                                        onClick={() => handleSelectRecentRecord(record)}
                                        className="bg-slate-700/50 hover:bg-slate-700 border border-slate-600 p-4 rounded-2xl cursor-pointer transition-all group"
                                    >
                                        <div className="flex justify-between items-start mb-2">
                                            <div className="font-black text-white text-xs truncate max-w-[150px]">{(sub?.name || actualSubjectId) + sessionText}</div>
                                            <div className="text-[9px] font-black text-emerald-400 uppercase tracking-tighter">{record.date}</div>
                                        </div>
                                        <div className="flex justify-between items-end">
                                            <div className="text-[10px] font-bold text-slate-400">{record.className}</div>
                                            <div className="text-[9px] font-black text-slate-500 group-hover:text-white transition-colors">Edit Record <i className="fa-solid fa-arrow-right ml-1"></i></div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 bg-slate-50 p-6 rounded-2xl border border-slate-200">
                <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 px-1">Date</label>
                    <input
                        type="date"
                        value={selectedDate}
                        onChange={(e) => setSelectedDate(e.target.value)}
                        className="w-full p-3 bg-white border border-slate-200 rounded-xl focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all font-bold text-slate-700"
                    />
                </div>
                <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 px-1">Class</label>
                    <select
                        value={selectedClass}
                        onChange={(e) => setSelectedClass(e.target.value)}
                        className="w-full p-3 bg-white border border-slate-200 rounded-xl focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all font-bold text-slate-700"
                    >
                        <option value="">Select Class</option>
                        {classes.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                </div>
                {specialMode !== 'day' && (
                    <div className="relative">
                        <div className="flex justify-between items-center mb-2 px-1">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Subject</label>
                            <button 
                                onClick={() => setShowAllSubjects(!showAllSubjects)}
                                className={`text-[8px] font-black uppercase tracking-tight px-2 py-0.5 rounded-md transition-all ${showAllSubjects ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200' : 'bg-slate-200 text-slate-500 hover:bg-slate-300'}`}
                            >
                                {showAllSubjects ? 'My Classes' : 'All Subjects'}
                            </button>
                        </div>
                        <select
                            value={selectedSubject}
                            onChange={(e) => setSelectedSubject(e.target.value)}
                            disabled={!selectedClass && !showAllSubjects}
                            className="w-full p-3 bg-white border border-slate-200 rounded-xl focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all font-bold text-slate-700 disabled:bg-slate-50 disabled:text-slate-300"
                        >
                            <option value="">Select Subject</option>
                            {filteredSubjects.map(s => <option key={s.id} value={s.id}>{s.name} {showAllSubjects ? `(${(s.targetClasses || []).join(', ')})` : ''}</option>)}
                        </select>
                    </div>
                )}
                {specialMode !== 'day' && (
                    <div>
                        <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 px-1">Session</label>
                        <select
                            value={selectedSession}
                            onChange={(e) => setSelectedSession(e.target.value)}
                            disabled={!selectedClass || !selectedSubject}
                            className="w-full p-3 bg-white border border-slate-200 rounded-xl focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all font-bold text-slate-700 disabled:bg-slate-50 disabled:text-slate-300"
                        >
                            <option value="1">1st Session</option>
                            <option value="2">2nd Session</option>
                            <option value="3">3rd Session</option>
                            <option value="4">4th Session</option>
                            <option value="5">5th Session</option>
                        </select>
                    </div>
                )}
            </div>

            <div className="flex flex-wrap gap-2 px-1">
                {(!currentUser || currentUser.role === 'admin') && (
                    <button
                        onClick={() => setSpecialMode(specialMode === 'day' ? 'none' : 'day')}
                        className={`px-6 py-3 rounded-2xl font-black uppercase tracking-widest text-[10px] transition-all flex items-center gap-2 shadow-sm ${specialMode === 'day' ? 'bg-slate-800 text-white shadow-lg' : 'bg-amber-100 text-amber-700 hover:bg-amber-200 border border-amber-200/50'}`}
                    >
                        <i className={`fa-solid ${specialMode === 'day' ? 'fa-xmark' : 'fa-calendar-day'} text-xs`}></i>
                        {specialMode === 'day' ? 'Cancel' : 'Mark Special Day'}
                    </button>
                )}
                <button
                    onClick={() => setSpecialMode(specialMode === 'period' ? 'none' : 'period')}
                    className={`px-6 py-3 rounded-2xl font-black uppercase tracking-widest text-[10px] transition-all flex items-center gap-2 shadow-sm ${specialMode === 'period' ? 'bg-slate-800 text-white shadow-lg' : 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200 border border-indigo-200/50'}`}
                >
                    <i className={`fa-solid ${specialMode === 'period' ? 'fa-xmark' : 'fa-stopwatch'} text-xs`}></i>
                    {specialMode === 'period' ? 'Cancel' : 'Mark Special Period'}
                </button>
                {(!currentUser || currentUser.role === 'admin' || currentUser.role === 'principal') && (
                    <button
                        onClick={() => setShowLeaveModal(true)}
                        className="px-6 py-3 rounded-2xl font-black uppercase tracking-widest text-[10px] bg-emerald-600 text-white hover:bg-emerald-700 transition-all flex items-center gap-2 shadow-lg shadow-emerald-200 border border-emerald-500"
                    >
                        <i className="fa-solid fa-file-signature text-xs"></i>
                        Leave Permission
                    </button>
                )}
            </div>


            {/* Substitution / Additional Class Banner */}
            {selectedClass && selectedSubject && (
                <div className={`p-5 rounded-2xl border transition-all animate-in slide-in-from-left-4 ${isAdditional ? 'bg-indigo-50 border-indigo-200 shadow-md' : 'bg-slate-50 border-slate-200'}`}>
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl transition-all ${isAdditional ? 'bg-indigo-600 text-white animate-pulse' : 'bg-slate-200 text-slate-500'}`}>
                                <i className="fa-solid fa-person-chalkboard"></i>
                            </div>
                            <div>
                                <h4 className={`text-sm font-black tracking-tight ${isAdditional ? 'text-indigo-900' : 'text-slate-900'}`}>
                                    Faculty Takeover / Substitution
                                </h4>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                                    Is this an additional or substitution class?
                                </p>
                            </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-4">
                            <label className="flex items-center gap-3 cursor-pointer group">
                                <div className="relative">
                                    <input 
                                        type="checkbox" 
                                        checked={isAdditional}
                                        onChange={(e) => setIsAdditional(e.target.checked)}
                                        className="sr-only"
                                    />
                                    <div className={`w-10 h-5 rounded-full transition-colors ${isAdditional ? 'bg-indigo-500' : 'bg-slate-300'}`}></div>
                                    <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${isAdditional ? 'translate-x-5' : 'translate-x-0'}`}></div>
                                </div>
                                <span className={`text-xs font-black uppercase tracking-widest ${isAdditional ? 'text-indigo-600' : 'text-slate-400'}`}>Mark as Additional</span>
                            </label>

                            {isAdditional && (
                                <div className="animate-in fade-in zoom-in-95 duration-200">
                                    <select
                                        value={substitutedSubjectId}
                                        onChange={(e) => setSubstitutedSubjectId(e.target.value)}
                                        className="bg-white border border-indigo-200 rounded-xl px-4 py-2 text-[10px] font-black uppercase tracking-widest text-indigo-700 outline-none focus:ring-2 focus:ring-indigo-500"
                                    >
                                        <option value="">Replaces (Optional)</option>
                                        {subjects.filter(s => (s.targetClasses || []).includes(selectedClass) && s.id !== selectedSubject).map(s => (
                                            <option key={s.id} value={s.id}>{s.name}</option>
                                        ))}
                                    </select>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {specialMode !== 'none' ? (
                <div className={`${specialMode === 'day' ? 'bg-amber-50 border-amber-200' : 'bg-indigo-50 border-indigo-200'} p-6 rounded-2xl border shadow-sm animate-in fade-in slide-in-from-top-4`}>
                    <h3 className={`text-lg font-bold mb-4 ${specialMode === 'day' ? 'text-amber-900' : 'text-indigo-900'}`}>Register Special {specialMode === 'day' ? 'Day' : 'Period'}</h3>
                    <div className="space-y-4">
                        <div>
                            <label className={`block text-sm font-medium mb-1 ${specialMode === 'day' ? 'text-amber-800' : 'text-indigo-800'}`}>Event Type</label>
                            <div className="flex gap-4">
                                {['Leave', 'Program'].map(type => (
                                    <button
                                        key={type}
                                        onClick={() => setSpecialDayType(type as any)}
                                        className={`px-6 py-2 rounded-lg font-medium transition-all ${
                                            specialDayType === type 
                                                ? (specialMode === 'day' ? 'bg-amber-600 text-white' : 'bg-indigo-600 text-white') 
                                                : (specialMode === 'day' ? 'bg-white text-amber-600 border border-amber-300' : 'bg-white text-indigo-600 border border-indigo-300')
                                        }`}
                                    >
                                        {type}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div>
                            <label className={`block text-sm font-medium mb-1 ${specialMode === 'day' ? 'text-amber-800' : 'text-indigo-800'}`}>Note / Description</label>
                            <input
                                type="text"
                                value={specialDayNote}
                                onChange={(e) => setSpecialDayNote(e.target.value)}
                                placeholder="e.g., National Holiday, Sports Day, etc."
                                className={`w-full p-3 border rounded-xl focus:ring-2 ${specialMode === 'day' ? 'border-amber-300 focus:ring-amber-500' : 'border-indigo-300 focus:ring-indigo-500'}`}
                            />
                            <p className={`text-xs mt-1 ${specialMode === 'day' ? 'text-amber-700' : 'text-indigo-700'}`}>This will apply to {specialMode === 'day' ? (selectedClass || 'all classes') : (selectedClass + ' for the selected subject')} on {selectedDate}.</p>
                        </div>
                        <button
                            onClick={specialMode === 'day' ? handleSaveSpecialDay : handleSaveSpecialPeriod}
                            disabled={!specialDayNote || isSaving || (specialMode === 'period' && !selectedSubject)}
                            className={`w-full py-4 text-white font-bold rounded-xl shadow-lg transition-all ${specialMode === 'day' ? 'bg-amber-600 hover:bg-amber-700' : 'bg-indigo-600 hover:bg-indigo-700'} disabled:opacity-50`}
                        >
                            Save Special {specialMode === 'day' ? 'Day' : 'Period'}
                        </button>
                    </div>
                </div>
            ) : selectedClass && selectedSubject ? (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden relative">
                    <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-col items-start gap-3 sticky top-0 z-10">
                        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center w-full gap-3">
                            <h3 className="font-bold text-slate-900">
                                Mark Attendance: {filteredStudents.length} Students
                            </h3>
                            <div className="relative w-full sm:w-64">
                                <i className="fa-solid fa-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"></i>
                                <input 
                                    type="text" 
                                    placeholder="Search student..." 
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full text-sm pl-9 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 bg-white"
                                />
                            </div>
                        </div>
                        <div className="flex gap-2 w-full justify-between sm:justify-end bg-white sm:bg-transparent p-2 sm:p-0 rounded-lg border sm:border-none border-slate-200">
                            <button onClick={() => {
                                const allPresent = { ...attendanceData };
                                filteredStudents.forEach(s => allPresent[s.id] = true);
                                setAttendanceData(allPresent);
                            }} className="flex-1 sm:flex-none text-xs font-bold text-emerald-600 hover:bg-emerald-50 sm:hover:bg-transparent rounded px-2 py-1 transition-colors">All Present</button>
                            <span className="text-slate-300 hidden sm:inline">|</span>
                            <button onClick={() => {
                                const allAbsent = { ...attendanceData };
                                filteredStudents.forEach(s => allAbsent[s.id] = false);
                                setAttendanceData(allAbsent);
                            }} className="flex-1 sm:flex-none text-xs font-bold text-rose-600 hover:bg-rose-50 sm:hover:bg-transparent rounded px-2 py-1 transition-colors">All Absent</button>
                        </div>
                    </div>
                    <div className="divide-y divide-slate-100 max-h-[60vh] overflow-y-auto no-scrollbar">
                        {filteredStudents.map(student => (
                            <StudentAttendanceRow
                                key={student.id}
                                student={student}
                                isPresent={attendanceData[student.id] ?? true}
                                onToggle={handleToggleAttendance}
                                reason={absentReasons[student.id] || ''}
                                onReasonChange={handleReasonChange}
                                isAuthorized={authorizedAbsences.has(student.id)}
                                onToggleAuthorization={handleToggleAuthorization}
                                onCyclePermission={handleCyclePermission}
                                permissionType={leavePermissions[student.id]}
                                isRecovered={recoveredStudentIds.has(student.id)}
                                onToggleRecovery={handleToggleRecovery}
                                recoveredReason={recoveredReasons[student.id]}
                                onRecoveredReasonChange={handleRecoveredReasonChange}
                            />
                        ))}
                    </div>
                    <div className="p-6 bg-slate-50 border-t border-slate-200">
                        <button
                            onClick={handleSaveAttendance}
                            disabled={isSaving}
                            className="w-full py-4 bg-emerald-600 text-white font-bold rounded-xl shadow-lg hover:bg-emerald-700 disabled:opacity-50 transition-all"
                        >
                            {isSaving ? 'Saving...' : 'Save Attendance Records'}
                        </button>
                    </div>
                </div>
            ) : (
                <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center">
                    <i className="fa-solid fa-clipboard-user text-4xl text-slate-300 mb-4"></i>
                    <p className="text-slate-500">Please select a class and subject to mark attendance.</p>
                </div>
            )}

            {/* Leave Permission Modal */}
            {showLeaveModal && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-300">
                    <div className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-8 duration-500 border border-slate-100">
                        <div className="p-8 pb-4 flex justify-between items-center">
                            <div>
                                <h3 className="text-xl font-black text-slate-900 tracking-tight">Pre-authorize Absence</h3>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Grant Principal/Medical Permission</p>
                            </div>
                            <button onClick={() => setShowLeaveModal(false)} className="w-10 h-10 rounded-full bg-slate-50 text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all">
                                <i className="fa-solid fa-times"></i>
                            </button>
                        </div>

                        <div className="p-8 pt-4 space-y-6">
                            <div>
                                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Select Student</label>
                                <div className="relative group">
                                    <i className="fa-solid fa-search absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-emerald-500 transition-colors"></i>
                                    <select
                                        value={leaveStudentId}
                                        onChange={(e) => setLeaveStudentId(e.target.value)}
                                        className="w-full pl-11 pr-4 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none focus:border-emerald-100 focus:ring-4 focus:ring-emerald-50 font-bold text-slate-700 appearance-none transition-all shadow-sm"
                                    >
                                        <option value="">Select a student...</option>
                                        {students.sort((a,b) => a.name.localeCompare(b.name)).map(s => (
                                            <option key={s.id} value={s.id}>{s.name} ({s.className})</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Leave Date</label>
                                    <input 
                                        type="date"
                                        value={leaveDate}
                                        onChange={(e) => setLeaveDate(e.target.value)}
                                        className="w-full px-4 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none focus:border-emerald-100 focus:ring-4 focus:ring-emerald-50 font-bold text-slate-700 transition-all shadow-sm"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Permission Type</label>
                                    <select
                                        value={leaveType}
                                        onChange={(e) => setLeaveType(e.target.value as any)}
                                        className="w-full px-4 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none focus:border-emerald-100 focus:ring-4 focus:ring-emerald-50 font-bold text-slate-700 appearance-none transition-all shadow-sm"
                                    >
                                        <option value="Principal">Principal (Green)</option>
                                        <option value="Medical">Medical (Orange)</option>
                                        <option value="Other">Other (Blue/White)</option>
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Authorized By</label>
                                    <select
                                        value={leaveApprovedBy}
                                        onChange={(e) => setLeaveApprovedBy(e.target.value)}
                                        className="w-full px-4 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none focus:border-emerald-100 focus:ring-4 focus:ring-emerald-50 font-bold text-slate-700 appearance-none transition-all shadow-sm"
                                    >
                                        <option value="">Select Faculty...</option>
                                        {facultyList.map(name => (
                                            <option key={name} value={name}>{name}</option>
                                        ))}
                                        <option value="Principal">Principal</option>
                                        <option value="Office">Office</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Reason</label>
                                    <input 
                                        type="text"
                                        placeholder="Reason for leave..."
                                        value={leaveNote}
                                        onChange={(e) => setLeaveNote(e.target.value)}
                                        className="w-full px-4 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none focus:border-emerald-100 focus:ring-4 focus:ring-emerald-50 font-bold text-slate-700 transition-all shadow-sm"
                                    />
                                </div>
                            </div>

                            <div className="pt-4 flex gap-3">
                                <button
                                    onClick={() => setShowLeaveModal(false)}
                                    className="flex-1 py-4 text-slate-400 font-bold hover:text-slate-600 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSavePermission}
                                    disabled={!leaveStudentId || isSaving}
                                    className="flex-[2] py-4 bg-slate-900 text-white font-black uppercase tracking-widest rounded-2xl shadow-xl hover:bg-slate-800 disabled:opacity-50 disabled:grayscale transition-all transform active:scale-95"
                                >
                                    {isSaving ? 'Processing...' : 'Grant Permission'}
                                </button>
                            </div>
                        </div>

                        <div className="bg-slate-50/50 p-6 border-t border-slate-100">
                            <div className="flex items-start gap-4">
                                <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-500 flex items-center justify-center shrink-0">
                                    <i className="fa-solid fa-circle-info"></i>
                                </div>
                                <p className="text-[10px] font-bold text-slate-400 leading-relaxed uppercase tracking-tight">
                                    Once granted, this student will be automatically highlighted in the attendance marking sheet with the selected color code for the specified date.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AttendanceManagement;
