import React, { useState } from 'react';
import { SYSTEM_CLASSES as CLASSES } from '../../../domain/entities/constants';
import { StudentRecord, SubjectConfig } from '../../../domain/entities/types';
import { useTerm } from '../../viewmodels/TermContext';

interface ClassManagementProps {
    customClasses: string[];
    disabledClasses: string[];
    onUpdateCustomClasses: (classes: string[]) => Promise<void>;
    students: StudentRecord[];
    subjects: SubjectConfig[];
    onRefresh: () => Promise<void>;
}

const ClassManagement: React.FC<ClassManagementProps> = ({ customClasses, disabledClasses, onUpdateCustomClasses, students, subjects, onRefresh }) => {
    const { activeTerm } = useTerm();
    const [showClassForm, setShowClassForm] = useState(false);
    const [showPromoteForm, setShowPromoteForm] = useState(false);
    const [sourceClass, setSourceClass] = useState('');
    const [targetClass, setTargetClass] = useState('');
    const [isPromoting, setIsPromoting] = useState(false);
    const [newClassName, setNewClassName] = useState('');
    const [editingClass, setEditingClass] = useState<string | null>(null);
    const [renamedClassName, setRenamedClassName] = useState('');
    const [isRenaming, setIsRenaming] = useState(false);
    const [renameMode, setRenameMode] = useState<'global' | 'forward'>('forward');
    const [classSemesters, setClassSemesters] = useState<Record<string, 'Odd' | 'Even'>>({});
    const [globalSemester, setGlobalSemester] = useState<'Odd' | 'Even'>('Odd');
    const [isOperating, setIsOperating] = useState(false);
    const [isReconciling, setIsReconciling] = useState(false);
    const [discoveredClasses, setDiscoveredClasses] = useState<string[]>([]);

    React.useEffect(() => {
        const loadSettings = async () => {
            const { dataService } = await import('../../../infrastructure/services/dataService');
            const settings = await dataService.getGlobalSettings();
            setClassSemesters(settings.classSemesters || {});
            setGlobalSemester(settings.currentSemester || 'Odd');
            
            // Also load discovered classes for the active term
            const classes = await dataService.getClassesByTerm(activeTerm);
            setDiscoveredClasses(classes);
        };
        loadSettings();
    }, [students, activeTerm]);

    const getAllClasses = () => {
        const standardClasses = CLASSES.filter(c => !disabledClasses.includes(c));
        return [...standardClasses, ...customClasses];
    };

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
            if (confirm(`"${className}" is a default academic class and cannot be permanently deleted. Would you like to HIDE it instead?`)) {
                handleToggleClassVisibility(className, 'hide');
            }
            return;
        }

        if (!confirm(`Are you sure you want to delete class ${className}?`)) return;

        const updatedCustomClasses = customClasses.filter(c => c !== className);
        onUpdateCustomClasses(updatedCustomClasses);
    };

    const handleStartRename = (className: string) => {
        setEditingClass(className);
        setRenamedClassName(className);
    };

    const handleRenameClass = async () => {
        if (!editingClass || !renamedClassName.trim() || editingClass === renamedClassName.trim()) {
            setEditingClass(null);
            return;
        }

        if (getAllClasses().includes(renamedClassName.trim()) && editingClass !== renamedClassName.trim()) {
            alert('A class with this name already exists');
            return;
        }

        const isGlobal = renameMode === 'global';
        const confirmMsg = isGlobal
            ? `⚠️ GLOBAL RENAME: "${editingClass}" → "${renamedClassName.trim()}"\n\nThis will update ALL student records, subjects, and settings including historical semesters.\n\nHistorical reports will reflect the new name. Continue?`
            : `✅ FORWARD-ONLY RENAME: "${editingClass}" → "${renamedClassName.trim()}"\n\nOnly the active semester will use the new name. Historical reports remain unchanged because class discovery uses snapshotted data.\n\nContinue?`;

        if (!confirm(confirmMsg)) return;

        try {
            setIsRenaming(true);
            const { dataService } = await import('../../../infrastructure/services/dataService');
            
            if (isGlobal) {
                await dataService.renameClass(editingClass, renamedClassName.trim());
                alert(`✅ Global rename complete. All records updated.`);
            } else {
                await dataService.renameClassForwardOnly(editingClass, renamedClassName.trim());
                alert(`✅ Forward rename complete. Active semester now uses "${renamedClassName.trim()}". Historical records preserved.`);
            }

            setEditingClass(null);
            onRefresh();
        } catch (error) {
            console.error('Rename error:', error);
            alert('Failed to rename class.');
        } finally {
            setIsRenaming(false);
        }
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
            const settings = await dataService.getGlobalSettings();
            const termKey = `${settings.currentAcademicYear}-${settings.currentSemester}`;
            
            await dataService.promoteClass(sourceClass, targetClass, termKey);
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

    const handleUpdateClassSemester = async (className: string, semester: 'Odd' | 'Even') => {
        try {
            setIsOperating(true);
            const { dataService } = await import('../../../infrastructure/services/dataService');
            const currentMap = { ...classSemesters };
            const newMap = { ...currentMap, [className]: semester };
            
            await dataService.updateGlobalSettings({ classSemesters: newMap });
            setClassSemesters(newMap); // Update local state immediately - no refresh needed
            dataService.invalidateCache();
            // Don't call onRefresh() here — it reloads students which triggers the useEffect
            // and can overwrite classSemesters from a now-stale settings cache.
        } catch (error) {
            console.error('Error updating class semester:', error);
            alert('Failed to update class semester');
        } finally {
            setIsOperating(false);
        }
    };

    const handleToggleClassVisibility = async (className: string, action: 'hide' | 'unhide') => {
        try {
            setIsOperating(true);
            const { dataService } = await import('../../../infrastructure/services/dataService');
            
            let updatedDisabledClasses = [...disabledClasses];
            if (action === 'hide') {
                if (!updatedDisabledClasses.includes(className)) {
                    updatedDisabledClasses.push(className);
                }
            } else {
                updatedDisabledClasses = updatedDisabledClasses.filter(c => c !== className);
            }
            
            await dataService.updateGlobalSettings({ disabledClasses: updatedDisabledClasses });
            dataService.invalidateCache();
            if (onRefresh) await onRefresh();
        } catch (error) {
            console.error(`Error trying to ${action} class:`, error);
            alert(`Failed to ${action} class`);
        } finally {
            setIsOperating(false);
        }
    };

    const handleReconcileClasses = async () => {
        const confirmMsg = `⚠️ DATA RECONCILIATION AUDIT\n\nThis will scan all students and force-migrate any remaining "S1" -> "FS2", "S2" -> "FS1", and "P2" -> "HS3" identities.\n\nThis is recommended if you see duplicate classes or "Ghost" students in legacy filters.\n\nContinue?`;
        
        if (!confirm(confirmMsg)) return;

        try {
            setIsReconciling(true);
            const { dataService } = await import('../../../infrastructure/services/dataService');
            const results = await dataService.reconcileClassNames();
            
            if (results.renamed.length > 0) {
                alert(`✅ Reconciliation Complete!\n\nUpdated ${results.totalUpdates} records.\nMigrations: ${results.renamed.join(', ')}`);
            } else {
                alert(`ℹ️ No reconciliation needed. All records already align with current nomenclature.`);
            }
            
            onRefresh();
        } catch (error) {
            console.error('Reconciliation error:', error);
            alert('Failed to run reconciliation audit.');
        } finally {
            setIsReconciling(false);
        }
    };

    // Card rendering implementation
    const renderClassCard = (className: string, isActive: boolean) => {
        const classStudents = students.filter(s => s.className === className);
        const classSubjects = subjects.filter(s => s.targetClasses.includes(className));
        const isCustomClass = customClasses.includes(className);

        return (
            <div key={className} className={`bg-white rounded-xl p-6 border transition-all shadow-sm ${isActive ? 'border-slate-200 hover:border-emerald-300 shadow-emerald-50/20' : 'border-slate-100 opacity-80'}`}>
                <div className="flex items-center justify-between mb-4">
                    <h3 className={`text-xl font-black flex items-center gap-2 ${isActive ? 'text-slate-900' : 'text-slate-400'}`}>
                        {className}
                        {!isActive && <span className="text-[10px] uppercase tracking-wider bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full font-bold">Unused</span>}
                    </h3>
                    <div className="flex gap-2 opacity-50 hover:opacity-100 transition-opacity">
                        <button 
                            onClick={() => handleStartRename(className)}
                            className="p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-all"
                            title="Rename Class"
                        >
                            <i className="fa-solid fa-pen-to-square text-sm"></i>
                        </button>
                        {isCustomClass ? (
                            <button
                                onClick={() => handleDeleteClass(className)}
                                className="p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-all"
                                title="Delete Custom Class"
                            >
                                <i className="fa-solid fa-trash text-sm"></i>
                            </button>
                        ) : (
                            <button
                                onClick={() => handleToggleClassVisibility(className, 'hide')}
                                className="p-2 rounded-lg transition-all bg-amber-50 text-amber-600 hover:bg-amber-100"
                                title="Hide Class"
                            >
                                <i className="fa-solid fa-eye-slash text-sm"></i>
                            </button>
                        )}
                        <button
                            onClick={() => handlePromoteStudentsClick(className)}
                            className="p-2 bg-purple-50 text-purple-600 rounded-lg hover:bg-purple-100 transition-all"
                            title="Promote Students"
                        >
                            <i className="fa-solid fa-arrow-up-right-dots text-sm"></i>
                        </button>
                    </div>
                </div>
                <div className="space-y-2 text-sm text-slate-600">
                    <div className="flex justify-between">
                        <span>Students</span>
                        <span className={`font-bold ${classStudents.length > 0 ? 'text-emerald-600' : 'text-slate-400'}`}>{classStudents.length}</span>
                    </div>
                    <div className="flex justify-between">
                        <span>Subjects</span>
                        <span className={`font-bold ${classSubjects.length > 0 ? 'text-blue-600' : 'text-slate-400'}`}>{classSubjects.length}</span>
                    </div>
                    <div className="flex justify-between items-center pt-2 border-t border-slate-200">
                        <span className="text-xs uppercase tracking-wider font-bold text-slate-400">Type</span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest ${isCustomClass ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700'}`}>
                            {isCustomClass ? 'Customized' : 'Academic Std'}
                        </span>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <h2 className="text-xl font-black text-slate-900">Class Management</h2>
                    {activeTerm && (
                        <span className="text-xs px-3 py-1 rounded-full font-bold border bg-emerald-50 text-emerald-700 border-emerald-200 whitespace-nowrap shadow-sm">
                            {activeTerm}
                        </span>
                    )}
                </div>
                <button
                    onClick={() => setShowClassForm(true)}
                    className="px-4 py-2 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-all flex items-center gap-2"
                >
                    <i className="fa-solid fa-plus"></i>
                    Add Class
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {(() => {
                    const allList = getAllClasses();
                    const activeList = allList.filter(cls => discoveredClasses.includes(cls));
                    const inactiveList = allList.filter(cls => !discoveredClasses.includes(cls));

                    return (
                        <>
                            <div className="col-span-full mb-2">
                                <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                                    <i className="fa-solid fa-circle-check text-emerald-500"></i>
                                    Active Classes
                                    <span className="text-xs font-normal text-slate-500 ml-2">In use for the current {activeTerm || 'semester'}</span>
                                </h3>
                            </div>
                            {activeList.map(c => renderClassCard(c, true))}

                            {inactiveList.length > 0 && (
                                <>
                                    <div className="col-span-full mt-8 mb-2 border-t border-slate-200 pt-8">
                                        <h3 className="text-lg font-bold text-slate-400 flex items-center gap-2">
                                            <i className="fa-solid fa-clock-rotate-left"></i>
                                            Available & Historical Classes
                                            <span className="text-xs font-normal text-slate-400 ml-2">No students or subjects assigned in this specific term</span>
                                        </h3>
                                    </div>
                                    {inactiveList.map(c => renderClassCard(c, false))}
                                </>
                            )}
                        </>
                    );
                })()}
            </div>

            {/* Per-Class Semester Configuration Card */}
            <div className="bg-white rounded-[2.5rem] p-8 border-2 border-slate-100 shadow-sm relative overflow-hidden group mt-10">
                <div className="flex items-center gap-4 mb-6">
                    <div className="w-12 h-12 bg-amber-500 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-amber-100">
                        <i className="fa-solid fa-layer-group"></i>
                    </div>
                    <div>
                        <h3 className="text-xl font-black text-slate-900">Per-Class Semesters</h3>
                        <p className="text-xs text-amber-600 font-bold uppercase tracking-widest">Class-Specific Overrides</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {getAllClasses().map(cls => (
                        <div key={cls} className="flex flex-col gap-3 p-4 bg-slate-50 rounded-3xl border border-slate-100 hover:border-amber-200 transition-all">
                            <span className="text-sm font-black text-slate-700 text-center">{cls}</span>
                            <div className="flex p-1 bg-white rounded-2xl border border-slate-200 shadow-sm">
                                {(['Odd', 'Even'] as const).map(sem => (
                                    <button
                                        key={sem}
                                        disabled={isOperating}
                                        onClick={() => handleUpdateClassSemester(cls, sem)}
                                        className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                                            (classSemesters[cls] || globalSemester) === sem 
                                            ? 'bg-amber-500 text-white shadow-md' 
                                            : 'text-slate-400 hover:text-slate-600'
                                        }`}
                                    >
                                        {sem}
                                    </button>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
                <p className="mt-6 text-[11px] text-slate-500 font-bold italic leading-relaxed bg-amber-50/50 p-4 rounded-2xl border border-amber-100/50">
                    <i className="fa-solid fa-circle-info mr-2 text-amber-600"></i>
                    Use these toggles if certain classes are running on different semester cycles (e.g., Odd for most, Even for Foundational) within the same academic year.
                </p>
            </div>

            {/* Maintenance & Tools Section */}


            {/* Modals ... */}
            {showClassForm && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-3xl w-full max-w-sm p-8 shadow-2xl animate-in zoom-in-95 duration-200">
                        <h3 className="text-2xl font-black text-slate-900 mb-6">Create New Class</h3>
                        <div className="space-y-5">
                            <div>
                                <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2 ml-1">Identity Label</label>
                                <input
                                    type="text"
                                    value={newClassName}
                                    onChange={(e) => setNewClassName(e.target.value)}
                                    placeholder="e.g., S1-B"
                                    className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-slate-900 font-bold focus:border-emerald-500 transition-all outline-none"
                                    autoFocus
                                />
                            </div>
                            <div className="flex gap-4 pt-2">
                                <button
                                    onClick={() => setShowClassForm(false)}
                                    className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-2xl font-bold hover:bg-slate-200 transition-all"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleAddClass}
                                    className="flex-1 py-4 bg-emerald-600 text-white rounded-2xl font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-200"
                                >
                                    Confirm
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {editingClass && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-3xl w-full max-w-sm p-8 shadow-2xl animate-in zoom-in-95 duration-200">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center">
                                <i className="fa-solid fa-pen-to-square"></i>
                            </div>
                            <h3 className="text-2xl font-black text-slate-900">Rename Class</h3>
                        </div>
                        <div className="space-y-5">
                            <div>
                                <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2 ml-1">New Identity Label</label>
                                <input
                                    type="text"
                                    value={renamedClassName}
                                    onChange={(e) => setRenamedClassName(e.target.value)}
                                    className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-slate-900 font-bold focus:border-blue-500 transition-all outline-none"
                                    autoFocus
                                />
                                <div className="mt-4 p-1 bg-slate-50 border border-slate-200 rounded-2xl flex">
                                    <button
                                        onClick={() => setRenameMode('forward')}
                                        className={`flex-1 py-3 px-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                                            renameMode === 'forward' 
                                            ? 'bg-blue-600 text-white shadow-lg' 
                                            : 'text-slate-500 hover:text-slate-700'
                                        }`}
                                    >
                                        <i className="fa-solid fa-forward-step mr-1"></i>
                                        Forward-Only
                                    </button>
                                    <button
                                        onClick={() => setRenameMode('global')}
                                        className={`flex-1 py-3 px-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                                            renameMode === 'global' 
                                            ? 'bg-red-600 text-white shadow-lg' 
                                            : 'text-slate-500 hover:text-slate-700'
                                        }`}
                                    >
                                        <i className="fa-solid fa-earth-africa mr-1"></i>
                                        Global Correction
                                    </button>
                                </div>
                            </div>
                            <div className="flex gap-4 pt-2">
                                <button onClick={() => setEditingClass(null)} className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-2xl font-bold hover:bg-slate-200 transition-all">Cancel</button>
                                <button onClick={handleRenameClass} className="flex-1 py-4 bg-blue-600 text-white rounded-2xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-200">Update</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {showPromoteForm && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-3xl w-full max-w-md p-8 shadow-2xl animate-in zoom-in-95 duration-200">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-10 h-10 bg-purple-100 text-purple-600 rounded-xl flex items-center justify-center">
                                <i className="fa-solid fa-arrow-up-right-dots"></i>
                            </div>
                            <h3 className="text-2xl font-black text-slate-900">Promote Students</h3>
                        </div>
                        <div className="space-y-5">
                            <div>
                                <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2 ml-1">Destination Level</label>
                                <select 
                                    value={targetClass} 
                                    onChange={(e) => setTargetClass(e.target.value)}
                                    className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-slate-900 font-bold focus:border-purple-500 transition-all outline-none appearance-none"
                                >
                                    <option value="">Choose Class...</option>
                                    {getAllClasses().filter(c => c !== sourceClass).map(c => (
                                        <option key={c} value={c}>{c}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="flex gap-4 pt-2">
                                <button onClick={() => setShowPromoteForm(false)} className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-2xl font-bold hover:bg-slate-200 transition-all">Cancel</button>
                                <button onClick={confirmPromotion} className="flex-1 py-4 bg-purple-600 text-white rounded-2xl font-bold hover:bg-purple-700 transition-all shadow-lg shadow-purple-200">Confirm</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {disabledClasses.length > 0 && (
                <div className="mt-12 pt-8 border-t border-slate-200">
                    <h3 className="text-lg font-bold text-slate-500 mb-4">Hidden Standard Classes</h3>
                    <div className="flex flex-wrap gap-3">
                        {disabledClasses.map(cls => (
                            <div key={cls} className="flex items-center gap-2 px-4 py-2 bg-slate-100 rounded-lg border border-slate-200">
                                <span className="text-slate-500 line-through decoration-slate-300">{cls}</span>
                                <button onClick={() => handleToggleClassVisibility(cls, 'unhide')} className="p-1 ml-2 text-indigo-500 hover:text-indigo-700 hover:bg-indigo-50 rounded"><i className="fa-solid fa-eye"></i></button>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default ClassManagement;
