import React, { useState } from 'react';
import { dataService } from '../../../infrastructure/services/dataService';

interface SettingsManagementProps {
    onRefresh: () => Promise<void>;
}

const SettingsManagement: React.FC<SettingsManagementProps> = ({ onRefresh }) => {
    const [isOperating, setIsOperating] = useState(false);
    const [importResults, setImportResults] = useState<{ success: number; errors: string[] } | null>(null);
    const [isDangerZoneUnlocked, setIsDangerZoneUnlocked] = useState(false);
    const [unlockPassword, setUnlockPassword] = useState('');
    const DANGER_PASSWORD = 'pleasecareful';

    const verifyPassword = () => {
        const input = prompt('Please enter the security password to confirm this action:');
        if (input === DANGER_PASSWORD) return true;
        if (input !== null) alert('Incorrect password. Action cancelled.');
        return false;
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
                            <p className="text-sm text-slate-600 mb-2">Export all marks to Excel for reporting or backup.</p>
                            <button
                                onClick={handleExportMarks}
                                disabled={isOperating}
                                className="w-full py-3 bg-blue-50 text-blue-700 rounded-xl font-bold hover:bg-blue-100 transition-all flex items-center justify-center gap-2"
                            >
                                <i className="fa-solid fa-download"></i>
                                Export Marks to Excel
                            </button>
                        </div>

                        <div className="border-t border-slate-100 pt-4">
                            <p className="text-sm text-slate-600 mb-2">Import marks from Excel. Existing marks may be updated.</p>
                            <label className={`w-full py-3 bg-emerald-50 text-emerald-700 rounded-xl font-bold hover:bg-emerald-100 transition-all flex items-center justify-center gap-2 cursor-pointer ${isOperating ? 'opacity-50 cursor-not-allowed' : ''}`}>
                                <i className="fa-solid fa-file-excel"></i>
                                {isOperating ? 'Importing...' : 'Import Marks from Excel'}
                                <input
                                    type="file"
                                    accept=".xlsx, .xls"
                                    onChange={handleImportMarks}
                                    disabled={isOperating}
                                    className="hidden"
                                />
                            </label>
                        </div>

                        <div className="border-t border-slate-100 pt-4">
                            <p className="text-sm text-slate-600 mb-2">Recalculate all student performance levels with updated grading thresholds (95%+ = Outstanding).</p>
                            <button
                                onClick={async () => {
                                    if (!confirm('This will recalculate all student performance levels based on the current grading thresholds (95%+ = Outstanding, etc.). Continue?')) return;

                                    try {
                                        setIsOperating(true);
                                        const results = await dataService.recalculateAllStudentPerformanceLevels();
                                        await onRefresh();
                                        alert(`Recalculation complete! ${results.updated} students updated.${results.errors.length > 0 ? `\n\nErrors: ${results.errors.length}` : ''}`);
                                    } catch (error) {
                                        console.error('Error recalculating performance levels:', error);
                                        alert(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
                                    } finally {
                                        setIsOperating(false);
                                    }
                                }}
                                disabled={isOperating}
                                className="w-full py-3 bg-purple-50 text-purple-700 rounded-xl font-bold hover:bg-purple-100 transition-all flex items-center justify-center gap-2"
                            >
                                <i className="fa-solid fa-calculator"></i>
                                {isOperating ? 'Recalculating...' : 'Recalculate Student Grades'}
                            </button>
                        </div>
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
                )}
            </div>
        </div >
    );
};

export default SettingsManagement;
