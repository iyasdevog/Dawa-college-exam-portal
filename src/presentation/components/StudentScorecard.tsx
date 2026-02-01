import React, { useState, useEffect } from 'react';
import { StudentRecord, SubjectConfig } from '../../domain/entities/types';
import { CLASSES } from '../../domain/entities/constants';
import { dataService } from '../../infrastructure/services/dataService';

const StudentScorecard: React.FC = () => {
    const [selectedClass, setSelectedClass] = useState('S1');
    const [selectedStudent, setSelectedStudent] = useState('');
    const [students, setStudents] = useState<StudentRecord[]>([]);
    const [classStudents, setClassStudents] = useState<StudentRecord[]>([]);
    const [subjects, setSubjects] = useState<SubjectConfig[]>([]);
    const [classSubjects, setClassSubjects] = useState<SubjectConfig[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        loadData();
    }, []);

    useEffect(() => {
        if (selectedClass) {
            loadClassData();
        }
    }, [selectedClass, subjects]);

    const loadData = async () => {
        try {
            setIsLoading(true);
            const [allStudents, allSubjects] = await Promise.all([
                dataService.getAllStudents(),
                dataService.getAllSubjects()
            ]);
            setStudents(allStudents);
            setSubjects(allSubjects);
        } catch (error) {
            console.error('Error loading data:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const loadClassData = async () => {
        try {
            const classStudents = await dataService.getStudentsByClass(selectedClass);
            setClassStudents(classStudents);

            // Reset selected student if not in new class
            if (selectedStudent && !classStudents.find(s => s.id === selectedStudent)) {
                setSelectedStudent('');
            }

            // Filter subjects for this class
            const filteredSubjects = subjects.filter(s => s.targetClasses.includes(selectedClass));
            setClassSubjects(filteredSubjects);
        } catch (error) {
            console.error('Error loading class data:', error);
        }
    };

    const handlePrint = () => {
        window.print();
    };

    const selectedStudentData = classStudents.find(s => s.id === selectedStudent);

    // Calculate additional statistics for the selected student
    const studentStats = selectedStudentData ? {
        totalSubjects: classSubjects.length,
        completedSubjects: Object.keys(selectedStudentData.marks).length,
        passedSubjects: Object.values(selectedStudentData.marks).filter((m: any) => m.status === 'Passed').length,
        failedSubjects: Object.values(selectedStudentData.marks).filter((m: any) => m.status === 'Failed').length,
        highestScore: Math.max(...Object.values(selectedStudentData.marks).map((m: any) => m.total), 0),
        lowestScore: Math.min(...Object.values(selectedStudentData.marks).map((m: any) => m.total), 0)
    } : null;

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
        <div className="space-y-8 print:space-y-0 print:m-0 print:p-0">
            {/* Header - Hidden on Print */}
            <div className="flex items-center justify-between print:hidden">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight">Student Scorecard</h1>
                    <p className="text-slate-600 mt-2">Individual student performance analysis and detailed scorecard</p>
                </div>
                {selectedStudentData && (
                    <button
                        onClick={handlePrint}
                        className="px-4 py-2 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-all flex items-center gap-2 print:hidden"
                        style={{ minHeight: '44px' }}
                        aria-label="Print student scorecard"
                    >
                        <i className="fa-solid fa-print"></i>
                        Print Scorecard
                    </button>
                )}
            </div>

            {/* Selection Controls - Hidden on Print */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 print:hidden">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">Select Class</label>
                        <select
                            value={selectedClass}
                            onChange={(e) => setSelectedClass(e.target.value)}
                            className="w-full p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 print:hidden"
                            aria-label="Select class to view scorecards"
                            aria-describedby="class-selection-help"
                        >
                            {CLASSES.map(cls => (
                                <option key={cls} value={cls}>{cls}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">Select Student</label>
                        <select
                            value={selectedStudent}
                            onChange={(e) => setSelectedStudent(e.target.value)}
                            className="w-full p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 print:hidden"
                            aria-label="Select student to view scorecard"
                            aria-describedby="student-selection-help"
                        >
                            <option value="">Choose a student</option>
                            {classStudents.map(student => (
                                <option key={student.id} value={student.id}>
                                    {student.name} (Adm: {student.adNo})
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                {classStudents.length === 0 && (
                    <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-xl">
                        <div className="flex items-center gap-2 text-amber-700">
                            <i className="fa-solid fa-exclamation-triangle"></i>
                            <span className="font-medium">No students found in class {selectedClass}</span>
                        </div>
                    </div>
                )}
            </div>

            {/* Student Scorecard */}
            {selectedStudentData ? (
                <div className="animate-in fade-in slide-in-from-bottom-8 duration-700 print:animate-none">
                    {/* Enhanced Official Print Header - Visible only on Print */}
                    <div className="hidden print:block text-center print:mb-6 print:break-inside-avoid print:keep-with-next">
                        <div className="border-b-4 border-black print:pb-4 print:mb-4 print:a4-content">
                            {/* College Logo/Emblem Area */}
                            <div className="print:mb-3">
                                <div className="w-16 h-16 mx-auto border-2 border-black rounded-full flex items-center justify-center print:mb-2">
                                    <span className="text-black font-bold text-lg">AIC</span>
                                </div>
                            </div>

                            {/* Official College Header */}
                            <h1 className="print:text-2xl font-black text-black print:mb-2 print:leading-tight tracking-wider">
                                AIC DA'WA COLLEGE
                            </h1>
                            <div className="print:text-sm text-black print:mb-2 print:leading-tight font-semibold">
                                Affiliated to University of Calicut | NAAC Accredited
                            </div>
                            <div className="print:text-xs text-black print:mb-3 print:leading-tight">
                                Melattur, Malappuram District, Kerala - 676517
                            </div>

                            {/* Document Title */}
                            <h2 className="print:text-lg font-bold text-black print:mb-2 print:leading-tight uppercase tracking-widest">
                                OFFICIAL STUDENT SCORECARD
                            </h2>

                            {/* Academic Session and Generation Info */}
                            <div className="grid grid-cols-3 gap-4 print:text-xs text-black print:leading-tight">
                                <div className="text-left">
                                    <div className="font-bold">Academic Session:</div>
                                    <div>2024-25</div>
                                </div>
                                <div className="text-center">
                                    <div className="font-bold">Document Type:</div>
                                    <div>Official Transcript</div>
                                </div>
                                <div className="text-right">
                                    <div className="font-bold">Generated:</div>
                                    <div>{new Date().toLocaleDateString('en-IN', {
                                        day: '2-digit',
                                        month: '2-digit',
                                        year: 'numeric'
                                    })}</div>
                                    <div>{new Date().toLocaleTimeString('en-IN', {
                                        hour: '2-digit',
                                        minute: '2-digit'
                                    })}</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white rounded-[3rem] overflow-hidden shadow-2xl border border-slate-200 print:shadow-none print:border-0 print:rounded-none print:bg-white print:a4-content">
                        {/* Header */}
                        <div className="bg-gradient-to-r from-slate-900 to-emerald-800 p-12 text-white print:bg-white print:text-black print:p-2 print:border-b-2 print:border-black print:break-inside-avoid print:keep-together print:contrast-high">
                            <div className="flex justify-between items-start flex-wrap gap-8 print:gap-2">
                                <div>
                                    <h3 className="text-4xl font-black tracking-tighter mb-2 print:text-sm print:text-black print:mb-1 print:leading-tight print:hierarchy-primary">{selectedStudentData.name}</h3>
                                    <div className="flex gap-4 items-center flex-wrap print:gap-1 print:text-xs">
                                        <span className="px-4 py-2 bg-white/20 rounded-lg text-[10px] font-black tracking-widest uppercase print:bg-white print:border print:border-black print:text-black print:px-1 print:py-0 print:text-xs print:leading-tight print:contrast-medium">
                                            {selectedStudentData.className}
                                        </span>
                                        <span className="text-emerald-300 font-bold text-sm print:text-black print:text-xs print:leading-tight print:hierarchy-secondary">
                                            Admission: {selectedStudentData.adNo}
                                        </span>
                                        <span className="text-emerald-300 font-bold text-sm print:text-black print:text-xs print:leading-tight print:hierarchy-secondary">
                                            Semester: {selectedStudentData.semester}
                                        </span>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <span className="text-[9px] uppercase font-black tracking-[0.3em] text-white/60 mb-2 block print:text-black print:text-xs print:mb-0 print:leading-tight print:hierarchy-tertiary">
                                        Class Rank
                                    </span>
                                    <span className="text-5xl font-black text-emerald-300 print:text-lg print:text-black print:leading-tight print:hierarchy-primary">
                                        #{selectedStudentData.rank}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Performance Summary */}
                        <div className="p-12 print:p-2 print:break-inside-avoid print:keep-together">
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-12 print:grid-cols-4 print:gap-2 print:mb-3 print:break-inside-avoid">
                                <div className="bg-slate-50 p-8 rounded-[2rem] border border-slate-100 text-center print:p-1 print:rounded-none print:border-black print:bg-white print:contrast-medium">
                                    <p className="text-[10px] uppercase font-black text-slate-400 mb-2 tracking-widest print:text-black print:text-xs print:mb-0 print:leading-tight print:hierarchy-tertiary">Total Marks</p>
                                    <p className="text-4xl font-black text-slate-900 print:text-sm print:text-black print:leading-tight print:hierarchy-primary">{selectedStudentData.grandTotal}</p>
                                </div>
                                <div className="bg-slate-50 p-8 rounded-[2rem] border border-slate-100 text-center print:p-1 print:rounded-none print:border-black print:bg-white print:contrast-medium">
                                    <p className="text-[10px] uppercase font-black text-slate-400 mb-2 tracking-widest print:text-black print:text-xs print:mb-0 print:leading-tight print:hierarchy-tertiary">Average Percentage</p>
                                    <p className="text-4xl font-black text-slate-900 print:text-sm print:text-black print:leading-tight print:hierarchy-primary">{selectedStudentData.average.toFixed(1)}%</p>
                                </div>
                                <div className="bg-slate-50 p-8 rounded-[2rem] border border-slate-100 text-center print:p-1 print:rounded-none print:border-black print:bg-white print:contrast-medium">
                                    <p className="text-[10px] uppercase font-black text-slate-400 mb-2 tracking-widest print:text-black print:text-xs print:mb-0 print:leading-tight print:hierarchy-tertiary">Grade</p>
                                    <p className={`text-4xl font-black print:text-sm print:leading-tight ${selectedStudentData.performanceLevel === 'Failed' ? 'text-red-500 print:performance-failed' :
                                        selectedStudentData.performanceLevel === 'Excellent' ? 'text-emerald-500 print:performance-excellent' :
                                            selectedStudentData.performanceLevel === 'Good' ? 'text-blue-500 print:performance-good' :
                                                selectedStudentData.performanceLevel === 'Average' ? 'text-amber-500 print:performance-average' :
                                                    'text-orange-500 print:performance-needs-improvement'
                                        }`}>
                                        {selectedStudentData.performanceLevel}
                                    </p>
                                </div>
                                <div className="bg-slate-50 p-8 rounded-[2rem] border border-slate-100 text-center print:p-1 print:rounded-none print:border-black print:bg-white print:contrast-medium">
                                    <p className="text-[10px] uppercase font-black text-slate-400 mb-2 tracking-widest print:text-black print:text-xs print:mb-0 print:leading-tight print:hierarchy-tertiary">Subjects</p>
                                    <p className="text-4xl font-black text-slate-900 print:text-sm print:text-black print:leading-tight print:hierarchy-primary">
                                        {studentStats?.passedSubjects}/{studentStats?.totalSubjects}
                                    </p>
                                </div>
                            </div>

                            {/* Subject-wise Performance */}
                            {classSubjects.length > 0 ? (
                                <div className="overflow-x-auto rounded-[2rem] border border-slate-100 print:border-black print:rounded-none print:table-keep-together print:break-inside-avoid">
                                    <table className="w-full border-collapse print:table-compact" role="table" aria-label="Student subject-wise performance">
                                        <thead className="print:keep-with-next">
                                            <tr className="text-[10px] uppercase text-slate-400 font-black tracking-[0.2em] bg-slate-50 print:bg-white print:text-black print:text-xs print:border-b-2 print:border-black print:break-inside-avoid" role="row">
                                                <th className="px-8 py-6 text-left print:px-1 print:py-1 print:border-r print:border-black print:leading-tight print:table-cell-padding" role="columnheader" scope="col">Subject</th>
                                                <th className="px-6 py-6 text-center print:px-1 print:py-1 print:border-r print:border-black print:leading-tight print:table-cell-padding" role="columnheader" scope="col">TA</th>
                                                <th className="px-6 py-6 text-center print:px-1 print:py-1 print:border-r print:border-black print:leading-tight print:table-cell-padding" role="columnheader" scope="col">CE</th>
                                                <th className="px-6 py-6 text-center print:px-1 print:py-1 print:border-r print:border-black print:leading-tight print:table-cell-padding" role="columnheader" scope="col">Total</th>
                                                <th className="px-6 py-6 text-center print:px-1 print:py-1 print:border-r print:border-black print:leading-tight print:table-cell-padding" role="columnheader" scope="col">Max</th>
                                                <th className="px-6 py-6 text-center print:px-1 print:py-1 print:leading-tight print:table-cell-padding" role="columnheader" scope="col">Status</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-50 print:divide-black">
                                            {classSubjects.map(subject => {
                                                const marks = selectedStudentData.marks[subject.id];
                                                const maxTotal = subject.maxTA + subject.maxCE;
                                                const percentage = marks ? Math.round((marks.total / maxTotal) * 100) : 0;

                                                return (
                                                    <tr key={subject.id} className="hover:bg-slate-50/50 transition-colors print:hover:bg-transparent print:table-row-keep-together print:break-inside-avoid" role="row">
                                                        <td className="px-8 py-6 print:px-1 print:py-1 print:border-r print:border-black print:table-cell-padding" role="cell">
                                                            <p className="font-black text-slate-800 text-lg tracking-tight print:text-xs print:text-black print:leading-tight">
                                                                {subject.name}
                                                            </p>
                                                            {subject.arabicName && (
                                                                <p className="arabic-text text-xl text-emerald-600 leading-none mt-1 print:text-xs print:text-black print:leading-tight">
                                                                    {subject.arabicName}
                                                                </p>
                                                            )}
                                                            {subject.facultyName && (
                                                                <p className="text-xs text-slate-500 mt-1 print:hidden">
                                                                    {subject.facultyName}
                                                                </p>
                                                            )}
                                                        </td>
                                                        <td className="px-6 py-6 text-center print:px-1 print:py-1 print:border-r print:border-black print:table-cell-padding" role="cell">
                                                            <div className="font-mono font-bold text-slate-500 print:text-xs print:text-black print:leading-tight" aria-label={`TA marks: ${marks?.ta ?? 'Not assessed'} out of ${subject.maxTA}`}>
                                                                {marks?.ta ?? '-'}
                                                                <span className="text-xs text-slate-400 print:text-black">/{subject.maxTA}</span>
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-6 text-center print:px-1 print:py-1 print:border-r print:border-black print:table-cell-padding" role="cell">
                                                            <div className="font-mono font-bold text-slate-500 print:text-xs print:text-black print:leading-tight" aria-label={`CE marks: ${marks?.ce ?? 'Not assessed'} out of ${subject.maxCE}`}>
                                                                {marks?.ce ?? '-'}
                                                                <span className="text-xs text-slate-400 print:text-black">/{subject.maxCE}</span>
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-6 text-center print:px-1 print:py-1 print:border-r print:border-black print:table-cell-padding">
                                                            <div className={`font-black text-2xl print:text-xs print:text-black print:leading-tight ${marks?.status === 'Failed' ? 'text-red-500' : 'text-slate-900'
                                                                }`}>
                                                                {marks?.total ?? '-'}
                                                            </div>
                                                            {marks && (
                                                                <div className="text-xs text-slate-500 print:hidden">
                                                                    {percentage}%
                                                                </div>
                                                            )}
                                                        </td>
                                                        <td className="px-6 py-6 text-center font-mono text-slate-400 print:px-1 print:py-1 print:text-xs print:text-black print:border-r print:border-black print:leading-tight print:table-cell-padding">
                                                            {maxTotal}
                                                        </td>
                                                        <td className="px-6 py-6 text-center print:px-1 print:py-1 print:table-cell-padding">
                                                            {marks ? (
                                                                <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider print:px-0 print:py-0 print:rounded-none print:text-xs print:leading-tight ${marks.status === 'Passed'
                                                                    ? 'bg-emerald-100 text-emerald-700 print:status-passed'
                                                                    : 'bg-red-100 text-red-700 print:status-failed'
                                                                    }`}>
                                                                    {marks.status}
                                                                </span>
                                                            ) : (
                                                                <span className="text-slate-400 text-xs print:text-black print:text-xs print:leading-tight print:hierarchy-body">Not Assessed</span>
                                                            )}
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                <div className="p-12 text-center bg-slate-50 rounded-[2rem] border border-dashed border-slate-200">
                                    <i className="fa-solid fa-book-open text-4xl text-slate-300 mb-4"></i>
                                    <p className="text-slate-400 font-bold uppercase text-xs tracking-widest">
                                        No subjects configured for this class
                                    </p>
                                </div>
                            )}

                            {/* Performance Analysis - Hidden on Print */}
                            {studentStats && (
                                <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-8 print:hidden">
                                    <div className="bg-slate-50 rounded-[2rem] p-8">
                                        <h4 className="font-black text-slate-900 mb-4 text-lg">Performance Breakdown</h4>
                                        <div className="space-y-3">
                                            <div className="flex justify-between">
                                                <span className="text-slate-600">Subjects Passed:</span>
                                                <span className="font-bold text-emerald-600">{studentStats.passedSubjects}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-slate-600">Subjects Failed:</span>
                                                <span className="font-bold text-red-600">{studentStats.failedSubjects}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-slate-600">Highest Marks:</span>
                                                <span className="font-bold text-slate-900">{studentStats.highestScore}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-slate-600">Lowest Marks:</span>
                                                <span className="font-bold text-slate-900">{studentStats.lowestScore}</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="bg-slate-50 rounded-[2rem] p-8">
                                        <h4 className="font-black text-slate-900 mb-4 text-lg">Academic Standing</h4>
                                        <div className="space-y-3">
                                            <div className="flex justify-between">
                                                <span className="text-slate-600">Class Position:</span>
                                                <span className="font-bold text-slate-900">#{selectedStudentData.rank}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-slate-600">Overall Grade:</span>
                                                <span className={`font-bold ${selectedStudentData.performanceLevel === 'Failed' ? 'text-red-600' :
                                                    selectedStudentData.performanceLevel === 'Excellent' ? 'text-emerald-600' :
                                                        selectedStudentData.performanceLevel === 'Good' ? 'text-blue-600' : 'text-amber-600'
                                                    }`}>
                                                    {selectedStudentData.performanceLevel}
                                                </span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-slate-600">Completion Rate:</span>
                                                <span className="font-bold text-slate-900">
                                                    {Math.round((studentStats.completedSubjects / studentStats.totalSubjects) * 100)}%
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Enhanced Authentication Footer for Print Only */}
                            <div className="hidden print:block print:mt-6 print:pt-4 border-t-2 border-black print:break-inside-avoid print:keep-with-previous print:keep-together">
                                <div className="grid grid-cols-3 gap-4 print:text-xs text-black">
                                    {/* Generation Details */}
                                    <div>
                                        <div className="font-bold uppercase tracking-wider print:mb-1">Document Details</div>
                                        <div className="space-y-1">
                                            <div><span className="font-semibold">Generated On:</span></div>
                                            <div>{new Date().toLocaleDateString('en-IN', {
                                                weekday: 'long',
                                                year: 'numeric',
                                                month: 'long',
                                                day: 'numeric'
                                            })}</div>
                                            <div>{new Date().toLocaleTimeString('en-IN')}</div>
                                            <div className="print:mt-2">
                                                <span className="font-semibold">Document ID:</span><br />
                                                <span className="font-mono">AIC-SC-{selectedStudentData.adNo}-{Date.now().toString().slice(-8)}</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Official Signatures */}
                                    <div className="text-center">
                                        <div className="space-y-4">
                                            <div>
                                                <div className="border-b border-black w-32 mx-auto print:mb-2"></div>
                                                <div className="font-bold uppercase tracking-wider">Class Teacher</div>
                                            </div>
                                            <div>
                                                <div className="border-b border-black w-32 mx-auto print:mb-2"></div>
                                                <div className="font-bold uppercase tracking-wider">Controller of Examinations</div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Verification & Seal */}
                                    <div className="text-right">
                                        <div className="font-bold uppercase tracking-wider print:mb-2">Official Seal</div>
                                        <div className="w-20 h-20 border-2 border-black rounded-full mx-auto print:mb-2 flex items-center justify-center">
                                            <span className="text-xs font-bold">SEAL</span>
                                        </div>
                                        <div className="print:text-xs">
                                            <div className="font-semibold">Verification Code:</div>
                                            <div className="font-mono">{btoa(selectedStudentData.adNo + Date.now()).slice(0, 8).toUpperCase()}</div>
                                        </div>
                                        <div className="print:mt-2 print:text-xs">
                                            <div className="font-semibold">Valid Until:</div>
                                            <div>{new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toLocaleDateString('en-IN')}</div>
                                        </div>
                                    </div>
                                </div>

                                {/* Footer Note */}
                                <div className="print:mt-4 print:pt-2 border-t border-black text-center print:text-xs text-black print:break-inside-avoid">
                                    <div className="font-semibold">
                                        This is an official document generated by AIC Da'wa College Examination System
                                    </div>
                                    <div className="print:mt-1">
                                        For verification, contact: examinations@aicdawacollege.edu.in | Phone: +91-483-2734567
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="bg-white rounded-2xl p-12 shadow-sm border border-slate-200 text-center">
                    <i className="fa-solid fa-user-graduate text-4xl text-slate-400 mb-4"></i>
                    <h3 className="text-xl font-bold text-slate-900 mb-2">Select a Student</h3>
                    <p className="text-slate-600">
                        Choose a class and student to view their detailed scorecard
                    </p>
                </div>
            )}
        </div>
    );
};

export default React.memo(StudentScorecard);