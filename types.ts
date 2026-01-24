
export type PerformanceLevel = 'Excellent' | 'Good' | 'Average' | 'Needs Improvement' | 'Failed';

export interface SubjectMarks {
  ta: number;
  ce: number;
  total: number;
  status: 'Passed' | 'Failed';
}

export interface StudentRecord {
  id: string;
  adNo: string;
  name: string;
  className: string;
  semester: 'Odd' | 'Even';
  marks: Record<string, SubjectMarks>;
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
}

export type ViewType = 'dashboard' | 'entry' | 'class-report' | 'student-card' | 'management';
