import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { StudentRecord, SubjectConfig } from '../../domain/entities/types';
import type { User } from '../../domain/entities/User';
import { SYSTEM_CLASSES } from '../../domain/entities/constants';
import { useMemo } from 'react';
import { dataService } from '../../infrastructure/services/dataService';
import { shortenSubjectName } from '../../infrastructure/services/formatUtils';
import { getSubjectMaxMarks, getMarkForSubject } from '../../domain/utils/subjectUtils';
import { useTerm } from '../viewmodels/TermContext';

interface StudentScorecardProps {
    currentUser?: User | null;
}

// ─── Grade helpers ──────────────────────────────────────────────────────────
function getGradeColor(performance: string): string {
    if (performance.includes('O (Outstanding)')) return 'from-emerald-500 to-teal-400';
    if (performance.includes('A+ (Excellent)')) return 'from-emerald-400 to-green-400';
    if (performance.includes('A (Very Good)')) return 'from-blue-500 to-indigo-400';
    if (performance.includes('B+ (Good)')) return 'from-teal-500 to-cyan-400';
    if (performance.includes('B (Good)')) return 'from-teal-400 to-cyan-300';
    if (performance.includes('C (Average)')) return 'from-amber-400 to-yellow-300';
    if (performance.includes('F (Failed)')) return 'from-red-500 to-rose-400';
    return 'from-slate-400 to-slate-300';
}

function getGradeTextColor(performance: string): string {
    if (performance === 'F (Failed)') return 'text-red-500';
    if (performance.includes('O (Outstanding)')) return 'text-emerald-600';
    if (performance.includes('A+ (Excellent)')) return 'text-emerald-500';
    if (performance.includes('A (Very Good)')) return 'text-blue-500';
    if (performance.includes('B+ (Good)')) return 'text-teal-500';
    if (performance.includes('B (Good)')) return 'text-teal-400';
    if (performance.includes('C (Average)')) return 'text-amber-500';
    return 'text-slate-500';
}

function getPrintGradeClass(performance: string): string {
    if (performance === 'F (Failed)') return 'print:performance-failed';
    if (performance.includes('O (Outstanding)') || performance.includes('A+ (Excellent)')) return 'print:performance-excellent';
    if (performance.includes('A (Very Good)') || performance.includes('B+ (Good)') || performance.includes('B (Good)')) return 'print:performance-good';
    if (performance.includes('C (Average)')) return 'print:performance-average';
    return '';
}

// Stable timestamp factory — called once per render cycle, not inline per student card
function makeDocId(adNo: string, seed: number) {
    return `AIC-SC-${adNo}-${seed.toString().slice(-8)}`;
}

const getSupplementaryLabel = (appType?: string): string => {
    if (!appType) return 'Supply';
    const type = appType.toLowerCase();
    if (type.includes('improve')) return 'Improvement';
    return 'Supply';
};

const enrichStudentsWithSupps = (studentsList: StudentRecord[], supps: any[], termKey: string) => {
    return studentsList.map(student => {
        const studentSupps = supps.filter(su => su.studentId === student.id);
        const termRecord = student.academicHistory?.[termKey];
        if (termRecord && studentSupps.length > 0) {
            const originalMarks = termRecord.marks || {};
            const mergedMarks = { ...originalMarks };
            
            const processedSupps = studentSupps
                .filter(su => (su.status === 'Completed' || su.status === 'Passed' || su.status === 'Failed') && su.marks)
                .sort((a, b) => (a.updatedAt || 0) - (b.updatedAt || 0)); // Ascending so newest overwrites older

            processedSupps.forEach(su => {
                const matchesTerm = su.originalTerm?.toLowerCase().trim() === termKey.toLowerCase().trim() ||
                                    su.examTerm?.toLowerCase().trim() === termKey.toLowerCase().trim();
                if (matchesTerm && su.subjectId) {
                    const existingMark = originalMarks[su.subjectId] as any;
                    let prevMarks = (existingMark && Object.keys(existingMark).length > 0) ? existingMark : su.previousMarks;
                    if (prevMarks && prevMarks.total === undefined) {
                        const intVal = typeof prevMarks.int === 'number' ? prevMarks.int : 0;
                        const extVal = typeof prevMarks.ext === 'number' ? prevMarks.ext : 0;
                        prevMarks = { ...prevMarks, total: intVal + extVal };
                    }

                    // For improvement, take the highest marks between old and new
                    let finalInt = typeof su.marks!.int === 'number' ? su.marks!.int : 0;
                    let finalExt = typeof su.marks!.ext === 'number' ? su.marks!.ext : 0;
                    if (su.applicationType === 'improvement' && prevMarks) {
                        const pInt = typeof prevMarks.int === 'number' ? prevMarks.int : 0;
                        const pExt = typeof prevMarks.ext === 'number' ? prevMarks.ext : 0;
                        finalInt = Math.max(pInt, finalInt);
                        finalExt = Math.max(pExt, finalExt);
                    }
                    const finalTotal = finalInt + finalExt;

                    mergedMarks[su.subjectId] = {
                        ...su.marks!,
                        int: finalInt,
                        ext: finalExt,
                        total: finalTotal,
                        isSupplementary: true,
                        applicationType: su.applicationType,
                        maxINT: (su.maxINT && su.maxINT > 0) ? su.maxINT : (existingMark?.maxINT || 0),
                        maxEXT: (su.maxEXT && su.maxEXT > 0) ? su.maxEXT : (existingMark?.maxEXT || 0),
                        previousMarks: prevMarks
                    } as any;
                }
            });

            // Recalculate metrics
            const marksEntries = Object.entries(mergedMarks);
            const grandTotal = marksEntries.reduce((sum, [_, m]) => {
                const val = m.total;
                if (typeof val === 'number') return sum + val;
                if (!val || val === 'A') return sum;
                const num = parseInt(val, 10);
                return sum + (isNaN(num) ? 0 : num);
            }, 0);
            
            const subjectCount = marksEntries.length;
            let average = subjectCount > 0 ? grandTotal / subjectCount : 0;
            if (isNaN(average)) average = 0;
            average = Math.round(average * 100) / 100;

            return {
                ...student,
                supplementaryExams: studentSupps,
                academicHistory: {
                    ...student.academicHistory,
                    [termKey]: {
                        ...termRecord,
                        marks: mergedMarks,
                        grandTotal,
                        average
                    }
                }
            };
        }
        return { ...student, supplementaryExams: studentSupps };
    });
};

