import React, { useMemo } from 'react';
import { StudentRecord, SubjectConfig } from '../../domain/entities/types';
import { useMobile } from '../hooks/useMobile';

interface AggregatedScorecardProps {
    student: StudentRecord;
    allSubjects: SubjectConfig[];
    onClose?: () => void;
}

const AggregatedScorecard: React.FC<AggregatedScorecardProps> = ({ student, allSubjects, onClose }) => {
    const { isMobile } = useMobile();

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
            const marksEntries = Object.entries(termRecord.marks || {});
            
            marksEntries.forEach(([subjectId, marks]) => {
                const subject = allSubjects.find(s => s.id === subjectId);
                if (subject) {
                    totalSubjectsCount++;
                    const maxTotal = (subject.maxINT || 0) + (subject.maxEXT || 0);
                    totalMaxMarks += maxTotal;
                    totalMarksObtained += marks.total || 0;

                    if (marks.status === 'Passed') passedSubjects++;
                    if (marks.status === 'Failed') failedSubjects++;
                }
            });
        });

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
    }, [student.academicHistory, allSubjects]);

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
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 text-center">
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Overall Percentage</p>
                        <p className="text-2xl font-black text-slate-800">{aggregatedStats.overallPercentage.toFixed(2)}%</p>
                    </div>
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 text-center">
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Total Marks</p>
                        <p className="text-2xl font-black text-slate-800">{aggregatedStats.totalMarksObtained} / {aggregatedStats.totalMaxMarks}</p>
                    </div>
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 text-center">
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Subjects</p>
                        <p className="text-2xl font-black text-slate-800">{aggregatedStats.totalSubjectsCount}</p>
                    </div>
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 text-center">
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Passed / Failed</p>
                        <p className="text-2xl font-black text-emerald-600">{aggregatedStats.passedSubjects} <span className="text-slate-300">/</span> <span className="text-rose-500">{aggregatedStats.failedSubjects}</span></p>
                    </div>
                </div>

                {/* Term Details */}
                <div className="space-y-8">
                    {aggregatedStats.termKeys.map(termKey => {
                        const termRecord = student.academicHistory![termKey];
                        const subjectMarks = Object.entries(termRecord.marks || {});

                        return (
                            <div key={termKey} className="border-2 border-slate-100 rounded-3xl overflow-hidden print:border-none print:mb-8">
                                <div className="bg-slate-50 p-4 border-b border-slate-100 flex items-center justify-between">
                                    <div>
                                        <h3 className="font-black text-slate-800 text-lg">{termKey}</h3>
                                        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Class: {termRecord.className}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="font-black text-emerald-600">{termRecord.average.toFixed(1)}%</p>
                                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">{termRecord.performanceLevel}</p>
                                    </div>
                                </div>
                                <div className="p-4 bg-white">
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-left text-sm">
                                            <thead>
                                                <tr className="text-slate-400 border-b border-slate-100 uppercase tracking-wider text-[10px]">
                                                    <th className="pb-2 font-black">Subject</th>
                                                    <th className="pb-2 font-black text-center">EXT</th>
                                                    <th className="pb-2 font-black text-center">INT</th>
                                                    <th className="pb-2 font-black text-center">Total</th>
                                                    <th className="pb-2 font-black text-right">Status</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-50">
                                                {subjectMarks.map(([subjectId, marks]) => {
                                                    const subject = allSubjects.find(s => s.id === subjectId);
                                                    if (!subject) return null;
                                                    return (
                                                        <tr key={subjectId}>
                                                            <td className="py-2 font-bold text-slate-700">
                                                                {subject.name}
                                                                {marks.isSupplementary && (
                                                                    <span className="ml-2 bg-orange-100 text-orange-700 text-[9px] px-1.5 py-0.5 rounded uppercase tracking-widest font-bold">Supp</span>
                                                                )}
                                                            </td>
                                                            <td className="py-2 text-center text-slate-500">{marks.ext}</td>
                                                            <td className="py-2 text-center text-slate-500">{marks.int}</td>
                                                            <td className="py-2 text-center font-bold text-slate-800">{marks.total}</td>
                                                            <td className="py-2 text-right">
                                                                <span className={`text-[10px] font-black uppercase tracking-wider ${marks.status === 'Passed' ? 'text-emerald-500' : 'text-rose-500'}`}>
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
                </div>
            </div>
        </div>
    );
};

export default AggregatedScorecard;
