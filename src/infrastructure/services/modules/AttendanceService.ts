import {
    collection,
    doc,
    getDocs,
    getDoc,
    setDoc,
    query,
    where,
    addDoc,
    updateDoc,
    deleteDoc
} from 'firebase/firestore';
import { BaseDataService } from './BaseDataService';
import { 
    AttendanceRecord, 
    AcademicCalendarEntry
} from '../../../domain/entities/types';
import { AcademicService } from './AcademicService';

/**
 * Consolidated Attendance Storage Strategy:
 * 
 * Instead of 1 document per (class × subject × date) = 96 docs/day,
 * we store 1 document per (class × date) = 12 docs/day.
 * 
 * Document ID: `${className}_${date}` (e.g. "1st Year_2026-04-27")
 * Document structure:
 * {
 *   className: "1st Year",
 *   date: "2026-04-27",
 *   termKey: "2025-2026-Odd",
 *   periods: {
 *     "subjectId1": { presentStudentIds: [...], absentStudentIds: [...], markedBy: "...", markedAt: 123 },
 *     "subjectId2": { ... }
 *   }
 * }
 * 
 * This is an 8× reduction in document count for 8 periods.
 */

export class AttendanceService extends BaseDataService {
    constructor(private academicService: AcademicService) {
        super();
    }

    /**
     * Generate a deterministic document ID for a class+date combo.
     */
    private getDailyDocId(className: string, date: string): string {
        return `${className}_${date}`;
    }

    public async getOverallAttendance(studentId: string, className: string, termKey?: string): Promise<number> {
        try {
            const activeTerm = termKey || this.getCurrentTermKey();
            const subjects = await this.academicService.getAllSubjects(activeTerm);
            const classSubjects = subjects.filter(s => s.targetClasses?.includes(className));
            
            if (classSubjects.length === 0) return 100;

            // Fetch all daily docs for this class in the term (much fewer reads)
            const q = query(
                collection(this.db!, this.attendanceCollection),
                where('className', '==', className),
                where('termKey', '==', activeTerm)
            );
            const snapshot = await getDocs(q);

            let totalClasses = 0;
            let totalPresent = 0;

            for (const docSnap of snapshot.docs) {
                const data = docSnap.data();
                const periods = data.periods || {};

                for (const subject of classSubjects) {
                    const periodData = periods[subject.id];
                    if (periodData) {
                        totalClasses++;
                        if (periodData.presentStudentIds?.includes(studentId)) {
                            totalPresent++;
                        }
                    }
                }
            }

            return totalClasses > 0 ? (totalPresent / totalClasses) * 100 : 100;
        } catch (error) {
            console.error('Error calculating overall attendance:', error);
            return 0;
        }
    }

    /**
     * Get attendance records for a student in a specific subject.
     * Returns AttendanceRecord[] for backward compatibility with existing UI.
     */
    public async getAttendanceForStudent(studentId: string, subjectId: string, termKey?: string): Promise<AttendanceRecord[]> {
        try {
            const activeTerm = termKey || this.getCurrentTermKey();
            const q = query(
                collection(this.db!, this.attendanceCollection),
                where('termKey', '==', activeTerm)
            );
            const snapshot = await getDocs(q);

            const records: AttendanceRecord[] = [];
            for (const docSnap of snapshot.docs) {
                const data = docSnap.data();
                const periodData = data.periods?.[subjectId];
                if (periodData) {
                    records.push({
                        id: docSnap.id,
                        date: data.date,
                        subjectId,
                        className: this.getHistoricalClassName(activeTerm, data.className),
                        presentStudentIds: periodData.presentStudentIds || [],
                        absentStudentIds: periodData.absentStudentIds || [],
                        markedBy: periodData.markedBy || '',
                        markedAt: periodData.markedAt || 0,
                        academicYear: data.academicYear,
                        semester: data.semester
                    });
                }
            }
            return records;
        } catch (error) {
            console.error('Error fetching attendance records:', error);
            return [];
        }
    }

    public async saveAttendanceRecord(record: Omit<AttendanceRecord, 'id'>): Promise<string> {
        // Redirect to markAttendance for consolidated storage
        return this.markAttendance(record);
    }

    public async deleteAttendanceRecord(id: string): Promise<void> {
        // Fallback or legacy support
        try {
            await deleteDoc(doc(this.db!, this.attendanceCollection, id));
        } catch (error) {
            console.error('Error deleting attendance record:', error);
            throw error;
        }
    }

    public async deleteAttendancePeriod(virtualId: string): Promise<void> {
        try {
            const lastUnderscoreIndex = virtualId.lastIndexOf('_');
            if (lastUnderscoreIndex === -1) {
                // If it's not a virtual ID, delete the whole doc
                await deleteDoc(doc(this.db!, this.attendanceCollection, virtualId));
                return;
            }

            const docId = virtualId.substring(0, lastUnderscoreIndex);
            const subjectId = virtualId.substring(lastUnderscoreIndex + 1);

            const docRef = doc(this.db!, this.attendanceCollection, docId);
            const docSnap = await getDoc(docRef);

            if (docSnap.exists()) {
                const data = docSnap.data();
                const periods = data.periods || {};
                
                if (periods[subjectId]) {
                    // Create a copy without the deleted period
                    const { [subjectId]: removed, ...remainingPeriods } = periods;
                    
                    if (Object.keys(remainingPeriods).length === 0) {
                        // If no periods left, delete the entire daily document
                        await deleteDoc(docRef);
                    } else {
                        // Otherwise, only update the document to remove the specific period
                        await updateDoc(docRef, {
                            periods: remainingPeriods
                        });
                    }
                }
            }
        } catch (error) {
            console.error('Error deleting attendance period:', error);
            throw error;
        }
    }

