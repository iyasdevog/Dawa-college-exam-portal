import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { StudentRecord, SubjectConfig } from '../types';
import { CLASSES } from '../constants';
import { dataService } from '../services/dataService';
import {
    MobileFacultyEntrySkeleton,
    DesktopTableSkeleton,
    ProgressiveLoadingSkeleton,
    OperationLoadingSkeleton
} from './SkeletonLoaders';
import { useDebounce } from '../hooks/useDebounce';
import { useOfflineCapability } from '../hooks/useOfflineCapability';
import OfflineStatusIndicator from './OfflineStatusIndicator';
import DraftRecoveryModal from './DraftRecoveryModal';

// Performance monitoring stubs
const measureAsyncOperation = async (fn: () => Promise<void>, label?: string) => await fn();
const measureInputLag = (id: string, type: string, context: string) => () => { };
const recordCustomMetric = (name: string, value: number) => { };
const lazyLoading = { checkAutoLoad: (index: number) => { } };
const isMonitoring = false;
const interactionCount = 0;
const isHighMemory = false;
const memoryInfo = null;

const FacultyEntry: React.FC = () => {
    const [selectedClass, setSelectedClass] = useState('S1');
    const [selectedSubject, setSelectedSubject] = useState('');
    const [students, setStudents] = useState<StudentRecord[]>([]);
    const [subjects, setSubjects] = useState<SubjectConfig[]>([]);
    const [classSubjects, setClassSubjects] = useState<SubjectConfig[]>([]);
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
    const pageSize = 10;
    const paginatedStudents = students.slice(0, currentPage * pageSize);
    const hasMore = students.length > currentPage * pageSize;

    // Touch/swipe gesture state
    const [touchStart, setTouchStart] = useState<{ x: number; y: number } | null>(null);
    const [touchEnd, setTouchEnd] = useState<{ x: number; y: number } | null>(null);

    // Sticky action buttons state
    const [showScrollToTop, setShowScrollToTop] = useState(false);
    const [isScrolling, setIsScrolling] = useState(false);
    const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Draft recovery state
    const [showDraftRecovery, setShowDraftRecovery] = useState(false);

    // Offline capability integration
    const [offlineState, offlineActions] = useOfflineCapability({
        autoSaveInterval: 5000, // Auto-save every 5 seconds
        enableAutoSync: true,
        enableDraftRecovery: true
    });

    // Load initial data
    useEffect(() => {
        loadData();
    }, []);

    // Update class subjects when class changes
    useEffect(() => {
        const filteredSubjects = subjects.filter(s => s.targetClasses.includes(selectedClass));
        setClassSubjects(filteredSubjects);

        if (filteredSubjects.length > 0 && !selectedSubject) {
            setSelectedSubject(filteredSubjects[0].id);
        }
    }, [selectedClass, subjects, selectedSubject]);

    // Load students when class or subject changes
    useEffect(() => {
        if (selectedClass) {
            loadStudentsByClass();
        }
    }, [selectedClass, selectedSubject]);

    // Reset current student index when students change
    useEffect(() => {
        setCurrentStudentIndex(0);
    }, [students]);

    // Load drafts when students or subject changes
    useEffect(() => {
        if (selectedSubject && students.length > 0) {
            loadDraftsForCurrentSubject();
        }
    }, [selectedSubject, students, offlineState.drafts]);

    // Auto-save drafts when marks data changes
    useEffect(() => {
        if (selectedSubject && students.length > 0) {
            autoSaveCurrentDrafts();
        }
    }, [marksData, selectedSubject, students]);

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
        if (!selectedSubject || students.length === 0) return;

        try {
            const updatedMarksData = { ...marksData };
            let hasUpdates = false;

            for (const student of students) {
                const draft = offlineActions.getDraftForStudent(student.id, selectedSubject);
                if (draft && (!marksData[student.id]?.ta && !marksData[student.id]?.ce)) {
                    // Only load draft if no current data exists
                    updatedMarksData[student.id] = {
                        ta: draft.ta,
                        ce: draft.ce
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
    }, [selectedSubject, students, marksData, offlineActions]);

    // Auto-save current drafts
    const autoSaveCurrentDrafts = useCallback(async () => {
        if (!selectedSubject || students.length === 0) return;

        try {
            for (const student of students) {
                const marks = marksData[student.id];
                if (marks && (marks.ta || marks.ce)) {
                    // Only auto-save if there's actual data
                    const selectedSubjectData = subjects.find(s => s.id === selectedSubject);
                    if (selectedSubjectData) {
                        await offlineActions.saveDraft(
                            student.id,
                            selectedSubject,
                            marks.ta || '',
                            marks.ce || '',
                            student.name,
                            selectedSubjectData.name,
                            student.className
                        );
                    }
                }
            }
        } catch (error) {
            console.error('FacultyEntry: Auto-save failed:', error);
        }
    }, [selectedSubject, students, marksData, subjects, offlineActions]);

    // Handle draft recovery
    const handleRecoverDraft = useCallback(async (draft: any) => {
        try {
            // Update marks data with draft values
            setMarksData(prev => ({
                ...prev,
                [draft.studentId]: {
                    ta: draft.ta,
                    ce: draft.ce
                }
            }));

            // Navigate to the student if not currently visible
            const studentIndex = students.findIndex(s => s.id === draft.studentId);
            if (studentIndex !== -1) {
                setCurrentStudentIndex(studentIndex);
            }

            // Close the modal
            setShowDraftRecovery(false);

            console.log('FacultyEntry: Draft recovered successfully:', draft.id);
        } catch (error) {
            console.error('FacultyEntry: Failed to recover draft:', error);
        }
    }, [students]);

    // Handle draft deletion
    const handleDeleteDraft = useCallback(async (draftId: string) => {
        try {
            await offlineActions.deleteDraft(draftId);
            console.log('FacultyEntry: Draft deleted:', draftId);
        } catch (error) {
            console.error('FacultyEntry: Failed to delete draft:', error);
        }
    }, [offlineActions]);

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
            // Auto-load more students if approaching the end
            lazyLoading.checkAutoLoad(index);
        }
    }, [students.length, lazyLoading]);

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

    const loadData = async () => {
        try {
            setIsLoading(true);
            setLoadingStage('initializing');
            setLoadingProgress(0);

            // Measure data loading performance
            await measureAsyncOperation(async () => {
                // Simulate initialization delay for better UX
                await new Promise(resolve => setTimeout(resolve, 500));
                setLoadingProgress(25);

                setLoadingStage('loading-subjects');
                const [allSubjects] = await Promise.all([
                    dataService.getAllSubjects()
                ]);
                setLoadingProgress(75);

                setSubjects(allSubjects);
                setLoadingProgress(90);

                setLoadingStage('preparing-interface');
                // Small delay to show the final stage
                await new Promise(resolve => setTimeout(resolve, 300));
                setLoadingProgress(100);
            }, 'Initial Data Loading');

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
        try {
            setOperationLoading({ type: 'loading-students', message: 'Fetching student records for selected class and subject...' });

            // Measure student loading performance
            await measureAsyncOperation(async () => {
                let studentsToShow: StudentRecord[] = [];

                if (selectedSubject) {
                    console.log('=== DEBUGGING STUDENT LOADING ===');
                    console.log('Selected Subject ID:', selectedSubject);
                    console.log('Selected Class:', selectedClass);
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
                        studentsToShow = await dataService.getEnrolledStudentsForSubject(selectedSubject);
                        console.log('Total enrolled students found:', studentsToShow.length);
                        console.log('Students before class filter:', studentsToShow.map(s => ({ name: s.name, class: s.className })));

                        // Filter by selected class
                        studentsToShow = studentsToShow.filter(student => student.className === selectedClass);
                        console.log('Students after class filter:', studentsToShow.length);
                        console.log('Final students:', studentsToShow.map(s => ({ name: s.name, class: s.className })));
                    }
                } else {
                    console.log('No subject selected, getting all students from class...');
                    // If no subject selected, get all students from class
                    studentsToShow = await dataService.getStudentsByClass(selectedClass);
                    console.log('Students from class:', studentsToShow.length);
                }

                setStudents(studentsToShow);

                // Initialize marks data with existing marks
                const initialMarks: Record<string, { ta: string; ce: string }> = {};
                studentsToShow.forEach(student => {
                    const existingMarks = student.marks[selectedSubject];
                    initialMarks[student.id] = {
                        ta: existingMarks?.ta?.toString() || '',
                        ce: existingMarks?.ce?.toString() || ''
                    };
                });
                setMarksData(initialMarks);
            }, `Student Loading - ${selectedClass} - ${selectedSubject}`);

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

    // Debounced marks change handler for better performance with input lag measurement
    const handleMarksChange = useCallback((studentId: string, field: 'ta' | 'ce', value: string) => {
        // Measure input performance
        const endMeasurement = measureInputLag(`${studentId}-${field}`, 'keyboard', 'marks-input');

        // Only allow numeric input
        if (value && !/^\d*$/.test(value)) {
            endMeasurement();
            return;
        }

        // Get subject data for validation
        const subject = subjects.find(s => s.id === selectedSubject);
        if (subject && value) {
            const numValue = parseInt(value);
            const maxValue = field === 'ta' ? subject.maxTA : subject.maxCE;

            // Don't allow values greater than max
            if (numValue > maxValue) {
                endMeasurement();
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

        endMeasurement();
        recordCustomMetric('marks-input-processing', performance.now());
    }, [subjects, selectedSubject, measureInputLag, recordCustomMetric]);



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

            // Measure save operation performance
            await measureAsyncOperation(async () => {
                // Save marks for each student
                const savePromises = students.map(async (student) => {
                    const marks = marksData[student.id];
                    if (marks && marks.ta && marks.ce) {
                        const ta = parseInt(marks.ta);
                        const ce = parseInt(marks.ce);

                        // Validate marks against subject limits (double-check)
                        const subject = subjects.find(s => s.id === selectedSubject);
                        if (subject) {
                            if (ta > subject.maxTA) {
                                throw new Error(`TA marks for ${student.name} exceed maximum (${subject.maxTA})`);
                            }
                            if (ce > subject.maxCE) {
                                throw new Error(`CE marks for ${student.name} exceed maximum (${subject.maxCE})`);
                            }
                        }

                        try {
                            // Try to save online first
                            await dataService.updateStudentMarks(student.id, selectedSubject, ta, ce);

                            // If successful, delete any corresponding draft
                            const draft = offlineActions.getDraftForStudent(student.id, selectedSubject);
                            if (draft) {
                                await offlineActions.deleteDraft(draft.id);
                            }
                        } catch (error) {
                            console.warn('Online save failed, saving offline:', error);

                            // If online save fails, save offline
                            const selectedSubjectData = subjects.find(s => s.id === selectedSubject);
                            if (selectedSubjectData) {
                                await offlineActions.saveMarksOffline(
                                    student.id,
                                    selectedSubject,
                                    ta,
                                    ce,
                                    student.name,
                                    selectedSubjectData.name,
                                    student.className
                                );
                            }
                        }
                    }
                });

                await Promise.all(savePromises);

                // Try to reload students to get updated data (only if online)
                if (offlineState.isOnline) {
                    await loadStudentsByClass();
                }
            }, `Save Marks - ${students.length} students`);

            // Show appropriate success message
            if (offlineState.isOnline) {
                alert('Marks saved successfully!');
            } else {
                alert('Marks saved offline! They will sync when you\'re back online.');
            }
        } catch (error) {
            console.error('Error saving marks:', error);
            alert(`Error saving marks: ${error instanceof Error ? error.message : 'Unknown error'}`);
        } finally {
            setOperationLoading({ type: null });
        }
    }, [selectedSubject, invalidMarksInfo, students, marksData, subjects, loadStudentsByClass, measureAsyncOperation, offlineState.isOnline, offlineActions]);

    // New handler for saving only TA marks
    const handleSaveTAMarks = useCallback(async () => {
        if (!selectedSubject) {
            alert('Please select a subject');
            return;
        }

        try {
            setOperationLoading({ type: 'saving', message: 'Saving TA marks to database...' });

            // Measure save operation performance
            await measureAsyncOperation(async () => {
                // Save TA marks for students who have TA entered
                const savePromises = students.map(async (student) => {
                    const marks = marksData[student.id];
                    if (marks && marks.ta) {
                        const ta = parseInt(marks.ta);

                        // Validate TA marks against subject limits
                        const subject = subjects.find(s => s.id === selectedSubject);
                        if (subject && ta > subject.maxTA) {
                            throw new Error(`TA marks for ${student.name} exceed maximum (${subject.maxTA})`);
                        }

                        try {
                            // Try to save online first
                            await dataService.updateStudentTAMarks(student.id, selectedSubject, ta);

                            // Update draft with TA marks
                            const selectedSubjectData = subjects.find(s => s.id === selectedSubject);
                            if (selectedSubjectData) {
                                await offlineActions.saveDraft(
                                    student.id,
                                    selectedSubject,
                                    marks.ta,
                                    marks.ce || '',
                                    student.name,
                                    selectedSubjectData.name,
                                    student.className
                                );
                            }
                        } catch (error) {
                            console.warn('Online TA save failed, saving offline:', error);

                            // If online save fails, save offline
                            const selectedSubjectData = subjects.find(s => s.id === selectedSubject);
                            if (selectedSubjectData) {
                                await offlineActions.saveMarksOffline(
                                    student.id,
                                    selectedSubject,
                                    ta,
                                    parseInt(marks.ce || '0'),
                                    student.name,
                                    selectedSubjectData.name,
                                    student.className
                                );
                            }
                        }
                    }
                });

                await Promise.all(savePromises);

                // Try to reload students to get updated data (only if online)
                if (offlineState.isOnline) {
                    await loadStudentsByClass();
                }
            }, `Save TA Marks - ${students.length} students`);

            // Show appropriate success message
            const studentsWithTA = students.filter(s => marksData[s.id]?.ta).length;
            if (offlineState.isOnline) {
                alert(`TA marks saved successfully for ${studentsWithTA} students!`);
            } else {
                alert(`TA marks saved offline for ${studentsWithTA} students! They will sync when you're back online.`);
            }
        } catch (error) {
            console.error('Error saving TA marks:', error);
            alert(`Error saving TA marks: ${error instanceof Error ? error.message : 'Unknown error'}`);
        } finally {
            setOperationLoading({ type: null });
        }
    }, [selectedSubject, students, marksData, subjects, loadStudentsByClass, measureAsyncOperation, offlineState.isOnline, offlineActions]);

    // New handler for saving only CE marks
    const handleSaveCEMarks = useCallback(async () => {
        if (!selectedSubject) {
            alert('Please select a subject');
            return;
        }

        try {
            setOperationLoading({ type: 'saving', message: 'Saving CE marks to database...' });

            // Measure save operation performance
            await measureAsyncOperation(async () => {
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

                            // Update draft with CE marks
                            const selectedSubjectData = subjects.find(s => s.id === selectedSubject);
                            if (selectedSubjectData) {
                                await offlineActions.saveDraft(
                                    student.id,
                                    selectedSubject,
                                    marks.ta || '',
                                    marks.ce,
                                    student.name,
                                    selectedSubjectData.name,
                                    student.className
                                );
                            }
                        } catch (error) {
                            console.warn('Online CE save failed, saving offline:', error);

                            // If online save fails, save offline
                            const selectedSubjectData = subjects.find(s => s.id === selectedSubject);
                            if (selectedSubjectData) {
                                await offlineActions.saveMarksOffline(
                                    student.id,
                                    selectedSubject,
                                    parseInt(marks.ta || '0'),
                                    ce,
                                    student.name,
                                    selectedSubjectData.name,
                                    student.className
                                );
                            }
                        }
                    }
                });

                await Promise.all(savePromises);

                // Try to reload students to get updated data (only if online)
                if (offlineState.isOnline) {
                    await loadStudentsByClass();
                }
            }, `Save CE Marks - ${students.length} students`);

            // Show appropriate success message
            const studentsWithCE = students.filter(s => marksData[s.id]?.ce).length;
            if (offlineState.isOnline) {
                alert(`CE marks saved successfully for ${studentsWithCE} students!`);
            } else {
                alert(`CE marks saved offline for ${studentsWithCE} students! They will sync when you're back online.`);
            }
        } catch (error) {
            console.error('Error saving CE marks:', error);
            alert(`Error saving CE marks: ${error instanceof Error ? error.message : 'Unknown error'}`);
        } finally {
            setOperationLoading({ type: null });
        }
    }, [selectedSubject, students, marksData, subjects, loadStudentsByClass, measureAsyncOperation, offlineState.isOnline, offlineActions]);

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
            </div>

            {/* Mobile-Optimized Selection Controls */}
            <div className="bg-white rounded-2xl md:rounded-3xl p-6 md:p-8 shadow-xl border-2 border-slate-200 mx-6 md:mx-0 print:hidden" style={{
                background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
                boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
            }}>
                <div className="space-y-4 md:space-y-0 md:grid md:grid-cols-2 md:gap-6">
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

                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <label className="block text-sm font-bold text-slate-700">Subject</label>
                            {/* Offline Status Indicator */}
                            <OfflineStatusIndicator
                                showDetails={true}
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

                {/* Performance Monitoring Controls */}
                {process.env.NODE_ENV === 'development' && (
                    <div className="mt-4 p-3 bg-gradient-to-r from-purple-50 to-purple-100 border border-purple-200 rounded-xl">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-3 h-3 rounded-full bg-purple-500 animate-pulse"></div>
                                <div>
                                    <div className="text-sm font-bold text-purple-800">Performance Monitor</div>
                                    <div className="text-xs text-purple-600">
                                        {isMonitoring ? 'Active' : 'Inactive'} • {interactionCount} interactions
                                        {isHighMemory && ' • High Memory Usage'}
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                {memoryInfo && (
                                    <div className="text-xs text-purple-700 font-mono">
                                        {memoryInfo.percentage.toFixed(1)}% RAM
                                    </div>
                                )}
                            </div>
                        </div>

                    </div>
                )}

                {/* Draft Recovery Controls */}
                {offlineState.drafts.length > 0 && (
                    <div className="mt-4 p-3 bg-gradient-to-r from-blue-50 to-blue-100 border border-blue-200 rounded-xl">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-3 h-3 rounded-full bg-blue-500 animate-pulse"></div>
                                <div>
                                    <div className="text-sm font-bold text-blue-800">Draft Recovery Available</div>
                                    <div className="text-xs text-blue-600">
                                        {offlineState.drafts.length} unsaved draft(s) found
                                    </div>
                                </div>
                            </div>
                            <button
                                onClick={() => setShowDraftRecovery(true)}
                                className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg transition-colors duration-200"
                                title="Recover Drafts"
                            >
                                <i className="fa-solid fa-download mr-1"></i>
                                Recover Drafts
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Mobile-Optimized Marks Entry */}
            {selectedSubject && students.length > 0 ? (
                <div className="mx-6 md:mx-0 print:hidden">
                    {/* Mobile Card View */}
                    <div className="block md:hidden space-y-8 pb-32">{/* Added bottom padding for sticky buttons */}
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
                                        showDetails={false}
                                        className="md:hidden block"
                                    />
                                </div>
                                <div className="flex items-center gap-4">
                                    {/* Quick Access Button */}
                                    <button
                                        onClick={() => setShowStudentList(!showStudentList)}
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

                                    {/* Overall Progress Bar */}
                                    <div className="mb-3">
                                        <div className="flex items-center justify-between text-xs text-slate-600 mb-1">
                                            <span>Overall Progress</span>
                                            <span>{completionStats.percentage}%</span>
                                        </div>
                                        <div className="w-full bg-slate-200 rounded-full h-2">
                                            <div
                                                className="bg-emerald-500 h-2 rounded-full transition-all duration-500 ease-out"
                                                style={{ width: `${completionStats.percentage}%` }}
                                            ></div>
                                        </div>
                                        <div className="flex items-center justify-between text-xs text-slate-500 mt-1">
                                            <span>{completionStats.completed} completed</span>
                                            <span>{completionStats.remaining} remaining</span>
                                        </div>
                                    </div>

                                    {/* Quick Jump Indicators */}
                                    <div className="flex items-center justify-center gap-1 overflow-x-auto pb-2" role="tablist" aria-label="Quick student navigation">
                                        {students.map((student, index) => {
                                            const isCompleted = marksData[student.id]?.ta && marksData[student.id]?.ce;
                                            const isCurrent = index === currentStudentIndex;

                                            return (
                                                <button
                                                    key={student.id}
                                                    onClick={() => navigateToStudent(index)}
                                                    className={`flex-shrink-0 w-8 h-8 rounded-full text-xs font-medium transition-all duration-200 transform hover:scale-110 active:scale-95 ${isCurrent
                                                        ? 'bg-blue-500 text-white ring-2 ring-blue-300 ring-offset-2'
                                                        : isCompleted
                                                            ? 'bg-emerald-500 text-white hover:bg-emerald-600'
                                                            : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                                                        }`}
                                                    title={`${student.name} - ${isCompleted ? 'Completed' : 'Pending'}`}
                                                    style={{ minHeight: '44px', minWidth: '44px' }}
                                                    role="tab"
                                                    aria-selected={isCurrent}
                                                    aria-label={`Student ${index + 1}: ${student.name}, ${isCompleted ? 'completed' : 'pending'}`}
                                                >
                                                    {index + 1}
                                                </button>
                                            );
                                        })}
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
                                    className={`bg-slate-50 rounded-xl p-4 transition-all ${isCurrent ? 'ring-2 ring-emerald-500 bg-emerald-50' : ''}`}
                                >
                                    <div className="flex items-center justify-between mb-3">
                                        <div>
                                            <h3 className="font-bold text-slate-900">{student.name}</h3>
                                            <p className="text-sm text-slate-600">Adm: {student.adNo}</p>
                                        </div>
                                        <span className="text-xs text-slate-500">
                                            {index + 1} of {students.length}
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
                                                className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                                                max={selectedSubjectData?.maxCE}
                                                min="0"
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
                                className="w-full p-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-all"
                            >
                                Load More ({students.length - paginatedStudents.length} remaining)
                            </button>
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
                        <div className="relative p-4 pb-6">
                            {/* Scroll to top button */}
                            {showScrollToTop && (
                                <div className="flex justify-center mb-4">
                                    <button
                                        onClick={scrollToTop}
                                        className="flex items-center justify-center w-12 h-12 bg-slate-600 hover:bg-slate-700 active:bg-slate-800 text-white rounded-full shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-110 active:scale-95"
                                        title="Scroll to top"
                                        style={{
                                            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(0, 0, 0, 0.05)'
                                        }}
                                    >
                                        <i className="fa-solid fa-chevron-up text-lg"></i>
                                    </button>
                                </div>
                            )}

                            {/* Status display */}
                            <div className="text-center mb-4">
                                <div className="text-lg font-black text-slate-900 mb-1">
                                    {completionStats.completed} of {completionStats.total}
                                </div>
                                <div className="text-sm text-slate-600 font-semibold">students completed</div>
                                {invalidMarksInfo.hasInvalid && (
                                    <div className="mt-3 p-3 bg-gradient-to-r from-red-50 to-red-100 border-2 border-red-300 rounded-xl shadow-md">
                                        <div className="flex items-center justify-center gap-2">
                                            <i className="fa-solid fa-exclamation-triangle text-red-600 text-sm animate-pulse"></i>
                                            <span className="text-sm font-bold text-red-700">
                                                {invalidMarksInfo.count} student(s) have invalid marks
                                            </span>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Enhanced Action buttons with separate TA/CE save options */}
                            <div className="space-y-3">
                                {/* Primary save buttons row */}
                                <div className="flex gap-2">
                                    <button
                                        onClick={handleSaveTAMarks}
                                        disabled={isSaving || operationLoading.type !== null || !selectedSubject}
                                        className="flex-1 py-3 px-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl font-bold transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transform active:scale-95 hover:from-blue-700 hover:to-blue-800 hover:shadow-lg"
                                        style={{
                                            minHeight: '48px',
                                            boxShadow: '0 4px 6px -1px rgba(37, 99, 235, 0.3)'
                                        }}
                                        aria-label="Save TA marks only"
                                    >
                                        <i className="fa-solid fa-clipboard-check text-sm"></i>
                                        <span className="text-sm">Save TA</span>
                                    </button>

                                    <button
                                        onClick={handleSaveCEMarks}
                                        disabled={isSaving || operationLoading.type !== null || !selectedSubject}
                                        className="flex-1 py-3 px-4 bg-gradient-to-r from-purple-600 to-purple-700 text-white rounded-xl font-bold transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transform active:scale-95 hover:from-purple-700 hover:to-purple-800 hover:shadow-lg"
                                        style={{
                                            minHeight: '48px',
                                            boxShadow: '0 4px 6px -1px rgba(147, 51, 234, 0.3)'
                                        }}
                                        aria-label="Save CE marks only"
                                    >
                                        <i className="fa-solid fa-clipboard-check text-sm"></i>
                                        <span className="text-sm">Save CE</span>
                                    </button>

                                    <button
                                        onClick={handleClearAll}
                                        disabled={isSaving || operationLoading.type !== null}
                                        className="flex-1 py-3 px-4 border-2 border-slate-400 text-slate-700 bg-white rounded-xl font-bold transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed transform active:scale-95 hover:bg-slate-50 hover:border-slate-500 hover:shadow-lg"
                                        style={{
                                            minHeight: '48px',
                                            boxShadow: '0 2px 4px -1px rgba(0, 0, 0, 0.1)'
                                        }}
                                        aria-label="Clear all marks"
                                    >
                                        <i className="fa-solid fa-trash-can text-sm"></i>
                                        <span className="text-sm">Clear</span>
                                    </button>
                                </div>

                                {/* Main save all button */}
                                <button
                                    onClick={handleSaveMarks}
                                    disabled={isSaving || operationLoading.type !== null || !selectedSubject || invalidMarksInfo.hasInvalid}
                                    className={`w-full py-4 px-6 rounded-xl font-bold transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 transform active:scale-95 ${invalidMarksInfo.hasInvalid
                                        ? 'bg-gradient-to-r from-red-600 to-red-700 text-white hover:from-red-700 hover:to-red-800 active:from-red-800 active:to-red-900 hover:shadow-xl active:shadow-inner'
                                        : 'bg-gradient-to-r from-emerald-600 to-emerald-700 text-white hover:from-emerald-700 hover:to-emerald-800 active:from-emerald-800 active:to-emerald-900 hover:shadow-xl active:shadow-inner'
                                        }`}
                                    style={{
                                        minHeight: '56px',
                                        boxShadow: invalidMarksInfo.hasInvalid
                                            ? '0 10px 25px -5px rgba(220, 38, 38, 0.4), 0 4px 6px -1px rgba(220, 38, 38, 0.1)'
                                            : '0 10px 25px -5px rgba(16, 185, 129, 0.4), 0 4px 6px -1px rgba(16, 185, 129, 0.1)'
                                    }}
                                    aria-label="Save all marks (both TA and CE)"
                                >
                                    {isSaving ? (
                                        <>
                                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                            <span>Saving...</span>
                                        </>
                                    ) : invalidMarksInfo.hasInvalid ? (
                                        <>
                                            <i className="fa-solid fa-exclamation-triangle text-base"></i>
                                            <span>Fix Invalid Marks</span>
                                        </>
                                    ) : (
                                        <>
                                            <i className="fa-solid fa-save text-base"></i>
                                            <span>Save All Marks</span>
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

            {/* Draft Recovery Modal */}
            <DraftRecoveryModal
                isVisible={showDraftRecovery}
                drafts={offlineState.drafts}
                onRecoverDraft={handleRecoverDraft}
                onDeleteDraft={handleDeleteDraft}
                onClose={() => setShowDraftRecovery(false)}
                currentSubjectId={selectedSubject}
            />
        </div>
    );
};

// Export the component with React.memo for performance optimization
export default React.memo(FacultyEntry);