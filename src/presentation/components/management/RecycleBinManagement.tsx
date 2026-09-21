import React, { useState, useEffect, useCallback } from 'react';
import type { SubjectConfig, StudentRecord, CurriculumEntry, SupplementaryExam } from '../../../domain/entities/types';
import { dataService } from '../../../infrastructure/services/dataService';
import { actionHistoryService, ActionHistoryItem } from '../../../infrastructure/services/ActionHistoryService';

const RecycleBinManagement: React.FC = () => {
    const [deletedSubjects, setDeletedSubjects] = useState<SubjectConfig[]>([]);
    const [deletedStudents, setDeletedStudents] = useState<StudentRecord[]>([]);
    const [deletedCurriculum, setDeletedCurriculum] = useState<CurriculumEntry[]>([]);
    const [deletedSuppExams, setDeletedSuppExams] = useState<SupplementaryExam[]>([]);
    const [historyItems, setHistoryItems] = useState<ActionHistoryItem[]>([]);
    
    const [activeTab, setActiveTab] = useState<'history' | 'subjects' | 'students' | 'curriculum' | 'supp'>('history');
    const [isLoading, setIsLoading] = useState(true);
    const [undoingId, setUndoingId] = useState<string | null>(null);

    const loadData = useCallback(async () => {
        setIsLoading(true);
        try {
            const [subjects, students, curr, supps, history] = await Promise.all([
                (dataService as any).academicService.getDeletedSubjects(),
                (dataService as any).studentService.getDeletedStudents(),
                (dataService as any).curriculumService.getDeletedCurriculum(),
                (dataService as any).supplementaryService.getDeletedSupplementaryExams(),
                actionHistoryService.getRecentActions(20)
            ]);
            
            setDeletedSubjects(subjects);
            setDeletedStudents(students);
            setDeletedCurriculum(curr);
            setDeletedSuppExams(supps);
            setHistoryItems(history);
        } catch (error) {
            console.error('Error loading recycle bin & history data:', error);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const handleUndoAction = async (action: ActionHistoryItem) => {
        if (action.undone) return;
        if (!window.confirm(`Undo action: "${action.description}"?`)) return;

        try {
            setUndoingId(action.id);
            const res = await actionHistoryService.undoAction(action.id);
            if (res.success) {
                alert(`✅ ${res.message}`);
                await loadData();
            } else {
                alert(`⚠️ ${res.message}`);
            }
        } catch (error) {
            console.error('Error undoing action:', error);
            alert('Failed to undo action.');
        } finally {
            setUndoingId(null);
        }
    };

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
            await loadData();
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
            await loadData();
        } catch (error) {
            console.error(`Error hard-deleting ${type}:`, error);
            alert(`Failed to permanently delete ${type}.`);
        }
    };

    const formatDate = (timestamp?: number) => {
        if (!timestamp) return 'Unknown date';
        return new Date(timestamp).toLocaleString();
    };

    const getActionBadgeClass = (actionType: string) => {
        switch (actionType) {
            case 'create': return 'bg-emerald-100 text-emerald-800 border-emerald-200';
            case 'update': return 'bg-blue-100 text-blue-800 border-blue-200';
            case 'delete': return 'bg-rose-100 text-rose-800 border-rose-200';
            default: return 'bg-slate-100 text-slate-700 border-slate-200';
        }
    };

    const tabs = [
        { id: 'history', label: '⚡ Action History (Undo)', count: historyItems.length },
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
                    <p className="text-slate-600">Loading Recycle Bin & Action History...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex space-x-2 border-b border-slate-200 overflow-x-auto">
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as any)}
                        className={`px-4 py-2 border-b-2 font-medium text-sm transition-colors whitespace-nowrap ${
                            activeTab === tab.id
                                ? 'border-emerald-500 text-emerald-600 font-bold'
                                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                        }`}
                    >
                        {tab.label} <span className="ml-2 px-2 py-0.5 bg-slate-100 rounded-full text-xs font-semibold">{tab.count}</span>
                    </button>
                ))}
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                {activeTab === 'history' && (
                    <div>
                        <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
                            <div>
                                <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                                    <i className="fa-solid fa-rotate-left text-emerald-600"></i>
                                    Recent Management Actions History
                                </h3>
                                <p className="text-xs text-slate-500 mt-0.5">
                                    Undo recent historical management actions (edits, writes, updates, and deletes). The top 5 actions are highlighted below.
                                </p>
                            </div>
                        </div>

                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-100/70 border-b border-slate-200 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                                    <th className="px-6 py-3">#</th>
                                    <th className="px-6 py-3">Action Details</th>
                                    <th className="px-6 py-3">Type</th>
                                    <th className="px-6 py-3">Timestamp</th>
                                    <th className="px-6 py-3 text-right">Undo Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200">
                                {historyItems.map((item, idx) => {
                                    const isTop5 = idx < 5;
                                    return (
                                        <tr key={item.id} className={`transition-colors ${isTop5 ? 'bg-amber-50/30 hover:bg-amber-50/60' : 'hover:bg-slate-50'}`}>
                                            <td className="px-6 py-4 whitespace-nowrap text-xs font-bold text-slate-400">
                                                {isTop5 ? (
                                                    <span className="px-2 py-0.5 bg-amber-100 text-amber-800 rounded font-black text-[10px] uppercase border border-amber-200">
                                                        Recent #{idx + 1}
                                                    </span>
                                                ) : (
                                                    `#${idx + 1}`
                                                )}
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="font-semibold text-slate-900 text-sm">{item.description}</div>
                                                <div className="text-xs text-slate-400 font-mono mt-0.5">ID: {item.entityId} • Entity: {item.entityType}</div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className={`px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider border ${getActionBadgeClass(item.actionType)}`}>
                                                    {item.actionType}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-xs text-slate-500">
                                                {formatDate(item.timestamp)}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                                {item.undone ? (
                                                    <span className="px-3 py-1 bg-slate-100 text-slate-400 rounded-lg text-xs font-bold inline-flex items-center gap-1">
                                                        <i className="fa-solid fa-check"></i> Undone
                                                    </span>
                                                ) : (
                                                    <button
                                                        onClick={() => handleUndoAction(item)}
                                                        disabled={undoingId === item.id}
                                                        className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700 shadow-sm transition-all active:scale-95 flex items-center gap-1.5 ml-auto"
                                                    >
                                                        {undoingId === item.id ? (
                                                            <><i className="fa-solid fa-spinner fa-spin"></i> Undoing…</>
                                                        ) : (
                                                            <><i className="fa-solid fa-rotate-left"></i> Undo Action</>
                                                        )}
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>

                        {historyItems.length === 0 && (
                            <div className="p-8 text-center text-slate-500">
                                <i className="fa-solid fa-clock-rotate-left text-3xl mb-3 opacity-20"></i>
                                <p className="font-medium text-sm">No management actions logged yet.</p>
                                <p className="text-xs text-slate-400 mt-1">Actions performed in management screens (creates, edits, deletes) will appear here for 1-click undo.</p>
                            </div>
                        )}
                    </div>
                )}

                {activeTab !== 'history' && (
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
                )}

                {/* Empty State for deletion tabs */}
                {activeTab !== 'history' && (
                    ((activeTab === 'subjects' && deletedSubjects.length === 0) ||
                    (activeTab === 'students' && deletedStudents.length === 0) ||
                    (activeTab === 'curriculum' && deletedCurriculum.length === 0) ||
                    (activeTab === 'supp' && deletedSuppExams.length === 0)) && (
                        <div className="p-8 text-center text-slate-500">
                            <i className="fa-solid fa-trash-can text-3xl mb-3 opacity-20"></i>
                            <p>No deleted items found in this category.</p>
                        </div>
                    )
                )}
            </div>
        </div>
    );
};

export default RecycleBinManagement;
