import React, { useState, useEffect, useMemo, useRef } from 'react';
import { SupplementaryExam, StudentRecord, SubjectConfig, SupplementaryExamType } from '../../../domain/entities/types';
import { dataService } from '../../../infrastructure/services/dataService';
import { useTerm } from '../../viewmodels/TermContext';

interface SupplementaryManagementProps {
    supplementaryExams: any[]; // Using any[] based on original component handling of enriched exams
    students: StudentRecord[];
    subjects: SubjectConfig[];
    onRefresh: () => Promise<void>;
}

const SupplementaryManagement: React.FC<SupplementaryManagementProps> = ({ supplementaryExams, students, subjects, onRefresh }) => {
    const { activeTerm } = useTerm();
    // Searchable dropdown state
    const [studentSearchTerm, setStudentSearchTerm] = useState('');
    const [showStudentDropdown, setShowStudentDropdown] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Filter students based on search term (name or adNo)
    const filteredSearchStudents = useMemo(() => {
        if (!studentSearchTerm.trim()) {
            return students.sort((a, b) => a.name.localeCompare(b.name));
        }
        const term = studentSearchTerm.toLowerCase();
        return students
            .filter(s => s.name.toLowerCase().includes(term) || s.adNo.toLowerCase().includes(term))
            .sort((a, b) => a.name.localeCompare(b.name));
    }, [students, studentSearchTerm]);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setShowStudentDropdown(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const [isOperating, setIsOperating] = useState(false);
    const [showSupplementaryForm, setShowSupplementaryForm] = useState(false);
    const [activeTab, setActiveTab] = useState<SupplementaryExamType | 'All' | 'revaluation' | 'improvement' | 'external-supp' | 'internal-supp' | 'special-supp'>('All');
    
    // Form state for adding new supplementary
    const [supplementaryForm, setSupplementaryForm] = useState({
        studentId: '',
        subjectId: '',
        examType: 'CurrentSemester' as SupplementaryExamType,
        originalSemester: 'Odd' as 'Odd' | 'Even',
        originalYear: new Date().getFullYear() - 1,
        supplementaryYear: new Date().getFullYear()
    });
    
    // Filtering state
    const [classFilter, setClassFilter] = useState('All');
    const [subjectFilter, setSubjectFilter] = useState('All');
    const [statusFilter, setStatusFilter] = useState('All');
    const [attemptFilter, setAttemptFilter] = useState('All');
    const [searchTerm, setSearchTerm] = useState('');

    // Mark Entry Modal State
    const [showMarkEntryModal, setShowMarkEntryModal] = useState(false);
    const [editingExam, setEditingExam] = useState<any>(null);
    const [markEntryForm, setMarkEntryForm] = useState({
        int: '',
        ext: '',
        prevInt: '',
        prevExt: '',
        attemptNumber: 1,
        originalTerm: ''
    });
    const [editingExamHistory, setEditingExamHistory] = useState<SupplementaryExam[]>([]);

    // Summary Statistics - Now based on filtered list for better clarity per tab
    const stats = useMemo(() => {
        // Decide which set to use for stats. If on "All" tab, use everything.
        // If on a specific tab, use the exams matching THAT tab (before other filters like class/subject)
        const tabExams = activeTab === 'All' 
            ? supplementaryExams 
            : supplementaryExams.filter(exam => {
                const appType = (exam.applicationType || '').toLowerCase();
                if (activeTab === 'PreviousYear') return exam.examType === 'PreviousYear';
                if (activeTab === 'revaluation') return appType === 'revaluation';
                if (activeTab === 'improvement') return appType === 'improvement';
                if (activeTab === 'external-supp') return appType === 'external-supp';
                if (activeTab === 'internal-supp') return appType === 'internal-supp';
                if (activeTab === 'special-supp') return appType === 'special-supp';
                if (activeTab === 'CurrentSemester') {
                    // Inclusion logic: Semester (Supp) now shows everything except Reval/Improvement
                    return exam.examType === 'CurrentSemester' && 
                           !['revaluation', 'improvement'].includes(appType);
                }
                return false;
            });

        return {
            total: tabExams.length,
            pending: tabExams.filter(e => e.status === 'Pending').length,
            completed: tabExams.filter(e => e.status === 'Completed').length,
            passed: tabExams.filter(e => e.marks?.status === 'Passed').length,
            failed: tabExams.filter(e => e.marks?.status === 'Failed').length
        };
    }, [supplementaryExams, activeTab]);

    const handleAddSupplementaryExam = () => {
        setSupplementaryForm({
            studentId: '',
            subjectId: '',
            examType: 'CurrentSemester',
            originalSemester: 'Odd',
            originalYear: new Date().getFullYear() - 1,
            supplementaryYear: new Date().getFullYear()
        });
        setShowSupplementaryForm(true);
    };

    const handleOpenMarkEntry = async (exam: any) => {
        setEditingExam(exam);
        setMarkEntryForm({
            int: exam.marks?.int?.toString() || '',
            ext: exam.marks?.ext?.toString() || '',
            prevInt: exam.previousMarks?.int?.toString() || '',
            prevExt: exam.previousMarks?.ext?.toString() || '',
            attemptNumber: exam.attemptNumber || 1,
            originalTerm: exam.originalTerm || ''
        });
        
        // Fetch history for this student and subject
        try {
            const history = await dataService.getSupplementaryExamHistory(exam.studentId, exam.subjectId);
            setEditingExamHistory(history);
        } catch (error) {
            console.error('Error fetching exam history:', error);
            setEditingExamHistory([]);
        }
        
        setShowMarkEntryModal(true);
    };

    const handleSaveMarks = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingExam) return;

        try {
            setIsOperating(true);
            const subject = subjects.find(s => s.id === editingExam.subjectId);
            if (!subject) throw new Error('Subject not found');

            const parseMark = (markStr: string): number | 'A' => {
                const trimmed = markStr.trim().toUpperCase();
                if (trimmed === 'A') return 'A';
                const num = parseInt(trimmed, 10);
                return isNaN(num) ? 0 : num;
            };

            const intVal = markEntryForm.int ? parseMark(markEntryForm.int) : 0;
            const extVal = markEntryForm.ext ? parseMark(markEntryForm.ext) : 0;
            const totalNum = (intVal === 'A' ? 0 : intVal) + (extVal === 'A' ? 0 : extVal);

            const prevIntVal = markEntryForm.prevInt ? parseMark(markEntryForm.prevInt) : 0;
            const prevExtVal = markEntryForm.prevExt ? parseMark(markEntryForm.prevExt) : 0;

            // Calculate Status
            const minINT = Math.ceil(subject.maxINT * 0.5);
            const minEXT = Math.ceil(subject.maxEXT * 0.4);
            const passedINT = intVal !== 'A' && typeof intVal === 'number' && intVal >= minINT;
            const passedEXT = extVal !== 'A' && typeof extVal === 'number' && extVal >= minEXT;
            const status = (passedINT && passedEXT) ? 'Passed' : 'Failed';

            await dataService.updateSupplementaryExamMarks(
                editingExam.id, 
                {
                    int: intVal,
                    ext: extVal,
                    total: totalNum,
                    status,
                },
                {
                    int: prevIntVal,
                    ext: prevExtVal
                },
                markEntryForm.attemptNumber,
                markEntryForm.originalTerm
            );

            await onRefresh();
            setShowMarkEntryModal(false);
            alert('Marks updated successfully!');
        } catch (error) {
            console.error('Error saving marks:', error);
            alert('Error saving marks.');
        } finally {
            setIsOperating(false);
        }
    };

    const handleSaveSupplementaryExam = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!supplementaryForm.studentId || !supplementaryForm.subjectId) return;

        try {
            setIsOperating(true);
            const newSupplementaryExam: Omit<SupplementaryExam, 'id'> = {
                studentId: supplementaryForm.studentId,
                subjectId: supplementaryForm.subjectId,
                examType: supplementaryForm.examType,
                originalSemester: supplementaryForm.originalSemester,
                originalYear: supplementaryForm.originalYear,
                supplementaryYear: supplementaryForm.supplementaryYear,
                status: 'Pending',
                examTerm: activeTerm
            };

            await dataService.addSupplementaryExam(newSupplementaryExam);
            await onRefresh();
            setShowSupplementaryForm(false);
            alert('Supplementary exam added successfully!');
        } catch (error) {
            console.error('Error saving supplementary exam:', error);
            alert('Error saving supplementary exam.');
        } finally {
            setIsOperating(false);
        }
    };

    const handleDeleteSupplementaryExam = async (supplementaryExamId: string) => {
        if (!confirm('Are you sure you want to delete this supplementary exam?')) return;
        try {
            setIsOperating(true);
            await dataService.deleteSupplementaryExam(supplementaryExamId);
            await onRefresh();
            alert('Supplementary exam deleted successfully!');
        } catch (error) {
            alert('Error deleting supplementary exam.');
        } finally {
            setIsOperating(false);
        }
    };

    const filteredExams = useMemo(() => {
        return supplementaryExams.filter(exam => {
            // Lifecycle Filter: Keep records visible even if passed, but allow status filtering.
            // if (exam.status === 'Completed' && exam.marks?.status === 'Passed') return false;

            const appType = (exam.applicationType || '').toLowerCase();
            const matchesTab = activeTab === 'All' 
                || (activeTab === 'PreviousYear' && exam.examType === 'PreviousYear')
                || (activeTab === 'revaluation' && appType === 'revaluation')
                || (activeTab === 'improvement' && appType === 'improvement')
                || (activeTab === 'external-supp' && appType === 'external-supp')
                || (activeTab === 'internal-supp' && appType === 'internal-supp')
                || (activeTab === 'special-supp' && appType === 'special-supp')
                || (activeTab === 'CurrentSemester' && exam.examType === 'CurrentSemester' && !['revaluation', 'improvement'].includes(appType));
            const matchesClass = classFilter === 'All' || exam.studentClass === classFilter;
            const matchesSubject = subjectFilter === 'All' || exam.subjectId === subjectFilter;
            const matchesStatus = statusFilter === 'All' || exam.status === statusFilter;
            const matchesAttempt = attemptFilter === 'All' || exam.attemptNumber?.toString() === attemptFilter;
            const matchesSearch = !searchTerm.trim() || 
                exam.studentName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                exam.studentAdNo?.toLowerCase().includes(searchTerm.toLowerCase());
            
            return matchesTab && matchesClass && matchesSubject && matchesStatus && matchesAttempt && matchesSearch;
        });
    }, [supplementaryExams, activeTab, classFilter, subjectFilter, statusFilter, attemptFilter, searchTerm]);


    const uniqueClassesInSupp = useMemo(() => {
        return Array.from(new Set(supplementaryExams.map(e => e.studentClass).filter(Boolean))).sort();
    }, [supplementaryExams]);

    const uniqueSubjectsInSupp = useMemo(() => {
        const subjectIds = Array.from(new Set(supplementaryExams.map(e => e.subjectId)));
        return subjects.filter(s => subjectIds.includes(s.id)).sort((a, b) => a.name.localeCompare(b.name));
    }, [supplementaryExams, subjects]);

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <div className="flex items-center gap-3">
                        <h2 className="text-xl font-black text-slate-900">Supplementary Exams</h2>
                        {activeTerm && (
                            <span className="text-xs px-3 py-1 rounded-full font-bold border bg-emerald-50 text-emerald-700 border-emerald-200 whitespace-nowrap shadow-sm">
                                {activeTerm}
                            </span>
                        )}
                    </div>
                    <p className="text-sm text-slate-500">Manage re-entries and regular supplementary exams</p>
                </div>
                <button
                    onClick={handleAddSupplementaryExam}
                    disabled={isOperating}
                    className="px-4 py-2 bg-orange-600 text-white rounded-xl font-bold hover:bg-orange-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                    <i className="fa-solid fa-plus"></i>
                    Add Supplementary Exam
                </button>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-8 h-8 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center">
                            <i className="fa-solid fa-clipboard-list text-sm"></i>
                        </div>
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Registered</span>
                    </div>
                    <div className="text-2xl font-black text-slate-900">{stats.total}</div>
                </div>
                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-8 h-8 bg-orange-50 text-orange-600 rounded-lg flex items-center justify-center">
                            <i className="fa-solid fa-clock text-sm"></i>
                        </div>
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Pending Marks</span>
                    </div>
                    <div className="text-2xl font-black text-slate-900">{stats.pending}</div>
                </div>
                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-8 h-8 bg-emerald-50 text-emerald-600 rounded-lg flex items-center justify-center">
                            <i className="fa-solid fa-check-double text-sm"></i>
                        </div>
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Completed</span>
                    </div>
                    <div className="text-2xl font-black text-slate-900">{stats.completed}</div>
                </div>
                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-8 h-8 bg-purple-50 text-purple-600 rounded-lg flex items-center justify-center">
                            <i className="fa-solid fa-chart-line text-sm"></i>
                        </div>
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Pass Rate</span>
                    </div>
                    <div className="text-2xl font-black text-slate-900">
                        {stats.completed > 0 ? Math.round((stats.passed / stats.completed) * 100) : 0}%
                    </div>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                <div className="flex flex-col md:flex-row gap-4">
                    <div className="flex-1 relative">
                        <i className="fa-solid fa-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"></i>
                        <input
                            type="text"
                            placeholder="Search student name or admission number..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-emerald-500 transition-all"
                        />
                    </div>
                    <div className="flex flex-wrap items-center gap-3">

                        <select
                            value={classFilter}
                            onChange={(e) => setClassFilter(e.target.value)}
                            className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-bold focus:ring-2 focus:ring-orange-500 outline-none"
                        >
                            <option value="All">All Classes</option>
                            {uniqueClassesInSupp.map(cls => (
                                <option key={cls} value={cls}>{cls}</option>
                            ))}
                        </select>
                        <select 
                            value={subjectFilter}
                            onChange={(e) => setSubjectFilter(e.target.value)}
                            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 focus:outline-none focus:border-emerald-500"
                        >
                            <option value="All">All Subjects</option>
                            {uniqueSubjectsInSupp.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                        <select 
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 focus:outline-none focus:border-emerald-500"
                        >
                            <option value="All">All Status</option>
                            <option value="Completed">Completed</option>
                        </select>
                        <select 
                            value={attemptFilter}
                            onChange={(e) => setAttemptFilter(e.target.value)}
                            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 focus:outline-none focus:border-emerald-500"
                        >
                            <option value="All">All Attempts</option>
                            <option value="1">1st Attempt</option>
                            <option value="2">2nd Attempt</option>
                            <option value="3">3rd Attempt</option>
                            <option value="4">4th Attempt</option>
                            <option value="5">5th+ Attempt</option>
                        </select>
                    </div>
                </div>

                <div className="flex p-1 bg-slate-100 rounded-xl w-fit flex-wrap gap-1">
                    {(['All', 'CurrentSemester', 'external-supp', 'internal-supp', 'special-supp', 'PreviousYear', 'revaluation', 'improvement'] as const).map(tab => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === tab
                                ? 'bg-white text-emerald-600 shadow-sm'
                                : 'text-slate-600 hover:text-slate-900'
                                }`}
                        >
                            {tab === 'All' ? 'All Exams' : 
                             tab === 'PreviousYear' ? 'Repeat' : 
                             tab === 'CurrentSemester' ? 'Regular Supp' :
                             tab === 'revaluation' ? 'Revaluation' : 
                             tab === 'improvement' ? 'Improvement' :
                             tab === 'external-supp' ? 'External' :
                             tab === 'internal-supp' ? 'Internal' : 'Special'}
                        </button>
                    ))}
                </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="overflow-x-auto">
                    {filteredExams.length > 0 ? (
                        <table className="w-full">
                            <thead className="bg-slate-50 border-b border-slate-200">
                                <tr>
                                    <th className="text-left p-4 font-bold text-slate-700">Student</th>
                                    <th className="text-left p-4 font-bold text-slate-700">Subject</th>
                                    <th className="text-center p-4 font-bold text-slate-700">Type</th>
                                    <th className="text-center p-4 font-bold text-slate-700">Exam Period</th>
                                    <th className="text-center p-4 font-bold text-slate-700">Original Marks</th>
                                    <th className="text-center p-4 font-bold text-slate-700">New Marks</th>
                                    <th className="text-center p-4 font-bold text-slate-700">Result</th>
                                    <th className="text-center p-4 font-bold text-slate-700">Status</th>
                                    <th className="text-center p-4 font-bold text-slate-700">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {filteredExams.map((suppExam, index) => (
                                    <tr key={suppExam.id} className="hover:bg-slate-50 transition-colors">
                                        <td className="p-4">
                                            <div className="font-bold text-slate-900">{suppExam.studentName}</div>
                                            <div className="text-xs text-slate-500">{suppExam.studentAdNo}</div>
                                        </td>
                                        <td className="p-4">
                                            <div className="font-medium text-slate-700">{suppExam.subjectName}</div>
                                        </td>
                                        <td className="p-4 text-center">
                                            <div className="flex flex-col items-center gap-1">
                                                <span className={`px-2 py-1 rounded-md text-[10px] uppercase font-black ${suppExam.examType === 'PreviousYear'
                                                    ? 'bg-purple-50 text-purple-700 border border-purple-100'
                                                    : suppExam.applicationType === 'special-supp'
                                                        ? 'bg-rose-50 text-rose-700 border border-rose-100'
                                                        : suppExam.applicationType === 'revaluation'
                                                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                                                            : suppExam.applicationType === 'improvement'
                                                                ? 'bg-cyan-50 text-cyan-700 border border-cyan-100'
                                                                : 'bg-blue-50 text-blue-700 border border-blue-100'
                                                    }`}>
                                                    {suppExam.examType === 'PreviousYear'
                                                        ? 'Repeat'
                                                        : suppExam.applicationType === 'special-supp'
                                                            ? 'Special Supply'
                                                            : suppExam.applicationType === 'revaluation'
                                                                ? 'Revaluation'
                                                                : suppExam.applicationType === 'improvement'
                                                                    ? 'Improvement'
                                                                    : 'Semester'}
                                                </span>
                                                {suppExam.attemptNumber > 1 && (
                                                    <span className="px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-100 rounded text-[9px] font-black uppercase">
                                                        Attempt {suppExam.attemptNumber}
                                                    </span>
                                                )}
                                                {suppExam.originalTerm && (
                                                    <span className="text-[9px] text-slate-400 font-medium">
                                                        Failed In: {suppExam.originalTerm}
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="p-4 text-center">
                                            <div className="text-[10px] font-bold text-slate-500 uppercase">{suppExam.examTerm}</div>
                                            <div className="text-[9px] text-slate-400 font-medium">Attempt {suppExam.attemptNumber || 1}</div>
                                        </td>
                                        <td className="p-4 text-center">
                                            {suppExam.previousMarks ? (
                                                <div className="font-mono text-xs text-slate-500">
                                                    INT: {suppExam.previousMarks.int} | EXT: {suppExam.previousMarks.ext}
                                                </div>
                                            ) : (
                                                <span className="text-slate-300 text-xs">-</span>
                                            )}
                                        </td>
                                        <td className="p-4 text-center">
                                            <div className="font-mono text-sm font-bold text-slate-700">
                                                {suppExam.marks?.int ?? '-'} / {suppExam.marks?.ext ?? '-'}
                                            </div>
                                            <div className="text-[10px] text-slate-400 font-bold uppercase">Update: {suppExam.marks?.total ?? '-'}</div>
                                        </td>
                                        <td className="p-4 text-center">
                                            {suppExam.marks ? (
                                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${suppExam.marks.status === 'Passed' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                                                    {suppExam.marks.status}
                                                </span>
                                            ) : '-'}
                                        </td>
                                        <td className="p-4 text-center">
                                            <span className={`px-3 py-1 rounded-full text-xs font-bold ${suppExam.status === 'Completed'
                                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                                                : 'bg-orange-50 text-orange-700 border border-orange-100'
                                                }`}>
                                                {suppExam.status}
                                            </span>
                                        </td>
                                        <td className="p-4 text-center">
                                            <div className="flex items-center justify-center gap-2">
                                                <button
                                                    onClick={() => handleOpenMarkEntry(suppExam)}
                                                    className="w-8 h-8 rounded-lg text-emerald-600 hover:bg-emerald-50 transition-all flex items-center justify-center"
                                                    title="Enter Marks"
                                                >
                                                    <i className="fa-solid fa-pen-to-square"></i>
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteSupplementaryExam(suppExam.id)}
                                                    className="w-8 h-8 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-all flex items-center justify-center"
                                                    title="Delete"
                                                >
                                                    <i className="fa-solid fa-trash"></i>
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    ) : (
                        <div className="text-center py-12 px-4">
                            <div className="w-16 h-16 bg-slate-50 text-slate-300 rounded-full flex items-center justify-center mx-auto mb-4">
                                <i className="fa-solid fa-folder-open text-2xl"></i>
                            </div>
                            <h3 className="text-lg font-bold text-slate-900 mb-1">No Records Found</h3>
                            <p className="text-slate-500 text-sm max-w-xs mx-auto mb-6">
                                No supplementary exams match the current filter criteria for {activeTab === 'All' ? 'any type' : activeTab}.
                            </p>
                            <div className="flex items-center justify-center gap-3">
                                <button
                                    onClick={() => {
                                        setClassFilter('All');
                                        setSubjectFilter('All');
                                        setStatusFilter('All');
                                        setAttemptFilter('All');
                                        setSearchTerm('');
                                    }}
                                    className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl font-bold hover:bg-slate-200 transition-all text-sm"
                                >
                                    <i className="fa-solid fa-filter-circle-xmark mr-2"></i>
                                    Clear Filters
                                </button>
                                {activeTab !== 'All' && (
                                    <button
                                        onClick={() => setActiveTab('All')}
                                        className="px-4 py-2 bg-emerald-50 text-emerald-700 rounded-xl font-bold hover:bg-emerald-100 transition-all text-sm"
                                    >
                                        View All Types
                                    </button>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Supplementary Form Modal */}
            {showSupplementaryForm && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-[60]">
                    <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
                        <div className="bg-orange-600 p-6 text-white">
                            <h3 className="text-2xl font-black">Register Supplementary</h3>
                            <p className="text-orange-100">Add a student for repetition or semester supplementary</p>
                        </div>

                        <form onSubmit={handleSaveSupplementaryExam} className="p-6 space-y-6">
                            <div className="grid grid-cols-2 gap-4 p-1 bg-slate-100 rounded-xl">
                                <button
                                    type="button"
                                    onClick={() => setSupplementaryForm(prev => ({ ...prev, examType: 'CurrentSemester' }))}
                                    className={`py-2 rounded-lg text-sm font-bold transition-all ${supplementaryForm.examType === 'CurrentSemester'
                                        ? 'bg-white text-orange-600 shadow-sm'
                                        : 'text-slate-600'
                                        }`}
                                >
                                    Current Sem Failed
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setSupplementaryForm(prev => ({ ...prev, examType: 'PreviousYear' }))}
                                    className={`py-2 rounded-lg text-sm font-bold transition-all ${supplementaryForm.examType === 'PreviousYear'
                                        ? 'bg-white text-orange-600 shadow-sm'
                                        : 'text-slate-600'
                                        }`}
                                >
                                    Repeat (Prev Year)
                                </button>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-1">Student</label>
                                    <div className="relative" ref={dropdownRef}>
                                        <div 
                                            className="w-full p-3 bg-slate-50 border-2 border-slate-100 rounded-2xl focus-within:border-orange-500 transition-all font-medium flex items-center justify-between cursor-pointer"
                                            onClick={() => setShowStudentDropdown(!showStudentDropdown)}
                                        >
                                            <span className={supplementaryForm.studentId ? 'text-slate-900' : 'text-slate-500'}>
                                                {supplementaryForm.studentId 
                                                    ? `${students.find(s => s.id === supplementaryForm.studentId)?.name} (${students.find(s => s.id === supplementaryForm.studentId)?.adNo})`
                                                    : 'Search by Name or Ad.No...'}
                                            </span>
                                            <i className={`fa-solid fa-chevron-down text-slate-400 transition-transform ${showStudentDropdown ? 'rotate-180' : ''}`}></i>
                                        </div>

                                        {showStudentDropdown && (
                                            <div className="absolute z-[70] w-full mt-2 bg-white border border-slate-200 rounded-xl shadow-xl max-h-60 flex flex-col overflow-hidden">
                                                <div className="p-2 border-b border-slate-100 bg-slate-50">
                                                    <div className="relative">
                                                        <i className="fa-solid fa-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"></i>
                                                        <input 
                                                            type="text" 
                                                            placeholder="Type to search..." 
                                                            value={studentSearchTerm}
                                                            onChange={(e) => setStudentSearchTerm(e.target.value)}
                                                            className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
                                                            autoFocus
                                                        />
                                                    </div>
                                                </div>
                                                <div className="overflow-y-auto flex-1 p-1 option-list">
                                                    {filteredSearchStudents.length > 0 ? (
                                                        filteredSearchStudents.map(s => (
                                                            <div 
                                                                key={s.id}
                                                                className={`px-4 py-3 hover:bg-orange-50 cursor-pointer rounded-lg flex items-center justify-between ${supplementaryForm.studentId === s.id ? 'bg-orange-50 text-orange-700 font-bold' : 'text-slate-700'}`}
                                                                onClick={() => {
                                                                    setSupplementaryForm(prev => ({ ...prev, studentId: s.id }));
                                                                    setShowStudentDropdown(false);
                                                                    setStudentSearchTerm('');
                                                                }}
                                                            >
                                                                <span>{s.name}</span>
                                                                <span className="text-xs bg-white px-2 py-0.5 rounded shadow-sm border border-slate-100 text-slate-500 font-medium">
                                                                    {s.adNo}
                                                                </span>
                                                            </div>
                                                        ))
                                                    ) : (
                                                        <div className="p-4 text-center text-sm text-slate-500">
                                                            No students found matching "{studentSearchTerm}"
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-1">Subject</label>
                                    <select
                                        value={supplementaryForm.subjectId}
                                        onChange={e => setSupplementaryForm(prev => ({ ...prev, subjectId: e.target.value }))}
                                        className="w-full p-3 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-orange-500 outline-none transition-all font-medium"
                                        required
                                    >
                                        <option value="">Select Subject</option>
                                        {subjects.sort((a, b) => a.name.localeCompare(b.name)).map(s => (
                                            <option key={s.id} value={s.id}>{s.name}</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 mb-1">Org. Semester</label>
                                        <select
                                            value={supplementaryForm.originalSemester}
                                            onChange={e => setSupplementaryForm(prev => ({ ...prev, originalSemester: e.target.value as any }))}
                                            className="w-full p-3 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-orange-500 outline-none transition-all font-medium"
                                        >
                                            <option value="Odd">Odd</option>
                                            <option value="Even">Even</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 mb-1">Org. Year</label>
                                        <input
                                            type="number"
                                            value={supplementaryForm.originalYear}
                                            onChange={e => setSupplementaryForm(prev => ({ ...prev, originalYear: parseInt(e.target.value) }))}
                                            className="w-full p-3 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-orange-500 outline-none transition-all font-medium"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-1">Supplementary Year</label>
                                    <input
                                        type="number"
                                        value={supplementaryForm.supplementaryYear}
                                        onChange={e => setSupplementaryForm(prev => ({ ...prev, supplementaryYear: parseInt(e.target.value) }))}
                                        className="w-full p-3 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-orange-500 outline-none transition-all font-medium"
                                    />
                                </div>
                            </div>

                            <div className="flex gap-4 pt-4">
                                <button
                                    type="button"
                                    onClick={() => setShowSupplementaryForm(false)}
                                    className="flex-1 py-4 bg-slate-100 text-slate-700 rounded-2xl font-bold hover:bg-slate-200 transition-all"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isOperating}
                                    className="flex-1 py-4 bg-orange-600 text-white rounded-2xl font-bold hover:bg-orange-700 shadow-lg shadow-orange-200 transition-all disabled:opacity-50"
                                >
                                    {isOperating ? 'Saving...' : 'Register Exam'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Mark Entry Modal */}
            {showMarkEntryModal && editingExam && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-[70]">
                    <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
                        <div className="bg-emerald-600 p-6 text-white">
                            <h3 className="text-xl font-black">Enter Supplementary Marks</h3>
                            <p className="text-emerald-100 text-sm">{editingExam.studentName} - {editingExam.subjectName}</p>
                            {editingExam.attemptNumber > 1 && (
                                <div className="mt-2 inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-500/30 rounded text-[10px] font-bold uppercase tracking-wider">
                                    <i className="fa-solid fa-rotate-right"></i>
                                    Attempt {editingExam.attemptNumber}
                                </div>
                            )}
                        </div>

                        {/* Historical Timeline */}
                        {editingExamHistory.length > 0 && (
                            <div className="px-6 pt-6">
                                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                                        <i className="fa-solid fa-timeline"></i>
                                        Attempt History
                                    </h4>
                                    <div className="space-y-3 relative before:absolute before:left-[7px] before:top-2 before:bottom-2 before:w-[2px] before:bg-slate-200">
                                        {editingExamHistory.map((historyExam, idx) => (
                                            <div key={historyExam.id} className="relative pl-6">
                                                <div className={`absolute left-0 top-1.5 w-[16px] h-[16px] rounded-full border-4 border-slate-50 flex items-center justify-center ${historyExam.id === editingExam.id ? 'bg-emerald-500' : 'bg-slate-300'}`}></div>
                                                <div className="flex justify-between items-start">
                                                    <div>
                                                        <div className={`text-xs font-bold ${historyExam.id === editingExam.id ? 'text-emerald-700' : 'text-slate-700'}`}>
                                                            Attempt {historyExam.attemptNumber} ({historyExam.examTerm})
                                                        </div>
                                                        <div className="text-[10px] text-slate-500">
                                                            {historyExam.status === 'Completed' 
                                                                ? `Marks: ${historyExam.marks?.int ?? '-'}/${historyExam.marks?.ext ?? '-'} (${historyExam.marks?.status})`
                                                                : 'Pending...'}
                                                        </div>
                                                    </div>
                                                    {historyExam.id === editingExam.id && (
                                                        <span className="text-[9px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded font-black uppercase">Active</span>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}
                        
                        <form onSubmit={handleSaveMarks} className="p-6 space-y-6">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="flex items-center justify-between p-4 bg-amber-50 rounded-2xl border border-amber-100">
                                    <div className="flex-1">
                                        <h4 className="text-[10px] font-black text-amber-600 uppercase tracking-widest">Attempt</h4>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button 
                                            type="button"
                                            onClick={() => setMarkEntryForm(prev => ({ ...prev, attemptNumber: Math.max(1, prev.attemptNumber - 1) }))}
                                            className="w-6 h-6 rounded-lg bg-white border border-amber-200 text-amber-600 flex items-center justify-center hover:bg-amber-100 transition-all text-xs"
                                        >
                                            <i className="fa-solid fa-minus"></i>
                                        </button>
                                        <span className="font-mono font-bold text-amber-700 w-4 text-center text-xs">{markEntryForm.attemptNumber}</span>
                                        <button 
                                            type="button"
                                            onClick={() => setMarkEntryForm(prev => ({ ...prev, attemptNumber: Math.min(10, prev.attemptNumber + 1) }))}
                                            className="w-6 h-6 rounded-lg bg-white border border-amber-200 text-amber-600 flex items-center justify-center hover:bg-amber-100 transition-all text-xs"
                                        >
                                            <i className="fa-solid fa-plus"></i>
                                        </button>
                                    </div>
                                </div>

                                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Source Term</h4>
                                    <input 
                                        type="text"
                                        value={markEntryForm.originalTerm}
                                        onChange={(e) => setMarkEntryForm(prev => ({ ...prev, originalTerm: e.target.value }))}
                                        placeholder="e.g. 2024-2025-Odd"
                                        className="w-full bg-transparent border-none p-0 text-xs font-bold text-slate-700 focus:ring-0 outline-none"
                                    />
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                    <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                                        <i className="fa-solid fa-history"></i>
                                        Original Marks (Previous Record)
                                    </h4>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase">INT</label>
                                            <input
                                                type="text"
                                                value={markEntryForm.prevInt}
                                                onChange={(e) => setMarkEntryForm(prev => ({ ...prev, prevInt: e.target.value }))}
                                                className="w-full p-2 bg-white border border-slate-200 rounded-xl font-mono text-sm focus:border-emerald-500 outline-none"
                                                placeholder="INT"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase">EXT</label>
                                            <input
                                                type="text"
                                                value={markEntryForm.prevExt}
                                                onChange={(e) => setMarkEntryForm(prev => ({ ...prev, prevExt: e.target.value }))}
                                                className="w-full p-2 bg-white border border-slate-200 rounded-xl font-mono text-sm focus:border-emerald-500 outline-none"
                                                placeholder="EXT"
                                            />
                                        </div>
                                    </div>
                                    <p className="text-[10px] text-slate-500 mt-2 font-medium">
                                        <i className="fa-solid fa-info-circle mr-1"></i>
                                        Manually enter or override historical marks if missing.
                                    </p>
                                </div>

                                <div className="p-4 bg-emerald-50/50 rounded-2xl border border-emerald-100">
                                    <h4 className="text-xs font-black text-emerald-600 uppercase tracking-widest mb-3 flex items-center gap-2">
                                        <i className="fa-solid fa-file-pen"></i>
                                        New Supplementary Marks
                                    </h4>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className={`block text-[10px] font-bold mb-1 uppercase ${!editingExam?.subjectId || ((parseInt(markEntryForm.prevInt) || 0) >= Math.ceil((subjects.find(s => s.id === editingExam.subjectId)?.maxINT || 0) * 0.5)) ? 'text-slate-400' : 'text-slate-500'}`}>New INT</label>
                                            <input
                                                type="text"
                                                value={(parseInt(markEntryForm.prevInt) || 0) >= Math.ceil((subjects.find(s => s.id === editingExam.subjectId)?.maxINT || 0) * 0.5) ? markEntryForm.prevInt : markEntryForm.int}
                                                onChange={(e) => setMarkEntryForm(prev => ({ ...prev, int: e.target.value }))}
                                                disabled={(parseInt(markEntryForm.prevInt) || 0) >= Math.ceil((subjects.find(s => s.id === editingExam.subjectId)?.maxINT || 0) * 0.5)}
                                                className={`w-full p-2 border border-emerald-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-mono text-sm shadow-inner ${(parseInt(markEntryForm.prevInt) || 0) >= Math.ceil((subjects.find(s => s.id === editingExam.subjectId)?.maxINT || 0) * 0.5) ? 'opacity-60 cursor-not-allowed bg-slate-100 text-slate-500' : 'bg-white'}`}
                                                placeholder="Enter"
                                                autoFocus
                                            />
                                            <p className="text-[9px] text-slate-400 mt-1">
                                                {(parseInt(markEntryForm.prevInt) || 0) >= Math.ceil((subjects.find(s => s.id === editingExam.subjectId)?.maxINT || 0) * 0.5) 
                                                    ? 'Passed Originally' 
                                                    : `Max: ${subjects.find(s => s.id === editingExam.subjectId)?.maxINT || 0}`}
                                            </p>
                                        </div>
                                        <div>
                                            <label className={`block text-[10px] font-bold mb-1 uppercase ${!editingExam?.subjectId || ((parseInt(markEntryForm.prevExt) || 0) >= Math.ceil((subjects.find(s => s.id === editingExam.subjectId)?.maxEXT || 0) * 0.4)) ? 'text-slate-400' : 'text-slate-500'}`}>New EXT</label>
                                            <input
                                                type="text"
                                                value={(parseInt(markEntryForm.prevExt) || 0) >= Math.ceil((subjects.find(s => s.id === editingExam.subjectId)?.maxEXT || 0) * 0.4) ? markEntryForm.prevExt : markEntryForm.ext}
                                                onChange={(e) => setMarkEntryForm(prev => ({ ...prev, ext: e.target.value }))}
                                                disabled={(parseInt(markEntryForm.prevExt) || 0) >= Math.ceil((subjects.find(s => s.id === editingExam.subjectId)?.maxEXT || 0) * 0.4)}
                                                className={`w-full p-2 border border-emerald-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-mono text-sm shadow-inner ${(parseInt(markEntryForm.prevExt) || 0) >= Math.ceil((subjects.find(s => s.id === editingExam.subjectId)?.maxEXT || 0) * 0.4) ? 'opacity-60 cursor-not-allowed bg-slate-100 text-slate-500' : 'bg-white'}`}
                                                placeholder="Enter"
                                            />
                                            <p className="text-[9px] text-slate-400 mt-1">
                                                {(parseInt(markEntryForm.prevExt) || 0) >= Math.ceil((subjects.find(s => s.id === editingExam.subjectId)?.maxEXT || 0) * 0.4) 
                                                    ? 'Passed Originally' 
                                                    : `Max: ${subjects.find(s => s.id === editingExam.subjectId)?.maxEXT || 0}`}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="flex gap-4 pt-4">
                                <button
                                    type="button"
                                    onClick={() => setShowMarkEntryModal(false)}
                                    className="flex-1 py-3 bg-slate-100 text-slate-700 rounded-2xl font-bold hover:bg-slate-200 transition-all font-black uppercase text-xs tracking-widest"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isOperating}
                                    className="flex-1 py-3 bg-emerald-600 text-white rounded-2xl font-bold hover:bg-emerald-700 shadow-lg shadow-emerald-200 transition-all disabled:opacity-50 font-black uppercase text-xs tracking-widest"
                                >
                                    {isOperating ? 'Saving...' : 'Save Marks'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SupplementaryManagement;
