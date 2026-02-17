
export type PerformanceLevel =
  | 'O (Outstanding)'
  | 'A+ (Excellent)'
  | 'A (Very Good)'
  | 'B+ (Good)'
  | 'B (Good)'
  | 'C (Average)'
  | 'F (Failed)'
  | 'Excellent' | 'Good' | 'Average' | 'Needs Improvement' | 'Failed'; // Keep old types temporarily for migration

export interface SubjectMarks {
  ta: number | 'A';
  ce: number | 'A';
  total: number;
  status: 'Passed' | 'Failed' | 'Pending';
  isSupplementary?: boolean; // Indicates if this is a supplementary exam
  supplementaryYear?: number; // Year of the supplementary exam
}

export interface SupplementaryExam {
  id: string;
  studentId: string;
  subjectId: string;
  originalSemester: 'Odd' | 'Even';
  originalYear: number;
  supplementaryYear: number;
  status: 'Pending' | 'Completed';
  marks?: SubjectMarks;
}

export interface StudentRecord {
  id: string;
  adNo: string;
  name: string;
  className: string;
  semester: 'Odd' | 'Even';
  marks: Record<string, SubjectMarks>;
  supplementaryExams?: SupplementaryExam[]; // Track supplementary exams
  grandTotal: number;
  average: number;
  rank: number;
  performanceLevel: PerformanceLevel;
  importRowNumber?: number; // Track original import order
}

export interface SubjectConfig {
  id: string;
  name: string;
  arabicName?: string;
  maxTA: number;
  maxCE: number;
  passingTotal: number;
  facultyName?: string;
  targetClasses: string[];
  subjectType: 'general' | 'elective';
  enrolledStudents?: string[]; // Student IDs for elective subjects
}

export type ViewType = 'dashboard' | 'entry' | 'class-report' | 'student-card' | 'management' | 'public' | 'doura-monitoring';

export interface DouraTask {
  id: string;
  title: string;
  description?: string;
  targetClass: string;
  targetStudentAdNo?: string;
  juzStart: number;
  juzEnd: number;
  pageStart: number;
  pageEnd: number;
  dueDate: string;
  createdAt: string;
  createdBy: string;
  status: 'Active' | 'Closed';
}

export interface KhatamProgress {
  id: string;
  studentAdNo: string;
  khatamCount: number;
  currentKhatamJuz: number[]; // Array of completed Juz numbers (1-30) for the current Khatam
  lastCompletedDate?: string;
}

export interface ReleaseSettings {
  isReleased: boolean;
  releaseDate?: string; // ISO string format
}

export type ClassReleaseSettings = Record<string, ReleaseSettings>;

export interface DouraSubmission {
  id: string;
  studentAdNo: string;
  studentName: string;
  className: string;
  juzStart: number;
  juzEnd: number;
  pageStart: number;
  pageEnd: number;
  ayaStart?: number;
  ayaEnd?: number;
  recitationDate: string;
  status: 'Pending' | 'Approved'; // Simplified: Rejection removed
  submittedAt: string; // ISO string
  approvedAt?: string; // ISO string
  teacherName?: string; // Student's selected teacher
  approvedBy?: string; // Teacher who approved the submission
  feedback?: string;
  taskId?: string; // Optional: linked to a specific task
  type: 'Task' | 'Self'; // Whether this was for a task or independent
}
