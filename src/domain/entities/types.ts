
export type PerformanceLevel = 'Excellent' | 'Good' | 'Average' | 'Needs Improvement' | 'Failed';

export interface SubjectMarks {
  ta: number;
  ce: number;
  total: number;
  status: 'Passed' | 'Failed';
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

export type ViewType = 'dashboard' | 'entry' | 'class-report' | 'student-card' | 'management' | 'public';
