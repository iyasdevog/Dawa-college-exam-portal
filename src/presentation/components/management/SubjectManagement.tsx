import React, { useState } from 'react';
import { SubjectConfig, StudentRecord } from '../../../domain/entities/types';
import { dataService } from '../../../infrastructure/services/dataService';
import { useMobile } from '../../hooks/useMobile';

interface SubjectManagementProps {
    subjects: SubjectConfig[];
    students: StudentRecord[];
    onRefresh: () => Promise<void>;
    isLoading: boolean;
}

const SubjectManagement: React.FC<SubjectManagementProps> = ({ subjects, students, onRefresh, isLoading }) => {
    const { isMobile } = useMobile();
    const [isOperating, setIsOperating] = useState(false);

    // Subject form state
    const [showSubjectForm, setShowSubjectForm] = useState(false);
    const [editingSubject, setEditingSubject] = useState<SubjectConfig | null>(null);
    const [subjectForm, setSubjectForm] = useState({
        name: '',
        arabicName: '',
        maxTA: 50,
        maxCE: 30,
        passingTotal: 35,
        facultyName: '',
        targetClasses: [] as string[],
        subjectType: 'general' as 'general' | 'elective',
        enrolledStudents: [] as string[]
    });

    // Enrollment state
    const [showEnrollmentModal, setShowEnrollmentModal] = useState(false);
    const [selectedSubjectForEnrollment, setSelectedSubjectForEnrollment] = useState<SubjectConfig | null>(null);
    const [enrollmentClassFilter, setEnrollmentClassFilter] = useState<string>('All');

    // New state for elective student selection
    const [showClassSelectionModal, setShowClassSelectionModal] = useState(false);
    const [activeClassForSelection, setActiveClassForSelection] = useState<string>('');
    const [studentSearchQuery, setStudentSearchQuery] = useState('');

    const uniqueClasses = Array.from(new Set(students.map(s => s.className))).sort();

    const handleAddSubject = () => {
        setEditingSubject(null);
        setSubjectForm({
            name: '',
            arabicName: '',
            maxTA: 50,
            maxCE: 30,
            passingTotal: 35,
            facultyName: '',
            targetClasses: [],
            subjectType: 'general',
            enrolledStudents: []
        });
        setShowSubjectForm(true);
    };

    const handleEditSubject = (subject: SubjectConfig) => {
        setEditingSubject(subject);
        setSubjectForm({
            name: subject.name,
            arabicName: subject.arabicName || '',
            maxTA: subject.maxTA,
            maxCE: subject.maxCE,
            passingTotal: subject.passingTotal,
            facultyName: subject.facultyName || '',
            targetClasses: subject.targetClasses,
            subjectType: subject.subjectType || 'general',
            enrolledStudents: subject.enrolledStudents || []
        });
        setShowSubjectForm(true);
    };

    // State for tabs
    const [activeTab, setActiveTab] = useState<'subjects' | 'faculty'>('subjects');

    const toSentenceCase = (str: string) => {
        if (!str) return '';
        return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
    };

    const handleSaveSubject = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const normalizedName = toSentenceCase(subjectForm.name.trim());

            // Validation: Check for existing subjects for selected classes
            const conflictingClasses: string[] = [];

            subjects.forEach(s => {
                if (editingSubject && s.id === editingSubject.id) return; // Skip itself

                // Compare names
                if (s.name.trim().toLowerCase() === normalizedName.toLowerCase()) {
                    // Check intersection of classes
                    const existingClasses = s.targetClasses || [];
                    const newClasses = subjectForm.targetClasses || [];

                    newClasses.forEach(c => {
                        if (existingClasses.includes(c)) {
                            conflictingClasses.push(c);
                        }
                    });
                }
            });

            // Filter out conflicting classes to prevent duplicates
            const uniqueTargetClasses = subjectForm.targetClasses.filter(c => !conflictingClasses.includes(c));

            if (uniqueTargetClasses.length === 0) {
                // If all selected classes already have this subject
                if (conflictingClasses.length > 0) {
                    alert(`Subject "${normalizedName}" already exists for: ${conflictingClasses.join(', ')}.\n\nNo changes saved.`);
                } else {
                    alert('Please select at least one class.');
                }
                return;
            }

            // If some classes were duplicates, warn but proceed with unique ones
            if (conflictingClasses.length > 0) {
                const proceed = confirm(`Subject "${normalizedName}" already exists for: ${conflictingClasses.join(', ')}.\n\nIt will only be created/updated for: ${uniqueTargetClasses.join(', ')}.\n\nProceed?`);
                if (!proceed) return;
            }

            setIsOperating(true);
            const subjectData = {
                name: normalizedName,
                arabicName: subjectForm.arabicName.trim(),
                maxTA: subjectForm.maxTA,
                maxCE: subjectForm.maxCE,
                passingTotal: subjectForm.passingTotal,
                facultyName: subjectForm.facultyName.trim(),
                targetClasses: uniqueTargetClasses, // Use filtered classes
                subjectType: subjectForm.subjectType,
                enrolledStudents: subjectForm.enrolledStudents
            };

            if (editingSubject) {
                await dataService.updateSubject(editingSubject.id, subjectData);
            } else {
                await dataService.addSubject(subjectData);
            }
            await onRefresh();
            setShowSubjectForm(false);
            setEditingSubject(null);
        } catch (error) {
            console.error('Error saving subject:', error);
            alert('Error saving subject.');
        } finally {
            setIsOperating(false);
        }
    };

    // Updated to handle deletion of specific class or bulk deletion of grouped subjects
    const handleDeleteSubject = async (subject: SubjectConfig & { relatedIds?: string[] }, specificClass?: string) => {
        const confirmMsg = specificClass
            ? `Remove ${subject.name} from class ${specificClass}?`
            : `Delete subject ${subject.name} entirely?`;

        if (!confirm(confirmMsg)) return;

        try {
            setIsOperating(true);

            if (specificClass && subject.targetClasses && subject.targetClasses.length > 1 && !subject.relatedIds) {
                // Remove only this class from the subject (Old General Subject logic)
                const updatedClasses = subject.targetClasses.filter(c => c !== specificClass);
                await dataService.updateSubject(subject.id, {
                    ...subject,
                    targetClasses: updatedClasses
                });
            } else if (subject.relatedIds && subject.relatedIds.length > 0) {
                // Bulk delete for grouped electives
                for (const id of subject.relatedIds) {
                    await dataService.deleteSubject(id);
                }
            } else {
                // Delete the whole subject if it's the last class or no class specified
                await dataService.deleteSubject(subject.id);
            }

            await onRefresh();
        } catch (error) {
            console.error(error);
            alert('Error deleting subject.');
        } finally {
            setIsOperating(false);
        }
    };

    const handleManageEnrollment = (subject: SubjectConfig) => {
        if (subject.subjectType !== 'elective') {
            alert('Only elective subjects support enrollment management');
            return;
        }
        setSelectedSubjectForEnrollment(subject);
        // Default filter to first target class if available, else All
        if (subject.targetClasses && subject.targetClasses.length > 0) {
            setEnrollmentClassFilter(subject.targetClasses[0]);
        } else {
            setEnrollmentClassFilter('All');
        }
        setShowEnrollmentModal(true);
    };

    const handleToggleStudentEnrollment = async (studentId: string, isEnrolled: boolean) => {
        if (!selectedSubjectForEnrollment) return;
        try {
            setIsOperating(true);
            if (isEnrolled) {
                await dataService.unenrollStudentFromSubject(selectedSubjectForEnrollment.id, studentId);
            } else {
                await dataService.enrollStudentInSubject(selectedSubjectForEnrollment.id, studentId);
            }
            // Update local state temporarily for UI responsiveness, then refresh
            const updatedEnrolledStudents = isEnrolled
                ? (selectedSubjectForEnrollment.enrolledStudents || []).filter(id => id !== studentId)
                : [...(selectedSubjectForEnrollment.enrolledStudents || []), studentId];

            setSelectedSubjectForEnrollment({
                ...selectedSubjectForEnrollment,
                enrolledStudents: updatedEnrolledStudents
            });

            await onRefresh();
        } catch (error) {
            alert('Error updating enrollment.');
        } finally {
            setIsOperating(false);
        }
    };

    const handleClassChange = (className: string, checked: boolean) => {
        if (checked) {
            setSubjectForm(prev => ({ ...prev, targetClasses: [...prev.targetClasses, className] }));
        } else {
            setSubjectForm(prev => ({ ...prev, targetClasses: prev.targetClasses.filter(c => c !== className) }));
        }
    };

    const handleOpenClassSelection = (className: string) => {
        setActiveClassForSelection(className);
        setStudentSearchQuery('');
        setShowClassSelectionModal(true);
    };

    const handleToggleStudentSelection = (studentId: string) => {
        setSubjectForm(prev => {
            const isSelected = prev.enrolledStudents.includes(studentId);
            const updatedEnrolled = isSelected
                ? prev.enrolledStudents.filter(id => id !== studentId)
                : [...prev.enrolledStudents, studentId];

            // Auto-update target classes based on enrollment
            // If we add a student, ensure their class is in targetClasses
            // If we remove the last student of a class, maybe prompt? (Skipping for simplicity)
            // But we should definitely add the class if it's not there
            let updatedTargets = [...prev.targetClasses];
            if (!isSelected) { // We are adding
                const student = students.find(s => s.id === studentId);
                if (student && !updatedTargets.includes(student.className)) {
                    updatedTargets.push(student.className);
                }
            }

            return {
                ...prev,
                enrolledStudents: updatedEnrolled,
                targetClasses: updatedTargets
            };
        });
    };

    // Group subjects by faculty for the overview tab
    const subjectsByFaculty = React.useMemo(() => {
        const grouped: Record<string, (SubjectConfig & { specificClass: string | string[] })[]> = {};

        // Helper to find existing group for electives
        const findExistingElective = (facultyList: any[], name: string) => {
            return facultyList.find(s => s.subjectType === 'elective' && s.name.toLowerCase() === name.toLowerCase());
        };

        const normalizedSubjects = subjects.map(s => ({
            ...s,
            facultyName: s.facultyName || 'Unassigned'
        }));

        normalizedSubjects.forEach(subject => {
            const faculty = subject.facultyName;
            if (!grouped[faculty]) {
                grouped[faculty] = [];
            }

            if (subject.subjectType === 'elective') {
                // Group separate elective records
                const existing = findExistingElective(grouped[faculty], subject.name);
                if (existing) {
                    // Append classes
                    const currentClasses = Array.isArray(existing.specificClass) ? existing.specificClass : [existing.specificClass];
                    const newClasses = subject.targetClasses || [];
                    const merged = Array.from(new Set([...currentClasses, ...newClasses])).sort();
                    existing.specificClass = merged;
                } else {
                    grouped[faculty].push({
                        ...subject,
                        specificClass: subject.targetClasses || []
                    });
                }
            } else {
                // Split general subjects by class
                if (subject.targetClasses && subject.targetClasses.length > 0) {
                    subject.targetClasses.forEach(cls => {
                        grouped[faculty].push({
                            ...subject,
                            specificClass: cls
                        });
                    });
                } else {
                    grouped[faculty].push({
                        ...subject,
                        specificClass: 'No Class'
                    });
                }
            }
        });

        // Sort faculties alphabetically
        return Object.entries(grouped).sort((a, b) => a[0].localeCompare(b[0]));
    }, [subjects]);

    // Flatten subjects for the list tab
    const [subjectFacultyFilter, setSubjectFacultyFilter] = useState<string>('All');

    // Get unique faculties for filter
    const uniqueFaculties = React.useMemo(() => {
        const faculties = new Set(subjects.map(s => s.facultyName || 'Unassigned'));
        return Array.from(faculties).sort();
    }, [subjects]);

    const flattenedSubjectList = React.useMemo(() => {
        const electiveGroups: Record<string, SubjectConfig & { specificClass: string[], relatedIds: string[] }> = {};
        const flattened: (SubjectConfig & { specificClass: string | string[], relatedIds?: string[] })[] = [];

        subjects.forEach(subject => {
            if (subject.subjectType === 'elective') {
                const key = `${subject.name.trim().toLowerCase()}-${(subject.facultyName || '').trim().toLowerCase()}`;

                if (electiveGroups[key]) {
                    const existing = electiveGroups[key];
                    if (subject.targetClasses) {
                        subject.targetClasses.forEach(c => {
                            if (!existing.specificClass.includes(c)) {
                                existing.specificClass.push(c);
                            }
                        });
                    }
                    existing.relatedIds.push(subject.id);
                    if (subject.enrolledStudents) {
                        const currentEnrolled = existing.enrolledStudents || [];
                        existing.enrolledStudents = Array.from(new Set([...currentEnrolled, ...subject.enrolledStudents]));
                    }
                } else {
                    electiveGroups[key] = {
                        ...subject,
                        specificClass: [...(subject.targetClasses || [])],
                        relatedIds: [subject.id]
                    };
                }
            } else {
                if (subject.targetClasses && subject.targetClasses.length > 0) {
                    subject.targetClasses.forEach(cls => {
                        flattened.push({ ...subject, specificClass: cls });
                    });
                } else {
                    flattened.push({ ...subject, specificClass: '-' });
                }
            }
        });

        Object.values(electiveGroups).forEach(group => {
            flattened.push({
                ...group,
                specificClass: group.specificClass.length > 0 ? group.specificClass.sort() : ['-']
            });
        });

        const filtered = subjectFacultyFilter === 'All'
            ? flattened
            : flattened.filter(s => (s.facultyName || 'Unassigned') === subjectFacultyFilter);

        return filtered.sort((a, b) => {
            const nameCompare = a.name.localeCompare(b.name);
            if (nameCompare !== 0) return nameCompare;

            const classA = Array.isArray(a.specificClass) ? a.specificClass.join(',') : a.specificClass;
            const classB = Array.isArray(b.specificClass) ? b.specificClass.join(',') : b.specificClass;
            return classA.localeCompare(classB);
        });
    }, [subjects, subjectFacultyFilter]);

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-xl font-black text-slate-900">Subject Management</h2>
                <button
                    onClick={handleAddSubject}
                    disabled={isOperating}
                    className="px-4 py-2 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-all disabled:opacity-50 flex items-center gap-2"
                >
                    <i className="fa-solid fa-plus"></i>
                    Add Subject
                </button>
            </div>

            {/* Tabs */}
            <div className="flex gap-4 border-b border-slate-200">
                <button
                    onClick={() => setActiveTab('subjects')}
                    className={`pb-2 px-4 font-bold border-b-2 transition-colors ${activeTab === 'subjects' ? 'border-emerald-500 text-emerald-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                >
                    Subject List
                </button>
                <button
                    onClick={() => setActiveTab('faculty')}
                    className={`pb-2 px-4 font-bold border-b-2 transition-colors ${activeTab === 'faculty' ? 'border-emerald-500 text-emerald-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                >
                    Faculty Overview
                </button>
            </div>

            {activeTab === 'subjects' ? (
                <div className="space-y-4">
                    <div className="flex items-center gap-4 bg-slate-50 p-3 rounded-xl border border-slate-200">
                        <div className="flex items-center gap-2">
                            <i className="fa-solid fa-filter text-slate-400"></i>
                            <label className="font-bold text-sm text-slate-700">Filter by Faculty:</label>
                        </div>
                        <select
                            value={subjectFacultyFilter}
                            onChange={(e) => setSubjectFacultyFilter(e.target.value)}
                            className="p-2 pl-3 pr-8 border rounded-lg bg-white font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        >
                            <option value="All">All Faculties</option>
                            {uniqueFaculties.map(f => (
                                <option key={f} value={f}>{f}</option>
                            ))}
                        </select>
                        <span className="text-xs text-slate-400 ml-auto font-medium">
                            {flattenedSubjectList.length} assignments found
                        </span>
                    </div>

                    <div className="overflow-x-auto rounded-xl border border-slate-200 shadow-sm">
                        {flattenedSubjectList.length > 0 ? (
                            <table className="w-full">
                                <thead className="bg-slate-50 border-b border-slate-200">
                                    <tr>
                                        <th className="text-left p-4 font-bold text-slate-700">Name</th>
                                        <th className="text-left p-4 font-bold text-slate-700">Faculty</th>
                                        <th className="text-center p-4 font-bold text-slate-700">Type</th>
                                        <th className="text-center p-4 font-bold text-slate-700">Max TA/CE</th>
                                        <th className="text-center p-4 font-bold text-slate-700">Class</th>
                                        <th className="text-center p-4 font-bold text-slate-700">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {flattenedSubjectList.map((subject, index) => (
                                        <tr key={`${subject.id}-${Array.isArray(subject.specificClass) ? 'all' : subject.specificClass}-${index}`} className="bg-white hover:bg-slate-50 transition-colors">
                                            <td className="p-4 font-bold text-slate-800">{subject.name}</td>
                                            <td className="p-4 text-slate-600">{subject.facultyName || '-'}</td>
                                            <td className="p-4 text-center">
                                                <span className={`px-2 py-1 rounded-full text-[10px] uppercase font-bold tracking-wider ${(subject.subjectType || 'general') === 'general' ? 'bg-blue-50 text-blue-700 border border-blue-100' : 'bg-purple-50 text-purple-700 border border-purple-100'}`}>
                                                    {subject.subjectType || 'general'}
                                                </span>
                                                {subject.subjectType === 'elective' && (
                                                    <div className="text-[10px] text-slate-400 mt-1 font-medium">{(subject.enrolledStudents || []).length} enrolled</div>
                                                )}
                                            </td>
                                            <td className="p-4 text-center font-mono text-xs text-slate-500">{subject.maxTA} / {subject.maxCE}</td>
                                            <td className="p-4 text-center">
                                                {Array.isArray(subject.specificClass) ? (
                                                    <span className="bg-slate-800 text-white text-xs px-3 py-1 rounded-lg font-bold shadow-sm">
                                                        {subject.specificClass.join(', ')}
                                                    </span>
                                                ) : (
                                                    <span className="bg-slate-800 text-white text-xs px-3 py-1 rounded-lg font-bold shadow-sm">{subject.specificClass}</span>
                                                )}
                                            </td>
                                            <td className="p-4 text-center flex justify-center gap-2">
                                                {subject.subjectType === 'elective' && (
                                                    <button onClick={() => handleManageEnrollment(subject)} className="w-8 h-8 flex items-center justify-center rounded-lg bg-purple-50 text-purple-600 hover:bg-purple-100 transition-colors" title="Manage Enrollment"><i className="fa-solid fa-users"></i></button>
                                                )}
                                                <button onClick={() => handleEditSubject(subject)} className="w-8 h-8 flex items-center justify-center rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors" title="Edit"><i className="fa-solid fa-pen"></i></button>
                                                {!Array.isArray(subject.specificClass) ? (
                                                    <button onClick={() => handleDeleteSubject(subject, subject.specificClass as string)} className="w-8 h-8 flex items-center justify-center rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-colors" title="Remove from this class"><i className="fa-solid fa-trash"></i></button>
                                                ) : (
                                                    <button onClick={() => handleDeleteSubject(subject)} className="w-8 h-8 flex items-center justify-center rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-colors" title="Delete Subject"><i className="fa-solid fa-trash"></i></button>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        ) : (
                            <div className="text-center p-12 text-slate-400">
                                <i className="fa-solid fa-folder-open text-4xl mb-3 opacity-20"></i>
                                <p>No subjects found.</p>
                            </div>
                        )}
                    </div>
                </div>
            ) : (
                <div className="space-y-6">
                    {subjectsByFaculty.map(([faculty, facultySubjects]) => (
                        <div key={faculty} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                            <div className="bg-slate-50 p-4 border-b border-slate-200 flex justify-between items-center">
                                <h3 className="font-bold text-slate-900">{faculty}</h3>
                                <span className="bg-slate-200 text-slate-700 text-xs px-2 py-1 rounded-full font-bold">{facultySubjects.length} Subject{facultySubjects.length !== 1 ? 's' : ''}</span>
                            </div>
                            <div className="p-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {facultySubjects.map((subject, idx) => (
                                        <div key={`${subject.id}-${subject.specificClass}-${idx}`} className="border rounded-lg p-3 hover:bg-slate-50 transition-colors">
                                            <div className="flex justify-between items-start mb-2">
                                                <h4 className="font-bold text-emerald-800">{subject.name}</h4>
                                                <span className={`text-[10px] px-2 py-0.5 rounded-full uppercase font-bold ${subject.subjectType === 'elective' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                                                    {subject.subjectType || 'General'}
                                                </span>
                                            </div>
                                            <div className="flex flex-wrap gap-1 mb-2">
                                                {Array.isArray(subject.specificClass) ? (
                                                    <span className="text-xs bg-slate-800 text-white px-2 py-1 rounded font-bold shadow-sm">
                                                        {subject.specificClass.join(', ')}
                                                    </span>
                                                ) : (
                                                    <span className="text-xs bg-slate-800 text-white px-2 py-1 rounded font-bold shadow-sm">{subject.specificClass}</span>
                                                )}
                                            </div>
                                            <div className="text-xs text-slate-400">
                                                Max TA: {subject.maxTA} | Max CE: {subject.maxCE}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    ))}
                    {subjectsByFaculty.length === 0 && (
                        <div className="text-center p-8 text-slate-500">No faculty assignments found.</div>
                    )}
                </div>
            )}


            {/* Subject Form Modal */}
            {showSubjectForm && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-2xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
                        <h3 className="text-xl font-bold mb-4">{editingSubject ? 'Edit Subject' : 'Add Subject'}</h3>
                        <form onSubmit={handleSaveSubject} className="space-y-4">
                            <div>
                                <label className="block text-sm font-bold mb-1">Subject Name</label>
                                <input type="text" value={subjectForm.name} onChange={e => setSubjectForm(prev => ({ ...prev, name: e.target.value }))} className="w-full p-3 border rounded-xl" required />
                            </div>
                            <div>
                                <label className="block text-sm font-bold mb-1">Faculty Name</label>
                                <input
                                    type="text"
                                    value={subjectForm.facultyName}
                                    onChange={e => setSubjectForm(prev => ({ ...prev, facultyName: e.target.value }))}
                                    className="w-full p-3 border rounded-xl"
                                    placeholder="e.g. Ustadh Ahmed"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-bold mb-1">Max TA</label>
                                    <select
                                        value={subjectForm.maxTA}
                                        onChange={e => {
                                            const newMaxTA = parseInt(e.target.value);
                                            setSubjectForm(prev => ({
                                                ...prev,
                                                maxTA: newMaxTA,
                                                maxCE: newMaxTA === 100 ? 0 : (prev.maxCE === 0 ? 30 : prev.maxCE)
                                            }));
                                        }}
                                        className="w-full p-3 border rounded-xl"
                                    >
                                        <option value={100}>100</option>
                                        <option value={70}>70</option>
                                        <option value={50}>50</option>
                                        <option value={35}>35</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-bold mb-1">Max CE</label>
                                    <select
                                        value={subjectForm.maxCE}
                                        onChange={e => setSubjectForm(prev => ({ ...prev, maxCE: parseInt(e.target.value) }))}
                                        className="w-full p-3 border rounded-xl disabled:bg-slate-100 disabled:text-slate-400"
                                        disabled={subjectForm.maxTA === 100}
                                    >
                                        {subjectForm.maxTA === 100 ? (
                                            <option value={0}>0 (Not Applicable)</option>
                                        ) : (
                                            <>
                                                <option value={50}>50</option>
                                                <option value={30}>30</option>
                                            </>
                                        )}
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-bold mb-1">Type</label>
                                <select value={subjectForm.subjectType} onChange={e => setSubjectForm(prev => ({ ...prev, subjectType: e.target.value as any }))} className="w-full p-3 border rounded-xl">
                                    <option value="general">General</option>
                                    <option value="elective">Elective</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-bold mb-1">Target Classes {subjectForm.subjectType === 'elective' && <span className="text-xs font-normal text-slate-500">(Click class to select students)</span>}</label>
                                <div className="flex flex-wrap gap-2">
                                    {['S1', 'S2', 'S3', 'P1', 'P2', 'D1', 'D2', 'D3', 'PG1', 'PG2'].map(cls => {
                                        if (subjectForm.subjectType === 'elective') {
                                            const enrolledCount = students.filter(s => s.className === cls && subjectForm.enrolledStudents.includes(s.id)).length;
                                            const isTarget = subjectForm.targetClasses.includes(cls) || enrolledCount > 0;

                                            return (
                                                <button
                                                    key={cls}
                                                    type="button"
                                                    onClick={() => handleOpenClassSelection(cls)}
                                                    className={`flex items-center gap-2 p-2 border rounded-lg transition-all ${isTarget
                                                        ? 'bg-purple-50 border-purple-200 text-purple-700'
                                                        : 'hover:bg-slate-50'
                                                        }`}
                                                >
                                                    <span className={`font-bold ${isTarget ? 'text-purple-700' : 'text-slate-700'}`}>{cls}</span>
                                                    {enrolledCount > 0 && <span className="bg-purple-200 text-purple-800 text-xs px-2 py-0.5 rounded-full font-bold">{enrolledCount}</span>}
                                                    <i className="fa-solid fa-chevron-right text-xs opacity-50 ml-1"></i>
                                                </button>
                                            );
                                        } else {
                                            return (
                                                <label key={cls} className="flex items-center gap-2 p-2 border rounded cursor-pointer hover:bg-slate-50">
                                                    <input
                                                        type="checkbox"
                                                        checked={subjectForm.targetClasses.includes(cls)}
                                                        onChange={(e) => handleClassChange(cls, e.target.checked)}
                                                    />
                                                    {cls}
                                                </label>
                                            );
                                        }
                                    })}
                                </div>
                                {subjectForm.targetClasses.length > 1 && (
                                    <div className="mt-2 text-xs text-amber-600 bg-amber-50 p-2 rounded-lg border border-amber-100 flex items-start gap-2">
                                        <i className="fa-solid fa-lightbulb mt-0.5"></i>
                                        <p>
                                            <strong>Note:</strong> Selecting multiple classes means this exact subject (with same grading) applies to all.
                                            If the grading differs, please create separate subjects for each class.
                                        </p>
                                    </div>
                                )}
                            </div>
                            <div className="flex gap-3 pt-4">
                                <button type="button" onClick={() => setShowSubjectForm(false)} className="flex-1 py-3 bg-slate-100 rounded-xl">Cancel</button>
                                <button type="submit" className="flex-1 py-3 bg-emerald-600 text-white rounded-xl">Save</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Enrollment Modal */}
            {showEnrollmentModal && selectedSubjectForEnrollment && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-2xl w-full max-w-2xl p-6 h-[80vh] flex flex-col">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-xl font-bold">Manage Enrollment: {selectedSubjectForEnrollment.name}</h3>
                            <button onClick={() => setShowEnrollmentModal(false)} className="bg-slate-100 p-2 rounded-full hover:bg-slate-200"><i className="fa-solid fa-times"></i></button>
                        </div>
                        <div className="flex-1 overflow-y-auto">
                            <div className="mb-4 flex items-center gap-4">
                                <label className="font-bold text-sm text-slate-700">Filter by Class:</label>
                                <select
                                    value={enrollmentClassFilter}
                                    onChange={(e) => setEnrollmentClassFilter(e.target.value)}
                                    className="p-2 border rounded-lg"
                                >
                                    <option value="All">All Classes</option>
                                    {uniqueClasses.map(cls => (
                                        <option key={cls} value={cls}>{cls}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Filter students based on selection */}
                            {(() => {
                                const displayedStudents = enrollmentClassFilter === 'All'
                                    ? students
                                    : students.filter(s => s.className === enrollmentClassFilter);

                                return displayedStudents.length > 0 ? (
                                    <table className="w-full">
                                        <thead>
                                            <tr className="text-left border-b bg-slate-50">
                                                <th className="p-3 sticky top-0 bg-slate-50 font-bold text-slate-700">Student Name</th>
                                                <th className="p-3 sticky top-0 bg-slate-50 font-bold text-slate-700">Class</th>
                                                <th className="p-3 sticky top-0 bg-slate-50 font-bold text-slate-700 text-center">Status</th>
                                                <th className="p-3 sticky top-0 bg-slate-50 font-bold text-slate-700 text-center">Action</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {displayedStudents.map(student => {
                                                const isEnrolled = (selectedSubjectForEnrollment.enrolledStudents || []).includes(student.id);
                                                return (
                                                    <tr key={student.id} className="border-b hover:bg-slate-50 transition-colors">
                                                        <td className="p-3 font-medium text-slate-900">{student.name}</td>
                                                        <td className="p-3 text-sm text-slate-500 font-medium">{student.className}</td>
                                                        <td className="p-3 text-center">
                                                            {isEnrolled ?
                                                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
                                                                    Enrolled
                                                                </span> :
                                                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-500">
                                                                    Not Enrolled
                                                                </span>
                                                            }
                                                        </td>
                                                        <td className="p-3 text-center">
                                                            <button
                                                                onClick={() => handleToggleStudentEnrollment(student.id, isEnrolled)}
                                                                className={`w-24 py-1.5 rounded-lg text-xs font-bold transition-all ${isEnrolled
                                                                    ? 'bg-red-50 text-red-600 hover:bg-red-100 border border-red-200'
                                                                    : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100 border border-emerald-200'
                                                                    }`}
                                                            >
                                                                {isEnrolled ? 'Remove' : 'Enroll'}
                                                            </button>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                ) : (
                                    <div className="flex flex-col items-center justify-center h-40 text-slate-500">
                                        <i className="fa-solid fa-graduation-cap text-3xl mb-2 opacity-20"></i>
                                        <p>No students found in {enrollmentClassFilter === 'All' ? 'any class' : enrollmentClassFilter}</p>
                                    </div>
                                );
                            })()}
                        </div>
                    </div>
                </div>
            )}

            {/* Class Student Selection Modal (For Electives Creation) */}
            {showClassSelectionModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[60]">
                    <div className="bg-white rounded-2xl w-full max-w-lg p-6 max-h-[80vh] flex flex-col">
                        <div className="flex justify-between items-center mb-4">
                            <div>
                                <h3 className="text-xl font-bold">Select Students: {activeClassForSelection}</h3>
                                <p className="text-sm text-slate-500">Pick students for this elective</p>
                            </div>
                            <button onClick={() => setShowClassSelectionModal(false)} className="bg-slate-100 p-2 rounded-full hover:bg-slate-200"><i className="fa-solid fa-check"></i></button>
                        </div>

                        <div className="mb-4">
                            <div className="relative">
                                <i className="fa-solid fa-search absolute left-3 top-3 text-slate-400"></i>
                                <input
                                    type="text"
                                    placeholder="Search students..."
                                    value={studentSearchQuery}
                                    onChange={(e) => setStudentSearchQuery(e.target.value)}
                                    className="w-full p-2 pl-10 border rounded-xl bg-slate-50"
                                />
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto">
                            {(() => {
                                const classStudents = students.filter(s => s.className === activeClassForSelection);
                                const filteredClassStudents = studentSearchQuery
                                    ? classStudents.filter(s => s.name.toLowerCase().includes(studentSearchQuery.toLowerCase()))
                                    : classStudents;

                                return filteredClassStudents.length > 0 ? (
                                    <div className="space-y-2">
                                        {filteredClassStudents.map(student => {
                                            const isSelected = subjectForm.enrolledStudents.includes(student.id);
                                            return (
                                                <div
                                                    key={student.id}
                                                    onClick={() => handleToggleStudentSelection(student.id)}
                                                    className={`flex items-center justify-between p-3 rounded-xl cursor-pointer border transition-all ${isSelected
                                                        ? 'bg-purple-50 border-purple-200'
                                                        : 'hover:bg-slate-50 border-slate-100'
                                                        }`}
                                                >
                                                    <div>
                                                        <p className={`font-bold ${isSelected ? 'text-purple-900' : 'text-slate-900'}`}>{student.name}</p>
                                                        <p className="text-xs text-slate-500">Adm: {student.adNo}</p>
                                                    </div>
                                                    <div className={`w-6 h-6 rounded-full flex items-center justify-center border ${isSelected
                                                        ? 'bg-purple-600 border-purple-600 text-white'
                                                        : 'border-slate-300 bg-white'
                                                        }`}>
                                                        {isSelected && <i className="fa-solid fa-check text-xs"></i>}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <div className="text-center p-8 text-slate-500">
                                        <p>No students found.</p>
                                    </div>
                                );
                            })()}
                        </div>

                        <div className="mt-4 pt-4 border-t flex justify-end">
                            <button
                                onClick={() => setShowClassSelectionModal(false)}
                                className="px-6 py-2 bg-slate-900 text-white rounded-xl font-bold"
                            >
                                Done
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SubjectManagement;
