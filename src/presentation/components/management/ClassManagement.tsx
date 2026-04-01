import React, { useState } from 'react';
import { CLASSES } from '../../../domain/entities/constants';
import { StudentRecord, SubjectConfig } from '../../../domain/entities/types';

interface ClassManagementProps {
    customClasses: string[];
    onUpdateCustomClasses: (classes: string[]) => void;
    students: StudentRecord[];
    subjects: SubjectConfig[];
    onRefresh: () => void;
}

const ClassManagement: React.FC<ClassManagementProps> = ({ customClasses, onUpdateCustomClasses, students, subjects, onRefresh }) => {
    const [showClassForm, setShowClassForm] = useState(false);
    const [showPromoteForm, setShowPromoteForm] = useState(false);
    const [sourceClass, setSourceClass] = useState('');
    const [targetClass, setTargetClass] = useState('');
    const [isPromoting, setIsPromoting] = useState(false);
    const [newClassName, setNewClassName] = useState('');

    const getAllClasses = () => [...CLASSES, ...customClasses];

    const handleAddClass = () => {
        if (!newClassName.trim()) {
            alert('Please enter a class name');
            return;
        }

        const allClasses = getAllClasses();
        if (allClasses.includes(newClassName.trim())) {
            alert('Class already exists');
            return;
        }

        const updatedCustomClasses = [...customClasses, newClassName.trim()];
        onUpdateCustomClasses(updatedCustomClasses);
        setNewClassName('');
        setShowClassForm(false);
        alert(`Class "${newClassName.trim()}" added successfully!`);
    };

    const handleDeleteClass = (className: string) => {
        if (CLASSES.includes(className)) {
            alert('Cannot delete default classes');
            return;
        }

        if (!confirm(`Are you sure you want to delete class ${className}?`)) return;

        const updatedCustomClasses = customClasses.filter(c => c !== className);
        onUpdateCustomClasses(updatedCustomClasses);
    };

    const handlePromoteStudentsClick = (className: string) => {
        setSourceClass(className);
        setTargetClass('');
        setShowPromoteForm(true);
    };

    const confirmPromotion = async () => {
        if (!targetClass) {
            alert('Please select a target class to promote students to.');
            return;
        }

        if (!confirm(`Are you sure you want to promote ALL students from ${sourceClass} to ${targetClass}? This operation cannot be undone automatically.`)) return;

        try {
            setIsPromoting(true);
            const { dataService } = await import('../../../infrastructure/services/dataService');
            await dataService.promoteStudents(sourceClass, targetClass);
            alert(`Successfully promoted students from ${sourceClass} to ${targetClass}.`);
            setShowPromoteForm(false);
            onRefresh();
        } catch (error) {
            console.error('Promotion error:', error);
            alert('Failed to promote students. See console for details.');
        } finally {
            setIsPromoting(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-xl font-black text-slate-900">Class Management</h2>
                <button
                    onClick={() => setShowClassForm(true)}
                    className="px-4 py-2 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-all flex items-center gap-2"
                >
                    <i className="fa-solid fa-plus"></i>
                    Add Class
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {getAllClasses().map((className) => {
                    const classStudents = students.filter(s => s.className === className);
                    const classSubjects = subjects.filter(s => s.targetClasses.includes(className));
                    const isCustomClass = customClasses.includes(className);

                    return (
                        <div key={className} className="bg-slate-50 rounded-xl p-6">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-xl font-black text-slate-900">{className}</h3>
                                <div className="flex gap-2">
                                    <button className="p-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-all">
                                        <i className="fa-solid fa-chart-bar text-sm"></i>
                                    </button>
                                    {isCustomClass && (
                                        <button
                                            onClick={() => handleDeleteClass(className)}
                                            className="p-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-all"
                                        >
                                            <i className="fa-solid fa-trash text-sm"></i>
                                        </button>
                                    )}
                                    <button
                                        onClick={() => handlePromoteStudentsClick(className)}
                                        className="p-2 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 transition-all ml-1"
                                        title="Promote Students"
                                    >
                                        <i className="fa-solid fa-arrow-up text-sm"></i>
                                    </button>
                                </div>
                            </div>
                            <div className="space-y-2 text-sm text-slate-600">
                                <p><strong>Students:</strong> {classStudents.length}</p>
                                <p><strong>Subjects:</strong> {classSubjects.length}</p>
                                <p><strong>Type:</strong>
                                    <span className={`ml-1 font-medium ${isCustomClass ? 'text-blue-600' : 'text-emerald-600'}`}>
                                        {isCustomClass ? 'Custom' : 'Standard'}
                                    </span>
                                </p>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Add Class Modal */}
            {showClassForm && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-2xl w-full max-w-sm p-6">
                        <h3 className="text-xl font-bold mb-4">Add New Class</h3>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-bold mb-1">Class Name</label>
                                <input
                                    type="text"
                                    value={newClassName}
                                    onChange={(e) => setNewClassName(e.target.value)}
                                    placeholder="e.g., S1-B"
                                    className="w-full p-3 border rounded-xl"
                                />
                            </div>
                            <div className="flex gap-3 pt-4">
                                <button
                                    onClick={() => setShowClassForm(false)}
                                    className="flex-1 py-3 bg-slate-100 rounded-xl"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleAddClass}
                                    className="flex-1 py-3 bg-emerald-600 text-white rounded-xl"
                                >
                                    Add Class
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Promote Students Modal */}
            {showPromoteForm && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-2xl w-full max-w-md p-6">
                        <h3 className="text-xl font-bold mb-4">Promote Students</h3>
                        <p className="text-sm text-slate-600 mb-4">
                            Select the destination class to promote all students currently enrolled in <strong>{sourceClass}</strong>. 
                        </p>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-bold mb-1">Target Class</label>
                                <select 
                                    value={targetClass} 
                                    onChange={(e) => setTargetClass(e.target.value)}
                                    className="w-full p-3 border rounded-xl"
                                    disabled={isPromoting}
                                >
                                    <option value="">-- Select Target Class --</option>
                                    {getAllClasses().filter(c => c !== sourceClass).map(c => (
                                        <option key={c} value={c}>{c}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="flex gap-3 pt-4">
                                <button
                                    onClick={() => setShowPromoteForm(false)}
                                    className="flex-1 py-3 bg-slate-100 text-slate-700 rounded-xl font-medium"
                                    disabled={isPromoting}
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={confirmPromotion}
                                    className="flex-1 py-3 bg-purple-600 text-white rounded-xl font-medium disabled:opacity-50 flex justify-center items-center"
                                    disabled={isPromoting || !targetClass}
                                >
                                    {isPromoting ? <div className="loader-ring w-5 h-5 border-2"></div> : 'Confirm Promotion'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ClassManagement;