    public async getAcademicCalendar(termKey?: string): Promise<AcademicCalendarEntry[]> {
        try {
            const activeTerm = termKey || this.getCurrentTermKey();
            const q = query(
                collection(this.db!, this.academicCalendarCollection),
                where('termKey', '==', activeTerm)
            );
            const querySnapshot = await getDocs(q);
            return querySnapshot.docs.map(d => ({ id: d.id, ...d.data() } as AcademicCalendarEntry));
        } catch (error) {
            console.error('Error fetching academic calendar:', error);
            return [];
        }
    }

    public async calculateAttendancePercentage(studentId: string, subjectId: string, termKey?: string): Promise<number> {
        try {
            const records = await this.getAttendanceForStudent(studentId, subjectId, termKey);
            if (records.length === 0) return 100;
            
            const presentCount = records.filter(r => r.presentStudentIds.includes(studentId)).length;
            const percentage = (presentCount / records.length) * 100;
            return Math.round(percentage * 10) / 10;
        } catch (error) {
            console.error('Error calculating per-subject attendance percentage:', error);
            return 0;
        }
    }

    /**
     * Get the consolidated daily attendance document for a class+date.
     * Returns all periods' attendance in one read.
     */
    public async getAttendanceByClassAndDate(className: string, date: string): Promise<AttendanceRecord[]> {
        try {
            const docId = this.getDailyDocId(className, date);
            const docSnap = await getDoc(doc(this.db!, this.attendanceCollection, docId));

            if (!docSnap.exists()) return [];

            const data = docSnap.data();
            const periods = data.periods || {};

            // Expand each period entry into an AttendanceRecord for UI compatibility
            return Object.entries(periods).map(([subjectId, periodData]: [string, any]) => ({
                id: docSnap.id,
                date: data.date,
                subjectId,
                className: this.getHistoricalClassName(this.getCurrentTermKey(data.className), data.className),
                presentStudentIds: periodData.presentStudentIds || [],
                absentStudentIds: periodData.absentStudentIds || [],
                markedBy: periodData.markedBy || '',
                markedAt: periodData.markedAt || 0,
                academicYear: data.academicYear,
                semester: data.semester
            }));
        } catch (error) {
            console.error('Error fetching attendance by class and date:', error);
            return [];
        }
    }

    /**
     * Mark attendance — consolidated storage.
     * Merges this subject's attendance into the single daily document for this class+date.
     * Uses setDoc with merge to only write the changed period, not rewrite the whole doc.
     * 
     * Result: 1 document per class per day, regardless of how many periods are marked.
     */
    public async markAttendance(record: Omit<AttendanceRecord, 'id'>): Promise<string> {
        try {
            const docId = this.getDailyDocId(record.className, record.date);
            const docRef = doc(this.db!, this.attendanceCollection, docId);
            
            // Resolve term key for THIS specific class to support per-class semester shifts
            const termKey = this.getCurrentTermKey(record.className);
            
            const parts = termKey.split('-');
            const sem = parts.pop() as 'Odd' | 'Even';
            const year = parts.join('-');

            // 1. Ensure the base daily document exists with correct metadata
            await setDoc(docRef, this.sanitize({
                className: record.className,
                date: record.date,
                termKey,
                academicYear: year,
                semester: sem
            }), { merge: true });

            // 2. Use updateDoc for dot-notation to update only the specific period
            // This prevents overwriting other periods in the same day
            await updateDoc(docRef, {
                [`periods.${record.subjectId}`]: {
                    presentStudentIds: record.presentStudentIds,
                    absentStudentIds: record.absentStudentIds,
                    markedBy: record.markedBy,
                    markedAt: record.markedAt
                }
            });

            return docId;
        } catch (error) {
            console.error('Error marking attendance:', error);
            throw error;
        }
    }

    /**
     * Get all attendance records for a specific term.
     * Expands consolidated documents into individual period records for the UI.
     */
    public async getAllAttendanceRecords(termKey?: string): Promise<AttendanceRecord[]> {
        try {
            const activeTerm = termKey || this.getCurrentTermKey();
            const q = query(
                collection(this.db!, this.attendanceCollection),
                where('termKey', '==', activeTerm)
            );
            const snapshot = await getDocs(q);
            
            const allRecords: AttendanceRecord[] = [];
            
            snapshot.docs.forEach(docSnap => {
                const data = docSnap.data();
                const periods = data.periods || {};
                
                Object.entries(periods).forEach(([subjectId, periodData]: [string, any]) => {
                    allRecords.push({
                        id: `${docSnap.id}_${subjectId}`, // Virtual ID for UI
                        date: data.date,
                        subjectId,
                        className: this.getHistoricalClassName(activeTerm, data.className),
                        presentStudentIds: periodData.presentStudentIds || [],
                        absentStudentIds: periodData.absentStudentIds || [],
                        markedBy: periodData.markedBy || '',
                        markedAt: periodData.markedAt || 0,
                        academicYear: data.academicYear,
                        semester: data.semester
                    });
                });
            });
            
            return allRecords.sort((a, b) => b.markedAt - a.markedAt);
        } catch (error) {
            console.error('Error fetching all attendance records:', error);
            return [];
        }
    }

    /**
     * Mark a special day (leave/program) for tracking attendance exceptions.
     */
    public async markSpecialDay(specialDay: { date: string; type: string; note: string; className?: string }): Promise<string> {
        try {
            const termKey = this.getCurrentTermKey();
            const docRef = await addDoc(collection(this.db!, this.specialDaysCollection), this.sanitize({
                ...specialDay,
                termKey,
                createdAt: Date.now()
            }));
            return docRef.id;
        } catch (error) {
            console.error('Error marking special day:', error);
            throw error;
        }
    }
}
