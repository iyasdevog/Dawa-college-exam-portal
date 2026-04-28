import React, { useState, useEffect, useMemo, useCallback, memo } from 'react';
import { StudentRecord, SubjectConfig } from '../../../domain/entities/types';
import { dataService } from '../../../infrastructure/services/dataService';
import { useMobile, useTouchInteraction } from '../../hooks/useMobile';
import { mobileStorage } from '../../../infrastructure/services/mobileUtils';
import AggregatedScorecard from '../AggregatedScorecard';

interface StudentManagementProps {
    students: StudentRecord[];
    activeTerm: string;
    onRefresh: () => Promise<void>;
    isLoading: boolean;
}

interface MobileAdminState {
    viewMode: 'cards' | 'table' | 'compact';
    isSelectionMode: boolean;
    selectedItems: string[];
    sortBy: 'name' | 'date' | 'class' | 'custom';
    sortOrder: 'asc' | 'desc';
    filterBy: string;
    showAdvancedFilters: boolean;
}

interface BulkOperationState {
    isActive: boolean;
    operation: 'delete' | 'export' | 'modify' | null;
    progress: number;
    selectedCount: number;
    stage: 'preparing' | 'processing' | 'completing' | 'complete';
}

interface MobileProgressFeedback {
    isVisible: boolean;
    operation: 'loading' | 'saving' | 'deleting' | 'importing' | 'exporting';
    message: string;
    progress: number;
}

