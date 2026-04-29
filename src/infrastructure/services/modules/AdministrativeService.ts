import {
    collection,
    doc,
    getDocs,
    getDoc,
    setDoc,
    query,
    where,
    orderBy,
    addDoc,
    updateDoc,
    deleteDoc,
    writeBatch,
    deleteField
} from 'firebase/firestore';
import { BaseDataService } from './BaseDataService';
import { 
    StudentApplication, 
    ApplicationStatus,
    StudentRecord,
    SubjectConfig,
    SpecialDay,
    AcademicCalendarEntry
} from '../../../domain/entities/types';
import { SupplementaryService } from './SupplementaryService';
import { StudentService } from './StudentService';
import { SYSTEM_CLASSES } from '../../../domain/entities/constants';
import { GlobalSettings } from '../../../domain/entities/types';

export class AdministrativeService extends BaseDataService {
    constructor(
        private supplementaryService: SupplementaryService,
        private studentService: StudentService
    ) {
        super();
    }

    public async getAllApplications(termKey?: string): Promise<StudentApplication[]> {
        try {
            const q = query(collection(this.db, this.applicationsCollection));
            const querySnapshot = await getDocs(q);
            let apps = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as StudentApplication));
            
            if (termKey && termKey !== 'All') {
                const parts = termKey.split('-');
                const sem = parts.pop()!;
                const year = parts.join('-');
                
                apps = apps.filter(app => {
                    // Match by termKey if present
                    if ((app as any).termKey === termKey) return true;
                    if ((app as any).appliedTerm === termKey) return true;

                    // Support multi-year format (2025-2026) and single year format (2025)
                    const appYear = String(app.appliedYear || '');
                    const yearMatch = appYear === year || year.includes(appYear) || appYear.includes(year);
                    
                    return yearMatch && app.appliedSemester === sem;
                });
            }

