import React, { useState } from 'react';
import { dataService } from '../../../infrastructure/services/dataService';
import { CLASSES } from '../../../domain/entities/constants';
import { StudentRecord, SubjectConfig } from '../../../domain/entities/types';
import { useTerm } from '../../viewmodels/TermContext';

interface SettingsManagementProps {
    onRefresh: () => Promise<void>;
    onNavigate?: (tabId: string) => void;
}

const SettingsManagement: React.FC<SettingsManagementProps> = ({ onRefresh, onNavigate }) => {
    const { activeTerm, refreshTerms } = useTerm();
    const [isOperating, setIsOperating] = useState(false);
    const [importResults, setImportResults] = useState<{ success: number; errors: string[] } | null>(null);
    const [isDangerZoneUnlocked, setIsDangerZoneUnlocked] = useState(false);
    const [unlockPassword, setUnlockPassword] = useState('');
    const DANGER_PASSWORD = import.meta.env.VITE_DB_UNLOCK_PASSWORD || 'pleasecareful';

    // Doura Cleanup State
    const [cleanupClass, setCleanupClass] = useState('');
    const [cleanupStudent, setCleanupStudent] = useState('');
    const [cleanupStudentsList, setCleanupStudentsList] = useState<StudentRecord[]>([]);

    // Academic Year Management State (Automated)
    const [availableYears, setAvailableYears] = useState<string[]>([]);
    const [attendanceDates, setAttendanceDates] = useState({ start: '', end: '' });
    const [attendanceThreshold, setAttendanceThreshold] = useState(75);
    const [currentSemester, setCurrentSemester] = useState<'Odd' | 'Even'>('Odd');
    const [editableYear, setEditableYear] = useState('');
    const [currentSettings, setCurrentSettings] = useState<any>(null);
    const [semesterSummaries, setSemesterSummaries] = useState<any[]>([]);
    const [isLoadingSummaries, setIsLoadingSummaries] = useState(false);

    // New Semester Wizard State
    const [showNewSemesterModal, setShowNewSemesterModal] = useState(false);
    const [wizardStep, setWizardStep] = useState(1);
    const [newSemesterData, setNewSemesterData] = useState({
        startDate: '',
        endDate: '',
        semester: 'Odd' as 'Odd' | 'Even'
    });
    const [selectedClasses, setSelectedClasses] = useState<string[]>([]);
    const [allExistingClasses, setAllExistingClasses] = useState<string[]>([]);
    const [selectedSubjectIds, setSelectedSubjectIds] = useState<string[]>([]);
    const [allExistingSubjects, setAllExistingSubjects] = useState<SubjectConfig[]>([]);
    const [allExistingStudents, setAllExistingStudents] = useState<StudentRecord[]>([]);
    const [wizardFacultyAssignments, setWizardFacultyAssignments] = useState<Record<string, string>>({});
    const [newClassName, setNewClassName] = useState('');
    const [showAddSubjectForm, setShowAddSubjectForm] = useState(false);
    const [newSubjectDataInput, setNewSubjectDataInput] = useState({
        name: '',
        facultyName: '',
        subjectType: 'general' as 'general' | 'elective',
        maxINT: 20,
        maxEXT: 80,
        passingTotal: 40
    });

    // Restore from Backup State
    const [restoreFile, setRestoreFile] = useState<File | null>(null);
    const [restoreTermKey, setRestoreTermKey] = useState('2025-2026-Odd');
    const [restoreForceOverwrite, setRestoreForceOverwrite] = useState(false);
    const [isRestoring, setIsRestoring] = useState(false);
    const [isAligning, setIsAligning] = useState(false);
    const [restoreResult, setRestoreResult] = useState<{ 
        studentsRestored: number; 
        subjectsRestored: number; 
        attendanceRestored: number; 
        applicationsRestored: number;
        suppRestored: number;
        examTTRestored: number;
        specialDaysRestored: number;
        calendarRestored: number;
        genConfigsRestored: number;
        skipped: number 
    } | null>(null);

    React.useEffect(() => {
        const loadSettings = async () => {
            const settings = await dataService.getGlobalSettings();
            setCurrentSettings(settings);
            if (settings.availableYears) {
                setAvailableYears(settings.availableYears);
            }
            setAttendanceDates({
                start: settings.attendanceStartDate || '',
                end: settings.attendanceEndDate || ''
            });
            setAttendanceThreshold(settings.minAttendancePercentage || 75);
            setCurrentSemester(settings.currentSemester || 'Odd');
            setEditableYear(settings.currentAcademicYear || '');
        };

        const loadSummaries = async () => {
            setIsLoadingSummaries(true);
            try {
                const summaries = await dataService.getSemesterSummaries();
                setSemesterSummaries(summaries);
            } catch (error) {
                console.error('Error loading summaries:', error);
            } finally {
                setIsLoadingSummaries(false);
            }
        };

        loadSettings();
        loadSummaries();
    }, []);

    const handleSaveAttendanceSettings = async () => {
        if (!currentSettings) return;

        try {
            setIsOperating(true);
            const updatedSettings = {
                ...currentSettings,
                minAttendancePercentage: attendanceThreshold,
                currentAcademicYear: editableYear,
                currentSemester: currentSemester,
                // Ensure years are synced
                availableYears: Array.from(new Set([...(currentSettings.availableYears || []), editableYear])).filter(Boolean)
            };

            await dataService.updateGlobalSettings(updatedSettings);
            
            // Force immediate propagation
            await dataService.clearCache();
            await refreshTerms();
            if (onRefresh) await onRefresh();
            
            alert(`✅ System framework updated! Active term is now ${editableYear} ${currentSemester}.`);
        } catch (error) {
            console.error('Error saving attendance settings:', error);
            alert('Failed to save settings');
        } finally {
            setIsOperating(false);
        }
    };

    const handleAlignData = async () => {
        if (!window.confirm("⚠️ This will scan for any Special Days or Calendar entries missing a term tag and align them to the current active term.\n\nRecommended before taking a Master Backup. Continue?")) return;
        
        setIsAligning(true);
        try {
            const result = await dataService.alignDataToTerms();
            alert(`✅ Alignment Complete!\n- Special Days Fixed: ${result.specialDaysFixed}\n- Calendar Entries Fixed: ${result.calendarFixed}`);
        } catch (error) {
            console.error('Alignment error:', error);
            alert('Failed to align data.');
        } finally {
            setIsAligning(false);
        }
    };

    const handleRestoreFromBackup = async () => {
        if (!restoreFile) { alert('Please select a backup JSON file first.'); return; }
        if (!restoreTermKey.trim()) { alert('Please specify the term key (e.g. 2025-2026-Odd).'); return; }
        if (!window.confirm(`⚠️ This will restore data for term "${restoreTermKey}" from the backup file "${restoreFile.name}".\n\n${restoreForceOverwrite ? '⚠️ FORCE OVERWRITE is ON — this will replace existing term data.' : 'Safe mode: existing term data will NOT be overwritten.'}\n\nContinue?`)) return;

        setIsRestoring(true);
        setRestoreResult(null);
        try {
            const text = await restoreFile.text();
            const backupJson = JSON.parse(text);

            if (typeof backupJson !== 'object' || Array.isArray(backupJson)) {
                throw new Error('Invalid backup file format. Expected a JSON object with collection names as keys.');
            }

            const result = await dataService.restoreTermFromBackup(backupJson, restoreTermKey, restoreForceOverwrite);
            setRestoreResult(result);
            await dataService.clearCache();
            await refreshTerms();
            const updated = await dataService.getSemesterSummaries();
            setSemesterSummaries(updated);
        } catch (err: any) {
            alert(`❌ Restore failed: ${err.message}`);
            console.error('Restore error:', err);
        } finally {
            setIsRestoring(false);
        }
    };

    const handleStartNewSemester = async () => {
        if (!currentSettings) return;

        try {
            setIsOperating(true);
            
            const startDate = new Date(newSemesterData.startDate);
            const endDate = new Date(newSemesterData.endDate);
            
            if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
                alert('Please provide valid start and end dates.');
                return;
            }

            const startYear = startDate.getFullYear();
            const endYear = endDate.getFullYear();
            const derivedYear = startYear === endYear ? `${startYear}` : `${startYear}-${endYear}`;
            const targetTermKey = `${derivedYear}-${newSemesterData.semester}`;

            const newSemesterConfig = {
                termKey: targetTermKey,
                academicYear: derivedYear,
                semester: newSemesterData.semester,
                startDate: newSemesterData.startDate,
                endDate: newSemesterData.endDate
            };

            const existingSemesters = currentSettings.semesters || [];
            
            // 1. Update Global Settings
            await dataService.updateGlobalSettings({
                ...currentSettings,
                attendanceStartDate: newSemesterData.startDate,
                attendanceEndDate: newSemesterData.endDate,
                currentSemester: newSemesterData.semester,
                currentAcademicYear: derivedYear,
                availableYears: Array.from(new Set([...availableYears, derivedYear])),
                semesters: [...existingSemesters.filter((s:any) => s.termKey !== targetTermKey), newSemesterConfig]
            });

            // 2. Process Subjects (Carry-over/Select) with Dynamic Faculty
            if (selectedSubjectIds.length > 0) {
                const subjectsToClone = allExistingSubjects.filter(s => selectedSubjectIds.includes(s.id));
                
                for (const sub of subjectsToClone) {
                    const alreadyExists = allExistingSubjects.some(existing => 
                        existing.name === sub.name && 
                        existing.academicYear === derivedYear && 
                        JSON.stringify(existing.targetClasses) === JSON.stringify(sub.targetClasses)
                    );
                    
                    if (!alreadyExists) {
                        const { id, ...subData } = sub;
                        const assignedFaculty = wizardFacultyAssignments[sub.id] || '';
                        
                        await dataService.addSubject({
                            ...subData,
                            enrolledStudents: sub.subjectType === 'elective' ? [] : (subData.enrolledStudents || []),
                            academicYear: derivedYear,
                            facultyName: assignedFaculty // Using the dynamic name from wizard
                        });
                    }
                }
            }

            // 3. Clear caches to ensure new term is picked up
            await dataService.clearCache();
            await refreshTerms();
            
            alert(`✅ Semester ${targetTermKey} Initialized!\n\nStep 1: Complete. Now routing to Student Management for Promotion/Cleanup...`);
            setShowNewSemesterModal(false);
            setWizardStep(1); // Reset for next time
            
            await onRefresh();
            
            // Route to students first for promotion
            if (onNavigate) {
                onNavigate('students');
            }
        } catch (error) {
            console.error('Error launching new semester:', error);
            alert('Failed to initialize the new semester');
        } finally {
            setIsOperating(false);
        }
    };

    const loadWizardData = async () => {
        try {
            const [students, subjects] = await Promise.all([
                dataService.getAllStudents(),
                dataService.getAllSubjects()
            ]);
            
            // Derive unique classes from students + system defaults
            const uniqueClasses = Array.from(new Set([
                ...CLASSES,
                ...students.map(s => s.className)
            ])).filter(Boolean).sort();
            
            setAllExistingClasses(uniqueClasses);
            setSelectedClasses(uniqueClasses); // Default to all
            setAllExistingSubjects(subjects);
            setAllExistingStudents(students);
            setSelectedSubjectIds(subjects.map(s => s.id)); // Default to all
            
            // Initialize Faculty Assignments
            const assignments: Record<string, string> = {};
            subjects.forEach(s => {
                assignments[s.id] = s.facultyName || '';
            });
            setWizardFacultyAssignments(assignments);
        } catch (error) {
            console.error('Error loading wizard data:', error);
        }
    };

    const handleOpenWizard = () => {
        // Smart semester suggest: if current is Odd, next is Even. If current is Even, next is Odd.
        const nextSemester = currentSemester === 'Odd' ? 'Even' : 'Odd';
        
        setNewSemesterData({
            startDate: '', 
            endDate: '',
            semester: nextSemester
        });
        
        loadWizardData();
        setShowNewSemesterModal(true);
        setWizardStep(1);
    };


    const verifyPassword = () => {
        const input = prompt('Please enter the security password to confirm this action:');
        if (input === DANGER_PASSWORD) return true;
        if (input !== null) alert('Incorrect password. Action cancelled.');
        return false;
    };

    const handleMasterBackup = async () => {
        try {
            setIsOperating(true);
            await dataService.downloadFullSystemBackup();
            alert('Master backup (JSON) generated successfully! This file contains 100% of the system data.');
        } catch (error) {
            console.error('Error in master backup:', error);
            alert(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
        } finally {
            setIsOperating(false);
        }
    };

    const handleExportMarks = async () => {
        try {
            setIsOperating(true);
            await dataService.exportMarksToExcel();
            alert('Marks exported successfully! Check your downloads folder.');
        } catch (error) {
            console.error('Error exporting marks:', error);
            alert(`Error exporting marks: ${error instanceof Error ? error.message : 'Unknown error'}`);
        } finally {
            setIsOperating(false);
        }
    };

    const handleImportMarks = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
            alert('Please select an Excel file (.xlsx or .xls)');
            return;
        }

        if (!confirm('This will import marks from the Excel file and may overwrite existing marks. Are you sure you want to continue?')) {
            event.target.value = '';
            return;
        }

        try {
            setIsOperating(true);
            setImportResults(null);

            const results = await dataService.importMarksFromExcel(file);
            setImportResults(results);

            await onRefresh();

            if (results.errors.length === 0) {
                alert(`Import completed successfully! ${results.success} records imported.`);
            } else {
                alert(`Import completed with ${results.success} successful records and ${results.errors.length} errors.`);
            }
        } catch (error) {
            console.error('Error importing marks:', error);
            alert(`Error importing marks: ${error instanceof Error ? error.message : 'Unknown error'}`);
        } finally {
            setIsOperating(false);
            event.target.value = '';
        }
    };

    const handleSyncYears = async () => {
        if (!confirm('This will scan all student records to find historical semesters and restore them to the dropdown list. Continue?')) return;
        
        try {
            setIsOperating(true);
            const merged = await dataService.syncAllAvailableYears();
            setAvailableYears(merged);
            await refreshTerms();
            alert(`Synchronization complete. ${merged.length} academic years are now available.`);
        } catch (error) {
            console.error('Error syncing years:', error);
            alert('Failed to synchronize years');
        } finally {
            setIsOperating(false);
        }
    };

    const handleDeleteSemester = async (summary: any) => {
        const confirm1 = confirm(`DANGER: This will delete ALL marks and attendance records for ${summary.academicYear} ${summary.semester}.\n\nStudent profile information will be preserved. Are you sure?`);
        if (!confirm1) return;

        const confirm2 = confirm(`FINAL WARNING: Are you absolutely sure you want to permanently delete data for ${summary.termKey}? This cannot be undone.`);
        if (!confirm2) return;

        try {
            setIsOperating(true);
            await dataService.deleteSemesterData(summary.termKey);
            
            // Comprehensive refresh
            await refreshTerms();
            await onRefresh();
            
            // Refresh summaries locally
            const updated = await dataService.getSemesterSummaries();
            setSemesterSummaries(updated);
            
            alert(`✅ All data for ${summary.termKey} has been cleared.\nSystem settings have been reset if the active term was deleted.`);
        } catch (error) {
            console.error('Error deleting semester data:', error);
            alert('Failed to delete semester data');
        } finally {
            setIsOperating(false);
        }
    };

    const downloadSampleCSV = () => {
        const sampleData = [
            ['adNo', 'name', 'className', 'semester'],
            ['001', 'Ahmed Ali', 'S1', 'Odd'],
            ['002', 'Fatima Hassan', 'S1', 'Odd'],
            ['003', 'Omar Khalid', 'D1', 'Even']
        ];

        const csvContent = sampleData.map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'student_import_sample.csv';
        a.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div className="space-y-6">
            <h2 className="text-xl font-black text-slate-900">System Settings & Data Tools</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Data Management Card */}
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                    <h3 className="font-bold text-lg mb-4 text-slate-800">Data Import/Export</h3>
                    <div className="space-y-4">
                        <div>
                            <button
                                onClick={handleMasterBackup}
                                disabled={isOperating}
                                className="w-full mt-2 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all flex items-center justify-center gap-2 shadow-md shadow-blue-200"
                            >
                                <i className="fa-solid fa-database"></i>
                                Download JSON Master Backup
                            </button>
                        </div>
                        <div className="border-t border-slate-100 pt-4">
                            <p className="text-sm text-slate-600 mb-2">
                                <strong>Clean & Sync Applications:</strong> Removes duplicates and rejected apps, then brings all approved applications (Improvements, Revaluations, etc.) into the current term.
                            </p>
                            <button
                                onClick={async () => {
                                    if (!confirm('This will delete all rejected + duplicate applications, and forcefully bring approved applications into the current term. Continue?')) return;
                                    try {
                                        setIsOperating(true);
                                        const result = await dataService.cleanAndSyncApplications(activeTerm);
                                        await onRefresh();
                                        alert(`✅ Migration Complete!\n- Synced to term: ${result.synced}\n- Duplicates removed: ${result.duplicatesDeleted}\n- Rejected apps removed: ${result.rejectedDeleted}\n- ⚠️ Skipped (No Student Record): ${result.notRegistered}`);
                                    } catch (err) {
                                        alert('Action failed. Check console.');
                                    } finally {
                                        setIsOperating(false);
                                    }
                                }}
                                disabled={isOperating}
                                className="w-full mt-2 py-3 bg-purple-50 text-purple-700 rounded-xl font-bold hover:bg-purple-100 transition-all flex items-center justify-center gap-2"
                            >
                                <i className="fa-solid fa-broom"></i>
                                {isOperating ? 'Cleaning & Syncing...' : 'Clean & Sync Applications'}
                            </button>
                            <button
                                onClick={async () => {
                                    if (!confirm('This will repair missing historical marks, backfill "Failed In" metadata, and apply smart semester transitions. Continue?')) return;
                                    try {
                                        setIsOperating(true);
                                        const result = await dataService.repairAndAlignSupplementaryExams();
                                        await onRefresh();
                                        alert(`✅ Repair & Alignment Complete!\n- Semesters Aligned: ${result.updated}\n- Records Enriched (Marks/Metadata): ${result.repaired}`);
                                    } catch (err) {
                                        alert('Action failed.');
                                    } finally {
                                        setIsOperating(false);
                                    }
                                }}
                                disabled={isOperating}
                                className="w-full mt-2 py-3 bg-indigo-50 text-indigo-700 rounded-xl font-bold hover:bg-indigo-100 transition-all flex items-center justify-center gap-2 border border-indigo-100"
                            >
                                <i className="fa-solid fa-wand-magic-sparkles"></i>
                                {isOperating ? 'Repairing & Aligning...' : 'Repair & Align Supplementary Data'}
                            </button>
                        </div>

                        <div className="border-t border-slate-100 pt-4">
                            <p className="text-sm text-slate-600 mb-2">
                                <strong>System Optimization:</strong> Run a complete database health check and repair. This will:
                                <ul className="list-disc list-inside mt-1 ml-1 text-xs text-slate-500">
                                    <li>Standardize all faculty names</li>
                                    <li>Recalculate all subject pass/fail statuses</li>
                                    <li>Recalculate student totals, averages, and ranks</li>
                                    <li>Update performance levels</li>
                                </ul>
                            </p>
                            <button
                                onClick={async () => {
                                    if (!confirm('This will run a full database optimization and recalculation. It may take a minute or two.\n\nAre you sure you want to continue?')) return;

                                    try {
                                        setIsOperating(true);

                                        // Step 1: Normalize Faculty Names
                                        const facultyRes = await dataService.normalizeAllFacultyNames();

                                        // Step 2: Fix Mark Statuses
                                        const statusRes = await dataService.recalculateAllMarkStatuses();

                                        // Step 3: Fix Totals & Rankings (includes Performance Levels)
                                        const totalsRes = await dataService.recalculateAllStudentTotals();

                                        // Step 4: Full Bulk Recalculation (Extra safety for new grading logic)
                                        const perfRes = await dataService.recalculateAllStudentPerformanceLevels();

                                        await onRefresh();

                                        let message = `✅ Optimization Complete!\n\n`;
                                        message += `- Standardized ${facultyRes.updated} faculty names\n`;
                                        message += `- Updated ${statusRes.updated} mark statuses\n`;
                                        message += `- Recalculated ${totalsRes.updated} student record totals\n`;
                                        message += `- Applied new grading logic to ${perfRes.updated} students\n`;

                                        // Step 5: Sync Years
                                        await dataService.syncAllAvailableYears();
                                        await refreshTerms();

                                        const allErrors = [
                                            ...facultyRes.errors,
                                            ...statusRes.errors,
                                            ...totalsRes.errors,
                                            ...perfRes.errors
                                        ];

                                        if (allErrors.length > 0) {
                                            message += `\n⚠️ ${allErrors.length} Errors occurred (check console for details)`;
                                        }

                                        alert(message);
                                    } catch (error) {
                                        console.error('Error optimizing database:', error);
                                        alert(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
                                    } finally {
                                        setIsOperating(false);
                                    }
                                }}
                                disabled={isOperating}
                                className="w-full py-4 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-all flex items-center justify-center gap-2 shadow-md shadow-emerald-200"
                            >
                                <i className={`fa-solid ${isOperating ? 'fa-spinner fa-spin' : 'fa-wand-magic-sparkles'}`}></i>
                                {isOperating ? 'Optimizing Database...' : 'Optimize & Repair Database'}
                            </button>
                        </div>
                    </div>
                </div>


                {/* Semester Configuration Card */}
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                    <h3 className="font-bold text-lg mb-4 text-slate-800">Semester Lifecycle & Eligibility</h3>
                    
                    <button
                        onClick={handleOpenWizard}
                        className="w-full mb-6 py-4 bg-purple-600 text-white rounded-xl font-black hover:bg-purple-700 transition-all flex items-center justify-center gap-3 shadow-[0_8px_30px_rgb(147,51,234,0.3)] hover:shadow-[0_8px_30px_rgb(147,51,234,0.5)] transform hover:-translate-y-1"
                    >
                        <i className="fa-solid fa-rocket text-xl"></i>
                        Start New Semester Workflow
                    </button>

                    <h4 className="font-bold text-sm text-slate-500 uppercase tracking-widest mb-3 border-b pb-2">Modify Current Active Term</h4>
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center justify-between">
                                    Active Year
                                    <button 
                                        onClick={handleSyncYears}
                                        title="Re-sync years from database"
                                        className="text-[10px] text-blue-500 hover:text-blue-700"
                                    >
                                        <i className="fa-solid fa-rotate"></i> Sync
                                    </button>
                                </label>
                                <select
                                    value={editableYear}
                                    onChange={(e) => setEditableYear(e.target.value)}
                                    className="w-full px-4 py-2 border-2 border-slate-200 rounded-xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all font-bold text-slate-900"
                                >
                                    <option value="">Select Year...</option>
                                    {availableYears.map(year => (
                                        <option key={year} value={year}>{year}</option>
                                    ))}
                                    {/* Allow manually typed year if datalist was preferred, but for now strict dropdown is safer */}
                                    {!availableYears.includes(editableYear) && editableYear && (
                                        <option value={editableYear}>{editableYear} (Current)</option>
                                    )}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Active Semester</label>
                                <select
                                    value={currentSemester}
                                    onChange={(e) => setCurrentSemester(e.target.value as 'Odd' | 'Even')}
                                    className="w-full px-4 py-2 border-2 border-slate-200 rounded-xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all font-bold text-slate-900"
                                >
                                    <option value="Odd">Odd Semester</option>
                                    <option value="Even">Even Semester</option>
                                </select>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Required Attendance %</label>
                                <input
                                    type="number"
                                    min="0"
                                    max="100"
                                    value={attendanceThreshold}
                                    onChange={(e) => setAttendanceThreshold(parseInt(e.target.value) || 0)}
                                    className="w-full px-4 py-2 border-2 border-slate-200 rounded-xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all font-bold"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">System Status</label>
                                <div className="px-4 py-2 bg-emerald-50 text-emerald-700 rounded-xl font-bold border-2 border-emerald-100 flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                                    Framework: {editableYear}-{currentSemester}
                                </div>
                            </div>
                        </div>

                        <p className="text-[10px] text-slate-500 leading-relaxed italic bg-slate-50 p-3 rounded-lg border border-slate-100">
                            <strong>Note:</strong> Manually switching frameworks acts as a global override. It points the entire portal to the selected Year/Semester records. Use the "Wizard" for creating NEW semesters.
                        </p>
                        
                        <button
                            onClick={handleSaveAttendanceSettings}
                            disabled={isOperating}
                            className="w-full py-4 bg-slate-900 text-white rounded-xl font-black uppercase text-xs tracking-widest hover:bg-slate-800 transition-all flex items-center justify-center gap-3 shadow-xl"
                        >
                            <i className={`fa-solid ${isOperating ? 'fa-spinner fa-spin' : 'fa-save'}`}></i>
                            {isOperating ? 'Updating System...' : 'Update Current Active Framework'}
                        </button>
                    </div>
                </div>

                {/* Restore from Backup Panel */}
                <div className="bg-white p-6 rounded-xl border-2 border-amber-200 shadow-sm md:col-span-2">
                    <div className="flex items-center gap-3 mb-5">
                        <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center">
                            <i className="fa-solid fa-file-import text-amber-600"></i>
                        </div>
                        <div>
                            <h3 className="font-bold text-lg text-slate-800 leading-none">Restore Term from Backup</h3>
                            <p className="text-xs text-slate-500 mt-0.5">Upload a JSON backup file to recover a deleted semester's data</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                        {/* File Upload */}
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Backup JSON File</label>
                            <label className={`flex items-center gap-3 p-3 rounded-xl border-2 border-dashed cursor-pointer transition-all ${restoreFile ? 'border-amber-400 bg-amber-50' : 'border-slate-200 hover:border-amber-300 hover:bg-amber-50/50'}`}>
                                <i className={`fa-solid ${restoreFile ? 'fa-file-circle-check text-amber-600' : 'fa-upload text-slate-400'}`}></i>
                                <span className="text-sm font-semibold text-slate-700 truncate">
                                    {restoreFile ? restoreFile.name : 'Choose backup file...'}
                                </span>
                                <input
                                    type="file"
                                    accept=".json"
                                    className="hidden"
                                    onChange={(e) => {
                                        setRestoreFile(e.target.files?.[0] || null);
                                        setRestoreResult(null);
                                    }}
                                />
                            </label>
                        </div>

                        {/* Term Key */}
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Term to Restore</label>
                            <input
                                type="text"
                                value={restoreTermKey}
                                onChange={(e) => setRestoreTermKey(e.target.value)}
                                placeholder="e.g. 2025-2026-Odd"
                                className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:ring-4 focus:ring-amber-500/10 focus:border-amber-500 outline-none font-bold transition-all"
                            />
                            <p className="text-[10px] text-slate-400 mt-1">Format: YEAR-Odd or YEAR-Even (e.g. 2025-2026-Odd)</p>
                        </div>
                    </div>

                    {/* Force Overwrite Toggle */}
                    <label className="flex items-center gap-3 mb-5 cursor-pointer p-3 bg-slate-50 rounded-xl border border-slate-200 hover:bg-amber-50 transition-colors">
                        <div
                            onClick={() => setRestoreForceOverwrite(!restoreForceOverwrite)}
                            className={`w-10 h-6 rounded-full relative transition-colors ${restoreForceOverwrite ? 'bg-amber-500' : 'bg-slate-300'}`}
                        >
                            <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all shadow-sm ${restoreForceOverwrite ? 'right-1' : 'left-1'}`}></div>
                        </div>
                        <div>
                            <span className="text-sm font-bold text-slate-700">Force Overwrite</span>
                            <p className="text-[10px] text-slate-500">If OFF (recommended): only restores data for students who don't have this term's marks. If ON: replaces all existing data for this term.</p>
                        </div>
                    </label>

                    {/* Success Result */}
                    {restoreResult && (
                        <div className="mb-4 p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
                            <div className="flex items-center gap-2 mb-3">
                                <i className="fa-solid fa-circle-check text-emerald-600"></i>
                                <span className="font-bold text-emerald-800">Restore Complete!</span>
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                                {[
                                    { label: 'Students', value: restoreResult.studentsRestored, icon: 'fa-users' },
                                    { label: 'Subjects', value: restoreResult.subjectsRestored, icon: 'fa-book' },
                                    { label: 'Attendance', value: restoreResult.attendanceRestored, icon: 'fa-clipboard-check' },
                                    { label: 'Applications', value: restoreResult.applicationsRestored, icon: 'fa-file-invoice' },
                                    { label: 'Supp Exams', value: restoreResult.suppRestored, icon: 'fa-graduation-cap' },
                                    { label: 'Timetables', value: restoreResult.examTTRestored, icon: 'fa-calendar-days' },
                                    { label: 'Holidays', value: restoreResult.specialDaysRestored, icon: 'fa-umbrella-beach' },
                                    { label: 'Calendar', value: restoreResult.calendarRestored, icon: 'fa-calendar-check' },
                                    { label: 'Generator', value: restoreResult.genConfigsRestored, icon: 'fa-gears' },
                                    { label: 'Skipped', value: restoreResult.skipped, icon: 'fa-forward' },
                                ].map(({ label, value, icon }) => (
                                    <div key={label} className="bg-white p-2 rounded-lg border border-emerald-100 text-center">
                                        <i className={`fa-solid ${icon} text-emerald-500 text-sm mb-1`}></i>
                                        <div className="font-black text-lg text-slate-900">{value}</div>
                                        <div className="text-[9px] font-bold text-slate-500 uppercase">{label}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <button
                        onClick={handleRestoreFromBackup}
                        disabled={isRestoring || !restoreFile}
                        className="w-full py-4 bg-amber-600 hover:bg-amber-700 text-white font-black rounded-xl transition-all disabled:opacity-50 flex items-center justify-center gap-3 shadow-lg shadow-amber-200/50"
                    >
                        {isRestoring ? (
                            <><div className="loader-ring w-4 h-4 border-2 border-white"></div> Restoring...</>
                        ) : (
                            <><i className="fa-solid fa-rotate-left"></i> Restore "{restoreTermKey}" from Backup</>
                        )}
                    </button>
                </div>

                {/* Academic Term Management Dashboard */}
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm md:col-span-2">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
                            <i className="fa-solid fa-list-check text-blue-600"></i>
                            Academic Term Overview
                        </h3>
                        <button 
                            onClick={async () => {
                                setIsOperating(true);
                                const updated = await dataService.getSemesterSummaries();
                                setSemesterSummaries(updated);
                                setIsOperating(false);
                            }}
                            disabled={isOperating || isLoadingSummaries}
                            className="text-sm font-bold text-blue-600 hover:text-blue-800 transition-colors flex items-center gap-1"
                        >
                            <i className={`fa-solid fa-arrows-rotate ${isLoadingSummaries ? 'animate-spin' : ''}`}></i>
                            Refresh Stats
                        </button>
                    </div>

                    <div className="space-y-6">
                        {semesterSummaries.length === 0 && !isLoadingSummaries ? (
                            <div className="py-12 text-center bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
                                <p className="text-slate-500 font-medium font-bold">No academic terms found in the database.</p>
                            </div>
                        ) : (
                            <>
                                {/* Active Term Section */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {semesterSummaries.filter(s => s.isCurrent).map((summary) => (
                                        <div 
                                            key={summary.termKey}
                                            className="relative p-5 rounded-2xl border-2 border-blue-500 bg-blue-50/30 transition-all shadow-md col-span-1"
                                        >
                                            <div className="flex justify-between items-start mb-4">
                                                <div>
                                                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                                                        Active Academic Year
                                                    </span>
                                                    <h4 className="font-black text-xl text-slate-900 leading-none">
                                                        {summary.academicYear}
                                                    </h4>
                                                    <div className="flex items-center gap-2 mt-1">
                                                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase transition-colors ${summary.semester === 'Odd' ? 'bg-amber-100 text-amber-700' : 'bg-indigo-100 text-indigo-700'}`}>
                                                            {summary.semester} Semester
                                                        </span>
                                                        <span className="bg-blue-600 text-white px-2 py-0.5 rounded text-[10px] font-black uppercase animate-pulse">
                                                            Active
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-2 lg:grid-cols-3 gap-2 mb-6">
                                                <div className="bg-white/80 p-3 rounded-xl border border-slate-100">
                                                    <span className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Students</span>
                                                    <span className="text-lg font-black text-slate-900">{summary.studentCount}</span>
                                                </div>
                                                <div className="bg-white/80 p-3 rounded-xl border border-slate-100">
                                                    <span className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Classes</span>
                                                    <span className="text-lg font-black text-slate-900">{summary.classCount ?? 0}</span>
                                                </div>
                                                <div className="bg-white/80 p-3 rounded-xl border border-slate-100">
                                                    <span className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Subjects</span>
                                                    <span className="text-lg font-black text-slate-900">{summary.subjectCount ?? 0}</span>
                                                </div>
                                                <div className="bg-white/80 p-3 rounded-xl border border-slate-100">
                                                    <span className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Teachers</span>
                                                    <span className="text-lg font-black text-slate-900">{summary.teacherCount ?? 0}</span>
                                                </div>
                                                <div className="bg-white/80 p-3 rounded-xl border border-slate-100">
                                                    <span className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Attendance</span>
                                                    <span className="text-lg font-black text-slate-900">{summary.attendanceCount}</span>
                                                </div>
                                            </div>

                                            <button
                                                onClick={() => handleDeleteSemester(summary)}
                                                disabled={isOperating}
                                                className="w-full py-2 bg-slate-50 text-red-500 rounded-lg text-xs font-bold hover:bg-red-50 hover:text-red-700 transition-all flex items-center justify-center gap-2"
                                            >
                                                <i className="fa-solid fa-trash-can text-[10px]"></i>
                                                Clear Term Data
                                            </button>
                                        </div>
                                    ))}
                                </div>

                                {/* Past Terms Collapsible */}
                                {semesterSummaries.filter(s => !s.isCurrent).length > 0 && (
                                    <details className="group border border-slate-200 rounded-xl bg-slate-50 overflow-hidden">
                                        <summary className="flex items-center justify-between p-4 cursor-pointer font-bold text-slate-700 hover:bg-slate-100 transition-colors">
                                            <div className="flex items-center gap-2">
                                                <i className="fa-solid fa-clock-rotate-left text-slate-400"></i>
                                                Past Term Overviews ({semesterSummaries.filter(s => !s.isCurrent).length})
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <button
                                                    onClick={async (e) => {
                                                        e.preventDefault();
                                                        if (!window.confirm(`⚠️ This will permanently delete ALL past term data (subjects, attendance, history) for ${semesterSummaries.filter(s => !s.isCurrent).length} terms. This cannot be undone.\n\nContinue?`)) return;
                                                        setIsOperating(true);
                                                        try {
                                                            const pastTerms = semesterSummaries.filter(s => !s.isCurrent);
                                                            for (const term of pastTerms) {
                                                                await dataService.deleteSemesterData(term.termKey);
                                                            }
                                                            const updated = await dataService.getSemesterSummaries();
                                                            setSemesterSummaries(updated);
                                                            await refreshTerms();
                                                            alert('✅ All past term data cleared.');
                                                        } catch (err) {
                                                            alert('Failed to clear some terms. Check console.');
                                                        } finally {
                                                            setIsOperating(false);
                                                        }
                                                    }}
                                                    disabled={isOperating}
                                                    className="text-[10px] font-black text-red-500 bg-red-50 hover:bg-red-100 border border-red-100 px-3 py-1 rounded-lg transition-all flex items-center gap-1 disabled:opacity-50"
                                                >
                                                    <i className="fa-solid fa-trash-can"></i> Clear All
                                                </button>
                                                <i className="fa-solid fa-chevron-down transition-transform group-open:rotate-180 text-slate-400"></i>
                                            </div>
                                        </summary>
                                        <div className="p-4 pt-0">
                                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
                                                {semesterSummaries.filter(s => !s.isCurrent).map((summary) => (
                                                    <div 
                                                        key={summary.termKey}
                                                        className="relative p-4 rounded-2xl border-2 border-slate-200 bg-white hover:shadow-md transition-all"
                                                    >
                                                        <div className="mb-4">
                                                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                                                                Academic Year
                                                            </span>
                                                            <h4 className="font-black text-lg text-slate-900 leading-none">
                                                                {summary.academicYear}
                                                            </h4>
                                                            <span className={`inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase transition-colors ${summary.semester === 'Odd' ? 'bg-amber-100 text-amber-700' : 'bg-indigo-100 text-indigo-700'}`}>
                                                                {summary.semester} Semester
                                                            </span>
                                                        </div>

                                                        <div className="grid grid-cols-2 gap-2 mb-4">
                                                            <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                                                                <span className="block text-[8px] font-bold text-slate-400 uppercase">Students</span>
                                                                <span className="text-base font-black text-slate-900">{summary.studentCount}</span>
                                                            </div>
                                                            <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                                                                <span className="block text-[8px] font-bold text-slate-400 uppercase">Classes</span>
                                                                <span className="text-base font-black text-slate-900">{summary.classCount ?? 0}</span>
                                                            </div>
                                                            <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                                                                <span className="block text-[8px] font-bold text-slate-400 uppercase">Subjects</span>
                                                                <span className="text-base font-black text-slate-900">{summary.subjectCount ?? 0}</span>
                                                            </div>
                                                            <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                                                                <span className="block text-[8px] font-bold text-slate-400 uppercase">Attendance</span>
                                                                <span className="text-base font-black text-slate-900">{summary.attendanceCount}</span>
                                                            </div>
                                                        </div>

                                                        <button
                                                            onClick={() => handleDeleteSemester(summary)}
                                                            disabled={isOperating}
                                                            className="w-full py-1.5 bg-white border border-red-100 text-red-500 rounded-lg text-[10px] font-bold hover:bg-red-50 transition-all flex items-center justify-center gap-2"
                                                        >
                                                            <i className="fa-solid fa-trash-can"></i>
                                                            Clear Term
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </details>
                                )}
                            </>
                        )}
                    </div>
                </div>

                {/* Templates Card */}
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                    <h3 className="font-bold text-lg mb-4 text-slate-800">Templates & Resources</h3>
                    <div className="space-y-4">
                        <div>
                            <p className="text-sm text-slate-600 mb-2">Download CSV template for bulk student import.</p>
                            <button
                                onClick={downloadSampleCSV}
                                className="w-full py-3 bg-slate-50 text-slate-700 rounded-xl font-bold hover:bg-slate-100 transition-all flex items-center justify-center gap-2"
                            >
                                <i className="fa-solid fa-file-csv"></i>
                                Download Student CSV Template
                            </button>
                        </div>
                    </div>
                </div>

                {/* Doura Archive Card */}
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm md:col-span-1">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
                            <i className="fa-solid fa-box-archive text-amber-600"></i>
                            Doura Archive
                        </h3>
                        <span className="px-2 py-1 bg-amber-100 text-amber-800 text-[10px] font-black rounded-lg uppercase tracking-wider">Legacy Tools</span>
                    </div>
                    
                    <div className="space-y-4">
                        <p className="text-xs text-slate-500 leading-relaxed font-medium">
                            Administrative tools for historical Doura management. Use these to clean up or separate legacy data from the active semester workflow.
                        </p>

                        <div className="space-y-3">
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Target Doura Class</label>
                                <select 
                                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold"
                                    value={cleanupClass}
                                    onChange={(e) => setCleanupClass(e.target.value)}
                                >
                                    <option value="">Select Class...</option>
                                    {allExistingClasses.filter(c => c.toLowerCase().includes('doura') || c.length < 5).map(c => (
                                        <option key={c} value={c}>{c}</option>
                                    ))}
                                </select>
                            </div>

                            <button 
                                onClick={async () => {
                                    if (!cleanupClass) return;
                                    if (!confirm(`This will identify all students in ${cleanupClass} for archival processing. Continue?`)) return;
                                    const students = await dataService.getAllStudents();
                                    const filtered = students.filter(s => s.className === cleanupClass);
                                    setCleanupStudentsList(filtered);
                                    alert(`Found ${filtered.length} students in ${cleanupClass}.`);
                                }}
                                className="w-full py-2 bg-slate-100 text-slate-600 rounded-lg text-xs font-bold hover:bg-slate-200 transition-all"
                            >
                                Fetch Archive Candidate List
                            </button>

                            {cleanupStudentsList.length > 0 && (
                                <div className="mt-4 p-3 bg-amber-50 rounded-xl border border-amber-100">
                                    <p className="text-[10px] font-black text-amber-800 uppercase mb-2">Candidates for Cleanup ({cleanupStudentsList.length})</p>
                                    <div className="max-h-24 overflow-y-auto space-y-1 mb-3">
                                        {cleanupStudentsList.map(s => (
                                            <div key={s.id} className="text-[10px] font-bold text-amber-700 flex justify-between">
                                                <span>{s.adNo} - {s.name}</span>
                                                <span>{s.className}</span>
                                            </div>
                                        ))}
                                    </div>
                                    <button 
                                        onClick={() => {
                                            if (!confirm('STRICT WARNING: This will set these students to inactive and move them to archive. Proceed?')) return;
                                            alert('Simulated cleanup successful. (Implementation pending backend archival service)');
                                        }}
                                        className="w-full py-2 bg-amber-600 text-white rounded-lg text-xs font-bold hover:bg-amber-700 transition-all shadow-md shadow-amber-200"
                                    >
                                        Execute Bulk Archive
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Import Results Log */}
            {importResults && importResults.errors.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-6">
                    <h4 className="font-bold text-red-800 mb-2">Import Issues</h4>
                    <p className="text-sm text-red-600 mb-4">The following errors occurred during import:</p>
                    <ul className="list-disc list-inside space-y-1 text-sm text-red-700 max-h-48 overflow-y-auto">
                        {importResults.errors.map((error, index) => (
                            <li key={index}>{error}</li>
                        ))}
                    </ul>
                </div>
            )}


            {/* Danger Zone */}
            <div className="bg-red-50 p-6 rounded-xl border-2 border-red-200 shadow-sm mt-8">
                <h3 className="font-black text-lg mb-2 text-red-800 flex items-center gap-2">
                    <i className="fa-solid fa-triangle-exclamation"></i>
                    Danger Zone
                </h3>
                <p className="text-sm text-red-700 mb-6 font-medium">
                    Critical data management controls. Actions performed here are irreversible.
                </p>

                {!isDangerZoneUnlocked ? (
                    <div className="flex flex-col sm:flex-row gap-3 items-center bg-white p-4 rounded-xl border border-red-100">
                        <input
                            type="password"
                            placeholder="Enter password to unlock..."
                            value={unlockPassword}
                            onChange={(e) => setUnlockPassword(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && unlockPassword === DANGER_PASSWORD && setIsDangerZoneUnlocked(true)}
                            className="w-full px-4 py-2 border border-red-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                        />
                        <button
                            onClick={() => {
                                if (unlockPassword === DANGER_PASSWORD) {
                                    setIsDangerZoneUnlocked(true);
                                    setUnlockPassword('');
                                } else {
                                    alert('Incorrect password');
                                }
                            }}
                            className="w-full sm:w-auto px-6 py-2 bg-red-600 text-white font-bold rounded-lg hover:bg-red-700 transition-colors whitespace-nowrap"
                        >
                            Unlock Zone
                        </button>
                    </div>
                ) : (
                    <>
                        <div className="bg-white p-4 rounded-xl border border-red-100 mb-6 shadow-sm">
                            <div className="flex items-start gap-4 mb-4">
                                <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center text-red-600 shrink-0">
                                    <i className="fa-solid fa-screwdriver-wrench text-xl"></i>
                                </div>
                                <div>
                                    <h4 className="font-bold text-red-800">Metadata Repair & Sync</h4>
                                    <p className="text-xs text-red-600 mt-1 leading-relaxed">
                                        Use this if academic terms are showing incorrectly or if deleted terms still appear as "Active". 
                                        This scans all student records and synchronizes the global system configuration.
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={async () => {
                                    if (!confirm('This will scan all student records and reset global term metadata to match actual data. Continue?')) return;
                                    try {
                                        setIsOperating(true);
                                        const result = await dataService.repairGlobalSettings();
                                        await refreshTerms();
                                        await onRefresh();
                                        alert(`✅ Repair Successful!\n\nDiscovered Years: ${result.discoveredYears.join(', ')}\nActive Term set to: ${result.activeTermSet}\n\nThe system is now synchronized.`);
                                    } catch (error) {
                                        alert('Repair failed: ' + (error instanceof Error ? error.message : 'Unknown error'));
                                    } finally {
                                        setIsOperating(false);
                                    }
                                }}
                                disabled={isOperating}
                                className="w-full py-3 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition-all flex items-center justify-center gap-2 shadow-md shadow-red-200"
                            >
                                <i className={`fa-solid ${isOperating ? 'fa-spinner fa-spin' : 'fa-wand-magic-sparkles'}`}></i>
                                {isOperating ? 'Repairing Metadata...' : 'Repair & Sync Term Metadata'}
                            </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <button
                            onClick={async () => {
                                if (!verifyPassword()) return;
                                if (!confirm('CRITICAL WARNING: This will DELETE ALL STUDENTS and their marks. This action CANNOT be undone. Are you sure?')) return;
                                if (!confirm('Double Check: Are you absolutely sure you want to wipe all student data?')) return;

                                try {
                                    setIsOperating(true);
                                    await dataService.clearAllData();
                                    await onRefresh();
                                    alert('All student data has been cleared.');
                                } catch (error) {
                                    console.error('Error clearing student data:', error);
                                    alert('Failed to clear student data.');
                                } finally {
                                    setIsOperating(false);
                                }
                            }}
                            disabled={isOperating}
                            className="py-4 px-6 bg-white border-2 border-red-200 text-red-600 rounded-xl font-bold hover:bg-red-600 hover:text-white hover:border-red-600 transition-all flex items-center justify-center gap-2 shadow-sm"
                        >
                            <i className="fa-solid fa-user-xmark"></i>
                            Delete All Students
                        </button>

                        <button
                            onClick={async () => {
                                if (!verifyPassword()) return;
                                if (!confirm('CRITICAL WARNING: This will DELETE ALL SUBJECTS and their configurations. This action CANNOT be undone. Are you sure?')) return;

                                try {
                                    setIsOperating(true);
                                    await dataService.clearAllSubjects();
                                    await onRefresh();
                                    alert('All subjects have been deleted.');
                                } catch (error) {
                                    console.error('Error clearing subjects:', error);
                                    alert('Failed to clear subjects.');
                                } finally {
                                    setIsOperating(false);
                                }
                            }}
                            disabled={isOperating}
                            className="py-4 px-6 bg-white border-2 border-red-200 text-red-600 rounded-xl font-bold hover:bg-red-600 hover:text-white hover:border-red-600 transition-all flex items-center justify-center gap-2 shadow-sm"
                        >
                            <i className="fa-solid fa-book-skull"></i>
                            Delete All Subjects
                        </button>

                        <button
                            onClick={async () => {
                                if (!verifyPassword()) return;
                                if (!confirm('WARNING: This will DELETE ALL SUPPLEMENTARY EXAMS. This action CANNOT be undone. Are you sure?')) return;

                                try {
                                    setIsOperating(true);
                                    await dataService.deleteAllSupplementaryExams();
                                    await onRefresh();
                                    alert('All supplementary exams have been deleted.');
                                } catch (error) {
                                    console.error('Error clearing supplementary exams:', error);
                                    alert('Failed to clear supplementary exams.');
                                } finally {
                                    setIsOperating(false);
                                }
                            }}
                            disabled={isOperating}
                            className="py-4 px-6 bg-white border-2 border-red-200 text-red-600 rounded-xl font-bold hover:bg-red-600 hover:text-white hover:border-red-600 transition-all flex items-center justify-center gap-2 shadow-sm"
                        >
                            <i className="fa-solid fa-file-circle-xmark"></i>
                            Delete All Supplementary Exams
                        </button>

                        <button
                            onClick={async () => {
                                if (!verifyPassword()) return;
                                if (!confirm('WARNING: This will RESET ALL CUSTOM CLASSES. System default classes will remain. Are you sure?')) return;

                                try {
                                    setIsOperating(true);
                                    localStorage.removeItem('customClasses');
                                    // Force reload to reflect class changes as they are often read at startup
                                    alert('Custom classes reset. The page will reload.');
                                    window.location.reload();
                                } catch (error) {
                                    console.error('Error resetting classes:', error);
                                    alert('Failed to reset classes.');
                                    setIsOperating(false);
                                }
                            }}
                            disabled={isOperating}
                            className="py-4 px-6 bg-white border-2 border-red-200 text-red-600 rounded-xl font-bold hover:bg-red-600 hover:text-white hover:border-red-600 transition-all flex items-center justify-center gap-2 shadow-sm"
                        >
                            <i className="fa-solid fa-layer-group"></i>
                            Reset Custom Classes
                        </button>

                        </div>
                    </>
                )}
            </div>

            {/* New Semester Creation Modal */}
            {showNewSemesterModal && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-[100] backdrop-blur-sm">
                    <div className="bg-white rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl">
                        <div className="bg-gradient-to-r from-purple-800 to-indigo-800 p-6 text-white relative">
                            <button 
                                onClick={() => setShowNewSemesterModal(false)}
                                className="absolute top-4 right-4 w-8 h-8 flex justify-center items-center bg-white/10 hover:bg-white/20 rounded-full transition-colors"
                            >
                                <i className="fa-solid fa-xmark"></i>
                            </button>
                            <div className="flex items-center gap-3 mb-1">
                                <span className="bg-white/20 px-3 py-1 rounded-full text-xs font-black uppercase">Step {wizardStep} of 3</span>
                                <h3 className="text-2xl font-black">
                                    {wizardStep === 1 && 'Initialize Term'}
                                    {wizardStep === 2 && 'Class Selection'}
                                    {wizardStep === 3 && 'Subject Carry-over'}
                                </h3>
                            </div>
                            <p className="text-purple-100 text-sm">
                                {wizardStep === 1 && 'Designate the exact timeline for the new academic term.'}
                                {wizardStep === 2 && 'Select active classes (Optional). Press Next to continue with existing.'}
                                {wizardStep === 3 && 'Choose subjects to carries over (Optional). Press Next to finish.'}
                            </p>
                        </div>
                        
                        <div className="p-6 overflow-y-auto max-h-[60vh]">
                            {wizardStep === 1 && (
                                <div className="space-y-5">
                                    <div className="bg-indigo-50 border border-indigo-100 p-4 rounded-xl text-sm text-indigo-800 mb-2">
                                        <i className="fa-solid fa-circle-info mr-2"></i>
                                        <strong>Lifecycle Guide:</strong> Initializing a new semester is a 3-step process:
                                        <ol className="list-decimal list-inside mt-2 space-y-1 font-medium">
                                            <li>Term Setup (Date & Year initialization)</li>
                                            <li>Class Verification (Select/Add Active Classes)</li>
                                            <li>Subject Mapping (Carry over existing configs)</li>
                                        </ol>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-bold mb-2 text-slate-700">Semester Type</label>
                                        <select
                                            value={newSemesterData.semester}
                                            onChange={(e) => setNewSemesterData(prev => ({ ...prev, semester: e.target.value as 'Odd'|'Even'}))}
                                            className="w-full p-3 border-2 border-slate-200 rounded-xl focus:ring-4 focus:ring-purple-500/10 focus:border-purple-500 transition-all font-bold"
                                        >
                                            <option value="Odd">Odd / Semester 1</option>
                                            <option value="Even">Even / Semester 2</option>
                                        </select>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-bold mb-2 text-slate-700">Official Start Date</label>
                                            <input
                                                type="date"
                                                value={newSemesterData.startDate}
                                                onChange={(e) => setNewSemesterData(prev => ({ ...prev, startDate: e.target.value }))}
                                                className="w-full p-3 border-2 border-slate-200 rounded-xl focus:ring-4 focus:ring-purple-500/10 focus:border-purple-500 transition-all font-bold"
                                                required
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-bold mb-2 text-slate-700">Official End Date</label>
                                            <input
                                                type="date"
                                                value={newSemesterData.endDate}
                                                onChange={(e) => setNewSemesterData(prev => ({ ...prev, endDate: e.target.value }))}
                                                className="w-full p-3 border-2 border-slate-200 rounded-xl focus:ring-4 focus:ring-purple-500/10 focus:border-purple-500 transition-all font-bold"
                                                required
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}

                            {wizardStep === 2 && (
                                <div className="space-y-4">
                                    <div className="flex justify-between items-center mb-2">
                                        <label className="text-sm font-bold text-slate-700 uppercase tracking-wider">Select Active Classes</label>
                                        <button 
                                            onClick={() => setSelectedClasses(selectedClasses.length === allExistingClasses.length ? [] : allExistingClasses)}
                                            className="text-xs font-bold text-purple-600 hover:text-purple-800"
                                        >
                                            {selectedClasses.length === allExistingClasses.length ? 'Deselect All' : 'Select All'}
                                        </button>
                                    </div>
                                    
                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 p-4 bg-slate-50 rounded-xl border-2 border-slate-100 max-h-48 overflow-y-auto">
                                        {allExistingClasses.map(cls => (
                                            <label key={cls} className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-all border-2 ${selectedClasses.includes(cls) ? 'bg-purple-100 border-purple-200 text-purple-900' : 'bg-white border-transparent text-slate-600'}`}>
                                                <input 
                                                    type="checkbox" 
                                                    checked={selectedClasses.includes(cls)}
                                                    onChange={(e) => {
                                                        if (e.target.checked) setSelectedClasses([...selectedClasses, cls]);
                                                        else setSelectedClasses(selectedClasses.filter(c => c !== cls));
                                                    }}
                                                    className="hidden"
                                                />
                                                <span className="text-xs font-bold whitespace-nowrap overflow-hidden text-ellipsis">{cls}</span>
                                            </label>
                                        ))}
                                    </div>

                                    <div className="pt-4 border-t border-slate-200">
                                        <label className="block text-sm font-bold mb-2 text-slate-700">Add New Class</label>
                                        <div className="flex gap-2">
                                            <input 
                                                type="text"
                                                placeholder="Enter class name..."
                                                value={newClassName}
                                                onChange={(e) => setNewClassName(e.target.value)}
                                                className="flex-1 p-3 border-2 border-slate-200 rounded-xl focus:border-purple-500 outline-none font-bold text-sm"
                                            />
                                            <button 
                                                onClick={() => {
                                                    if (newClassName && !allExistingClasses.includes(newClassName)) {
                                                        setAllExistingClasses([...allExistingClasses, newClassName].sort());
                                                        setSelectedClasses([...selectedClasses, newClassName]);
                                                        setNewClassName('');
                                                    }
                                                }}
                                                className="px-4 bg-slate-800 text-white rounded-xl font-bold hover:bg-black transition-colors"
                                            >
                                                Add
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {wizardStep === 3 && (
                                <div className="space-y-4">
                                     <div className="flex justify-between items-center mb-2">
                                        <div>
                                            <label className="text-sm font-bold text-slate-700 uppercase tracking-wider">Carry over Subjects</label>
                                            <p className="text-[10px] text-slate-500 font-medium">Select subjects and assign/verify faculty for the new semester.</p>
                                        </div>
                                        <div className="flex gap-3">
                                            <button 
                                                onClick={() => {
                                                    const cleared: Record<string, string> = {};
                                                    allExistingSubjects.forEach(s => cleared[s.id] = '');
                                                    setWizardFacultyAssignments(cleared);
                                                }}
                                                className="text-[10px] font-bold text-red-600 hover:text-red-800 flex items-center gap-1"
                                            >
                                                <i className="fa-solid fa-eraser"></i> Clear All Faculty
                                            </button>
                                            <button 
                                                onClick={() => setSelectedSubjectIds(selectedSubjectIds.length === allExistingSubjects.length ? [] : allExistingSubjects.map(s => s.id))}
                                                className="text-xs font-bold text-purple-600 hover:text-purple-800"
                                            >
                                                {selectedSubjectIds.length === allExistingSubjects.length ? 'Deselect All' : 'Select All'}
                                            </button>
                                        </div>
                                    </div>

                                    <div className="space-y-3 p-4 bg-slate-50 rounded-xl border-2 border-slate-100 max-h-[400px] overflow-y-auto shadow-inner">
                                        {allExistingSubjects.map(sub => (
                                            <div 
                                                key={sub.id} 
                                                className={`p-4 rounded-xl transition-all border-2 ${
                                                    selectedSubjectIds.includes(sub.id) 
                                                        ? 'bg-white border-purple-200 shadow-sm' 
                                                        : 'bg-slate-50/50 border-transparent opacity-60'
                                                }`}
                                            >
                                                <div className="flex items-start gap-4">
                                                    <div className="pt-1">
                                                        <input 
                                                            type="checkbox" 
                                                            checked={selectedSubjectIds.includes(sub.id)}
                                                            onChange={(e) => {
                                                                if (e.target.checked) setSelectedSubjectIds([...selectedSubjectIds, sub.id]);
                                                                else setSelectedSubjectIds(selectedSubjectIds.filter(id => id !== sub.id));
                                                            }}
                                                            className="w-5 h-5 accent-purple-600 rounded cursor-pointer"
                                                        />
                                                    </div>
                                                    
                                                    <div className="flex-1 space-y-3">
                                                        <div className="flex justify-between items-start">
                                                            <div>
                                                                <div className="text-sm font-black text-slate-900">{sub.name}</div>
                                                                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">
                                                                     Current: {sub.academicYear} • {sub.activeSemester} Sem
                                                                </div>
                                                            </div>
                                                            <div className="text-[10px] font-black text-purple-600 bg-purple-50 px-2 py-0.5 rounded uppercase border border-purple-100">
                                                                {sub.subjectType || 'Subject'}
                                                            </div>
                                                        </div>

                                                        {selectedSubjectIds.includes(sub.id) && (
                                                            <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 space-y-2">
                                                                <label className="block text-[10px] font-black text-slate-400 uppercase">Assigned Faculty (New Term)</label>
                                                                <div className="relative">
                                                                    <i className="fa-solid fa-user-tie absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
                                                                    <input 
                                                                        type="text"
                                                                        placeholder="Enter faculty name or leave blank for self-registration..."
                                                                        value={wizardFacultyAssignments[sub.id] || ''}
                                                                        onChange={(e) => setWizardFacultyAssignments(prev => ({
                                                                            ...prev,
                                                                            [sub.id]: e.target.value
                                                                        }))}
                                                                        className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-700 focus:border-purple-500 outline-none transition-all placeholder:text-slate-300 placeholder:italic"
                                                                    />
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                        {allExistingSubjects.length === 0 && (
                                            <div className="py-12 text-center text-slate-400 font-bold italic bg-white rounded-xl border-2 border-dashed border-slate-200">
                                                No existing subjects found to carry over.
                                            </div>
                                        )}
                                    </div>
                                    <p className="text-[10px] text-slate-500 italic bg-amber-50 p-2 rounded border border-amber-100 border-dashed">
                                        <strong>Note:</strong> Clearing faculty names allows teachers to register their subjects manually later. You can also re-assign them bulk-style above.
                                     </p>
                                    <div className="pt-4 border-t border-slate-200">
                                        <div className="flex justify-between items-center mb-3">
                                            <label className="text-sm font-bold text-slate-700">Add New Subject</label>
                                            <button 
                                                onClick={() => setShowAddSubjectForm(!showAddSubjectForm)}
                                                className="text-xs font-bold text-indigo-600 hover:underline"
                                            >
                                                {showAddSubjectForm ? 'Cancel' : '+ Create New'}
                                            </button>
                                        </div>

                                        {showAddSubjectForm && (
                                            <div className="bg-white border-2 border-slate-200 rounded-xl p-4 space-y-3 shadow-inner">
                                                <div className="grid grid-cols-2 gap-3">
                                                    <div>
                                                        <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Subject Name</label>
                                                        <input 
                                                            type="text"
                                                            value={newSubjectDataInput.name}
                                                            onChange={(e) => setNewSubjectDataInput(prev => ({ ...prev, name: e.target.value }))}
                                                            placeholder="e.g. Mathematics"
                                                            className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Faculty Name</label>
                                                        <input 
                                                            type="text"
                                                            value={newSubjectDataInput.facultyName}
                                                            onChange={(e) => setNewSubjectDataInput(prev => ({ ...prev, facultyName: e.target.value }))}
                                                            placeholder="e.g. Dr. Smith"
                                                            className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold"
                                                        />
                                                    </div>
                                                </div>
                                                <div className="grid grid-cols-2 gap-3">
                                                    <div>
                                                        <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Type</label>
                                                        <select 
                                                            value={newSubjectDataInput.subjectType}
                                                            onChange={(e) => setNewSubjectDataInput(prev => ({ ...prev, subjectType: e.target.value as 'general'|'elective' }))}
                                                            className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold"
                                                        >
                                                            <option value="general">General</option>
                                                            <option value="elective">Elective</option>
                                                        </select>
                                                    </div>
                                                    <div>
                                                         <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Passing (Total)</label>
                                                         <input 
                                                            type="number"
                                                            value={newSubjectDataInput.passingTotal}
                                                            onChange={(e) => setNewSubjectDataInput(prev => ({ ...prev, passingTotal: parseInt(e.target.value) }))}
                                                            className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold"
                                                         />
                                                    </div>
                                                </div>
                                                <div className="grid grid-cols-2 gap-3">
                                                    <div>
                                                        <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Max Internal</label>
                                                        <input 
                                                            type="number"
                                                            value={newSubjectDataInput.maxINT}
                                                            onChange={(e) => setNewSubjectDataInput(prev => ({ ...prev, maxINT: parseInt(e.target.value) }))}
                                                            className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Max External</label>
                                                        <input 
                                                            type="number"
                                                            value={newSubjectDataInput.maxEXT}
                                                            onChange={(e) => setNewSubjectDataInput(prev => ({ ...prev, maxEXT: parseInt(e.target.value) }))}
                                                            className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold"
                                                        />
                                                    </div>
                                                </div>
                                                <button 
                                                    onClick={() => {
                                                        if (newSubjectDataInput.name) {
                                                            const tempId = `temp-${Date.now()}`;
                                                            const newSub: SubjectConfig = {
                                                                id: tempId,
                                                                name: newSubjectDataInput.name,
                                                                facultyName: newSubjectDataInput.facultyName,
                                                                subjectType: newSubjectDataInput.subjectType,
                                                                maxINT: newSubjectDataInput.maxINT,
                                                                maxEXT: newSubjectDataInput.maxEXT,
                                                                passingTotal: newSubjectDataInput.passingTotal,
                                                                targetClasses: selectedClasses.length > 0 ? selectedClasses : allExistingClasses,
                                                                activeSemester: newSemesterData.semester as 'Odd' | 'Even'
                                                            };
                                                            setAllExistingSubjects([...allExistingSubjects, newSub]);
                                                            setSelectedSubjectIds([...selectedSubjectIds, tempId]);
                                                            setNewSubjectDataInput({
                                                                name: '',
                                                                facultyName: '',
                                                                subjectType: 'general',
                                                                maxINT: 20,
                                                                maxEXT: 80,
                                                                passingTotal: 40
                                                            });
                                                            setShowAddSubjectForm(false);
                                                        }
                                                    }}
                                                    className="w-full py-2 bg-slate-800 text-white rounded-xl font-bold hover:bg-black transition-colors text-sm"
                                                >
                                                    Add Subject to List
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                    <p className="text-xs text-slate-500 italic">
                                        <strong>Pro Tip:</strong> Selected subjects will be available in the new semester view. You can always add more in Subject Management later.
                                    </p>
                                </div>
                                )}

                                {wizardStep === 4 && (
                                    <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-300">
                                        <div className="p-6 bg-slate-900 text-white rounded-2xl shadow-xl space-y-4">
                                            <div className="flex items-center gap-4 border-b border-slate-700 pb-4">
                                                <div className="w-12 h-12 bg-purple-500 rounded-xl flex items-center justify-center text-2xl shadow-lg shadow-purple-500/20">
                                                    <i className="fa-solid fa-users-rays"></i>
                                                </div>
                                                <div>
                                                    <h4 className="font-black text-xl leading-none">Student Transition</h4>
                                                    <p className="text-slate-400 text-xs mt-1 uppercase tracking-widest font-bold">Roster Preparation</p>
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-1 gap-3">
                                                <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700 flex justify-between items-center">
                                                    <span className="text-sm text-slate-300 font-bold">Total Students in Selected Classes</span>
                                                    <span className="text-2xl font-black text-purple-400">
                                                        {allExistingStudents.filter(s => selectedClasses.includes(s.className)).length}
                                                    </span>
                                                </div>
                                                
                                                <div className="p-4 bg-purple-500/10 rounded-xl border border-purple-500/20">
                                                    <div className="flex gap-3">
                                                        <i className="fa-solid fa-wand-sparkles text-purple-400 mt-1"></i>
                                                        <div className="space-y-1">
                                                            <p className="text-sm font-bold text-purple-100">Automatic Data Isolation</p>
                                                            <p className="text-xs text-purple-200/70 leading-relaxed uppercase font-black">
                                                                Marks & Attendance will start fresh for {newSemesterData.semester} Semester.
                                                            </p>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="bg-indigo-500/10 p-4 rounded-xl border border-indigo-500/20">
                                                <div className="flex gap-3">
                                                    <i className="fa-solid fa-arrow-up-from-bracket text-indigo-400 mt-1"></i>
                                                    <div className="space-y-1">
                                                        <p className="text-sm font-bold text-indigo-100">Bulk Promotion Process</p>
                                                        <p className="text-xs text-indigo-200/70 leading-relaxed">
                                                            Students remain in their current classes for now. After launch, you will be routed to the <strong>Students Tab</strong> to promote classes to their next level (e.g. S1 → S2) using the Bulk Promotion tool.
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="p-4 bg-slate-50 rounded-xl border-2 border-slate-200 border-dashed">
                                            <p className="text-xs text-slate-500 text-center font-bold">
                                                <i className="fa-solid fa-shield-check mr-1 text-emerald-500"></i>
                                                Historical data (Marks/Attendance) for previous terms will be preserved in the Student Academic History.
                                            </p>
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="p-4 bg-slate-50 border-t flex flex-col-reverse sm:flex-row justify-between gap-3">
                                <div className="w-full sm:w-auto">
                                    {wizardStep > 1 && (
                                        <button
                                            onClick={() => setWizardStep(wizardStep - 1)}
                                            className="w-full sm:w-auto px-6 py-3 sm:py-2 rounded-xl font-bold text-slate-600 hover:bg-slate-200 transition-colors flex items-center justify-center gap-2"
                                            disabled={isOperating}
                                        >
                                            <i className="fa-solid fa-arrow-left"></i> Back
                                        </button>
                                    )}
                                </div>
                                <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                                    <button
                                        onClick={() => setShowNewSemesterModal(false)}
                                        className="w-full sm:w-auto px-6 py-3 sm:py-2 rounded-xl font-bold text-slate-600 hover:bg-slate-200 transition-colors order-last sm:order-first"
                                        disabled={isOperating}
                                    >
                                        Cancel
                                    </button>
                                    {wizardStep < 4 ? (
                                        <button
                                            onClick={() => setWizardStep(wizardStep + 1)}
                                            disabled={isOperating || (wizardStep === 1 && (!newSemesterData.startDate || !newSemesterData.endDate))}
                                            className="w-full sm:w-auto px-8 py-3 sm:py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-bold transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-purple-200/50"
                                        >
                                            Next &nbsp;<i className="fa-solid fa-arrow-right"></i>
                                        </button>
                                    ) : (
                                        <button
                                            onClick={handleStartNewSemester}
                                            disabled={isOperating}
                                            className="w-full sm:w-auto px-8 py-3 sm:py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-emerald-200/50"
                                        >
                                            {isOperating ? (
                                                <><div className="loader-ring w-4 h-4 border-2 border-white"></div> Launching...</>
                                            ) : (
                                                <>Finalize & Launch &nbsp;<i className="fa-solid fa-rocket"></i></>
                                            )}
                                        </button>
                                    )}
                                </div>
                            </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SettingsManagement;
