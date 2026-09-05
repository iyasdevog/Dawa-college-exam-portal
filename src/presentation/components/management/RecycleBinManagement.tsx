import React, { useState, useEffect, useCallback } from 'react';
import type { SubjectConfig, StudentRecord, CurriculumEntry, SupplementaryExam } from '../../../domain/entities/types';
import { dataService } from '../../../infrastructure/services/dataService';

const RecycleBinManagement: React.FC = () => {
    const [deletedSubjects, setDeletedSubjects] = useState<SubjectConfig[]>([]);
    const [deletedStudents, setDeletedStudents] = useState<StudentRecord[]>([]);
    const [deletedCurriculum, setDeletedCurriculum] = useState<CurriculumEntry[]>([]);
    const [deletedSuppExams, setDeletedSuppExams] = useState<SupplementaryExam[]>([]);
    
    const [activeTab, setActiveTab] = useState<'subjects' | 'students' | 'curriculum' | 'supp'>('subjects');
    const [isLoading, setIsLoading] = useState(true);

    const loadDeletedData = useCallback(async () => {
        setIsLoading(true);
        try {
            // Using a ts-ignore for the new methods until dataService proxy is fully updated
            // We know these methods exist on the underlying modules because we just added them
            const [subjects, students, curr, supps] = await Promise.all([
                (dataService as any).academicService.getDeletedSubjects(),
                (dataService as any).studentService.getDeletedStudents(),
                (dataService as any).curriculumService.getDeletedCurriculum(),
                (dataService as any).supplementaryService.getDeletedSupplementaryExams()
            ]);
            
            setDeletedSubjects(subjects);
            setDeletedStudents(students);
            setDeletedCurriculum(curr);
            setDeletedSuppExams(supps);
        } catch (error) {
            console.error('Error loading recycle bin data:', error);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        loadDeletedData();
    }, [loadDeletedData]);

    const handleRestore = async (type: string, id: string) => {
        if (!window.confirm('Are you sure you want to restore this item?')) return;
        
        try {
            switch (type) {
                case 'subject':
                    await (dataService as any).academicService.restoreSubject(id);
                    break;
                case 'student':
                    await (dataService as any).studentService.restoreStudent(id);
                    break;
                case 'curriculum':
                    await (dataService as any).curriculumService.restoreCurriculumEntry(id);
                    break;
                case 'supp':
                    await (dataService as any).supplementaryService.restoreSupplementaryExam(id);
                    break;
            }
            await loadDeletedData();
        } catch (error) {
            console.error(`Error restoring ${type}:`, error);
            alert(`Failed to restore ${type}.`);
        }
    };

    const handleHardDelete = async (type: string, id: string) => {
        if (!window.confirm('WARNING: This action is permanent and cannot be undone. Are you sure you want to permanently delete this item?')) return;
        
        try {
            switch (type) {
                case 'subject':
                    await (dataService as any).academicService.hardDeleteSubject(id);
                    break;
                case 'student':
                    await (dataService as any).studentService.hardDeleteStudent(id);
                    break;
                case 'curriculum':
                    await (dataService as any).curriculumService.hardDeleteCurriculumEntry(id);
                    break;
                case 'supp':
                    await (dataService as any).supplementaryService.hardDeleteSupplementaryExam(id);
                    break;
            }
            await loadDeletedData();
        } catch (error) {
            console.error(`Error hard-deleting ${type}:`, error);
            alert(`Failed to permanently delete ${type}.`);
        }
    };

    const formatDate = (timestamp?: number) => {
        if (!timestamp) return 'Unknown date';
        return new Date(timestamp).toLocaleString();
    };

    const tabs = [
        { id: 'subjects', label: 'Subjects', count: deletedSubjects.length },
        { id: 'students', label: 'Students', count: deletedStudents.length },
        { id: 'curriculum', label: 'Curriculum', count: deletedCurriculum.length },
        { id: 'supp', label: 'Supp. Exams', count: deletedSuppExams.length }
    ] as const;

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="text-center">
                    <div className="loader-ring mb-4"></div>
                    <p className="text-slate-600">Loading Recycle Bin...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex space-x-2 border-b border-slate-200">
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`px-4 py-2 border-b-2 font-medium text-sm transition-colors ${
                            activeTab === tab.id
                                ? 'border-emerald-500 text-emerald-600'
                                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                        }`}
                    >
                        {tab.label} <span className="ml-2 px-2 py-0.5 bg-slate-100 rounded-full text-xs">{tab.count}</span>
                    </button>
                ))}
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-slate-50 border-b border-slate-200">
                            <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Item Name / Details</th>
                            <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Deleted Date</th>
                            <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                        {activeTab === 'subjects' && deletedSubjects.map(sub => (
                            <tr key={sub.id} className="hover:bg-slate-50">
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="font-medium text-slate-900">{sub.name}</div>
                                    <div className="text-sm text-slate-500">{sub.activeSemester || 'Both'} Sem • {sub.facultyName || 'No Faculty'}</div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                                    {formatDate(sub.deletedAt)}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                    <button onClick={() => handleRestore('subject', sub.id)} className="text-emerald-600 hover:text-emerald-900 mr-4">Restore</button>
                                    <button onClick={() => handleHardDelete('subject', sub.id)} className="text-red-600 hover:text-red-900">Delete Forever</button>
                                </td>
                            </tr>
                        ))}

                        {activeTab === 'students' && deletedStudents.map(student => (
                            <tr key={student.id} className="hover:bg-slate-50">
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="font-medium text-slate-900">{student.name}</div>
                                    <div className="text-sm text-slate-500">Ad No: {student.adNo} • Class: {student.currentClass || student.className}</div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                                    {formatDate(student.deletedAt)}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                    <button onClick={() => handleRestore('student', student.id)} className="text-emerald-600 hover:text-emerald-900 mr-4">Restore</button>
                                    <button onClick={() => handleHardDelete('student', student.id)} className="text-red-600 hover:text-red-900">Delete Forever</button>
                                </td>
                            </tr>
                        ))}

                        {activeTab === 'curriculum' && deletedCurriculum.map(curr => (
                            <tr key={curr.id} className="hover:bg-slate-50">
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="font-medium text-slate-900">{curr.subjectName}</div>
                                    <div className="text-sm text-slate-500">{curr.stage} • Sem {curr.semester}</div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                                    {formatDate(curr.deletedAt)}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                    <button onClick={() => handleRestore('curriculum', curr.id)} className="text-emerald-600 hover:text-emerald-900 mr-4">Restore</button>
                                    <button onClick={() => handleHardDelete('curriculum', curr.id)} className="text-red-600 hover:text-red-900">Delete Forever</button>
                                </td>
                            </tr>
                        ))}

                        {activeTab === 'supp' && deletedSuppExams.map(exam => (
                            <tr key={exam.id} className="hover:bg-slate-50">
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="font-medium text-slate-900">{exam.studentName || 'Unknown Student'}</div>
                                    <div className="text-sm text-slate-500">Subject: {exam.subjectName || exam.subjectId} • Term: {exam.examTerm}</div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                                    {formatDate(exam.deletedAt)}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                    <button onClick={() => handleRestore('supp', exam.id)} className="text-emerald-600 hover:text-emerald-900 mr-4">Restore</button>
                                    <button onClick={() => handleHardDelete('supp', exam.id)} className="text-red-600 hover:text-red-900">Delete Forever</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                
                {/* Empty State */}
                {((activeTab === 'subjects' && deletedSubjects.length === 0) ||
                  (activeTab === 'students' && deletedStudents.length === 0) ||
                  (activeTab === 'curriculum' && deletedCurriculum.length === 0) ||
                  (activeTab === 'supp' && deletedSuppExams.length === 0)) && (
                    <div className="p-8 text-center text-slate-500">
                        <i className="fa-solid fa-trash-can text-3xl mb-3 opacity-20"></i>
                        <p>No deleted items found in this category.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default RecycleBinManagement;
