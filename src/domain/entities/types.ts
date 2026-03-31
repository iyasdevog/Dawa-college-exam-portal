
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

export type ViewType = 'dashboard' | 'entry' | 'class-report' | 'student-card' | 'applications' | 'management' | 'public' | 'attendance' | 'attendance-public' | 'student-attendance-portal';

export interface ReleaseSettings {
  isReleased: boolean;
  releaseDate?: string; // ISO string format
  isSupplementaryReleased?: boolean; // For separate supplementary release
  supplementaryReleaseDate?: string; // ISO string format
}

export type ClassReleaseSettings = Record<string, ReleaseSettings>;

export type ApplicationType = 'revaluation' | 'improvement' | 'external-supp' | 'internal-supp' | 'special-supp';
export type ApplicationStatus = 'pending' | 'approved' | 'rejected';

export interface StudentApplication {
    id: string;
    adNo: string;
    studentName: string;
    className: string;
    subjectId: string;
    subjectName: string;
    type: ApplicationType;
    fee: number;
    status: ApplicationStatus;
    createdAt: number;
    appliedYear: string;
    appliedSemester: 'Odd' | 'Even';
    reason?: string;
    adminComment?: string;
}

export interface TimetableEntry {
  id: string;
  day: 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday' | 'Sunday';
  subjectId: string;
  subjectName: string; // Denormalized for display convenience
  className: string;
  startTime: string; // e.g., "10:00"
  endTime: string;   // e.g., "11:00"
}

export interface ExamTimetableEntry {
  id: string;
  date: string; // YYYY-MM-DD
  day: string;  // e.g., "Monday"
  subjectId: string;
  subjectName: string;
  className: string;
  semester: 'Odd' | 'Even';
  startTime?: string;
  endTime?: string;
}

export interface HallTicketSettings {
  id: string;
  className: string;
  semester: 'Odd' | 'Even';
  isReleased: boolean;
  releasedAt?: number;
}

export interface AttendanceRecord {
  id: string;
  date: string; // YYYY-MM-DD
  subjectId: string;
  className: string;
  presentStudentIds: string[];
  absentStudentIds: string[];
  markedBy: string; // Teacher name/ID
  markedAt: number; // Timestamp
  isSpecialDay?: boolean;
  specialDayType?: 'Leave' | 'Program' | 'Other';
  specialDayNote?: string;
}

export interface SpecialDay {
  id: string;
  date: string;
  type: 'Leave' | 'Program';
  className?: string; // If optional, applies to all
  note: string;
}

export interface AcademicCalendarEntry {
  id: string;
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  type: 'Public Holiday' | 'Continuous Vacation' | 'Program';
  name: string;
  appliesToClasses?: string[]; // If empty, applies to all
}

export interface PeriodTimeSlot {
  startTime: string; // HH:mm
  endTime: string;   // HH:mm
}

export type TimetableRule =
  | { id: string; type: 'FixedSlot'; day: 'All' | string; periodIndex: number; subjectId: string }
  | { id: string; type: 'DayRestriction'; day: string; restrictedToSubjectIds: string[] };

export interface TimetableGeneratorConfig {
  id: string;
  className: string;
  semester: 'Odd' | 'Even';
  workingDays: ('Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday' | 'Sunday')[];
  periodsPerDay: number;
  periodDurationMins: number; // e.g., 60
  subjectWeeklyHours: Record<string, number>; // subjectId -> hours
  breakSlots?: number[]; // indices of periods that are breaks
  timeSlots?: PeriodTimeSlot[]; // Granular control over slots
  rules?: TimetableRule[];
}
