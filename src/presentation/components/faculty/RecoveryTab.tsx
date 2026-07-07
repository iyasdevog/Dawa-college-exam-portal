import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { StudentRecord, SubjectConfig } from '../../../domain/entities/types';
import { dataService } from '../../../infrastructure/services/dataService';
import { useTerm } from '../../viewmodels/TermContext';

const RecoveryTab: React.FC = () => {
    const { activeTerm } = useTerm();

    // --- Sub-tab state ---
    const [subTab, setSubTab] = useState<'recovery' | 'transfer'>('recovery');

    // ── Transfer sub-tab state ──────────────────────────────────────────────
    const [txSearchTerm, setTxSearchTerm] = useState('');
    const [txAllStudents, setTxAllStudents] = useState<StudentRecord[]>([]);
    const [txSelectedStudent, setTxSelectedStudent] = useState<StudentRecord | null>(null);
    const [txAllSubjects, setTxAllSubjects] = useState<SubjectConfig[]>([]);
    const [txStudentSubjects, setTxStudentSubjects] = useState<SubjectConfig[]>([]); // elective subjects student is enrolled in
    const [txFromSubjectId, setTxFromSubjectId] = useState('');
    const [txToSubjectId, setTxToSubjectId] = useState('');
    const [txStatus, setTxStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
    const [txMessage, setTxMessage] = useState('');
    const [txIsLoading, setTxIsLoading] = useState(false);

    // Matching students for transfer search
    const txMatchingStudents = useMemo(() => {
        if (!txSearchTerm.trim()) return [];
        const lower = txSearchTerm.toLowerCase();
        return txAllStudents.filter(s =>
            s.name.toLowerCase().includes(lower) ||
            String(s.adNo || '').toLowerCase().includes(lower)
        );
    }, [txSearchTerm, txAllStudents]);

    // All elective subjects for the student's class (excluding current enrollment)
    const txAvailableTargets = useMemo(() => {
        if (!txSelectedStudent || !txFromSubjectId) return [];
        return txAllSubjects.filter(s =>
            s.id !== txFromSubjectId &&
            s.subjectType === 'elective' &&
            (s.targetClasses || []).includes(txSelectedStudent.className)
        );
    }, [txAllSubjects, txSelectedStudent, txFromSubjectId]);

    // Load students + subjects when transfer tab is opened
    useEffect(() => {
        if (subTab !== 'transfer') return;
        const load = async () => {
            setTxIsLoading(true);
            try {
                const [students, subjects] = await Promise.all([
                    dataService.getAllStudents(activeTerm),
                    dataService.getAllSubjects(activeTerm),
                ]);
                setTxAllStudents(students);
                setTxAllSubjects(subjects);
            } catch (e) {
                console.error(e);
            } finally {
                setTxIsLoading(false);
            }
        };
        load();
    }, [subTab, activeTerm]);

    // When a transfer student is selected, find their enrolled elective subjects
    const handleTxSelectStudent = useCallback(async (student: StudentRecord) => {
        setTxSelectedStudent(student);
        setTxSearchTerm('');
        setTxFromSubjectId('');
        setTxToSubjectId('');
        setTxStatus('idle');
        setTxMessage('');
        setTxIsLoading(true);
        try {
            // Derive enrolled elective subjects from txAllSubjects
            const electiveSubjects = txAllSubjects.filter(s =>
                s.subjectType === 'elective' &&
                (s.targetClasses || []).includes(student.className) &&
                (s.enrolledStudents || []).includes(student.id)
            );
            setTxStudentSubjects(electiveSubjects);
        } catch (e) {
            console.error(e);
        } finally {
            setTxIsLoading(false);
        }
    }, [txAllSubjects]);

    const handleExecuteTransfer = useCallback(async () => {
        if (!txSelectedStudent || !txFromSubjectId || !txToSubjectId) return;
        const fromSubject = txAllSubjects.find(s => s.id === txFromSubjectId);
        const toSubject = txAllSubjects.find(s => s.id === txToSubjectId);
        const confirm = window.confirm(
            `Transfer ${txSelectedStudent.name} from "${fromSubject?.name}" to "${toSubject?.name}"?\n\n` +
            `This will move all attendance records and marks to the new subject. This cannot be undone.`
        );
        if (!confirm) return;

        setTxStatus('loading');
        setTxMessage('Transferring records...');
        try {
            await dataService.transferStudentSubject(
                txSelectedStudent.id,
                txSelectedStudent.className,
                txFromSubjectId,
                txToSubjectId,
                activeTerm
            );
            setTxStatus('success');
            setTxMessage(`✓ ${txSelectedStudent.name} has been transferred from "${fromSubject?.name}" to "${toSubject?.name}". They will now appear in the new subject's attendance sheets.`);
            // Refresh elective list for this student
            const updated = txAllSubjects.filter(s =>
                s.subjectType === 'elective' &&
                (s.targetClasses || []).includes(txSelectedStudent.className) &&
                (s.id === txToSubjectId || ((s.enrolledStudents || []).includes(txSelectedStudent.id) && s.id !== txFromSubjectId))
            );
            setTxStudentSubjects(updated);
            setTxFromSubjectId('');
            setTxToSubjectId('');
        } catch (e) {
            console.error(e);
            setTxStatus('error');
            setTxMessage('Transfer failed. Please try again.');
        }
    }, [txSelectedStudent, txFromSubjectId, txToSubjectId, txAllSubjects, activeTerm]);
    const [searchTerm, setSearchTerm] = useState('');
    const [allStudents, setAllStudents] = useState<StudentRecord[]>([]);
    const [selectedStudent, setSelectedStudent] = useState<StudentRecord | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isActionLoading, setIsActionLoading] = useState(false);
    const [attendanceData, setAttendanceData] = useState<Array<{
        subject: SubjectConfig;
        total: number;
        present: number;
        recovered: number;
        absent: number;
        presentPercentage: number;
        recoveredPercentage: number;
        absentPercentage: number;
        records: Array<{
            id: string;
            date: string;
            className: string;
            presentStudentIds: string[];
            absentStudentIds: string[];
            recoveredStudentIds?: string[];
            absentReasons?: Record<string, string>;
            recoveredReasons?: Record<string, string>;
            markedBy: string;
            markedAt: number;
        }>;
    }>>([]);
    const [expandedSubjectId, setExpandedSubjectId] = useState<string | null>(null);

    // Modal state for recovery action
    const [recoveryModal, setRecoveryModal] = useState<{
        isOpen: boolean;
        subjectId: string;
        subjectName: string;
        maxRecoverable: number;
    } | null>(null);
    const [recoverCount, setRecoverCount] = useState<number | 'all' | 'custom'>('all');
    const [customCountInput, setCustomCountInput] = useState<string>('');

    // Fetch all students for the active term to perform simple frontend filtering
    useEffect(() => {
        const fetchStudents = async () => {
            try {
                setIsLoading(true);
                const students = await dataService.getAllStudents(activeTerm);
                setAllStudents(students);
                // Clear state on term change
                setSelectedStudent(null);
                setAttendanceData([]);
                setSearchTerm('');
            } catch (e) {
                console.error('Error fetching students:', e);
            } finally {
                setIsLoading(false);
            }
        };
        fetchStudents();
    }, [activeTerm]);

    // Perform search whenever search term or students list changes (memoized)
    const matchingStudents = useMemo(() => {
        if (!searchTerm.trim()) return [];
        const lower = searchTerm.toLowerCase();
        return allStudents.filter(s =>
            s.name.toLowerCase().includes(lower) ||
            String(s.adNo || '').toLowerCase().includes(lower)
        );
    }, [searchTerm, allStudents]);

    // Load student detailed attendance
    const loadStudentAttendance = useCallback(async (student: StudentRecord) => {
        setIsLoading(true);
        setSelectedStudent(student);
        setAttendanceData([]);
        setExpandedSubjectId(null);
        try {
            const classSubjects = await dataService.getSubjectsByClass(student.className, activeTerm);
            
            const stats = await Promise.all(classSubjects.map(async (subject) => {
                const records = await dataService.getAttendanceForStudent(student.id, subject.id, activeTerm);
                const total = records.length;
                
                const present = records.filter(r => r.presentStudentIds.includes(student.id)).length;
                const recovered = records.filter(r => r.absentStudentIds.includes(student.id) && r.recoveredStudentIds?.includes(student.id)).length;
                const absent = records.filter(r => r.absentStudentIds.includes(student.id) && !r.recoveredStudentIds?.includes(student.id)).length;

                const presentPercentage = total > 0 ? (present / total) * 100 : 100;
                const recoveredPercentage = total > 0 ? (recovered / total) * 100 : 0;
                const absentPercentage = total > 0 ? (absent / total) * 100 : 0;

                // Sort logs by date descending
                const sortedRecords = [...records].sort((a, b) => b.date.localeCompare(a.date));

                return {
                    subject,
                    total,
                    present,
                    recovered,
                    absent,
                    presentPercentage,
                    recoveredPercentage,
                    absentPercentage,
                    records: sortedRecords.map(r => ({
                        id: r.id,
                        date: r.date,
                        className: r.className,
                        presentStudentIds: r.presentStudentIds,
                        absentStudentIds: r.absentStudentIds,
                        recoveredStudentIds: r.recoveredStudentIds,
                        absentReasons: r.absentReasons,
                        recoveredReasons: r.recoveredReasons,
                        markedBy: r.markedBy,
                        markedAt: r.markedAt
                    }))
                };
            }));

            setAttendanceData(stats);
        } catch (e) {
            console.error('Error fetching student attendance details:', e);
        } finally {
            setIsLoading(false);
        }
    }, [activeTerm]);

    const handleOpenRecoverModal = useCallback((subjectId: string, subjectName: string, maxAbsents: number) => {
        setRecoveryModal({
            isOpen: true,
            subjectId,
            subjectName,
            maxRecoverable: maxAbsents
        });
        setRecoverCount('all');
        setCustomCountInput('');
    }, []);

    const handleCloseModal = useCallback(() => setRecoveryModal(null), []);
    const handleSetRecoverAll = useCallback(() => setRecoverCount('all'), []);
    const handleSetRecoverCustom = useCallback(() => setRecoverCount('custom'), []);
    const handleCustomInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => setCustomCountInput(e.target.value), []);

    const handleExecuteRecovery = useCallback(async () => {
        if (!selectedStudent || !recoveryModal) return;
        
        let finalCount: number | 'all' = 'all';
        if (recoverCount === 'custom') {
            const num = parseInt(customCountInput, 10);
            if (isNaN(num) || num <= 0) {
                alert('Please enter a valid positive number.');
                return;
            }
            if (num > recoveryModal.maxRecoverable) {
                alert(`Cannot recover more than the maximum absences (${recoveryModal.maxRecoverable}).`);
                return;
            }
            finalCount = num;
        }

        try {
            setIsActionLoading(true);
            await dataService.recoverAbsences(
                selectedStudent.id,
                recoveryModal.subjectId,
                finalCount,
                activeTerm
            );
            // Refresh settings & calculations
            await loadStudentAttendance(selectedStudent);
            setRecoveryModal(null);
            alert('Absences recovered successfully!');
        } catch (e) {
            console.error(e);
            alert('An error occurred during recovery.');
        } finally {
            setIsActionLoading(false);
        }
    }, [selectedStudent, recoveryModal, recoverCount, customCountInput, activeTerm, loadStudentAttendance]);

    const getDayOfWeek = (dateStr: string) => {
        const d = new Date(dateStr);
        return new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(d);
    };

    const formatDate = (dateStr: string) => {
        const d = new Date(dateStr);
        return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(d);
    };

    return (
        <div className="px-4 md:px-0 mt-8 space-y-6">

            {/* Sub-tab switcher */}
            <div className="flex bg-slate-100 p-1.5 rounded-2xl w-full sm:w-fit overflow-x-auto no-scrollbar">
                <button
                    onClick={() => setSubTab('recovery')}
                    className={`px-6 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all flex-shrink-0 flex items-center gap-2 ${subTab === 'recovery' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
                >
                    <i className="fa-solid fa-clock-rotate-left" /> Recovery
                </button>
                <button
                    onClick={() => setSubTab('transfer')}
                    className={`px-6 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all flex-shrink-0 flex items-center gap-2 ${subTab === 'transfer' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
                >
                    <i className="fa-solid fa-right-left" /> Subject Transfer
                </button>
            </div>

            {/* ── Transfer Panel ─────────────────────────────────────────── */}
            {subTab === 'transfer' && (
                <div className="bg-white rounded-2xl p-6 shadow-lg border-2 border-slate-200 space-y-6">
                    <div>
                        <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter mb-1">
                            <i className="fa-solid fa-right-left mr-2 text-violet-600" />
                            Student Subject Transfer
                        </h3>
                        <p className="text-slate-500 text-sm">
                            Move a student from one optional subject (e.g. Basic English) to another (e.g. Communicative English)
                            within the same class. All existing attendance records and marks will be migrated — the student will
                            appear in the new subject's attendance sheet immediately.
                        </p>
                    </div>

                    {txIsLoading && (
                        <div className="flex items-center gap-3 text-slate-500 text-sm font-bold py-4">
                            <div className="loader-ring" /> Loading…
                        </div>
                    )}

                    {/* Student Search */}
                    {!txIsLoading && (
                        <div className="relative max-w-md">
                            <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">
                                Search Student
                            </label>
                            <div className="relative">
                                <input
                                    type="text"
                                    value={txSearchTerm}
                                    onChange={(e) => setTxSearchTerm(e.target.value)}
                                    placeholder="Enter name or Admission No…"
                                    className="w-full pl-10 pr-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:ring-4 focus:ring-violet-500/10 focus:border-violet-500 transition-all font-bold text-sm"
                                />
                                <i className="fa-solid fa-search absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                            </div>

                            {txMatchingStudents.length > 0 && (
                                <div className="absolute left-0 right-0 mt-2 bg-white rounded-2xl border-2 border-slate-100 shadow-2xl z-50 max-h-60 overflow-y-auto divide-y divide-slate-100 p-2">
                                    {txMatchingStudents.map(s => (
                                        <button
                                            key={s.id}
                                            onClick={() => handleTxSelectStudent(s)}
                                            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-violet-50 transition-colors text-left"
                                        >
                                            <div className="w-9 h-9 bg-violet-100 rounded-xl flex items-center justify-center shrink-0">
                                                <i className="fa-solid fa-user text-violet-600 text-sm" />
                                            </div>
                                            <div>
                                                <p className="font-black text-slate-900 text-sm leading-tight">{s.name}</p>
                                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{s.className} · Ad# {s.adNo}</p>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Selected student + transfer form */}
                    {txSelectedStudent && !txIsLoading && (
                        <div className="space-y-5 pt-2 border-t border-slate-100">
                            {/* Student badge */}
                            <div className="flex items-center gap-3 bg-violet-50 border border-violet-100 rounded-2xl px-5 py-4">
                                <div className="w-10 h-10 bg-violet-500 rounded-xl flex items-center justify-center text-white shrink-0">
                                    <i className="fa-solid fa-user" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="font-black text-slate-900 text-base leading-tight truncate">{txSelectedStudent.name}</p>
                                    <p className="text-[10px] text-violet-500 font-black uppercase tracking-widest">{txSelectedStudent.className} · Ad# {txSelectedStudent.adNo}</p>
                                </div>
                                <button
                                    onClick={() => { setTxSelectedStudent(null); setTxStatus('idle'); setTxMessage(''); }}
                                    className="w-8 h-8 flex items-center justify-center rounded-xl bg-white border border-slate-200 text-slate-400 hover:text-red-500 hover:border-red-200 transition-all shrink-0"
                                >
                                    <i className="fa-solid fa-xmark text-sm" />
                                </button>
                            </div>

                            {/* Enrolled elective subjects */}
                            {txStudentSubjects.length === 0 ? (
                                <div className="bg-amber-50 border border-amber-200 rounded-2xl px-5 py-4 text-sm text-amber-700 font-bold">
                                    <i className="fa-solid fa-triangle-exclamation mr-2" />
                                    This student is not enrolled in any elective subject. Transfer is only for elective/optional subjects.
                                </div>
                            ) : (
                                <div className="grid gap-5 sm:grid-cols-2">
                                    {/* FROM subject */}
                                    <div>
                                        <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">
                                            <i className="fa-solid fa-arrow-right-from-bracket mr-1 text-rose-400" />
                                            Transfer From (Current Subject)
                                        </label>
                                        <select
                                            value={txFromSubjectId}
                                            onChange={e => { setTxFromSubjectId(e.target.value); setTxToSubjectId(''); }}
                                            className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold text-sm focus:ring-4 focus:ring-rose-500/10 focus:border-rose-400 transition-all outline-none"
                                        >
                                            <option value="">— Select current subject —</option>
                                            {txStudentSubjects.map(s => (
                                                <option key={s.id} value={s.id}>{s.name}</option>
                                            ))}
                                        </select>
                                    </div>

                                    {/* TO subject */}
                                    <div>
                                        <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">
                                            <i className="fa-solid fa-arrow-right-to-bracket mr-1 text-emerald-500" />
                                            Transfer To (New Subject)
                                        </label>
                                        <select
                                            value={txToSubjectId}
                                            onChange={e => setTxToSubjectId(e.target.value)}
                                            disabled={!txFromSubjectId}
                                            className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold text-sm focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-400 transition-all outline-none disabled:opacity-50"
                                        >
                                            <option value="">— Select new subject —</option>
                                            {txAvailableTargets.map(s => (
                                                <option key={s.id} value={s.id}>{s.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                            )}

                            {/* Confirm button */}
                            {txFromSubjectId && txToSubjectId && txStatus !== 'success' && (
                                <button
                                    onClick={handleExecuteTransfer}
                                    disabled={txStatus === 'loading'}
                                    className="flex items-center gap-3 px-8 py-3 bg-violet-600 hover:bg-violet-700 disabled:opacity-60 text-white font-black text-sm rounded-2xl shadow-lg shadow-violet-200 transition-all"
                                >
                                    {txStatus === 'loading' ? (
                                        <><div className="loader-ring-sm" /> Transferring…</>
                                    ) : (
                                        <><i className="fa-solid fa-right-left" /> Execute Transfer</>
                                    )}
                                </button>
                            )}

                            {/* Status message */}
                            {txMessage && (
                                <div className={`rounded-2xl px-5 py-4 text-sm font-bold border ${txStatus === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : txStatus === 'error' ? 'bg-red-50 border-red-200 text-red-700' : 'bg-blue-50 border-blue-200 text-blue-700'}`}>
                                    {txMessage}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* ── Recovery Panel ─────────────────────────────────────────── */}
            {subTab === 'recovery' && (
            <div className="bg-white rounded-2xl p-6 shadow-lg border-2 border-slate-200">
                <h3 className="text-xl font-black text-slate-900 mb-6 uppercase tracking-tighter">
                    <i className="fa-solid fa-clock-rotate-left mr-2 text-emerald-600"></i>
                    Attendance Recovery Center
                </h3>
                
                <p className="text-slate-600 mb-6 text-sm">
                    Search students by name, view their subject absent logs, and recover eligible absents to update their attendance averages.
                </p>

                {/* Search Field */}
                <div className="relative max-w-md mb-8">
                    <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">Search Student</label>
                    <div className="relative">
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Enter student name or Admission No..."
                            className="w-full pl-10 pr-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all font-bold text-sm"
                        />
                        <i className="fa-solid fa-search absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"></i>
                    </div>

                    {/* Matching Results List */}
                    {matchingStudents.length > 0 && (
                        <div className="absolute left-0 right-0 mt-2 bg-white rounded-2xl border-2 border-slate-100 shadow-2xl z-50 max-h-60 overflow-y-auto divide-y divide-slate-100 p-2">
                            {matchingStudents.map(student => (
                                <button
                                    key={student.id}
                                    onClick={() => {
                                        setSearchTerm('');
                                        loadStudentAttendance(student);
                                    }}
                                    className="w-full text-left p-3 hover:bg-slate-50 rounded-xl transition-all flex items-center justify-between group"
                                >
                                    <div>
                                        <div className="font-bold text-slate-900 group-hover:text-emerald-600 transition-colors">{student.name}</div>
                                        <div className="text-xs text-slate-400 font-bold">Class: {student.className}</div>
                                    </div>
                                    <span className="text-xs font-black bg-slate-100 text-slate-600 px-2.5 py-1 rounded-lg">
                                        Ad No: #{student.adNo}
                                    </span>
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {isLoading && (
                    <div className="flex flex-col items-center justify-center py-10 space-y-3">
                        <i className="fa-solid fa-circle-notch fa-spin text-3xl text-emerald-600"></i>
                        <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Loading details...</span>
                    </div>
                )}

                {/* Selected Student Information & Subjects recovery metrics */}
                {selectedStudent && !isLoading && (
                    <div className="space-y-6">
                        {/* Student card info */}
                        <div className="bg-slate-950 text-white p-6 rounded-[2rem] border border-slate-800 relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div className="relative z-10 space-y-2">
                                <span className="px-3 py-1 bg-emerald-500/10 text-emerald-400 rounded-full text-[9px] font-black uppercase tracking-widest border border-emerald-500/20">
                                    Selected Student Profile
                                </span>
                                <h4 className="text-2xl font-black">{selectedStudent.name}</h4>
                                <div className="flex items-center gap-3 text-xs text-slate-400 font-bold">
                                    <span>Class: {selectedStudent.className}</span>
                                    <span className="w-1.5 h-1.5 bg-slate-700 rounded-full"></span>
                                    <span>Ad No: {selectedStudent.adNo}</span>
                                </div>
                            </div>
                            <div className="absolute -right-6 -bottom-6 text-9 text-slate-800/40 rotate-12 pointer-events-none">
                                <i className="fa-solid fa-user-graduate text-8xl"></i>
                            </div>
                        </div>

                        {/* Subjects Grid */}
                        <div className="grid grid-cols-1 gap-6">
                            {attendanceData.map((stat) => {
                                const total = stat.total;
                                const present = stat.present;
                                const recovered = stat.recovered;
                                const absent = stat.absent;

                                // Combined attendance
                                const combinedPct = stat.presentPercentage + stat.recoveredPercentage;

                                return (
                                    <div
                                        key={stat.subject.id}
                                        className={`bg-white rounded-[2rem] border transition-all duration-300 overflow-hidden ${
                                            expandedSubjectId === stat.subject.id ? 'border-emerald-500 shadow-xl' : 'border-slate-200'
                                        }`}
                                    >
                                        {/* Card Header */}
                                        <div 
                                            className="p-6 cursor-pointer hover:bg-slate-50/50 transition-colors"
                                            onClick={() => setExpandedSubjectId(expandedSubjectId === stat.subject.id ? null : stat.subject.id)}
                                        >
                                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
                                                <div>
                                                    <h5 className="text-lg font-black text-slate-900">{stat.subject.name}</h5>
                                                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">
                                                        Faculty: {stat.subject.facultyName || 'No Faculty assigned'}
                                                    </p>
                                                </div>

                                                {/* Percentage Badges */}
                                                <div className="flex items-center gap-3">
                                                    <div className="bg-emerald-50 border border-emerald-100 px-3 py-2 rounded-2xl flex flex-col items-center">
                                                        <span className="text-[9px] font-black text-emerald-600 uppercase tracking-tighter leading-none mb-0.5">Present</span>
                                                        <span className="text-normal font-black text-emerald-700 leading-none">{Math.round(stat.presentPercentage)}%</span>
                                                    </div>
                                                    {recovered > 0 && (
                                                        <div className="bg-amber-50 border border-amber-100 px-3 py-2 rounded-2xl flex flex-col items-center">
                                                            <span className="text-[9px] font-black text-amber-600 uppercase tracking-tighter leading-none mb-0.5">Recovered</span>
                                                            <span className="text-normal font-black text-amber-700 leading-none">+{Math.round(stat.recoveredPercentage)}%</span>
                                                        </div>
                                                    )}
                                                    <div className={`px-4 py-2 rounded-2xl flex flex-col items-center font-black ${combinedPct < 75 ? 'bg-rose-50 text-rose-700 border border-rose-100' : 'bg-slate-900 text-white'}`}>
                                                        <span className="text-[9px] uppercase tracking-tighter leading-none mb-0.5 opacity-80">Total</span>
                                                        <span className="text-lg leading-none">{Math.round(combinedPct)}%</span>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Stacked Segmented Progress Bar */}
                                            <div className="space-y-3">
                                                <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden flex">
                                                    {present > 0 && (
                                                        <div 
                                                            className="bg-emerald-500 h-full transition-all duration-500" 
                                                            style={{ width: `${stat.presentPercentage}%` }}
                                                            title={`Present: ${present}`}
                                                        />
                                                    )}
                                                    {recovered > 0 && (
                                                        <div 
                                                            className="bg-amber-500 h-full transition-all duration-500 border-l border-white" 
                                                            style={{ width: `${stat.recoveredPercentage}%` }}
                                                            title={`Recovered: ${recovered}`}
                                                        />
                                                    )}
                                                    {absent > 0 && (
                                                        <div 
                                                            className="bg-rose-500 h-full transition-all duration-500 border-l border-white" 
                                                            style={{ width: `${stat.absentPercentage}%` }}
                                                            title={`Absent: ${absent}`}
                                                        />
                                                    )}
                                                </div>
                                                
                                                <div className="flex flex-wrap items-center justify-between text-xs text-slate-500 font-semibold gap-2">
                                                    <div className="flex items-center gap-4">
                                                        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-emerald-500 block"></span> Present: {present}</span>
                                                        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-amber-500 block"></span> Recovered: {recovered}</span>
                                                        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-rose-500 block"></span> Absent: {absent}</span>
                                                    </div>
                                                    <span className="bg-slate-50 px-2.5 py-1 rounded-lg border text-slate-600">Total sessions: {total}</span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Card Actions & Missed Log Details */}
                                        {expandedSubjectId === stat.subject.id && (
                                            <div className="bg-slate-50/50 border-t border-slate-100 p-6 space-y-6">
                                                {/* Recover Controls */}
                                                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                                    <div>
                                                        <h6 className="font-bold text-slate-900 text-sm">Attendance Recovery Tool</h6>
                                                        <p className="text-xs text-slate-500 mt-1">
                                                            Currently {absent} active absences. Recovering them overrides their status for eligibility.
                                                        </p>
                                                    </div>
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleOpenRecoverModal(stat.subject.id, stat.subject.name, absent);
                                                        }}
                                                        disabled={absent === 0}
                                                        className="px-5 py-2.5 bg-emerald-600 text-white rounded-xl font-black text-xs uppercase tracking-widest hover:bg-emerald-700 disabled:opacity-50 transition-all shadow-md self-start sm:self-center"
                                                    >
                                                        <i className="fa-solid fa-plus-circle mr-1.5"></i> Recover Absents
                                                    </button>
                                                </div>

                                                {/* Missed Sessions list */}
                                                <div>
                                                    <h6 className="text-xs font-black uppercase text-slate-400 tracking-wider mb-3">Sessions History Log</h6>
                                                    
                                                    {stat.records.length > 0 ? (
                                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                            {stat.records.map((rec) => {
                                                                const isStudentAbsent = rec.absentStudentIds.includes(selectedStudent.id);
                                                                const isStudentPresent = rec.presentStudentIds.includes(selectedStudent.id);
                                                                const isRecovered = isStudentAbsent && rec.recoveredStudentIds?.includes(selectedStudent.id);

                                                                // If student was present, it's not a missed session in general, but let's show all so the log is complete, or filter.
                                                                // User requested "shows all subjects and it's absent period". Let's show absent and recovered ones.
                                                                if (isStudentPresent) return null;

                                                                return (
                                                                    <div 
                                                                        key={rec.id} 
                                                                        className={`p-4 rounded-xl border relative overflow-hidden transition-all duration-300 ${
                                                                            isRecovered 
                                                                                ? 'bg-amber-50/40 border-amber-200' 
                                                                                : 'bg-rose-50/40 border-rose-200'
                                                                        }`}
                                                                    >
                                                                        <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${isRecovered ? 'bg-amber-500' : 'bg-rose-500'}`}></div>
                                                                        <div className="flex justify-between items-start">
                                                                            <div className="space-y-1 pl-1">
                                                                                <div className="flex items-center gap-2">
                                                                                    <span className="font-bold text-slate-800 text-sm">{getDayOfWeek(rec.date)}</span>
                                                                                    <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded ${isRecovered ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700'}`}>
                                                                                        {isRecovered ? 'Recovered' : 'Absent'}
                                                                                    </span>
                                                                                </div>
                                                                                <p className="text-xs font-medium text-slate-500">
                                                                                    <i className="fa-solid fa-calendar-day mr-1"></i>
                                                                                    {formatDate(rec.date)}
                                                                                </p>
                                                                                
                                                                                {/* Remarks */}
                                                                                {rec.absentReasons?.[selectedStudent.id] && (
                                                                                    <p className="text-xs text-rose-600 mt-2 bg-rose-50 p-2 rounded-lg italic">
                                                                                        Reason: "{rec.absentReasons[selectedStudent.id]}"
                                                                                    </p>
                                                                                )}

                                                                                {isRecovered && rec.recoveredReasons?.[selectedStudent.id] && (
                                                                                    <p className="text-xs text-amber-700 mt-2 bg-amber-50 p-2 rounded-lg font-medium italic">
                                                                                        Recovery Note: "{rec.recoveredReasons[selectedStudent.id]}"
                                                                                    </p>
                                                                                )}
                                                                            </div>
                                                                            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${isRecovered ? 'bg-amber-105 text-amber-600' : 'bg-rose-100 text-rose-600'}`}>
                                                                                <i className={`fa-solid ${isRecovered ? 'fa-square-check' : 'fa-triangle-exclamation'}`}></i>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    ) : (
                                                        <div className="text-center py-6 bg-white rounded-2xl border border-slate-100">
                                                            <i className="fa-solid fa-calendar-check text-2xl text-emerald-500 mb-2"></i>
                                                            <p className="text-sm font-bold text-slate-600">Perfect Record</p>
                                                            <p className="text-xs text-slate-400">No session was marked absent.</p>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>
            )} {/* end subTab recovery */}

            {/* Modal for Recovery Count configuration */}
            {recoveryModal && recoveryModal.isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div 
                        className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity" 
                        onClick={() => !isActionLoading && handleCloseModal()}
                    ></div>
                    <div className="bg-white max-w-md w-full rounded-[2rem] border border-slate-200 p-6 relative z-10 shadow-2xl animate-in zoom-in-95 duration-200">
                        <div className="flex items-center justify-between mb-4 border-b pb-3">
                            <h4 className="text-lg font-black text-slate-900 uppercase tracking-tight">Recover Absences</h4>
                            <button
                                onClick={handleCloseModal}
                                className="w-8 h-8 rounded-full bg-slate-50 border flex items-center justify-center text-slate-400 hover:text-slate-600"
                            >
                                <i className="fa-solid fa-xmark"></i>
                            </button>
                        </div>

                        <div className="space-y-4">
                            <p className="text-sm text-slate-600 font-bold">
                                Subject: <span className="text-slate-900">{recoveryModal.subjectName}</span>
                            </p>
                            
                            <div className="bg-slate-50 p-4 rounded-xl border space-y-2">
                                <label className="block text-xs font-black text-slate-500 uppercase tracking-widest">Select Mode</label>
                                <div className="grid grid-cols-2 gap-2">
                                    <button
                                        type="button"
                                        onClick={handleSetRecoverAll}
                                        className={`py-2 px-3 rounded-lg font-bold text-xs uppercase ${recoverCount === 'all' ? 'bg-emerald-600 text-white shadow' : 'bg-white border text-slate-600'}`}
                                    >
                                        Recover All ({recoveryModal.maxRecoverable})
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleSetRecoverCustom}
                                        className={`py-2 px-3 rounded-lg font-bold text-xs uppercase ${recoverCount === 'custom' ? 'bg-emerald-600 text-white shadow' : 'bg-white border text-slate-600'}`}
                                    >
                                        Specified Number
                                    </button>
                                </div>
                            </div>

                            {recoverCount === 'custom' && (
                                <div className="space-y-1.5 animate-in slide-in-from-top-2 duration-300">
                                    <label className="block text-xs font-black text-slate-500 uppercase tracking-widest">Number of Absences to Recover</label>
                                    <input
                                        type="number"
                                        min="1"
                                        max={recoveryModal.maxRecoverable}
                                        value={customCountInput}
                                        onChange={(e) => setCustomCountInput(e.target.value)}
                                        placeholder={`Max ${recoveryModal.maxRecoverable}...`}
                                        className="w-full p-3 border rounded-xl font-bold"
                                    />
                                    <p className="text-[10px] text-amber-600 font-bold italic">
                                        Must be between 1 and {recoveryModal.maxRecoverable}
                                    </p>
                                </div>
                            )}

                            <div className="flex gap-3 pt-4 border-t">
                                <button
                                    type="button"
                                    onClick={() => setRecoveryModal(null)}
                                    className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs uppercase"
                                    disabled={isActionLoading}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    onClick={handleExecuteRecovery}
                                    className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-xl text-xs uppercase tracking-wider flex items-center justify-center gap-2"
                                    disabled={isActionLoading}
                                >
                                    {isActionLoading ? (
                                        <>
                                            <i className="fa-solid fa-spinner fa-spin"></i> Processing
                                        </>
                                    ) : (
                                        <>
                                            <i className="fa-solid fa-bolt"></i> Apply Recovery
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default React.memo(RecoveryTab);
