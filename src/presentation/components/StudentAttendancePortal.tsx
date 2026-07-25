import React, { useState, useEffect, useMemo } from 'react';
import { dataService } from '../../infrastructure/services/dataService';
import { StudentRecord, SubjectConfig, LeavePermission } from '../../domain/entities/types';
import { MobileFacultyEntrySkeleton } from './SkeletonLoaders';
import { useTerm } from '../viewmodels/TermContext';
import { TermSelector } from './TermSelector';
import PublicAttendance from './PublicAttendance';

interface AbsentLogItem {
    date: string;
    subjectName: string;
    facultyName?: string;
    className: string;
    reason?: string;
    isRecovered?: boolean;
    recoveredReason?: string;
    isLeaveApproved?: boolean;
    leaveType?: 'Principal' | 'Medical' | 'Other';
    leaveNote?: string;
    isAdditional?: boolean;
}

const StudentAttendancePortal: React.FC = () => {
    const { activeTerm } = useTerm();
    const [selectedTermKey, setSelectedTermKey] = useState(activeTerm);
    const [adNo, setAdNo] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [student, setStudent] = useState<StudentRecord | null>(null);
    const [attendanceSubTab, setAttendanceSubTab] = useState<'live' | 'profile'>('live');
    const [viewMode, setViewMode] = useState<'by-subject' | 'timeline'>('by-subject');

    const [attendanceData, setAttendanceData] = useState<Array<{ 
        subject: SubjectConfig; 
        percentage: number; 
        present: number; 
        recovered: number;
        total: number;
        absentRecords: AbsentLogItem[];
    }>>([]);

    const [leavePermissions, setLeavePermissions] = useState<LeavePermission[]>([]);
    const [expandedSubjectId, setExpandedSubjectId] = useState<string | null>(null);
    const [error, setError] = useState('');
    const [eligibilityThreshold, setEligibilityThreshold] = useState(75);

    useEffect(() => {
        setSelectedTermKey(activeTerm);
    }, [activeTerm]);

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!adNo.trim()) return;

        setIsLoading(true);
        setError('');
        setStudent(null);
        setAttendanceData([]);
        setLeavePermissions([]);

        try {
            const [foundStudent, settings] = await Promise.all([
                dataService.getStudentByAdNo(adNo.trim(), selectedTermKey),
                dataService.getGlobalSettings()
            ]);
            
            if (settings) {
                setEligibilityThreshold(settings.minAttendancePercentage || 75);
            }

            if (!foundStudent) {
                setError(`No student found with admission number "${adNo.trim()}" in ${selectedTermKey}.`);
                return;
            }

            setStudent(foundStudent);

            // Resolve all alias forms of student's class name (e.g., HS1 <-> Prep)
            const rawClass = foundStudent.className;
            const dbClass = (dataService as any).getDatabaseClassName ? (dataService as any).getDatabaseClassName(selectedTermKey, rawClass) : rawClass;
            const histClass = (dataService as any).getHistoricalClassName ? (dataService as any).getHistoricalClassName(selectedTermKey, rawClass) : rawClass;
            const classAliases = Array.from(new Set([rawClass, dbClass, histClass].filter(Boolean)));

            // Fetch subjects and leave permissions & attendance in parallel
            const [primaryClassSubjects, dbClassSubjects, histClassSubjects, allTermSubjects, studentPermissions, allTermAttendance] = await Promise.all([
                dataService.getSubjectsByClass(rawClass, selectedTermKey),
                dbClass !== rawClass ? dataService.getSubjectsByClass(dbClass, selectedTermKey) : Promise.resolve([]),
                histClass !== rawClass && histClass !== dbClass ? dataService.getSubjectsByClass(histClass, selectedTermKey) : Promise.resolve([]),
                dataService.getAllSubjects(selectedTermKey),
                dataService.getAllLeavePermissions(selectedTermKey),
                dataService.getAllAttendanceRecords(selectedTermKey)
            ]);

            const userLeaves = studentPermissions.filter(lp => lp.studentId === foundStudent.id);
            setLeavePermissions(userLeaves);

            // Find subjects where attendance records exist for this student
            const studentAttendanceSubjectIds = new Set<string>();
            allTermAttendance.forEach(r => {
                if (r.presentStudentIds?.includes(foundStudent.id) || r.absentStudentIds?.includes(foundStudent.id)) {
                    const baseId = r.subjectId.includes('_') ? r.subjectId.split('_')[0] : r.subjectId;
                    studentAttendanceSubjectIds.add(baseId);
                    studentAttendanceSubjectIds.add(r.subjectId);
                }
            });

            // Combine all candidate subjects
            const subjectMap = new Map<string, SubjectConfig>();
            [...primaryClassSubjects, ...dbClassSubjects, ...histClassSubjects].forEach(s => subjectMap.set(s.id, s));

            allTermSubjects.forEach(s => {
                const targets = s.targetClasses || [];
                const isTargeted = targets.some(tc => 
                    classAliases.includes(tc) || 
                    classAliases.includes((dataService as any).getDatabaseClassName?.(selectedTermKey, tc)) || 
                    classAliases.includes((dataService as any).getHistoricalClassName?.(selectedTermKey, tc))
                );
                const hasAttendance = studentAttendanceSubjectIds.has(s.id);

                if (isTargeted || hasAttendance) {
                    subjectMap.set(s.id, s);
                }
            });

            const candidateSubjects = Array.from(subjectMap.values());

            // Filter subjects: Include core subjects, subjects with existing attendance records, and electives student is enrolled in
            const studentSubjects = candidateSubjects.filter(sub => {
                if (studentAttendanceSubjectIds.has(sub.id)) return true;
                const isElective = sub.subjectType === 'elective';
                if (!isElective) return true;
                if (!sub.enrolledStudents || sub.enrolledStudents.length === 0) return true;
                return sub.enrolledStudents.includes(foundStudent.id);
            });

            // Calculate attendance stats per subject
            const stats = await Promise.all(studentSubjects.map(async (subject) => {
                const records = await dataService.getAttendanceForStudent(foundStudent.id, subject.id, selectedTermKey);
                const total = records.length;
                const present = records.filter(r => r.presentStudentIds.includes(foundStudent.id)).length;
                const recovered = records.filter(r => r.absentStudentIds.includes(foundStudent.id) && r.recoveredStudentIds?.includes(foundStudent.id)).length;
                const percentage = total > 0 ? ((present + recovered) / total) * 100 : 100;

                const absentRecords: AbsentLogItem[] = records
                    .filter(r => r.absentStudentIds.includes(foundStudent.id))
                    .map(r => {
                        const datePerm = userLeaves.find(lp => lp.date === r.date);
                        const isPrincipalApproved = r.principalApprovedAbsences?.includes(foundStudent.id) || Boolean(datePerm);
                        const leaveType = (r.granularPermissions?.[foundStudent.id] || datePerm?.type || (isPrincipalApproved ? 'Principal' : undefined)) as any;

                        return {
                            date: r.date,
                            subjectName: subject.name,
                            facultyName: subject.facultyName,
                            className: r.className,
                            reason: r.absentReasons?.[foundStudent.id],
                            isRecovered: r.recoveredStudentIds?.includes(foundStudent.id),
                            recoveredReason: r.recoveredReasons?.[foundStudent.id],
                            isLeaveApproved: isPrincipalApproved,
                            leaveType: leaveType,
                            leaveNote: datePerm?.note,
                            isAdditional: r.isAdditional
                        };
                    })
                    .sort((a, b) => b.date.localeCompare(a.date));

                return {
                    subject,
                    percentage,
                    present,
                    recovered,
                    total,
                    absentRecords
                };
            }));

            setAttendanceData(stats);
        } catch (err) {
            console.error(err);
            setError('An error occurred while fetching attendance data.');
        } finally {
            setIsLoading(false);
        }
    };

    // Overall Aggregate Calculations
    const overallStats = useMemo(() => {
        if (!attendanceData || attendanceData.length === 0) return null;
        let totalSessions = 0;
        let totalPresent = 0;
        let totalRecovered = 0;
        let totalApprovedLeave = 0;

        attendanceData.forEach(item => {
            totalSessions += item.total;
            totalPresent += item.present;
            totalRecovered += item.recovered;
            item.absentRecords.forEach(ar => {
                if (ar.isLeaveApproved) totalApprovedLeave++;
            });
        });

        const overallPct = totalSessions > 0 ? Math.round(((totalPresent + totalRecovered) / totalSessions) * 100) : 100;
        const isEligible = overallPct >= eligibilityThreshold;

        return {
            totalSessions,
            totalPresent,
            totalRecovered,
            totalApprovedLeave,
            overallPct,
            isEligible
        };
    }, [attendanceData]);

    // Master Chronological Timeline of all missed sessions
    const masterAbsentTimeline = useMemo(() => {
        const list: AbsentLogItem[] = [];
        attendanceData.forEach(stat => {
            stat.absentRecords.forEach(ar => list.push(ar));
        });
        return list.sort((a, b) => b.date.localeCompare(a.date));
    }, [attendanceData]);

    const getDayOfWeek = (dateStr: string) => {
        const d = new Date(dateStr);
        return new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(d);
    };

    const formatDate = (dateStr: string) => {
        const d = new Date(dateStr);
        return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(d);
    };

    return (
        <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-8 pb-20">
            {/* Header & Term Selector */}
            <div className="text-center space-y-4 mb-4">
                <div className="animate-in fade-in slide-in-from-top-4 duration-500">
                    <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tighter uppercase">Attendance Hub</h1>
                    <p className="text-xs text-slate-500 font-medium italic">Track live timetable marking, weekly records (Sat - Sat) and official transcripts</p>
                </div>
                
                <div className="inline-flex items-center gap-2 bg-white/60 backdrop-blur-sm p-1.5 rounded-2xl border border-slate-200 shadow-sm">
                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 ml-2">Academic Term</span>
                    <TermSelector 
                        variant="light" 
                        className="!bg-white border-slate-100 shadow-none h-8 py-0 scale-90" 
                        value={selectedTermKey}
                        onChange={(val) => setSelectedTermKey(val)}
                    />
                </div>
            </div>

            {/* Attendance Sub-navigation Tabs: Live Table (Sat - Sat) vs My Profile */}
            <div className="flex justify-center bg-white p-1.5 rounded-3xl border border-slate-200 shadow-sm max-w-md mx-auto">
                <button
                    onClick={() => setAttendanceSubTab('live')}
                    className={`flex-1 py-3 px-4 rounded-2xl text-xs font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${
                        attendanceSubTab === 'live' ? 'bg-emerald-600 text-white shadow-md shadow-emerald-500/20' : 'text-slate-500 hover:text-slate-900'
                    }`}
                >
                    <i className="fa-solid fa-calendar-check"></i> Live Table (Sat - Sat)
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                </button>
                <button
                    onClick={() => setAttendanceSubTab('profile')}
                    className={`flex-1 py-3 px-4 rounded-2xl text-xs font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${
                        attendanceSubTab === 'profile' ? 'bg-emerald-600 text-white shadow-md shadow-emerald-500/20' : 'text-slate-500 hover:text-slate-900'
                    }`}
                >
                    <i className="fa-solid fa-user-graduate"></i> My Profile
                </button>
            </div>

            {/* TAB 1: Live Today & Weekly Records (Sat to Sat) */}
            {attendanceSubTab === 'live' && (
                <div className="animate-in fade-in duration-300">
                    <PublicAttendance />
                </div>
            )}

            {/* TAB 2: Student Individual Profile Search & Transcript */}
            {attendanceSubTab === 'profile' && (
                <div className="space-y-8 animate-in fade-in duration-300">
                    {/* Admission Number Search Card */}
                    <div className="bg-white p-6 md:p-8 rounded-3xl border border-slate-200 shadow-xl max-w-md mx-auto">
                        <form onSubmit={handleSearch} className="space-y-4">
                            <div>
                                <label className="block text-xs font-black text-slate-600 uppercase tracking-widest mb-2">Admission Number</label>
                                <div className="relative">
                                    <input
                                        type="text"
                                        value={adNo}
                                        onChange={(e) => setAdNo(e.target.value)}
                                        placeholder="Enter Ad No (e.g. 138)..."
                                        className="w-full pl-10 pr-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all font-bold text-base text-slate-800"
                                    />
                                    <i className="fa-solid fa-hashtag absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-sm"></i>
                                </div>
                            </div>
                            <button
                                type="submit"
                                disabled={isLoading || !adNo.trim()}
                                className="w-full py-3.5 bg-emerald-600 text-white font-black text-xs uppercase tracking-widest rounded-2xl shadow-lg shadow-emerald-200 hover:bg-emerald-700 disabled:opacity-50 transition-all flex items-center justify-center gap-3 active:scale-95"
                            >
                                {isLoading ? <i className="fa-solid fa-circle-notch fa-spin"></i> : <i className="fa-solid fa-search"></i>}
                                Fetch Attendance Profile
                            </button>
                        </form>
                        {error && <p className="text-rose-600 text-sm font-bold mt-4 text-center bg-rose-50 p-3 rounded-xl border border-rose-100">{error}</p>}
                    </div>

                    {isLoading && <MobileFacultyEntrySkeleton studentCount={3} />}

                    {student && overallStats && (
                        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-6 duration-700">
                            {/* Student Hero Card */}
                            <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-950 text-white p-7 md:p-8 rounded-[2.5rem] shadow-2xl relative overflow-hidden border border-slate-800">
                                <div className="relative z-10 space-y-6">
                                    <div className="flex justify-between items-start flex-wrap gap-4">
                                        <div>
                                            <span className="px-3 py-1 bg-emerald-500/20 text-emerald-300 rounded-full text-[9px] font-black uppercase tracking-widest border border-emerald-500/30">Official Transcript</span>
                                            <h2 className="text-2xl md:text-4xl font-black mt-2 text-white leading-none">{student.name}</h2>
                                            <div className="flex items-center gap-3 mt-3 flex-wrap text-xs text-slate-300 font-bold">
                                                <span className="bg-white/10 px-3 py-1 rounded-lg border border-white/10">Class {student.className}</span>
                                                <span className="text-emerald-400">Adm #{student.adNo}</span>
                                                <span className="text-slate-400">Term: {selectedTermKey}</span>
                                            </div>
                                        </div>

                                        {/* Eligibility Badge */}
                                        <div className="text-right">
                                            <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Exam Eligibility</div>
                                            <div className={`px-4 py-2 rounded-2xl text-xs font-black uppercase tracking-widest inline-flex items-center gap-2 border shadow-lg ${
                                                overallStats.isEligible 
                                                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-emerald-500/10' 
                                                    : 'bg-rose-500/20 text-rose-300 border-rose-500/40 shadow-rose-500/10'
                                            }`}>
                                                <i className={`fa-solid ${overallStats.isEligible ? 'fa-shield-check' : 'fa-triangle-exclamation'}`}></i>
                                                {overallStats.isEligible ? `Eligible (≥ ${eligibilityThreshold}%)` : 'Shortage Warning'}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Aggregated Attendance Metrics Bar */}
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-white/10">
                                        <div className="bg-white/5 p-4 rounded-2xl border border-white/5 text-center">
                                            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Overall Attendance</p>
                                            <p className={`text-3xl font-black mt-1 ${overallStats.overallPct < 75 ? 'text-rose-400' : 'text-emerald-400'}`}>{overallStats.overallPct}%</p>
                                        </div>
                                        <div className="bg-white/5 p-4 rounded-2xl border border-white/5 text-center">
                                            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Attended / Total</p>
                                            <p className="text-2xl font-black mt-1 text-white">{overallStats.totalPresent + overallStats.totalRecovered} <span className="text-xs text-slate-400">/ {overallStats.totalSessions}</span></p>
                                        </div>
                                        <div className="bg-white/5 p-4 rounded-2xl border border-white/5 text-center">
                                            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Recovered Absences</p>
                                            <p className="text-2xl font-black mt-1 text-amber-400">+{overallStats.totalRecovered}</p>
                                        </div>
                                        <div className="bg-white/5 p-4 rounded-2xl border border-white/5 text-center">
                                            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Leave Approved</p>
                                            <p className="text-2xl font-black mt-1 text-indigo-400">{overallStats.totalApprovedLeave}</p>
                                        </div>
                                    </div>
                                </div>
                                <i className="fa-solid fa-user-graduate absolute -right-6 -bottom-6 text-9xl text-white/5 rotate-12 pointer-events-none"></i>
                            </div>

                            {/* View Switcher Controls (By Subject vs Complete Timeline) */}
                            <div className="flex justify-center bg-white p-1.5 rounded-2xl border border-slate-200 shadow-sm max-w-sm mx-auto">
                                <button
                                    onClick={() => setViewMode('by-subject')}
                                    className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${
                                        viewMode === 'by-subject' ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-500 hover:text-slate-900'
                                    }`}
                                >
                                    <i className="fa-solid fa-book-open"></i> Course Cards
                                </button>
                                <button
                                    onClick={() => setViewMode('timeline')}
                                    className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${
                                        viewMode === 'timeline' ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-500 hover:text-slate-900'
                                    }`}
                                >
                                    <i className="fa-solid fa-clock-rotate-left"></i> Missed Timeline ({masterAbsentTimeline.length})
                                </button>
                            </div>

                            {/* VIEW 1: By Subject Cards */}
                            {viewMode === 'by-subject' && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {attendanceData.map((stat, idx) => (
                                        <div key={idx} className={`bg-white rounded-[2rem] border transition-all duration-300 overflow-hidden ${expandedSubjectId === stat.subject.id ? 'border-emerald-500 shadow-xl shadow-emerald-500/10 ring-1 ring-emerald-500/20 scale-[1.01]' : 'border-slate-100 shadow-sm hover:border-slate-300'}`}>
                                            <div className="p-6 pt-7 cursor-pointer active:scale-[0.98] transition-transform" onClick={() => setExpandedSubjectId(expandedSubjectId === stat.subject.id ? null : stat.subject.id)}>
                                                <div className="flex justify-between items-start mb-5">
                                                    <div className="min-w-0 pr-4">
                                                        <h3 className={`text-lg font-bold leading-tight transition-colors ${expandedSubjectId === stat.subject.id ? 'text-emerald-600' : 'text-slate-900'}`}>{stat.subject.name}</h3>
                                                        <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.1em] mt-1 truncate">{stat.subject.facultyName || 'Faculty Assigned'}</p>
                                                    </div>
                                                    <div className={`shrink-0 h-14 w-14 rounded-2xl flex flex-col items-center justify-center font-black ${stat.percentage < 75 ? 'bg-rose-50 text-rose-600 border border-rose-100' : 'bg-emerald-50 text-emerald-600 border border-emerald-100'}`}>
                                                        <span className="text-lg leading-none">{Math.round(stat.percentage)}</span>
                                                        <span className="text-[9px] opacity-60 font-bold uppercase tracking-tighter">%</span>
                                                    </div>
                                                </div>

                                                <div className="space-y-4">
                                                    <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden border border-slate-100 flex">
                                                        <div
                                                            className={`h-full transition-all duration-1000 ${stat.percentage < 75 ? 'bg-rose-500' : 'bg-emerald-500'}`}
                                                            style={{ width: `${stat.total > 0 ? (stat.present / stat.total) * 100 : 100}%` }}
                                                        ></div>
                                                        {stat.recovered > 0 && (
                                                            <div
                                                                className="h-full bg-amber-500 transition-all duration-1000 border-l border-white"
                                                                style={{ width: `${(stat.recovered / stat.total) * 100}%` }}
                                                            ></div>
                                                        )}
                                                    </div>
                                                    <div className="flex justify-between items-center bg-slate-50/50 p-2.5 rounded-xl border border-slate-100/50">
                                                        <span className="text-[10px] font-black text-slate-400 uppercase ml-2 tracking-widest">Attendance Log</span>
                                                        <span className="text-sm font-black text-slate-900 mr-2">
                                                            {stat.present}
                                                            {stat.recovered > 0 && <span className="text-amber-600 font-bold text-xs"> + {stat.recovered} rec</span>}
                                                            <span className="text-slate-300 mx-1.5">/</span>
                                                            {stat.total}
                                                        </span>
                                                    </div>
                                                    {stat.percentage < 75 && (
                                                        <div className="flex items-center gap-2 text-rose-600 bg-rose-50/80 backdrop-blur-sm p-3 rounded-xl border border-rose-100">
                                                            <i className="fa-solid fa-triangle-exclamation animate-pulse"></i>
                                                            <span className="text-[10px] font-black uppercase tracking-tighter">Attendance Warning: Low Eligibility</span>
                                                        </div>
                                                    )}
                                                    <div className="flex justify-center pt-1">
                                                        <div className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-[0.2em] transition-all flex items-center gap-2 ${expandedSubjectId === stat.subject.id ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                                                            {expandedSubjectId === stat.subject.id ? 'Close Log' : `View Absences (${stat.absentRecords.length})`}
                                                            <i className={`fa-solid ${expandedSubjectId === stat.subject.id ? 'fa-chevron-up' : 'fa-chevron-down'}`}></i>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Expanded Absences Log */}
                                            {expandedSubjectId === stat.subject.id && (
                                                <div className="bg-slate-50 border-t border-slate-100 p-6 animate-in slide-in-from-top-4 duration-500">
                                                    <div className="flex items-center gap-3 mb-6">
                                                        <div className="h-px flex-1 bg-slate-200"></div>
                                                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] whitespace-nowrap">Missed Sessions Log</h4>
                                                        <div className="h-px flex-1 bg-slate-200"></div>
                                                    </div>
                                                    
                                                    {stat.absentRecords.length > 0 ? (
                                                        <div className="space-y-4">
                                                            {stat.absentRecords.map((absent, i) => (
                                                                <AbsentLogCard key={i} absent={absent} getDayOfWeek={getDayOfWeek} formatDate={formatDate} />
                                                            ))}
                                                        </div>
                                                    ) : (
                                                        <div className="text-center py-6">
                                                            <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-3">
                                                                <i className="fa-solid fa-check"></i>
                                                            </div>
                                                            <p className="text-xs font-bold text-slate-500 uppercase">Perfect Attendance!</p>
                                                            <p className="text-[10px] text-slate-400 mt-1">No classes missed for this subject.</p>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* VIEW 2: Complete Chronological Timeline */}
                            {viewMode === 'timeline' && (
                                <div className="bg-white p-6 md:p-8 rounded-[2.5rem] border border-slate-200 shadow-sm space-y-6">
                                    <div className="flex justify-between items-center">
                                        <div>
                                            <h3 className="text-lg font-black text-slate-900 tracking-tight uppercase">Master Missed Sessions Log</h3>
                                            <p className="text-xs text-slate-500 font-medium">All recorded absent sessions across courses with permission status</p>
                                        </div>
                                        <span className="px-3 py-1 bg-slate-100 text-slate-700 text-xs font-black rounded-full border border-slate-200">
                                            {masterAbsentTimeline.length} Total Missed
                                        </span>
                                    </div>

                                    {masterAbsentTimeline.length > 0 ? (
                                        <div className="space-y-4">
                                            {masterAbsentTimeline.map((absent, i) => (
                                                <AbsentLogCard key={i} absent={absent} showSubjectTitle={true} getDayOfWeek={getDayOfWeek} formatDate={formatDate} />
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="text-center py-16 bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200">
                                            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl">
                                                <i className="fa-solid fa-award"></i>
                                            </div>
                                            <h4 className="font-black text-slate-800 text-base">Flawless Record!</h4>
                                            <p className="text-xs text-slate-500 mt-1">You have zero missed sessions recorded across all courses for this term.</p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

// Sub-component for individual absent card
const AbsentLogCard: React.FC<{
    absent: AbsentLogItem;
    showSubjectTitle?: boolean;
    getDayOfWeek: (d: string) => string;
    formatDate: (d: string) => string;
}> = ({ absent, showSubjectTitle = false, getDayOfWeek, formatDate }) => {
    return (
        <div className={`p-5 rounded-2xl border shadow-sm relative overflow-hidden group transition-all duration-300 ${
            absent.isRecovered ? 'bg-amber-50/30 border-amber-200' :
            absent.isLeaveApproved ? 'bg-indigo-50/30 border-indigo-200' :
            'bg-white border-slate-200/60'
        }`}>
            <div className={`absolute left-0 top-0 bottom-0 w-1 rounded-full opacity-60 ${
                absent.isRecovered ? 'bg-amber-500' :
                absent.isLeaveApproved ? 'bg-indigo-500' :
                'bg-rose-500'
            }`}></div>

            <div className="flex justify-between items-start">
                <div className="flex flex-col gap-1">
                    {showSubjectTitle && (
                        <div className="text-xs font-black text-emerald-700 uppercase tracking-wide mb-1">
                            {absent.subjectName}
                        </div>
                    )}
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[13px] font-black text-slate-900 leading-none">{getDayOfWeek(absent.date)}</span>
                        
                        {absent.isRecovered && (
                            <span className="px-2 py-0.5 rounded text-[9px] font-black bg-amber-100 text-amber-700 border border-amber-250 uppercase tracking-tighter">
                                Recovered
                            </span>
                        )}
                        {absent.isLeaveApproved && (
                            <span className={`px-2 py-0.5 rounded text-[9px] font-black text-white uppercase tracking-tighter ${
                                absent.leaveType === 'Principal' ? 'bg-emerald-600' :
                                absent.leaveType === 'Medical' ? 'bg-amber-500' : 'bg-indigo-600'
                            }`}>
                                <i className="fa-solid fa-crown text-[8px] mr-1"></i>
                                {absent.leaveType || 'Principal'} Permission
                            </span>
                        )}
                        {!absent.isRecovered && !absent.isLeaveApproved && (
                            <span className="px-2 py-0.5 rounded text-[9px] font-black bg-rose-100 text-rose-700 border border-rose-250 uppercase tracking-tighter">
                                Absent
                            </span>
                        )}
                        {absent.isAdditional && (
                            <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                                Substitution Class
                            </span>
                        )}
                    </div>
                    <span className="text-[11px] font-bold text-slate-400 flex items-center gap-1.5 mt-1">
                        <i className="fa-regular fa-calendar text-[10px]"></i>
                        {formatDate(absent.date)}
                    </span>
                </div>

                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                    absent.isRecovered ? 'bg-amber-100/50 text-amber-600' :
                    absent.isLeaveApproved ? 'bg-indigo-100/50 text-indigo-600' :
                    'bg-rose-50 text-rose-500'
                }`}>
                    <i className={`fa-solid ${
                        absent.isRecovered ? 'fa-arrows-rotate' :
                        absent.isLeaveApproved ? 'fa-shield-check' :
                        'fa-calendar-xmark text-xs'
                    }`}></i>
                </div>
            </div>

            {absent.reason && (
                <div className="mt-3 pt-3 border-t border-slate-50 flex items-start gap-2.5 bg-rose-50/20 -mx-5 p-4">
                    <div className="w-6 h-6 bg-rose-100 rounded-lg flex items-center justify-center flex-shrink-0">
                        <i className="fa-solid fa-comment-dots text-[10px] text-rose-600"></i>
                    </div>
                    <div>
                        <p className="text-[9px] font-black text-rose-600 uppercase tracking-[0.1em] mb-0.5 leading-none">Excuse Reason</p>
                        <p className="text-[11px] font-medium text-slate-600 italic">"{absent.reason}"</p>
                    </div>
                </div>
            )}

            {absent.isRecovered && (
                <div className="mt-2 pt-2 border-t border-slate-50 flex items-start gap-2.5 bg-amber-50/40 -mx-5 -mb-5 p-4 rounded-b-2xl">
                    <div className="w-6 h-6 bg-amber-100 rounded-lg flex items-center justify-center flex-shrink-0">
                        <i className="fa-solid fa-shield-halved text-[10px] text-amber-600"></i>
                    </div>
                    <div>
                        <p className="text-[9px] font-black text-amber-700 uppercase tracking-[0.1em] mb-0.5 leading-none">Recovery Info</p>
                        <p className="text-[11px] font-medium text-slate-600 italic">"{absent.recoveredReason || 'Recovered by teacher'}"</p>
                    </div>
                </div>
            )}

            {absent.isLeaveApproved && absent.leaveNote && (
                <div className="mt-2 pt-2 border-t border-slate-50 flex items-start gap-2.5 bg-indigo-50/40 -mx-5 -mb-5 p-4 rounded-b-2xl">
                    <div className="w-6 h-6 bg-indigo-100 rounded-lg flex items-center justify-center flex-shrink-0">
                        <i className="fa-solid fa-crown text-[10px] text-indigo-600"></i>
                    </div>
                    <div>
                        <p className="text-[9px] font-black text-indigo-700 uppercase tracking-[0.1em] mb-0.5 leading-none">Approved Leave Note</p>
                        <p className="text-[11px] font-medium text-slate-600 italic">"{absent.leaveNote}"</p>
                    </div>
                </div>
            )}
        </div>
    );
};

export default StudentAttendancePortal;
