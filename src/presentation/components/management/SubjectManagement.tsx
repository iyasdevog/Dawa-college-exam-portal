import React, { useState, useEffect } from 'react';
import { SubjectConfig, StudentRecord, CurriculumEntry } from '../../../domain/entities/types';
import { dataService } from '../../../infrastructure/services/dataService';
import { useMobile } from '../../hooks/useMobile';
import { normalizeName, shortenSubjectName } from '../../../infrastructure/services/formatUtils';
import { SubjectDetailsModal } from './SubjectDetailsModal';
import { SubjectDetails } from '../../../domain/entities/types';

interface SubjectManagementProps {
    subjects: SubjectConfig[];
    allHistoricalSubjects: SubjectConfig[];
    students: StudentRecord[];
    curriculum: CurriculumEntry[];
    activeTerm: string;
    onRefresh: () => Promise<void>;
    isLoading: boolean;
}

const SubjectRow = React.memo(({ subject, index, onEdit, onDelete, onManageEnrollment }: {
    subject: any,
    index: number,
    onEdit: (s: any) => void,
    onDelete: (s: any, c?: string) => void,
    onManageEnrollment: (s: any) => void
}) => {
    return (
        <tr key={`${subject.id}-${Array.isArray(subject.specificClass) ? 'all' : subject.specificClass}-${index}`} className="bg-white hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-0">
            <td className="p-2 sm:p-4 pr-1">
                <div className="font-bold text-slate-800 text-xs sm:text-sm line-clamp-1">{shortenSubjectName(subject.name)}</div>
                <div className="text-[10px] text-slate-400 sm:hidden">{subject.facultyName || '-'}</div>
            </td>
            <td className="hidden sm:table-cell p-4 text-slate-600 text-sm">{subject.facultyName || '-'}</td>
            <td className="p-2 sm:p-4 text-center">
                <span className={`px-1.5 py-0.5 rounded-full text-[9px] sm:text-[10px] uppercase font-bold tracking-wider ${
                    (subject.subjectType || 'general') === 'general' ? 'bg-blue-50 text-blue-700 border border-blue-100' : 
                    subject.subjectType === 'school_subject' ? 'bg-amber-50 text-amber-700 border border-amber-100' :
                    'bg-purple-50 text-purple-700 border border-purple-100'
                }`}>
                    {subject.subjectType === 'school_subject' ? 'School Subject' : (subject.subjectType || 'general')}
                </span>
            </td>
            <td className="p-2 sm:p-4 text-center font-mono text-[10px] sm:text-xs text-slate-500 whitespace-nowrap">
                {subject.maxEXT}<span className="text-slate-300 mx-0.5">/</span>{subject.maxINT}
            </td>
            <td className="p-2 sm:p-4 text-center">
                <span className="bg-slate-800 text-white text-[9px] sm:text-xs px-2 py-0.5 rounded font-bold shadow-sm inline-block max-w-[60px] sm:max-w-none truncate">
                    {Array.isArray(subject.specificClass) ? subject.specificClass.join(', ') : subject.specificClass}
                </span>
            </td>
            <td className="p-2 sm:p-4">
                <div className="flex justify-center gap-2 sm:gap-3">
                    {subject.subjectType === 'elective' && (
                        <button onClick={() => onManageEnrollment(subject)} className="w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center rounded-lg bg-purple-50 text-purple-600 hover:bg-purple-100 transition-colors" title="Manage Enrollment"><i className="fa-solid fa-users text-sm"></i></button>
                    )}
                    <button onClick={() => onEdit(subject)} className="w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors" title="Edit Properties"><i className="fa-solid fa-pen text-sm"></i></button>
                    <button 
                        onClick={() => onDelete(subject, !Array.isArray(subject.specificClass) ? (subject.specificClass as string) : undefined)} 
                        className="w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-colors" 
                        title="Delete"
                    >
                        <i className="fa-solid fa-trash text-sm"></i>
                    </button>
                </div>
            </td>
        </tr>
    );
});

