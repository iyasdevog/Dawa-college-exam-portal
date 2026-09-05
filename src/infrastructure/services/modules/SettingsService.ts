import {
    collection,
    doc,
    getDoc,
    getDocs,
    updateDoc,
    setDoc,
    onSnapshot
} from 'firebase/firestore';
import { BaseDataService } from './BaseDataService';
import type { 
    GlobalSettings, 
    StudentRecord,
    ClassReleaseSettings
} from '../../../domain/entities/types';
import { SYSTEM_CLASSES } from '../../../domain/entities/constants';
import { StudentService } from './StudentService';

const SYSTEM_AND_HISTORICAL = [...SYSTEM_CLASSES, 'S1', 'S2', 'P1', 'P2', 'Bridge', 'Prep'];

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
                const rawCustom: string[] = data.customClasses || [];
                const cleanCustom = rawCustom.filter(c => c && !SYSTEM_AND_HISTORICAL.includes(c));

                BaseDataService.currentGlobalSettings = {
                    ...data,
                    currentAcademicYear: data.currentAcademicYear || '2025-2026',
                    currentSemester: data.currentSemester || 'Odd',
                    availableYears: data.availableYears || ['2023-2024', '2024-2025', '2025-2026'],
                    attendanceStartDate: data.attendanceStartDate || '2026-04-01',
                    attendanceEndDate: data.attendanceEndDate || '2026-08-31',
                    minAttendancePercentage: data.minAttendancePercentage || 75,
                    semesters: data.semesters || [],
                    customClasses: cleanCustom,
                    disabledClasses: data.disabledClasses || [],
                    institutionName: data.institutionName || 'Islamic Dawa Academy',
                    contactEmail: data.contactEmail || 'examinations@aicdawacollege.edu.in',
                    contactPhone: data.contactPhone || '+91-483-2734567',
                    systemAlias: data.systemAlias || 'AIC_Dawa_Portal',
                    classSemesters: data.classSemesters || {},
                    activeAttendanceTerm: data.activeAttendanceTerm,
                    allowedAttendanceTerms: data.allowedAttendanceTerms,
                    activeMarksTerm: data.activeMarksTerm,
                    allowedMarksTerms: data.allowedMarksTerms
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
            const settings = await this.getGlobalSettings();
            BaseDataService.updateStaticSettings(settings);

            const terms = new Set<string>();
            
            // Standard years: always include 2025-2026 and 2026-2027 by default
            terms.add('2025-2026');
            terms.add('2026-2027');
            
            if (settings.currentAcademicYear) {
                terms.add(settings.currentAcademicYear);
            }
            if (settings.availableYears) {
                settings.availableYears.forEach(y => terms.add(y));
            }

            // Discover from student academic history
            const students = await this.studentService.getAllStudents('All');
            students.forEach(s => {
                if (s.academicHistory) {
                    Object.keys(s.academicHistory).forEach(tk => {
                        const lastHyphenIndex = tk.lastIndexOf('-');
                        if (tk.endsWith('-Odd') || tk.endsWith('-Even') || tk.endsWith('-Bridge')) {
                            const year = tk.substring(0, lastHyphenIndex);
                            if (year.match(/^\d{4}(?:-\d{4})?$/)) {
                                terms.add(year);
                            }
                        } else if (tk.match(/^\d{4}(?:-\d{4})?$/)) {
                            terms.add(tk);
                        }
                    });
                }
            });

            return Array.from(terms).sort((a, b) => b.localeCompare(a));
        } catch (error) {
            console.error('Error getting available terms:', error);
            return ['2026-2027', '2025-2026'];
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
    public async getReleaseSettings(termKey?: string): Promise<ClassReleaseSettings> {
        try {
            const activeTerm = termKey || this.getCurrentTermKey();
            const docRef = doc(this.db, this.settingsCollection, `release_settings_${activeTerm}`);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) return docSnap.data() as ClassReleaseSettings;

            // Fallback to legacy single document release_settings if term-specific document doesn't exist yet
            const legacyRef = doc(this.db, this.settingsCollection, 'release_settings');
            const legacySnap = await getDoc(legacyRef);
            return legacySnap.exists() ? legacySnap.data() as ClassReleaseSettings : {};
        } catch (error) {
            console.error('Error fetching release settings:', error);
            return {};
        }
    }

    public async updateReleaseSettings(settings: ClassReleaseSettings, termKey?: string): Promise<void> {
        try {
            const activeTerm = termKey || this.getCurrentTermKey();
            const docRef = doc(this.db, this.settingsCollection, `release_settings_${activeTerm}`);
            await setDoc(docRef, settings, { merge: true });

            // Also keep legacy updated if active term for fallback compatibility
            if (activeTerm === this.getCurrentTermKey()) {
                const legacyRef = doc(this.db, this.settingsCollection, 'release_settings');
                await setDoc(legacyRef, settings, { merge: true });
            }
        } catch (error) {
            console.error('Error updating release settings:', error);
            throw error;
        }
    }

    public subscribeToGlobalSettings(callback: (settings: GlobalSettings) => void): () => void {
        try {
            const docRef = doc(this.db, this.settingsCollection, 'global_admin_settings');
            return onSnapshot(docRef, (docSnap) => {
                if (docSnap.exists()) {
                    const settings = docSnap.data() as GlobalSettings;
                    callback(settings);
                }
            }, (error) => {
                console.warn("Firestore: Global settings subscription error:", error);
            });
        } catch (error) {
            console.warn("Firestore: Could not initialize global settings subscription:", error);
            return () => {};
        }
    }

    public async healStrandedClasses(activeCustomClasses: Set<string>): Promise<void> {
        try {
            const adminSettingsRef = doc(this.db, this.settingsCollection, 'global_admin_settings');
            const adminSettingsDoc = await getDoc(adminSettingsRef);
            
            const orphanedGlobalRef = doc(this.db, this.settingsCollection, 'global');
            const orphanedGlobalDoc = await getDoc(orphanedGlobalRef);
            const orphanedDisabledClasses = orphanedGlobalDoc.exists() ? (orphanedGlobalDoc.data().disabledClasses || []) : [];

            if (adminSettingsDoc.exists()) {
                const settings = adminSettingsDoc.data();
                const existingCustomClasses: string[] = settings.customClasses || [];
                let existingDisabledClasses: string[] = settings.disabledClasses || [];
                
                let hasChanges = false;
                
                // Recover orphaned disabled classes
                orphanedDisabledClasses.forEach((cls: string) => {
                    if (!existingDisabledClasses.includes(cls)) {
                        existingDisabledClasses.push(cls);
                        hasChanges = true;
                    }
                });

                Array.from(activeCustomClasses).forEach(cls => {
                    if (!existingCustomClasses.includes(cls) && cls !== 'All' && !SYSTEM_AND_HISTORICAL.includes(cls)) {
                        existingCustomClasses.push(cls);
                        hasChanges = true;
                    }
                });
                
                const cleanCustom = existingCustomClasses.filter(c => c && !SYSTEM_AND_HISTORICAL.includes(c));

                if (hasChanges || cleanCustom.length !== existingCustomClasses.length) {
                    await updateDoc(adminSettingsRef, {
                        customClasses: Array.from(new Set(cleanCustom)),
                        disabledClasses: Array.from(new Set(existingDisabledClasses))
                    });
                    console.log('SettingsService: Self-Healed stranded custom/disabled classes');
                }
            }
        } catch (error) {
            console.error('Error healing settings:', error);
            throw error;
        }
    }
}
