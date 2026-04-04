import {
    collection,
    doc,
    getDocs,
    getDoc,
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

export class AttendanceService extends BaseDataService {
    constructor(private academicService: AcademicService) {
        super();
    }

    public async getOverallAttendance(studentId: string, className: string, termKey?: string): Promise<number> {
        try {
            const activeTerm = termKey || this.getCurrentTermKey();
            const subjects = await this.academicService.getAllSubjects(activeTerm);
            const classSubjects = subjects.filter(s => s.targetClasses?.includes(className));
            
            if (classSubjects.length === 0) return 100;

            let totalClasses = 0;
            let totalPresent = 0;

            for (const subject of classSubjects) {
                const records = await this.getAttendanceForStudent(studentId, subject.id, activeTerm);
                totalClasses += records.length;
                totalPresent += records.filter(r => r.presentStudentIds.includes(studentId)).length;
            }

            return totalClasses > 0 ? (totalPresent / totalClasses) * 100 : 100;
        } catch (error) {
            console.error('Error calculating overall attendance:', error);
            return 0;
        }
    }

    public async getAttendanceForStudent(studentId: string, subjectId: string, termKey?: string): Promise<AttendanceRecord[]> {
        try {
            const activeTerm = termKey || this.getCurrentTermKey();
            const q = query(
                collection(this.db, this.attendanceCollection),
                where('subjectId', '==', subjectId),
                where('termKey', '==', activeTerm)
            );
            const querySnapshot = await getDocs(q);
            return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AttendanceRecord));
        } catch (error) {
            console.error('Error fetching attendance records:', error);
            return [];
        }
    }

    public async saveAttendanceRecord(record: Omit<AttendanceRecord, 'id'>): Promise<string> {
        try {
            const docRef = await addDoc(collection(this.db, this.attendanceCollection), this.sanitize(record));
            return docRef.id;
        } catch (error) {
            console.error('Error saving attendance record:', error);
            throw error;
        }
    }

    public async deleteAttendanceRecord(id: string): Promise<void> {
        try {
            await deleteDoc(doc(this.db, this.attendanceCollection, id));
        } catch (error) {
            console.error('Error deleting attendance record:', error);
            throw error;
        }
    }

    public async getAcademicCalendar(termKey?: string): Promise<AcademicCalendarEntry[]> {
        try {
            const activeTerm = termKey || this.getCurrentTermKey();
            const q = query(
                collection(this.db, this.academicCalendarCollection),
                where('termKey', '==', activeTerm)
            );
            const querySnapshot = await getDocs(q);
            return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AcademicCalendarEntry));
        } catch (error) {
            console.error('Error fetching academic calendar:', error);
            return [];
        }
    }

    public async calculateAttendancePercentage(studentId: string, subjectId: string, termKey?: string): Promise<number> {
        try {
            const records = await this.getAttendanceForStudent(studentId, subjectId, termKey);
            if (records.length === 0) return 100; // Assume 100% if no records yet or similar logic
            
            const presentCount = records.filter(r => r.presentStudentIds.includes(studentId)).length;
            const percentage = (presentCount / records.length) * 100;
            return Math.round(percentage * 10) / 10;
        } catch (error) {
            console.error('Error calculating per-subject attendance percentage:', error);
            return 0;
        }
    }
}
