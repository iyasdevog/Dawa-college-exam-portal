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
    const [activeTab, setActiveTab] = useState<SupplementaryExamType | 'All'>('All');
    
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
    const [searchTerm, setSearchTerm] = useState('');

    // Mark Entry Modal State
    const [showMarkEntryModal, setShowMarkEntryModal] = useState(false);
    const [editingExam, setEditingExam] = useState<any>(null);
    const [markEntryForm, setMarkEntryForm] = useState({
        int: '',
        ext: ''
    });

    // Summary Statistics
    const stats = useMemo(() => {
        return {
            total: supplementaryExams.length,
            pending: supplementaryExams.filter(e => e.status === 'Pending').length,
            completed: supplementaryExams.filter(e => e.status === 'Completed').length,
            passed: supplementaryExams.filter(e => e.marks?.status === 'Passed').length,
            failed: supplementaryExams.filter(e => e.marks?.status === 'Failed').length
        };
    }, [supplementaryExams]);

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

    const handleOpenMarkEntry = (exam: any) => {
        setEditingExam(exam);
        setMarkEntryForm({
            int: exam.marks?.int?.toString() || '',
            ext: exam.marks?.ext?.toString() || ''
        });
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

            // Calculate Status
            const minINT = Math.ceil(subject.maxINT * 0.5);
            const minEXT = Math.ceil(subject.maxEXT * 0.4);
            const passedINT = intVal !== 'A' && typeof intVal === 'number' && intVal >= minINT;
            const passedEXT = extVal !== 'A' && typeof extVal === 'number' && extVal >= minEXT;
            const status = (passedINT && passedEXT) ? 'Passed' : 'Failed';

            await dataService.updateSupplementaryExamMarks(editingExam.id, {
                int: intVal,
                ext: extVal,
                total: totalNum,
                status,
                isSupplementary: true
            });

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
                status: 'Pending'
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
            const matchesTab = activeTab === 'All' || exam.examType === activeTab;
            const matchesClass = classFilter === 'All' || exam.studentClass === classFilter;
            const matchesSubject = subjectFilter === 'All' || exam.subjectId === subjectFilter;
            const matchesStatus = statusFilter === 'All' || exam.status === statusFilter;
            const matchesSearch = !searchTerm.trim() || 
                exam.studentName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                exam.studentAdNo?.toLowerCase().includes(searchTerm.toLowerCase());
            
            return matchesTab && matchesClass && matchesSubject && matchesStatus && matchesSearch;
        });
    }, [supplementaryExams, activeTab, classFilter, subjectFilter, statusFilter, searchTerm]);

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
                    <h2 className="text-xl font-black text-slate-900">Supplementary Exams</h2>
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
                    <div className="flex flex-wrap gap-2">
                        <select 
                            value={classFilter}
                            onChange={(e) => setClassFilter(e.target.value)}
                            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 focus:outline-none focus:border-emerald-500"
                        >
                            <option value="All">All Classes</option>
                            {uniqueClassesInSupp.map(cls => <option key={cls} value={cls}>{cls}</option>)}
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
                            <option value="Pending">Pending</option>
                            <option value="Completed">Completed</option>
                        </select>
                    </div>
                </div>

                <div className="flex p-1 bg-slate-100 rounded-xl w-fit">
                    {(['All', 'PreviousYear', 'CurrentSemester'] as const).map(tab => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === tab
                                ? 'bg-white text-emerald-600 shadow-sm'
                                : 'text-slate-600 hover:text-slate-900'
                                }`}
                        >
                            {tab === 'All' ? 'All Exams' : tab === 'PreviousYear' ? 'Repeat' : 'Semester'}
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
                                    <th className="text-center p-4 font-bold text-slate-700">INT</th>
                                    <th className="text-center p-4 font-bold text-slate-700">EXT</th>
                                    <th className="text-center p-4 font-bold text-slate-700">Total</th>
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
                                            <span className={`px-2 py-1 rounded-md text-[10px] uppercase font-bold ${suppExam.examType === 'PreviousYear'
                                                ? 'bg-purple-50 text-purple-700 border border-purple-100'
                                                : 'bg-blue-50 text-blue-700 border border-blue-100'
                                                }`}>
                                                {suppExam.examType === 'PreviousYear' ? 'Repeat' : 'Semester'}
                                            </span>
                                        </td>
                                        <td className="p-4 text-center font-mono text-sm text-slate-600">
                                            {suppExam.marks?.int ?? '-'}
                                        </td>
                                        <td className="p-4 text-center font-mono text-sm text-slate-600">
                                            {suppExam.marks?.ext ?? '-'}
                                        </td>
                                        <td className="p-4 text-center font-black text-slate-900">
                                            {suppExam.marks?.total ?? '-'}
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
                        <div className="text-center py-12">
                            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-400">
                                <i className="fa-solid fa-folder-open text-2xl"></i>
                            </div>
                            <h3 className="text-slate-900 font-bold">No Records Found</h3>
                            <p className="text-slate-500 text-sm">No supplementary exams match the current filter.</p>
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
                        </div>
                        
                        <form onSubmit={handleSaveMarks} className="p-6 space-y-6">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-1">INT Marks</label>
                                    <input
                                        type="text"
                                        value={markEntryForm.int}
                                        onChange={(e) => setMarkEntryForm(prev => ({ ...prev, int: e.target.value }))}
                                        placeholder="Enter INT"
                                        className="w-full p-3 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-emerald-500 outline-none transition-all font-mono font-bold"
                                        autoFocus
                                    />
                                    <p className="text-[10px] text-slate-400 mt-1">Max: {subjects.find(s => s.id === editingExam.subjectId)?.maxINT}</p>
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-1">EXT Marks</label>
                                    <input
                                        type="text"
                                        value={markEntryForm.ext}
                                        onChange={(e) => setMarkEntryForm(prev => ({ ...prev, ext: e.target.value }))}
                                        placeholder="Enter EXT"
                                        className="w-full p-3 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-emerald-500 outline-none transition-all font-mono font-bold"
                                    />
                                    <p className="text-[10px] text-slate-400 mt-1">Max: {subjects.find(s => s.id === editingExam.subjectId)?.maxEXT}</p>
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
