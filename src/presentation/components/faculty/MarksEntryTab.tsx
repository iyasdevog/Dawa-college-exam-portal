import React from 'react';
import { StudentRecord, SubjectConfig } from '../../../domain/entities/types';
import OfflineStatusIndicator from '../OfflineStatusIndicator';
import { shortenSubjectName } from '../../../infrastructure/services/formatUtils';

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
    return (
        <>
            <div className="flex gap-2 mb-6">
                <button className="px-6 py-2 rounded-t-lg font-bold text-sm bg-emerald-600 text-white shadow-md transition-all">
                    Regular Marks Entry
                </button>
            </div>

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

                            return (
                                <div key={student.id} ref={el => { if(studentRefs.current) studentRefs.current[student.id] = el; }} className={`bg-white rounded-xl p-3 border border-slate-200 shadow-sm transition-all ${isCurrent ? 'ring-2 ring-emerald-500 bg-emerald-50/50' : ''}`}>
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="flex flex-col"><h3 className="font-bold text-slate-900 text-sm leading-tight">{student.name}</h3><p className="text-[10px] uppercase font-black text-slate-400">ADM: {student.adNo}</p></div>
                                        <span className="px-2 py-0.5 bg-slate-200 text-slate-600 rounded text-[10px] font-bold">{index + 1} / {students.length}</span>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-xs font-medium text-slate-600 mb-1">EXT (Max: {selectedSubjectData?.maxEXT})</label>
                                            <input type="text" value={studentMarks.ext} onChange={(e) => handleMarksChange(student.id, 'ext', e.target.value)} className={`w-full p-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 ${attendance < 75 ? 'bg-red-50 border-red-200 text-red-400' : ''}`} disabled={attendance < 75} />
                                            <div className={`mt-1 text-[10px] font-bold ${attendance < 75 ? 'text-red-600' : 'text-emerald-600'}`}>Attendance: {attendance.toFixed(0)}%</div>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-slate-600 mb-1">INT (Max: {selectedSubjectData?.maxINT})</label>
                                            <input type="text" value={studentMarks.int} onChange={(e) => handleMarksChange(student.id, 'int', e.target.value)} className={`w-full p-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 ${selectedSubjectData?.maxEXT === 100 || attendance < 75 ? 'bg-slate-100 text-slate-400' : ''}`} disabled={selectedSubjectData?.maxEXT === 100 || attendance < 75} />
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                        {hasMore && <button onClick={() => setCurrentPage(prev => prev + 1)} className="w-full p-4 bg-emerald-600 text-white rounded-xl font-bold mb-8">Load More</button>}
                    </div>

                    {/* Desktop View */}
                    <div className="hidden md:block bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                        <div className="p-6 border-b border-slate-200 flex items-center justify-between">
                            <h2 className="text-xl font-black text-slate-900">{selectedSubjectData?.name} - {selectedClass} Class</h2>
                            <div className="text-sm text-slate-600">{students.length} students</div>
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
                                    {students.map((student, index) => {
                                        const total = validationHelpers?.calculateTotal(student.id) || 0;
                                        const status = validationHelpers?.getStatus(student.id) || 'Pending';
                                        const att = attendanceStats[student.id]?.percentage || 0;
                                        return (
                                            <tr key={student.id} className={index % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                                                <td className="p-4">{student.adNo}</td><td className="p-4">{student.name}</td>
                                                <td className="p-4 text-center">
                                                    <input type="text" value={marksData[student.id]?.ext || ''} onChange={(e) => handleMarksChange(student.id, 'ext', e.target.value)} onKeyDown={(e) => handleKeyDown(e, student.id, 'ext')} className={`w-20 p-2 border-2 rounded-xl text-center ${att < 75 ? 'bg-red-50 opacity-60' : ''}`} disabled={att < 75 || isSaving} />
                                                </td>
                                                <td className="p-4 text-center">
                                                    <input type="text" value={marksData[student.id]?.int || ''} onChange={(e) => handleMarksChange(student.id, 'int', e.target.value)} onKeyDown={(e) => handleKeyDown(e, student.id, 'int')} className={`w-20 p-2 border-2 rounded-xl text-center ${selectedSubjectData?.maxEXT === 100 || att < 75 ? 'bg-slate-100 opacity-60' : ''}`} disabled={selectedSubjectData?.maxEXT === 100 || att < 75 || isSaving} />
                                                </td>
                                                <td className="p-4 text-center font-bold">{marksData[student.id]?.int && marksData[student.id]?.ext ? total : '-'}</td>
                                                <td className="p-4 text-center"><span className={`px-2 py-1 rounded-full text-xs ${status === 'Passed' ? 'bg-emerald-100 text-emerald-700' : status === 'Failed' ? 'bg-red-100 text-red-700' : 'bg-slate-100'}`}>{status}</span></td>
                                                <td className="p-4 text-center">
                                                    <div className="flex flex-col gap-1">
                                                        <div className="flex gap-1">
                                                            <button onClick={() => handleSaveEXTMarks(student.id)} className="flex-1 bg-sky-50 text-sky-700 px-2 py-1 rounded text-xs" disabled={isSaving || !marksData[student.id]?.ext}>Save EXT</button>
                                                            <button onClick={() => handleSaveINTMarks(student.id)} className="flex-1 bg-indigo-50 text-indigo-700 px-2 py-1 rounded text-xs" disabled={isSaving || !marksData[student.id]?.int}>Save INT</button>
                                                        </div>
                                                        <button onClick={() => handleClearStudentMarks(student.id, student.name)} className="bg-red-50 text-red-600 rounded text-xs p-1" disabled={isSaving || (!marksData[student.id]?.int && !marksData[student.id]?.ext)}>Clear ALL</button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                        <div className="p-6 border-t flex justify-between items-center">
                            <div className="text-sm text-slate-600">{completionStats.completed} / {completionStats.total} completed</div>
                            <div className="flex gap-2">
                                <button onClick={() => handleSaveEXTMarks()} className="px-4 py-2 bg-purple-600 text-white rounded-xl font-bold" disabled={isSaving}>Save EXT</button>
                                <button onClick={() => handleSaveINTMarks()} className="px-4 py-2 bg-blue-600 text-white rounded-xl font-bold" disabled={isSaving}>Save INT</button>
                                <button onClick={handleClearINTMarks} className="px-4 py-2 border-2 border-orange-200 text-orange-700 rounded-xl font-bold" disabled={isSaving}>Clear INT</button>
                                <button onClick={handleClearEXTMarks} className="px-4 py-2 border-2 border-red-200 text-red-700 rounded-xl font-bold" disabled={isSaving}>Clear EXT</button>
                                <button onClick={handleClearAll} className="px-4 py-2 border border-slate-300 rounded-xl font-bold" disabled={isSaving}>Clear All</button>
                                <button onClick={handleSaveMarks} className={`px-6 py-2 rounded-xl font-bold text-white ${invalidMarksInfo.hasInvalid ? 'bg-red-600' : 'bg-emerald-600'}`} disabled={isSaving || invalidMarksInfo.hasInvalid}>Save All Marks</button>
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
                        <button onClick={handleSaveMarks} className={`w-full mt-2 py-4 rounded-xl font-black text-white shadow-lg ${invalidMarksInfo.hasInvalid ? 'bg-red-600' : 'bg-emerald-600'}`} disabled={isSaving || invalidMarksInfo.hasInvalid}>SAVE ALL MARKS</button>
                    </div>
                </div>
            ) : selectedSubject ? (
                <div className="mx-6 md:mx-0 py-12 text-center bg-white rounded-3xl border-2 border-dashed border-slate-300"><i className="fa-solid fa-user-slash text-4xl text-slate-300 mb-4"></i><p className="text-slate-500 font-bold">No students found for this subject/class.</p></div>
            ) : (
                <div className="mx-6 md:mx-0 py-12 text-center bg-white rounded-3xl border-2 border-dashed border-slate-300"><i className="fa-solid fa-hand-pointer text-4xl text-slate-300 mb-4"></i><p className="text-slate-500 font-bold">Please select a class and subject to begin.</p></div>
            )}
        </>
    );
};

export default MarksEntryTab;
