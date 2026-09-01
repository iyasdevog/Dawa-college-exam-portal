import React, { useState, useEffect, useMemo } from 'react';
import { StudentRecord, SubjectConfig, ClassReleaseSettings } from '../../domain/entities/types';
import { useMobile } from '../hooks/useMobile';
import { isSameSubject, getSubjectMaxMarks } from '../../domain/utils/subjectUtils';
import { dataService } from '../../infrastructure/services/dataService';

interface AggregatedScorecardProps {
    student: StudentRecord;
    allSubjects: SubjectConfig[];
    onClose?: () => void;
    isPublicView?: boolean;
    releaseSettings?: ClassReleaseSettings;
}

const AggregatedScorecard: React.FC<AggregatedScorecardProps> = ({ 
    student, 
    allSubjects, 
    onClose,
    isPublicView = false,
    releaseSettings
}) => {
    const { isMobile } = useMobile();
    const [fetchedSettings, setFetchedSettings] = useState<ClassReleaseSettings | null>(null);

    useEffect(() => {
        if (isPublicView && !releaseSettings) {
            dataService.getReleaseSettings().then(s => setFetchedSettings(s || {})).catch(() => {});
        }
    }, [isPublicView, releaseSettings]);

    const effectiveSettings = releaseSettings || fetchedSettings || {};

    const isTermReleased = (termKey: string, className?: string) => {
        if (!isPublicView) return true; // Internal Admin/Teacher view shows all terms
        const cls = className || student.academicHistory?.[termKey]?.className || student.currentClass || student.className;
        if (!cls) return true;

        const settings = effectiveSettings[cls];
        if (!settings) return false;

        const regReleased = settings.isReleased || (settings.releaseDate ? new Date(settings.releaseDate) <= new Date() : false);
        const suppReleased = settings.isSupplementaryReleased || (settings.supplementaryReleaseDate ? new Date(settings.supplementaryReleaseDate) <= new Date() : false);

        return regReleased || suppReleased;
    };

    // Calculate aggregated statistics
    const aggregatedStats = useMemo(() => {
        if (!student.academicHistory) return null;

        let totalMarksObtained = 0;
        let totalMaxMarks = 0;
        let passedSubjects = 0;
        let failedSubjects = 0;
        let totalSubjectsCount = 0;

        const termKeys = Object.keys(student.academicHistory).sort();

        termKeys.forEach(termKey => {
            const termRecord = student.academicHistory![termKey];
            
            // Only aggregate if term results are released (or non-public view)
            if (!isTermReleased(termKey, termRecord.className)) {
                return;
            }

            const marksEntries = Object.entries(termRecord.marks || {});
            
            marksEntries.forEach(([subjectId, marks]) => {
                const sId = subjectId.toLowerCase().trim();
                const subject = allSubjects.find(s => s.id.toLowerCase().trim() === sId);
                if (subject) {
                    totalSubjectsCount++;
                    const { maxTotal } = getSubjectMaxMarks(subject);
                    totalMaxMarks += maxTotal;
                    totalMarksObtained += marks.total || 0;

                    if (marks.status === 'Passed') passedSubjects++;
                    if (marks.status === 'Failed') failedSubjects++;
                }
            });
        });

        // Add pending subjects from current semester/class if not already in history
        const currentClass = student.currentClass || student.className;
        if (currentClass) {
            const currentSubjects = allSubjects.filter(s => s.targetClasses?.includes(currentClass));
            const existingSubjectIds = new Set(
                Object.values(student.academicHistory)
                    .flatMap(h => Object.keys(h.marks || {}))
                    .map(id => id.toLowerCase().trim())
            );

            currentSubjects.forEach(s => {
                if (!existingSubjectIds.has(s.id.toLowerCase().trim())) {
                    totalSubjectsCount++;
                    const { maxTotal } = getSubjectMaxMarks(s);
                    totalMaxMarks += maxTotal;
                    // No marks obtained yet for pending subjects
                }
            });
        }

        const overallPercentage = totalMaxMarks > 0 ? (totalMarksObtained / totalMaxMarks) * 100 : 0;

        return {
            totalMarksObtained,
            totalMaxMarks,
            overallPercentage,
            passedSubjects,
            failedSubjects,
            totalSubjectsCount,
            termKeys
        };
    }, [student.academicHistory, allSubjects, effectiveSettings, isPublicView]);

    if (!student.academicHistory || !aggregatedStats) {
        return (
            <div className="p-8 text-center bg-slate-50 rounded-[2rem] border border-dashed border-slate-200">
                <p className="text-slate-400 font-bold uppercase text-xs tracking-widest">No academic history available for this student.</p>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-[2rem] shadow-xl border border-slate-200 overflow-hidden max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className={`bg-slate-900 border-b border-slate-800 shrink-0 print:bg-white print:border-b-2 print:border-black ${isMobile ? 'p-6' : 'p-8 flex items-center justify-between'}`}>
                <div>
                    <h2 className="text-3xl font-black text-white tracking-tight mb-2 print:text-black">
                        Aggregated Transcript
                    </h2>
                    <div className="flex flex-wrap items-center gap-4 text-emerald-400 font-medium">
                        <span>{student.name}</span>
                        <span className="text-slate-600 print:hidden">•</span>
                        <span>Ad No: {student.adNo}</span>
                        {student.currentClass && (
                            <>
                                <span className="text-slate-600 print:hidden">•</span>
                                <span>Class: {student.currentClass}</span>
                            </>
                        )}
                    </div>
                </div>
                {!isMobile && onClose && (
                    <div className="flex items-center gap-4 print:hidden">
                        <button onClick={() => window.print()} className="px-4 py-2 bg-slate-800 text-white rounded-xl hover:bg-slate-700 transition font-bold text-sm">
                            <i className="fa-solid fa-print mr-2"></i> Print
                        </button>
                        <button onClick={onClose} className="w-10 h-10 bg-slate-800 text-white rounded-xl hover:bg-rose-500 transition flex items-center justify-center">
                            <i className="fa-solid fa-xmark"></i>
                        </button>
                    </div>
                )}
                {isMobile && onClose && (
                    <div className="mt-4 flex gap-2 print:hidden">
                        <button onClick={() => window.print()} className="flex-1 py-2 bg-slate-800 text-white rounded-xl hover:bg-slate-700 transition font-bold text-sm">
                            <i className="fa-solid fa-print mr-2"></i> Print
                        </button>
                        <button onClick={onClose} className="flex-1 py-2 bg-slate-800 text-white rounded-xl hover:bg-rose-500 transition font-bold text-sm">
                            <i className="fa-solid fa-xmark mr-2"></i> Close
                        </button>
                    </div>
                )}
            </div>

            <div className="overflow-y-auto p-4 md:p-8 space-y-8 flex-1 print:p-0">
                {/* Overall Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-slate-100/50 p-4 rounded-2xl border border-slate-200/50 text-center shadow-sm">
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Overall Percentage</p>
                        <p className="text-2xl font-black text-slate-900">{typeof aggregatedStats.overallPercentage === 'number' ? aggregatedStats.overallPercentage.toFixed(2) : (aggregatedStats.overallPercentage ?? '0.00')}%</p>
                    </div>
                    <div className="bg-slate-100/50 p-4 rounded-2xl border border-slate-200/50 text-center shadow-sm">
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Total Marks</p>
                        <p className="text-2xl font-black text-slate-900">{aggregatedStats.totalMarksObtained} / {aggregatedStats.totalMaxMarks}</p>
                    </div>
                    <div className="bg-slate-100/50 p-4 rounded-2xl border border-slate-200/50 text-center shadow-sm">
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Subjects</p>
                        <p className="text-2xl font-black text-slate-900">{aggregatedStats.totalSubjectsCount}</p>
                    </div>
                    <div className="bg-slate-100/50 p-4 rounded-2xl border border-slate-200/50 text-center shadow-sm">
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Passed / Failed</p>
                        <p className="text-2xl font-black text-emerald-700">{aggregatedStats.passedSubjects} <span className="text-slate-300">/</span> <span className="text-red-700">{aggregatedStats.failedSubjects}</span></p>
                    </div>
                </div>

                {/* Term Details */}
                <div className="space-y-8">
                    {/* Render historical terms */}
                    {aggregatedStats.termKeys.map(termKey => {
                        const termRecord = student.academicHistory![termKey];

                        if (!isTermReleased(termKey, termRecord.className)) {
                            return (
                                <div key={termKey} className="border-2 border-amber-200/60 bg-amber-50/40 rounded-3xl p-6 text-center print:hidden">
                                    <div className="w-10 h-10 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-2 shadow-sm">
                                        <i className="fa-solid fa-lock text-base"></i>
                                    </div>
                                    <h3 className="font-black text-slate-800 text-base">{termKey}</h3>
                                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Class: {termRecord.className}</p>
                                    <p className="text-xs text-amber-700 font-medium bg-amber-100/60 py-1.5 px-4 rounded-full inline-block">
                                        Official results for this semester have not been published yet.
                                    </p>
                                </div>
                            );
                        }

                        const termMarks = { ...(termRecord.marks || {}) };
                        
                        // Merge supplementary marks for this term if present
                        if (student.supplementaryExams) {
                            const termSupps = student.supplementaryExams.filter(su => 
                                su.marks && 
                                (su.originalTerm?.toLowerCase().trim() === termKey.toLowerCase().trim() || 
                                 su.examTerm?.toLowerCase().trim() === termKey.toLowerCase().trim())
                            );
                            
                            termSupps.forEach(su => {
                                if (su.marks) {
                                    // Use robust matching to find the correct subject ID in termRecord.marks
                                    const matchingOriginalSubjectId = Object.keys(termRecord.marks || {}).find(origId => 
                                        isSameSubject(origId, allSubjects.find(s => s.id === origId)?.name, su.subjectId, su.subjectName)
                                    );
                                    
                                    const targetId = matchingOriginalSubjectId || su.subjectId;
                                    
                                    termMarks[targetId] = {
                                        ...su.marks,
                                        isSupplementary: true,
                                        previousMarks: termRecord.marks?.[targetId] || su.previousMarks
                                    } as any;
                                }
                            });
                        }

                        const subjectMarks = Object.entries(termMarks);

                        return (
                            <div key={termKey} className="border-2 border-slate-100 rounded-3xl overflow-hidden print:border-none print:mb-8">
                                <div className="bg-slate-50 p-4 border-b border-slate-100 flex items-center justify-between">
                                    <div>
                                        <h3 className="font-black text-slate-800 text-lg">{termKey}</h3>
                                        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Class: {termRecord.className}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="font-black text-emerald-600">{typeof termRecord.average === 'number' ? termRecord.average.toFixed(1) : termRecord.average}%</p>
                                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">{termRecord.performanceLevel}</p>
                                    </div>
                                </div>
                                <div className="p-4 bg-white">
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-left text-sm">
                                            <thead>
                                                <tr className="text-slate-500 border-b border-slate-200 uppercase tracking-wider text-[10px] print:text-black">
                                                    <th className="pb-2 font-black">Subject</th>
                                                    <th className="pb-2 font-black text-center">Ext</th>
                                                    <th className="pb-2 font-black text-center">Int</th>
                                                    <th className="pb-2 font-black text-center">Total</th>
                                                    <th className="pb-2 font-black text-right">Status</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-50">
                                                {subjectMarks.map(([subjectId, marks]) => {
                                                    const sId = subjectId.toLowerCase().trim();
                                                    const subject = allSubjects.find(s => s.id.toLowerCase().trim() === sId);
                                                    if (!subject) return null;
                                                    return (
                                                        <tr key={subjectId} className="border-b border-slate-50 last:border-0">
                                                            <td className="py-3 font-bold text-slate-900">
                                                                <div className="flex flex-col">
                                                                    <div className="flex items-center gap-2">
                                                                        {subject.name}
                                                                        {marks.isSupplementary && (
                                                                            <span className="bg-orange-100 text-orange-800 text-[8px] px-1.5 py-0.5 rounded uppercase tracking-widest font-black shadow-sm">Supp</span>
                                                                        )}
                                                                    </div>
                                                                    {marks.isSupplementary && marks.previousMarks && (
                                                                        <span className="text-[9px] text-slate-400 font-bold uppercase tracking-tight mt-0.5">
                                                                            Prev: {marks.previousMarks.total} (E:{marks.previousMarks.ext} I:{marks.previousMarks.int})
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </td>
                                                            <td className="py-3 text-center text-slate-800 font-black">{marks.ext}</td>
                                                            <td className="py-3 text-center text-slate-800 font-black">{marks.int}</td>
                                                            <td className="py-3 text-center font-black text-slate-900 text-base">{marks.total}</td>
                                                            <td className="py-3 text-right">
                                                                <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-md ${marks.status === 'Passed' ? 'bg-emerald-50 text-emerald-800 border border-emerald-100' : 'bg-red-50 text-red-800 border border-red-100'}`}>
                                                                    {marks.status}
                                                                </span>
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        );
                    })}

                    {/* Render pending subjects for current semester if applicable */}
                    {(() => {
                        const currentClass = student.currentClass || student.className;
                        if (!currentClass) return null;

                        const existingSubjectIds = new Set(
                            Object.values(student.academicHistory || {})
                                .flatMap(h => Object.keys(h.marks || {}))
                                .map(id => id.toLowerCase().trim())
                        );
                        
                        const pendingSubjectsForCurrent = allSubjects.filter(s => 
                            s.targetClasses?.includes(currentClass) && 
                            !existingSubjectIds.has(s.id.toLowerCase().trim())
                        );

                        if (pendingSubjectsForCurrent.length === 0) return null;

                        return (
                            <div className="border-2 border-slate-100 border-dashed rounded-3xl overflow-hidden print:mb-8">
                                <div className="bg-slate-50/50 p-4 border-b border-slate-100 flex items-center justify-between">
                                    <div>
                                        <h3 className="font-black text-slate-400 text-lg flex items-center gap-2">
                                            Current Semester
                                            <span className="bg-slate-200 text-slate-500 text-[9px] px-2 py-0.5 rounded uppercase tracking-widest font-bold">Pending</span>
                                        </h3>
                                        <p className="text-xs font-bold text-slate-300 uppercase tracking-wider">Class: {currentClass}</p>
                                    </div>
                                </div>
                                <div className="p-4 bg-white/50">
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-left text-sm opacity-60">
                                            <thead>
                                                <tr className="text-slate-300 border-b border-slate-100 uppercase tracking-wider text-[10px]">
                                                    <th className="pb-2 font-black">Subject</th>
                                                    <th className="pb-2 font-black text-center">External</th>
                                                    <th className="pb-2 font-black text-center">Internal</th>
                                                    <th className="pb-2 font-black text-center">Total</th>
                                                    <th className="pb-2 font-black text-right">Status</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-50">
                                                {pendingSubjectsForCurrent.map(subject => (
                                                    <tr key={subject.id}>
                                                        <td className="py-2 font-bold text-slate-400">{subject.name}</td>
                                                        <td className="py-2 text-center">-</td>
                                                        <td className="py-2 text-center">-</td>
                                                        <td className="py-2 text-center">-</td>
                                                        <td className="py-2 text-right">
                                                            <span className="text-[10px] font-black uppercase text-slate-300">Pending</span>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        );
                    })()}
                </div>
            </div>
        </div>
    );
};

export default AggregatedScorecard;
