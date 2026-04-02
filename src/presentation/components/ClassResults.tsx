import React, { useState, useEffect } from 'react';
import { StudentRecord, SubjectConfig } from '../../domain/entities/types';
import { User } from '../../domain/entities/User';
import { CLASSES } from '../../domain/entities/constants';
import { useMemo } from 'react';
import { dataService } from '../../infrastructure/services/dataService';
import { useMobile } from '../hooks/useMobile';
import { shortenSubjectName } from '../../infrastructure/services/formatUtils';
import { useTerm } from '../viewmodels/TermContext';

interface ClassResultsProps {
    forcedClass?: string;
    hideSelector?: boolean;
    currentUser?: User | null;
}

const ClassResults: React.FC<ClassResultsProps> = ({ forcedClass, hideSelector, currentUser }) => {
    // Determine allowed classes based on user role
    const allowedClasses = useMemo(() => {
        if (!currentUser || currentUser.role === 'admin') return CLASSES;
        return CLASSES.filter(cls => currentUser.assignedClasses.includes(cls));
    }, [currentUser]);

    const [selectedClass, setSelectedClass] = useState(forcedClass || allowedClasses[0] || 'S1');
    const [students, setStudents] = useState<StudentRecord[]>([]);
    const [subjects, setSubjects] = useState<SubjectConfig[]>([]);
    const [classSubjects, setClassSubjects] = useState<SubjectConfig[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [viewMode, setViewMode] = useState<'table' | 'cards'>(hideSelector ? 'cards' : 'table');

    // Mobile detection
    const { isMobile, isTablet } = useMobile();

    const { activeTerm, currentSemester, currentAcademicYear } = useTerm();


    useEffect(() => {
        loadData();
    }, [activeTerm]);

    useEffect(() => {
        if (selectedClass) {
            loadClassData();
        }
    }, [selectedClass, subjects, activeTerm]);

    const loadData = async () => {
        try {
            setIsLoading(true);
            const allSubjects = await dataService.getAllSubjects(activeTerm);
            setSubjects(allSubjects);
        } catch (error) {
            console.error('Error loading data:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const loadClassData = async () => {
        try {
            const classStudents = await dataService.getStudentsByClass(selectedClass, activeTerm);

            // Map students to their active term data for display and ranking
            const processedStudents = classStudents.map(student => {
                const termData = student.academicHistory?.[activeTerm];
                return {
                    ...student,
                    displayMarks: termData?.marks || {},
                    displayTotal: termData?.grandTotal || 0,
                    displayAverage: termData?.average || 0,
                    displayPerformance: termData?.performanceLevel || 'Not Assessed',
                    displayRank: termData?.rank || 0,
                    displayClass: termData?.className || student.currentClass || selectedClass
                };
            });

            // Sort by grand total descending and calculate ranks client-side
            const sortedStudents = [...processedStudents].sort((a, b) => b.displayTotal - a.displayTotal);

            let currentRank = 1;
            const rankedStudents = sortedStudents.map((student, index) => {
                if (index > 0 && student.displayTotal === sortedStudents[index - 1].displayTotal) {
                    // Same total, same rank
                } else {
                    // Different total, rank is position + 1
                    currentRank = index + 1;
                }
                return { ...student, rank: currentRank };
            });

            setStudents(rankedStudents);

            // Filter subjects for this class - include electives by enrollment OR by marks presence
            const filteredSubjects = subjects.filter(s => {
                // General subjects assigned to this class
                if (s.targetClasses.includes(selectedClass)) return true;
                // Elective subjects: check enrollment list
                if (s.subjectType === 'elective' && s.enrolledStudents?.some(id => classStudents.some(cs => cs.id === id))) return true;
                // Elective subjects: also check if any student in this class has marks for this subject
                if (s.subjectType === 'elective' && classStudents.some(cs => {
                    const termMarks = cs.academicHistory?.[activeTerm]?.marks || {};
                    const mark = termMarks[s.id];
                    return mark && (mark.total > 0 || mark.int !== undefined);
                })) return true;
                return false;
            });
            setClassSubjects(filteredSubjects);
        } catch (error) {
            console.error('Error loading class data:', error);
        }
    };

    const handlePrint = () => {
        window.print();
    };

    const handleExport = () => {
        // Simple CSV export
        const headers = ['Rank', 'Adm No', 'Name', ...classSubjects.map(s => s.name), 'Total', 'Average', 'Status'];
        const rows = students.map(student => [
            student.rank,
            student.adNo,
            student.name,
            ...classSubjects.map(subject => {
                const marks = (student as any).displayMarks[subject.id];
                return marks ? marks.total : '-';
            }),
            (student as any).displayTotal,
            (student as any).displayAverage.toFixed(1),
            (student as any).displayPerformance
        ]);

        const csvContent = [headers, ...rows]
            .map(row => row.map(cell => `"${cell}"`).join(','))
            .join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${selectedClass}_results.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    // Calculate class statistics
    const classStats = {
        totalStudents: students.length,
        averagePercentage: students.length > 0
            ? Math.round(students.reduce((sum, s) => sum + ((s as any).displayAverage || 0), 0) / students.length)
            : 0,
        passedStudents: students.filter(s => (s as any).displayPerformance !== 'Failed' && (s as any).displayPerformance !== 'Not Assessed').length,
        highestMarks: students.length > 0 ? Math.max(...students.map(s => (s as any).displayTotal || 0)) : 0,
        lowestMarks: students.length > 0 ? Math.min(...students.map(s => (s as any).displayTotal || 0)) : 0
    };

    const passPercentage = classStats.totalStudents > 0
        ? Math.round((classStats.passedStudents / classStats.totalStudents) * 100)
        : 0;

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="text-center">
                    <div className="loader-ring mb-4"></div>
                    <p className="text-slate-600">Loading class results...</p>
                </div>
            </div>
        );
    }



    return (
        <div className="space-y-8 print:space-y-4 page-class-results">


            {/* Results Section with Unified Horizontal Scroll */}
            <div className="overflow-x-auto pb-8 print:overflow-visible results-scroll-container">
                <div className="inline-block min-w-full align-middle print:block">
                    {/* Header - Hidden on Print, Sticky Top & Horizontally Pinned */}
                    <div className={`flex items-center justify-between print:hidden mb-6 sticky top-0 left-0 right-0 z-[120] bg-white p-3 rounded-b-xl border-b border-slate-200 shadow-sm`}>
                        <div className="flex-1 min-w-0">
                            <h1 className={`font-black text-slate-900 tracking-tight truncate ${isMobile ? 'text-xl' : 'text-3xl'}`}>Class Results</h1>
                            <p className={`text-slate-600 mt-0.5 ${isMobile ? 'text-xs' : 'text-xs uppercase font-bold tracking-wider'}`}>Academic Report</p>
                        </div>
                        <div className="flex gap-2 print:hidden ml-2 flex-shrink-0">
                            {isMobile && (
                                <>
                                    <button
                                        onClick={() => setViewMode('table')}
                                        title="Table View"
                                        className={`w-10 h-10 rounded-lg font-bold transition-all flex items-center justify-center ${viewMode === 'table' ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-700'}`}
                                    >
                                        <i className="fa-solid fa-table text-sm"></i>
                                    </button>
                                    <button
                                        onClick={() => setViewMode('cards')}
                                        title="Card View"
                                        className={`w-10 h-10 rounded-lg font-bold transition-all flex items-center justify-center ${viewMode === 'cards' ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-700'}`}
                                    >
                                        <i className="fa-solid fa-id-card text-sm"></i>
                                    </button>
                                </>
                            )}
                            <button
                                onClick={handleExport}
                                title="Export CSV"
                                className={`${isMobile ? 'w-10 h-10 rounded-lg' : 'px-4 py-2 rounded-xl gap-2'} bg-blue-600 text-white font-bold hover:bg-blue-700 transition-all flex items-center justify-center print:hidden whitespace-nowrap`}
                                aria-label="Export as CSV"
                            >
                                <i className="fa-solid fa-download text-sm"></i>
                                {!isMobile && <span>Export</span>}
                            </button>
                            <button
                                onClick={handlePrint}
                                title="Print Report"
                                className={`${isMobile ? 'w-10 h-10 rounded-lg' : 'px-4 py-2 rounded-xl gap-2'} bg-emerald-600 text-white font-bold hover:bg-emerald-700 transition-all flex items-center justify-center print:hidden whitespace-nowrap`}
                                aria-label="Print Report"
                            >
                                <i className="fa-solid fa-print text-sm"></i>
                                {!isMobile && <span>Print</span>}
                            </button>
                        </div>
                    </div>

                    {/* Class Selection & Stats Bar - Sticky Horizontally only */}
                    {!hideSelector && (
                        <div className="sticky left-0 z-30 bg-white rounded-2xl p-3 md:p-6 shadow-sm border border-slate-200 print:hidden mb-4 md:mb-8 w-full transition-all duration-300">
                            <div className="flex items-center gap-3 mb-3">
                                <label className="text-sm font-bold text-slate-700 whitespace-nowrap">Select Class</label>
                                <select
                                    value={selectedClass}
                                    onChange={(e) => setSelectedClass(e.target.value)}
                                    className="flex-1 p-2 md:p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 font-medium print:hidden text-sm"
                                    style={{ minHeight: '40px' }}
                                    aria-label="Select class to view results"
                                >
                                    {allowedClasses.map(cls => (
                                        <option key={cls} value={cls}>{cls}</option>
                                    ))}
                                </select>
                            </div>
                            {/* All 5 stats always visible in a single scrollable row */}
                            <div className="flex gap-4 overflow-x-auto pb-1 no-scrollbar">
                                {[
                                    { value: classStats.totalStudents, label: 'Students', color: 'text-slate-900' },
                                    { value: `${classStats.averagePercentage}%`, label: 'Class Avg', color: 'text-emerald-600' },
                                    { value: `${passPercentage}%`, label: 'Pass Rate', color: 'text-blue-600' },
                                    { value: classStats.highestMarks, label: 'Highest', color: 'text-amber-600' },
                                    { value: classStats.lowestMarks, label: 'Lowest', color: 'text-red-600' },
                                ].map(stat => (
                                    <div key={stat.label} className="flex-shrink-0 text-center bg-slate-50 rounded-xl px-4 py-2 min-w-[72px]">
                                        <p className={`text-lg font-black ${stat.color}`}>{stat.value}</p>
                                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">{stat.label}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Results Content */}
                    {students.length > 0 ? (
                        <>
                            {/* Mobile Card View */}
                            {isMobile && viewMode === 'cards' ? (
                                <div className="space-y-4 px-1">
                                    {students.map((student) => {
                                        const generalSubjects = classSubjects.filter(s => s.subjectType !== 'elective');
                                        const electiveSubjects = classSubjects.filter(s => s.subjectType === 'elective');
                                        const studentElective = electiveSubjects.find(s => {
                                            const m = (student as any).displayMarks[s.id];
                                            return m !== undefined && m !== null;
                                        });
                                        const electiveMark = studentElective ? (student as any).displayMarks[studentElective.id] : null;

                                        return (
                                            <div key={student.id} className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
                                                <div className="flex items-center justify-between mb-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-black text-sm ${student.rank === 1 ? 'bg-yellow-500' :
                                                            student.rank === 2 ? 'bg-slate-400' :
                                                                student.rank === 3 ? 'bg-amber-600' :
                                                                    'bg-slate-300'
                                                            }`}>
                                                            {student.rank}
                                                        </div>
                                                        <div>
                                                            <h3 className="font-bold text-slate-900">{student.name}</h3>
                                                            <p className="text-sm text-slate-600">Adm: {student.adNo}</p>
                                                        </div>
                                                    </div>
                                                    <div className="text-right">
                                                        <p className="text-2xl font-black text-slate-900">{(student as any).displayTotal}</p>
                                                        <p className="text-sm text-slate-600">{(student as any).displayAverage.toFixed(1)}%</p>
                                                    </div>
                                                </div>

                                                <div className="mb-4">
                                                    <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${(student as any).displayPerformance.includes('Outstanding') ? 'bg-purple-100 text-purple-700' :
                                                        (student as any).displayPerformance.includes('Excellent') ? 'bg-emerald-100 text-emerald-700' :
                                                            (student as any).displayPerformance.includes('Very Good') ? 'bg-blue-100 text-blue-700' :
                                                                (student as any).displayPerformance.includes('Good') ? 'bg-teal-100 text-teal-700' :
                                                                    (student as any).displayPerformance.includes('Average') ? 'bg-amber-100 text-amber-700' :
                                                                        'bg-red-100 text-red-700'
                                                        }`}>
                                                        {(student as any).displayPerformance}
                                                    </span>
                                                </div>

                                                <div className="grid grid-cols-2 gap-3">
                                                    {generalSubjects.map(subject => {
                                                        const marks = (student as any).displayMarks[subject.id];
                                                        return (
                                                            <div key={subject.id} className="bg-slate-50 rounded-lg p-3">
                                                                <p className="text-xs font-bold text-slate-600 uppercase mb-1">{shortenSubjectName(subject.name)}</p>
                                                                {marks ? (
                                                                    <div>
                                                                        <p className={`text-lg font-bold ${marks.status === 'Failed' ? 'text-red-600' : 'text-slate-900'}`}>{marks.total}</p>
                                                                        <p className="text-xs text-slate-500">{subject.maxEXT === 0 ? 'N/A' : marks.ext}+{marks.int}</p>
                                                                    </div>
                                                                ) : <span className="text-slate-400">-</span>}
                                                            </div>
                                                        );
                                                    })}
                                                    {studentElective && (
                                                        <div className="bg-slate-50 rounded-lg p-3 border border-indigo-100">
                                                            <p className="text-xs font-bold text-indigo-600 uppercase mb-1">Elective ({shortenSubjectName(studentElective.name)})</p>
                                                            {electiveMark ? (
                                                                <div>
                                                                        <p className={`text-lg font-bold ${electiveMark.status === 'Failed' ? 'text-red-600' : 'text-slate-900'}`}>{electiveMark.total}</p>
                                                                        <p className="text-xs text-slate-500">{electiveMark.ext}+{electiveMark.int}</p>
                                                                    </div>
                                                            ) : <span className="text-slate-400">-</span>}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                /* Table View */
                                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden print:overflow-visible print:shadow-none print:border-none print:a4-content px-1">
                                    <div className="print:overflow-visible">
                                        <table className="w-full border-separate border-spacing-0 print:table-compact" role="table" aria-label="Class results table" style={{ minWidth: '700px' }}>
                                            <thead className="sticky top-0 z-[110] print:static bg-slate-100">
                                                <tr className="bg-slate-100 print:bg-slate-100 print:break-inside-avoid" role="row">
                                                    <th className={`text-center font-bold text-slate-600 border-b-2 border-slate-300 bg-slate-100 uppercase tracking-wider sticky top-0 left-0 z-[115] ${isMobile ? 'px-1 py-1.5 text-[10px]' : 'px-2 py-3 text-xs'} print:px-1 print:py-1 print:text-[9px] print:static`} role="columnheader" scope="col" style={{ width: isMobile ? '40px' : '50px', minWidth: isMobile ? '40px' : '50px' }}>Rank</th>
                                                    <th className={`text-center font-bold text-slate-600 border-b-2 border-slate-300 bg-slate-100 uppercase tracking-wider sticky top-0 z-[115] ${isMobile ? 'px-1 py-1.5 text-[10px]' : 'px-2 py-3 text-xs'} print:px-1 print:py-1 print:text-[9px] print:static`} role="columnheader" scope="col" style={{ left: isMobile ? '40px' : '50px', width: isMobile ? '45px' : '65px', minWidth: isMobile ? '45px' : '65px', backgroundColor: '#f1f5f9' }}>Adm No</th>
                                                    <th className={`text-left font-bold text-slate-600 border-b-2 border-slate-300 bg-slate-100 uppercase tracking-wider sticky top-0 z-[115] ${isMobile ? 'px-1 py-1.5 text-[10px]' : 'px-2 py-3 text-xs'} print:px-1 print:py-1 print:text-[9px] print:static`} role="columnheader" scope="col" style={{ left: isMobile ? '85px' : '115px', minWidth: isMobile ? '100px' : '130px', boxShadow: '2px 0 4px rgba(0,0,0,0.08)', backgroundColor: '#f1f5f9' }}>Student Name</th>
                                                    {classSubjects.filter(s => s.subjectType !== 'elective').map(subject => (
                                                        <th key={subject.id} className={`text-center font-bold text-slate-600 border-b-2 border-slate-300 bg-slate-100 uppercase tracking-wider sticky top-0 z-[110] ${isMobile ? 'px-1 py-1.5 text-[10px]' : 'px-2 py-3 text-xs'} print:px-1 print:py-1 print:text-[9px]`} role="columnheader" scope="col">
                                                            {shortenSubjectName(subject.name)}
                                                        </th>
                                                    ))}

                                                    {classSubjects.some(s => s.subjectType === 'elective') && (
                                                        <th className={`text-center font-bold text-indigo-600 border-b-2 border-slate-300 bg-indigo-50 uppercase tracking-wider sticky top-0 z-[110] ${isMobile ? 'px-1 py-1.5 text-[10px]' : 'px-2 py-3 text-xs'} print:px-1 print:py-1 print:text-[9px]`} role="columnheader" scope="col">Elective</th>
                                                    )}

                                                    <th className={`text-center font-bold text-slate-600 border-b-2 border-slate-300 bg-slate-100 uppercase tracking-wider sticky top-0 z-[110] ${isMobile ? 'px-1 py-1.5 text-[10px]' : 'px-2 py-3 text-xs'} print:px-1 print:py-1 print:text-[9px]`} role="columnheader" scope="col">Total</th>
                                                    <th className={`text-center font-bold text-slate-600 border-b-2 border-slate-300 bg-slate-100 uppercase tracking-wider sticky top-0 z-[110] ${isMobile ? 'px-1 py-1.5 text-[10px]' : 'px-2 py-3 text-xs'} print:px-1 print:py-1 print:text-[9px]`} role="columnheader" scope="col">Avg</th>
                                                    <th className={`text-center font-bold text-slate-600 border-b-2 border-slate-300 bg-slate-100 uppercase tracking-wider sticky top-0 z-[110] ${isMobile ? 'px-1 py-1.5 text-[10px]' : 'px-2 py-3 text-xs'} print:px-1 print:py-1 print:text-[9px]`} role="columnheader" scope="col">Status</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {students.map((student, index) => {
                                                    const electiveSubjects = classSubjects.filter(s => s.subjectType === 'elective');
                                                    const studentElective = electiveSubjects.find(s => {
                                                        const m = (student as any).displayMarks[s.id];
                                                        return m !== undefined && m !== null;
                                                    });
                                                    const electiveMark = studentElective ? (student as any).displayMarks[studentElective.id] : null;
                                                    const rowBgHex = index % 2 === 0 ? '#ffffff' : '#f8fafc';

                                                    return (
                                                        <tr key={student.id} className={`${index % 2 === 0 ? 'bg-white' : 'bg-slate-50'} hover:bg-blue-50/50 transition-colors print:hover:bg-transparent print:break-inside-avoid`} role="row">
                                                            <td className={`text-center border-b border-slate-100 sticky left-0 z-20 ${isMobile ? 'px-1 py-1.5' : 'px-2 py-2'} print:px-1 print:py-0.5 print:text-[10px] print:static`} role="cell" style={{ backgroundColor: rowBgHex, width: isMobile ? '40px' : '50px', minWidth: isMobile ? '40px' : '50px' }}>
                                                                <div className={`inline-flex items-center justify-center rounded-full text-white font-black ${isMobile ? 'w-5 h-5 text-[9px]' : 'w-7 h-7 text-xs'} print:w-4 print:h-4 print:text-[9px] ${student.rank === 1 ? 'bg-yellow-500' : student.rank === 2 ? 'bg-slate-400' : student.rank === 3 ? 'bg-amber-600' : 'bg-slate-300'}`}>
                                                                    {student.rank}
                                                                </div>
                                                            </td>
                                                            <td className={`text-center font-medium text-slate-700 border-b border-slate-100 sticky z-20 ${isMobile ? 'px-1 py-1.5 text-[11px]' : 'px-2 py-2 text-sm'} print:px-1 print:py-0.5 print:text-[10px] print:static`} role="cell" style={{ left: isMobile ? '40px' : '50px', backgroundColor: rowBgHex, width: isMobile ? '45px' : '65px', minWidth: isMobile ? '45px' : '65px' }}>{student.adNo}</td>
                                                            <td className={`text-left font-semibold text-slate-900 border-b border-slate-100 sticky z-20 ${isMobile ? 'px-1 py-1.5 text-[11px]' : 'px-2 py-2 text-sm'} print:px-1 print:py-0.5 print:text-[10px] print:static`} role="cell" style={{ left: isMobile ? '85px' : '115px', backgroundColor: rowBgHex, minWidth: isMobile ? '100px' : '130px', boxShadow: '2px 0 4px rgba(0,0,0,0.06)' }}>
                                                                {isMobile && student.name.length > 14 ? student.name.substring(0, 14) + '..' : student.name}
                                                            </td>

                                                            {classSubjects.filter(s => s.subjectType !== 'elective').map(subject => {
                                                                const marks = (student as any).displayMarks[subject.id];
                                                                return (
                                                                    <td key={subject.id} className={`text-center border-b border-slate-100 ${isMobile ? 'px-1 py-2' : 'px-2 py-2'} print:px-1 print:py-0.5 print:text-[10px]`}>
                                                                        {marks ? (
                                                                            <div>
                                                                                <div className={`font-bold ${isMobile ? 'text-sm' : 'text-base'} print:text-[10px] ${marks.status === 'Failed' ? 'text-red-600' : 'text-slate-900'}`}>{marks.total}</div>
                                                                                {!isMobile && <div className="text-[10px] text-slate-400 print:hidden">{subject.maxEXT === 0 ? 'N/A' : (marks.ext === 'A' ? 'A' : marks.ext)}+{marks.int === 'A' ? 'A' : marks.int}</div>}
                                                                            </div>
                                                                        ) : <span className="text-slate-300 text-sm">-</span>}
                                                                    </td>
                                                                );
                                                            })}

                                                            {classSubjects.some(s => s.subjectType === 'elective') && (
                                                                <td className={`text-center border-b border-slate-100 bg-indigo-50/20 ${isMobile ? 'px-1 py-2' : 'px-2 py-2'} print:px-1 print:py-0.5 print:text-[10px]`}>
                                                                    {electiveMark ? (
                                                                        <div>
                                                                            <div className={`font-bold ${isMobile ? 'text-sm' : 'text-base'} print:text-[10px] ${electiveMark.status === 'Failed' ? 'text-red-600' : 'text-slate-900'}`}>{electiveMark.total}</div>
                                                                            <div className="text-[10px] text-indigo-500 font-medium truncate max-w-[80px] mx-auto">{shortenSubjectName(studentElective?.name)}</div>
                                                                        </div>
                                                                    ) : <span className="text-slate-300 text-sm">-</span>}
                                                                </td>
                                                            )}

                                                            <td className={`text-center font-black text-slate-900 border-b border-slate-100 ${isMobile ? 'px-1 py-1.5 text-sm' : 'px-2 py-2 text-lg'} print:px-1 print:py-0.5 print:text-[10px]`}>{(student as any).displayTotal}</td>
                                                            <td className={`text-center font-bold text-slate-700 border-b border-slate-100 ${isMobile ? 'px-1 py-1.5 text-xs' : 'px-2 py-2 text-sm'} print:px-1 print:py-0.5 print:text-[10px]`}>{(student as any).displayAverage.toFixed(1)}%</td>
                                                            <td className={`text-center border-b border-slate-100 ${isMobile ? 'px-1 py-1.5' : 'px-2 py-2'} print:px-1 print:py-0.5`}>
                                                                <span className={`inline-block px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wider ${isMobile ? 'text-[8px]' : 'text-[10px]'} print:text-[8px] print:px-0 ${(student as any).displayPerformance.includes('Outstanding') ? 'bg-purple-100 text-purple-700' : (student as any).displayPerformance.includes('Excellent') ? 'bg-emerald-100 text-emerald-700' : (student as any).displayPerformance.includes('Very Good') ? 'bg-blue-100 text-blue-700' : (student as any).displayPerformance.includes('Good') ? 'bg-teal-100 text-teal-700' : (student as any).displayPerformance.includes('Average') ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
                                                                    {isMobile ? ((student as any).displayPerformance === 'Needs Improvement' ? 'N.I.' : (student as any).displayPerformance) : (student as any).displayPerformance}
                                                                </span>
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}
                        </>
                        ) : (
                        <div className="bg-white rounded-2xl p-12 shadow-sm border border-slate-200 text-center">
                            <i className="fa-solid fa-chart-bar text-4xl text-slate-400 mb-4"></i>
                            <h3 className="text-xl font-bold text-slate-900 mb-2">No Results Available</h3>
                            <p className="text-slate-600">No students found in class {selectedClass}</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Diagnostic Dump */}
            <div className="bg-slate-900 text-green-400 p-4 rounded-xl text-xs overflow-auto my-4 font-mono print:hidden max-h-64">
                <h4 className="text-white font-bold mb-2">DIAGNOSTIC DUMP (Please send a screenshot of this)</h4>
                <p className="mb-2">Total Columns Rendered: {classSubjects.filter(s => s.subjectType !== 'elective').length}</p>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <strong className="text-white block mb-1">UI Columns (classSubjects):</strong>
                        <pre>{JSON.stringify(classSubjects.map(s => ({name: s.name, id: s.id})), null, 2)}</pre>
                    </div>
                    <div>
                        {students.slice(0, 1).map(student => (
                            <div key={student.id}>
                                <strong className="text-white block mb-1">First Student ({student.name}) displayMarks:</strong>
                                <pre>{JSON.stringify((student as any).displayMarks, null, 2)}</pre>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Fail Analysis Section - Admin/Internal View Only */}
            {(!hideSelector || currentUser?.role === 'admin') && (
                <div className="bg-white rounded-2xl p-6 md:p-10 shadow-sm border border-slate-200 mt-8 print:break-inside-avoid">
                    <div className="flex items-center gap-3 mb-8">
                        <div className="w-12 h-12 bg-red-100 rounded-2xl flex items-center justify-center">
                            <i className="fa-solid fa-triangle-exclamation text-red-600 text-xl"></i>
                        </div>
                        <div>
                            <h2 className="text-2xl font-black text-slate-900">Failure Analysis</h2>
                            <p className="text-slate-500 text-sm font-bold uppercase tracking-wider">Academic Intervention Report</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        {/* Students with Failures */}
                        <div className="space-y-4">
                            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                                <i className="fa-solid fa-users-slash text-slate-400"></i>
                                Students with Failures
                            </h3>
                            <div className="space-y-3">
                                {students
                                    .map(student => {
                                        const failedSubjects = Object.entries((student as any).displayMarks || {})
                                            .filter(([_, m]: [string, any]) => m.status === 'Failed')
                                            .map(([subjId, _]) => classSubjects.find(cs => cs.id === subjId)?.name || subjId);
                                        return { ...student, failedSubjects, failureCount: failedSubjects.length };
                                    })
                                    .filter(s => s.failureCount > 0)
                                    .sort((a, b) => b.failureCount - a.failureCount)
                                    .map(student => {
                                        const hasManyFailures = student.failureCount > 3;

                                        return (
                                            <div
                                                key={student.id}
                                                className={`p-4 rounded-xl border transition-all ${hasManyFailures
                                                    ? 'bg-red-50 border-red-200 shadow-sm'
                                                    : 'bg-slate-50 border-slate-100 hover:border-slate-200'
                                                    }`}
                                            >
                                                <div className="flex items-center justify-between mb-2">
                                                    <span className={`font-black ${hasManyFailures ? 'text-red-700' : 'text-slate-900'}`}>{student.name}</span>
                                                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-black uppercase ${hasManyFailures ? 'bg-red-200 text-red-800' : 'bg-slate-200 text-slate-600'}`}>
                                                        {student.failureCount} {student.failureCount === 1 ? 'Subject' : 'Subjects'}
                                                    </span>
                                                </div>
                                                <div className="flex flex-wrap gap-1.5">
                                                    {student.failedSubjects.map((name, i) => (
                                                        <span key={i} className={`text-[10px] font-bold px-2 py-0.5 rounded ${hasManyFailures ? 'bg-white/60 text-red-600' : 'bg-white text-slate-500'}`}>
                                                            {name}
                                                        </span>
                                                    ))}
                                                </div>
                                                {hasManyFailures && (
                                                    <p className="mt-2 text-[10px] font-black text-red-500 uppercase flex items-center gap-1">
                                                        <i className="fa-solid fa-circle-exclamation"></i> Critical: Requires Immediate Support
                                                    </p>
                                                )}
                                            </div>
                                        );
                                    })}
                                {students.every(s => !Object.values((s as any).displayMarks || {}).some((m: any) => m.status === 'Failed')) && (
                                    <div className="p-6 text-center bg-emerald-50 rounded-2xl border border-emerald-100">
                                        <i className="fa-solid fa-circle-check text-emerald-500 text-2xl mb-2"></i>
                                        <p className="text-emerald-700 font-bold">Excellent! No failures detected in this class.</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Subject Analysis */}
                        <div className="space-y-4">
                            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                                <i className="fa-solid fa-book-open-reader text-slate-400"></i>
                                High-Failure Subjects
                            </h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {classSubjects
                                    .map(subject => {
                                        const failureCount = students.filter(s => {
                                            const mark = (s as any).displayMarks[subject.id];
                                            return mark && mark.status === 'Failed';
                                        }).length;
                                        return { ...subject, failureCount };
                                    })
                                    .filter(s => s.failureCount > 0)
                                    .sort((a, b) => b.failureCount - a.failureCount)
                                    .map(subject => {
                                        const isCritical = subject.failureCount > 3;

                                        return (
                                            <div
                                                key={subject.id}
                                                className={`p-4 rounded-xl border flex flex-col justify-between ${isCritical
                                                    ? 'bg-amber-50 border-amber-200 shadow-sm'
                                                    : 'bg-slate-50 border-slate-100'
                                                    }`}
                                            >
                                                <div className="mb-2">
                                                    <p className={`text-xs font-black uppercase tracking-wider ${isCritical ? 'text-amber-700' : 'text-slate-500'}`}>{subject.name}</p>
                                                    <p className={`text-2xl font-black ${isCritical ? 'text-amber-600' : 'text-slate-900'}`}>{subject.failureCount}</p>
                                                </div>
                                                <p className={`text-[10px] font-bold ${isCritical ? 'text-amber-600' : 'text-slate-400'}`}>
                                                    {isCritical ? 'CRITICAL: High failure rate' : 'Needs observation'}
                                                </p>
                                            </div>
                                        );
                                    })}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Enhanced Print Footer - Visible only on Print */}
            <div className="hidden print:block print:mt-6 print:pt-4 border-t-2 border-black print:break-inside-avoid print:keep-with-previous print:keep-together">
                <div className="grid grid-cols-3 gap-4 print:text-xs text-black print:leading-tight">
                    {/* Document Information */}
                    <div>
                        <div className="font-bold uppercase tracking-wider print:mb-2">Document Information</div>
                        <div className="space-y-1">
                            <div><span className="font-semibold">Report Type:</span> Class Results</div>
                            <div><span className="font-semibold">Class:</span> {selectedClass}</div>
                            <div><span className="font-semibold">Academic Year:</span> {currentAcademicYear}</div>
                            <div><span className="font-semibold">Generated:</span> {new Date().toLocaleDateString('en-IN')}</div>
                            <div><span className="font-semibold">Document ID:</span></div>
                            <div className="font-mono">AIC-CR-{selectedClass}-{Date.now().toString().slice(-8)}</div>
                        </div>
                    </div>

                    {/* Official Signatures */}
                    <div className="text-center">
                        <div className="space-y-4">
                            <div>
                                <div className="border-b border-black w-32 mx-auto print:mb-2"></div>
                                <div className="font-bold uppercase tracking-wider">Head of Department</div>
                            </div>
                            <div>
                                <div className="border-b border-black w-32 mx-auto print:mb-2"></div>
                                <div className="font-bold uppercase tracking-wider">Controller of Examinations</div>
                            </div>
                        </div>
                    </div>

                    {/* College Seal and Verification */}
                    <div className="text-right">
                        <div className="font-bold uppercase tracking-wider print:mb-2">Official Seal</div>
                        <div className="w-20 h-20 border-2 border-black rounded-full mx-auto print:mb-2 flex items-center justify-center">
                            <span className="text-xs font-bold">SEAL</span>
                        </div>
                        <div className="print:text-xs">
                            <div className="font-semibold">Verification Code:</div>
                            <div className="font-mono">{btoa(selectedClass + Date.now()).slice(0, 8).toUpperCase()}</div>
                        </div>
                    </div>
                </div>

                {/* Footer Disclaimer */}
                <div className="print:mt-4 print:pt-2 border-t border-black text-center print:text-xs text-black print:break-inside-avoid">
                    <div className="font-semibold">
                        This is an official class results report generated by AIC Da'wa College Examination System
                    </div>
                    <div className="print:mt-1">
                        For verification and queries, contact: examinations@aicdawacollege.edu.in | Phone: +91-483-2734567
                    </div>
                </div>
            </div>
        </div>
    );
};

export default React.memo(ClassResults);