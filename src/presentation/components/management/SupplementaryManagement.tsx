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

    const [supplementaryForm, setSupplementaryForm] = useState({
        studentId: '',
        subjectId: '',
        examType: 'CurrentSemester' as SupplementaryExamType,
        originalSemester: 'Odd' as 'Odd' | 'Even',
        originalYear: new Date().getFullYear() - 1,
        supplementaryYear: new Date().getFullYear()
    });

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

    const filteredExams = supplementaryExams.filter(exam =>
        activeTab === 'All' || exam.examType === activeTab
    );

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

            {/* Type Tabs */}
            <div className="flex p-1 bg-slate-100 rounded-xl w-fit">
                {(['All', 'PreviousYear', 'CurrentSemester'] as const).map(tab => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === tab
                            ? 'bg-white text-orange-600 shadow-sm'
                            : 'text-slate-600 hover:text-slate-900'
                            }`}
                    >
                        {tab === 'All' ? 'All Exams' : tab === 'PreviousYear' ? 'Repeat (Prev Year)' : 'Current Sem Supp'}
                    </button>
                ))}
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
                                    <th className="text-center p-4 font-bold text-slate-700">Original</th>
                                    <th className="text-center p-4 font-bold text-slate-700">Supplementary</th>
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
                                        <td className="p-4 text-center text-slate-600 text-sm">
                                            {suppExam.originalSemester} {suppExam.originalYear}
                                        </td>
                                        <td className="p-4 text-center text-slate-600 text-sm font-bold">
                                            {suppExam.supplementaryYear}
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
                                            <button
                                                onClick={() => handleDeleteSupplementaryExam(suppExam.id)}
                                                className="w-8 h-8 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-all"
                                            >
                                                <i className="fa-solid fa-trash"></i>
                                            </button>
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
        </div>
    );
};

export default SupplementaryManagement;
