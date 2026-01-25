
import { 
  collection, 
  getDocs, 
  doc, 
  setDoc, 
  deleteDoc, 
  writeBatch,
  query,
  limit,
  getDoc,
  updateDoc
} from "firebase/firestore";
import { getDb } from "../firebaseConfig.ts";
import { StudentRecord, SubjectConfig, SubjectMarks } from "../types.ts";

const COLLECTIONS = {
  STUDENTS: 'students',
  SUBJECTS: 'subjects'
};

const LOCAL_KEYS = {
  STUDENTS: 'edumark_local_students',
  SUBJECTS: 'edumark_local_subjects',
  USE_CLOUD: 'edumark_use_cloud'
};

let isCloudAvailable = false;

// Helper to get local fallback data
const getLocalData = <T>(key: string): T[] => {
  const local = localStorage.getItem(key);
  return local ? JSON.parse(local) : [];
};

export const dbService = {
  async checkCloudConnection(): Promise<boolean> {
    const db = getDb();
    if (!db) {
      isCloudAvailable = false;
      return false;
    }

    try {
      const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 4000));
      const fetchPromise = getDocs(query(collection(db, COLLECTIONS.SUBJECTS), limit(1)));
      await Promise.race([fetchPromise, timeoutPromise]);
      isCloudAvailable = true;
      localStorage.setItem(LOCAL_KEYS.USE_CLOUD, 'true');
      return true;
    } catch (e) {
      console.warn("Cloud connection check failed:", e);
      // We don't strictly set it to false here to allow retries on actual data calls
      return isCloudAvailable;
    }
  },

  isUsingCloud(): boolean {
    return isCloudAvailable;
  },

  async getAllStudents(): Promise<StudentRecord[]> {
    const db = getDb();
    if (!db) return getLocalData<StudentRecord>(LOCAL_KEYS.STUDENTS);
    
    try {
      const snap = await getDocs(collection(db, COLLECTIONS.STUDENTS));
      const data = snap.docs.map(doc => ({ ...doc.data(), id: doc.id } as StudentRecord));
      localStorage.setItem(LOCAL_KEYS.STUDENTS, JSON.stringify(data));
      isCloudAvailable = true;
      return data;
    } catch (err) {
      console.error("Firestore read error:", err);
      return getLocalData<StudentRecord>(LOCAL_KEYS.STUDENTS);
    }
  },

  async saveStudent(student: StudentRecord): Promise<void> {
    const db = getDb();
    const students = getLocalData<StudentRecord>(LOCAL_KEYS.STUDENTS);
    const index = students.findIndex(s => s.id === student.id);
    if (index > -1) students[index] = student;
    else students.push(student);
    localStorage.setItem(LOCAL_KEYS.STUDENTS, JSON.stringify(students));

    if (db) {
      try {
        await setDoc(doc(db, COLLECTIONS.STUDENTS, student.id), student);
        isCloudAvailable = true;
      } catch (e) {
        console.error("Cloud save failed:", e);
      }
    }
  },

  /**
   * Granular update for specific student marks to avoid overwriting other subjects
   */
  async updateStudentMarks(studentId: string, marks: Record<string, SubjectMarks>): Promise<void> {
    const db = getDb();
    const students = getLocalData<StudentRecord>(LOCAL_KEYS.STUDENTS);
    const idx = students.findIndex(s => s.id === studentId);
    if (idx > -1) {
      students[idx].marks = { ...students[idx].marks, ...marks };
      localStorage.setItem(LOCAL_KEYS.STUDENTS, JSON.stringify(students));
    }

    if (db) {
      try {
        const studentRef = doc(db, COLLECTIONS.STUDENTS, studentId);
        await updateDoc(studentRef, { marks: marks });
        isCloudAvailable = true;
      } catch (e) {
        // If update fails, fallback to setDoc
        const updatedStudent = students.find(s => s.id === studentId);
        if (updatedStudent) await setDoc(doc(db, COLLECTIONS.STUDENTS, studentId), updatedStudent);
      }
    }
  },

  async deleteStudent(id: string): Promise<void> {
    const db = getDb();
    const students = getLocalData<StudentRecord>(LOCAL_KEYS.STUDENTS);
    const filtered = students.filter(s => s.id !== id);
    localStorage.setItem(LOCAL_KEYS.STUDENTS, JSON.stringify(filtered));

    if (db) {
      try {
        await deleteDoc(doc(db, COLLECTIONS.STUDENTS, id));
      } catch (e) {
        console.error("Cloud delete failed:", e);
      }
    }
  },

  async deleteAllStudents(students: StudentRecord[]): Promise<void> {
    const db = getDb();
    localStorage.setItem(LOCAL_KEYS.STUDENTS, JSON.stringify([]));

    if (db) {
      try {
        const chunks = [];
        for (let i = 0; i < students.length; i += 500) {
          chunks.push(students.slice(i, i + 500));
        }

        for (const chunk of chunks) {
          const batch = writeBatch(db);
          chunk.forEach(s => batch.delete(doc(db, COLLECTIONS.STUDENTS, s.id)));
          await batch.commit();
        }
      } catch (e) {
        console.error("Batch delete failed:", e);
      }
    }
  },

  async getAllSubjects(): Promise<SubjectConfig[]> {
    const db = getDb();
    if (!db) return getLocalData<SubjectConfig>(LOCAL_KEYS.SUBJECTS);
    
    try {
      const snap = await getDocs(collection(db, COLLECTIONS.SUBJECTS));
      const data = snap.docs.map(doc => ({ ...doc.data(), id: doc.id } as SubjectConfig));
      localStorage.setItem(LOCAL_KEYS.SUBJECTS, JSON.stringify(data));
      return data;
    } catch (err) {
      return getLocalData<SubjectConfig>(LOCAL_KEYS.SUBJECTS);
    }
  },

  async saveSubject(subject: SubjectConfig): Promise<void> {
    const db = getDb();
    const subjects = getLocalData<SubjectConfig>(LOCAL_KEYS.SUBJECTS);
    const index = subjects.findIndex(s => s.id === subject.id);
    if (index > -1) subjects[index] = subject;
    else subjects.push(subject);
    localStorage.setItem(LOCAL_KEYS.SUBJECTS, JSON.stringify(subjects));

    if (db) {
      try {
        await setDoc(doc(db, COLLECTIONS.SUBJECTS, subject.id), subject);
      } catch (e) {
        console.error("Cloud subject save failed:", e);
      }
    }
  },

  async deleteSubject(id: string): Promise<void> {
    const db = getDb();
    const subjects = getLocalData<SubjectConfig>(LOCAL_KEYS.SUBJECTS);
    const filtered = subjects.filter(s => s.id !== id);
    localStorage.setItem(LOCAL_KEYS.SUBJECTS, JSON.stringify(filtered));

    if (db) {
      try {
        await deleteDoc(doc(db, COLLECTIONS.SUBJECTS, id));
      } catch (e) {
        console.error("Cloud subject delete failed:", e);
      }
    }
  },

  async deleteAllSubjects(subjects: SubjectConfig[]): Promise<void> {
    const db = getDb();
    localStorage.setItem(LOCAL_KEYS.SUBJECTS, JSON.stringify([]));

    if (db) {
      try {
        const batch = writeBatch(db);
        subjects.forEach(s => batch.delete(doc(db, COLLECTIONS.SUBJECTS, s.id)));
        await batch.commit();
      } catch (e) {
        console.error("Batch subject delete failed:", e);
      }
    }
  },

  async saveMultipleStudents(students: StudentRecord[]): Promise<void> {
    const db = getDb();
    localStorage.setItem(LOCAL_KEYS.STUDENTS, JSON.stringify(students));

    if (db) {
      try {
        const chunks = [];
        for (let i = 0; i < students.length; i += 500) {
          chunks.push(students.slice(i, i + 500));
        }

        for (const chunk of chunks) {
          const batch = writeBatch(db);
          chunk.forEach(s => {
            const studentRef = doc(db, COLLECTIONS.STUDENTS, s.id);
            batch.set(studentRef, s);
          });
          await batch.commit();
        }
        isCloudAvailable = true;
      } catch (e) {
        console.error("Batch student save failed:", e);
      }
    }
  }
};
