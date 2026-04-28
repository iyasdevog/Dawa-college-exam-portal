import {
    collection,
    doc,
    getDoc,
    getDocs,
    updateDoc,
    setDoc
} from 'firebase/firestore';
import { BaseDataService } from './BaseDataService';
import { 
    GlobalSettings, 
    StudentRecord,
    ClassReleaseSettings
} from '../../../domain/entities/types';
import { StudentService } from './StudentService';

export class SettingsService extends BaseDataService {
    constructor(private studentService: StudentService) {
        super();
    }

    public async getGlobalSettings(): Promise<GlobalSettings> {
        try {
            const docRef = doc(this.db, this.settingsCollection, 'global_admin_settings');
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                const data = docSnap.data() as any;
                BaseDataService.currentGlobalSettings = {
                    currentAcademicYear: data.currentAcademicYear || '2025-2026',
                    currentSemester: data.currentSemester || 'Odd',
                    availableYears: data.availableYears || ['2023-2024', '2024-2025', '2025-2026'],
                    attendanceStartDate: data.attendanceStartDate || '2026-04-01',
                    attendanceEndDate: data.attendanceEndDate || '2026-08-31',
                    minAttendancePercentage: data.minAttendancePercentage || 75,
                    semesters: data.semesters || [],
                    customClasses: data.customClasses || [],
                    disabledClasses: data.disabledClasses || [],
                    institutionName: data.institutionName || 'Islamic Dawa Academy',
                    contactEmail: data.contactEmail || 'examinations@aicdawacollege.edu.in',
                    contactPhone: data.contactPhone || '+91-483-2734567',
                    systemAlias: data.systemAlias || 'AIC_Dawa_Portal'
                };
                return BaseDataService.currentGlobalSettings;
            }
            return {
                currentAcademicYear: this.DEFAULT_ACADEMIC_YEAR,
                currentSemester: this.DEFAULT_SEMESTER,
                availableYears: ['2025-2026']
            };
        } catch (error) {
            console.error('Error getting global settings:', error);
            return { currentAcademicYear: this.DEFAULT_ACADEMIC_YEAR, currentSemester: this.DEFAULT_SEMESTER };
        }
    }

    public async updateGlobalSettings(updates: Partial<GlobalSettings>): Promise<void> {
        try {
            const docRef = doc(this.db, this.settingsCollection, 'global_admin_settings');
            await setDoc(docRef, updates, { merge: true });
            BaseDataService.currentGlobalSettings = null; // Invalidate local settings cache
        } catch (error) {
            console.error('Error updating global settings:', error);
            throw error;
        }
    }

    public async getAvailableTerms(): Promise<string[]> {
        try {
            const students = await this.studentService.getAllStudents();
            const terms = new Set<string>();
            const settings = await this.getGlobalSettings();
            
            // Re-sync the static settings to ensure getCurrentTermKey uses the latest data
            BaseDataService.updateStaticSettings(settings);
            
            terms.add(this.getCurrentTermKey());

            const allowedYears = new Set(settings.availableYears || [settings.currentAcademicYear]);

            students.forEach(s => {
                if (s.academicHistory) {
                    Object.keys(s.academicHistory).forEach(tk => {
                        const lastHyphenIndex = tk.lastIndexOf('-');
                        if (tk.endsWith('-Odd') || tk.endsWith('-Even')) {
                            const year = tk.substring(0, lastHyphenIndex);
                            if (allowedYears.has(year)) {
                                terms.add(year);
                            }
                        } else if (allowedYears.has(tk)) {
                            terms.add(tk);
                        }
                    });
                }
            });

            return Array.from(terms).sort((a, b) => b.localeCompare(a));
        } catch (error) {
            console.error('Error getting available terms:', error);
            return [];
        }
    }

    public async repairGlobalSettings(): Promise<{ discoveredYears: string[], activeTermSet: string }> {
        try {
            const settings = await this.getGlobalSettings();
            const students = await this.studentService.getAllStudents('All'); // Force fetch all
            
            // Start fresh with only the current year, then discover from students
            const discoveredYears = new Set<string>();
            if (settings.currentAcademicYear) {
                discoveredYears.add(settings.currentAcademicYear);
            }
            
            students.forEach(s => {
                if (s.academicHistory) {
                    Object.keys(s.academicHistory).forEach(tk => {
                        if (s.academicHistory![tk] === null) return;
                        
                        // Robust discovery: Year is everything before the last hyphen
                        const lastHyphenIndex = tk.lastIndexOf('-');
                        if (lastHyphenIndex !== -1) {
                            const yearPart = tk.substring(0, lastHyphenIndex);
                            // Only add if it looks like a year (YYYY or YYYY-YYYY)
                            if (yearPart.match(/^\d{4}(?:-\d{4})?$/)) {
                                discoveredYears.add(yearPart);
                            }
                        }
                    });
                }
            });

            const sortedYears = Array.from(discoveredYears).sort().reverse();
            let newYear = settings.currentAcademicYear;
            let newSem = settings.currentSemester;
            
            // Use the updated settings for term key resolution
            const tempSettings = { ...settings, availableYears: sortedYears };
            BaseDataService.updateStaticSettings(tempSettings);
            const currentTermKey = this.getCurrentTermKey();
            const currentHasData = students.some(s => s.academicHistory?.[currentTermKey]);
            
            if (!currentHasData && sortedYears.length > 0) {
                newYear = sortedYears[0];
                newSem = 'Odd';
            }

            const updatedSettings = {
                ...settings,
                availableYears: sortedYears,
                currentAcademicYear: newYear,
                currentSemester: newSem as 'Odd' | 'Even'
            };

            await this.updateGlobalSettings(updatedSettings);
            return { discoveredYears: sortedYears, activeTermSet: `${newYear}-${newSem}` };
        } catch (error) {
            console.error('Error repairing global settings:', error);
            throw error;
        }
    }

    public async syncAllAvailableYears(): Promise<{ updated: boolean }> {
        try {
            const result = await this.repairGlobalSettings();
            return { updated: result.discoveredYears.length > 0 };
        } catch (error) {
            console.error('Error syncing available years:', error);
            throw error;
        }
    }
    public async getReleaseSettings(): Promise<ClassReleaseSettings> {
        try {
            const docRef = doc(this.db, this.settingsCollection, 'release_settings');
            const docSnap = await getDoc(docRef);
            return docSnap.exists() ? docSnap.data() as ClassReleaseSettings : {};
        } catch (error) {
            console.error('Error fetching release settings:', error);
            return {};
        }
    }

    public async updateReleaseSettings(settings: ClassReleaseSettings): Promise<void> {
        try {
            const docRef = doc(this.db, this.settingsCollection, 'release_settings');
            await setDoc(docRef, settings, { merge: true });
        } catch (error) {
            console.error('Error updating release settings:', error);
            throw error;
        }
    }
}
