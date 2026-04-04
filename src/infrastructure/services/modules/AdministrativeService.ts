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

    public async getAllApplications(): Promise<StudentApplication[]> {
        const querySnapshot = await getDocs(collection(this.db, this.applicationsCollection));
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
    ): Promise<{ processed: number; students: number; subjects: number }> {
        try {
            console.log(`Starting restoration for ${termKey}...`);
            const parts = termKey.split('-');
            const sem = parts.pop()!;
            const year = parts.join('-');

            const studentsRaw = backupJson[this.studentsCollection] || [];
            const subjectsRaw = backupJson[this.subjectsCollection] || [];
            
            let processedStudents = 0;
            let processedSubjects = 0;

            // 1. Process Subjects first to ensure they exist for the term
            if (subjectsRaw.length > 0) {
                await this.runBatchedOperation(subjectsRaw, (batch, sub) => {
                    const subRef = doc(this.db, this.subjectsCollection, sub.id);
                    const subData = { ...sub };
                    delete subData.id;
                    
                    // Force the subject into the target term
                    subData.academicYear = year;
                    subData.activeSemester = sem;
                    
                    batch.set(subRef, subData, { merge: true });
                    processedSubjects++;
                });
            }

            // 2. Process Students and their academic history
            if (studentsRaw.length > 0) {
                await this.runBatchedOperation(studentsRaw, (batch, stud) => {
                    const studRef = doc(this.db, this.studentsCollection, stud.id);
                    
                    // Prepare the term record
                    const termRecord = {
                        className: stud.currentClass || stud.className || 'Unknown',
                        semester: sem,
                        marks: stud.marks || {},
                        grandTotal: stud.grandTotal || 0,
                        average: stud.average || 0,
                        rank: stud.rank || 0,
                        performanceLevel: stud.performanceLevel || 'Pending'
                    };

                    const updateData: any = {
                        [`academicHistory.${termKey}`]: termRecord
                    };

                    // If it's the newest data, also update top-level currentClass
                    if (forceOverwrite) {
                        updateData.currentClass = termRecord.className;
                    }

                    batch.update(studRef, updateData);
                    processedStudents++;
                });
            }

            this.invalidateCache();
            return { processed: processedStudents + processedSubjects, students: processedStudents, subjects: processedSubjects };
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
    public async repairAndAlignSupplementaryExams(): Promise<{ updated: number; repaired: number }> {
        try {
            const exams = await this.supplementaryService.getAllSupplementaryExams();
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

                // 2. Align semester metadata (ensure examTerm is used)
                if (exam.examTerm && !exam.originalSemester) {
                    const parts = exam.examTerm.split('-');
                    const sem = parts[parts.length - 1]; // Odd or Even
                    if (sem === 'Odd' || sem === 'Even') {
                        updateData.originalSemester = sem as 'Odd' | 'Even';
                        needsUpdate = true;
                        updated++;
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