const StudentManagement: React.FC<StudentManagementProps> = ({ students, activeTerm, onRefresh, isLoading }) => {
    const { isMobile } = useMobile();
    const { getTouchProps } = useTouchInteraction();
    const [isOperating, setIsOperating] = useState(false);

    // Mobile admin state
    const [mobileAdminState, setMobileAdminState] = useState<MobileAdminState>({
        viewMode: 'cards',
        isSelectionMode: false,
        selectedItems: [],
        sortBy: 'name',
        sortOrder: 'asc',
        filterBy: '',
        showAdvancedFilters: false
    });

    const [bulkOperationState, setBulkOperationState] = useState<BulkOperationState>({
        isActive: false,
        operation: null,
        progress: 0,
        selectedCount: 0,
        stage: 'preparing'
    });

    const [mobileProgressFeedback, setMobileProgressFeedback] = useState<MobileProgressFeedback>({
        isVisible: false,
        operation: 'loading',
        message: '',
        progress: 0
    });

    // Form state
    const [showStudentForm, setShowStudentForm] = useState(false);
    const [editingStudent, setEditingStudent] = useState<StudentRecord | null>(null);
    const [studentForm, setStudentForm] = useState({
        adNo: '',
        name: '',
        className: 'S1',
        semester: 'Odd' as 'Odd' | 'Even'
    });

    const [showBulkImport, setShowBulkImport] = useState(false);
    const [csvData, setCsvData] = useState('');
    const [importResults, setImportResults] = useState<{ success: number; errors: string[] } | null>(null);
    const [isImporting, setIsImporting] = useState(false);
    const [showPromoteModal, setShowPromoteModal] = useState(false);
    const [promotionStage, setPromotionStage] = useState({
        fromClass: '',
        toClass: '',
        isPromoting: false
    });

    const [transcriptStudent, setTranscriptStudent] = useState<StudentRecord | null>(null);
    const [allSubjects, setAllSubjects] = useState<SubjectConfig[]>([]);
    const [availableClasses, setAvailableClasses] = useState<string[]>([]);

    useEffect(() => {
        const loadClasses = async () => {
            const classes = await dataService.getClassesByTerm(activeTerm);
            setAvailableClasses(classes);
        };
        loadClasses();
    }, [activeTerm]);

    // Load mobile preferences
    useEffect(() => {
        if (isMobile) {
            const savedMobileState = mobileStorage.get<Partial<MobileAdminState>>('management-mobile-state-students');
            if (savedMobileState) {
                setMobileAdminState(prev => ({
                    ...prev,
                    ...savedMobileState,
                    isSelectionMode: false,
                    selectedItems: []
                }));
            }
        }
    }, [isMobile]);

    // Style helpers
    const getTouchTargetStyle = (size: 'min' | 'comfortable' | 'large') => {
        switch (size) {
            case 'min': return { minHeight: '32px', minWidth: '32px' };
            case 'comfortable': return { minHeight: '48px', minWidth: '48px' };
            case 'large': return { minHeight: '56px', minWidth: '56px' };
            default: return {};
        }
    };

    const getTypographyStyle = (variant: string) => {
        switch (variant) {
            case 'body-large': return { fontSize: '1.125rem', lineHeight: '1.75rem' };
            case 'body-medium': return { fontSize: '1rem', lineHeight: '1.5rem' };
            case 'body-small': return { fontSize: '0.875rem', lineHeight: '1.25rem' };
            case 'caption': return { fontSize: '0.75rem', lineHeight: '1rem' };
            default: return {};
        }
    };

    // Handlers
    const handleToggleSelectionMode = () => {
        setMobileAdminState(prev => ({
            ...prev,
            isSelectionMode: !prev.isSelectionMode,
            selectedItems: []
        }));
    };

    const handleItemSelection = (itemId: string) => {
        setMobileAdminState(prev => ({
            ...prev,
            selectedItems: prev.selectedItems.includes(itemId)
                ? prev.selectedItems.filter(id => id !== itemId)
                : [...prev.selectedItems, itemId]
        }));
    };

    const handleSelectAll = () => {
        const allIds = students.map(item => item.id);
        setMobileAdminState(prev => ({
            ...prev,
            selectedItems: prev.selectedItems.length === allIds.length ? [] : allIds
        }));
    };

    const handleMobileViewModeChange = (viewMode: 'cards' | 'table' | 'compact') => {
        setMobileAdminState(prev => ({ ...prev, viewMode }));
        mobileStorage.set('management-mobile-state-students', { ...mobileAdminState, viewMode });
    };

    const handleAddStudent = () => {
        setEditingStudent(null);
        setStudentForm({
            adNo: '',
            name: '',
            className: 'S1',
            semester: 'Odd'
        });
        setShowStudentForm(true);
    };

    const handleEditStudent = (student: StudentRecord) => {
        setEditingStudent(student);
        setStudentForm({
            adNo: student.adNo,
            name: student.name,
            className: student.className,
            semester: student.semester
        });
        setShowStudentForm(true);
    };

    const handleSaveStudent = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!studentForm.adNo.trim() || !studentForm.name.trim()) return;

        try {
            setIsOperating(true);
            if (editingStudent) {
                await dataService.updateStudent(editingStudent.id, {
                    adNo: studentForm.adNo.trim(),
                    name: studentForm.name.trim(),
                    className: studentForm.className,
                    semester: studentForm.semester
                });
            } else {
                const newStudent: Omit<StudentRecord, 'id'> = {
                    adNo: studentForm.adNo.trim(),
                    name: studentForm.name.trim(),
                    className: studentForm.className,
                    currentClass: studentForm.className,
                    semester: studentForm.semester,
                    marks: {},
                    grandTotal: 0,
                    average: 0,
                    rank: 0,
                    performanceLevel: 'Needs Improvement'
                };
                await dataService.addStudent(newStudent);
            }
            await onRefresh();
            setShowStudentForm(false);
            setEditingStudent(null);
            alert(`Student "${studentForm.name.trim()}" saved successfully!`);
        } catch (error) {
            console.error('Error saving student:', error);
            alert('Error saving student. Please try again.');
        } finally {
            setIsOperating(false);
        }
    };

    const handleArchiveStudent = async (student: StudentRecord) => {
        if (!confirm(`Are you sure you want to MARK ${student.name} AS PASSED OUT/ARCHIVED? They will be removed from the active semester but their historical performance will be saved.`)) return;
        try {
            setIsOperating(true);
            await dataService.archiveStudent(student.id);
            await onRefresh();
            alert(`${student.name} has been archived successfully!`);
        } catch (error) {
            console.error('Error archiving student:', error);
            alert(`Error archiving student: ${error instanceof Error ? error.message : 'Unknown error'}`);
        } finally {
            setIsOperating(false);
        }
    };

    const handleDeleteStudent = async (student: StudentRecord) => {
        if (!confirm(`DANGER: Are you sure you want to PERMANENTLY DELETE ${student.name}? ALL of their historical data across ALL semesters will be erased irrevocably!`)) return;
        try {
            setIsOperating(true);
            await dataService.deleteStudent(student.id);
            await onRefresh();
            alert(`${student.name} has been permanently deleted!`);
        } catch (error) {
            console.error('Error deleting student:', error);
            alert(`Error deleting student: ${error instanceof Error ? error.message : 'Unknown error'}`);
        } finally {
            setIsOperating(false);
        }
    };

    const handleBulkDelete = async () => {
        if (mobileAdminState.selectedItems.length === 0) return;
        if (!confirm(`Delete ${mobileAdminState.selectedItems.length} students?`)) return;

        setBulkOperationState({
            isActive: true,
            operation: 'delete',
            progress: 0,
            selectedCount: mobileAdminState.selectedItems.length,
            stage: 'preparing'
        });

        try {
            let completed = 0;
            const total = mobileAdminState.selectedItems.length;
            setBulkOperationState(prev => ({ ...prev, stage: 'processing' }));

            for (const itemId of mobileAdminState.selectedItems) {
                await dataService.deleteStudent(itemId);
                completed++;
                setBulkOperationState(prev => ({ ...prev, progress: Math.round((completed / total) * 100) }));
            }

            setBulkOperationState(prev => ({ ...prev, stage: 'completing' }));
            await onRefresh();
            setBulkOperationState(prev => ({ ...prev, stage: 'complete' }));
            setMobileAdminState(prev => ({ ...prev, selectedItems: [], isSelectionMode: false }));
        } catch (error) {
            console.error('Bulk delete failed:', error);
            alert('Bulk delete failed.');
        } finally {
            setTimeout(() => {
                setBulkOperationState(prev => ({ ...prev, isActive: false }));
            }, 2000);
        }
    };

    const [excelFile, setExcelFile] = useState<File | null>(null);

    const handleBulkImport = async () => {
        // Excel Import Path
        if (excelFile) {
            try {
                setIsImporting(true);
                setImportResults(null);

                const results = await dataService.importStudentsFromExcel(excelFile);
                setImportResults(results);

                if (results.success > 0) {
                    await onRefresh();
                    setExcelFile(null); // Reset file
                }
            } catch (error) {
                setImportResults({
                    success: 0,
                    errors: [error instanceof Error ? error.message : 'Unknown error during Excel import']
                });
            } finally {
                setIsImporting(false);
            }
            return;
        }

        // CSV Text Path (Legacy/Fallback)
        if (!csvData.trim()) {
            alert('Please select an Excel file or enter CSV data');
            return;
        }
        try {
            setIsImporting(true);
            setImportResults(null);
            const { students: parsedStudents, errors } = await dataService.parseStudentCSV(csvData);

            if (errors.length > 0) {
                setImportResults({ success: 0, errors });
                return;
            }
            if (parsedStudents.length === 0) {
                setImportResults({ success: 0, errors: ['No valid data'] });
                return;
            }

            const results = await dataService.bulkImportStudents(parsedStudents);
            setImportResults(results);
            if (results.success > 0) await onRefresh();
        } catch (error) {
            setImportResults({ success: 0, errors: [error instanceof Error ? error.message : 'Unknown error'] });
        } finally {
            setIsImporting(false);
        }
    };

    const handlePromoteClass = async () => {
        if (!promotionStage.fromClass || !promotionStage.toClass) {
            alert('Please select both source and target classes');
            return;
        }
        
        if (promotionStage.fromClass === promotionStage.toClass) {
            alert('Source and target classes cannot be the same');
            return;
        }

        const confirmMsg = `Are you sure you want to promote ALL active students from ${promotionStage.fromClass} to ${promotionStage.toClass}? \n\nThis will update their current class and create new academic records for the active term.`;
        if (!confirm(confirmMsg)) return;

        try {
            setPromotionStage(prev => ({ ...prev, isPromoting: true }));
            const settings = await dataService.getGlobalSettings();
            const termKey = `${settings.currentAcademicYear}-${settings.currentSemester}`;
            
            await dataService.promoteClass(promotionStage.fromClass, promotionStage.toClass, termKey);
            await onRefresh();
            alert(`Promotion from ${promotionStage.fromClass} to ${promotionStage.toClass} completed successfully!`);
            setShowPromoteModal(false);
            setPromotionStage({ fromClass: '', toClass: '', isPromoting: false });
        } catch (error) {
            console.error('Promotion failed:', error);
            alert(`Promotion failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        } finally {
            setPromotionStage(prev => ({ ...prev, isPromoting: false }));
        }
    };

    const downloadTemplate = () => {
        // Simple CSV template for now, could be Excel in future
        const headers = ['Admission No', 'Student Name', 'Class Name', 'Semester'];
        const sample = ['138', 'Ahmad Khan', 'S1', 'Odd'];
        const csvContent = [headers.join(','), sample.join(',')].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'student_import_template.csv';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const handleViewTranscript = async (student: StudentRecord) => {
        setIsOperating(true);
        try {
            const subjects = await dataService.getRawSubjects();
            setAllSubjects(subjects);
            setTranscriptStudent(student);
        } catch (error) {
            console.error("Failed to load transcript data", error);
            alert("Failed to load transcript data. Please try again.");
        } finally {
            setIsOperating(false);
        }
    };

    // Memoized Handlers
    const handleEdit = useCallback((student: StudentRecord) => handleEditStudent(student), []);
    const handleArchive = useCallback((student: StudentRecord) => handleArchiveStudent(student), []);
    const handleDelete = useCallback((student: StudentRecord) => handleDeleteStudent(student), []);
    const handleTranscript = useCallback((student: StudentRecord) => handleViewTranscript(student), []);

    // Filtered students logic — Memoized
    const filteredStudents = useMemo(() => {
        return students.filter(student =>
            !mobileAdminState.filterBy ||
            student.name.toLowerCase().includes(mobileAdminState.filterBy.toLowerCase()) ||
            student.adNo.toLowerCase().includes(mobileAdminState.filterBy.toLowerCase()) ||
            student.className.toLowerCase().includes(mobileAdminState.filterBy.toLowerCase())
        ).sort((a, b) => {
            const { sortBy, sortOrder } = mobileAdminState;
            let comparison = 0;
            switch (sortBy) {
                case 'name': comparison = a.name.localeCompare(b.name); break;
                case 'class': comparison = a.className.localeCompare(b.className); break;
                default: comparison = a.name.localeCompare(b.name);
            }
            return sortOrder === 'asc' ? comparison : -comparison;
        });
    }, [students, mobileAdminState.filterBy, mobileAdminState.sortBy, mobileAdminState.sortOrder]);

    return (
        <div className="space-y-4 sm:space-y-6">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                    <h2 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">Student Management</h2>
                    {activeTerm && (
                        <span className="text-[10px] sm:text-xs px-2 sm:px-3 py-1 rounded-full font-bold border bg-emerald-50 text-emerald-700 border-emerald-200 whitespace-nowrap shadow-sm">
                            {activeTerm}
                        </span>
                    )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 w-full lg:w-auto">
                    <button
                        onClick={() => setShowPromoteModal(true)}
                        className="px-3 py-2 bg-amber-600 text-white rounded-xl font-bold hover:bg-amber-700 transition-all flex items-center justify-center gap-2 text-xs sm:text-sm shadow-sm"
                    >
                        <i className="fa-solid fa-arrow-trend-up"></i>
                        <span>Promote</span>
                    </button>
                    <button
                        onClick={() => setShowBulkImport(true)}
                        className="px-3 py-2 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all flex items-center justify-center gap-2 text-xs sm:text-sm shadow-sm"
                    >
                        <i className="fa-solid fa-upload"></i>
                        <span>Import</span>
                    </button>
                    <button
                        onClick={handleAddStudent}
                        disabled={isOperating}
                        className="px-3 py-2 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2 text-xs sm:text-sm shadow-sm"
                    >
                        <i className="fa-solid fa-plus"></i>
                        <span>Add Student</span>
                    </button>
                </div>
            </div>

            {/* Mobile Controls */}
            {isMobile && (
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 space-y-4">
                    <div className="flex items-center gap-2 bg-slate-100 rounded-xl p-1">
                        {(['cards', 'table', 'compact'] as const).map((mode) => (
                            <button
                                key={mode}
                                onClick={() => handleMobileViewModeChange(mode)}
                                className={`flex-1 px-3 py-2 rounded-lg font-medium transition-all text-xs ${mobileAdminState.viewMode === mode ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'}`}
                            >
                                {mode.charAt(0).toUpperCase() + mode.slice(1)}
                            </button>
                        ))}
                    </div>
                    {/* Add filters and bulk actions UI here as needed - omitting full detailed JSX for brevity but preserving structure */}
                    <div className="grid grid-cols-2 gap-3">
                        <input
                            type="text"
                            value={mobileAdminState.filterBy}
                            onChange={(e) => setMobileAdminState(prev => ({ ...prev, filterBy: e.target.value }))}
                            placeholder="Search..."
                            className="w-full px-2 py-1 text-xs border border-slate-300 rounded-lg"
                        />
                        <button onClick={handleToggleSelectionMode} className="bg-slate-200 rounded px-2 text-xs">
                            {mobileAdminState.isSelectionMode ? 'Cancel Select' : 'Select'}
                        </button>
                    </div>
                </div>
            )}

            {/* List View */}
            {isMobile && mobileAdminState.viewMode !== 'table' ? (
                <div className="space-y-4">
                    {filteredStudents.map(student => (
                        <StudentCard 
                            key={student.id} 
                            student={student} 
                            onEdit={handleEdit} 
                            onArchive={handleArchive} 
                            onDelete={handleDelete} 
                            onViewTranscript={handleTranscript}
                        />
                    ))}
                </div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-slate-50">
                            <tr>
                                <th className="text-left p-4 font-bold">Adm No</th>
                                <th className="text-left p-4 font-bold">Name</th>
                                <th className="text-left p-4 font-bold">Class</th>
                                <th className="text-center p-4 font-bold">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredStudents.map((student, index) => (
                                <StudentRow 
                                    key={student.id} 
                                    student={student} 
                                    index={index} 
                                    onEdit={handleEdit} 
                                    onArchive={handleArchive} 
                                    onDelete={handleDelete} 
                                    onViewTranscript={handleTranscript}
                                />
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Modals for Add/Edit/Import would go here */}
            {showStudentForm && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-2xl w-full max-w-md p-6">
                        <h3 className="text-xl font-bold mb-4">{editingStudent ? 'Edit Student' : 'Add Student'}</h3>
                        <form onSubmit={handleSaveStudent} className="space-y-4">
                            <div>
                                <label className="block text-sm font-bold mb-1">Adm No</label>
                                <input
                                    type="text"
                                    value={studentForm.adNo}
                                    onChange={e => setStudentForm(prev => ({ ...prev, adNo: e.target.value }))}
                                    className="w-full p-3 border rounded-xl"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold mb-1">Name</label>
                                <input
                                    type="text"
                                    value={studentForm.name}
                                    onChange={e => setStudentForm(prev => ({ ...prev, name: e.target.value }))}
                                    className="w-full p-3 border rounded-xl"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold mb-1">Class</label>
                                <select
                                    value={studentForm.className}
                                    onChange={e => setStudentForm(prev => ({ ...prev, className: e.target.value }))}
                                    className="w-full p-3 border rounded-xl"
                                >
                                    {availableClasses.map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                            </div>
                            <div className="flex gap-3 pt-4">
                                <button type="button" onClick={() => setShowStudentForm(false)} className="flex-1 py-3 bg-slate-100 rounded-xl">Cancel</button>
                                <button type="submit" className="flex-1 py-3 bg-emerald-600 text-white rounded-xl">Save</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Bulk Import Modal */}
            {showBulkImport && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-2xl w-full max-w-lg p-6">
                        <h3 className="text-xl font-bold mb-4">Bulk Import Students</h3>

                        <div className="space-y-4">
                            {/* File Upload Section */}
                            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                                <label className="block text-sm font-bold mb-2 text-slate-700">Option 1: Upload Excel File (Recommended)</label>
                                <div className="flex flex-col gap-2">
                                    <input
                                        type="file"
                                        accept=".xlsx, .xls"
                                        onChange={(e) => setExcelFile(e.target.files?.[0] || null)}
                                        className="block w-full text-sm text-slate-500
                                            file:mr-4 file:py-2 file:px-4
                                            file:rounded-full file:border-0
                                            file:text-sm file:font-semibold
                                            file:bg-blue-50 file:text-blue-700
                                            hover:file:bg-blue-100"
                                    />
                                    <button
                                        onClick={downloadTemplate}
                                        className="text-xs text-blue-600 hover:text-blue-800 text-left flex items-center gap-1"
                                    >
                                        <i className="fa-solid fa-download"></i> Download Excel Template
                                    </button>
                                </div>
                            </div>

                            {/* CSV Text Area Section */}
                            <div>
                                <label className="block text-sm font-bold mb-2 text-slate-700">Option 2: Paste CSV Data</label>
                                <textarea
                                    value={csvData}
                                    onChange={e => setCsvData(e.target.value)}
                                    placeholder="Admission No,Student Name,Class Name,Semester&#10;138,Ahmad Khan,S1,Odd"
                                    className="w-full p-3 border rounded-xl h-32 text-sm font-mono"
                                    disabled={!!excelFile}
                                />
                                {excelFile && <p className="text-xs text-amber-600 mt-1">CSV input disabled because an Excel file is selected.</p>}
                            </div>

                            {importResults && (
                                <div className={`p-4 rounded-xl text-sm ${importResults.success > 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                                    {importResults.success > 0 ? (
                                        <p>✅ Successfully imported {importResults.success} students!</p>
                                    ) : (
                                        <div>
                                            <p className="font-bold text-red-800 mb-1">Import Failed:</p>
                                            <ul className="list-disc list-inside mt-1 max-h-32 overflow-y-auto text-red-700">
                                                {importResults.errors.length > 0 ? (
                                                    importResults.errors.map((err, i) => <li key={i}>{err}</li>)
                                                ) : (
                                                    <li>No valid student data found. Please check your Excel headers (must have 'Admission No' and 'Student Name').</li>
                                                )}
                                            </ul>
                                        </div>
                                    )}
                                </div>
                            )}

                            <div className="flex gap-3 pt-4">
                                <button
                                    onClick={() => {
                                        setShowBulkImport(false);
                                        setImportResults(null);
                                        setCsvData('');
                                        setExcelFile(null);
                                    }}
                                    className="flex-1 py-3 bg-slate-100 rounded-xl font-bold hover:bg-slate-200 transition-all"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleBulkImport}
                                    disabled={isImporting || (!csvData.trim() && !excelFile)}
                                    className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                                >
                                    {isImporting ? (
                                        <>
                                            <i className="fa-solid fa-spinner fa-spin"></i> Importing...
                                        </>
                                    ) : (
                                        <>
                                            <i className="fa-solid fa-file-import"></i> Import Students
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            {/* Promote Class Modal */}
            {showPromoteModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
                    <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm animate-in fade-in transition-opacity" onClick={() => !promotionStage.isPromoting && setShowPromoteModal(false)}></div>
                    <div className="bg-white w-full max-w-xl rounded-[2.5rem] shadow-2xl relative z-10 overflow-hidden animate-in zoom-in-95 duration-200 border border-slate-100">
                        <div className="p-8 bg-amber-50 border-b border-amber-100">
                            <div className="flex justify-between items-start">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 bg-amber-600 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-amber-200">
                                        <i className="fa-solid fa-arrow-trend-up text-xl"></i>
                                    </div>
                                    <div>
                                        <h3 className="text-2xl font-black text-slate-900 tracking-tight">Promote Classes</h3>
                                        <p className="text-amber-700 text-sm font-bold opacity-80 uppercase tracking-widest mt-1">Bulk Migration Engine</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => !promotionStage.isPromoting && setShowPromoteModal(false)}
                                    className="w-10 h-10 rounded-full bg-white text-slate-400 hover:text-slate-600 border border-slate-200 flex items-center justify-center transition-all shadow-sm hover:shadow-md"
                                >
                                    <i className="fa-solid fa-xmark"></i>
                                </button>
                            </div>
                        </div>

                        <div className="p-8 space-y-8">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 relative items-center">
                                <div>
                                    <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-3">Target From</label>
                                    <select
                                        value={promotionStage.fromClass}
                                        onChange={(e) => setPromotionStage(prev => ({ ...prev, fromClass: e.target.value }))}
                                        className="w-full p-5 bg-slate-50 border-2 border-slate-100 rounded-3xl text-slate-900 font-bold focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 transition-all outline-none"
                                    >
                                        <option value="">Select Level</option>
                                        {availableClasses.map(cls => (
                                            <option key={cls} value={cls}>{cls}</option>
                                        ))}
                                    </select>
                                </div>
                                
                                <div className="absolute left-1/2 top-1/2 -ml-4 mt-2 z-10 hidden md:block">
                                    <div className="w-8 h-8 bg-white border-2 border-amber-100 rounded-full flex items-center justify-center text-amber-600 shadow-sm">
                                        <i className="fa-solid fa-arrow-right"></i>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-3">Promote To</label>
                                    <select
                                        value={promotionStage.toClass}
                                        onChange={(e) => setPromotionStage(prev => ({ ...prev, toClass: e.target.value }))}
                                        className="w-full p-5 bg-slate-50 border-2 border-slate-100 rounded-3xl text-slate-900 font-bold focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 transition-all outline-none"
                                    >
                                        <option value="">Next Level</option>
                                        {availableClasses.map(cls => (
                                            <option key={cls} value={cls}>{cls}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100 space-y-2">
                                <div className="flex items-center gap-3 text-amber-700">
                                    <i className="fa-solid fa-circle-info"></i>
                                    <span className="text-xs font-black uppercase tracking-wider">Critical Notice</span>
                                </div>
                                <p className="text-xs text-slate-500 font-bold leading-relaxed italic">
                                    This operation will migrate all ACTIVE students from the source class to the target class. 
                                    A new academic cycle will be initialized for each student while preserving their full historical database.
                                </p>
                            </div>
                        </div>

                        <div className="p-8 bg-slate-50 border-t border-slate-100">
                            <button
                                onClick={handlePromoteClass}
                                disabled={promotionStage.isPromoting || !promotionStage.fromClass || !promotionStage.toClass}
                                className="w-full py-5 bg-amber-600 text-white rounded-3xl font-black text-sm uppercase tracking-widest shadow-xl shadow-amber-200 hover:bg-amber-700 transition-all disabled:opacity-50 disabled:shadow-none flex items-center justify-center gap-3"
                            >
                                {promotionStage.isPromoting ? (
                                    <>
                                        <i className="fa-solid fa-circle-notch fa-spin"></i>
                                        Processing Migration...
                                    </>
                                ) : (
                                    <>
                                        <i className="fa-solid fa-bolt"></i>
                                        Execute Bulk Promotion
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Transcript Modal */}
            {transcriptStudent && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-black/60 backdrop-blur-sm print:p-0 print:bg-white print:block">
                    <div className="w-full max-w-6xl max-h-screen print:max-h-none h-full print:h-auto overflow-hidden rounded-[2rem] print:rounded-none">
                        <AggregatedScorecard 
                            student={transcriptStudent} 
                            allSubjects={allSubjects} 
                            onClose={() => setTranscriptStudent(null)} 
                        />
                    </div>
                </div>
            )}
        </div>
    );
};

// Memoized Sub-components for performance
const StudentCard = memo(({ student, onEdit, onArchive, onDelete, onViewTranscript }: { 
    student: StudentRecord; 
    onEdit: (s: StudentRecord) => void;
    onArchive: (s: StudentRecord) => void;
    onDelete: (s: StudentRecord) => void;
    onViewTranscript: (s: StudentRecord) => void;
}) => (
    <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 hover:shadow-md transition-all">
        <div className="flex justify-between items-center">
            <div>
                <h3 className="font-bold text-slate-800">{student.name}</h3>
                <p className="text-xs font-black text-slate-500 uppercase tracking-tighter">{student.adNo} • {student.className}</p>
            </div>
            <div className="flex gap-2 p-3 bg-slate-50 rounded-2xl">
                <button onClick={() => onViewTranscript(student)} className="flex-1 h-10 flex items-center justify-center bg-white text-emerald-600 rounded-xl border border-slate-200 shadow-sm active:bg-emerald-50 transition-all" title="View Transcript"><i className="fa-solid fa-layer-group"></i></button>
                <button onClick={() => onEdit(student)} className="flex-1 h-10 flex items-center justify-center bg-white text-blue-600 rounded-xl border border-slate-200 shadow-sm active:bg-blue-50 transition-all" title="Edit Student"><i className="fa-solid fa-edit"></i></button>
                <button onClick={() => onArchive(student)} className="flex-1 h-10 flex items-center justify-center bg-white text-amber-600 rounded-xl border border-slate-200 shadow-sm active:bg-amber-50 transition-all" title="Archive Student"><i className="fa-solid fa-box-archive"></i></button>
                <button onClick={() => onDelete(student)} className="flex-1 h-10 flex items-center justify-center bg-white text-red-600 rounded-xl border border-slate-200 shadow-sm active:bg-red-50 transition-all" title="Delete Student"><i className="fa-solid fa-trash"></i></button>
            </div>
        </div>
    </div>
));

const StudentRow = memo(({ student, index, onEdit, onArchive, onDelete, onViewTranscript }: { 
    student: StudentRecord; 
    index: number;
    onEdit: (s: StudentRecord) => void;
    onArchive: (s: StudentRecord) => void;
    onDelete: (s: StudentRecord) => void;
    onViewTranscript: (s: StudentRecord) => void;
}) => (
    <tr className={`${index % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'} hover:bg-slate-100/50 transition-colors group`}>
        <td className="p-4 text-sm font-bold text-slate-600">{student.adNo}</td>
        <td className="p-4 text-sm font-black text-slate-800">{student.name}</td>
        <td className="p-4 text-sm font-bold text-slate-600">
            <span className="px-2 py-1 bg-slate-100 rounded-lg text-[10px] uppercase">{student.className}</span>
        </td>
        <td className="p-2 sm:p-4 text-center">
            <div className="flex justify-center gap-2 sm:gap-3 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                <button onClick={() => onViewTranscript(student)} className="w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition-colors" title="View Transcript"><i className="fa-solid fa-layer-group"></i></button>
                <button onClick={() => onEdit(student)} className="w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors" title="Edit Student"><i className="fa-solid fa-edit"></i></button>
                <button onClick={() => onArchive(student)} className="w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center rounded-lg bg-amber-50 text-amber-600 hover:bg-amber-100 transition-colors" title="Archive Student"><i className="fa-solid fa-box-archive"></i></button>
                <button onClick={() => onDelete(student)} className="w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-colors" title="Delete Student"><i className="fa-solid fa-trash"></i></button>
            </div>
        </td>
    </tr>
));

export default StudentManagement;
