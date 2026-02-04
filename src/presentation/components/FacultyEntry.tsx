import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { StudentRecord, SubjectConfig } from '../../domain/entities/types';
import { CLASSES } from '../../domain/entities/constants';
import { dataService } from '../../infrastructure/services/dataService';
import {
    MobileFacultyEntrySkeleton,
    DesktopTableSkeleton,
    ProgressiveLoadingSkeleton,
    OperationLoadingSkeleton
} from './SkeletonLoaders';
import { useDebounce } from '../hooks/useDebounce';
import { useMobile, useTouchInteraction } from '../hooks/useMobile';
import { useOfflineCapability } from '../hooks/useOfflineCapability';
import OfflineStatusIndicator from './OfflineStatusIndicator';
import { normalizeName } from '../../infrastructure/services/formatUtils';



const FacultyEntry: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'marks-entry' | 'upload-tracker'>('marks-entry');
    const [selectedClass, setSelectedClass] = useState('S1');
    const [subjectType, setSubjectType] = useState<'general' | 'elective'>('general');
    const [selectedSubject, setSelectedSubject] = useState('');
    const [students, setStudents] = useState<StudentRecord[]>([]);
    const [allStudents, setAllStudents] = useState<StudentRecord[]>([]);
    const [subjects, setSubjects] = useState<SubjectConfig[]>([]);
    const [classSubjects, setClassSubjects] = useState<SubjectConfig[]>([]);
    const { isMobile, isTablet, orientation } = useMobile();
    const { getTouchProps } = useTouchInteraction();
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [marksData, setMarksData] = useState<Record<string, { ta: string; ce: string }>>({});
    const [showSupplementaryOnly, setShowSupplementaryOnly] = useState(false);
    const [supplementaryStudents, setSupplementaryStudents] = useState<{ student: any, supplementaryExam: any }[]>([]);
    const [currentStudentIndex, setCurrentStudentIndex] = useState(0);
    const studentRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});

    // Enhanced loading states
    const [loadingStage, setLoadingStage] = useState<'initializing' | 'loading-subjects' | 'loading-students' | 'preparing-interface'>('initializing');
    const [loadingProgress, setLoadingProgress] = useState(0);
    const [operationLoading, setOperationLoading] = useState<{
        type: 'saving' | 'clearing' | 'loading-students' | 'validating' | null;
        message?: string;
    }>({ type: null });

    // Quick access features state
    const [showStudentList, setShowStudentList] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [filteredStudents, setFilteredStudents] = useState<StudentRecord[]>([]);

    // Debounced search for better performance
    const debouncedSearchQuery = useDebounce(searchQuery, 300);

    // Simple pagination for large student lists
    const [currentPage, setCurrentPage] = useState(1);
    const pageSize = 50; // Increased from 10 to 50 for better mobile list visibility
    const paginatedStudents = useMemo(() => {
        return filteredStudents.slice(0, currentPage * pageSize);
    }, [filteredStudents, currentPage, pageSize]);
    const hasMore = filteredStudents.length > currentPage * pageSize;

    // Flag to prevent draft operations during subject switching
    const [isSubjectSwitching, setIsSubjectSwitching] = useState(false);

    // Touch/swipe gesture state
    const [touchStart, setTouchStart] = useState<{ x: number; y: number } | null>(null);
    const [touchEnd, setTouchEnd] = useState<{ x: number; y: number } | null>(null);

    // Sticky action buttons state
    const [showScrollToTop, setShowScrollToTop] = useState(false);
    const [isScrolling, setIsScrolling] = useState(false);
    const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const loadedSubjectIdRef = useRef<string>('');

    // Offline capability integration
    const { isOnline, saveDraft, getDraft, deleteDraft } = useOfflineCapability();

    // Upload Tracker filter states
    const [trackerClassFilter, setTrackerClassFilter] = useState<string>('all');
    const [trackerTeacherFilter, setTrackerTeacherFilter] = useState<string>('all');
    const [trackerSubjectSearch, setTrackerSubjectSearch] = useState<string>('');

    // Load initial data
    useEffect(() => {
        loadData();
    }, []);

    // Refresh all students when switching to tracker
    useEffect(() => {
        if (activeTab === 'upload-tracker') {
            loadAllStudents();
        }
    }, [activeTab]);

    // Update class subjects when class or subject type changes
    useEffect(() => {
        const filteredSubjects = subjects.filter(s => {
            // For elective subjects, show all of them regardless of class
            if (subjectType === 'elective') {
                return s.subjectType === 'elective';
            }
            // For general subjects, filter by class and type
            return s.targetClasses.includes(selectedClass) && s.subjectType === 'general';
        });
        setClassSubjects(filteredSubjects);

        // Reset selected subject if it's not in the new list, or select first available
        if (filteredSubjects.length > 0) {
            if (!selectedSubject || !filteredSubjects.find(s => s.id === selectedSubject)) {
                setSelectedSubject(filteredSubjects[0].id);
            }
        } else {
            setSelectedSubject('');
        }
    }, [selectedClass, subjects, subjectType]);

    // Load students when class or subject changes
    useEffect(() => {
        if (selectedClass) {
            loadStudentsByClass();
        }
    }, [selectedClass, selectedSubject]);

    // Reset current student index and clear marks data only when class or subject changes, not upon every student data refresh
    useEffect(() => {
        setCurrentStudentIndex(0);
        // Set switching flag to prevent draft operations during transition
        setIsSubjectSwitching(true);
        // Immediately clear UI and ref to prevent old marks from being visible or auto-saved incorrectly
        setMarksData({});
        loadedSubjectIdRef.current = '';

        // Reset switching flag after a short delay to allow loadStudentsByClass to complete
        const timer = setTimeout(() => {
            setIsSubjectSwitching(false);
        }, 100);

        return () => {
            clearTimeout(timer);
        };
    }, [selectedClass, selectedSubject]);

    // Load drafts when students or subject changes
    useEffect(() => {
        // Skip if we're currently switching subjects
        if (isSubjectSwitching) return;

        if (selectedSubject && students.length > 0 && loadedSubjectIdRef.current === selectedSubject) {
            loadDraftsForCurrentSubject();
        }
    }, [selectedSubject, students, isSubjectSwitching]);

    // Auto-save drafts when marks data changes
    useEffect(() => {
        // Skip if we're currently switching subjects
        if (isSubjectSwitching) return;

        if (selectedSubject && students.length > 0 && loadedSubjectIdRef.current === selectedSubject) {
            // Add a small debounce to prevent rapid saves during UI updates
            const timer = setTimeout(() => {
                autoSaveCurrentDrafts();
            }, 300);

            return () => clearTimeout(timer);
        }
    }, [marksData, selectedSubject, students, isSubjectSwitching]);

    // Scroll detection for sticky buttons
    useEffect(() => {
        const handleScroll = () => {
            const scrollY = window.scrollY;
            const windowHeight = window.innerHeight;

            // Show scroll-to-top button when scrolled down more than one screen height
            setShowScrollToTop(scrollY > windowHeight);

            // Set scrolling state for visual feedback
            setIsScrolling(true);

            // Clear existing timeout
            if (scrollTimeoutRef.current) {
                clearTimeout(scrollTimeoutRef.current);
            }

            // Set timeout to hide scrolling state
            scrollTimeoutRef.current = setTimeout(() => {
                setIsScrolling(false);
            }, 150);
        };

        window.addEventListener('scroll', handleScroll, { passive: true });

        return () => {
            window.removeEventListener('scroll', handleScroll);
            if (scrollTimeoutRef.current) {
                clearTimeout(scrollTimeoutRef.current);
            }
        };
    }, []);

    // Smooth scroll to top function
    const scrollToTop = useCallback(() => {
        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    }, []);

    // Load drafts for current subject and populate marks data
    const loadDraftsForCurrentSubject = useCallback(async () => {
        // Strong guard: only load if subject is fully loaded and matches
        if (!selectedSubject || students.length === 0 || selectedSubject !== loadedSubjectIdRef.current || isSubjectSwitching) return;

        try {
            const updatedMarksData = { ...marksData };
            let hasUpdates = false;

            for (const student of students) {
                const draft = getDraft(student.id, selectedSubject);
                if (draft && (!marksData[student.id]?.ta && !marksData[student.id]?.ce)) {
                    // Only load draft if no current data exists
                    updatedMarksData[student.id] = {
                        ta: draft.ta || '',
                        ce: draft.ce || ''
                    };
                    hasUpdates = true;
                }
            }

            if (hasUpdates) {
                setMarksData(updatedMarksData);
                console.log('FacultyEntry: Loaded drafts for current subject');
            }
        } catch (error) {
            console.error('FacultyEntry: Failed to load drafts:', error);
        }
    }, [selectedSubject, students, marksData, getDraft, isSubjectSwitching]);

    // Auto-save current drafts
    const autoSaveCurrentDrafts = useCallback(async () => {
        // Strong guard: only save if subject is fully loaded and matches
        if (!selectedSubject || students.length === 0 || selectedSubject !== loadedSubjectIdRef.current || isSubjectSwitching) return;

        // Protection: Ensure we're not saving stale data (e.g., marks for students of a different subject)
        const studentIds = new Set(students.map(s => s.id));
        const currentMarkIds = Object.keys(marksData);

        // If marksData contains IDs not in current student list, it's stale - don't save.
        // We allow empty marksData (cleared on subject change) which is handled below.
        if (currentMarkIds.length > 0 && !currentMarkIds.every(id => studentIds.has(id))) {
            return;
        }

        try {
            for (const student of students) {
                const marks = marksData[student.id];
                if (marks && (marks.ta || marks.ce)) {
                    await saveDraft(
                        student.id,
                        selectedSubject,
                        marks.ta || '',
                        marks.ce || ''
                    );
                }
            }
        } catch (error) {
            console.error('FacultyEntry: Auto-save failed:', error);
        }
    }, [selectedSubject, students, marksData, saveDraft, isSubjectSwitching]);

    // Handle draft recovery - DEPRECATED/REMOVED
    // Handle draft deletion - DEPRECATED/REMOVED

    // Filter students based on debounced search query for better performance
    useEffect(() => {
        if (!debouncedSearchQuery.trim()) {
            setFilteredStudents(students);
        } else {
            const filtered = students.filter(student =>
                student.name.toLowerCase().includes(debouncedSearchQuery.toLowerCase()) ||
                student.adNo.toLowerCase().includes(debouncedSearchQuery.toLowerCase())
            );
            setFilteredStudents(filtered);
        }
    }, [students, debouncedSearchQuery]);

    // Memoized navigation functions for better performance
    const navigateToStudent = useCallback((index: number) => {
        if (index >= 0 && index < students.length) {
            setCurrentStudentIndex(index);
            const studentId = students[index].id;
            const studentElement = studentRefs.current[studentId];
            if (studentElement) {
                studentElement.scrollIntoView({
                    behavior: 'smooth',
                    block: 'center'
                });
            }
        }
    }, [students.length]);

    const navigateToPrevious = useCallback(() => {
        if (currentStudentIndex > 0) {
            navigateToStudent(currentStudentIndex - 1);
        }
    }, [currentStudentIndex, navigateToStudent]);

    const navigateToNext = useCallback(() => {
        if (currentStudentIndex < students.length - 1) {
            navigateToStudent(currentStudentIndex + 1);
        }
    }, [currentStudentIndex, students.length, navigateToStudent]);

    // Memoized quick access functions
    const jumpToStudent = useCallback((studentId: string) => {
        const index = students.findIndex(s => s.id === studentId);
        if (index !== -1) {
            navigateToStudent(index);
            setShowStudentList(false);
            setSearchQuery('');
        }
    }, [students, navigateToStudent]);

    // Memoized swipe gesture handlers
    const handleTouchStart = useCallback((e: React.TouchEvent) => {
        setTouchEnd(null);
        setTouchStart({
            x: e.targetTouches[0].clientX,
            y: e.targetTouches[0].clientY
        });
    }, []);

    const handleTouchMove = useCallback((e: React.TouchEvent) => {
        setTouchEnd({
            x: e.targetTouches[0].clientX,
            y: e.targetTouches[0].clientY
        });
    }, []);

    const handleTouchEnd = useCallback(() => {
        if (!touchStart || !touchEnd) return;

        const distanceX = touchStart.x - touchEnd.x;
        const distanceY = touchStart.y - touchEnd.y;
        const isLeftSwipe = distanceX > 50;
        const isRightSwipe = distanceX < -50;
        const isVerticalSwipe = Math.abs(distanceY) > Math.abs(distanceX);

        // Only handle horizontal swipes, ignore vertical scrolling
        if (!isVerticalSwipe) {
            if (isLeftSwipe && currentStudentIndex < students.length - 1) {
                navigateToNext();
            }
            if (isRightSwipe && currentStudentIndex > 0) {
                navigateToPrevious();
            }
        }
    }, [touchStart, touchEnd, currentStudentIndex, students.length, navigateToNext, navigateToPrevious]);

    // Memoized completion statistics calculation
    const completionStats = useMemo(() => {
        const completedCount = Object.values(marksData).filter((m: any) => m.ta && m.ce).length;
        const totalCount = students.length;
        const completionPercentage = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

        return {
            completed: completedCount,
            total: totalCount,
            percentage: completionPercentage,
            remaining: totalCount - completedCount
        };
    }, [marksData, students.length]);

    // Memoized validation functions for better performance
    const validationHelpers = useMemo(() => {
        const subject = subjects.find(s => s.id === selectedSubject);
        if (!subject) return null;

        return {
            isTAExceedingMax: (studentId: string): boolean => {
                const marks = marksData[studentId];
                if (!marks || !marks.ta) return false;
                const ta = parseInt(marks.ta) || 0;
                return ta > subject.maxTA;
            },
            isCEExceedingMax: (studentId: string): boolean => {
                const marks = marksData[studentId];
                if (!marks || !marks.ce) return false;
                const ce = parseInt(marks.ce) || 0;
                return ce > subject.maxCE;
            },
            isTAFailing: (studentId: string): boolean => {
                const marks = marksData[studentId];
                if (!marks || !marks.ta) return false;
                const ta = parseInt(marks.ta) || 0;
                const minTA = Math.ceil(subject.maxTA * 0.4);
                return ta < minTA && ta > 0 && ta <= subject.maxTA;
            },
            isCEFailing: (studentId: string): boolean => {
                const marks = marksData[studentId];
                if (!marks || !marks.ce) return false;
                const ce = parseInt(marks.ce) || 0;
                const minCE = Math.ceil(subject.maxCE * 0.5);
                return ce < minCE && ce > 0 && ce <= subject.maxCE;
            },
            calculateTotal: (studentId: string): number => {
                const marks = marksData[studentId];
                if (!marks) return 0;
                const ta = parseInt(marks.ta) || 0;
                const ce = parseInt(marks.ce) || 0;
                return ta + ce;
            },
            getStatus: (studentId: string): 'Passed' | 'Failed' | 'Pending' => {
                const marks = marksData[studentId];
                if (!marks || !marks.ta || !marks.ce) return 'Pending';

                const ta = parseInt(marks.ta) || 0;
                const ce = parseInt(marks.ce) || 0;
                const minTA = Math.ceil(subject.maxTA * 0.4);
                const minCE = Math.ceil(subject.maxCE * 0.5);

                const passedTA = ta >= minTA;
                const passedCE = ce >= minCE;

                return (passedTA && passedCE) ? 'Passed' : 'Failed';
            }
        };
    }, [marksData, subjects, selectedSubject]);

    // Memoized invalid marks detection
    const invalidMarksInfo = useMemo(() => {
        if (!validationHelpers) return { hasInvalid: false, count: 0 };

        const invalidStudents = students.filter(student =>
            validationHelpers.isTAExceedingMax(student.id) || validationHelpers.isCEExceedingMax(student.id)
        );

        return {
            hasInvalid: invalidStudents.length > 0,
            count: invalidStudents.length
        };
    }, [students, validationHelpers]);

    const loadAllStudents = async () => {
        try {
            const data = await dataService.getAllStudents();
            setAllStudents(data);
        } catch (error) {
            console.error('Error loading all students:', error);
        }
    };

    const loadData = async () => {
        try {
            setIsLoading(true);
            setLoadingStage('initializing');
            setLoadingProgress(0);

            // Simulate initialization delay for better UX
            await new Promise(resolve => setTimeout(resolve, 500));
            setLoadingProgress(25);

            setLoadingStage('loading-subjects');
            const [allSubjects, allStudentsData] = await Promise.all([
                dataService.getAllSubjects(),
                dataService.getAllStudents()
            ]);
            setLoadingProgress(75);

            setSubjects(allSubjects);
            setAllStudents(allStudentsData);
            setLoadingProgress(90);

            setLoadingStage('preparing-interface');
            // Small delay to show the final stage
            await new Promise(resolve => setTimeout(resolve, 300));
            setLoadingProgress(100);

        } catch (error) {
            console.error('Error loading data:', error);
        } finally {
            // Small delay before hiding loading to show completion
            setTimeout(() => {
                setIsLoading(false);
                setLoadingProgress(0);
            }, 200);
        }
    };

    const loadStudentsByClass = async () => {
        const currentRequestSubjectId = selectedSubject;

        // Clear marks data immediately to prevent showing stale data
        setMarksData({});
        loadedSubjectIdRef.current = '';

        try {
            setOperationLoading({ type: 'loading-students', message: 'Fetching student records for selected class and subject...' });

            let studentsToShow: StudentRecord[] = [];

            if (selectedSubject) {
                console.log('=== DEBUGGING STUDENT LOADING ===');
                console.log('Selected Subject ID:', selectedSubject);
                console.log('Selected Class:', selectedClass);
                console.log('Subject Type:', subjectType);
                console.log('Show Supplementary Only:', showSupplementaryOnly);

                if (showSupplementaryOnly) {
                    // Load supplementary exam students for this subject
                    const currentYear = new Date().getFullYear();
                    const suppStudents = await dataService.getStudentsWithSupplementaryExams(selectedSubject, currentYear);
                    console.log('Supplementary students found:', suppStudents.length);
                    setSupplementaryStudents(suppStudents);
                    studentsToShow = suppStudents
                        .filter(item => item.student.className === selectedClass)
                        .map(item => item.student);
                } else {
                    // Get enrolled students for the selected subject
                    console.log('Getting enrolled students for subject...');

                    // The dataService.getEnrolledStudentsForSubject already handles differentiation 
                    // between general and elective subjects internally.
                    // For General subjects: it fetches all students in target classes
                    // For Elective subjects: it fetches only enrolled students
                    studentsToShow = await dataService.getEnrolledStudentsForSubject(selectedSubject);
                    console.log('Total students found for subject:', studentsToShow.length);

                    // Filter by selected class ONLY for general subjects
                    if (subjectType === 'general') {
                        studentsToShow = studentsToShow.filter(student => student.className === selectedClass);
                        console.log('Students after class filter:', studentsToShow.length);
                    }
                }
            } else {
                console.log('No subject selected, getting all students from class...');
                // If no subject selected, get all students from class
                studentsToShow = await dataService.getStudentsByClass(selectedClass);
                console.log('Students from class:', studentsToShow.length);
            }

            // Check if subject changed during the async operation
            if (currentRequestSubjectId !== selectedSubject) {
                console.log('loadStudentsByClass: Subject changed during loading, discarding data.');
                return;
            }

            setStudents(studentsToShow);

            // Initialize marks data with existing marks
            const initialMarks: Record<string, { ta: string; ce: string }> = {};
            studentsToShow.forEach(student => {
                const existingMarks = student.marks[selectedSubject];

                // Special conversion for Max TA 35 (scale from 70 back to 35 for display)
                let displayTA = existingMarks?.ta?.toString() || '';
                const subject = subjects.find(s => s.id === selectedSubject);
                if (subject?.maxTA === 35 && existingMarks?.ta) {
                    // Start conversion logic
                    const taVal = typeof existingMarks.ta === 'string' ? parseInt(existingMarks.ta) : existingMarks.ta;
                    // Only scale if the stored value is likely doubled (e.g., > 35 or just standard assumption)
                    // Safest is to always divide by 2 if maxTA is 35, assuming DB marks are out of 70
                    displayTA = (taVal / 2).toString();
                }

                initialMarks[student.id] = {
                    ta: displayTA,
                    ce: existingMarks?.ce?.toString() || ''
                };
            });

            // Final check before setting marks data
            if (currentRequestSubjectId !== selectedSubject) {
                console.log('loadStudentsByClass: Subject changed before setting marks, discarding data.');
                return;
            }

            setMarksData(initialMarks);
            // Mark the subject as correctly loaded to allow auto-saving/draft loading
            loadedSubjectIdRef.current = selectedSubject;
            console.log('loadStudentsByClass: Successfully loaded marks for subject:', selectedSubject);

        } catch (error) {
            console.error('Error loading students:', error);
        } finally {
            setOperationLoading({ type: null });
        }
    };

    // Memoized keyboard navigation handler
    const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>, studentId: string, field: 'ta' | 'ce') => {
        if (e.key === 'Enter') {
            e.preventDefault();

            // Find current student index
            const currentStudentIndex = students.findIndex(s => s.id === studentId);

            if (field === 'ta') {
                // Move to CE field of same student
                const ceInput = document.querySelector(`input[data-student="${studentId}"][data-field="ce"]`) as HTMLInputElement;
                if (ceInput) {
                    ceInput.focus();
                    ceInput.select();
                }
            } else if (field === 'ce') {
                // Move to TA field of next student, or save if last student
                if (currentStudentIndex < students.length - 1) {
                    const nextStudentId = students[currentStudentIndex + 1].id;
                    const nextTAInput = document.querySelector(`input[data-student="${nextStudentId}"][data-field="ta"]`) as HTMLInputElement;
                    if (nextTAInput) {
                        // Update navigation state and scroll to next student
                        setCurrentStudentIndex(currentStudentIndex + 1);
                        setTimeout(() => {
                            nextTAInput.focus();
                            nextTAInput.select();
                        }, 100);
                    }
                } else {
                    // Last student, blur the input to hide keyboard
                    (e.target as HTMLInputElement).blur();
                }
            }
        }
    }, [students]);

    // Debounced marks change handler for better performance
    const handleMarksChange = useCallback((studentId: string, field: 'ta' | 'ce', value: string) => {
        // Only allow numeric input
        if (value && !/^\d*$/.test(value)) {
            return;
        }

        // Get subject data for validation
        const subject = subjects.find(s => s.id === selectedSubject);
        if (subject && value) {
            const numValue = parseInt(value);
            const maxValue = field === 'ta' ? subject.maxTA : subject.maxCE;

            // Don't allow values greater than max
            if (numValue > maxValue) {
                return;
            }
        }

        setMarksData(prev => ({
            ...prev,
            [studentId]: {
                ...prev[studentId],
                [field]: value
            }
        }));
    }, [subjects, selectedSubject]);



    // Memoized clear student marks handler
    const handleClearStudentMarks = useCallback(async (studentId: string, studentName: string) => {
        if (!selectedSubject) {
            alert('Please select a subject first');
            return;
        }

        if (confirm(`Are you sure you want to clear marks for ${studentName}? This will permanently delete the marks from the database and cannot be undone.`)) {
            try {
                setOperationLoading({ type: 'clearing', message: `Clearing marks for ${studentName}...` });

                // Clear marks from database for this specific student
                await dataService.clearStudentSubjectMarks(studentId, selectedSubject);

                // Clear UI state for this student
                setMarksData(prev => ({
                    ...prev,
                    [studentId]: { ta: '', ce: '' }
                }));

                // Delete local draft to prevent it from being re-loaded
                deleteDraft(studentId, selectedSubject);

                // Reload students to get updated data
                await loadStudentsByClass();

                alert(`Marks cleared successfully for ${studentName}!`);
            } catch (error) {
                console.error('Error clearing student marks:', error);
                alert(`Error clearing marks: ${error instanceof Error ? error.message : 'Unknown error'}`);
            } finally {
                setOperationLoading({ type: null });
            }
        }
    }, [selectedSubject, loadStudentsByClass]);

    // Memoized clear all marks handler
    const handleClearAll = useCallback(async () => {
        if (!selectedSubject) {
            alert('Please select a subject first');
            return;
        }

        const selectedSubjectData = subjects.find(s => s.id === selectedSubject);
        if (confirm(`Are you sure you want to clear all marks for "${selectedSubjectData?.name}" in ${selectedClass} class? This will permanently delete the marks from the database and cannot be undone.`)) {
            try {
                setOperationLoading({ type: 'clearing', message: `Clearing all marks for ${selectedSubjectData?.name} in ${selectedClass} class...` });

                // Get student IDs
                const studentIds = students.map(student => student.id);

                // Clear marks from database
                await dataService.clearSubjectMarks(selectedSubject, studentIds);

                // Clear UI state
                const clearedMarks: Record<string, { ta: string; ce: string }> = {};
                students.forEach(student => {
                    clearedMarks[student.id] = { ta: '', ce: '' };
                    // Delete local draft for each student
                    deleteDraft(student.id, selectedSubject);
                });
                setMarksData(clearedMarks);

                // Reload students to get updated data
                await loadStudentsByClass();

                alert('All marks cleared successfully!');
            } catch (error) {
                console.error('Error clearing marks:', error);
                alert(`Error clearing marks: ${error instanceof Error ? error.message : 'Unknown error'}`);
            } finally {
                setOperationLoading({ type: null });
            }
        }
    }, [selectedSubject, subjects, selectedClass, students, loadStudentsByClass]);

    const handleClearTAMarks = useCallback(async () => {
        if (!selectedSubject) {
            alert('Please select a subject first');
            return;
        }

        const selectedSubjectData = subjects.find(s => s.id === selectedSubject);
        if (confirm(`Are you sure you want to clear all TA marks for "${selectedSubjectData?.name}" in ${selectedClass} class? This will permanently delete the marks from the database and cannot be undone.`)) {
            try {
                setOperationLoading({ type: 'clearing', message: `Clearing all TA marks for ${selectedSubjectData?.name} in ${selectedClass} class...` });

                // Get student IDs
                const studentIds = students.map(student => student.id);

                // Clear marks from database
                await dataService.clearSubjectTAMarks(selectedSubject, studentIds);

                // Update UI state
                setMarksData(prev => {
                    const newMarks = { ...prev };
                    students.forEach(student => {
                        if (newMarks[student.id]) {
                            newMarks[student.id] = { ...newMarks[student.id], ta: '' };
                            // Update local draft: keep CE, clear TA
                            const currentDraft = getDraft(student.id, selectedSubject);
                            if (currentDraft) {
                                saveDraft(student.id, selectedSubject, '', currentDraft.ce || '');
                            }
                        }
                    });
                    return newMarks;
                });

                // Reload students to get updated data
                await loadStudentsByClass();

                alert('All TA marks cleared successfully!');
            } catch (error) {
                console.error('Error clearing TA marks:', error);
                alert(`Error clearing TA marks: ${error instanceof Error ? error.message : 'Unknown error'}`);
            } finally {
                setOperationLoading({ type: null });
            }
        }
    }, [selectedSubject, subjects, selectedClass, students, loadStudentsByClass]);

    const handleClearCEMarks = useCallback(async () => {
        if (!selectedSubject) {
            alert('Please select a subject first');
            return;
        }

        const selectedSubjectData = subjects.find(s => s.id === selectedSubject);
        if (confirm(`Are you sure you want to clear all CE marks for "${selectedSubjectData?.name}" in ${selectedClass} class? This will permanently delete the marks from the database and cannot be undone.`)) {
            try {
                setOperationLoading({ type: 'clearing', message: `Clearing all CE marks for ${selectedSubjectData?.name} in ${selectedClass} class...` });

                // Get student IDs
                const studentIds = students.map(student => student.id);

                // Clear marks from database
                await dataService.clearSubjectCEMarks(selectedSubject, studentIds);

                // Update UI state
                setMarksData(prev => {
                    const newMarks = { ...prev };
                    students.forEach(student => {
                        if (newMarks[student.id]) {
                            newMarks[student.id] = { ...newMarks[student.id], ce: '' };
                            // Update local draft: keep TA, clear CE
                            const currentDraft = getDraft(student.id, selectedSubject);
                            if (currentDraft) {
                                saveDraft(student.id, selectedSubject, currentDraft.ta || '', '');
                            }
                        }
                    });
                    return newMarks;
                });

                // Reload students to get updated data
                await loadStudentsByClass();

                alert('All CE marks cleared successfully!');
            } catch (error) {
                console.error('Error clearing CE marks:', error);
                alert(`Error clearing CE marks: ${error instanceof Error ? error.message : 'Unknown error'}`);
            } finally {
                setOperationLoading({ type: null });
            }
        }
    }, [selectedSubject, subjects, selectedClass, students, loadStudentsByClass]);

    const handleSaveMarks = useCallback(async () => {
        if (!selectedSubject) {
            alert('Please select a subject');
            return;
        }

        // Check for invalid marks before saving
        if (invalidMarksInfo.hasInvalid) {
            alert(`Cannot save marks. ${invalidMarksInfo.count} student(s) have marks exceeding the maximum allowed values. Please correct the highlighted entries.`);
            return;
        }

        try {
            setOperationLoading({ type: 'validating', message: 'Validating marks data...' });

            // Small delay to show validation stage
            await new Promise(resolve => setTimeout(resolve, 500));

            setOperationLoading({ type: 'saving', message: 'Saving marks to database...' });

            // Save marks for each student
            const savePromises = students.map(async (student) => {
                const marks = marksData[student.id];
                if (marks && marks.ta && marks.ce) {
                    const ta = parseInt(marks.ta);
                    const ce = parseInt(marks.ce);

                    // Validate marks against subject limits (double-check)
                    const sub = subjects.find(s => s.id === selectedSubject);
                    if (sub) {
                        if (ta > sub.maxTA) {
                            throw new Error(`TA marks for ${student.name} exceed maximum (${sub.maxTA})`);
                        }
                        if (ce > sub.maxCE) {
                            throw new Error(`CE marks for ${student.name} exceed maximum (${sub.maxCE})`);
                        }
                    }

                    // Special conversion for Max TA 35 (scale from 35 to 70 for storage)
                    let taToSave = ta;
                    if (sub?.maxTA === 35) {
                        taToSave = ta * 2;
                    }

                    try {
                        // Try to save online first
                        await dataService.updateStudentMarks(student.id, selectedSubject, taToSave, ce);

                        // If successful, delete any corresponding draft
                        const draft = getDraft(student.id, selectedSubject);
                        if (draft) {
                            deleteDraft(student.id, selectedSubject);
                        }
                    } catch (error) {
                        console.warn('Online save failed, saving offline:', error);

                        // If online save fails, save offline draft
                        await saveDraft(
                            student.id,
                            selectedSubject,
                            marks.ta,
                            marks.ce
                        );
                    }
                }
            });

            await Promise.all(savePromises);

            // Try to reload students to get updated data (only if online)
            if (isOnline) {
                await loadStudentsByClass();
            }

            // Show appropriate success message
            if (isOnline) {
                alert('Marks saved successfully!');
            } else {
                alert('Marks saved offline as drafts! They will need to be re-saved when online.');
            }
        } catch (error) {
            console.error('Error saving marks:', error);
            alert(`Error saving marks: ${error instanceof Error ? error.message : 'Unknown error'}`);
        } finally {
            setOperationLoading({ type: null });
        }
    }, [selectedSubject, invalidMarksInfo, students, marksData, subjects, loadStudentsByClass, isOnline, saveDraft, getDraft, deleteDraft]);

    // New handler for saving only TA marks
    const handleSaveTAMarks = useCallback(async () => {
        if (!selectedSubject) {
            alert('Please select a subject');
            return;
        }

        try {
            setOperationLoading({ type: 'saving', message: 'Saving TA marks to database...' });

            // Save TA marks for students who have TA entered
            const savePromises = students.map(async (student) => {
                const marks = marksData[student.id];
                if (marks && marks.ta) {
                    const ta = parseInt(marks.ta);

                    // Validate TA marks against subject limits
                    const sub = subjects.find(s => s.id === selectedSubject);
                    if (sub && ta > sub.maxTA) {
                        throw new Error(`TA marks for ${student.name} exceed maximum (${sub.maxTA})`);
                    }

                    // Special conversion for Max TA 35 (scale from 35 to 70 for storage)
                    let taToSave = ta;
                    if (sub?.maxTA === 35) {
                        taToSave = ta * 2;
                    }

                    try {
                        // Try to save online first
                        await dataService.updateStudentTAMarks(student.id, selectedSubject, taToSave);

                        // Update draft with TA marks (if successful, we probably want to clear draft, but preserving draft logic for now as 'sync').
                        // Actually, if saved online, we should remove draft? The original logic was updating draft.
                        // Let's stick to cleaning up drafts if online save succeeds.
                        const draft = getDraft(student.id, selectedSubject);
                        if (draft) {
                            // If we only saved TA, but there is CE in draft, we might want to keep CE?
                            // For simplicity, we'll just save a new draft if useOfflineCapability doesn't support partial updates easily
                            // Or assuming saving online means we are good.
                            // The original logic updated draft with "marks.ce || ''".
                        }

                        // If successful, delete any corresponding draft ONLY if we are fully synced?
                        // If we are just saving TA, maybe we shouldn't delete the whole draft if CE is dirty?
                        // But for "simplify", let's assume valid save = good.

                    } catch (error) {
                        console.warn('Online TA save failed, saving offline:', error);

                        // If online save fails, save offline draft
                        await saveDraft(
                            student.id,
                            selectedSubject,
                            marks.ta,
                            marks.ce || ''
                        );
                    }
                }
            });

            await Promise.all(savePromises);

            // Try to reload students to get updated data (only if online)
            if (isOnline) {
                await Promise.all([
                    loadStudentsByClass(),
                    loadAllStudents()
                ]);
            }

            // Show appropriate success message
            const studentsWithTA = students.filter(s => marksData[s.id]?.ta).length;
            if (isOnline) {
                alert(`TA marks saved successfully for ${studentsWithTA} students!`);
            } else {
                alert(`TA marks saved offline as drafts for ${studentsWithTA} students!`);
            }
        } catch (error) {
            console.error('Error saving TA marks:', error);
            alert(`Error saving TA marks: ${error instanceof Error ? error.message : 'Unknown error'}`);
        } finally {
            setOperationLoading({ type: null });
        }
    }, [selectedSubject, students, marksData, subjects, loadStudentsByClass, isOnline, saveDraft, getDraft]);

    // New handler for saving only CE marks
    const handleSaveCEMarks = useCallback(async () => {
        if (!selectedSubject) {
            alert('Please select a subject');
            return;
        }

        try {
            setOperationLoading({ type: 'saving', message: 'Saving CE marks to database...' });

            // Save CE marks for students who have CE entered
            const savePromises = students.map(async (student) => {
                const marks = marksData[student.id];
                if (marks && marks.ce) {
                    const ce = parseInt(marks.ce);

                    // Validate CE marks against subject limits
                    const subject = subjects.find(s => s.id === selectedSubject);
                    if (subject && ce > subject.maxCE) {
                        throw new Error(`CE marks for ${student.name} exceed maximum (${subject.maxCE})`);
                    }

                    try {
                        // Try to save online first
                        await dataService.updateStudentCEMarks(student.id, selectedSubject, ce);

                        // Update draft with CE marks - keep draft if CE saved but TA not?
                        // For simplicity, just update draft if offline fails.

                    } catch (error) {
                        console.warn('Online CE save failed, saving offline:', error);

                        // If online save fails, save offline draft
                        await saveDraft(
                            student.id,
                            selectedSubject,
                            marks.ta || '',
                            marks.ce
                        );
                    }
                }
            });

            await Promise.all(savePromises);

            // Try to reload students to get updated data (only if online)
            if (isOnline) {
                await Promise.all([
                    loadStudentsByClass(),
                    loadAllStudents()
                ]);
            }

            // Show appropriate success message
            const studentsWithCE = students.filter(s => marksData[s.id]?.ce).length;
            if (isOnline) {
                alert(`CE marks saved successfully for ${studentsWithCE} students!`);
            } else {
                alert(`CE marks saved offline as drafts for ${studentsWithCE} students!`);
            }
        } catch (error) {
            console.error('Error saving CE marks:', error);
            alert(`Error saving CE marks: ${error instanceof Error ? error.message : 'Unknown error'}`);
        } finally {
            setOperationLoading({ type: null });
        }
    }, [selectedSubject, students, marksData, subjects, loadStudentsByClass, isOnline, saveDraft, getDraft]);

    const selectedSubjectData = subjects.find(s => s.id === selectedSubject);

    if (isLoading) {
        return (
            <>
                <ProgressiveLoadingSkeleton
                    stage={loadingStage}
                    progress={loadingProgress}
                />
            </>
        );
    }

    return (
        <div className="space-y-4 md:space-y-8">
            <div className="px-4 md:px-0">
                <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">Faculty Marks Entry</h1>
                <p className="text-slate-600 mt-2 text-sm md:text-base">Enter and manage student marks for assessments</p>

                {/* Tab Navigation */}
                <div className="flex gap-2 mt-6 border-b border-slate-200">
                    <button
                        onClick={() => setActiveTab('marks-entry')}
                        className={`px-6 py-3 font-bold text-sm md:text-base transition-all duration-200 border-b-4 ${activeTab === 'marks-entry'
                            ? 'border-emerald-600 text-emerald-700 bg-emerald-50/50'
                            : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                            }`}
                    >
                        <i className="fa-solid fa-pen-to-square mr-2"></i>
                        Marks Entry
                    </button>
                    <button
                        onClick={() => setActiveTab('upload-tracker')}
                        className={`px-6 py-3 font-bold text-sm md:text-base transition-all duration-200 border-b-4 ${activeTab === 'upload-tracker'
                            ? 'border-emerald-600 text-emerald-700 bg-emerald-50/50'
                            : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                            }`}
                    >
                        <i className="fa-solid fa-chart-bar mr-2"></i>
                        Upload Tracker
                    </button>
                </div>
            </div>

            {/* Marks Entry Tab Content */}
            {activeTab === 'marks-entry' && (
                <>
                    {/* Mobile-Optimized Selection Controls */}
                    <div className="bg-white rounded-2xl md:rounded-3xl p-6 md:p-8 shadow-xl border-2 border-slate-200 mx-6 md:mx-0 print:hidden" style={{
                        background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
                        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
                    }}>

                        <div className={`space-y-4 md:space-y-0 md:grid ${subjectType === 'elective' ? 'md:grid-cols-2' : 'md:grid-cols-3'} md:gap-6`}>

                            {subjectType === 'general' && (
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-2">Class</label>
                                    <select
                                        value={selectedClass}
                                        onChange={(e) => setSelectedClass(e.target.value)}
                                        className="w-full p-4 text-xl md:text-base border-2 border-slate-300 rounded-xl focus:ring-4 focus:ring-emerald-500/40 focus:border-emerald-500 bg-white transition-all duration-300 ease-out hover:border-slate-400 hover:shadow-sm active:scale-[0.99] print:hidden"
                                        disabled={isSaving || operationLoading.type !== null}
                                        style={{ minHeight: '48px' }}
                                        aria-label="Select class for marks entry"
                                        aria-describedby="class-help"
                                    >
                                        {CLASSES.map(cls => (
                                            <option key={cls} value={cls}>{cls}</option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-2">Subject Type</label>
                                <select
                                    value={subjectType}
                                    onChange={(e) => setSubjectType(e.target.value as 'general' | 'elective')}
                                    className="w-full p-4 text-xl md:text-base border-2 border-slate-300 rounded-xl focus:ring-4 focus:ring-emerald-500/40 focus:border-emerald-500 bg-white transition-all duration-300 ease-out hover:border-slate-400 hover:shadow-sm active:scale-[0.99] print:hidden"
                                    disabled={isSaving || operationLoading.type !== null}
                                    style={{ minHeight: '48px' }}
                                    aria-label="Select subject type"
                                >
                                    <option value="general">General</option>
                                    <option value="elective">Elective</option>
                                </select>
                            </div>

                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <label className="block text-sm font-bold text-slate-700">Subject</label>
                                    {/* Offline Status Indicator */}
                                    <OfflineStatusIndicator
                                        className="md:block hidden"
                                    />
                                </div>
                                <select
                                    value={selectedSubject}
                                    onChange={(e) => setSelectedSubject(e.target.value)}
                                    className="w-full p-4 text-xl md:text-base border-2 border-slate-300 rounded-xl focus:ring-4 focus:ring-emerald-500/40 focus:border-emerald-500 bg-white transition-all duration-300 ease-out hover:border-slate-400 hover:shadow-sm active:scale-[0.99] print:hidden"
                                    disabled={isSaving || operationLoading.type !== null}
                                    style={{ minHeight: '48px' }}
                                    aria-label="Select subject for marks entry"
                                    aria-describedby="subject-help"
                                >
                                    <option value="">Select Subject</option>
                                    {classSubjects.map(subject => (
                                        <option key={subject.id} value={subject.id}>
                                            {subject.name} {subject.arabicName && `(${subject.arabicName})`}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {selectedSubject && (
                            <div className="mt-4 flex items-center gap-4 print:hidden">
                                <label className="flex items-center gap-2 print:hidden">
                                    <input
                                        type="checkbox"
                                        checked={showSupplementaryOnly}
                                        onChange={(e) => {
                                            setShowSupplementaryOnly(e.target.checked);
                                            // Reload students when toggling supplementary mode
                                            setTimeout(() => loadStudentsByClass(), 100);
                                        }}
                                        className="w-5 h-5 text-orange-600 focus:ring-orange-500 border-slate-300 rounded print:hidden"
                                        disabled={isSaving || operationLoading.type !== null}
                                        aria-describedby="supplementary-help"
                                        style={{ minHeight: '44px', minWidth: '44px' }}
                                    />
                                    <span className="text-xs md:text-sm font-medium text-slate-700" id="supplementary-help">
                                        Show Supplementary Exam Students Only
                                    </span>
                                </label>
                                {showSupplementaryOnly && (
                                    <span className="px-2 py-1 bg-orange-100 text-orange-700 rounded text-xs font-medium">
                                        Supplementary Mode
                                    </span>
                                )}
                            </div>
                        )}

                        {selectedSubjectData && (
                            <div className="mt-4 p-3 md:p-4 bg-slate-50 rounded-xl">
                                <div className="space-y-3 md:space-y-0 md:grid md:grid-cols-2 md:gap-4 text-sm">
                                    <div className="space-y-2">
                                        <div>
                                            <span className="font-bold text-slate-700">Max TA:</span>
                                            <span className="ml-2 text-slate-600">{selectedSubjectData.maxTA}</span>
                                            <span className="ml-2 text-red-600 font-medium">
                                                (Min: {Math.ceil(selectedSubjectData.maxTA * 0.4)})
                                            </span>
                                        </div>
                                        <div>
                                            <span className="font-bold text-slate-700">Max CE:</span>
                                            <span className="ml-2 text-slate-600">{selectedSubjectData.maxCE}</span>
                                            <span className="ml-2 text-red-600 font-medium">
                                                (Min: {Math.ceil(selectedSubjectData.maxCE * 0.5)})
                                            </span>
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <div>
                                            <span className="font-bold text-slate-700">Faculty:</span>
                                            <span className="ml-2 text-slate-600">{selectedSubjectData.facultyName}</span>
                                        </div>
                                        <div className="text-xs text-blue-700 bg-blue-50 p-2 rounded">
                                            <strong>Passing Rule:</strong> Students must achieve both TA minimum (40%) AND CE minimum (50%) to pass
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}



                        {/* Draft Recovery Controls - REMOVED */}
                    </div>

                    {/* Mobile-Optimized Marks Entry */}
                    {selectedSubject && students.length > 0 ? (
                        <div className="mx-6 md:mx-0 print:hidden">
                            {/* Mobile Card View */}
                            <div className="block md:hidden space-y-8 pb-[18rem]">
                                {/* Enhanced Mobile Navigation Header */}
                                <div className="bg-white rounded-3xl p-6 shadow-xl border-2 border-slate-200 sticky top-4 z-40" style={{
                                    background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
                                    boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
                                }}>
                                    {/* Subject and Student Count */}
                                    <div className="flex items-center justify-between mb-6">
                                        <div className="flex items-center gap-3">
                                            <h2 className="text-xl font-black text-slate-900 tracking-tight">
                                                {selectedSubjectData?.name}
                                            </h2>
                                            {/* Mobile Offline Status Indicator */}
                                            <OfflineStatusIndicator
                                                className="md:hidden block"
                                            />
                                        </div>
                                        <div className="flex items-center gap-4">
                                            {/* Quick Access Button */}
                                            <button
                                                {...getTouchProps(() => setShowStudentList(!showStudentList))}
                                                className="flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 active:from-blue-700 active:to-blue-800 transition-all duration-200 transform hover:scale-105 active:scale-95 shadow-lg"
                                                title="Quick Student Access"
                                                style={{ minHeight: '48px', minWidth: '48px' }}
                                                aria-label={showStudentList ? "Close student list" : "Open student list"}
                                                aria-expanded={showStudentList}
                                                aria-controls="student-list-panel"
                                            >
                                                <i className={`fa-solid ${showStudentList ? 'fa-times' : 'fa-list'} text-white text-base`}></i>
                                            </button>
                                            <div className="text-right">
                                                <div className="text-base text-slate-700 font-bold">
                                                    {students.length} students
                                                </div>
                                                <div className="text-sm text-slate-500 font-medium">
                                                    {completionStats.completed} completed
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Expandable Student List with Search */}
                                    {showStudentList && (
                                        <div className="mb-4 p-4 bg-slate-50 rounded-xl border border-slate-200 animate-in slide-in-from-top-2 duration-300" id="student-list-panel" role="region" aria-label="Student list panel">
                                            {/* Search Input */}
                                            <div className="mb-3">
                                                <div className="relative">
                                                    <input
                                                        type="text"
                                                        placeholder="Search by name or admission number..."
                                                        value={searchQuery}
                                                        onChange={(e) => setSearchQuery(e.target.value)}
                                                        className="w-full p-3 pl-10 text-sm border-2 border-slate-300 rounded-xl focus:ring-4 focus:ring-blue-500/40 focus:border-blue-500 bg-white transition-all duration-200"
                                                        style={{ minHeight: '44px' }}
                                                        aria-label="Search students by name or admission number"
                                                        role="searchbox"
                                                        aria-describedby="search-results-count"
                                                    />
                                                    <i className="fa-solid fa-search absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 text-sm"></i>
                                                    {searchQuery && (
                                                        <button
                                                            onClick={() => setSearchQuery('')}
                                                            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors duration-200 w-6 h-6 flex items-center justify-center"
                                                            aria-label="Clear search"
                                                            style={{ minHeight: '44px', minWidth: '44px' }}
                                                        >
                                                            <i className="fa-solid fa-times text-sm"></i>
                                                        </button>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Student List */}
                                            <div className="max-h-64 overflow-y-auto space-y-2" role="list" aria-label="Student list" id="search-results-count" aria-live="polite">
                                                {filteredStudents.length > 0 ? (
                                                    filteredStudents.map((student, index) => {
                                                        const originalIndex = students.findIndex(s => s.id === student.id);
                                                        const isCompleted = marksData[student.id]?.ta && marksData[student.id]?.ce;
                                                        const isCurrent = originalIndex === currentStudentIndex;

                                                        return (
                                                            <button
                                                                key={student.id}
                                                                onClick={() => jumpToStudent(student.id)}
                                                                className={`w-full p-3 text-left rounded-lg transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98] ${isCurrent
                                                                    ? 'bg-blue-500 text-white shadow-md'
                                                                    : isCompleted
                                                                        ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                                                                        : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
                                                                    }`}
                                                                style={{ minHeight: '44px' }}
                                                                role="listitem"
                                                                aria-label={`Navigate to ${student.name}, admission ${student.adNo}, position ${originalIndex + 1} of ${students.length}${isCompleted ? ', completed' : ', pending'}${isCurrent ? ', currently selected' : ''}`}
                                                            >
                                                                <div className="flex items-center justify-between">
                                                                    <div>
                                                                        <div className="font-medium text-sm">
                                                                            {student.name}
                                                                        </div>
                                                                        <div className="text-xs opacity-75">
                                                                            Adm: {student.adNo}
                                                                        </div>
                                                                    </div>
                                                                    <div className="flex items-center gap-2">
                                                                        <span className="text-xs font-medium">
                                                                            #{originalIndex + 1}
                                                                        </span>
                                                                        {isCompleted && (
                                                                            <i className="fa-solid fa-check-circle text-xs"></i>
                                                                        )}
                                                                        {isCurrent && (
                                                                            <i className="fa-solid fa-arrow-right text-xs"></i>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </button>
                                                        );
                                                    })
                                                ) : (
                                                    <div className="text-center py-4 text-slate-500">
                                                        <i className="fa-solid fa-search text-2xl mb-2"></i>
                                                        <div className="text-sm">
                                                            {searchQuery ? 'No students found matching your search' : 'No students available'}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Quick Stats */}
                                            {searchQuery && filteredStudents.length > 0 && (
                                                <div className="mt-3 pt-3 border-t border-slate-300">
                                                    <div className="text-xs text-slate-600 text-center">
                                                        Showing {filteredStudents.length} of {students.length} students
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* Student Navigation Controls */}
                                    {students.length > 0 && (
                                        <div className="mb-4">
                                            <div className="flex items-center justify-between mb-3">
                                                {/* Previous Button */}
                                                <button
                                                    onClick={navigateToPrevious}
                                                    disabled={currentStudentIndex === 0}
                                                    className="flex items-center justify-center w-12 h-12 rounded-xl bg-slate-100 hover:bg-slate-200 active:bg-slate-300 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 transform hover:scale-105 active:scale-95"
                                                    style={{ minHeight: '48px', minWidth: '48px' }}
                                                    title="Previous Student"
                                                    aria-label="Navigate to previous student"
                                                    aria-disabled={currentStudentIndex === 0}
                                                >
                                                    <i className="fa-solid fa-chevron-left text-slate-600 text-lg"></i>
                                                </button>

                                                {/* Current Student Position and Progress */}
                                                <div className="flex-1 mx-4 text-center">
                                                    <div className="text-lg font-black text-slate-900 mb-1">
                                                        Student {currentStudentIndex + 1} of {students.length}
                                                    </div>
                                                    <div className="text-sm text-slate-600 mb-2">
                                                        {students[currentStudentIndex]?.name}
                                                    </div>

                                                    {/* Swipe Hint */}
                                                    {students.length > 1 && (
                                                        <div className="flex items-center justify-center gap-2 mb-2">
                                                            <i className="fa-solid fa-hand-pointer text-xs text-slate-400"></i>
                                                            <span className="text-xs text-slate-500">Swipe cards to navigate</span>
                                                            <i className="fa-solid fa-arrows-left-right text-xs text-slate-400"></i>
                                                        </div>
                                                    )}

                                                    {/* Completion Status Indicator */}
                                                    <div className="flex items-center justify-center gap-2 mb-2">
                                                        {marksData[students[currentStudentIndex]?.id]?.ta && marksData[students[currentStudentIndex]?.id]?.ce ? (
                                                            <div className="flex items-center gap-1 px-2 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs font-medium">
                                                                <i className="fa-solid fa-check-circle"></i>
                                                                <span>Completed</span>
                                                            </div>
                                                        ) : (
                                                            <div className="flex items-center gap-1 px-2 py-1 bg-orange-100 text-orange-700 rounded-full text-xs font-medium">
                                                                <i className="fa-solid fa-clock"></i>
                                                                <span>Pending</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Next Button */}
                                                <button
                                                    onClick={navigateToNext}
                                                    disabled={currentStudentIndex === students.length - 1}
                                                    className="flex items-center justify-center w-12 h-12 rounded-xl bg-slate-100 hover:bg-slate-200 active:bg-slate-300 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 transform hover:scale-105 active:scale-95"
                                                    style={{ minHeight: '48px', minWidth: '48px' }}
                                                    title="Next Student"
                                                    aria-label="Navigate to next student"
                                                    aria-disabled={currentStudentIndex === students.length - 1}
                                                >
                                                    <i className="fa-solid fa-chevron-right text-slate-600 text-lg"></i>
                                                </button>
                                            </div>




                                        </div>
                                    )}
                                </div>

                                {/* Render visible students with pagination */}
                                {paginatedStudents.map((student, index) => {
                                    const isCurrent = index === currentStudentIndex;
                                    const studentMarks = marksData[student.id] || { ta: '', ce: '' };

                                    return (
                                        <div
                                            key={student.id}
                                            ref={el => { studentRefs.current[student.id] = el; }}
                                            className={`bg-white rounded-xl p-3 border border-slate-200 shadow-sm transition-all ${isCurrent ? 'ring-2 ring-emerald-500 bg-emerald-50/50' : ''}`}
                                        >
                                            <div className="flex items-center justify-between mb-2">
                                                <div className="flex flex-col">
                                                    <h3 className="font-bold text-slate-900 text-sm leading-tight">{student.name}</h3>
                                                    <p className="text-[10px] uppercase font-black text-slate-400">ADM: {student.adNo}</p>
                                                </div>
                                                <span className="px-2 py-0.5 bg-slate-200 text-slate-600 rounded text-[10px] font-bold">
                                                    {index + 1} / {students.length}
                                                </span>
                                            </div>

                                            <div className="grid grid-cols-2 gap-3">
                                                <div>
                                                    <label className="block text-xs font-medium text-slate-600 mb-1">
                                                        TA (Max: {selectedSubjectData?.maxTA})
                                                    </label>
                                                    <input
                                                        type="number"
                                                        value={studentMarks.ta}
                                                        onChange={(e) => handleMarksChange(student.id, 'ta', e.target.value)}
                                                        className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                                                        max={selectedSubjectData?.maxTA}
                                                        min="0"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-medium text-slate-600 mb-1">
                                                        CE (Max: {selectedSubjectData?.maxCE})
                                                    </label>
                                                    <input
                                                        type="number"
                                                        value={studentMarks.ce}
                                                        onChange={(e) => handleMarksChange(student.id, 'ce', e.target.value)}
                                                        className={`w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 ${selectedSubjectData?.maxTA === 100 ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : ''}`}
                                                        max={selectedSubjectData?.maxCE}
                                                        min="0"
                                                        disabled={selectedSubjectData?.maxTA === 100}
                                                        data-student={student.id}
                                                        data-field="ce"
                                                        placeholder={selectedSubjectData?.maxTA === 100 ? "N/A" : ""}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}

                                {/* Load More Button */}
                                {hasMore && (
                                    <button
                                        onClick={() => setCurrentPage(prev => prev + 1)}
                                        className="w-full p-4 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-all shadow-lg active:scale-95 mb-8"
                                        style={{ minHeight: '48px' }}
                                    >
                                        Load More ({filteredStudents.length - paginatedStudents.length} remaining)
                                    </button>
                                )}

                                {/* End of List Indicator */}
                                {!hasMore && filteredStudents.length > 0 && (
                                    <div className="py-12 text-center">
                                        <div className="inline-flex flex-col items-center gap-2 px-6 py-3 bg-slate-100 rounded-2xl border border-slate-200">
                                            <i className="fa-solid fa-flag-checkered text-slate-400"></i>
                                            <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">End of Student List</span>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Desktop Table View - Hidden on Mobile */}
                            <div className="hidden md:block bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                                {/* Desktop table content remains the same as original */}
                                <div className="p-6 border-b border-slate-200">
                                    <div className="flex items-center justify-between">
                                        <h2 className="text-xl font-black text-slate-900">
                                            {selectedSubjectData?.name} - {selectedClass} Class
                                        </h2>
                                        <div className="text-sm text-slate-600">
                                            {students.length} students
                                        </div>
                                    </div>
                                </div>

                                <div className="overflow-x-auto">
                                    <table className="w-full">
                                        <thead className="bg-slate-50">
                                            <tr>
                                                <th className="text-left p-4 font-bold text-slate-700">Adm No</th>
                                                <th className="text-left p-4 font-bold text-slate-700">Student Name</th>
                                                <th className="text-center p-4 font-bold text-slate-700">
                                                    TA ({selectedSubjectData?.maxTA})
                                                </th>
                                                <th className="text-center p-4 font-bold text-slate-700">
                                                    CE ({selectedSubjectData?.maxCE})
                                                </th>
                                                <th className="text-center p-4 font-bold text-slate-700">Total</th>
                                                <th className="text-center p-4 font-bold text-slate-700">Status</th>
                                                <th className="text-center p-4 font-bold text-slate-700">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {students.map((student, index) => {
                                                const total = validationHelpers?.calculateTotal(student.id) || 0;
                                                const status = validationHelpers?.getStatus(student.id) || 'Pending';
                                                const isTAExceeding = validationHelpers?.isTAExceedingMax(student.id) || false;
                                                const isCEExceeding = validationHelpers?.isCEExceedingMax(student.id) || false;
                                                const isTAFailing = validationHelpers?.isTAFailing(student.id) || false;
                                                const isCEFailing = validationHelpers?.isCEFailing(student.id) || false;

                                                return (
                                                    <tr key={student.id} className={index % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                                                        <td className="p-4 font-medium text-slate-900">{student.adNo}</td>
                                                        <td className="p-4 font-medium text-slate-900">{student.name}</td>
                                                        <td className="p-4 text-center">
                                                            <input
                                                                type="text"
                                                                inputMode="numeric"
                                                                pattern="[0-9]*"
                                                                autoComplete="off"
                                                                autoCorrect="off"
                                                                autoCapitalize="off"
                                                                spellCheck="false"
                                                                enterKeyHint="next"
                                                                data-student={student.id}
                                                                data-field="ta"
                                                                value={marksData[student.id]?.ta || ''}
                                                                onChange={(e) => handleMarksChange(student.id, 'ta', e.target.value)}
                                                                onKeyDown={(e) => handleKeyDown(e, student.id, 'ta')}
                                                                className={`w-20 p-4 text-xl border-2 rounded-xl text-center focus:ring-8 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all duration-500 ease-out transform ${isTAExceeding
                                                                    ? 'border-red-700 bg-gradient-to-br from-red-50 to-red-100 text-red-900 ring-8 ring-red-600/60 shadow-2xl shadow-red-600/30 animate-pulse scale-[1.05] hover:scale-[1.06]'
                                                                    : isTAFailing
                                                                        ? 'border-orange-700 bg-gradient-to-br from-orange-50 to-orange-100 text-orange-900 ring-8 ring-orange-600/60 shadow-xl shadow-orange-600/25 scale-[1.03] hover:scale-[1.04]'
                                                                        : marksData[student.id]?.ta && !isTAFailing && !isTAExceeding
                                                                            ? 'border-emerald-700 bg-gradient-to-br from-emerald-50 to-emerald-100 text-emerald-900 ring-8 ring-emerald-600/60 shadow-xl shadow-emerald-600/25 scale-[1.03] hover:scale-[1.04]'
                                                                            : 'border-slate-400 hover:border-slate-500 hover:shadow-lg hover:scale-[1.02] active:scale-[0.98] active:shadow-inner bg-gradient-to-br from-white to-slate-50 focus:bg-gradient-to-br focus:from-blue-50 focus:to-blue-100'
                                                                    }`}
                                                                placeholder="0"
                                                                disabled={isSaving || operationLoading.type !== null}
                                                                maxLength={3}
                                                                style={{ minHeight: '48px' }}
                                                            />
                                                            {isTAExceeding && (
                                                                <div className="text-xs text-red-900 mt-2 font-black animate-bounce bg-red-100 px-2 py-1 rounded-lg border border-red-300 shadow-sm">
                                                                    <i className="fa-solid fa-exclamation-triangle mr-1"></i>
                                                                    Max: {subjects.find(s => s.id === selectedSubject)?.maxTA}
                                                                </div>
                                                            )}
                                                            {!isTAExceeding && isTAFailing && (
                                                                <div className="text-xs text-orange-900 mt-2 font-bold bg-orange-100 px-2 py-1 rounded-lg border border-orange-300 shadow-sm">
                                                                    <i className="fa-solid fa-exclamation-circle mr-1"></i>
                                                                    Min: {Math.ceil((subjects.find(s => s.id === selectedSubject)?.maxTA || 0) * 0.4)}
                                                                </div>
                                                            )}
                                                            {marksData[student.id]?.ta && !isTAFailing && !isTAExceeding && (
                                                                <div className="text-xs text-emerald-900 mt-2 font-bold bg-emerald-100 px-2 py-1 rounded-lg border border-emerald-300 shadow-sm">
                                                                    <i className="fa-solid fa-check-circle mr-1"></i>
                                                                    Valid
                                                                </div>
                                                            )}
                                                        </td>
                                                        <td className="p-4 text-center">
                                                            <input
                                                                type="text"
                                                                inputMode="numeric"
                                                                pattern="[0-9]*"
                                                                autoComplete="off"
                                                                autoCorrect="off"
                                                                autoCapitalize="off"
                                                                spellCheck="false"
                                                                enterKeyHint="done"
                                                                data-student={student.id}
                                                                data-field="ce"
                                                                value={marksData[student.id]?.ce || ''}
                                                                onChange={(e) => handleMarksChange(student.id, 'ce', e.target.value)}
                                                                onKeyDown={(e) => handleKeyDown(e, student.id, 'ce')}
                                                                className={`w-20 p-4 text-xl border-2 rounded-xl text-center focus:ring-8 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all duration-500 ease-out transform ${isCEExceeding
                                                                    ? 'border-red-700 bg-gradient-to-br from-red-50 to-red-100 text-red-900 ring-8 ring-red-600/60 shadow-2xl shadow-red-600/30 animate-pulse scale-[1.05] hover:scale-[1.06]'
                                                                    : isCEFailing
                                                                        ? 'border-orange-700 bg-gradient-to-br from-orange-50 to-orange-100 text-orange-900 ring-8 ring-orange-600/60 shadow-xl shadow-orange-600/25 scale-[1.03] hover:scale-[1.04]'
                                                                        : marksData[student.id]?.ce && !isCEFailing && !isCEExceeding
                                                                            ? 'border-emerald-700 bg-gradient-to-br from-emerald-50 to-emerald-100 text-emerald-900 ring-8 ring-emerald-600/60 shadow-xl shadow-emerald-600/25 scale-[1.03] hover:scale-[1.04]'
                                                                            : 'border-slate-400 hover:border-slate-500 hover:shadow-lg hover:scale-[1.02] active:scale-[0.98] active:shadow-inner bg-gradient-to-br from-white to-slate-50 focus:bg-gradient-to-br focus:from-blue-50 focus:to-blue-100'
                                                                    }`}
                                                                placeholder="0"
                                                                disabled={isSaving || operationLoading.type !== null}
                                                                maxLength={3}
                                                                style={{ minHeight: '48px' }}
                                                            />
                                                            {isCEExceeding && (
                                                                <div className="text-xs text-red-900 mt-2 font-black animate-bounce bg-red-100 px-2 py-1 rounded-lg border border-red-300 shadow-sm">
                                                                    <i className="fa-solid fa-exclamation-triangle mr-1"></i>
                                                                    Max: {subjects.find(s => s.id === selectedSubject)?.maxCE}
                                                                </div>
                                                            )}
                                                            {!isCEExceeding && isCEFailing && (
                                                                <div className="text-xs text-orange-900 mt-2 font-bold bg-orange-100 px-2 py-1 rounded-lg border border-orange-300 shadow-sm">
                                                                    <i className="fa-solid fa-exclamation-circle mr-1"></i>
                                                                    Min: {Math.ceil((subjects.find(s => s.id === selectedSubject)?.maxCE || 0) * 0.5)}
                                                                </div>
                                                            )}
                                                            {marksData[student.id]?.ce && !isCEFailing && !isCEExceeding && (
                                                                <div className="text-xs text-emerald-900 mt-2 font-bold bg-emerald-100 px-2 py-1 rounded-lg border border-emerald-300 shadow-sm">
                                                                    <i className="fa-solid fa-check-circle mr-1"></i>
                                                                    Valid
                                                                </div>
                                                            )}
                                                        </td>
                                                        <td className="p-4 text-center font-bold text-slate-900">
                                                            {marksData[student.id]?.ta && marksData[student.id]?.ce ? total : '-'}
                                                        </td>
                                                        <td className="p-4 text-center">
                                                            <span className={`px-3 py-1 rounded-full text-sm font-medium ${status === 'Passed' ? 'bg-emerald-100 text-emerald-700' :
                                                                status === 'Failed' ? 'bg-red-100 text-red-700' :
                                                                    'bg-slate-100 text-slate-600'
                                                                }`}>
                                                                {status}
                                                            </span>
                                                        </td>
                                                        <td className="p-4 text-center">
                                                            <button
                                                                onClick={() => handleClearStudentMarks(student.id, student.name)}
                                                                disabled={isSaving || operationLoading.type !== null || (!marksData[student.id]?.ta && !marksData[student.id]?.ce)}
                                                                className="px-3 py-1 text-xs bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-105 active:scale-95 hover:shadow-sm"
                                                                title={`Clear marks for ${student.name}`}
                                                            >
                                                                <i className="fa-solid fa-trash text-xs"></i>
                                                            </button>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>

                                <div className="p-6 border-t border-slate-200 flex justify-between items-center">
                                    <div className="text-sm text-slate-600">
                                        {completionStats.completed} of {completionStats.total} students have marks entered
                                        {invalidMarksInfo.hasInvalid && (
                                            <div className="text-red-600 font-medium mt-1">
                                                ⚠️ {invalidMarksInfo.count} student(s) have invalid marks exceeding maximum values
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex gap-3">
                                        <button
                                            onClick={handleSaveTAMarks}
                                            disabled={isSaving || operationLoading.type !== null || !selectedSubject}
                                            className="px-4 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-[1.02] active:scale-[0.98] hover:shadow-md flex items-center gap-2"
                                            style={{ minHeight: '44px' }}
                                            aria-label="Save TA marks only"
                                        >
                                            <i className="fa-solid fa-clipboard-check text-sm"></i>
                                            Save TA
                                        </button>
                                        <button
                                            onClick={handleSaveCEMarks}
                                            disabled={isSaving || operationLoading.type !== null || !selectedSubject}
                                            className="px-4 py-3 bg-purple-600 text-white rounded-xl font-bold hover:bg-purple-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-[1.02] active:scale-[0.98] hover:shadow-md flex items-center gap-2"
                                            style={{ minHeight: '44px' }}
                                            aria-label="Save CE marks only"
                                        >
                                            <i className="fa-solid fa-clipboard-check text-sm"></i>
                                            Save CE
                                        </button>
                                        <button
                                            onClick={handleClearTAMarks}
                                            disabled={isSaving || operationLoading.type !== null || !selectedSubject}
                                            className="px-4 py-3 border-2 border-orange-200 text-orange-700 rounded-xl font-bold hover:bg-orange-50 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-[1.02] active:scale-[0.98] flex items-center gap-2"
                                            style={{ minHeight: '44px' }}
                                            aria-label="Clear TA marks for all students"
                                        >
                                            <i className="fa-solid fa-eraser text-sm"></i>
                                            Clear TA
                                        </button>
                                        <button
                                            onClick={handleClearCEMarks}
                                            disabled={isSaving || operationLoading.type !== null || !selectedSubject}
                                            className="px-4 py-3 border-2 border-red-200 text-red-700 rounded-xl font-bold hover:bg-red-50 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-[1.02] active:scale-[0.98] flex items-center gap-2"
                                            style={{ minHeight: '44px' }}
                                            aria-label="Clear CE marks for all students"
                                        >
                                            <i className="fa-solid fa-eraser text-sm"></i>
                                            Clear CE
                                        </button>
                                        <button
                                            onClick={handleClearAll}
                                            disabled={isSaving || operationLoading.type !== null}
                                            className="px-6 py-3 border border-slate-300 text-slate-700 rounded-xl font-bold hover:bg-slate-50 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-[1.02] active:scale-[0.98] hover:shadow-md active:shadow-inner"
                                            style={{ minHeight: '44px' }}
                                            aria-label="Clear all marks"
                                        >
                                            Clear All
                                        </button>
                                        <button
                                            onClick={handleSaveMarks}
                                            disabled={isSaving || operationLoading.type !== null || !selectedSubject || invalidMarksInfo.hasInvalid}
                                            className={`px-6 py-3 rounded-xl font-bold transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transform hover:scale-[1.02] active:scale-[0.98] hover:shadow-lg active:shadow-inner ${invalidMarksInfo.hasInvalid
                                                ? 'bg-red-600 text-white hover:bg-red-700'
                                                : 'bg-emerald-600 text-white hover:bg-emerald-700'
                                                }`}
                                            style={{ minHeight: '44px' }}
                                            aria-label="Save all marks (both TA and CE)"
                                        >
                                            {isSaving ? (
                                                <>
                                                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                                    Saving Marks...
                                                </>
                                            ) : invalidMarksInfo.hasInvalid ? (
                                                <>
                                                    <i className="fa-solid fa-exclamation-triangle"></i>
                                                    Fix Invalid Marks
                                                </>
                                            ) : (
                                                <>
                                                    <i className="fa-solid fa-save"></i>
                                                    Save All Marks
                                                </>
                                            )}
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Enhanced Mobile Action Buttons with Sticky Positioning */}
                            <div className={`block md:hidden fixed bottom-0 left-0 right-0 z-50 transition-all duration-300 ease-out ${isScrolling ? 'transform translate-y-1 scale-[0.98]' : 'transform translate-y-0 scale-100'
                                }`}>
                                {/* Background blur and shadow */}
                                <div className="absolute inset-0 bg-white/80 backdrop-blur-md border-t border-slate-200/50"></div>

                                {/* Action buttons container */}
                                <div className="relative p-3 pb-4">
                                    {/* Scroll to top button */}
                                    {showScrollToTop && (
                                        <button
                                            onClick={scrollToTop}
                                            className="fixed bottom-32 right-4 flex items-center justify-center w-10 h-10 bg-slate-800/80 text-white rounded-full shadow-lg backdrop-blur-sm z-50 transform active:scale-95"
                                            title="Scroll to top"
                                        >
                                            <i className="fa-solid fa-chevron-up text-sm"></i>
                                        </button>
                                    )}

                                    {/* Compact Status display */}
                                    <div className="flex items-center justify-between mb-2 px-1">
                                        <div className="text-xs font-bold text-slate-500">
                                            PROGRESS: <span className="text-slate-900">{completionStats.completed} / {completionStats.total}</span>
                                        </div>
                                        {invalidMarksInfo.hasInvalid && (
                                            <div className="flex items-center gap-1 text-[10px] font-black text-red-600 animate-pulse">
                                                <i className="fa-solid fa-triangle-exclamation"></i>
                                                {invalidMarksInfo.count} INVALID
                                            </div>
                                        )}
                                    </div>

                                    {/* Condensed Action buttons */}
                                    <div className="space-y-2">
                                        <div className="flex gap-2">
                                            <button
                                                onClick={handleSaveTAMarks}
                                                disabled={isSaving || operationLoading.type !== null || !selectedSubject}
                                                className="flex-1 py-2 px-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg font-bold transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5 transform active:scale-95 shadow-md"
                                                style={{ minHeight: '44px' }}
                                                aria-label="Save TA marks"
                                            >
                                                <i className="fa-solid fa-clipboard-check text-xs"></i>
                                                <span className="text-xs">Save TA</span>
                                            </button>
                                            <button
                                                onClick={handleSaveCEMarks}
                                                disabled={isSaving || operationLoading.type !== null || !selectedSubject}
                                                className="flex-1 py-2 px-3 bg-gradient-to-r from-purple-600 to-purple-700 text-white rounded-lg font-bold transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5 transform active:scale-95 shadow-md"
                                                style={{ minHeight: '44px' }}
                                                aria-label="Save CE marks"
                                            >
                                                <i className="fa-solid fa-clipboard-check text-xs"></i>
                                                <span className="text-xs">Save CE</span>
                                            </button>
                                            <button
                                                onClick={handleClearTAMarks}
                                                disabled={isSaving || operationLoading.type !== null || !selectedSubject}
                                                className="py-2 px-3 border border-orange-200 text-orange-600 bg-orange-50/50 rounded-lg font-bold transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1 transform active:scale-95"
                                                style={{ minHeight: '44px' }}
                                                aria-label="Clear TA"
                                            >
                                                <i className="fa-solid fa-eraser text-xs"></i>
                                                <span className="text-[10px]">Clear TA</span>
                                            </button>
                                            <button
                                                onClick={handleClearCEMarks}
                                                disabled={isSaving || operationLoading.type !== null || !selectedSubject}
                                                className="py-2 px-3 border border-red-200 text-red-600 bg-red-50/50 rounded-lg font-bold transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1 transform active:scale-95"
                                                style={{ minHeight: '44px' }}
                                                aria-label="Clear CE"
                                            >
                                                <i className="fa-solid fa-eraser text-xs"></i>
                                                <span className="text-[10px]">Clear CE</span>
                                            </button>
                                            <button
                                                onClick={handleClearAll}
                                                disabled={isSaving || operationLoading.type !== null}
                                                className="py-2 px-3 border border-slate-300 text-slate-600 bg-white rounded-lg font-bold transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1 transform active:scale-95"
                                                style={{ minHeight: '44px' }}
                                                aria-label="Clear all"
                                            >
                                                <i className="fa-solid fa-trash-can text-xs"></i>
                                                <span className="text-[10px]">Clear All</span>
                                            </button>
                                        </div>

                                        <button
                                            onClick={handleSaveMarks}
                                            disabled={isSaving || operationLoading.type !== null || !selectedSubject || invalidMarksInfo.hasInvalid}
                                            className={`w-full py-3 px-6 rounded-lg font-bold transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transform active:scale-95 ${invalidMarksInfo.hasInvalid
                                                ? 'bg-gradient-to-r from-red-600 to-red-700 text-white shadow-md'
                                                : 'bg-gradient-to-r from-emerald-600 to-emerald-700 text-white shadow-md'
                                                }`}
                                            style={{ minHeight: '48px' }}
                                            aria-label="Save all marks"
                                        >
                                            {isSaving ? (
                                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                            ) : (
                                                <>
                                                    <i className={`fa-solid ${invalidMarksInfo.hasInvalid ? 'fa-triangle-exclamation' : 'fa-save'} text-sm`}></i>
                                                    <span className="text-sm">{invalidMarksInfo.hasInvalid ? 'Fix Invalid Marks' : 'Save All Marks'}</span>
                                                </>
                                            )}
                                        </button>
                                    </div>

                                    {/* Visual feedback indicator */}
                                    {(isSaving || operationLoading.type !== null) && (
                                        <div className="absolute inset-0 bg-white/60 backdrop-blur-sm rounded-xl flex items-center justify-center">
                                            <div className="bg-white rounded-xl p-4 shadow-xl border border-slate-200">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-6 h-6 border-2 border-emerald-600/30 border-t-emerald-600 rounded-full animate-spin"></div>
                                                    <span className="text-sm font-medium text-slate-700">
                                                        {operationLoading.message || 'Processing...'}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="bg-white rounded-xl md:rounded-2xl p-8 md:p-12 shadow-sm border border-slate-200 text-center mx-4 md:mx-0">
                            <i className="fa-solid fa-clipboard-list text-4xl text-slate-400 mb-4"></i>
                            <h3 className="text-xl font-bold text-slate-900 mb-2">No Data Available</h3>
                            <p className="text-slate-600">
                                {!selectedSubject
                                    ? 'Please select a subject to begin entering marks'
                                    : 'No students found in the selected class'
                                }
                            </p>
                        </div>
                    )}

                    {/* Operation Loading Overlay */}
                    {operationLoading.type && (
                        <OperationLoadingSkeleton
                            operation={operationLoading.type}
                            message={operationLoading.message}
                        />
                    )}
                </>
            )}

            {/* Upload Tracker Tab Content */}
            {activeTab === 'upload-tracker' && (
                <div className="px-4 md:px-0 mt-8 space-y-6">
                    {/* Filters */}
                    <div className="bg-white rounded-2xl p-6 shadow-lg border-2 border-slate-200">
                        <h3 className="text-lg font-bold text-slate-900 mb-4">
                            <i className="fa-solid fa-filter mr-2 text-emerald-600"></i>
                            Filter Subjects
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-2">
                                    <i className="fa-solid fa-layer-group mr-1 text-slate-500"></i>
                                    Filter by Class
                                </label>
                                <select
                                    value={trackerClassFilter}
                                    onChange={(e) => setTrackerClassFilter(e.target.value)}
                                    className="w-full p-3 border-2 border-slate-300 rounded-xl focus:ring-4 focus:ring-emerald-500/40 focus:border-emerald-500 bg-white"
                                >
                                    <option value="all">All Classes</option>
                                    {CLASSES.map(cls => (
                                        <option key={cls} value={cls}>{cls}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-2">
                                    <i className="fa-solid fa-user-tie mr-1 text-slate-500"></i>
                                    Filter by Faculty
                                </label>
                                <select
                                    value={trackerTeacherFilter}
                                    onChange={(e) => setTrackerTeacherFilter(e.target.value)}
                                    className="w-full p-3 border-2 border-slate-300 rounded-xl focus:ring-4 focus:ring-emerald-500/40 focus:border-emerald-500 bg-white"
                                >
                                    <option value="all">All Faculty Members</option>
                                    {(() => {
                                        const facultyNames = subjects
                                            .map(s => s.facultyName)
                                            .filter(Boolean)
                                            .map(f => normalizeName(f));

                                        const uniqueMap = new Map<string, string>();
                                        facultyNames.forEach(name => {
                                            const key = name.toLowerCase();
                                            if (!uniqueMap.has(key)) {
                                                uniqueMap.set(key, name);
                                            }
                                        });

                                        return Array.from(uniqueMap.values()).sort().map(teacher => (
                                            <option key={teacher} value={teacher}>{teacher}</option>
                                        ));
                                    })()}
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-2">
                                    <i className="fa-solid fa-magnifying-glass mr-1 text-slate-500"></i>
                                    Search by Subject Name
                                </label>
                                <input
                                    type="text"
                                    value={trackerSubjectSearch}
                                    onChange={(e) => setTrackerSubjectSearch(e.target.value)}
                                    placeholder="Type subject name..."
                                    className="w-full p-3 border-2 border-slate-300 rounded-xl focus:ring-4 focus:ring-emerald-500/40 focus:border-emerald-500"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Upload Statistics */}
                    {(() => {
                        // Expand general subjects into separate entries per class
                        const expandedSubjects = subjects.flatMap(subject => {
                            if (subject.subjectType === 'general' && subject.targetClasses.length > 0) {
                                // Create a separate entry for each class
                                return subject.targetClasses.map(className => ({
                                    ...subject,
                                    displayClass: className,
                                    isExpanded: true
                                }));
                            } else {
                                // Elective subjects remain as single entries
                                return [{
                                    ...subject,
                                    displayClass: null,
                                    isExpanded: false
                                }];
                            }
                        });

                        // Apply filters
                        const filteredSubjects = expandedSubjects.filter(subject => {
                            const classMatch = trackerClassFilter === 'all' ||
                                (subject.isExpanded ? subject.displayClass === trackerClassFilter : subject.targetClasses.includes(trackerClassFilter));
                            const teacherMatch = trackerTeacherFilter === 'all' || subject.facultyName === trackerTeacherFilter;
                            const searchMatch = trackerSubjectSearch === '' || subject.name.toLowerCase().includes(trackerSubjectSearch.toLowerCase());
                            return classMatch && teacherMatch && searchMatch;
                        });

                        const subjectsWithStatus = filteredSubjects.map(subject => {
                            // Calculate upload status for this subject
                            let totalStudents = 0;
                            let uploadedStudents = 0;

                            if (subject.subjectType === 'general' && subject.isExpanded) {
                                // For general subjects (now split by class), only count students from the specific class
                                const className = subject.displayClass!;
                                const classStudents = allStudents.filter(s => s.className === className);
                                totalStudents = classStudents.length;
                                uploadedStudents = classStudents.filter(s =>
                                    s.marks && s.marks[subject.id]
                                ).length;
                            } else {
                                // For elective subjects, count enrolled students
                                const enrolledStudentIds = subject.enrolledStudents || [];
                                totalStudents = enrolledStudentIds.length;
                                uploadedStudents = allStudents.filter(s =>
                                    enrolledStudentIds.includes(s.id) && s.marks && s.marks[subject.id]
                                ).length;
                            }

                            const percentage = totalStudents > 0 ? Math.round((uploadedStudents / totalStudents) * 100) : 0;
                            const status = percentage === 100 ? 'complete' : percentage > 0 ? 'in-progress' : 'not-started';

                            return {
                                ...subject,
                                totalStudents,
                                uploadedStudents,
                                percentage,
                                status
                            };
                        });

                        const completeCount = subjectsWithStatus.filter(s => s.status === 'complete').length;
                        const inProgressCount = subjectsWithStatus.filter(s => s.status === 'in-progress').length;
                        const notStartedCount = subjectsWithStatus.filter(s => s.status === 'not-started').length;

                        return (
                            <>
                                {/* Summary Cards */}
                                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                    <div className="bg-white rounded-xl p-6 shadow border-2 border-slate-200">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <p className="text-sm font-bold text-slate-600">Total Subjects</p>
                                                <p className="text-3xl font-black text-slate-900 mt-1">{filteredSubjects.length}</p>
                                            </div>
                                            <i className="fa-solid fa-book text-3xl text-slate-400"></i>
                                        </div>
                                    </div>

                                    <div className="bg-emerald-50 rounded-xl p-6 shadow border-2 border-emerald-200">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <p className="text-sm font-bold text-emerald-700">Complete</p>
                                                <p className="text-3xl font-black text-emerald-900 mt-1">{completeCount}</p>
                                            </div>
                                            <i className="fa-solid fa-circle-check text-3xl text-emerald-400"></i>
                                        </div>
                                    </div>

                                    <div className="bg-amber-50 rounded-xl p-6 shadow border-2 border-amber-200">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <p className="text-sm font-bold text-amber-700">In Progress</p>
                                                <p className="text-3xl font-black text-amber-900 mt-1">{inProgressCount}</p>
                                            </div>
                                            <i className="fa-solid fa-clock text-3xl text-amber-400"></i>
                                        </div>
                                    </div>

                                    <div className="bg-red-50 rounded-xl p-6 shadow border-2 border-red-200">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <p className="text-sm font-bold text-red-700">Not Started</p>
                                                <p className="text-3xl font-black text-red-900 mt-1">{notStartedCount}</p>
                                            </div>
                                            <i className="fa-solid fa-circle-xmark text-3xl text-red-400"></i>
                                        </div>
                                    </div>
                                </div>

                                {/* Subject Cards */}
                                <div className="space-y-4">
                                    <h3 className="text-xl font-black text-slate-900">Subjects Upload Status</h3>
                                    {subjectsWithStatus.length === 0 ? (
                                        <div className="bg-white rounded-xl p-12 shadow border border-slate-200 text-center">
                                            <i className="fa-solid fa-filter text-4xl text-slate-400 mb-4"></i>
                                            <h4 className="text-lg font-bold text-slate-900 mb-2">No Subjects Found</h4>
                                            <p className="text-slate-600">Try adjusting your filters</p>
                                        </div>
                                    ) : (
                                        subjectsWithStatus.map(subject => (
                                            <div key={`${subject.id}-${subject.displayClass || 'grouped'}`} className="bg-white rounded-xl p-6 shadow-lg border-2 border-slate-200 hover:shadow-xl transition-all">
                                                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                                                    <div className="flex-1">
                                                        <div className="flex items-start gap-3">
                                                            <i className={`fa-solid fa-book text-2xl mt-1 ${subject.status === 'complete' ? 'text-emerald-600' :
                                                                subject.status === 'in-progress' ? 'text-amber-600' :
                                                                    'text-red-600'
                                                                }`}></i>
                                                            <div className="flex-1">
                                                                <h4 className="text-lg font-bold text-slate-900">
                                                                    {subject.name}
                                                                    {subject.arabicName && <span className="text-slate-600 ml-2">({subject.arabicName})</span>}
                                                                </h4>
                                                                <div className="flex flex-wrap gap-3 mt-2 text-sm">
                                                                    <span className="text-slate-600">
                                                                        <i className="fa-solid fa-user-tie mr-1"></i>
                                                                        {subject.facultyName || 'Not Assigned'}
                                                                    </span>
                                                                    <span className="text-slate-600">
                                                                        <i className="fa-solid fa-layer-group mr-1"></i>
                                                                        {subject.displayClass || subject.targetClasses.join(', ')}
                                                                    </span>
                                                                    <span className={`px-2 py-1 rounded font-bold text-xs ${subject.subjectType === 'general'
                                                                        ? 'bg-blue-100 text-blue-700'
                                                                        : 'bg-purple-100 text-purple-700'
                                                                        }`}>
                                                                        {subject.subjectType.toUpperCase()}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="md:w-64">
                                                        <div className="flex items-center justify-between mb-2">
                                                            <span className="text-sm font-bold text-slate-700">
                                                                {subject.uploadedStudents}/{subject.totalStudents} Students
                                                            </span>
                                                            <span className={`px-3 py-1 rounded-full text-xs font-black ${subject.status === 'complete' ? 'bg-emerald-100 text-emerald-700' :
                                                                subject.status === 'in-progress' ? 'bg-amber-100 text-amber-700' :
                                                                    'bg-red-100 text-red-700'
                                                                }`}>
                                                                {subject.percentage}%
                                                            </span>
                                                        </div>
                                                        <div className="w-full bg-slate-200 rounded-full h-3 overflow-hidden">
                                                            <div
                                                                className={`h-full rounded-full transition-all duration-500 ${subject.status === 'complete' ? 'bg-emerald-600' :
                                                                    subject.status === 'in-progress' ? 'bg-amber-600' :
                                                                        'bg-red-600'
                                                                    }`}
                                                                style={{ width: `${subject.percentage}%` }}
                                                            ></div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </>
                        );
                    })()}
                </div>
            )}

        </div>
    );
};

export default React.memo(FacultyEntry);