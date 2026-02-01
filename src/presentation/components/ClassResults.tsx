import React, { useState, useEffect } from 'react';
import { StudentRecord, SubjectConfig } from '../../domain/entities/types';
import { CLASSES } from '../../domain/entities/constants';
import { dataService } from '../../infrastructure/services/dataService';
import { useMobile } from '../hooks/useMobile';

const ClassResults: React.FC = () => {
    const [selectedClass, setSelectedClass] = useState('S1');
    const [students, setStudents] = useState<StudentRecord[]>([]);
    const [subjects, setSubjects] = useState<SubjectConfig[]>([]);
    const [classSubjects, setClassSubjects] = useState<SubjectConfig[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');

    // Mobile detection
    const { isMobile, isTablet } = useMobile();

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
            const allSubjects = await dataService.getAllSubjects();
            setSubjects(allSubjects);
        } catch (error) {
            console.error('Error loading data:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const loadClassData = async () => {
        try {
            const [classStudents] = await Promise.all([
                dataService.getStudentsByClass(selectedClass)
            ]);

            setStudents(classStudents);

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

    const handleExport = () => {
        // Simple CSV export
        const headers = ['Rank', 'Adm No', 'Name', ...classSubjects.map(s => s.name), 'Total', 'Average', 'Status'];
        const rows = students.map(student => [
            student.rank,
            student.adNo,
            student.name,
            ...classSubjects.map(subject => {
                const marks = student.marks[subject.id];
                return marks ? marks.total : '-';
            }),
            student.grandTotal,
            student.average.toFixed(1),
            student.performanceLevel
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
            ? Math.round(students.reduce((sum, s) => sum + s.average, 0) / students.length)
            : 0,
        passedStudents: students.filter(s => s.performanceLevel !== 'Failed').length,
        highestMarks: students.length > 0 ? Math.max(...students.map(s => s.grandTotal)) : 0,
        lowestMarks: students.length > 0 ? Math.min(...students.map(s => s.grandTotal)) : 0
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
        <div className="space-y-8 print:space-y-4">
            {/* Header - Hidden on Print */}
            <div className={`flex items-center justify-between print:hidden ${isMobile ? 'flex-col gap-4' : ''}`}>
                <div className={isMobile ? 'text-center' : ''}>
                    <h1 className={`font-black text-slate-900 tracking-tight ${isMobile ? 'text-2xl' : 'text-3xl'}`}>Class Results</h1>
                    <p className={`text-slate-600 mt-2 ${isMobile ? 'text-sm' : ''}`}>Comprehensive class-wise academic performance report</p>
                </div>
                <div className={`flex gap-3 print:hidden ${isMobile ? 'w-full flex-col' : ''}`}>
                    {isMobile && (
                        <div className="flex gap-2 mb-2">
                            <button
                                onClick={() => setViewMode('table')}
                                className={`flex-1 px-3 py-2 rounded-lg font-bold transition-all ${viewMode === 'table'
                                    ? 'bg-emerald-600 text-white'
                                    : 'bg-slate-200 text-slate-700'
                                    }`}
                                style={{ minHeight: '44px' }}
                            >
                                <i className="fa-solid fa-table mr-2"></i>
                                Table
                            </button>
                            <button
                                onClick={() => setViewMode('cards')}
                                className={`flex-1 px-3 py-2 rounded-lg font-bold transition-all ${viewMode === 'cards'
                                    ? 'bg-emerald-600 text-white'
                                    : 'bg-slate-200 text-slate-700'
                                    }`}
                                style={{ minHeight: '44px' }}
                            >
                                <i className="fa-solid fa-id-card mr-2"></i>
                                Cards
                            </button>
                        </div>
                    )}
                    <button
                        onClick={handleExport}
                        className={`px-4 py-2 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all flex items-center gap-2 print:hidden ${isMobile ? 'justify-center' : ''}`}
                        style={{ minHeight: '44px' }}
                        aria-label="Export class results as CSV file"
                    >
                        <i className="fa-solid fa-download"></i>
                        Export CSV
                    </button>
                    <button
                        onClick={handlePrint}
                        className={`px-4 py-2 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-all flex items-center gap-2 print:hidden ${isMobile ? 'justify-center' : ''}`}
                        style={{ minHeight: '44px' }}
                        aria-label="Print class results report"
                    >
                        <i className="fa-solid fa-print"></i>
                        Print Report
                    </button>
                </div>
            </div>

            {/* Class Selection - Hidden on Print */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 print:hidden">
                <div className={`flex items-center gap-6 ${isMobile ? 'flex-col' : ''}`}>
                    <div className={isMobile ? 'w-full' : ''}>
                        <label className="block text-sm font-bold text-slate-700 mb-2">Select Class</label>
                        <select
                            value={selectedClass}
                            onChange={(e) => setSelectedClass(e.target.value)}
                            className={`p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 font-medium print:hidden ${isMobile ? 'w-full' : ''}`}
                            style={{ minHeight: '44px' }}
                            aria-label="Select class to view results"
                            aria-describedby="class-results-help"
                        >
                            {CLASSES.map(cls => (
                                <option key={cls} value={cls}>{cls}</option>
                            ))}
                        </select>
                    </div>
                    <div className={`flex-1 grid gap-4 text-center ${isMobile ? 'grid-cols-2 w-full' : 'grid-cols-2 md:grid-cols-5'}`}>
                        <div>
                            <p className={`font-black text-slate-900 ${isMobile ? 'text-xl' : 'text-2xl'}`}>{classStats.totalStudents}</p>
                            <p className="text-xs font-bold text-slate-600 uppercase">Students</p>
                        </div>
                        <div>
                            <p className={`font-black text-emerald-600 ${isMobile ? 'text-xl' : 'text-2xl'}`}>{classStats.averagePercentage}%</p>
                            <p className="text-xs font-bold text-slate-600 uppercase">Class Avg</p>
                        </div>
                        {!isMobile && (
                            <>
                                <div>
                                    <p className="text-2xl font-black text-blue-600">{passPercentage}%</p>
                                    <p className="text-xs font-bold text-slate-600 uppercase">Pass Rate</p>
                                </div>
                                <div>
                                    <p className="text-2xl font-black text-amber-600">{classStats.highestMarks}</p>
                                    <p className="text-xs font-bold text-slate-600 uppercase">Highest</p>
                                </div>
                                <div>
                                    <p className="text-2xl font-black text-red-600">{classStats.lowestMarks}</p>
                                    <p className="text-xs font-bold text-slate-600 uppercase">Lowest</p>
                                </div>
                            </>
                        )}
                    </div>
                    {isMobile && (
                        <div className="grid grid-cols-3 gap-4 text-center w-full mt-4">
                            <div>
                                <p className="text-xl font-black text-blue-600">{passPercentage}%</p>
                                <p className="text-xs font-bold text-slate-600 uppercase">Pass Rate</p>
                            </div>
                            <div>
                                <p className="text-xl font-black text-amber-600">{classStats.highestMarks}</p>
                                <p className="text-xs font-bold text-slate-600 uppercase">Highest</p>
                            </div>
                            <div>
                                <p className="text-xl font-black text-red-600">{classStats.lowestMarks}</p>
                                <p className="text-xs font-bold text-slate-600 uppercase">Lowest</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>

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
                        CLASS {selectedClass} - ACADEMIC RESULTS REPORT
                    </h2>

                    {/* Academic Session and Class Statistics */}
                    <div className="grid grid-cols-4 gap-3 print:text-xs text-black print:leading-tight print:mb-3 print:break-inside-avoid">
                        <div className="text-center border-r border-black">
                            <div className="font-bold">Academic Session</div>
                            <div>2024-25</div>
                        </div>
                        <div className="text-center border-r border-black">
                            <div className="font-bold">Total Students</div>
                            <div>{classStats.totalStudents}</div>
                        </div>
                        <div className="text-center border-r border-black">
                            <div className="font-bold">Class Average</div>
                            <div>{classStats.averagePercentage}%</div>
                        </div>
                        <div className="text-center">
                            <div className="font-bold">Pass Rate</div>
                            <div>{passPercentage}%</div>
                        </div>
                    </div>

                    {/* Generation Info */}
                    <div className="print:text-xs text-black print:leading-tight">
                        <div className="font-semibold">
                            Generated on {new Date().toLocaleDateString('en-IN', {
                                weekday: 'long',
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric'
                            })} at {new Date().toLocaleTimeString('en-IN', {
                                hour: '2-digit',
                                minute: '2-digit'
                            })}
                        </div>
                    </div>
                </div>
            </div>

            {/* Results Table */}
            {students.length > 0 ? (
                <>
                    {/* Mobile Card View */}
                    {isMobile && viewMode === 'cards' ? (
                        <div className="space-y-4">
                            {students.map((student, index) => (
                                <div key={student.id} className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
                                    {/* Student Header */}
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
                                            <p className="text-2xl font-black text-slate-900">{student.grandTotal}</p>
                                            <p className="text-sm text-slate-600">{student.average.toFixed(1)}%</p>
                                        </div>
                                    </div>

                                    {/* Status Badge */}
                                    <div className="mb-4">
                                        <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${student.performanceLevel === 'Excellent' ? 'bg-emerald-100 text-emerald-700' :
                                            student.performanceLevel === 'Good' ? 'bg-blue-100 text-blue-700' :
                                                student.performanceLevel === 'Average' ? 'bg-amber-100 text-amber-700' :
                                                    student.performanceLevel === 'Needs Improvement' ? 'bg-orange-100 text-orange-700' :
                                                        'bg-red-100 text-red-700'
                                            }`}>
                                            {student.performanceLevel === 'Needs Improvement' ? 'Needs Imp.' : student.performanceLevel}
                                        </span>
                                    </div>

                                    {/* Subject Marks Grid */}
                                    <div className="grid grid-cols-2 gap-3">
                                        {classSubjects.map(subject => {
                                            const marks = student.marks[subject.id];
                                            return (
                                                <div key={subject.id} className="bg-slate-50 rounded-lg p-3">
                                                    <p className="text-xs font-bold text-slate-600 uppercase mb-1">
                                                        {subject.name.length > 12 ? subject.name.substring(0, 12) + '...' : subject.name}
                                                    </p>
                                                    {marks ? (
                                                        <div>
                                                            <p className={`text-lg font-bold ${marks.status === 'Failed' ? 'text-red-600' : 'text-slate-900'}`}>
                                                                {marks.total}
                                                            </p>
                                                            <p className="text-xs text-slate-500">
                                                                {marks.ta}+{marks.ce}
                                                            </p>
                                                        </div>
                                                    ) : (
                                                        <span className="text-slate-400">-</span>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        /* Table View with Enhanced Mobile Scrolling */
                        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden print:shadow-none print:border print:border-slate-300 print:a4-content print:table-keep-together">
                            {isMobile && (
                                <div className="bg-amber-50 border-b border-amber-200 p-3 text-center">
                                    <p className="text-sm text-amber-800 font-medium">
                                        <i className="fa-solid fa-arrows-left-right mr-2"></i>
                                        Scroll horizontally to see all subjects
                                    </p>
                                </div>
                            )}
                            <div className="overflow-x-auto mobile-table-scroll">
                                <table className="w-full border-collapse print:table-compact" role="table" aria-label="Class results table" style={{ minWidth: isMobile ? '800px' : 'auto' }}>
                                    <thead className="print:keep-with-next">
                                        <tr className="bg-slate-50 print:bg-slate-100 print:break-inside-avoid" role="row">
                                            <th className={`text-left font-bold text-slate-700 border-b border-slate-200 sticky left-0 bg-slate-50 z-10 ${isMobile ? 'p-2 text-xs' : 'p-4'} print:p-1 print:text-xs print:leading-tight print:table-cell-padding`} role="columnheader" scope="col">Rank</th>
                                            <th className={`text-left font-bold text-slate-700 border-b border-slate-200 sticky ${isMobile ? 'left-12' : 'left-16'} bg-slate-50 z-10 ${isMobile ? 'p-2 text-xs' : 'p-4'} print:p-1 print:text-xs print:leading-tight print:table-cell-padding`} role="columnheader" scope="col">Adm No</th>
                                            <th className={`text-left font-bold text-slate-700 border-b border-slate-200 sticky ${isMobile ? 'left-24' : 'left-32'} bg-slate-50 z-10 ${isMobile ? 'p-2 text-xs' : 'p-4'} print:p-1 print:text-xs print:leading-tight print:table-cell-padding`} role="columnheader" scope="col">Student Name</th>
                                            {classSubjects.map(subject => (
                                                <th key={subject.id} className={`text-center font-bold text-slate-700 border-b border-slate-200 ${isMobile ? 'p-2 text-xs' : 'p-4'} print:p-1 print:text-xs print:leading-tight print:table-cell-padding`} role="columnheader" scope="col">
                                                    <div className="print:hidden">{isMobile && subject.name.length > 8 ? subject.name.substring(0, 8) + '...' : subject.name}</div>
                                                    <div className="hidden print:block">{subject.name.substring(0, 8)}</div>
                                                    {subject.arabicName && !isMobile && (
                                                        <div className="text-xs text-slate-500 arabic-text print:hidden">{subject.arabicName}</div>
                                                    )}
                                                </th>
                                            ))}
                                            <th className={`text-center font-bold text-slate-700 border-b border-slate-200 ${isMobile ? 'p-2 text-xs' : 'p-4'} print:p-1 print:text-xs print:leading-tight print:table-cell-padding`} role="columnheader" scope="col">Total</th>
                                            <th className={`text-center font-bold text-slate-700 border-b border-slate-200 ${isMobile ? 'p-2 text-xs' : 'p-4'} print:p-1 print:text-xs print:leading-tight print:table-cell-padding`} role="columnheader" scope="col">Average</th>
                                            <th className={`text-center font-bold text-slate-700 border-b border-slate-200 ${isMobile ? 'p-2 text-xs' : 'p-4'} print:p-1 print:text-xs print:leading-tight print:table-cell-padding`} role="columnheader" scope="col">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {students.map((student, index) => (
                                            <tr key={student.id} className={`${index % 2 === 0 ? 'bg-white' : 'bg-slate-50'} hover:bg-slate-100 transition-colors print:hover:bg-transparent print:table-row-keep-together print:break-inside-avoid`} role="row">
                                                <td className={`border-b border-slate-100 sticky left-0 bg-inherit z-10 ${isMobile ? 'p-2' : 'p-4'} print:p-1 print:text-xs print:table-cell-padding`} role="cell">
                                                    <div className={`rounded-full flex items-center justify-center text-white font-black text-sm print:w-4 print:h-4 print:text-xs print:leading-tight print:rounded-none ${isMobile ? 'w-6 h-6 text-xs' : 'w-8 h-8'
                                                        } ${student.rank === 1 ? 'bg-yellow-500 print:rank-gold' :
                                                            student.rank === 2 ? 'bg-slate-400 print:rank-silver' :
                                                                student.rank === 3 ? 'bg-amber-600 print:rank-bronze' :
                                                                    'bg-slate-300 print:rank-default'
                                                        }`} aria-label={`Rank ${student.rank}`}>
                                                        {student.rank}
                                                    </div>
                                                </td>
                                                <td className={`font-medium text-slate-900 border-b border-slate-100 sticky ${isMobile ? 'left-12' : 'left-16'} bg-inherit z-10 ${isMobile ? 'p-2 text-xs' : 'p-4'} print:p-1 print:text-xs print:leading-tight print:table-cell-padding`} role="cell">{student.adNo}</td>
                                                <td className={`font-medium text-slate-900 border-b border-slate-100 sticky ${isMobile ? 'left-24' : 'left-32'} bg-inherit z-10 ${isMobile ? 'p-2 text-xs' : 'p-4'} print:p-1 print:text-xs print:leading-tight print:table-cell-padding`} role="cell">
                                                    {isMobile && student.name.length > 15 ? student.name.substring(0, 15) + '...' : student.name}
                                                </td>
                                                {classSubjects.map(subject => {
                                                    const marks = student.marks[subject.id];
                                                    return (
                                                        <td key={subject.id} className={`text-center border-b border-slate-100 ${isMobile ? 'p-2' : 'p-4'} print:p-1 print:text-xs print:table-cell-padding`}>
                                                            {marks ? (
                                                                <div>
                                                                    <div className={`font-bold ${isMobile ? 'text-sm' : 'text-lg'} print:text-xs print:leading-tight print:hierarchy-secondary ${marks.status === 'Failed' ? 'text-red-600 print:performance-failed' : 'text-slate-900 print:hierarchy-primary'}`}>
                                                                        {marks.total}
                                                                    </div>
                                                                    {!isMobile && (
                                                                        <div className="text-xs text-slate-500 print:hidden">
                                                                            {marks.ta}+{marks.ce}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            ) : (
                                                                <span className="text-slate-400">-</span>
                                                            )}
                                                        </td>
                                                    );
                                                })}
                                                <td className={`text-center font-black text-slate-900 border-b border-slate-100 ${isMobile ? 'p-2 text-lg' : 'p-4 text-xl'} print:p-1 print:text-xs print:leading-tight print:table-cell-padding`}>
                                                    {student.grandTotal}
                                                </td>
                                                <td className={`text-center font-bold text-slate-900 border-b border-slate-100 ${isMobile ? 'p-2 text-sm' : 'p-4'} print:p-1 print:text-xs print:leading-tight print:table-cell-padding`}>
                                                    {student.average.toFixed(1)}%
                                                </td>
                                                <td className={`text-center border-b border-slate-100 ${isMobile ? 'p-2' : 'p-4'} print:p-1 print:table-cell-padding`}>
                                                    <span className={`px-3 py-1 rounded-full font-bold uppercase tracking-wider print:px-0 print:py-0 print:text-xs print:leading-tight ${isMobile ? 'text-xs px-2' : 'text-xs'
                                                        } ${student.performanceLevel === 'Excellent' ? 'bg-emerald-100 text-emerald-700 print:performance-excellent' :
                                                            student.performanceLevel === 'Good' ? 'bg-blue-100 text-blue-700 print:performance-good' :
                                                                student.performanceLevel === 'Average' ? 'bg-amber-100 text-amber-700 print:performance-average' :
                                                                    student.performanceLevel === 'Needs Improvement' ? 'bg-orange-100 text-orange-700 print:performance-needs-improvement' :
                                                                        'bg-red-100 text-red-700 print:performance-failed'
                                                        }`}>
                                                        {student.performanceLevel === 'Needs Improvement' ? 'Needs Imp.' : student.performanceLevel}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
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

            {/* Enhanced Print Footer - Visible only on Print */}
            <div className="hidden print:block print:mt-6 print:pt-4 border-t-2 border-black print:break-inside-avoid print:keep-with-previous print:keep-together">
                <div className="grid grid-cols-3 gap-4 print:text-xs text-black print:leading-tight">
                    {/* Document Information */}
                    <div>
                        <div className="font-bold uppercase tracking-wider print:mb-2">Document Information</div>
                        <div className="space-y-1">
                            <div><span className="font-semibold">Report Type:</span> Class Results</div>
                            <div><span className="font-semibold">Class:</span> {selectedClass}</div>
                            <div><span className="font-semibold">Academic Year:</span> 2024-25</div>
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
        </div >
    );
};

export default ClassResults;