const FacultyCard = React.memo(({ faculty, facultySubjects }: { faculty: string, facultySubjects: any[] }) => {
    return (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="bg-slate-50 p-4 border-b border-slate-200 flex justify-between items-center">
                <h3 className="font-bold text-slate-900">{faculty}</h3>
                <span className="bg-slate-200 text-slate-700 text-xs px-2 py-1 rounded-full font-bold">{facultySubjects.length} Subject{facultySubjects.length !== 1 ? 's' : ''}</span>
            </div>
            <div className="p-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {facultySubjects.map((subject, idx) => (
                        <div key={`${subject.id}-${subject.specificClass}-${idx}`} className="border rounded-lg p-3 hover:bg-slate-50 transition-colors">
                            <div className="flex justify-between items-start mb-2">
                                <h4 className="font-bold text-emerald-800">{shortenSubjectName(subject.name)}</h4>
                                <span className={`text-[10px] px-2 py-0.5 rounded-full uppercase font-bold ${
                                    subject.subjectType === 'school_subject' ? 'bg-amber-100 text-amber-700' : 
                                    subject.subjectType === 'elective' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
                                }`}>
                                    {subject.subjectType === 'school_subject' ? 'School Subject' : (subject.subjectType || 'General')}
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
                                Max EXT: {subject.maxEXT} | Max INT: {subject.maxINT}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
});

const SubjectManagement: React.FC<SubjectManagementProps> = ({ 
    subjects, 
    allHistoricalSubjects = [],
    students, 
    curriculum, 
    activeTerm, 
    onRefresh, 
    isLoading 
}) => {
    const { isMobile } = useMobile();
    const [isOperating, setIsOperating] = useState(false);

    // Subject form state
    const [showSubjectForm, setShowSubjectForm] = useState(false);
    const [editingSubject, setEditingSubject] = useState<SubjectConfig | null>(null);
    const [subjectForm, setSubjectForm] = useState({
        name: '',
        arabicName: '',
        maxINT: 30,
        maxEXT: 70,
        passingTotal: 40,
        facultyName: '',
        targetClasses: [] as string[],
        subjectType: 'general' as 'general' | 'elective' | 'school_subject',
        enrolledStudents: [] as string[],
        activeSemester: 'Both' as 'Odd' | 'Even' | 'Both',
        electiveType: 'intra-class' as 'intra-class' | 'cross-class',
        academicYear: ''
    });

    // Subject Details state
    const [showSubjectDetailsModal, setShowSubjectDetailsModal] = useState(false);
    const [selectedSubjectForDetails, setSelectedSubjectForDetails] = useState<SubjectConfig | null>(null);

    const handleEditDetails = (subject: SubjectConfig) => {
        setSelectedSubjectForDetails(subject);
        setShowSubjectDetailsModal(true);
    };

    const handleSaveSubjectDetails = async (subjectId: string, details: SubjectDetails) => {
        setIsOperating(true);
        try {
            await dataService.updateSubject(subjectId, { details });
            await onRefresh();
        } catch (error) {
            console.error('Error saving subject details:', error);
            throw error;
        } finally {
            setIsOperating(false);
        }
    };

    // Enrollment state
    const [showEnrollmentModal, setShowEnrollmentModal] = useState(false);
    const [selectedSubjectForEnrollment, setSelectedSubjectForEnrollment] = useState<SubjectConfig | null>(null);
    const [enrollmentClassFilter, setEnrollmentClassFilter] = useState<string>('All');

    // New state for elective student selection
    const [showClassSelectionModal, setShowClassSelectionModal] = useState(false);
    const [activeClassForSelection, setActiveClassForSelection] = useState<string>('');
    const [studentSearchQuery, setStudentSearchQuery] = useState('');
    const [isCreatingNewSubject, setIsCreatingNewSubject] = useState(false);
    const [isCreatingNewFaculty, setIsCreatingNewFaculty] = useState(false);

    const [availableClasses, setAvailableClasses] = useState<string[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const suggestionRef = React.useRef<HTMLDivElement>(null);

    const allSubjectSuggestions = React.useMemo(() => {
        const fromSubjects = subjects.map(s => s.name);
        const fromCurriculum = curriculum.map(c => c.subjectName);
        const fromHistorical = allHistoricalSubjects.map(s => s.name);
        return Array.from(new Set([...fromSubjects, ...fromCurriculum, ...fromHistorical])).sort();
    }, [subjects, curriculum, allHistoricalSubjects]);

    const filteredSuggestions = React.useMemo(() => {
        if (!subjectForm.name.trim()) return [];
        const query = subjectForm.name.toLowerCase();
        return allSubjectSuggestions.filter(name => 
            name.toLowerCase().includes(query) && name.toLowerCase() !== query
        );
    }, [allSubjectSuggestions, subjectForm.name]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (suggestionRef.current && !suggestionRef.current.contains(event.target as Node)) {
                setShowSuggestions(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        const loadClasses = async () => {
            if (activeTerm) {
                const classes = await dataService.getClassesByTerm(activeTerm);
                setAvailableClasses(classes);
            }
        };
        loadClasses();
    }, [activeTerm]);

    const handleAddSubject = () => {
        setEditingSubject(null);
        setSubjectForm({
            name: '',
            arabicName: '',
            maxINT: 30,
            maxEXT: 70,
            passingTotal: 40,
            facultyName: '',
            targetClasses: [],
            subjectType: 'general',
            electiveType: 'intra-class',
            activeSemester: 'Both',
            enrolledStudents: [],
            academicYear: ''
        });
        setIsCreatingNewSubject(false);
        setIsCreatingNewFaculty(false);
        setShowSubjectForm(true);
    };

    const handleEditSubject = (subject: SubjectConfig) => {
        setEditingSubject(subject);
        setSubjectForm({
            ...subject,
            name: subject.name,
            arabicName: subject.arabicName || '',
            facultyName: subject.facultyName || '',
            targetClasses: subject.targetClasses || [],
            subjectType: subject.subjectType || 'general',
            electiveType: subject.electiveType || 'intra-class',
            activeSemester: (subject as any).activeSemester || 'Both',
            enrolledStudents: subject.enrolledStudents || [],
            academicYear: (subject as any).academicYear || ''
        });
        setIsCreatingNewSubject(false);
        setIsCreatingNewFaculty(false);
        setShowSubjectForm(true);
    };

    // State for tabs
    const [activeTab, setActiveTab] = useState<'subjects' | 'faculty' | 'details'>('subjects');

    const toSentenceCase = (str: string) => {
        if (!str) return '';
        return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
    };

    const handleSaveSubject = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const normalizedName = normalizeName(subjectForm.name);

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

            // Normalize faculty name to Title Case
            const normalizedFacultyName = subjectForm.facultyName.trim()
                .split(' ')
                .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
                .join(' ');

            const subjectData = {
                name: normalizedName,
                arabicName: subjectForm.arabicName.trim(),
                maxINT: subjectForm.maxINT,
                maxEXT: subjectForm.maxEXT,
                passingTotal: subjectForm.passingTotal,
                facultyName: normalizedFacultyName,
                targetClasses: uniqueTargetClasses, // Use filtered classes
                subjectType: subjectForm.subjectType,
                electiveType: subjectForm.subjectType === 'elective' ? subjectForm.electiveType : undefined,
                enrolledStudents: subjectForm.enrolledStudents,
                activeSemester: subjectForm.activeSemester,
                academicYear: subjectForm.academicYear
            };

            if (editingSubject) {
                await dataService.updateSubject(editingSubject.id, subjectData);
            } else {
                await dataService.addSubject(subjectData);
            }
            await onRefresh();
            setShowSubjectForm(false);
            setEditingSubject(null);
            alert(`Subject "${subjectData.name}" saved successfully!`);
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

            if (subject.subjectType === 'elective' && subject.electiveType === 'cross-class') {
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
    const [subjectClassFilter, setSubjectClassFilter] = useState<string>('All');
    const [subjectSearchQuery, setSubjectSearchQuery] = useState<string>('');

    // Get unique faculties for filter - Include historical for discovery
    const uniqueFaculties = React.useMemo(() => {
        const currentFacs = subjects.map(s => s.facultyName).filter(Boolean);
        const historicalFacs = allHistoricalSubjects.map(s => s.facultyName).filter(Boolean);
        const faculties = new Set([...currentFacs, ...historicalFacs]);
        return Array.from(faculties).sort();
    }, [subjects, allHistoricalSubjects]);

    // Get normalized unique faculties for dropdown (with proper Title Case)
    const normalizedFaculties = React.useMemo(() => {
        // Extract all faculty names from current subjects and historical ones
        const currentFaculties = subjects.map(s => (s.facultyName || '').trim()).filter(Boolean).map(f => normalizeName(f));
        const historicalFaculties = allHistoricalSubjects.map(s => (s.facultyName || '').trim()).filter(Boolean).map(f => normalizeName(f));
        
        // Create a map to deduplicate (case-insensitive)
        const uniqueMap = new Map<string, string>();
        [...currentFaculties, ...historicalFaculties].forEach(name => {
            const key = name.toLowerCase();
            if (!uniqueMap.has(key)) {
                uniqueMap.set(key, name);
            }
        });

        return Array.from(uniqueMap.values()).sort();
    }, [subjects, allHistoricalSubjects]);

    const baseFlattenedSubjectList = React.useMemo(() => {
        const electiveGroups: Record<string, SubjectConfig & { specificClass: string[], relatedIds: string[] }> = {};
        const flattened: (SubjectConfig & { specificClass: string | string[], relatedIds?: string[] })[] = [];

        subjects.forEach(subject => {
            if (subject.subjectType === 'elective') {
                // If cross-class, group by name+faculty to show them as one combined entry (Common elective)
                if (subject.electiveType === 'cross-class') {
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
                    // Intra-class elective: Treat like general subject (separate entry per class)
                    if (subject.targetClasses && subject.targetClasses.length > 0) {
                        subject.targetClasses.forEach(cls => {
                            flattened.push({ ...subject, specificClass: cls });
                        });
                    } else {
                        flattened.push({ ...subject, specificClass: '-' });
                    }
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

        return flattened.sort((a, b) => {
            const nameCompare = a.name.localeCompare(b.name);
            if (nameCompare !== 0) return nameCompare;

            const classA = Array.isArray(a.specificClass) ? a.specificClass.join(',') : a.specificClass;
            const classB = Array.isArray(b.specificClass) ? b.specificClass.join(',') : b.specificClass;
            return classA.localeCompare(classB);
        });
    }, [subjects]);

    const flattenedSubjectList = React.useMemo(() => {
        let list = baseFlattenedSubjectList;
        
        if (subjectFacultyFilter !== 'All') {
            list = list.filter(s => (s.facultyName || 'Unassigned') === subjectFacultyFilter);
        }
        
        if (subjectClassFilter !== 'All') {
            list = list.filter(s => {
                if (Array.isArray(s.specificClass)) {
                    return s.specificClass.includes(subjectClassFilter);
                }
                return s.specificClass === subjectClassFilter;
            });
        }
        
        if (subjectSearchQuery.trim() !== '') {
            const query = subjectSearchQuery.toLowerCase();
            list = list.filter(s => 
                s.name.toLowerCase().includes(query) || 
                (s.facultyName || '').toLowerCase().includes(query)
            );
        }

        return list;
    }, [baseFlattenedSubjectList, subjectFacultyFilter, subjectClassFilter, subjectSearchQuery]);

    // Syllabus Details Filters
    const [detailsNameFilter, setDetailsNameFilter] = useState('All');
    const [detailsFacultyFilter, setDetailsFacultyFilter] = useState('All');
    const [detailsClassFilter, setDetailsClassFilter] = useState('All');

    const uniqueSubjectNames = React.useMemo(() => {
        let list = baseFlattenedSubjectList;
        if (detailsFacultyFilter !== 'All') list = list.filter(s => (s.facultyName || 'Unassigned') === detailsFacultyFilter);
        if (detailsClassFilter !== 'All') {
            list = list.filter(s => Array.isArray(s.specificClass) ? s.specificClass.includes(detailsClassFilter) : s.specificClass === detailsClassFilter);
        }
        const names = new Set(list.map(s => s.name));
        return Array.from(names).sort((a, b) => a.localeCompare(b));
    }, [baseFlattenedSubjectList, detailsFacultyFilter, detailsClassFilter]);

    const filteredDetailsSubjects = React.useMemo(() => {
        let list = baseFlattenedSubjectList;

        if (detailsNameFilter !== 'All') {
            list = list.filter(s => s.name === detailsNameFilter);
        }
        if (detailsFacultyFilter !== 'All') {
            list = list.filter(s => (s.facultyName || 'Unassigned') === detailsFacultyFilter);
        }
        if (detailsClassFilter !== 'All') {
            list = list.filter(s => {
                if (Array.isArray(s.specificClass)) {
                    return s.specificClass.includes(detailsClassFilter);
                }
                return s.specificClass === detailsClassFilter;
            });
        }
        
        return list;
    }, [baseFlattenedSubjectList, detailsNameFilter, detailsFacultyFilter, detailsClassFilter]);

    return (
        <div className="space-y-4 sm:space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                    <h2 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">Subject Management</h2>
                    {activeTerm && (
                        <span className="text-[10px] sm:text-xs px-2 sm:px-3 py-1 rounded-full font-bold border bg-emerald-50 text-emerald-700 border-emerald-200 whitespace-nowrap shadow-sm">
                            {activeTerm}
                        </span>
                    )}
                </div>
                <button
                    onClick={handleAddSubject}
                    disabled={isOperating}
                    className="w-full sm:w-auto px-4 py-2 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-sm"
                >
                    <i className="fa-solid fa-plus text-xs"></i>
                    <span className="block sm:hidden">Add</span>
                    <span className="hidden sm:block">Add Subject</span>
                </button>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 sm:gap-4 border-b border-slate-200 overflow-x-auto no-scrollbar scroll-smooth -mx-4 sm:mx-0 px-4 sm:px-0">
                {[
                    { id: 'subjects', label: 'Subject List' },
                    { id: 'faculty', label: 'Faculty Overview' },
                    { id: 'details', label: 'Detailed Syllabus' }
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as any)}
                        className={`pb-3 px-4 whitespace-nowrap font-bold border-b-2 transition-all text-xs sm:text-sm ${
                            activeTab === tab.id 
                            ? 'border-emerald-500 text-emerald-600' 
                            : 'border-transparent text-slate-400 hover:text-slate-600 hover:border-slate-200'
                        }`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {activeTab === 'subjects' && (
                <div className="space-y-4">
                    <div className="grid grid-cols-1 sm:flex sm:flex-wrap items-center gap-2 sm:gap-4 bg-slate-50 p-2 sm:p-3 rounded-2xl border border-slate-200">
                        <div className="flex items-center gap-2 px-1">
                            <i className="fa-solid fa-filter text-slate-400 text-xs"></i>
                            <label className="font-bold text-xs text-slate-500 uppercase tracking-wider">Filters</label>
                        </div>
                        <div className="flex flex-col sm:flex-row sm:flex-1 gap-2">
                            <select
                                value={subjectFacultyFilter}
                                onChange={(e) => setSubjectFacultyFilter(e.target.value)}
                                className="w-full sm:w-auto p-3 sm:p-2 border border-slate-200 rounded-xl bg-white font-bold text-xs text-slate-700 focus:ring-2 focus:ring-emerald-500 outline-none shadow-sm"
                            >
                                <option value="All">All Faculties</option>
                                {uniqueFaculties.map(f => (
                                    <option key={f} value={f}>{f}</option>
                                ))}
                            </select>
                            <select
                                value={subjectClassFilter}
                                onChange={(e) => setSubjectClassFilter(e.target.value)}
                                className="w-full sm:w-auto p-3 sm:p-2 border border-slate-200 rounded-xl bg-white font-bold text-xs text-slate-700 focus:ring-2 focus:ring-emerald-500 outline-none shadow-sm"
                            >
                                <option value="All">All Classes</option>
                                {availableClasses.map(c => (
                                    <option key={c} value={c}>{c}</option>
                                ))}
                            </select>
                        </div>
                        <div className="relative w-full sm:flex-1">
                            <i className="fa-solid fa-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
                            <input
                                type="text"
                                placeholder="Search subjects..."
                                value={subjectSearchQuery}
                                onChange={(e) => setSubjectSearchQuery(e.target.value)}
                                className="w-full p-3 sm:p-2 pl-10 sm:pl-9 border border-slate-200 rounded-xl bg-white font-bold text-xs text-slate-700 focus:ring-2 focus:ring-emerald-500 outline-none shadow-sm"
                            />
                        </div>
                        <span className="hidden lg:block text-[10px] text-slate-400 font-bold uppercase tracking-tighter bg-white px-2 py-1 rounded-lg border border-slate-100">
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
                                        <th className="text-center p-4 font-bold text-slate-700">Max EXT / INT</th>
                                        <th className="text-center p-4 font-bold text-slate-700">Class</th>
                                        <th className="text-center p-4 font-bold text-slate-700">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {flattenedSubjectList.map((subject, index) => (
                                        <SubjectRow
                                            key={`${subject.id}-${index}`}
                                            subject={subject}
                                            index={index}
                                            onEdit={handleEditSubject}
                                            onDelete={handleDeleteSubject}
                                            onManageEnrollment={handleManageEnrollment}
                                        />
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
            )}
            
            {activeTab === 'faculty' && (
                <div className="space-y-6">
                    {subjectsByFaculty.map(([faculty, facultySubjects]) => (
                        <FacultyCard
                            key={faculty}
                            faculty={faculty}
                            facultySubjects={facultySubjects}
                        />
                    ))}
                    {subjectsByFaculty.length === 0 && (
                        <div className="text-center p-8 text-slate-500">No faculty assignments found.</div>
                    )}
                </div>
            )}

            {activeTab === 'details' && (
                <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
                        <div className="flex flex-col gap-1">
                            <label className="font-bold text-xs text-slate-500 uppercase tracking-wider">Subject Name</label>
                            <select
                                value={detailsNameFilter}
                                onChange={e => setDetailsNameFilter(e.target.value)}
                                className="p-2 border rounded-lg focus:ring-2 focus:ring-teal-500 outline-none pr-8"
                            >
                                <option value="All">All Subjects</option>
                                {uniqueSubjectNames.map(name => <option key={name} value={name}>{name}</option>)}
                            </select>
                        </div>
                        <div className="flex flex-col gap-1">
                            <label className="font-bold text-xs text-slate-500 uppercase tracking-wider">Filter Faculty</label>
                            <select
                                value={detailsFacultyFilter}
                                onChange={e => setDetailsFacultyFilter(e.target.value)}
                                className="p-2 border rounded-lg focus:ring-2 focus:ring-teal-500 outline-none"
                            >
                                <option value="All">All Faculties</option>
                                {uniqueFaculties.map(f => <option key={f} value={f}>{f}</option>)}
                            </select>
                        </div>
                        <div className="flex flex-col gap-1">
                            <label className="font-bold text-xs text-slate-500 uppercase tracking-wider">Filter Class</label>
                            <select
                                value={detailsClassFilter}
                                onChange={e => setDetailsClassFilter(e.target.value)}
                                className="p-2 border rounded-lg focus:ring-2 focus:ring-teal-500 outline-none"
                            >
                                <option value="All">All Classes</option>
                                {availableClasses.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {filteredDetailsSubjects.map(subject => (
                            <div key={subject.id} className="bg-white border text-sm rounded-xl p-5 hover:shadow-md transition-shadow relative shadow-sm">
                                <div className="flex justify-between items-start mb-4">
                                    <h3 className="font-bold text-lg text-slate-800 leading-tight">{subject.name}</h3>
                                    <span className={`px-2 py-0.5 whitespace-nowrap text-[10px] rounded-full uppercase font-bold shadow-sm ${subject.details ? 'bg-teal-100 text-teal-700 border border-teal-200' : 'bg-slate-100 text-slate-500 border border-slate-200'}`}>
                                        {subject.details ? 'Syllabus Set' : 'Pending'}
                                    </span>
                                </div>
                                <div className="space-y-3 mb-6">
                                    <div className="flex items-center text-slate-600 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100">
                                        <i className="fa-solid fa-user-tie w-6 text-slate-400"></i>
                                        <span className="truncate flex-1 font-medium">{subject.facultyName || 'Unassigned'}</span>
                                    </div>
                                    <div className="flex items-center text-slate-600 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100">
                                        <i className="fa-solid fa-users w-6 text-slate-400"></i>
                                        <span className="truncate flex-1 font-medium">{Array.isArray(subject.specificClass) ? subject.specificClass.join(', ') : subject.specificClass}</span>
                                    </div>
                                    <div className="flex items-center text-slate-600 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100">
                                        <i className="fa-solid fa-book w-6 text-slate-400"></i>
                                        <span className="font-medium text-xs rounded-full bg-slate-200 px-2 text-slate-600 uppercase">{subject.subjectType || 'General'}</span>
                                    </div>
                                </div>
                                <button
                                    onClick={() => handleEditDetails(subject as unknown as SubjectConfig)}
                                    className="w-full py-2.5 bg-white border-2 border-teal-100 text-teal-600 focus:ring-4 focus:ring-teal-50 font-bold rounded-lg hover:bg-teal-50 transition-colors shadow-sm"
                                >
                                    <i className="fa-solid fa-pen-to-square mr-2"></i>
                                    {subject.details ? 'Edit Syllabus' : 'Add Syllabus'}
                                </button>
                            </div>
                        ))}
                        {filteredDetailsSubjects.length === 0 && (
                            <div className="col-span-full py-12 text-center text-slate-400 border-2 border-dashed border-slate-200 rounded-xl">
                                <i className="fa-solid fa-file-excel text-4xl mb-3 opacity-30"></i>
                                <p>No subjects matching these filters.</p>
                            </div>
                        )}
                    </div>
                </div>
            )}


            {/* Subject Form Modal - Mobile Optimized */}
            {showSubjectForm && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-2 sm:p-4 z-[60] overflow-hidden">
                    <div className="bg-white w-full max-w-lg rounded-3xl flex flex-col max-h-[95vh] shadow-2xl animate-in zoom-in-95 duration-200">
                        {/* Modal Header */}
                        <div className="p-4 sm:p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                            <div>
                                <h3 className="text-xl sm:text-2xl font-black text-slate-800">{editingSubject ? 'Edit Subject' : 'Add New Subject'}</h3>
                                <p className="text-slate-500 text-[10px] sm:text-xs font-bold uppercase tracking-widest mt-1">Academic Configuration</p>
                            </div>
                            <button onClick={() => setShowSubjectForm(false)} className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-slate-200 transition-colors text-slate-400">
                                <i className="fa-solid fa-times text-lg"></i>
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="p-4 sm:p-8 overflow-y-auto flex-1 bg-white custom-scrollbar">
                            <form onSubmit={handleSaveSubject} className="space-y-6">
                                {/* Subject Name Selection */}
                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Subject Name</label>
                                    <div className="relative group">
                                        <select
                                            value={isCreatingNewSubject ? '___CREATE_NEW___' : subjectForm.name}
                                            onChange={(e) => {
                                                if (e.target.value === '___CREATE_NEW___') {
                                                    setIsCreatingNewSubject(true);
                                                    setSubjectForm(prev => ({ ...prev, name: '' }));
                                                } else {
                                                    setIsCreatingNewSubject(false);
                                                    setSubjectForm(prev => ({ ...prev, name: e.target.value }));
                                                }
                                            }}
                                            className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-slate-900 font-bold focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all outline-none appearance-none cursor-pointer"
                                            required={!isCreatingNewSubject}
                                        >
                                            <option value="">-- Select Subject --</option>
                                            {allSubjectSuggestions.map(name => (
                                                <option key={name} value={name}>{name}</option>
                                            ))}
                                            <option value="___CREATE_NEW___">➕ Create New Subject</option>
                                        </select>
                                        <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 group-hover:text-emerald-500 transition-colors">
                                            <i className="fa-solid fa-chevron-down"></i>
                                        </div>
                                    </div>

                                    {isCreatingNewSubject && (
                                        <div className="mt-3 animate-in slide-in-from-top-2 duration-200">
                                            <input
                                                type="text"
                                                value={subjectForm.name}
                                                onChange={e => setSubjectForm(prev => ({ ...prev, name: e.target.value }))}
                                                className="w-full p-4 bg-emerald-50 border-2 border-emerald-100 rounded-2xl text-emerald-900 font-bold focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all outline-none shadow-inner"
                                                placeholder="Enter new subject name"
                                                required
                                                autoFocus
                                            />
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setIsCreatingNewSubject(false);
                                                    setSubjectForm(prev => ({ ...prev, name: '' }));
                                                }}
                                                className="mt-2 text-[10px] text-slate-400 hover:text-emerald-600 font-black uppercase tracking-widest flex items-center gap-1.5 transition-colors px-2"
                                            >
                                                <i className="fa-solid fa-arrow-left"></i>
                                                Back to list
                                            </button>
                                        </div>
                                    )}
                                </div>

                                {/* Faculty Selection */}
                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Faculty Name</label>
                                    <div className="relative group">
                                        <select
                                            value={isCreatingNewFaculty ? '___CREATE_NEW___' : subjectForm.facultyName}
                                            onChange={(e) => {
                                                if (e.target.value === '___CREATE_NEW___') {
                                                    setIsCreatingNewFaculty(true);
                                                    setSubjectForm(prev => ({ ...prev, facultyName: '' }));
                                                } else {
                                                    setIsCreatingNewFaculty(false);
                                                    setSubjectForm(prev => ({ ...prev, facultyName: e.target.value }));
                                                }
                                            }}
                                            className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-slate-900 font-bold focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all outline-none appearance-none cursor-pointer"
                                        >
                                            <option value="">-- Select Faculty --</option>
                                            {normalizedFaculties.map(faculty => (
                                                <option key={faculty} value={faculty}>{faculty}</option>
                                            ))}
                                            <option value="___CREATE_NEW___">➕ Create New Faculty</option>
                                        </select>
                                        <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 group-hover:text-emerald-500 transition-colors">
                                            <i className="fa-solid fa-chevron-down"></i>
                                        </div>
                                    </div>

                                    {isCreatingNewFaculty && (
                                        <div className="mt-3 animate-in slide-in-from-top-2 duration-200">
                                            <input
                                                type="text"
                                                value={subjectForm.facultyName}
                                                onChange={e => setSubjectForm(prev => ({ ...prev, facultyName: e.target.value }))}
                                                className="w-full p-4 bg-emerald-50 border-2 border-emerald-100 rounded-2xl text-emerald-900 font-bold focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all outline-none shadow-inner"
                                                placeholder="Enter new faculty name"
                                                autoFocus
                                            />
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setIsCreatingNewFaculty(false);
                                                    setSubjectForm(prev => ({ ...prev, facultyName: '' }));
                                                }}
                                                className="mt-2 text-[10px] text-slate-400 hover:text-emerald-600 font-black uppercase tracking-widest flex items-center gap-1.5 transition-colors px-2"
                                            >
                                                <i className="fa-solid fa-arrow-left"></i>
                                                Back to list
                                            </button>
                                        </div>
                                    )}
                                </div>

                                {/* Marks Configuration */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Max External</label>
                                        <select
                                            value={subjectForm.maxEXT}
                                            onChange={e => {
                                                const newMaxEXT = parseInt(e.target.value);
                                                setSubjectForm(prev => ({
                                                    ...prev,
                                                    maxEXT: newMaxEXT,
                                                    maxINT: newMaxEXT === 100 ? 0 : (prev.maxINT === 0 ? 30 : prev.maxINT)
                                                }));
                                            }}
                                            className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-slate-900 font-bold focus:border-emerald-500 transition-all outline-none"
                                        >
                                            <option value={100}>100 (No INT)</option>
                                            <option value={70}>70 (Standard)</option>
                                            <option value={50}>50 (Half)</option>
                                            <option value={35}>35 (Minor)</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Max Internal</label>
                                        <select
                                            value={subjectForm.maxINT}
                                            onChange={e => setSubjectForm(prev => ({ ...prev, maxINT: parseInt(e.target.value) }))}
                                            className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-slate-900 font-bold focus:border-emerald-500 transition-all outline-none disabled:opacity-50 disabled:bg-slate-100"
                                            disabled={subjectForm.maxEXT === 100}
                                        >
                                            {subjectForm.maxEXT === 100 ? (
                                                <option value={0}>N/A</option>
                                            ) : (
                                                <>
                                                    <option value={50}>50</option>
                                                    <option value={30}>30</option>
                                                </>
                                            )}
                                        </select>
                                    </div>
                                </div>

                                {/* Type and Semester */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Subject Type</label>
                                        <select 
                                            value={subjectForm.subjectType} 
                                            onChange={e => setSubjectForm(prev => ({ ...prev, subjectType: e.target.value as any }))} 
                                            className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-slate-900 font-bold focus:border-emerald-500 transition-all outline-none"
                                        >
                                            <option value="general">General</option>
                                            <option value="elective">Elective</option>
                                            <option value="school_subject">School Subject</option>
                                        </select>
                                    </div>

                                    {subjectForm.subjectType === 'elective' && (
                                        <div>
                                            <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Elective Type</label>
                                            <div className="flex gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => setSubjectForm(prev => ({ ...prev, electiveType: 'intra-class' }))}
                                                    className={`flex-1 p-3 rounded-xl border-2 font-bold transition-all text-xs ${
                                                        subjectForm.electiveType === 'intra-class'
                                                        ? 'bg-emerald-50 border-emerald-500 text-emerald-700'
                                                        : 'bg-white border-slate-100 text-slate-400 hover:border-slate-200'
                                                    }`}
                                                >
                                                    <i className="fa-solid fa-users-rectangle mb-1 block"></i>
                                                    Intra-class
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setSubjectForm(prev => ({ ...prev, electiveType: 'cross-class' }))}
                                                    className={`flex-1 p-3 rounded-xl border-2 font-bold transition-all text-xs ${
                                                        subjectForm.electiveType === 'cross-class'
                                                        ? 'bg-purple-50 border-purple-500 text-purple-700'
                                                        : 'bg-white border-slate-100 text-slate-400 hover:border-slate-200'
                                                    }`}
                                                >
                                                    <i className="fa-solid fa-users-line mb-1 block"></i>
                                                    Cross-class
                                                </button>
                                            </div>
                                            <p className="text-[10px] text-slate-400 mt-2 ml-1 font-medium italic">
                                                {subjectForm.electiveType === 'intra-class' 
                                                    ? 'Separate grades for each class (prevents student mixing).'
                                                    : 'Multiple classes attend together (common grade list).'}
                                            </p>
                                        </div>
                                    )}
                                    <div>
                                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Semester Availability</label>
                                        <select 
                                            value={subjectForm.activeSemester} 
                                            onChange={e => setSubjectForm(prev => ({ ...prev, activeSemester: e.target.value as any }))} 
                                            className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-slate-900 font-bold focus:border-emerald-500 transition-all outline-none"
                                        >
                                            <option value="Both">Both</option>
                                            <option value="Odd">Odd Only</option>
                                            <option value="Even">Even Only</option>
                                        </select>
                                    </div>
                                </div>

                                {/* Target Classes */}
                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">
                                        Target Classes 
                                        {subjectForm.subjectType === 'elective' && <span className="ml-2 lowercase font-normal opacity-60">(Pick Students)</span>}
                                    </label>
                                    <div className="flex flex-wrap gap-2">
                                        {(availableClasses.length > 0 ? availableClasses : ['S1', 'S2', 'S3', 'P1', 'P2', 'D1', 'D2', 'D3', 'PG1', 'PG2']).map(cls => {
                                            if (subjectForm.subjectType === 'elective') {
                                                const enrolledCount = students.filter(s => (s.className === cls || s.currentClass === cls) && subjectForm.enrolledStudents.includes(s.id)).length;
                                                const isTarget = subjectForm.targetClasses.includes(cls) || enrolledCount > 0;

                                                return (
                                                    <button
                                                        key={cls}
                                                        type="button"
                                                        onClick={() => handleOpenClassSelection(cls)}
                                                        className={`flex items-center gap-2 px-4 py-2 border-2 rounded-2xl font-bold text-xs transition-all ${isTarget
                                                            ? 'bg-purple-50 border-purple-200 text-purple-700 shadow-sm ring-4 ring-purple-500/5'
                                                            : 'bg-white border-slate-100 text-slate-400 hover:border-slate-200'
                                                            }`}
                                                    >
                                                        {cls}
                                                        {enrolledCount > 0 && <span className="bg-purple-600 text-white text-[9px] px-1.5 py-0.5 rounded-full shadow-sm">{enrolledCount}</span>}
                                                        <i className="fa-solid fa-chevron-right text-[8px] opacity-40"></i>
                                                    </button>
                                                );
                                            } else {
                                                const isSelected = subjectForm.targetClasses.includes(cls);
                                                return (
                                                    <label key={cls} className={`flex items-center gap-2 px-4 py-2 border-2 rounded-2xl cursor-pointer transition-all ${isSelected
                                                        ? 'bg-emerald-50 border-emerald-200 text-emerald-700 shadow-sm ring-4 ring-emerald-500/5'
                                                        : 'bg-white border-slate-100 text-slate-400 hover:border-slate-200'
                                                        }`}>
                                                        <input
                                                            type="checkbox"
                                                            checked={isSelected}
                                                            onChange={(e) => handleClassChange(cls, e.target.checked)}
                                                            className="hidden"
                                                        />
                                                        <span className="text-xs font-bold">{cls}</span>
                                                        {isSelected && <i className="fa-solid fa-check text-[10px]"></i>}
                                                    </label>
                                                );
                                            }
                                        })}
                                    </div>
                                </div>

                                {/* Modal Actions */}
                                <div className="flex gap-4 pt-4 sm:pt-6 sticky bottom-0 bg-white border-t border-slate-50 mt-4">
                                    <button 
                                        type="button" 
                                        onClick={() => setShowSubjectForm(false)} 
                                        className="flex-1 py-4 bg-slate-50 text-slate-500 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-slate-100 transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button 
                                        type="submit" 
                                        disabled={isOperating}
                                        className="flex-[2] py-4 bg-emerald-600 text-white rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-emerald-700 shadow-lg shadow-emerald-500/20 transition-all active:scale-[0.98] disabled:opacity-50"
                                    >
                                        {isOperating ? 'Saving...' : (editingSubject ? 'Update Subject' : 'Create Subject')}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            {/* Subject Details Modal */}
            {showSubjectDetailsModal && selectedSubjectForDetails && (
                <SubjectDetailsModal
                    subject={selectedSubjectForDetails}
                    onClose={() => setShowSubjectDetailsModal(false)}
                    onSave={handleSaveSubjectDetails}
                />
            )}

            {/* Enrollment Modal - Mobile Optimized */}
            {showEnrollmentModal && selectedSubjectForEnrollment && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-2 sm:p-4 z-[70] overflow-hidden">
                    <div className="bg-white rounded-3xl w-full max-w-2xl flex flex-col h-full max-h-[90vh] sm:max-h-[85vh] shadow-2xl animate-in zoom-in-95 duration-200">
                        {/* Header */}
                        <div className="p-4 sm:p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                            <div>
                                <h3 className="text-xl font-black text-slate-800">Manage Enrollment</h3>
                                <p className="text-emerald-600 text-[10px] sm:text-xs font-bold uppercase tracking-widest mt-1">{selectedSubjectForEnrollment.name}</p>
                            </div>
                            <button 
                                onClick={() => setShowEnrollmentModal(false)}
                                className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-slate-200 transition-colors text-slate-400"
                            >
                                <i className="fa-solid fa-times text-lg"></i>
                            </button>
                        </div>

                        {/* Filters */}
                        <div className="p-4 border-b border-slate-50 flex flex-col sm:flex-row gap-3">
                            <div className="flex-1">
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Filter by Class</label>
                                <select
                                    value={enrollmentClassFilter}
                                    onChange={(e) => setEnrollmentClassFilter(e.target.value)}
                                    className="w-full p-3 bg-slate-50 border-2 border-slate-100 rounded-xl text-slate-900 font-bold focus:border-emerald-500 outline-none transition-all"
                                >
                                    <option value="All">All Classes</option>
                                    {availableClasses.map(cls => (
                                        <option key={cls} value={cls}>{cls}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {/* Student List Content */}
                        <div className="flex-1 overflow-x-auto custom-scrollbar">
                            {(() => {
                                const displayedStudents = students.filter(s => 
                                    enrollmentClassFilter === 'All' || 
                                    s.className === enrollmentClassFilter || 
                                    s.currentClass === enrollmentClassFilter
                                );

                                return displayedStudents.length > 0 ? (
                                    <div className="min-w-full">
                                        <table className="w-full">
                                            <thead className="bg-slate-50/80 sticky top-0 z-10 backdrop-blur-sm">
                                                <tr className="text-left border-b border-slate-100">
                                                    <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Student</th>
                                                    <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest hidden sm:table-cell">Class</th>
                                                    <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Status</th>
                                                    <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Action</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-50">
                                                {displayedStudents.map(student => {
                                                    const isEnrolled = (selectedSubjectForEnrollment.enrolledStudents || []).includes(student.id);
                                                    return (
                                                        <tr key={student.id} className="hover:bg-slate-50/50 transition-colors">
                                                            <td className="p-4">
                                                                <div className="flex items-center gap-3">
                                                                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-[10px] ${isEnrolled ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-400'}`}>
                                                                        {student.name.charAt(0)}
                                                                    </div>
                                                                    <div>
                                                                        <p className="font-bold text-sm text-slate-900 leading-tight">{student.name}</p>
                                                                        <p className="text-[10px] text-slate-400 sm:hidden">{student.className} • {student.adNo}</p>
                                                                        <p className="text-[10px] text-slate-400 hidden sm:block">Adm: {student.adNo}</p>
                                                                    </div>
                                                                </div>
                                                            </td>
                                                            <td className="p-4 text-sm font-bold text-slate-600 hidden sm:table-cell">{student.className}</td>
                                                            <td className="p-4 text-center">
                                                                <span className={`inline-flex px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-tighter ${isEnrolled ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-400'}`}>
                                                                    {isEnrolled ? 'Enrolled' : 'Available'}
                                                                </span>
                                                            </td>
                                                            <td className="p-4 text-right">
                                                                <button
                                                                    onClick={() => handleToggleStudentEnrollment(student.id, isEnrolled)}
                                                                    className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${isEnrolled
                                                                        ? 'bg-red-50 text-red-600 hover:bg-red-100'
                                                                        : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'
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
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center justify-center h-64 text-slate-400">
                                        <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                                            <i className="fa-solid fa-graduation-cap text-2xl opacity-20"></i>
                                        </div>
                                        <p className="font-bold text-sm">No students found</p>
                                    </div>
                                );
                            })()}
                        </div>

                        {/* Footer */}
                        <div className="p-4 sm:p-6 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between">
                            <div className="text-left">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Currently Enrolled</p>
                                <p className="text-xl font-black text-emerald-600">{(selectedSubjectForEnrollment.enrolledStudents || []).length}</p>
                            </div>
                            <button
                                onClick={() => setShowEnrollmentModal(false)}
                                className="px-10 py-3 bg-slate-900 text-white rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-slate-800 shadow-xl"
                            >
                                Finish
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Class Student Selection Modal (For Electives Creation) - Mobile Optimized */}
            {showClassSelectionModal && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-2 sm:p-4 z-[70] overflow-hidden">
                    <div className="bg-white rounded-3xl w-full max-w-lg flex flex-col h-full max-h-[90vh] sm:max-h-[80vh] shadow-2xl animate-in zoom-in-95 duration-200">
                        {/* Modal Header */}
                        <div className="p-4 sm:p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                            <div>
                                <h3 className="text-xl font-black text-slate-800">Select Students</h3>
                                <p className="text-slate-500 text-[10px] sm:text-xs font-bold uppercase tracking-widest mt-1">Class: {activeClassForSelection}</p>
                            </div>
                            <button 
                                onClick={() => setShowClassSelectionModal(false)}
                                className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-slate-200 transition-colors text-slate-400"
                            >
                                <i className="fa-solid fa-times text-lg"></i>
                            </button>
                        </div>
                        
                        {/* Search students */}
                        <div className="p-4 border-b border-slate-50">
                            <div className="relative group">
                                <i className="fa-solid fa-search absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-emerald-500 transition-colors"></i>
                                <input
                                    type="text"
                                    placeholder="Search by name or admission number..."
                                    value={studentSearchQuery}
                                    onChange={(e) => setStudentSearchQuery(e.target.value)}
                                    className="w-full p-4 pl-12 bg-slate-50 border-2 border-slate-100 rounded-2xl text-slate-900 font-bold focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all outline-none"
                                />
                            </div>
                        </div>

                        {/* Student List */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
                            {(() => {
                                // Robust matching: check both normalized className and raw currentClass
                                const classStudents = students.filter(s => 
                                    s.className === activeClassForSelection || 
                                    s.currentClass === activeClassForSelection
                                );
                                const filteredClassStudents = studentSearchQuery
                                    ? classStudents.filter(s => 
                                        s.name.toLowerCase().includes(studentSearchQuery.toLowerCase()) || 
                                        s.adNo.toLowerCase().includes(studentSearchQuery.toLowerCase())
                                      )
                                    : classStudents;

                                return filteredClassStudents.length > 0 ? (
                                    <div className="grid grid-cols-1 gap-2">
                                        {filteredClassStudents.map(student => {
                                            const isSelected = subjectForm.enrolledStudents.includes(student.id);
                                            return (
                                                <button
                                                    key={student.id}
                                                    type="button"
                                                    onClick={() => handleToggleStudentSelection(student.id)}
                                                    className={`flex items-center justify-between p-4 rounded-2xl cursor-pointer border-2 transition-all group ${isSelected
                                                        ? 'bg-purple-50 border-purple-200 shadow-sm'
                                                        : 'hover:bg-slate-50 border-slate-100 bg-white'
                                                        }`}
                                                >
                                                    <div className="flex items-center gap-4 text-left">
                                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-black text-xs ${isSelected ? 'bg-purple-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                                                            {student.name.charAt(0)}
                                                        </div>
                                                        <div>
                                                            <p className={`font-black text-sm ${isSelected ? 'text-purple-900' : 'text-slate-900'}`}>{student.name}</p>
                                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Adm: {student.adNo}</p>
                                                        </div>
                                                    </div>
                                                    <div className={`w-6 h-6 rounded-lg flex items-center justify-center border-2 transition-all ${isSelected
                                                        ? 'bg-purple-600 border-purple-600 text-white shadow-lg shadow-purple-500/20'
                                                        : 'border-slate-200 bg-white group-hover:border-purple-300'
                                                        }`}>
                                                        {isSelected && <i className="fa-solid fa-check text-[10px]"></i>}
                                                    </div>
                                                </button>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center justify-center h-full py-12 text-slate-400">
                                        <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                                            <i className="fa-solid fa-user-slash text-3xl opacity-20"></i>
                                        </div>
                                        <p className="font-bold text-sm tracking-tight text-center">No students found in {activeClassForSelection}</p>
                                        <p className="text-[10px] font-bold uppercase tracking-widest mt-1">Try a different search or class</p>
                                    </div>
                                );
                            })()}
                        </div>

                        {/* Footer */}
                        <div className="p-4 sm:p-6 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between">
                            <div className="text-left">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Selected</p>
                                <p className="text-xl font-black text-purple-600">
                                    {(subjectForm.enrolledStudents || []).filter(id => {
                                        const s = students.find(st => st.id === id);
                                        return s && (s.className === activeClassForSelection || s.currentClass === activeClassForSelection);
                                    }).length}
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setShowClassSelectionModal(false)}
                                className="px-8 py-3 bg-slate-900 text-white rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-slate-800 shadow-xl transition-all active:scale-[0.98]"
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