            // Also sort by creation date descending
            return apps.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        } catch (error) {
            console.error('Error fetching all applications:', error);
            return [];
        }
    }

    public async getApplicationsByAdNo(adNo: string): Promise<StudentApplication[]> {
        try {
            const q = query(
                collection(this.db, this.applicationsCollection), 
                where('adNo', '==', adNo), 
                orderBy('createdAt', 'desc')
            );
            const querySnapshot = await getDocs(q);
            return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as StudentApplication));
        } catch (error) {
            console.error('Error fetching applications by AdNo:', error);
            const querySnapshot = await getDocs(collection(this.db, this.applicationsCollection));
            return querySnapshot.docs
                .map(doc => ({ id: doc.id, ...doc.data() } as StudentApplication))
                .filter(app => app.adNo === adNo)
                .sort((a, b) => b.createdAt - a.createdAt);
        }
    }

    public async updateApplicationStatus(id: string, status: ApplicationStatus, adminComment?: string): Promise<void> {
        try {
            const appRef = doc(this.db, this.applicationsCollection, id);
            const updates = this.sanitize({ status, adminComment });
            await updateDoc(appRef, updates);

            if (status === 'approved') {
                const docSnap = await getDoc(appRef);
                const application = { id: docSnap.id, ...docSnap.data() } as StudentApplication;
                if (application && ['improvement', 'revaluation', 'external-supp', 'internal-supp', 'special-supp'].includes(application.type)) {
                    await this.supplementaryService.syncApplicationToSupplementary(application);
                }
            }
        } catch (error) {
            console.error('Error updating application status:', error);
            throw error;
        }
    }

    public async deleteApplication(id: string): Promise<void> {
        try {
            const appRef = doc(this.db, this.applicationsCollection, id);
            await deleteDoc(appRef);
            this.invalidateCache();
        } catch (error) {
            console.error('Error deleting application:', error);
            throw error;
        }
    }

    public async submitApplication(application: Omit<StudentApplication, 'id' | 'status' | 'createdAt'>): Promise<string> {
        try {
            const docRef = await addDoc(collection(this.db, this.applicationsCollection), {
                ...application,
                status: 'pending',
                createdAt: Date.now()
            });
            this.invalidateCache();
            return docRef.id;
        } catch (error) {
            console.error('Error submitting application:', error);
            throw error;
        }
    }

    public async backfillApprovedApplications(): Promise<number> {
        try {
            console.log('Starting backfill of approved applications to supplementary...');
            // Invalidate cache to ensure we get fresh data
            this.invalidateCache();
            
            // Get all applications regardless of term
            const q = query(collection(this.db, this.applicationsCollection));
            const snapshot = await getDocs(q);
            const allApps = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as StudentApplication));
            
            const approvedApps = allApps.filter(app => {
                const isApproved = app.status === 'approved';
                const type = (app.type || '').toLowerCase();
                const isSuppType = ['improvement', 'revaluation', 'external-supp', 'internal-supp', 'special-supp', 'external supp', 'internal supp', 'special supp'].includes(type);
                return isApproved && isSuppType;
            });
            
            let processedCount = 0;
            for (const application of approvedApps) {
                try {
                    // Force the type to lowercase with hyphen for internal consistency if it has spaces
                    if (application.type) {
                        application.type = (application.type as string).toLowerCase().replace(' ', '-') as any;
                    }
                    await this.supplementaryService.syncApplicationToSupplementary(application);
                    processedCount++;
                } catch (err) {
                    console.error(`Failed to sync legacy application ${application.id}:`, err);
                }
            }
            
            // Phase 2: Enrich existing supplementary records with missing metadata (Repair)
            await this.supplementaryService.enrichAllSupplementaryMetadata();
            
            return processedCount;
        } catch (error) {
            console.error('Error backfilling applications:', error);
            throw error;
        }
    }

    public async downloadFullSystemBackup(): Promise<void> {
        try {
            console.log('Initiating Full System Backup (JSON)...');
            const settings = await this.getDocData<GlobalSettings>(this.settingsCollection, 'global_admin_settings');
            const alias = settings?.systemAlias || 'AIC_Dawa_Portal';
            
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
            const backup: Record<string, any[]> = {};
            
            const collectionsToBackup = [
                this.studentsCollection,
                this.subjectsCollection,
                this.settingsCollection,
                this.applicationsCollection,
                this.supplementaryExamsCollection,
                this.attendanceCollection,
                this.timetablesCollection,
                this.specialDaysCollection,
                this.examTimetablesCollection,
                this.hallTicketSettingsCollection,
                this.academicCalendarCollection,
                this.generatorConfigsCollection
            ];

            for (const colName of collectionsToBackup) {
                const q = query(collection(this.db, colName));
                const snapshot = await getDocs(q);
                backup[colName] = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            }

            const backupData = JSON.stringify(backup, null, 2);
            const blob = new Blob([backupData], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            
            const link = document.createElement('a');
            link.href = url;
            link.download = `${alias}_Master_Backup_${timestamp}.json`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Error during Master Backup:', error);
            throw error;
        }
    }

    public async getClassesByTerm(termKey?: string): Promise<string[]> {
        const settings = await this.getDocData<GlobalSettings>(this.settingsCollection, 'global_admin_settings');
        const currentTermKey = settings ? `${settings.currentAcademicYear}-${settings.currentSemester}` : null;
        const requestedTermKey = termKey || currentTermKey;
        const disabled = settings?.disabledClasses || [];

        if (!requestedTermKey) return SYSTEM_CLASSES.filter(c => !disabled.includes(c));

        const isCurrentTerm = requestedTermKey === currentTermKey;
        const activeClassesSet = new Set<string>();

        // For current term: seed with all configured classes so admins can set up any class
        if (isCurrentTerm) {
            const custom = settings?.customClasses || [];
            [...SYSTEM_CLASSES, ...custom]
                .filter(c => c && c !== '-' && !disabled.includes(c))
                .forEach(c => activeClassesSet.add(c));
        }

        // Always: discover from actual Student Records for this specific term
        const studentsSnapshot = await getDocs(collection(this.db, this.studentsCollection));
        studentsSnapshot.docs.forEach(docSnap => {
            const data = docSnap.data() as StudentRecord;
            const termRecord = data.academicHistory?.[requestedTermKey];
            if (termRecord?.className) {
                activeClassesSet.add(termRecord.className.trim());
            }
            // For current term, also consider currentClass of active students
            if (isCurrentTerm && data.isActive !== false && data.currentClass) {
                activeClassesSet.add(data.currentClass.trim());
            }
        });

        // For current term only: discover from Subject assignments
        // (Historical terms rely solely on student records — subjects with 'Both' semester
        //  would otherwise pull in classes like HS1/FS1 that hadn't started yet)
        if (isCurrentTerm) {
            const subjectsSnap = await getDocs(collection(this.db, this.subjectsCollection));
            const parts = requestedTermKey.split('-');
            const targetSem = parts.pop();
            const targetYear = parts.join('-');

            subjectsSnap.docs.forEach(doc => {
                const s = doc.data() as SubjectConfig;
                const isYearMatch = s.academicYear === targetYear ||
                    (s.academicYear && targetYear && (s.academicYear.includes(targetYear) || targetYear.includes(s.academicYear)));
                if (isYearMatch && (s.activeSemester === targetSem || s.activeSemester === 'Both')) {
                    (s.targetClasses || []).forEach(cls => activeClassesSet.add(cls.trim()));
                }
            });
        }

        // Map all to historical display aliases and deduplicate
        return Array.from(new Set(
            Array.from(activeClassesSet)
                .filter(c => {
                    if (!c || c === '-' || disabled.includes(c)) return false;

                    // Specific Fix: HS1 and FS1 just joined in 2025-2026-Even.
                    // They must not appear in historical Odd semester filters/reports.
                    if (requestedTermKey === '2025-2026-Odd' && (c === 'HS1' || c === 'FS1')) {
                        return false;
                    }

                    return true;
                })
                .map(c => this.getHistoricalClassName(requestedTermKey, c))
        )).sort();
    }


    public async restoreFullSystemFromBackup(backupJson: Record<string, any[]>): Promise<any> {
        try {
            console.log(`Starting FULL system wipe and master restoration...`);
            
            // Helper to get collection data regardless of case
            const normalizeBackup = (json: any) => {
                const normalized: Record<string, any[]> = {};
                Object.keys(json).forEach(key => {
                    normalized[key.toLowerCase()] = json[key];
                });
                return normalized;
            };

            const data = normalizeBackup(backupJson);
            const studentsRaw = data[this.studentsCollection.toLowerCase()] || [];
            const subjectsRaw = data[this.subjectsCollection.toLowerCase()] || [];
            
            // 1. Wipe Everything Safely
            console.log('Wiping collections...');
            await Promise.all([
                this.clearAllData(this.studentsCollection),
                this.clearAllData(this.subjectsCollection),
                this.clearAllData(this.applicationsCollection),
                this.clearAllData(this.supplementaryExamsCollection),
                this.clearAllData(this.academicCalendarCollection),
                this.clearAllData(this.specialDaysCollection),
                this.clearAllData('class_configs'),
                this.clearAllData('timetable'),
                this.clearAllData('exam_timetable'),
                this.clearAllData('curriculum')
            ]);
            
            // We manually wipe settings to guarantee a fresh state without corrupting the singleton paradigm completely
            await this.clearAllData(this.settingsCollection);

            let studentsRestored = 0;
            let subjectsRestored = 0;

            // 2. Restore Subjects Exactly as Backup (The source of truth)
            if (subjectsRaw.length > 0) {
                await this.runBatchedOperation(subjectsRaw, (batch, sub) => {
                    const subRef = doc(this.db, this.subjectsCollection, sub.id);
                    const { id, ...subData } = sub;
                    batch.set(subRef, subData);
                    subjectsRestored++;
                });
            }

            // Map subjects for quick metadata snapshot generation
            const subjectMap = new Map<string, any>();
            subjectsRaw.forEach(s => subjectMap.set(s.id, s));

            // 3. Restore Students and UPGRADE data formats
            if (studentsRaw.length > 0) {
                await this.runBatchedOperation(studentsRaw, (batch, stud) => {
                    const studRef = doc(this.db, this.studentsCollection, stud.id);
                    const { id, ...topLevelData } = stud;
                    
                    // UPGRADE PROTOCOL: Synthesize missing metadata snapshots!
                    if (topLevelData.academicHistory) {
                        Object.entries(topLevelData.academicHistory).forEach(([termKey, termRecord]: [string, any]) => {
                            if (termRecord.marks && !termRecord.subjectMetadata) {
                                termRecord.subjectMetadata = {};
                                Object.keys(termRecord.marks).forEach(subId => {
                                    const sourceSub = subjectMap.get(subId);
                                    if (sourceSub) {
                                        termRecord.subjectMetadata[subId] = {
                                            name: sourceSub.name || 'Unknown Subject',
                                            arabicName: sourceSub.arabicName || '',
                                            maxINT: sourceSub.maxINT || 20,
                                            maxEXT: sourceSub.maxEXT || 80,
                                            passingTotal: sourceSub.passingTotal || 40,
                                            facultyName: sourceSub.facultyName || '',
                                            subjectType: sourceSub.subjectType || 'general',
                                            timestamp: Date.now()
                                        };
                                    }
                                });
                            }
                        });
                    }

                    batch.set(studRef, topLevelData);
                    studentsRestored++;
                });
            }

            // Restore other generic collections if present
            const collectionsToRestoreDirectly = [
                this.applicationsCollection, 
                this.supplementaryExamsCollection,
                this.academicCalendarCollection,
                this.specialDaysCollection,
                'class_configs',
                'timetable',
                'exam_timetable',
                'curriculum'
            ];

            const genericRestored: Record<string, number> = {};

            for (const colName of collectionsToRestoreDirectly) {
                const raw = data[colName.toLowerCase()] || [];
                genericRestored[colName] = 0;
                if (raw.length > 0) {
                    await this.runBatchedOperation(raw, (batch, item) => {
                        const ref = doc(this.db, colName, item.id);
                        const { id, ...itemData } = item;
                        batch.set(ref, itemData);
                        genericRestored[colName]++;
                    });
                }
            }

            // Manually restore Global Settings to ensure the system boots up
            const rawSettings = data[this.settingsCollection.toLowerCase()] || [];
            const globalSettingsDoc = rawSettings.find((s:any) => s.id === 'global_admin_settings');
            
            if (globalSettingsDoc) {
                const ref = doc(this.db, this.settingsCollection, 'global_admin_settings');
                const { id, ...setItems } = globalSettingsDoc;
                await setDoc(ref, setItems);
            } else {
                // Failsafe bootstrap
                const ref = doc(this.db, this.settingsCollection, 'global_admin_settings');
                await setDoc(ref, {
                    currentAcademicYear: '2025-2026',
                    currentSemester: 'Odd',
                    availableYears: ['2025-2026']
                });
            }

            this.invalidateCache();

            return {
                status: 'success',
                message: 'System fully wiped and restored from backup. Legacy data successfully upgraded to new Metadata Snapshotting format.',
                stats: {
                    studentsRestored,
                    subjectsRestored,
                    genericRestored
                }
            };
        } catch (error) {
            console.error('Error during master wipe and restore:', error);
            throw error;
        }
    }

    public async restoreTermFromBackup(
        backupJson: Record<string, any[]>,
        termKey: string,
        forceOverwrite = false
    ): Promise<{ 
        processed: number; 
        studentsRestored: number; 
        subjectsRestored: number;
        attendanceRestored: number;
        applicationsRestored: number;
        suppRestored: number;
        examTTRestored: number;
        specialDaysRestored: number;
        calendarRestored: number;
        genConfigsRestored: number;
        skipped: number;
    }> {
        try {
            console.log(`Starting ROBUST enhanced restoration for ${termKey}...`);
            const parts = termKey.split('-');
            const sem = parts.pop()!;
            const year = parts.join('-');

            // Helper to get collection data regardless of case
            const normalizeBackup = (json: any) => {
                const normalized: Record<string, any[]> = {};
                Object.keys(json).forEach(key => {
                    normalized[key.toLowerCase()] = json[key];
                });
                return normalized;
            };

            const data = normalizeBackup(backupJson);
            const studentsRaw = data[this.studentsCollection.toLowerCase()] || [];
            const subjectsRaw = data[this.subjectsCollection.toLowerCase()] || [];
            const applicationsRaw = data[this.applicationsCollection.toLowerCase()] || [];
            const supplementaryRaw = data[this.supplementaryExamsCollection.toLowerCase()] || [];
            
            let studentsRestored = 0;
            let subjectsRestored = 0;
            let applicationsRestored = 0;
            let suppRestored = 0;
            let skipped = 0;

            // 1. Process Subjects
            if (subjectsRaw.length > 0) {
                await this.runBatchedOperation(subjectsRaw, (batch, sub) => {
                    // Restore if it matches OR if we are forcing migration
                    const isSameTerm = sub.academicYear === year && sub.activeSemester === sem;
                    if (isSameTerm || forceOverwrite) {
                        const subRef = doc(this.db, this.subjectsCollection, sub.id);
                        const { id, ...subData } = sub;
                        
                        // Force migration if term is different
                        if (!isSameTerm) {
                            subData.academicYear = year;
                            subData.activeSemester = sem;
                        }
                        
                        batch.set(subRef, subData, { merge: true });
                        subjectsRestored++;
                    } else {
                        skipped++;
                    }
                });
            }

            // 2. Process Students
            if (studentsRaw.length > 0) {
                await this.runBatchedOperation(studentsRaw, (batch, stud) => {
                    const studRef = doc(this.db, this.studentsCollection, stud.id);
                    
                    const backupHistory = stud.academicHistory || {};
                    let termRecord = backupHistory[termKey];
                    
                    if (!termRecord) {
                        // Attempt to find ANY history if specific term is missing
                        const anyHistoryKey = Object.keys(backupHistory)[0];
                        const sourceHistory = anyHistoryKey ? backupHistory[anyHistoryKey] : null;
                        
                        termRecord = {
                            className: sourceHistory?.className || stud.currentClass || stud.className || 'Unknown',
                            semester: sem,
                            marks: sourceHistory?.marks || stud.marks || {},
                            grandTotal: sourceHistory?.grandTotal || stud.grandTotal || 0,
                            average: sourceHistory?.average || stud.average || 0,
                            rank: sourceHistory?.rank || stud.rank || 0,
                            performanceLevel: sourceHistory?.performanceLevel || stud.performanceLevel || 'Pending'
                        };
                    }

                    // Prepare update data with dot-notation for nested history preservation
                    const { id, academicHistory, ...topLevelData } = stud;
                    const studentUpdate: any = {
                        ...topLevelData,
                        [`academicHistory.${termKey}`]: termRecord
                    };

                    if (forceOverwrite) {
                        studentUpdate.currentClass = termRecord.className;
                        studentUpdate.semester = sem;
                    }

                    batch.set(studRef, studentUpdate, { merge: true });
                    studentsRestored++;
                });
            }

            // 3. Process Applications
            if (applicationsRaw.length > 0) {
                await this.runBatchedOperation(applicationsRaw, (batch, app) => {
                    const isSameTerm = app.appliedYear === year && app.appliedSemester === sem;
                    if (isSameTerm || forceOverwrite) {
                        const appRef = doc(this.db, this.applicationsCollection, app.id);
                        const { id, ...appData } = app;
                        
                        if (!isSameTerm) {
                            appData.appliedYear = year;
                            appData.appliedSemester = sem;
                        }
                        
                        batch.set(appRef, appData, { merge: true });
                        applicationsRestored++;
                    } else {
                        skipped++;
                    }
                });
            }

            // 4. Process Supplementary Exams
            if (supplementaryRaw.length > 0) {
                await this.runBatchedOperation(supplementaryRaw, (batch, exam) => {
                    const isSameTerm = exam.examTerm === termKey;
                    if (isSameTerm || forceOverwrite) {
                        const examRef = doc(this.db, this.supplementaryExamsCollection, exam.id);
                        const { id, ...examData } = exam;
                        
                        if (!isSameTerm) {
                            examData.examTerm = termKey;
                        }

                        batch.set(examRef, examData, { merge: true });
                        suppRestored++;
                    } else {
                        skipped++;
                    }
                });
            }

            this.invalidateCache();
            return { 
                processed: studentsRestored + subjectsRestored + applicationsRestored + suppRestored,
                studentsRestored,
                subjectsRestored,
                attendanceRestored: 0,
                applicationsRestored,
                suppRestored,
                examTTRestored: 0,
                specialDaysRestored: 0,
                calendarRestored: 0,
                genConfigsRestored: 0,
                skipped
            };
        } catch (error) {
            console.error('Error restoring from backup:', error);
            throw error;
        }
    }

    public async alignDataToTerms(): Promise<{ specialDaysFixed: number; calendarFixed: number }> {
        try {
            const termKey = this.getCurrentTermKey();
            let specialDaysFixed = 0;
            let calendarFixed = 0;

            const specialDays = await getDocs(collection(this.db, this.specialDaysCollection));
            await this.runBatchedOperation(specialDays.docs, (batch, d) => {
                const data = d.data();
                if (!data.termKey) {
                    batch.update(d.ref, { termKey });
                    specialDaysFixed++;
                }
            });

            const calendar = await getDocs(collection(this.db, this.academicCalendarCollection));
            await this.runBatchedOperation(calendar.docs, (batch, d) => {
                const data = d.data();
                if (!data.termKey) {
                    batch.update(d.ref, { termKey });
                    calendarFixed++;
                }
            });

            return { specialDaysFixed, calendarFixed };
        } catch (error) {
            console.error('Error aligning data:', error);
            throw error;
        }
    }


    public async cleanAndSyncApplications(targetTermKey: string): Promise<{ synced: number; duplicatesDeleted: number; rejectedDeleted: number; notRegistered: number }> {
        try {
            const apps = await this.getAllApplications();
            let synced = 0;
            let duplicatesDeleted = 0;
            let rejectedDeleted = 0;
            let notRegistered = 0;

            const seenApps = new Set<string>();
            const appsToDelete: string[] = [];
            const appsToUpdate: { id: string; data: any }[] = [];

            // targetTermKey is "YEAR-Semester"
            const [targetYear, targetSemester] = targetTermKey.split('-').length === 2 
                ? [targetTermKey.split('-')[0], targetTermKey.split('-')[1]]
                : [targetTermKey.split('-').slice(0, 2).join('-'), targetTermKey.split('-')[2]];

            for (const app of apps) {
                // 1. Handle Rejected Applications
                if (app.status === 'rejected') {
                    appsToDelete.push(app.id);
                    rejectedDeleted++;
                    continue;
                }

                // 2. Identify Duplicates (same student, same type, same subject, same term)
                const appTermKey = `${app.appliedYear}-${app.appliedSemester}`;
                const uniqueKey = `${app.studentId || app.adNo}-${app.type || 'none'}-${app.subjectId || 'none'}-${appTermKey}`;
                if (seenApps.has(uniqueKey)) {
                    appsToDelete.push(app.id);
                    duplicatesDeleted++;
                    continue;
                }
                seenApps.add(uniqueKey);

                // 3. Ensure studentId is valid (Backfill if missing)
                let currentStudentId = app.studentId;
                if (!currentStudentId || currentStudentId === 'undefined') {
                    const student = await this.studentService.getStudentByAdNo(app.adNo);
                    if (student) {
                        currentStudentId = student.id;
                    } else {
                        notRegistered++;
                    }
                }

                // 4. Sync to target term if it's approved or pending and not already there
                if (app.status === 'approved' || app.status === 'pending') {
                    const updateData: any = {};
                    let needsUpdate = false;

                    if (app.appliedYear !== targetYear || app.appliedSemester !== targetSemester) {
                        updateData.appliedYear = targetYear;
                        updateData.appliedSemester = targetSemester as 'Odd' | 'Even';
                        needsUpdate = true;
                    }

                    if (currentStudentId && app.studentId !== currentStudentId) {
                        updateData.studentId = currentStudentId;
                        needsUpdate = true;
                    }

                    if (needsUpdate) {
                        appsToUpdate.push({ id: app.id, data: updateData });
                        synced++;
                    }
                }
            }

            // Execute deletions
            if (appsToDelete.length > 0) {
                await this.runBatchedOperation(appsToDelete, (batch, id) => {
                    batch.delete(doc(this.db, this.applicationsCollection, id));
                });
            }

            // Execute updates
            if (appsToUpdate.length > 0) {
                await this.runBatchedOperation(appsToUpdate, (batch, item) => {
                    batch.update(doc(this.db, this.applicationsCollection, item.id), item.data);
                });
            }

            return { synced, duplicatesDeleted, rejectedDeleted, notRegistered };
        } catch (error) {
            console.error('Error in cleanAndSyncApplications:', error);
            throw error;
        }
    }
    public async repairAndAlignSupplementaryExams(targetExamTerm?: string): Promise<{ updated: number; repaired: number }> {
        try {
            const exams = await this.supplementaryService.getAllSupplementaryExams();
            const allStudents = await this.studentService.getAllStudents('All');
            const studentMap = new Map(allStudents.map(s => [s.id, s]));
            const currentActiveTerm = targetExamTerm || this.getCurrentTermKey();
            
            let updated = 0;
            let repaired = 0;

            const updates: { id: string; data: any }[] = [];

            for (const exam of (exams as any[])) {
                const updateData: any = {};
                let needsUpdate = false;

                // 1. Repair missing studentId from adNo
                if (!exam.studentId || exam.studentId.length < 5) {
                    const student = await this.studentService.getStudentByAdNo(exam.studentAdNo || '');
                    if (student) {
                        updateData.studentId = student.id;
                        needsUpdate = true;
                        repaired++;
                    }
                }

                // 2. Align examTerm to current active term for all pending exams
                if (exam.status !== 'Completed' && exam.examTerm !== currentActiveTerm) {
                    updateData.examTerm = currentActiveTerm;
                    needsUpdate = true;
                    updated++;
                }

                // 3. Derive correct originalTerm from student's academic history
                const student = studentMap.get(exam.studentId);
                if (student?.academicHistory) {
                    for (const [termKey, termRecord] of Object.entries(student.academicHistory)) {
                        const marks = (termRecord as any).marks;
                        if (marks && marks[exam.subjectId]) {
                            const subMark = marks[exam.subjectId];
                            if (subMark.status === 'Failed') {
                                if (exam.originalTerm !== termKey) {
                                    updateData.originalTerm = termKey;
                                    // Also fix originalSemester and originalYear
                                    const parts = termKey.split('-');
                                    const sem = parts.pop();
                                    updateData.originalSemester = sem as 'Odd' | 'Even';
                                    updateData.originalYear = parseInt(parts[0]);
                                    repaired++;
                                }
                                break;
                            }
                        }
                    }
                }

                // 4. Ensure originalSemester is set even if no history match
                if (!exam.originalSemester && exam.originalTerm) {
                    const parts = exam.originalTerm.split('-');
                    const sem = parts[parts.length - 1];
                    if (sem === 'Odd' || sem === 'Even') {
                        updateData.originalSemester = sem as 'Odd' | 'Even';
                        needsUpdate = true;
                    }
                }

                if (needsUpdate) {
                    updates.push({ id: exam.id, data: updateData });
                }
            }

            if (updates.length > 0) {
                await this.runBatchedOperation(updates, (batch, item) => {
                    batch.update(doc(this.db, this.supplementaryExamsCollection, item.id), item.data);
                });
            }

            return { updated, repaired };
        } catch (error) {
            console.error('Error repairing supplementary exams:', error);
            throw error;
        }
    }

    public async getInconsistentTerms(): Promise<string[]> {
        try {
            const snapshot = await getDocs(collection(this.db, this.studentsCollection));
            const foundKeys = new Set<string>();
            
            snapshot.docs.forEach(docSnap => {
                const data = docSnap.data() as StudentRecord;
                if (data.academicHistory) {
                    Object.keys(data.academicHistory).forEach(key => foundKeys.add(key));
                }
            });

            // Standard format: YYYY-Semester or YYYY-YYYY-Semester
            const standardPattern = /^(\d{4}(?:-\d{4})?)-(Odd|Even)$/;
            const inconsistent = Array.from(foundKeys).filter(key => {
                // If it doesn't match standard, it's inconsistent
                return !standardPattern.test(key);
            }).sort();

            return inconsistent;
        } catch (error) {
            console.error('Error detecting inconsistent terms:', error);
            return [];
        }
    }

    public async clearAllSubjects(): Promise<void> {
        return this.clearAllData(this.subjectsCollection);
    }
    
    public async deleteAllSupplementaryExams(): Promise<void> {
        return this.clearAllData(this.supplementaryExamsCollection);
    }

    public async clearAllData(collectionName: string): Promise<void> {
        try {
            const snapshot = await getDocs(collection(this.db, collectionName));
            await this.runBatchedOperation(snapshot.docs, (batch, d) => {
                batch.delete(d.ref);
            });
            this.invalidateCache();
        } catch (error) {
            console.error(`Error clearing ${collectionName}:`, error);
            throw error;
        }
    }

    /**
     * Completely removes a semester term and all associated data.
     */
    public async deleteSemesterData(termKey: string): Promise<{ studentsAffected: number; subjectsDeleted: number }> {
        try {
            console.log(`Deleting all data for term: ${termKey}`);
            
            // 1. Remove from Global Settings availableYears
            const settingsDocRef = doc(this.db, this.settingsCollection, 'global_admin_settings');
            const settingsSnap = await getDoc(settingsDocRef);
            if (settingsSnap.exists()) {
                const settings = settingsSnap.data() as GlobalSettings;
                const updatedYears = (settings.availableYears || []).filter(y => y !== termKey);
                await updateDoc(settingsDocRef, { availableYears: updatedYears });
            }

            // 2. Delete Subjects for this term
            const subjectsSnap = await getDocs(collection(this.db, this.subjectsCollection));
            const subjectsToDelete = subjectsSnap.docs.filter(d => {
                const data = d.data();
                // Match exact termKey if stored, or derived
                return data.termKey === termKey || 
                       (`${data.academicYear}-${data.activeSemester}` === termKey);
            });
            
            await this.runBatchedOperation(subjectsToDelete, (batch, d) => {
                batch.delete(d.ref);
            });

            // 3. Scrub academicHistory from Students
            const studentsSnap = await getDocs(collection(this.db, this.studentsCollection));
            const studentsToUpdate = studentsSnap.docs.filter(d => d.data().academicHistory?.[termKey]);
            
            await this.runBatchedOperation(studentsToUpdate, (batch, d) => {
                batch.update(d.ref, {
                    [`academicHistory.${termKey}`]: deleteField()
                });
            });

            this.invalidateCache();
            return { 
                studentsAffected: studentsToUpdate.length, 
                subjectsDeleted: subjectsToDelete.length 
            };
        } catch (error) {
            console.error(`Error deleting semester ${termKey}:`, error);
            throw error;
        }
    }

    /**
     * Normalizes term keys across the system (e.g., from "2025" to "2025-2026-Odd").
     */
    public async normalizeTermKeys(oldKey: string, newKey: string): Promise<{ studentsUpdated: number; subjectsUpdated: number }> {
        try {
            console.log(`Migrating term data: ${oldKey} -> ${newKey}`);

            // 1. Update Students History
            const studentsSnap = await getDocs(collection(this.db, this.studentsCollection));
            const studentsToUpdate = studentsSnap.docs.filter(d => d.data().academicHistory?.[oldKey]);
            
            await this.runBatchedOperation(studentsToUpdate, (batch, d) => {
                const data = d.data();
                const historyRecord = data.academicHistory[oldKey];
                batch.update(d.ref, {
                    [`academicHistory.${newKey}`]: historyRecord,
                    [`academicHistory.${oldKey}`]: deleteField()
                });
            });

            // 2. Update Subjects
            const subjectsSnap = await getDocs(collection(this.db, this.subjectsCollection));
            const subjectsToUpdate = subjectsSnap.docs.filter(d => {
                const data = d.data();
                return data.termKey === oldKey || (`${data.academicYear}-${data.activeSemester}` === oldKey);
            });

            const lastHyphenIndex = newKey.lastIndexOf('-');
            const newYear = lastHyphenIndex !== -1 ? newKey.substring(0, lastHyphenIndex) : newKey;
            const newSem = lastHyphenIndex !== -1 ? newKey.substring(lastHyphenIndex + 1) : '';

            await this.runBatchedOperation(subjectsToUpdate, (batch, d) => {
                batch.update(d.ref, {
                    termKey: newKey,
                    academicYear: newYear,
                    activeSemester: newSem
                });
            });

            // 3. Update Settings availableYears
            const settingsDocRef = doc(this.db, this.settingsCollection, 'global_admin_settings');
            const settingsSnap = await getDoc(settingsDocRef);
            if (settingsSnap.exists()) {
                const settings = settingsSnap.data() as GlobalSettings;
                let available = settings.availableYears || [];
                if (available.includes(oldKey)) {
                    available = available.map(y => y === oldKey ? newKey : y);
                    // Deduplicate
                    available = Array.from(new Set(available));
                    await updateDoc(settingsDocRef, { availableYears: available });
                }
            }

            this.invalidateCache();
            return { 
                studentsUpdated: studentsToUpdate.length, 
                subjectsUpdated: subjectsToUpdate.length 
            };
        } catch (error) {
            console.error(`Error normalizing term keys ${oldKey} to ${newKey}:`, error);
            throw error;
        }
    }
    public async renameClass(oldNameRaw: string, newNameRaw: string): Promise<void> {
        const oldName = oldNameRaw.trim();
        const newName = newNameRaw.trim();
        if (!oldName || !newName || oldName === newName) return;
        try {
            console.log(`Renaming class from ${oldName} to ${newName}...`);
            
            // 1. Update Global Settings (Custom Classes)
            const settingsRef = doc(this.db, this.settingsCollection, 'global_admin_settings');
            const settingsSnap = await getDoc(settingsRef);
            if (settingsSnap.exists()) {
                const settings = settingsSnap.data();
                const customClasses: string[] = settings.customClasses || [];
                const disabledClasses: string[] = settings.disabledClasses || [];
                
                let updatedCustomClasses: string[];
                let updatedDisabledClasses = [...disabledClasses];

                if (customClasses.includes(oldName)) {
                    // It was already a custom class, just rename it in place
                    updatedCustomClasses = customClasses.map((c: string) => c === oldName ? newName : c);
                } else {
                    // It was a standard class or missing, add the new name to custom classes
                    if (!customClasses.includes(newName)) {
                        updatedCustomClasses = [...customClasses, newName];
                    } else {
                        updatedCustomClasses = [...customClasses];
                    }
                    // Mark the standard class as disabled so it's hidden from UI
                    if (!updatedDisabledClasses.includes(oldName)) {
                        updatedDisabledClasses.push(oldName);
                    }
                }
                
                await updateDoc(settingsRef, { 
                    customClasses: updatedCustomClasses,
                    disabledClasses: updatedDisabledClasses
                });
            }

            // 2. Update Students (currentClass and academicHistory)
            const snapshot = await getDocs(collection(this.db, this.studentsCollection));
            if (!snapshot.empty) {
                await this.runBatchedOperation(snapshot.docs, (batch, d) => {
                    const data = d.data() as StudentRecord;
                    let needsUpdate = false;
                    const updates: any = {};

                    // Trim-safe comparison
                    if (data.currentClass?.trim() === oldName) {
                        updates.currentClass = newName;
                        needsUpdate = true;
                    }

                    if (data.academicHistory) {
                        const history = data.academicHistory || {};
                        const updatedHistory = { ...history };
                        let historyChanged = false;
                        Object.keys(updatedHistory).forEach(termKey => {
                            if (updatedHistory[termKey].className?.trim() === oldName) {
                                updatedHistory[termKey] = { ...updatedHistory[termKey], className: newName };
                                historyChanged = true;
                            }
                        });

                        if (historyChanged) {
                            updates.academicHistory = updatedHistory;
                            needsUpdate = true;
                        }
                    }

                    if (needsUpdate) {
                        batch.update(d.ref, updates);
                    }
                });
            }

            // 3. Update Subjects (targetClasses)
            const subjectsQuery = query(collection(this.db, this.subjectsCollection));
            const subjectSnaps = await getDocs(subjectsQuery);
            if (!subjectSnaps.empty) {
                await this.runBatchedOperation(subjectSnaps.docs, (batch, d) => {
                    const data = d.data();
                    const targetClasses: string[] = data.targetClasses || [];
                    if (targetClasses.includes(oldName)) {
                        const updatedClasses = targetClasses.map((c: string) => c === oldName ? newName : c);
                        batch.update(d.ref, { targetClasses: updatedClasses });
                    }
                });
            }

            // 4. Update Timetables
            const timetablesQuery = query(collection(this.db, this.timetablesCollection), where('className', '==', oldName));
            const timetableSnaps = await getDocs(timetablesQuery);
            if (!timetableSnaps.empty) {
                await this.runBatchedOperation(timetableSnaps.docs, (batch, d) => {
                    batch.update(d.ref, { className: newName });
                });
            }

            // 5. Update Exam Timetables
            const examTimetablesQuery = query(collection(this.db, this.examTimetablesCollection), where('className', '==', oldName));
            const examTimetableSnaps = await getDocs(examTimetablesQuery);
            if (!examTimetableSnaps.empty) {
                await this.runBatchedOperation(examTimetableSnaps.docs, (batch, d) => {
                    batch.update(d.ref, { className: newName });
                });
            }

            this.invalidateCache();
        } catch (error) {
            console.error('Error renaming class:', error);
            throw error;
        }
    }

    /**
     * Forward-Only Rename: updates only active/present-facing records.
     * Leaves academicHistory.className untouched so historical reports
     * still show the original class name as it was during that period.
     */
    public async renameClassForwardOnly(oldName: string, newName: string): Promise<void> {
        try {
            // 0. Update settings (customClasses and disabledClasses)
            const settingsRef = doc(this.db, this.settingsCollection, 'global_admin_settings');
            const settingsDoc = await getDoc(settingsRef);
            
            if (settingsDoc.exists()) {
                const settingsData = settingsDoc.data();
                const customClasses: string[] = settingsData.customClasses || [];
                const disabledClasses: string[] = settingsData.disabledClasses || [];
                
                // Update both custom and disabled classes
                const isCustomClass = customClasses.includes(oldName);
                const updatedCustomClasses = isCustomClass 
                    ? customClasses.map((c: string) => c === oldName ? newName : c)
                    : (customClasses.includes(newName) ? customClasses : [...customClasses, newName]);
                
                const updatedDisabledClasses = [...disabledClasses];
                if (!isCustomClass && !updatedDisabledClasses.includes(oldName)) {
                    updatedDisabledClasses.push(oldName);
                }
                // Ensure newName is NOT disabled
                const finalDisabledClasses = updatedDisabledClasses.filter(c => c !== newName);

                await updateDoc(settingsRef, { 
                    customClasses: updatedCustomClasses,
                    disabledClasses: finalDisabledClasses
                });
            }

            // 1. Update students: only currentClass (NOT academicHistory)
            const studentsQuery = query(collection(this.db, this.studentsCollection));
            const studentSnaps = await getDocs(studentsQuery);
            const studentsToUpdate = studentSnaps.docs.filter(d => {
                const data = d.data();
                return data.currentClass === oldName || data.className === oldName;
            });

            if (studentsToUpdate.length > 0) {
                const settings = await this.getDocData<GlobalSettings>(this.settingsCollection, 'global_admin_settings');
                const currentTermKey = settings ? `${settings.currentAcademicYear}-${settings.currentSemester}` : null;

                await this.runBatchedOperation(studentsToUpdate, (batch, d) => {
                    const data = d.data() as StudentRecord;
                    const updates: any = {};
                    if (data.currentClass === oldName) updates.currentClass = newName;
                    if (data.className === oldName) updates.className = newName;

                    // IMPORTANT: Even for forward-only, we should update the CURRENT term's snapshot
                    // so discovery engine picks up the new name for the active semester.
                    if (currentTermKey && data.academicHistory?.[currentTermKey]) {
                        const history = { ...data.academicHistory };
                        if (history[currentTermKey].className === oldName) {
                            history[currentTermKey] = { ...history[currentTermKey], className: newName };
                            updates.academicHistory = history;
                        }
                    }

                    batch.update(d.ref, updates);
                });
            }

            // 2. Update Subjects (targetClasses only)
            const subjectsQuery = query(collection(this.db, this.subjectsCollection));
            const subjectSnaps = await getDocs(subjectsQuery);
            const subjectsToUpdate = subjectSnaps.docs.filter(d => {
                const data = d.data();
                return (data.targetClasses || []).includes(oldName);
            });

            if (subjectsToUpdate.length > 0) {
                await this.runBatchedOperation(subjectsToUpdate, (batch, d) => {
                    const data = d.data();
                    const updatedClasses = (data.targetClasses as string[]).map(c => c === oldName ? newName : c);
                    batch.update(d.ref, { targetClasses: updatedClasses });
                });
            }

            // 3. Update Timetables (forward-facing only)
            const timetablesQuery = query(collection(this.db, this.timetablesCollection), where('className', '==', oldName));
            const timetableSnaps = await getDocs(timetablesQuery);
            if (!timetableSnaps.empty) {
                await this.runBatchedOperation(timetableSnaps.docs, (batch, d) => {
                    batch.update(d.ref, { className: newName });
                });
            }

            this.invalidateCache();
        } catch (error) {
            console.error('Error in renameClassForwardOnly:', error);
            throw error;
        }
    }

    public async getAllTimetables(termKey?: string): Promise<any[]> {
        const activeTerm = termKey || this.getCurrentTermKey();
        const q = query(
            collection(this.db, this.timetablesCollection),
            where('termKey', '==', activeTerm)
        );
        const snapshot = await getDocs(q);
        return snapshot.docs.map(d => {
            const data = d.data();
            return {
                id: d.id,
                ...data,
                className: this.getHistoricalClassName(activeTerm, data.className)
            };
        });
    }

    public async getTimetableByDay(day: string, termKey?: string): Promise<any[]> {
        const activeTerm = termKey || this.getCurrentTermKey();
        const all = await this.getAllTimetables(activeTerm);
        return all.filter(entry => entry.day === day);
    }

    public async getTimetableByClass(className: string, termKey?: string): Promise<any[]> {
        const activeTerm = termKey || this.getCurrentTermKey();
        const dbClassName = this.getDatabaseClassName(activeTerm, className);
        const q = query(
            collection(this.db, this.timetablesCollection),
            where('className', '==', dbClassName),
            where('termKey', '==', activeTerm)
        );
        const snapshot = await getDocs(q);
        return snapshot.docs.map(d => {
            const data = d.data();
            return { 
                id: d.id, 
                ...data,
                className: this.getHistoricalClassName(activeTerm, data.className)
            };
        });
    }

    public async saveTimetableEntries(entries: any[]): Promise<void> {
        await this.runBatchedOperation(entries, (batch, entry) => {
            const ref = entry.id ? doc(this.db, this.timetablesCollection, entry.id) : doc(collection(this.db, this.timetablesCollection));
            const { id, ...data } = entry;
            batch.set(ref, data, { merge: true });
        });
    }

    public async getExamTimetable(className: string, termKey?: string): Promise<any[]> {
        const activeTerm = termKey || this.getCurrentTermKey();
        const dbClassName = this.getDatabaseClassName(activeTerm, className);
        const q = query(
            collection(this.db, this.examTimetablesCollection),
            where('className', '==', dbClassName),
            where('termKey', '==', activeTerm)
        );
        const snapshot = await getDocs(q);
        return snapshot.docs.map(d => {
            const data = d.data();
            return { 
                id: d.id, 
                ...data,
                className: this.getHistoricalClassName(activeTerm, data.className)
            };
        });
    }

    public async saveExamTimetableEntries(entries: any[]): Promise<void> {
        await this.runBatchedOperation(entries, (batch, entry) => {
            const ref = entry.id ? doc(this.db, this.examTimetablesCollection, entry.id) : doc(collection(this.db, this.examTimetablesCollection));
            const { id, ...data } = entry;
            batch.set(ref, data, { merge: true });
        });
    }

    public async getSpecialDays(termKey?: string): Promise<any[]> {
        const activeTerm = termKey || this.getCurrentTermKey();
        const q = query(collection(this.db, this.specialDaysCollection), where('termKey', '==', activeTerm));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => {
            const data = doc.data();
            return { 
                id: doc.id, 
                ...data,
                className: this.getHistoricalClassName(activeTerm, data.className)
            };
        });
    }

    public async getHallTicketReleaseStatus(termKey?: string): Promise<boolean> {
        const activeTerm = termKey || this.getCurrentTermKey();
        const data = await this.getDocData<any>(this.hallTicketSettingsCollection, activeTerm);
        return data?.isReleased || false;
    }

    public async setHallTicketReleaseStatus(isReleased: boolean, termKey?: string): Promise<void> {
        const activeTerm = termKey || this.getCurrentTermKey();
        const ref = doc(this.db, this.hallTicketSettingsCollection, activeTerm);
        await updateDoc(ref, { isReleased });
    }

    public async updateGlobalSettings(updates: Partial<GlobalSettings>): Promise<void> {
        try {
            const ref = doc(this.db!, this.settingsCollection, 'global_admin_settings');
            await setDoc(ref, updates, { merge: true });
            this.invalidateCache();
        } catch (error) {
            console.error('Error updating global settings:', error);
            throw error;
        }
    }
    public async reconcileClassNames(): Promise<{ renamed: string[]; totalUpdates: number }> {
        const mappings: Record<string, string> = {
            'S1': 'FS2',
            'S2': 'FS3',
            'P2': 'HS3',
            'P1': 'HS2'
        };

        const results = {
            renamed: [] as string[],
            totalUpdates: 0
        };

        try {
            console.log('Starting Class Name Reconciliation audit...');
            const studentsSnap = await getDocs(collection(this.db, this.studentsCollection));
            const settingsRef = doc(this.db, this.settingsCollection, 'global_admin_settings');
            const settingsSnap = await getDoc(settingsRef);
            const settingsData = settingsSnap.exists() ? settingsSnap.data() as GlobalSettings : null;

            for (const [oldName, newName] of Object.entries(mappings)) {
                let studentsAffected = 0;
                
                await this.runBatchedOperation(studentsSnap.docs, (batch, d) => {
                    const data = d.data() as StudentRecord;
                    let needsUpdate = false;
                    const updates: any = {};
                    
                    // Match by currentClass or legacy className field
                    if (data.currentClass?.trim() === oldName || (data as any).className?.trim() === oldName) {
                        updates.currentClass = newName;
                        updates.className = newName;
                        needsUpdate = true;
                    }

                    // Sync academicHistory for all recorded terms
                    if (data.academicHistory) {
                        const history = { ...data.academicHistory };
                        let historyChanged = false;
                        
                        Object.keys(history).forEach(k => {
                            if (history[k].className?.trim() === oldName) {
                                history[k] = { ...history[k], className: newName };
                                historyChanged = true;
                            }
                        });

                        if (historyChanged) {
                            updates.academicHistory = history;
                            needsUpdate = true;
                        }
                    }

                    if (needsUpdate) {
                        batch.update(d.ref, updates);
                        studentsAffected++;
                    }
                });

                // Update settings to ensure visibility is correct
                if (settingsData) {
                    const custom = settingsData.customClasses || [];
                    const disabled = settingsData.disabledClasses || [];
                    
                    if (!custom.includes(newName) || !disabled.includes(oldName)) {
                        const updatedCustom = custom.includes(newName) ? custom : [...custom, newName];
                        const updatedDisabled = disabled.includes(oldName) ? disabled : [...disabled, oldName];
                        
                        await updateDoc(settingsRef, {
                            customClasses: updatedCustom,
                            disabledClasses: updatedDisabled.filter(c => c !== newName) // Ensure new name is active
                        });
                    }
                }

                if (studentsAffected > 0) {
                    console.log(`Successfully migrated ${studentsAffected} records from ${oldName} to ${newName}`);
                    results.renamed.push(`${oldName} → ${newName}`);
                    results.totalUpdates += studentsAffected;
                }
            }
        } catch (error) {
            console.error('Error during reconciliation:', error);
            throw error;
        }

        this.invalidateCache();
        return results;
    }

    /**
     * Merges two class nomenclatures into one. 
     * Useful for fixing duplicates or accidental renames (e.g. merging "S2 " and "S2").
     */
    public async mergeClasses(sourceName: string, targetName: string): Promise<void> {
        return this.renameClass(sourceName, targetName);
    }

    /**
     * Scans and cleans all class nomenclature in the database.
     * Trims whitespace and deduplicates the customClasses list.
     */
    public async normalizeNomenclature(): Promise<{ studentsUpdated: number; classesNormalized: number }> {
        const snapshot = await getDocs(collection(this.db, this.studentsCollection));
        let studentsUpdated = 0;

        if (!snapshot.empty) {
            await this.runBatchedOperation(snapshot.docs, (batch, docSnap) => {
                const data = docSnap.data() as StudentRecord;
                let needsUpdate = false;
                const update: any = {};

                if (data.currentClass && data.currentClass !== data.currentClass.trim()) {
                    update.currentClass = data.currentClass.trim();
                    needsUpdate = true;
                }

                if (data.academicHistory) {
                    const newHistory = { ...data.academicHistory };
                    let historyChanged = false;
                    Object.entries(newHistory).forEach(([termKey, termData]) => {
                        if (termData.className && termData.className !== termData.className.trim()) {
                            newHistory[termKey] = { ...termData, className: termData.className.trim() };
                            historyChanged = true;
                        }
                    });
                    if (historyChanged) {
                        update.academicHistory = newHistory;
                        needsUpdate = true;
                    }
                }

                if (needsUpdate) {
                    batch.update(docSnap.ref, update);
                    studentsUpdated++;
                }
            });
        }

        // Normalize Settings
        const settingsRef = doc(this.db, this.settingsCollection, 'global_admin_settings');
        const settingsSnap = await getDoc(settingsRef);
        let classesNormalized = 0;
        if (settingsSnap.exists()) {
            const customClasses: string[] = settingsSnap.data().customClasses || [];
            const normalized = Array.from(new Set(customClasses.map(c => c.trim()))).filter(c => !SYSTEM_CLASSES.includes(c));
            if (JSON.stringify(normalized) !== JSON.stringify(customClasses)) {
                await updateDoc(settingsRef, { customClasses: normalized });
                classesNormalized = customClasses.length - normalized.length;
            }
        }

        this.invalidateCache();
        return { studentsUpdated, classesNormalized };
    }
}
