import {
    collection,
    doc,
    getDocs,
    getDoc,
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

export class AdministrativeService extends BaseDataService {
    constructor(
        private supplementaryService: SupplementaryService,
        private studentService: StudentService
    ) {
        super();
    }

    public async getAllApplications(termKey?: string): Promise<StudentApplication[]> {
        let q = query(collection(this.db, this.applicationsCollection));
        
        if (termKey && termKey !== 'All') {
            // termKey can be "2025-2026-Odd" or "2026-Even"
            // appliedYear stores "2025-2026" or "2026", appliedSemester stores "Odd" or "Even"
            const parts = termKey.split('-');
            const sem = parts.pop()!; // Last part is always the semester (Odd/Even)
            const year = parts.join('-'); // Everything before is the academic year
            q = query(q, 
                where('appliedYear', '==', year),
                where('appliedSemester', '==', sem)
            );
        }

        const querySnapshot = await getDocs(q);
        return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as StudentApplication));
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

    public async downloadFullSystemBackup(): Promise<void> {
        try {
            console.log('Initiating Full System Backup (JSON)...');
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
            link.download = `AIC_Dawa_Portal_Master_Backup_${timestamp}.json`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Error during Master Backup:', error);
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

    public async deleteSemesterData(termKey: string): Promise<void> {
        try {
            const students = await getDocs(collection(this.db, this.studentsCollection));
            await this.runBatchedOperation(students.docs, (batch, d) => {
                batch.update(d.ref, { [`academicHistory.${termKey}`]: deleteField() });
            });

            // Check if deleted term is the current active term and reset it
            const settingsDocRef = doc(this.db, 'settings', 'global_admin_settings');
            const settingsDoc = await getDoc(settingsDocRef);
            if (settingsDoc.exists()) {
                const settings = settingsDoc.data();
                const currentStr = settings.currentAcademicYear && settings.currentSemester 
                    ? `${settings.currentAcademicYear}-${settings.currentSemester}` 
                    : settings.currentAcademicYear || "";
                    
                if (currentStr === termKey) {
                    await updateDoc(settingsDocRef, {
                        currentAcademicYear: deleteField(),
                        currentSemester: deleteField()
                    });
                }
            }

            this.invalidateCache();
        } catch (error) {
            console.error('Error deleting semester data:', error);
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
                                    needsUpdate = true;
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
}
