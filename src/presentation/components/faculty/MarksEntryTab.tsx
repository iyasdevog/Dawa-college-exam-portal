import React from 'react';
import type { StudentRecord, SubjectConfig } from '../../../domain/entities/types';
import OfflineStatusIndicator from '../OfflineStatusIndicator';
import { shortenSubjectName } from '../../../infrastructure/services/formatUtils';
import { useTerm } from '../../viewmodels/TermContext';

interface MarksEntryTabProps {
    // Selection state
    selectedClass: string;
    setSelectedClass: (cls: string) => void;
    subjectType: 'general' | 'elective';
    setSubjectType: (type: 'general' | 'elective') => void;
    selectedSubject: string;
    setSelectedSubject: (id: string) => void;

    // Data
    allowedClasses: string[];
    classSubjects: SubjectConfig[];
    selectedSubjectData: SubjectConfig | undefined;
    students: StudentRecord[];
    attendanceStats: Record<string, { present: number; total: number; percentage: number }>;

    // Hook state/handlers
    marksData: Record<string, { int: string; ext: string }>;
    handleMarksChange: (studentId: string, field: 'int' | 'ext', value: string) => void;
    handleSaveMarks: () => Promise<void>;
    handleSaveEXTMarks: (studentId?: string) => Promise<void>;
    handleSaveINTMarks: (studentId?: string) => Promise<void>;
    handleClearStudentMarks: (studentId: string, studentName: string) => Promise<void>;
    handleClearINTMarks: () => Promise<void>;
    handleClearEXTMarks: () => Promise<void>;
    handleClearAll: () => Promise<void>;

    // UI Helpers
    validationHelpers: any;
    invalidMarksInfo: { hasInvalid: boolean; count: number };
    completionStats: { completed: number; total: number };
    operationLoading: { type: string | null; message?: string };
    isSaving: boolean;

    // Mobile Navigation
    showStudentList: boolean;
    setShowStudentList: (show: boolean) => void;
    searchQuery: string;
    setSearchQuery: (q: string) => void;
    filteredStudents: StudentRecord[];
    paginatedStudents: StudentRecord[];
    hasMore: boolean;
    setCurrentPage: React.Dispatch<React.SetStateAction<number>>;
    currentStudentIndex: number;
    jumpToStudent: (id: string) => void;
    navigateToNext: () => void;
    navigateToPrevious: () => void;
    showScrollToTop: boolean;
    scrollToTop: () => void;
    isScrolling: boolean;
    getTouchProps: (fn: () => void) => any;
    studentRefs: React.MutableRefObject<{ [key: string]: HTMLDivElement | null }>;
    handleKeyDown: (e: React.KeyboardEvent, studentId: string, field: 'int' | 'ext') => void;
}

const EMPTY_MARKS = { int: '', ext: '' };

