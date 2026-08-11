import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { StudentRecord, SubjectConfig, SubjectMarks } from '../../domain/entities/types';
import { dataService } from '../../infrastructure/services/dataService';
import { useOfflineCapability } from './useOfflineCapability';
import { useDebounce } from './useDebounce';

interface UseFacultyEntryParams {
    students: StudentRecord[];
    subjects: SubjectConfig[];
    selectedSubject: string;
    selectedClass: string;
    activeTerm: string;
    isOnline: boolean;
    loadStudentsByClass: () => Promise<void>;
}

export const useFacultyEntry = ({
    students,
    subjects,
    selectedSubject,
    selectedClass,
    activeTerm,
    isOnline,
    loadStudentsByClass
}: UseFacultyEntryParams) => {
    const [marksData, setMarksData] = useState<Record<string, { int: string; ext: string }>>({});
    const [currentStudentIndex, setCurrentStudentIndex] = useState(0);
    const [operationLoading, setOperationLoading] = useState<{
        type: 'saving' | 'clearing' | 'loading-students' | 'validating' | null;
        message?: string;
    }>({ type: null });

    // UI States moved from main component
    const [showStudentList, setShowStudentList] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const debouncedSearchQuery = useDebounce(searchQuery, 300);
    const [currentPage, setCurrentPage] = useState(1);
    const pageSize = 50;

    const [showScrollToTop, setShowScrollToTop] = useState(false);
    const [isScrolling, setIsScrolling] = useState(false);
    const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    const { saveDraft, getDraft, deleteDraft } = useOfflineCapability();

    // Initialize marks data when students change
    useEffect(() => {
        if (!selectedSubject || !students.length) {
            setMarksData({});
            return;
        }
        
        const initialMarks: Record<string, { int: string; ext: string }> = {};
        students.forEach(student => {
            const m = student.marks?.[selectedSubject];
            initialMarks[student.id] = {
                int: m?.int === 'A' ? 'A' : (m?.int !== undefined && m?.int !== null && m?.int !== 0 ? String(m.int) : (m?.int === 0 ? '0' : '')),
                ext: m?.ext === 'A' ? 'A' : (m?.ext !== undefined && m?.ext !== null && m?.ext !== 0 ? String(m.ext) : (m?.ext === 0 ? '0' : ''))
            };
        });
        setMarksData(initialMarks);
    }, [students, selectedSubject]);

    // Filtering logic
    const filteredStudents = useMemo(() => {
        if (!debouncedSearchQuery) return students;
        return students.filter(student =>
            student.name.toLowerCase().includes(debouncedSearchQuery.toLowerCase()) ||
            student.adNo.toString().includes(debouncedSearchQuery)
        );
    }, [students, debouncedSearchQuery]);

    const paginatedStudents = useMemo(() => {
        return filteredStudents.slice(0, currentPage * pageSize);
    }, [filteredStudents, currentPage]);

    const hasMore = filteredStudents.length > currentPage * pageSize;

    // Scroll handling
    useEffect(() => {
        const handleScroll = () => {
            setIsScrolling(true);
            setShowScrollToTop(window.scrollY > 300);
            if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
            scrollTimeoutRef.current = setTimeout(() => setIsScrolling(false), 150);
        };
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    const scrollToTop = () => window.scrollTo({ top: 0, behavior: 'smooth' });

    const jumpToStudent = (studentId: string) => {
        const index = students.findIndex(s => s.id === studentId);
        if (index !== -1) {
            setCurrentStudentIndex(index);
            setShowStudentList(false);
        }
    };

    const navigateToNext = () => {
        if (currentStudentIndex < students.length - 1) {
            setCurrentStudentIndex(prev => prev + 1);
        }
    };

    const navigateToPrevious = () => {
        if (currentStudentIndex > 0) {
            setCurrentStudentIndex(prev => prev - 1);
        }
    };

    const currentSubject = useMemo(() => {
        if (!selectedSubject || !subjects.length) return undefined;
        return subjects.find(s => s.id === selectedSubject);
    }, [subjects, selectedSubject]);

    // Validation helpers - Refactored to separate logic from direct state dependency where possible
    const validationHelpers = useMemo(() => {
        if (!currentSubject) return null;

        const maxINT = currentSubject.maxINT;
        const maxEXT = currentSubject.maxEXT;
        const minINT = Math.ceil(maxINT * 0.5);
        const minEXT = Math.ceil(maxEXT * 0.4);

        return {
            maxINT,
            maxEXT,
            minINT,
            minEXT,
            calculateTotal: (int: string, ext: string) => {
                const intVal = int === 'A' ? 0 : (parseInt(int, 10) || 0);
                const extVal = ext === 'A' ? 0 : (parseInt(ext, 10) || 0);
                return intVal + extVal;
            },
            getStatus: (int: string, ext: string) => {
                if (!int && !ext) return 'Pending';
                const iVal = int === 'A' ? 0 : (parseInt(int, 10) || 0);
                const eVal = ext === 'A' ? 0 : (parseInt(ext, 10) || 0);
                const passedINT = int === 'A' ? false : iVal >= minINT;
                const passedEXT = ext === 'A' ? false : eVal >= minEXT;
                return (passedINT && passedEXT) ? 'Passed' : 'Failed';
            }
        };
    }, [currentSubject]);

    const invalidMarksInfo = useMemo(() => {
        if (!validationHelpers || !students.length) return { hasInvalid: false, count: 0 };
        const { maxINT, maxEXT } = validationHelpers;
        let invalidCount = 0;
        for (let i = 0; i < students.length; i++) {
            const marks = marksData[students[i].id];
            if (marks) {
                if ((marks.int !== 'A' && marks.int !== '' && parseInt(marks.int, 10) > maxINT) ||
                    (marks.ext !== 'A' && marks.ext !== '' && parseInt(marks.ext, 10) > maxEXT)) {
                    invalidCount++;
                }
            }
        }
        return { hasInvalid: invalidCount > 0, count: invalidCount };
    }, [students, marksData, validationHelpers]);

    const completionStats = useMemo(() => {
        let completed = 0;
        for (let i = 0; i < students.length; i++) {
            const m = marksData[students[i].id];
            if (m?.int && m?.ext) completed++;
        }
        return { completed, total: students.length };
    }, [students, marksData]);

    const handleMarksChange = useCallback((studentId: string, field: 'int' | 'ext', value: string) => {
        const upperValue = value.toUpperCase();
        if (value && !/^\d*$/.test(value) && upperValue !== 'A') return;

        if (currentSubject && value && upperValue !== 'A') {
            const numValue = parseInt(value, 10);
            const maxValue = field === 'int' ? currentSubject.maxINT : currentSubject.maxEXT;
            if (numValue > maxValue) return;
        }

        setMarksData(prev => {
            const current = prev[studentId];
            if (current && current[field] === upperValue) return prev;
            return {
                ...prev,
                [studentId]: { ...current, [field]: upperValue }
            };
        });
    }, [currentSubject]);

    const handleClearStudentMarks = useCallback(async (studentId: string, studentName: string) => {
        if (!selectedSubject) return;
        if (confirm(`Are you sure you want to clear marks for ${studentName}?`)) {
            try {
                setOperationLoading({ type: 'clearing', message: `Clearing marks for ${studentName}...` });
                await dataService.clearStudentSubjectMarks(studentId, selectedSubject, activeTerm);
                setMarksData(prev => ({ ...prev, [studentId]: { int: '', ext: '' } }));
                deleteDraft(studentId, selectedSubject, activeTerm);
                await loadStudentsByClass();
            } catch (error) {
                console.error('Error clearing student marks:', error);
            } finally {
                setOperationLoading({ type: null });
            }
        }
    }, [selectedSubject, activeTerm, loadStudentsByClass, deleteDraft]);

    const handleClearAll = useCallback(async () => {
        if (!selectedSubject) return;
        if (confirm(`Are you sure you want to clear all marks for the selected subject in ${selectedClass}?`)) {
            try {
                setOperationLoading({ type: 'clearing', message: 'Clearing all marks...' });
                const studentIds = students.map(s => s.id);
                await dataService.clearSubjectMarks(selectedSubject, studentIds, activeTerm);
                
                const clearedMarks: Record<string, { int: string; ext: string }> = {};
                students.forEach(s => {
                    clearedMarks[s.id] = { int: '', ext: '' };
                    deleteDraft(s.id, selectedSubject, activeTerm);
                });
                setMarksData(clearedMarks);
                await loadStudentsByClass();
            } catch (error) {
                console.error('Error clearing marks:', error);
            } finally {
                setOperationLoading({ type: null });
            }
        }
    }, [selectedSubject, selectedClass, students, activeTerm, loadStudentsByClass, deleteDraft]);

    const handleSaveMarks = useCallback(async () => {
        if (!selectedSubject || invalidMarksInfo.hasInvalid) return;
        try {
            setOperationLoading({ type: 'saving', message: 'Saving marks...' });
            const updates: any[] = [];
            const sub = subjects.find(s => s.id === selectedSubject);

            for (const student of students) {
                const marks = marksData[student.id];
                // Only save if some part of the mark exists
                if (marks && (marks.int || marks.ext)) {
                    let intToSave: number | 'A' = marks.int === 'A' ? 'A' : parseInt(marks.int);
                    
                    updates.push({
                        studentId: student.id,
                        subjectId: selectedSubject,
                        marks: {
                             int: intToSave,
                             ext: marks.ext === 'A' ? 'A' : parseInt(marks.ext)
                        },
                        maxINT: sub?.maxINT,
                        maxEXT: sub?.maxEXT
                    });
                    
                    // Optimistic offline backup
                    saveDraft(student.id, selectedSubject, marks.int, marks.ext, activeTerm);
                }
            }

            if (isOnline && updates.length > 0) {
                // Use TRUE batching
                await dataService.bulkUpdateMarks(updates, activeTerm);
                updates.forEach(u => deleteDraft(u.studentId, selectedSubject, activeTerm));
                await loadStudentsByClass();
            }
            alert(isOnline ? 'Marks saved successfully (Batched)!' : 'Marks saved offline as drafts!');
        } catch (error) {
            console.error('Error saving marks:', error);
            alert('Failed to save marks. Please check your connection.');
        } finally {
            setOperationLoading({ type: null });
        }
    }, [selectedSubject, invalidMarksInfo, students, marksData, subjects, activeTerm, isOnline, saveDraft, deleteDraft, loadStudentsByClass]);

    const handleSaveEXTMarks = useCallback(async (studentId?: string) => {
        if (!selectedSubject) return;
        try {
            setOperationLoading({ type: 'saving', message: 'Saving EXT marks...' });
            const updates: any[] = [];
            const targetStudents = studentId ? students.filter(s => s.id === studentId) : students;

            for (const student of targetStudents) {
                const marks = marksData[student.id];
                if (marks?.ext) {
                    updates.push({
                        studentId: student.id,
                        subjectId: selectedSubject,
                        ext: marks.ext === 'A' ? 'A' : parseInt(marks.ext)
                    });
                }
            }

            if (isOnline && updates.length > 0) {
                await dataService.bulkUpdateEXTMarks(updates, activeTerm);
                await loadStudentsByClass();
            }
            if (studentId) alert('EXT marks saved!');
        } catch (error) {
            console.error('Error saving EXT marks:', error);
        } finally {
            setOperationLoading({ type: null });
        }
    }, [selectedSubject, students, marksData, activeTerm, isOnline, loadStudentsByClass]);

    const handleSaveINTMarks = useCallback(async (studentId?: string) => {
        if (!selectedSubject) return;
        try {
            setOperationLoading({ type: 'saving', message: 'Saving INT marks...' });
            const updates: any[] = [];
            const targetStudents = studentId ? students.filter(s => s.id === studentId) : students;
            const sub = subjects.find(s => s.id === selectedSubject);

            for (const student of targetStudents) {
                const marks = marksData[student.id];
                if (marks?.int) {
                    let intToSave: number | 'A' = marks.int === 'A' ? 'A' : parseInt(marks.int);
                    updates.push({
                        studentId: student.id,
                        subjectId: selectedSubject,
                        marks: { int: intToSave }
                    });
                }
            }

            if (isOnline && updates.length > 0) {
                await dataService.bulkUpdateMarks(updates, activeTerm);
                await loadStudentsByClass();
            }
            if (studentId) alert('INT marks saved!');
        } catch (error) {
            console.error('Error saving INT marks:', error);
        } finally {
            setOperationLoading({ type: null });
        }
    }, [selectedSubject, students, marksData, subjects, activeTerm, isOnline, loadStudentsByClass]);

    const handleClearINTMarks = useCallback(async () => {
        if (!selectedSubject) return;
        if (confirm('Are you sure you want to clear INT marks for all students in this subject?')) {
            try {
                setOperationLoading({ type: 'clearing', message: 'Clearing INT marks...' });
                const studentIds = students.map(s => s.id);
                await dataService.clearSubjectINTMarks(selectedSubject, studentIds, activeTerm);
                setMarksData(prev => {
                    const newMarks = { ...prev };
                    students.forEach(s => {
                        if (newMarks[s.id]) newMarks[s.id] = { ...newMarks[s.id], int: '' };
                    });
                    return newMarks;
                });
                await loadStudentsByClass();
            } catch (error) {
                console.error('Error clearing INT marks:', error);
            } finally {
                setOperationLoading({ type: null });
            }
        }
    }, [selectedSubject, students, activeTerm, loadStudentsByClass]);

    const handleClearEXTMarks = useCallback(async () => {
        if (!selectedSubject) return;
        if (confirm('Are you sure you want to clear EXT marks for all students in this subject?')) {
            try {
                setOperationLoading({ type: 'clearing', message: 'Clearing EXT marks...' });
                const studentIds = students.map(s => s.id);
                await dataService.clearSubjectEXTMarks(selectedSubject, studentIds, activeTerm);
                setMarksData(prev => {
                    const newMarks = { ...prev };
                    students.forEach(s => {
                        if (newMarks[s.id]) newMarks[s.id] = { ...newMarks[s.id], ext: '' };
                    });
                    return newMarks;
                });
                await loadStudentsByClass();
            } catch (error) {
                console.error('Error clearing EXT marks:', error);
            } finally {
                setOperationLoading({ type: null });
            }
        }
    }, [selectedSubject, students, activeTerm, loadStudentsByClass]);

    const handleKeyDown = useCallback((e: React.KeyboardEvent, studentId: string, field: 'int' | 'ext') => {
        if (e.key === 'Enter') {
            e.preventDefault();
            const currentIndex = students.findIndex(s => s.id === studentId);
            if (currentIndex !== -1 && currentIndex < students.length - 1) {
                const nextStudentId = students[currentIndex + 1].id;
                const nextInput = document.querySelector(`input[data-student="${nextStudentId}"][data-field="${field}"]`) as HTMLInputElement;
                if (nextInput) nextInput.focus();
            }
        }
    }, [students]);

    return {
        marksData,
        setMarksData,
        currentStudentIndex,
        setCurrentStudentIndex,
        operationLoading,
        setOperationLoading,
        validationHelpers,
        invalidMarksInfo,
        completionStats,
        handleMarksChange,
        handleClearStudentMarks,
        handleClearAll,
        handleSaveMarks,
        handleSaveEXTMarks,
        handleSaveINTMarks,
        handleClearINTMarks,
        handleClearEXTMarks,
        // UI states and handlers
        showStudentList,
        setShowStudentList,
        searchQuery,
        setSearchQuery,
        filteredStudents,
        paginatedStudents,
        currentPage,
        setCurrentPage,
        hasMore,
        showScrollToTop,
        isScrolling,
        scrollToTop,
        jumpToStudent,
        navigateToNext,
        navigateToPrevious,
        handleKeyDown
    };
};
