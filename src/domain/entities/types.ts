
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
  int: number | 'A';
  ext: number | 'A';
  total: number;
  status: 'Passed' | 'Failed' | 'Pending';
  isSupplementary?: boolean; // Indicates if this is a supplementary exam
  supplementaryYear?: number; // Year of the supplementary exam
}

export type SupplementaryExamType = 'PreviousYear' | 'CurrentSemester';

export interface SupplementaryExam {
  id: string;
  studentId: string;
  subjectId: string;
  examType: SupplementaryExamType; // Distinguishes between repeating past years and current failures
  originalSemester: 'Odd' | 'Even';
  originalYear: number;
  supplementaryYear: number;
  status: 'Pending' | 'Completed';
  marks?: SubjectMarks;
}

export interface TermRecord {
  className: string;
  semester: 'Odd' | 'Even';
  marks: Record<string, SubjectMarks>;
  grandTotal: number;
  average: number;
  rank: number;
  performanceLevel: PerformanceLevel;
}

export interface StudentRecord {
  id: string;
  adNo: string;
  name: string;
  currentClass: string; // The active class they are in right now
  academicHistory?: Record<string, TermRecord>; // e.g. "2023-2024-Odd": { ... }

  // Legacy fields for migration
  className?: string;
  semester?: 'Odd' | 'Even';
  marks?: Record<string, SubjectMarks>;
  supplementaryExams?: SupplementaryExam[]; // Track supplementary exams
  grandTotal?: number;
  average?: number;
  rank?: number;
  performanceLevel?: PerformanceLevel;
  importRowNumber?: number; // Track original import order
}

export interface GlobalSettings {
  currentAcademicYear: string; // e.g., "2025-2026"
  currentSemester: 'Odd' | 'Even';
  availableYears?: string[]; // Manually managed list of academic years
}

export interface SubjectConfig {
  id: string;
  name: string;
  arabicName?: string;
  maxINT: number;
  maxEXT: number;
  passingTotal: number;
  facultyName?: string;
  targetClasses: string[];
  subjectType: 'general' | 'elective';
  enrolledStudents?: string[]; // Student IDs for elective subjects
}

export type ViewType = 'dashboard' | 'entry' | 'class-report' | 'student-card' | 'management' | 'public';

export interface ReleaseSettings {
  isReleased: boolean;
  releaseDate?: string; // ISO string format
  isSupplementaryReleased?: boolean; // For separate supplementary release
  supplementaryReleaseDate?: string; // ISO string format
}

export type ClassReleaseSettings = Record<string, ReleaseSettings>;