// ─── Main component ──────────────────────────────────────────────────────────
const StudentScorecard: React.FC<StudentScorecardProps> = ({ currentUser }) => {
    const [branding, setBranding] = useState<any>(null);
    const [availableClasses, setAvailableClasses] = useState<string[]>(SYSTEM_CLASSES);

    const allowedClasses = useMemo(() => {
        if (!currentUser || currentUser.role === 'admin' || currentUser.role === 'teacher') return availableClasses;
        return availableClasses.filter(cls => currentUser.assignedClasses?.includes(cls));
    }, [currentUser, availableClasses]);

    const [selectedClass, setSelectedClass] = useState('');
    const [selectedStudent, setSelectedStudent] = useState('');
    const [classStudents, setClassStudents] = useState<StudentRecord[]>([]);
    const [subjects, setSubjects] = useState<SubjectConfig[]>([]);
    const [classSubjects, setClassSubjects] = useState<SubjectConfig[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const { activeTerm, currentSemester, currentAcademicYear } = useTerm();

    // ── Bulk print state ──────────────────────────────────────────────────────
    const [bulkPrintStatus, setBulkPrintStatus] = useState<'idle' | 'preparing' | 'printing'>('idle');
    // Stable seed so Document IDs don't change on each re-render
    const printSeedRef = useRef(Date.now());



    useEffect(() => { loadData(); }, [activeTerm, currentUser]);
    useEffect(() => { if (selectedClass) loadClassData(); }, [selectedClass, subjects]);

    const loadData = async () => {
        try {
            setIsLoading(true);
            const [settings, allSubjects, termClasses] = await Promise.all([
                dataService.getGlobalSettings(),
                dataService.getAllSubjects(activeTerm),
                dataService.getClassesByTerm(activeTerm)
            ]);
            setBranding(settings);
            setSubjects(allSubjects);
            setAvailableClasses(termClasses);
            const allowed = (!currentUser || currentUser.role === 'admin' || currentUser.role === 'teacher')
                ? termClasses
                : termClasses.filter(cls => currentUser.assignedClasses?.includes(cls));
            if (allowed.length > 0 && (!selectedClass || !allowed.includes(selectedClass))) {
                setSelectedClass(allowed[0]);
            }
        } catch (error) {
            console.error('Error loading data:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const loadClassData = async () => {
        try {
            const [cs, supps] = await Promise.all([
                dataService.getStudentsByClass(selectedClass, activeTerm),
                dataService.getAllSupplementaryExams('All')
            ]);
            const enriched = enrichStudentsWithSupps(cs, supps, activeTerm);
            setClassStudents(enriched);
            if (selectedStudent && !enriched.find(s => s.id === selectedStudent)) setSelectedStudent('');
            const filteredSubjects = subjects.filter(s =>
                s.targetClasses.includes(selectedClass) ||
                (s.subjectType === 'elective' && s.enrolledStudents?.some(id => enriched.some(c => c.id === id))) ||
                enriched.some(cs => {
                    const termData = cs.academicHistory?.[activeTerm];
                    return getMarkForSubject(termData?.marks, s, termData?.subjectMetadata) !== undefined;
                })
            );
            setClassSubjects(filteredSubjects);
        } catch (error) {
            console.error('Error loading class data:', error);
        }
    };

    const handlePrint = () => window.print();

    // ── Optimized bulk print: prepare state → rAF → print ──────────────────
    const handlePrintAll = useCallback(() => {
        printSeedRef.current = Date.now();
        setBulkPrintStatus('preparing');
    }, []);

    useEffect(() => {
        if (bulkPrintStatus === 'preparing') {
            // Allow React to commit the bulk container to DOM, then defer to next frame
            const raf = requestAnimationFrame(() => {
                setBulkPrintStatus('printing');
            });
            return () => cancelAnimationFrame(raf);
        }
        if (bulkPrintStatus === 'printing') {
            // Extra 100ms so layout and images settle
            const timer = setTimeout(() => { window.print(); }, 150);
            return () => clearTimeout(timer);
        }
    }, [bulkPrintStatus]);

    useEffect(() => {
        const onAfterPrint = () => setBulkPrintStatus('idle');
        window.addEventListener('afterprint', onAfterPrint);
        return () => window.removeEventListener('afterprint', onAfterPrint);
    }, []);

    const getStudentTermData = (student: StudentRecord, targetTerm: string, targetClass: string) => {
        let termRec: any = student.academicHistory?.[targetTerm];

        // Fall back to top-level marks ONLY if this student's legacy term matches targetTerm
        if (!termRec) {
            const isLegacyTermMatch = (student as any).termKey === targetTerm || (!(student as any).termKey && targetTerm === '2025-2026-Odd');
            if (isLegacyTermMatch && student.marks && Object.keys(student.marks).length > 0) {
                termRec = {
                    className: student.currentClass || student.className || targetClass,
                    semester: student.semester || (targetTerm.includes('Odd') ? 'Odd' : 'Even'),
                    marks: student.marks,
                    grandTotal: student.grandTotal || 0,
                    average: student.average || 0,
                    rank: student.rank || 0,
                    performanceLevel: student.performanceLevel || 'Not Assessed',
                    subjectMetadata: (student as any).subjectMetadata
                };
            }
        }

        if (!termRec) {
            termRec = {
                className: targetClass || student.currentClass || student.className || '',
                semester: targetTerm.includes('Odd') ? 'Odd' : 'Even',
                marks: {},
                grandTotal: 0,
                average: 0,
                rank: 0,
                performanceLevel: 'Not Assessed'
            };
        }

        const marksObj = termRec.marks || {};
        const markEntries = Object.values(marksObj) as any[];
        let totalSum = termRec.grandTotal || 0;
        let avgVal = termRec.average || 0;
        let perfLevel = termRec.performanceLevel || 'Not Assessed';

        if (markEntries.length > 0) {
            let calculatedSum = 0;
            let failCount = 0;
            let validSubjectCount = 0;

            markEntries.forEach(m => {
                const subTotal = typeof m.total === 'number' ? m.total : ((Number(m.int) || 0) + (Number(m.ext) || 0));
                calculatedSum += subTotal;
                if (subTotal > 0 || m.int !== undefined || m.ext !== undefined) validSubjectCount++;
                if (m.status === 'Failed') failCount++;
            });

            if (totalSum === 0 && calculatedSum > 0) {
                totalSum = calculatedSum;
            }
            if (avgVal === 0 && validSubjectCount > 0 && calculatedSum > 0) {
                avgVal = Math.round((calculatedSum / validSubjectCount) * 10) / 10;
            }
            if ((perfLevel === 'Not Assessed' || perfLevel === 'Pending') && calculatedSum > 0) {
                perfLevel = failCount > 0 ? 'Failed' : 'Passed';
            }
        }

        return {
            ...termRec,
            grandTotal: totalSum,
            average: avgVal,
            performanceLevel: perfLevel
        };
    };

    // ── Derived state ─────────────────────────────────────────────────────────
    const selectedStudentData = classStudents.find(s => s.id === selectedStudent);

    const rankedStudentsList = useMemo(() => {
        const processed = classStudents.map(student => {
            const termRec = getStudentTermData(student, activeTerm, selectedClass);
            const total = termRec?.grandTotal || 0;
            return { ...student, _total: total };
        }).sort((a, b) => b._total - a._total);
        let rank = 1;
        return processed.map((item, i) => {
            if (i > 0 && item._total === processed[i - 1]._total) { /* tie – keep rank */ }
            else rank = i + 1;
            return { ...item, calculatedRank: rank };
        });
    }, [classStudents, activeTerm, selectedClass]);

    const activeTermRecord = selectedStudentData ? getStudentTermData(selectedStudentData, activeTerm, selectedClass) : null;
    const displayMarks = activeTermRecord?.marks || {};
    const displayRank = rankedStudentsList.find(s => s.id === selectedStudent)?.calculatedRank ?? activeTermRecord?.rank ?? '-';
    const displayTotal = activeTermRecord?.grandTotal || 0;
    const displayAverage = activeTermRecord?.average || 0;
    const displayPerformance = activeTermRecord?.performanceLevel || 'Not Assessed';
    const displayClass = (activeTermRecord?.className && activeTermRecord.className !== 'Unknown')
        ? activeTermRecord.className
        : (selectedClass && selectedClass !== 'All' ? selectedClass : (selectedStudentData?.currentClass || ''));

    const studentStats = useMemo(() => {
        if (!selectedStudentData) return null;
        const vals = Object.values(displayMarks) as any[];
        return {
            totalSubjects: classSubjects.length,
            completedSubjects: vals.length,
            passedSubjects: vals.filter(m => m.status === 'Passed').length,
            failedSubjects: vals.filter(m => m.status === 'Failed').length,
            highestScore: vals.length > 0 ? Math.max(...vals.map(m => m.total)) : 0,
            lowestScore: vals.length > 0 ? Math.min(...vals.map(m => m.total)) : 0,
        };
    }, [selectedStudentData, displayMarks, classSubjects]);

    const isBulkActive = bulkPrintStatus !== 'idle';

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="text-center">
                    <div className="loader-ring mb-4"></div>
                    <p className="text-slate-600">Loading student scorecards...</p>
                </div>
            </div>
        );
    }

    return (
        <>
            {/* ── Screen UI (hidden during bulk print) ─────────────────────── */}
            <div className={`space-y-8 print:space-y-0 print:m-0 print:p-0 ${isBulkActive ? 'print:hidden' : ''}`}>
                {/* Header */}
                <div className="flex items-center justify-between print:hidden flex-wrap gap-4">
                    <div>
                        <h1 className="text-3xl font-black text-slate-900 tracking-tight">Student Scorecard</h1>
                        <p className="text-slate-500 mt-1 text-sm">Individual performance analysis &amp; official transcript</p>
                    </div>
                    <div className="flex gap-3 flex-wrap">
                        {/* Bulk Print Button */}
                        {classStudents.length > 0 && (
                            <button
                                onClick={handlePrintAll}
                                disabled={isBulkActive}
                                className={`relative px-5 py-2.5 rounded-xl font-bold transition-all flex items-center gap-2 print:hidden cursor-pointer shadow-sm
                                    ${isBulkActive
                                        ? 'bg-indigo-400 text-white cursor-wait scale-95'
                                        : 'bg-indigo-600 text-white hover:bg-indigo-700 hover:shadow-indigo-200 hover:shadow-lg active:scale-95'
                                    }`}
                                style={{ minHeight: '44px' }}
                                aria-label="Print all class scorecards"
                            >
                                {isBulkActive ? (
                                    <><i className="fa-solid fa-spinner fa-spin"></i> Preparing…</>
                                ) : (
                                    <>
                                        <i className="fa-solid fa-layer-group"></i>
                                        Bulk Print
                                        <span className="ml-1 bg-white/25 text-white text-xs font-black px-2 py-0.5 rounded-full">
                                            {classStudents.length}
                                        </span>
                                    </>
                                )}
                            </button>
                        )}
                        {/* Individual Print Button */}
                        {selectedStudentData && (
                            <button
                                onClick={handlePrint}
                                className="px-5 py-2.5 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 hover:shadow-emerald-200 hover:shadow-lg transition-all flex items-center gap-2 print:hidden cursor-pointer active:scale-95 shadow-sm"
                                style={{ minHeight: '44px' }}
                                aria-label="Print student scorecard"
                            >
                                <i className="fa-solid fa-print"></i>
                                Print Scorecard
                            </button>
                        )}
                    </div>
                </div>

                {/* Selection Controls */}
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 print:hidden">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-2">Select Class</label>
                            <select
                                value={selectedClass}
                                onChange={e => setSelectedClass(e.target.value)}
                                className="w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 bg-slate-50 font-medium text-slate-800"
                                aria-label="Select class"
                            >
                                {allowedClasses.map(cls => <option key={cls} value={cls}>{cls}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-2">Select Student</label>
                            <select
                                value={selectedStudent}
                                onChange={e => setSelectedStudent(e.target.value)}
                                className="w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 bg-slate-50 font-medium text-slate-800"
                                aria-label="Select student"
                            >
                                <option value="">Choose a student</option>
                                {classStudents.map(s => (
                                    <option key={s.id} value={s.id}>{s.name} (Adm: {s.adNo})</option>
                                ))}
                            </select>
                        </div>
                    </div>
                    {classStudents.length === 0 && (
                        <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-2 text-amber-700">
                            <i className="fa-solid fa-triangle-exclamation"></i>
                            <span className="font-medium">No students found in class {selectedClass}</span>
                        </div>
                    )}
                </div>

                {/* Scorecard or placeholder */}
                {selectedStudentData ? (
                    <div className="animate-in fade-in slide-in-from-bottom-8 duration-700 print:animate-none">
                        <ScorecardPrintable
                            student={selectedStudentData}
                            activeTerm={activeTerm}
                            classSubjects={classSubjects}
                            branding={branding}
                            currentAcademicYear={currentAcademicYear}
                            currentSemester={currentSemester}
                            calculatedRank={displayRank}
                            seed={printSeedRef.current}
                        />
                    </div>
                ) : (
                    <div className="bg-white rounded-3xl p-16 shadow-sm border border-slate-200 text-center">
                        <div className="w-20 h-20 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
                            <i className="fa-solid fa-user-graduate text-3xl text-slate-400"></i>
                        </div>
                        <h3 className="text-xl font-black text-slate-900 mb-2">Select a Student</h3>
                        <p className="text-slate-500 text-sm">Choose a class and student above to view their official scorecard</p>
                    </div>
                )}
            </div>

            {/* ── Bulk print container — only mounted when bulk printing ─────── */}
            {isBulkActive && (
                <div className="hidden print:block m-0 p-0">
                    {classStudents.filter(s => {
                        const m = s.academicHistory?.[activeTerm]?.marks;
                        return m && Object.keys(m).length > 0;
                    }).map(student => {
                        const studentRank = rankedStudentsList.find(s => s.id === student.id)?.calculatedRank ?? '-';
                        return (
                            <div key={student.id} className="print:break-after-page print:pt-2">
                                <ScorecardPrintable
                                    student={student}
                                    activeTerm={activeTerm}
                                    classSubjects={classSubjects}
                                    branding={branding}
                                    currentAcademicYear={currentAcademicYear}
                                    currentSemester={currentSemester}
                                    calculatedRank={studentRank}
                                    seed={printSeedRef.current}
                                />
                            </div>
                        );
                    })}
                </div>
            )}
        </>
    );
};

// ─── ScorecardPrintable ───────────────────────────────────────────────────────
interface ScorecardPrintableProps {
    student: StudentRecord;
    activeTerm: string;
    classSubjects: SubjectConfig[];
    branding: any;
    currentAcademicYear: string;
    currentSemester: string;
    calculatedRank: string | number;
    seed: number;
}

const ScorecardPrintable: React.FC<ScorecardPrintableProps> = React.memo(({
    student, activeTerm, classSubjects, branding, currentAcademicYear, currentSemester, calculatedRank, seed
}) => {
    // Search history for matching term or legacy student marks
    const termRecord = student.academicHistory?.[activeTerm] || (student.marks ? {
        className: student.currentClass || student.className,
        semester: student.semester || 'Odd',
        marks: student.marks,
        grandTotal: student.grandTotal || 0,
        average: student.average || 0,
        performanceLevel: student.performanceLevel || 'Not Assessed',
        subjectMetadata: (student as any).subjectMetadata
    } : undefined);

    const marks = termRecord?.marks || {};
    const total = termRecord?.grandTotal || 0;
    const average = termRecord?.average || 0;
    const performance = termRecord?.performanceLevel || 'Not Assessed';
    const sClass = (termRecord?.className && termRecord.className !== 'Unknown') ? termRecord.className : (student.currentClass || student.className || '');

    const markVals = Object.values(marks) as any[];
    const passedCount = markVals.filter(m => m.status === 'Passed').length;
    const failedCount = markVals.filter(m => m.status === 'Failed').length;
    const highestScore = markVals.length > 0 ? Math.max(...markVals.map(m => m.total)) : 0;
    const lowestScore = markVals.length > 0 ? Math.min(...markVals.map(m => m.total)) : 0;

    // Calculate how many subjects this specific student is expected to take
    const expectedSubjectsCount = useMemo(() => {
        return classSubjects.filter(subj => 
            subj.subjectType !== 'elective' || (subj.enrolledStudents && subj.enrolledStudents.includes(student.id))
        ).length;
    }, [classSubjects, student.id]);

    // Only show subjects that have marks recorded (exclude un-assessed subjects)
    const sortedSubjects = useMemo(() => {
        return classSubjects
            .filter(subj => getMarkForSubject(marks, subj, termRecord?.subjectMetadata) != null)
            .sort((a, b) => {
                const markA = getMarkForSubject(marks, a, termRecord?.subjectMetadata);
                const markB = getMarkForSubject(marks, b, termRecord?.subjectMetadata);
                const aFailed = markA?.status === 'Failed';
                const bFailed = markB?.status === 'Failed';
                if (aFailed && !bFailed) return 1;
                if (!aFailed && bFailed) return -1;
                return 0;
            });
    }, [classSubjects, marks, termRecord]);

    // Computed max for percentage bar
    const totalMaxMarks = useMemo(() => {
        return sortedSubjects.reduce((acc, subj) => {
            const snap = termRecord?.subjectMetadata?.[subj.id];
            const { maxTotal } = getSubjectMaxMarks(subj, snap);
            return acc + maxTotal;
        }, 0);
    }, [sortedSubjects, termRecord]);
    const overallPercent = totalMaxMarks > 0 ? Math.round((total / totalMaxMarks) * 100) : 0;

    // Stable doc ID — uses prop seed so it doesn't change between renders
    const docId = makeDocId(student.adNo, seed);
    const verifyCode = btoa(student.adNo + seed.toString()).slice(0, 8).toUpperCase();
    const printDate = new Date(seed);

    return (
        <div className="print:a4-content">
            {/* ── Print-only header ─────────────────────────────────────── */}
            <div className="hidden print:block text-center print:mb-3">
                <div className="border-b-2 border-black print:pb-3 print:mb-3">
                    <div className="flex items-center justify-center gap-3 print:mb-1">
                        <img src="/aic-logo-web-dark.png" alt="AIC Da'wa College Logo" className="h-14 object-contain" />
                        <div className="text-left">
                            <div className="font-black text-base tracking-wider">{branding?.institutionName || 'INSTITUTION NAME'}</div>
                            <div className="text-[9px]">{branding?.institutionAddress || 'Virippadam, Akode, Vazhakkad, Malappuram, Kerala - 673640'}</div>
                        </div>
                    </div>
                    <div className="text-xs font-bold uppercase tracking-widest print:mt-1">Official Student Scorecard</div>
                    <div className="grid grid-cols-3 print:text-[9px] print:mt-1">
                        <div className="text-left">Session: <b>{currentAcademicYear}</b></div>
                        <div className="text-center">Official Transcript</div>
                        <div className="text-right">{printDate.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' })}</div>
                    </div>
                </div>
            </div>

            {/* ── Card wrapper ──────────────────────────────────────────── */}
            {/* NOTE: no break-inside-avoid here — let content flow naturally to avoid blank half-pages */}
            <div className="bg-white rounded-[2.5rem] overflow-hidden shadow-2xl border border-slate-100 print:shadow-none print:border print:border-black print:rounded-none print:overflow-visible">

                {/* ── Hero header ───────────────────────────────────────── */}
                <div className={`relative bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-900 p-10 text-white print:bg-white print:text-black print:p-2 print:border-b-2 print:border-black`}>
                    {/* Background decoration (screen only) */}
                    <div className="absolute inset-0 opacity-5 print:hidden" style={{
                        backgroundImage: 'radial-gradient(circle at 20% 50%, #10b981 0%, transparent 50%), radial-gradient(circle at 80% 20%, #6366f1 0%, transparent 50%)'
                    }}></div>

                    <div className="relative flex justify-between items-start flex-wrap gap-6 print:gap-1">
                        {/* Student info */}
                        <div>
                            <h2 className="text-3xl font-black tracking-tight mb-1 print:text-sm print:mb-0 print:leading-tight print:text-black print:hierarchy-primary">{student.name}</h2>
                            <div className="flex gap-3 items-center flex-wrap print:gap-1 print:text-[10px]">
                                <span className="px-3 py-1 bg-white/15 border border-white/25 rounded-lg text-xs font-black tracking-widest uppercase print:bg-transparent print:border-black print:text-black print:px-1 print:py-0 print:text-[10px] print:contrast-medium">
                                    {sClass}
                                </span>
                                <span className="text-emerald-300 text-sm font-semibold print:text-black print:text-[10px]">Adm: {student.adNo}</span>
                                <span className="text-slate-400 text-sm print:text-black print:text-[10px]">Term: {activeTerm}</span>
                            </div>
                        </div>

                        {/* Rank badge */}
                        <div className="text-right print:text-left">
                            <div className="text-[10px] uppercase tracking-[0.2em] text-white/50 mb-1 print:text-[8px] print:text-black print:mb-0">Class Rank</div>
                            <div className="text-6xl font-black text-white print:text-sm print:text-black print:leading-tight print:hierarchy-primary">
                                #{calculatedRank}
                            </div>
                        </div>
                    </div>

                    {/* Overall progress bar (screen only) */}
                    <div className="relative mt-6 print:hidden">
                        <div className="flex justify-between text-xs text-white/60 mb-1">
                            <span>Overall Score</span>
                            <span className="font-bold text-white">{total} / {totalMaxMarks} &nbsp;({overallPercent}%)</span>
                        </div>
                        <div className="h-2 bg-white/15 rounded-full overflow-hidden">
                            <div
                                className={`h-full rounded-full bg-gradient-to-r ${getGradeColor(performance)} transition-all duration-700`}
                                style={{ width: `${overallPercent}%` }}
                            ></div>
                        </div>
                    </div>
                </div>

                {/* ── Stats bar ─────────────────────────────────────────────── */}
                <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-slate-100 print:divide-black print:border-b print:border-black print:grid-cols-4">
                    {[
                        { label: 'Total Marks', value: String(total), accent: 'text-slate-900' },
                        { label: 'Average', value: `${typeof average === 'number' ? average.toFixed(1) : average}%`, accent: 'text-blue-600' },
                        { label: 'Subjects Cleared', value: `${passedCount}/${expectedSubjectsCount}`, accent: passedCount === expectedSubjectsCount ? 'text-emerald-600' : 'text-orange-500' },
                        { label: 'Class Rank', value: `#${calculatedRank}`, accent: calculatedRank === 1 ? 'text-amber-500' : 'text-slate-800' },
                    ].map(({ label, value, accent }) => (
                        <div key={label} className="p-6 text-center print:p-1">
                            <p className="text-[10px] uppercase font-bold text-slate-400 tracking-widest mb-2 print:text-[9px] print:mb-0 print:text-black print:hierarchy-tertiary">{label}</p>
                            <p className={`text-3xl font-black print:text-xs print:leading-tight print:text-black print:hierarchy-primary ${accent}`}>{value}</p>
                        </div>
                    ))}
                </div>

                {/* ── Grade badge (screen only) ───────────────────────────── */}
                <div className="px-10 py-6 flex items-center justify-between print:hidden border-b border-slate-100">
                    <div className="flex items-center gap-4">
                        <span className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl text-white text-sm font-black bg-gradient-to-r ${getGradeColor(performance)} shadow-lg`}>
                            <i className="fa-solid fa-certificate text-white/80"></i>
                            {performance}
                        </span>
                        {failedCount > 0 && (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs font-bold">
                                <i className="fa-solid fa-triangle-exclamation"></i>
                                {failedCount} subject{failedCount > 1 ? 's' : ''} failed
                            </span>
                        )}
                    </div>
                    <div className="text-right text-xs text-slate-400">
                        <div>Highest: <span className="font-bold text-slate-700">{highestScore}</span></div>
                        <div>Lowest: <span className="font-bold text-slate-700">{lowestScore}</span></div>
                    </div>
                </div>

                {/* ── Subject table ─────────────────────────────────────────── */}
                <div className="print:p-1 print:mt-3">
                    {classSubjects.length > 0 ? (
                        <div className="overflow-x-auto print:overflow-visible print:break-inside-auto">
                            <table className="w-full border-collapse print:table-compact" role="table" aria-label="Student subject-wise performance">
                                <thead>
                                    <tr className="text-[10px] uppercase text-slate-400 font-black tracking-[0.2em] bg-slate-50 print:bg-white print:text-black print:text-[9px] print:border-b-2 print:border-black">
                                        <th className="px-8 py-4 text-left print:px-1 print:py-1 print:border-r print:border-black">Subject</th>
                                        <th className="px-5 py-4 text-center print:px-1 print:py-1 print:border-r print:border-black">EXT</th>
                                        <th className="px-5 py-4 text-center print:px-1 print:py-1 print:border-r print:border-black">INT</th>
                                        <th className="px-5 py-4 text-center print:px-1 print:py-1 print:border-r print:border-black">Total</th>
                                        <th className="px-5 py-4 text-center print:px-1 print:py-1 print:border-r print:border-black">Max</th>
                                        <th className="px-8 py-4 text-center print:px-1 print:py-1">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50 print:divide-y print:divide-black">
                                    {sortedSubjects.map(subject => {
                                        const subjectMark = getMarkForSubject(marks, subject, termRecord?.subjectMetadata);
                                        const snap = termRecord?.subjectMetadata?.[subject.id];
                                        const subName = snap?.name || subject.name;
                                        const arabicName = snap?.arabicName || subject.arabicName;
                                        const faculty = snap?.facultyName || subject.facultyName;
                                        const { maxINT, maxEXT, maxTotal } = getSubjectMaxMarks(subject, snap);
                                        const pct = subjectMark ? Math.round((subjectMark.total / maxTotal) * 100) : 0;
                                        const isFailed = subjectMark?.status === 'Failed';

                                        return (
                                            <tr
                                                key={subject.id}
                                                className={`transition-colors ${isFailed ? 'bg-red-50/40 hover:bg-red-50 print:bg-white' : 'hover:bg-slate-50/50 print:bg-white'}`}
                                            >
                                                <td className="px-8 py-4 print:px-1 print:py-1 print:border-r print:border-black">
                                                    <div className="flex items-center gap-3 print:block">
                                                        {/* Color dot (screen only) */}
                                                        <div className={`w-2 h-2 rounded-full flex-shrink-0 print:hidden ${isFailed ? 'bg-red-400' : subjectMark ? 'bg-emerald-400' : 'bg-slate-300'}`}></div>
                                                        <div>
                                                            <p className="font-bold text-slate-800 tracking-tight print:text-[10px] print:text-black print:leading-tight">
                                                                {shortenSubjectName(subName)}
                                                                {subjectMark?.isSupplementary && (
                                                                    <span className="ml-1.5 px-1 py-0.5 border border-black rounded text-[6px] font-bold uppercase tracking-wider bg-slate-100 text-black inline-block align-middle print:text-[6px] print:border-black">
                                                                        {getSupplementaryLabel(subjectMark.applicationType)}
                                                                    </span>
                                                                )}
                                                            </p>
                                                            {arabicName && <p className="arabic-text text-base text-emerald-600 mt-0.5 print:text-[9px] print:text-black print:leading-tight">{arabicName}</p>}
                                                            {faculty && <p className="text-xs text-slate-400 mt-0.5 print:hidden">{faculty}</p>}
                                                            {/* Progress bar (screen only) */}
                                                            {subjectMark && (
                                                                <div className="mt-1.5 h-1 bg-slate-100 rounded-full overflow-hidden w-32 print:hidden">
                                                                    <div
                                                                        className={`h-full rounded-full ${isFailed ? 'bg-red-400' : 'bg-emerald-400'}`}
                                                                        style={{ width: `${pct}%` }}
                                                                    ></div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-5 py-4 text-center print:px-1 print:py-1 print:border-r print:border-black">
                                                    <div className="font-mono font-semibold text-slate-600 print:text-[10px] print:text-black flex items-center justify-center gap-1">
                                                        {maxINT === 100 || maxEXT === 0 ? (
                                                            <span className="text-xs text-slate-300 print:text-black">–</span>
                                                        ) : (
                                                            <>
                                                                {subjectMark?.isSupplementary && subjectMark?.previousMarks?.ext !== undefined && (
                                                                    <span className="text-[10px] text-red-400 line-through decoration-red-400/50 print:text-[8px] print:text-slate-500 print:decoration-slate-500">
                                                                        {subjectMark.previousMarks.ext}
                                                                    </span>
                                                                )}
                                                                <span>{subjectMark?.ext ?? <span className="text-slate-300">–</span>}<span className="text-xs text-slate-300 print:text-black">/{maxEXT}</span></span>
                                                            </>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-5 py-4 text-center print:px-1 print:py-1 print:border-r print:border-black">
                                                    <div className="font-mono font-semibold text-slate-600 print:text-[10px] print:text-black flex items-center justify-center gap-1">
                                                        {subjectMark?.isSupplementary && subjectMark?.previousMarks?.int !== undefined && (
                                                            <span className="text-[10px] text-red-400 line-through decoration-red-400/50 print:text-[8px] print:text-slate-500 print:decoration-slate-500">
                                                                {subjectMark.previousMarks.int}
                                                            </span>
                                                        )}
                                                        <span>{subjectMark?.int ?? <span className="text-slate-300">–</span>}<span className="text-xs text-slate-300 print:text-black">/{maxINT}</span></span>
                                                    </div>
                                                </td>
                                                <td className="px-5 py-4 text-center print:px-1 print:py-1 print:border-r print:border-black">
                                                    <div className={`flex items-baseline justify-center gap-1.5 text-xl font-black print:text-[10px] print:text-black print:leading-tight ${isFailed ? 'text-red-500' : 'text-slate-900'}`}>
                                                        {subjectMark?.isSupplementary && subjectMark?.previousMarks?.total !== undefined && (
                                                            <span className="text-sm text-red-400 font-bold line-through decoration-red-400/50 print:text-[8px] print:text-slate-500 print:decoration-slate-500">
                                                                {subjectMark.previousMarks.total}
                                                            </span>
                                                        )}
                                                        <span>{subjectMark?.total ?? <span className="text-lg text-slate-300">–</span>}</span>
                                                    </div>
                                                    {subjectMark && <div className="text-[10px] text-slate-400 print:hidden">{pct}%</div>}
                                                </td>
                                                <td className="px-5 py-4 text-center font-mono text-slate-400 text-sm print:px-1 print:py-1 print:text-[10px] print:text-black print:border-r print:border-black">
                                                    {maxTotal}
                                                </td>
                                                <td className="px-8 py-4 text-center print:px-1 print:py-1">
                                                    {subjectMark ? (
                                                        <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold
                                                            print:px-0 print:py-0 print:rounded-none print:text-[10px]
                                                            ${isFailed
                                                                ? 'bg-red-100 text-red-700 print:status-failed'
                                                                : 'bg-emerald-100 text-emerald-700 print:status-passed'}`}>
                                                            <i className={`fa-solid ${isFailed ? 'fa-circle-xmark' : 'fa-circle-check'} print:hidden`}></i>
                                                            {isFailed ? 'Failed' : 'Passed'}
                                                        </span>
                                                    ) : (
                                                        <span className="text-slate-300 text-xs print:text-black print:text-[10px]">—</span>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div className="p-12 text-center">
                            <i className="fa-solid fa-book-open text-4xl text-slate-200 mb-4"></i>
                            <p className="text-slate-400 text-sm font-medium">No subjects configured for this class</p>
                        </div>
                    )}
                </div>

                {/* ── Performance analysis cards (screen only) ──────────────── */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-10 border-t border-slate-100 print:hidden">
                    <div className="bg-gradient-to-br from-slate-50 to-slate-100/50 rounded-2xl p-6 border border-slate-100">
                        <h4 className="font-black text-slate-900 mb-4 flex items-center gap-2">
                            <i className="fa-solid fa-chart-simple text-slate-400"></i>
                            Performance Breakdown
                        </h4>
                        <div className="space-y-3">
                            {[
                                { label: 'Subjects Passed', val: passedCount, color: 'text-emerald-600' },
                                { label: 'Subjects Failed', val: failedCount, color: failedCount > 0 ? 'text-red-600' : 'text-slate-400' },
                                { label: 'Highest Marks', val: highestScore, color: 'text-slate-900' },
                                { label: 'Lowest Marks', val: lowestScore, color: 'text-slate-900' },
                            ].map(({ label, val, color }) => (
                                <div key={label} className="flex justify-between items-center">
                                    <span className="text-slate-500 text-sm">{label}</span>
                                    <span className={`font-bold ${color}`}>{val}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="bg-gradient-to-br from-emerald-50 to-teal-50/50 rounded-2xl p-6 border border-emerald-100">
                        <h4 className="font-black text-slate-900 mb-4 flex items-center gap-2">
                            <i className="fa-solid fa-trophy text-amber-400"></i>
                            Academic Standing
                        </h4>
                        <div className="space-y-3">
                            {[
                                { label: 'Class Position', val: `#${calculatedRank}`, color: 'text-slate-900' },
                                { label: 'Overall Grade', val: performance, color: getGradeTextColor(performance) },
                                { label: 'Completion', val: `${markVals.length > 0 ? Math.round((markVals.length / classSubjects.length) * 100) : 0}%`, color: 'text-slate-900' },
                            ].map(({ label, val, color }) => (
                                <div key={label} className="flex justify-between items-center">
                                    <span className="text-slate-500 text-sm">{label}</span>
                                    <span className={`font-bold ${color}`}>{val}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* ── Print footer ───────────────────────────────────────────── */}
                <div className="hidden print:block print:px-2 print:pb-2 print:pt-2 border-t-2 border-black">
                    <div className="grid grid-cols-3 gap-2 print:text-[9px]">
                        {/* Doc details */}
                        <div>
                            <div className="font-bold uppercase tracking-wider print:mb-0.5">Document Details</div>
                            <div>Generated: {printDate.toLocaleDateString('en-IN', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}</div>
                            <div>Time: {printDate.toLocaleTimeString('en-IN')}</div>
                            <div className="font-mono print:mt-0.5">{docId}</div>
                        </div>
                        {/* Signatures */}
                        <div className="text-center">
                            <div className="print:pb-5">
                                <div className="font-bold uppercase tracking-wider text-[8px]">Class Teacher</div>
                            </div>
                            <div className="print:pb-3">
                                <div className="font-bold uppercase tracking-wider text-[8px]">Controller of Examinations</div>
                            </div>
                        </div>
                        {/* Seal */}
                        <div className="text-right">
                            <div className="font-bold uppercase tracking-wider print:mb-0.5">Official Seal</div>
                            <div className="w-14 h-14 border-2 border-black rounded-full inline-flex items-center justify-center print:mb-0.5">
                                <span className="text-[8px] font-bold">SEAL</span>
                            </div>
                            <div>Code: <span className="font-mono">{verifyCode}</span></div>
                        </div>
                    </div>
                    <div className="border-t border-black print:mt-1 print:pt-1 text-center print:text-[8px]">
                        Official document from {branding?.institutionName || 'AIC Da\'wa Academy'} Examination System &nbsp;|&nbsp;
                        <span className="font-mono">https://exam.dawaacademy.in</span> &nbsp;|&nbsp;
                        <span>+91 96568 33399</span>
                    </div>
                </div>
            </div>
        </div>
    );
});

ScorecardPrintable.displayName = 'ScorecardPrintable';

export default React.memo(StudentScorecard);