import React, { useState } from 'react';
import { SupplementaryExam, StudentRecord, SubjectConfig } from '../../../domain/entities/types';
import { dataService } from '../../../infrastructure/services/dataService';

interface SupplementaryManagementProps {
    supplementaryExams: any[]; // Using any[] based on original component handling of enriched exams
    students: StudentRecord[];
    subjects: SubjectConfig[];
    onRefresh: () => Promise<void>;
}

const SupplementaryManagement: React.FC<SupplementaryManagementProps> = ({ supplementaryExams, students, subjects, onRefresh }) => {
    const [isOperating, setIsOperating] = useState(false);
    const [showSupplementaryForm, setShowSupplementaryForm] = useState(false);
    const [supplementaryForm, setSupplementaryForm] = useState({
        studentId: '',
        subjectId: '',
        originalSemester: 'Odd' as 'Odd' | 'Even',
        originalYear: new Date().getFullYear() - 1,
        supplementaryYear: new Date().getFullYear()
    });

    const handleAddSupplementaryExam = () => {
        setSupplementaryForm({
            studentId: '',
            subjectId: '',
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

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-xl font-black text-slate-900">Supplementary Exams</h2>
                <button
                    onClick={handleAddSupplementaryExam}
                    disabled={isOperating}
                    className="px-4 py-2 bg-orange-600 text-white rounded-xl font-bold hover:bg-orange-700 transition-all disabled:opacity-50 flex items-center gap-2"
                >
                    <i className="fa-solid fa-plus"></i>
                    Add Supplementary Exam
                </button>
            </div>

            <div className="overflow-x-auto">
                {supplementaryExams.length > 0 ? (
                    <table className="w-full">
                        <thead className="bg-slate-50">
                            <tr>
                                <th className="text-left p-4 font-bold text-slate-700">Student</th>
                                <th className="text-left p-4 font-bold text-slate-700">Adm No</th>
                                <th className="text-left p-4 font-bold text-slate-700">Subject</th>
                                <th className="text-center p-4 font-bold text-slate-700">Original</th>
                                <th className="text-center p-4 font-bold text-slate-700">Supplementary</th>
                                <th className="text-center p-4 font-bold text-slate-700">Status</th>
                                <th className="text-center p-4 font-bold text-slate-700">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {supplementaryExams.map((suppExam, index) => (
                                <tr key={suppExam.id} className={index % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                                    <td className="p-4 font-medium">{suppExam.studentName}</td>
                                    <td className="p-4 text-slate-600">{suppExam.studentAdNo}</td>
                                    <td className="p-4 text-slate-600">{suppExam.subjectName}</td>
                                    <td className="p-4 text-center text-slate-600">{suppExam.originalSemester} {suppExam.originalYear}</td>
                                    <td className="p-4 text-center text-slate-600">{suppExam.supplementaryYear}</td>
                                    <td className="p-4 text-center">
                                        <span className={`px-3 py-1 rounded-full text-sm font-medium ${suppExam.status === 'Completed' ? 'bg-emerald-100 text-emerald-700' : 'bg-orange-100 text-orange-700'}`}>
                                            {suppExam.status}
                                        </span>
                                    </td>
                                    <td className="p-4 text-center">
                                        <button onClick={() => handleDeleteSupplementaryExam(suppExam.id)} className="text-red-600"><i className="fa-solid fa-trash"></i></button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                ) : (
                    <div className="text-center p-8 text-slate-500">No supplementary exams found.</div>
                )}
            </div>

            {/* Supplementary Form Modal */}
            {showSupplementaryForm && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-2xl w-full max-w-md p-6">
                        <h3 className="text-xl font-bold mb-4">Add Supplementary Exam</h3>
                        <form onSubmit={handleSaveSupplementaryExam} className="space-y-4">
                            <div>
                                <label className="block text-sm font-bold mb-1">Student</label>
                                <select
                                    value={supplementaryForm.studentId}
                                    onChange={e => setSupplementaryForm(prev => ({ ...prev, studentId: e.target.value }))}
                                    className="w-full p-3 border rounded-xl"
                                    required
                                >
                                    <option value="">Select Student</option>
                                    {students.map(s => (
                                        <option key={s.id} value={s.id}>{s.name} ({s.adNo})</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-bold mb-1">Subject</label>
                                <select
                                    value={supplementaryForm.subjectId}
                                    onChange={e => setSupplementaryForm(prev => ({ ...prev, subjectId: e.target.value }))}
                                    className="w-full p-3 border rounded-xl"
                                    required
                                >
                                    <option value="">Select Subject</option>
                                    {subjects.map(s => (
                                        <option key={s.id} value={s.id}>{s.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-bold mb-1">Original Sem</label>
                                    <select
                                        value={supplementaryForm.originalSemester}
                                        onChange={e => setSupplementaryForm(prev => ({ ...prev, originalSemester: e.target.value as any }))}
                                        className="w-full p-3 border rounded-xl"
                                    >
                                        <option value="Odd">Odd</option>
                                        <option value="Even">Even</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-bold mb-1">Original Year</label>
                                    <input
                                        type="number"
                                        value={supplementaryForm.originalYear}
                                        onChange={e => setSupplementaryForm(prev => ({ ...prev, originalYear: parseInt(e.target.value) }))}
                                        className="w-full p-3 border rounded-xl"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-bold mb-1">Supplementary Year</label>
                                <input
                                    type="number"
                                    value={supplementaryForm.supplementaryYear}
                                    onChange={e => setSupplementaryForm(prev => ({ ...prev, supplementaryYear: parseInt(e.target.value) }))}
                                    className="w-full p-3 border rounded-xl"
                                />
                            </div>
                            <div className="flex gap-3 pt-4">
                                <button type="button" onClick={() => setShowSupplementaryForm(false)} className="flex-1 py-3 bg-slate-100 rounded-xl">Cancel</button>
                                <button type="submit" className="flex-1 py-3 bg-emerald-600 text-white rounded-xl">Save</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SupplementaryManagement;