const StudentRow = React.memo(({
    student, index, marks, validationHelpers, handleMarksChange, handleKeyDown,
    handleSaveEXTMarks, handleSaveINTMarks, handleClearStudentMarks,
    isSaving, att, selectedSubjectData, isCondoned, isMarksEntryAllowed
}: {
    student: StudentRecord;
    index: number;
    marks: { int: string; ext: string };
    validationHelpers: any;
    handleMarksChange: any;
    handleKeyDown: any;
    handleSaveEXTMarks: any;
    handleSaveINTMarks: any;
    handleClearStudentMarks: any;
    isSaving: boolean;
    att: number;
    selectedSubjectData: SubjectConfig | undefined;
    isCondoned: boolean;
    isMarksEntryAllowed: boolean;
}) => {
    const total = validationHelpers?.calculateTotal(marks.int, marks.ext) || 0;
    const status = validationHelpers?.getStatus(marks.int, marks.ext) || 'Pending';

    // A student is eligible if their attendance is >= 75% OR they have paid condonation fees
    const isEligible = isCondoned || att >= 75;
    // INT field is disabled only when maxINT is 0 (no internal component), not when maxEXT === 100 (since Doura can have 70 EXT + 30 INT)
    const noInternal = (selectedSubjectData?.maxINT ?? 1) === 0;
    const isEntryDisabled = !isEligible || isSaving || !isMarksEntryAllowed;

    return (
        <tr className={index % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
            <td className="p-4">{student.adNo}</td>
            <td className="p-4">
                <div>
                    <span>{student.name}</span>
                    {isCondoned && (
                        <span className="ml-2 px-1.5 py-0.5 bg-indigo-100 text-indigo-700 text-[9px] font-black uppercase rounded tracking-wide">
                            Condoned
                        </span>
                    )}
                </div>
            </td>
            <td className="p-4 text-center">
                <input
                    type="text"
                    value={marks.ext || ''}
                    onChange={(e) => handleMarksChange(student.id, 'ext', e.target.value)}
                    onKeyDown={(e) => handleKeyDown(e, student.id, 'ext')}
                    data-student={student.id}
                    data-field="ext"
                    className={`w-20 p-2 border-2 rounded-xl text-center ${
                        isEntryDisabled ? 'bg-slate-100 opacity-60' :
                        isCondoned ? 'border-indigo-300' : ''
                    }`}
                    disabled={isEntryDisabled}
                />
            </td>
            <td className="p-4 text-center">
                <input
                    type="text"
                    value={marks.int || ''}
                    onChange={(e) => handleMarksChange(student.id, 'int', e.target.value)}
                    onKeyDown={(e) => handleKeyDown(e, student.id, 'int')}
                    data-student={student.id}
                    data-field="int"
                    className={`w-20 p-2 border-2 rounded-xl text-center ${
                        noInternal || isEntryDisabled ? 'bg-slate-100 opacity-60' :
                        isCondoned ? 'border-indigo-300' : ''
                    }`}
                    disabled={noInternal || isEntryDisabled}
                />
            </td>
            <td className="p-4 text-center font-bold">{marks.int && marks.ext ? total : '-'}</td>
            <td className="p-4 text-center">
                <span className={`px-2 py-1 rounded-full text-xs ${status === 'Passed' ? 'bg-emerald-100 text-emerald-700' : status === 'Failed' ? 'bg-red-100 text-red-700' : 'bg-slate-100'}`}>
                    {status}
                </span>
            </td>
            <td className="p-4 text-center">
                <div className="flex flex-col gap-1">
                    <div className="flex gap-1">
                        <button onClick={() => handleSaveEXTMarks(student.id)} className="flex-1 bg-sky-50 text-sky-700 px-2 py-1 rounded text-xs" disabled={isEntryDisabled || !marks.ext}>Save EXT</button>
                        <button onClick={() => handleSaveINTMarks(student.id)} className="flex-1 bg-indigo-50 text-indigo-700 px-2 py-1 rounded text-xs" disabled={isEntryDisabled || !marks.int}>Save INT</button>
                    </div>
                    <button onClick={() => handleClearStudentMarks(student.id, student.name)} className="bg-red-50 text-red-600 rounded text-xs p-1" disabled={isEntryDisabled || (!marks.int && !marks.ext)}>Clear ALL</button>
                </div>
            </td>
        </tr>
    );
}, (prev, next) => {
    return (
        prev.student.id === next.student.id &&
        prev.index === next.index &&
        prev.marks.int === next.marks.int &&
        prev.marks.ext === next.marks.ext &&
        prev.isSaving === next.isSaving &&
        prev.att === next.att &&
        prev.isCondoned === next.isCondoned &&
        prev.selectedSubjectData === next.selectedSubjectData &&
        prev.validationHelpers === next.validationHelpers
    );
});

const MarksEntryTab: React.FC<MarksEntryTabProps> = ({
    selectedClass, setSelectedClass,
    subjectType, setSubjectType,
    selectedSubject, setSelectedSubject,
    allowedClasses, classSubjects, selectedSubjectData,
    students, attendanceStats,
    marksData, handleMarksChange, handleSaveMarks, 
    handleSaveEXTMarks, handleSaveINTMarks,
    handleClearStudentMarks, handleClearINTMarks, handleClearEXTMarks, handleClearAll,
    validationHelpers, invalidMarksInfo, completionStats,
    operationLoading, isSaving,
    showStudentList, setShowStudentList, searchQuery, setSearchQuery,
    filteredStudents, paginatedStudents, hasMore, setCurrentPage,
    currentStudentIndex, jumpToStudent, navigateToNext, navigateToPrevious,
    showScrollToTop, scrollToTop, isScrolling, getTouchProps,
    studentRefs, handleKeyDown
}) => {
    const { activeTerm, isHistoricalTerm, isUpcomingTerm, isMarksEntryAllowed, activeMarksTerm } = useTerm();

    const handleDownloadTemplate = () => {
        if (!students || students.length === 0) return;

        const maxEXT = selectedSubjectData?.maxEXT ?? 70;
        const maxINT = selectedSubjectData?.maxINT ?? 30;

        const headers = [
            'Sl No',
            'Admission No',
            'Student Name',
            'Class',
            'Subject',
            `External Mark (Max ${maxEXT})`,
            `Internal Mark (Max ${maxINT})`,
            'Total Mark',
            'Status'
        ];

        const rows = students.map((student, idx) => {
            const studentMarks = marksData[student.id] || { int: '', ext: '' };
            const total = validationHelpers?.calculateTotal(studentMarks.int, studentMarks.ext) || '';
            const status = validationHelpers?.getStatus(studentMarks.int, studentMarks.ext) || 'Pending';
            const studentClass = student.className || student.currentClass || selectedClass;

            return [
                idx + 1,
                student.adNo || '',
                student.name || '',
                studentClass,
                selectedSubjectData?.name || '',
                studentMarks.ext !== undefined ? studentMarks.ext : '',
                studentMarks.int !== undefined ? studentMarks.int : '',
                studentMarks.int && studentMarks.ext ? total : '',
                status
            ];
        });

        const csvContent = '\uFEFF' + [headers, ...rows]
            .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
            .join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        const subjectClean = (selectedSubjectData?.name || 'Subject').replace(/[^a-zA-Z0-9_-]/g, '_');
        const classClean = (selectedClass || 'Class').replace(/[^a-zA-Z0-9_-]/g, '_');

        link.href = url;
        link.setAttribute('download', `${classClean}_${subjectClean}_MarkEntrySheet.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    const handlePrintSheet = () => {
        window.print();
    };

    return (
        <>
            {/* Historical Term Banner */}
            {isHistoricalTerm && (
                <div className="flex items-start gap-4 bg-amber-50 border border-amber-300 rounded-2xl px-5 py-4 shadow-sm mb-6 mx-6 md:mx-0">
                    <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center mt-0.5">
                        <i className="fa-solid fa-clock-rotate-left text-amber-600 text-lg"></i>
                    </div>
                    <div>
                        <p className="font-bold text-amber-800 text-sm">Viewing Historical Semester — Read-Only Mode</p>
                        <p className="text-amber-700 text-xs mt-1">
                            You are currently viewing <span className="font-semibold">{activeTerm}</span>. Marks entry is disabled for past semesters to protect historical records. Active term for marks entry is <span className="font-semibold">{activeMarksTerm}</span>.
                        </p>
                    </div>
                </div>
            )}

            {/* Upcoming / Inactive Term Banner */}
            {!isHistoricalTerm && !isMarksEntryAllowed && (
                <div className="flex items-start gap-4 bg-blue-50 border border-blue-300 rounded-2xl px-5 py-4 shadow-sm mb-6 mx-6 md:mx-0">
                    <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center mt-0.5">
                        <i className="fa-solid fa-calendar-minus text-blue-600 text-lg"></i>
                    </div>
                    <div>
                        <p className="font-bold text-blue-900 text-sm">
                            {isUpcomingTerm ? 'Upcoming Semester — Entry Closed' : 'Not Active Semester — Entry Closed'}
                        </p>
                        <p className="text-blue-800 text-xs mt-1">
                            You are currently viewing <span className="font-semibold">{activeTerm}</span>. Marks entry for this semester is not open yet. Active term for marks entry is <span className="font-semibold">{activeMarksTerm}</span>.
                        </p>
                    </div>
                </div>
            )}

            <div className="bg-white rounded-2xl md:rounded-3xl p-6 md:p-8 shadow-xl border-2 border-slate-200 mx-6 md:mx-0 print:hidden" style={{
                background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
                boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
            }}>
                <div className={`space-y-4 md:space-y-0 md:grid ${subjectType === 'elective' ? 'md:grid-cols-2' : 'md:grid-cols-3'} md:gap-6`}>
                    {subjectType === 'general' && (
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-2">Class</label>
                            <select
                                value={selectedClass}
                                onChange={(e) => setSelectedClass(e.target.value)}
                                className="w-full p-4 border-2 border-slate-300 rounded-xl focus:ring-4 focus:ring-emerald-500/40 focus:border-emerald-500 bg-white"
                                disabled={isSaving || operationLoading.type !== null}
                            >
                                {allowedClasses.map(cls => (
                                    <option key={cls} value={cls}>{cls}</option>
                                ))}
                            </select>
                        </div>
                    )}
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">Subject Type</label>
                        <select
                            value={subjectType}
                            onChange={(e) => setSubjectType(e.target.value as 'general' | 'elective')}
                            className="w-full p-4 border-2 border-slate-300 rounded-xl focus:ring-4 focus:ring-emerald-500/40 focus:border-emerald-500 bg-white"
                            disabled={isSaving || operationLoading.type !== null}
                        >
                            <option value="general">General</option>
                            <option value="elective">Elective</option>
                        </select>
                    </div>
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <label className="block text-sm font-bold text-slate-700">Subject</label>
                            <OfflineStatusIndicator className="md:block hidden" />
                        </div>
                        <select
                            value={selectedSubject}
                            onChange={(e) => setSelectedSubject(e.target.value)}
                            className="w-full p-4 border-2 border-slate-300 rounded-xl focus:ring-4 focus:ring-emerald-500/40 focus:border-emerald-500 bg-white"
                            disabled={isSaving || operationLoading.type !== null}
                        >
                            <option value="">Select Subject</option>
                            {classSubjects.map(subject => (
                                <option key={subject.id} value={subject.id}>
                                    {shortenSubjectName(subject.name)} {subject.arabicName && `(${subject.arabicName})`}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="mt-4 p-3 bg-blue-50 border border-blue-100 rounded-xl flex items-start gap-3">
                    <i className="fa-solid fa-circle-info text-blue-500 mt-0.5"></i>
                    <div className="text-sm text-blue-800">
                        <p className="font-bold mb-1 underline">Marks Entry Tip:</p>
                        <p>Enter <span className="font-black text-blue-900 bg-blue-100 px-1.5 py-0.5 rounded">'A'</span> (uppercase or lowercase) for students who were <strong>Absent</strong>. Absent marks are treated as 0 for totals but will mark the student as <strong>Failed</strong>.</p>
                    </div>
                </div>

                {selectedSubjectData && (
                    <div className="mt-4 p-3 md:p-4 bg-slate-50 rounded-xl">
                        <div className="space-y-3 md:space-y-0 md:grid md:grid-cols-2 md:gap-4 text-sm">
                            <div className="space-y-2">
                                <div><span className="font-bold text-slate-700">Max INT:</span> <span className="ml-2 text-slate-600">{selectedSubjectData.maxINT}</span><span className="ml-2 text-red-600 font-medium">(Min: {Math.ceil(selectedSubjectData.maxINT * 0.5)})</span></div>
                                <div><span className="font-bold text-slate-700">Max EXT:</span> <span className="ml-2 text-slate-600">{selectedSubjectData.maxEXT}</span><span className="ml-2 text-red-600 font-medium">(Min: {Math.ceil(selectedSubjectData.maxEXT * 0.4)})</span></div>
                            </div>
                            <div className="space-y-2">
                                <div><span className="font-bold text-slate-700">Faculty:</span> <span className="ml-2 text-slate-600">{selectedSubjectData.facultyName}</span></div>
                                <div className="text-xs text-blue-700 bg-blue-50 p-2 rounded"><strong>Passing Rule:</strong> Students must achieve both INT minimum (50%) AND EXT minimum (40%) to pass</div>
                            </div>
                        </div>

                        {students.length > 0 && (
                            <div className="mt-4 pt-3 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
                                <span className="text-xs font-bold text-slate-600 flex items-center gap-1.5">
                                    <i className="fa-solid fa-file-invoice text-slate-500"></i>
                                    INT &amp; EXT Mark Sheet Template ({students.length} students)
                                </span>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={handleDownloadTemplate}
                                        className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 transition shadow-sm active:scale-95 cursor-pointer"
                                        title="Download INT & EXT Mark Entry Sheet / Template (CSV)"
                                    >
                                        <i className="fa-solid fa-download"></i>
                                        <span>Download Template</span>
                                    </button>
                                    <button
                                        onClick={handlePrintSheet}
                                        className="px-3.5 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold flex items-center gap-2 transition shadow-sm active:scale-95 cursor-pointer"
                                        title="Print INT & EXT Mark Entry Sheet / Template"
                                    >
                                        <i className="fa-solid fa-print"></i>
                                        <span>Print Template</span>
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {selectedSubject && students.length > 0 ? (
                <div className="mx-6 md:mx-0 print:hidden">
                    {/* Mobile View */}
                    <div className="block md:hidden space-y-8 pb-[18rem]">
                        <div className="bg-white rounded-3xl p-6 shadow-xl border-2 border-slate-200 sticky top-4 z-40" style={{
                            background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
                            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
                        }}>
                            <div className="flex items-center justify-between mb-6">
                                <div className="flex items-center gap-3">
                                    <h2 className="text-xl font-black text-slate-900 tracking-tight">{shortenSubjectName(selectedSubjectData?.name)}</h2>
                                    <OfflineStatusIndicator className="md:hidden block" />
                                </div>
                                <div className="flex items-center gap-4">
                                    <button
                                        {...getTouchProps(() => setShowStudentList(!showStudentList))}
                                        className="flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-r from-blue-500 to-blue-600 shadow-lg text-white"
                                    >
                                        <i className={`fa-solid ${showStudentList ? 'fa-times' : 'fa-list'}`}></i>
                                    </button>
                                    <div className="text-right">
                                        <div className="text-base text-slate-700 font-bold">{students.length} students</div>
                                        <div className="text-sm text-slate-500 font-medium">{completionStats.completed} completed</div>
                                    </div>
                                </div>
                            </div>

                            {showStudentList && (
                                <div className="mb-4 p-4 bg-slate-50 rounded-xl border border-slate-200 animate-in slide-in-from-top-2 duration-300">
                                    <div className="mb-3 relative">
                                        <input
                                            type="text"
                                            placeholder="Search students..."
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            className="w-full p-3 pl-10 text-sm border-2 border-slate-300 rounded-xl focus:ring-4 focus:ring-blue-500/40"
                                        />
                                        <i className="fa-solid fa-search absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400"></i>
                                    </div>
                                    <div className="max-h-64 overflow-y-auto space-y-2">
                                        {filteredStudents.length > 0 ? (
                                            filteredStudents.map((student) => {
                                                const originalIndex = students.findIndex(s => s.id === student.id);
                                                const isCompleted = marksData[student.id]?.int && marksData[student.id]?.ext;
                                                const isCurrent = originalIndex === currentStudentIndex;
                                                return (
                                                    <button
                                                        key={student.id}
                                                        onClick={() => jumpToStudent(student.id)}
                                                        className={`w-full p-3 text-left rounded-lg transition-all ${isCurrent ? 'bg-blue-500 text-white shadow-md' : isCompleted ? 'bg-emerald-100 text-emerald-800' : 'bg-white border border-slate-200'}`}
                                                    >
                                                        <div className="flex items-center justify-between">
                                                            <div><div className="font-medium text-sm">{student.name}</div><div className="text-xs opacity-75">Adm: {student.adNo}</div></div>
                                                            <div className="flex items-center gap-2"><span className="text-xs">#{originalIndex + 1}</span>{isCompleted && <i className="fa-solid fa-check-circle text-xs"></i>}</div>
                                                        </div>
                                                    </button>
                                                );
                                            })
                                        ) : <div className="text-center py-4 text-slate-500 text-sm">No students found</div>}
                                    </div>
                                </div>
                            )}

                            {students.length > 0 && (
                                <div className="flex items-center justify-between mb-3">
                                    <button onClick={navigateToPrevious} disabled={currentStudentIndex === 0} className="w-12 h-12 rounded-xl bg-slate-100 disabled:opacity-50"><i className="fa-solid fa-chevron-left"></i></button>
                                    <div className="flex-1 mx-4 text-center">
                                        <div className="text-lg font-black text-slate-900">Student {currentStudentIndex + 1} of {students.length}</div>
                                        <div className="text-sm text-slate-600 mb-2">{students[currentStudentIndex]?.name}</div>
                                    </div>
                                    <button onClick={navigateToNext} disabled={currentStudentIndex === students.length - 1} className="w-12 h-12 rounded-xl bg-slate-100 disabled:opacity-50"><i className="fa-solid fa-chevron-right"></i></button>
                                </div>
                            )}
                        </div>

                        {paginatedStudents.map((student, index) => {
                            const isCurrent = index === currentStudentIndex;
                            const studentMarks = marksData[student.id] || { int: '', ext: '' };
                            const attendance = attendanceStats[student.id]?.percentage || 0;
                            const isCondoned = student.condonedTerms?.[activeTerm] === true;
                            const isEligible = isCondoned || attendance >= 75;
                            const noInternal = (selectedSubjectData?.maxINT ?? 1) === 0;

                            return (
                                <div key={student.id} ref={el => { if(studentRefs.current) studentRefs.current[student.id] = el; }} className={`bg-white rounded-xl p-3 border shadow-sm transition-all ${
                                    isCurrent ? 'ring-2 ring-emerald-500 bg-emerald-50/50' :
                                    isCondoned ? 'border-indigo-200' : 'border-slate-200'
                                }`}>
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="flex flex-col">
                                            <div className="flex items-center gap-1.5">
                                                <h3 className="font-bold text-slate-900 text-sm leading-tight">{student.name}</h3>
                                                {isCondoned && (
                                                    <span className="px-1.5 py-0.5 bg-indigo-100 text-indigo-700 text-[9px] font-black uppercase rounded tracking-wide">Condoned</span>
                                                )}
                                            </div>
                                            <p className="text-[10px] uppercase font-black text-slate-400">ADM: {student.adNo}</p>
                                        </div>
                                        <span className="px-2 py-0.5 bg-slate-200 text-slate-600 rounded text-[10px] font-bold">{index + 1} / {students.length}</span>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-xs font-medium text-slate-600 mb-1">EXT (Max: {selectedSubjectData?.maxEXT})</label>
                                            <input
                                                type="text"
                                                data-student={student.id}
                                                data-field="ext"
                                                onKeyDown={(e) => handleKeyDown(e, student.id, 'ext')}
                                                value={studentMarks.ext}
                                                onChange={(e) => handleMarksChange(student.id, 'ext', e.target.value)}
                                                className={`w-full p-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 ${
                                                    !isEligible ? 'bg-red-50 border-red-200 text-red-400' :
                                                    isCondoned ? 'border-indigo-300 focus:ring-indigo-500' : ''
                                                }`}
                                                disabled={!isEligible}
                                            />
                                            <div className={`mt-1 text-[10px] font-bold ${
                                                isCondoned ? 'text-indigo-600' :
                                                !isEligible ? 'text-red-600' : 'text-emerald-600'
                                            }`}>
                                                Attendance: {typeof attendance === 'number' ? attendance.toFixed(0) : '0'}%
                                                {isCondoned && ' (Condoned)'}
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-slate-600 mb-1">INT (Max: {selectedSubjectData?.maxINT})</label>
                                            <input
                                                type="text"
                                                data-student={student.id}
                                                data-field="int"
                                                onKeyDown={(e) => handleKeyDown(e, student.id, 'int')}
                                                value={studentMarks.int}
                                                onChange={(e) => handleMarksChange(student.id, 'int', e.target.value)}
                                                className={`w-full p-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 ${
                                                    noInternal || !isEligible ? 'bg-slate-100 text-slate-400' :
                                                    isCondoned ? 'border-indigo-300 focus:ring-indigo-500' : ''
                                                }`}
                                                disabled={noInternal || !isEligible}
                                            />
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                        {hasMore && <button onClick={() => setCurrentPage(prev => prev + 1)} className="w-full p-4 bg-emerald-600 text-white rounded-xl font-bold mb-8">Load More</button>}
                    </div>

                    {/* Desktop View */}
                    <div className="hidden md:block bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                        <div className="p-6 border-b border-slate-200 flex items-center justify-between flex-wrap gap-4">
                            <h2 className="text-xl font-black text-slate-900">{selectedSubjectData?.name} - {selectedClass} Class</h2>
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={handleDownloadTemplate}
                                    className="px-4 py-2 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 rounded-xl text-xs font-bold flex items-center gap-2 transition active:scale-95 cursor-pointer"
                                    title="Download INT & EXT Mark Entry Sheet / Template (CSV)"
                                >
                                    <i className="fa-solid fa-file-csv text-emerald-600"></i>
                                    <span>Download Template</span>
                                </button>
                                <button
                                    onClick={handlePrintSheet}
                                    className="px-4 py-2 bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-300 rounded-xl text-xs font-bold flex items-center gap-2 transition active:scale-95 cursor-pointer"
                                    title="Print INT & EXT Mark Entry Sheet / Template"
                                >
                                    <i className="fa-solid fa-print text-slate-600"></i>
                                    <span>Print Sheet</span>
                                </button>
                                <div className="text-sm text-slate-600 font-medium bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200">
                                    {students.length} students
                                </div>
                            </div>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-slate-50">
                                    <tr>
                                        <th className="text-left p-4">Adm No</th><th className="text-left p-4">Student Name</th>
                                        <th className="text-center p-4">EXT ({selectedSubjectData?.maxEXT})</th>
                                        <th className="text-center p-4">INT ({selectedSubjectData?.maxINT})</th>
                                        <th className="text-center p-4">Total</th><th className="text-center p-4">Status</th><th className="text-center p-4">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {students.map((student, index) => (
                                        <StudentRow
                                            key={student.id}
                                            student={student}
                                            index={index}
                                            marks={marksData[student.id] || EMPTY_MARKS}
                                            validationHelpers={validationHelpers}
                                            handleMarksChange={handleMarksChange}
                                            handleKeyDown={handleKeyDown}
                                            handleSaveEXTMarks={handleSaveEXTMarks}
                                            handleSaveINTMarks={handleSaveINTMarks}
                                            handleClearStudentMarks={handleClearStudentMarks}
                                            isSaving={isSaving}
                                            att={attendanceStats[student.id]?.percentage || 0}
                                            selectedSubjectData={selectedSubjectData}
                                            isCondoned={student.condonedTerms?.[activeTerm] === true}
                                            isMarksEntryAllowed={isMarksEntryAllowed}
                                        />
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <div className="p-6 border-t flex justify-between items-center">
                            <div className="text-sm text-slate-600">{completionStats.completed} / {completionStats.total} completed</div>
                            <div className="flex gap-2">
                                <button onClick={() => handleSaveEXTMarks()} className="px-4 py-2 bg-purple-600 text-white rounded-xl font-bold" disabled={isSaving || !isMarksEntryAllowed}>Save EXT</button>
                                <button onClick={() => handleSaveINTMarks()} className="px-4 py-2 bg-blue-600 text-white rounded-xl font-bold" disabled={isSaving || !isMarksEntryAllowed}>Save INT</button>
                                <button onClick={handleClearINTMarks} className="px-4 py-2 border-2 border-orange-200 text-orange-700 rounded-xl font-bold" disabled={isSaving || !isMarksEntryAllowed}>Clear INT</button>
                                <button onClick={handleClearEXTMarks} className="px-4 py-2 border-2 border-red-200 text-red-700 rounded-xl font-bold" disabled={isSaving || !isMarksEntryAllowed}>Clear EXT</button>
                                <button onClick={handleClearAll} className="px-4 py-2 border border-slate-300 rounded-xl font-bold" disabled={isSaving || !isMarksEntryAllowed}>Clear All</button>
                                <button onClick={handleSaveMarks} className={`px-6 py-2 rounded-xl font-bold text-white ${invalidMarksInfo.hasInvalid || !isMarksEntryAllowed ? 'bg-slate-400' : 'bg-emerald-600'}`} disabled={isSaving || invalidMarksInfo.hasInvalid || !isMarksEntryAllowed}>Save All Marks</button>
                            </div>
                        </div>
                    </div>

                    {/* Mobile Action Bar */}
                    <div className={`block md:hidden fixed bottom-0 left-0 right-0 z-50 p-4 bg-white/80 backdrop-blur-md border-t border-slate-200" transition-transform ${isScrolling ? 'translate-y-1' : ''}`}>
                        {showScrollToTop && <button onClick={scrollToTop} className="fixed bottom-32 right-4 w-10 h-10 bg-slate-800/80 text-white rounded-full shadow-lg"><i className="fa-solid fa-chevron-up"></i></button>}
                        <div className="flex justify-between mb-2 px-1 text-xs font-bold text-slate-500">
                             <span>PROGRESS: {completionStats.completed}/{completionStats.total}</span>
                             {invalidMarksInfo.hasInvalid && <span className="text-red-600 animate-pulse">! {invalidMarksInfo.count} INVALID</span>}
                        </div>
                        <div className="flex gap-2">
                            <button onClick={() => handleSaveEXTMarks()} className="flex-1 py-3 bg-purple-600 text-white rounded-lg font-bold text-xs" disabled={isSaving}>Save EXT</button>
                            <button onClick={() => handleSaveINTMarks()} className="flex-1 py-3 bg-blue-600 text-white rounded-lg font-bold text-xs" disabled={isSaving}>Save INT</button>
                        </div>
                        <button onClick={handleSaveMarks} className={`w-full mt-2 py-4 rounded-xl font-black text-white shadow-lg ${invalidMarksInfo.hasInvalid ? 'bg-slate-400' : 'bg-emerald-600'}`} disabled={isSaving || invalidMarksInfo.hasInvalid}>SAVE ALL MARKS</button>
                    </div>
                </div>
            ) : selectedSubject ? (
                <div className="mx-6 md:mx-0 py-12 text-center bg-white rounded-3xl border-2 border-dashed border-slate-300"><i className="fa-solid fa-user-slash text-4xl text-slate-300 mb-4"></i><p className="text-slate-500 font-bold">No students found for this subject/class.</p></div>
            ) : (
                <div className="mx-6 md:mx-0 py-12 text-center bg-white rounded-3xl border-2 border-dashed border-slate-300"><i className="fa-solid fa-hand-pointer text-4xl text-slate-300 mb-4"></i><p className="text-slate-500 font-bold">Please select a class and subject to begin.</p></div>
            )}

            {/* Printable Mark Entry Sheet (Visible only during browser window.print()) */}
            {selectedSubjectData && students.length > 0 && (
                <div className="hidden print:block p-6 bg-white text-black font-sans text-xs">
                    {/* Header Banner */}
                    <div className="text-center border-b-2 border-black pb-4 mb-4">
                        <h1 className="text-2xl font-black uppercase tracking-wider text-black">AIC DA'WA COLLEGE EXAM PORTAL</h1>
                        <h2 className="text-sm font-bold uppercase tracking-widest text-black mt-1">OFFICIAL MARK ENTRY SHEET / REGISTER</h2>
                    </div>

                    {/* Info / Metadata Grid */}
                    <div className="grid grid-cols-3 gap-2 border border-black p-3 mb-4 text-xs bg-white">
                        <div><strong>Class:</strong> {selectedClass}</div>
                        <div><strong>Subject:</strong> {selectedSubjectData.name} {selectedSubjectData.arabicName ? `(${selectedSubjectData.arabicName})` : ''}</div>
                        <div><strong>Term:</strong> {activeTerm}</div>
                        <div><strong>Faculty:</strong> {selectedSubjectData.facultyName || 'N/A'}</div>
                        <div><strong>Max EXT:</strong> {selectedSubjectData.maxEXT} (Min: {Math.ceil(selectedSubjectData.maxEXT * 0.4)})</div>
                        <div><strong>Max INT:</strong> {selectedSubjectData.maxINT} (Min: {Math.ceil(selectedSubjectData.maxINT * 0.5)})</div>
                        <div><strong>Total Students:</strong> {students.length}</div>
                        <div><strong>Passing Rule:</strong> INT &ge; 50% &amp; EXT &ge; 40%</div>
                        <div><strong>Date Generated:</strong> {new Date().toLocaleDateString()}</div>
                    </div>

                    {/* Student Marks Table - Preserves exact list and order as in Mark Entry */}
                    <table className="w-full border-collapse border border-black text-xs">
                        <thead>
                            <tr className="border-b-2 border-black font-bold text-center bg-white">
                                <th className="border border-black p-1.5 w-10">Sl No</th>
                                <th className="border border-black p-1.5 w-24">Adm No</th>
                                <th className="border border-black p-1.5 text-left">Student Name</th>
                                <th className="border border-black p-1.5 w-20">EXT ({selectedSubjectData.maxEXT})</th>
                                <th className="border border-black p-1.5 w-20">INT ({selectedSubjectData.maxINT})</th>
                                <th className="border border-black p-1.5 w-16">Total</th>
                                <th className="border border-black p-1.5 w-20">Status</th>
                                <th className="border border-black p-1.5 w-28">Signature</th>
                            </tr>
                        </thead>
                        <tbody>
                            {students.map((student, idx) => {
                                const studentMarks = marksData[student.id] || { int: '', ext: '' };
                                const total = validationHelpers?.calculateTotal(studentMarks.int, studentMarks.ext) || '';
                                const status = validationHelpers?.getStatus(studentMarks.int, studentMarks.ext) || 'Pending';

                                return (
                                    <tr key={student.id} className="border-b border-black text-center">
                                        <td className="border border-black p-1 font-mono">{idx + 1}</td>
                                        <td className="border border-black p-1 font-mono font-semibold">{student.adNo}</td>
                                        <td className="border border-black p-1 text-left font-medium">{student.name}</td>
                                        <td className="border border-black p-1 font-mono">{studentMarks.ext || ''}</td>
                                        <td className="border border-black p-1 font-mono">{studentMarks.int || ''}</td>
                                        <td className="border border-black p-1 font-mono font-bold">{studentMarks.int && studentMarks.ext ? total : ''}</td>
                                        <td className="border border-black p-1 font-semibold">{status}</td>
                                        <td className="border border-black p-1"></td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>

                    {/* Footer Signatures */}
                    <div className="mt-12 flex justify-between items-end text-xs pt-6">
                        <div className="text-center w-48 border-t border-black pt-1">
                            <p className="font-bold">Faculty Signature</p>
                            <p className="text-[10px]">({selectedSubjectData.facultyName || 'Subject Teacher'})</p>
                        </div>
                        <div className="text-center w-48 border-t border-black pt-1">
                            <p className="font-bold">Verified By</p>
                            <p className="text-[10px]">(HOD / Coordinator)</p>
                        </div>
                        <div className="text-center w-48 border-t border-black pt-1">
                            <p className="font-bold">Controller of Examinations</p>
                            <p className="text-[10px]">(Seal & Signature)</p>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default MarksEntryTab;
