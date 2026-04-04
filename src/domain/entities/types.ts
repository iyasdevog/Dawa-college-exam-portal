
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
  attemptNumber?: number; // 1 to 10
  originalTerm?: string; // The semester of the first failure (e.g. "2024-2025-Odd")
  originalSemester: 'Odd' | 'Even';
  originalYear: number;
  supplementaryYear: number;
  status: 'Pending' | 'Completed';
  marks?: SubjectMarks;
  previousMarks?: {
    int: number | 'A';
    ext: number | 'A';
  };
  examTerm?: string;
  appliedAt?: number;
  updatedAt?: number;
  applicationId?: string; // The specific application that triggered this
  applicationType?: ApplicationType; // revaluation, improvement, etc.
  studentName?: string; // Fallback name from application if student record missing
  studentAdNo?: string; // Fallback adNo from application if student record missing
}

export interface TermRecord {
  className: string;
  semester: 'Odd' | 'Even';
  marks: Record<string, SubjectMarks>;
  supplementaryMarks?: Record<string, SubjectMarks>; // Added for separate storage of successes
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
  isActive?: boolean; // Controls whether this student is actively enrolled in current workflows
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

export interface SemesterConfig {
  termKey: string; // e.g., "2026-Even"
  academicYear: string;
  semester: 'Odd' | 'Even';
  startDate: string;
  endDate: string;
}

export interface GlobalSettings {
  currentAcademicYear: string; // e.g., "2025-2026"
  currentSemester: 'Odd' | 'Even';
  availableYears?: string[]; // Manually managed list of academic years
  attendanceStartDate?: string; // YYYY-MM-DD
  attendanceEndDate?: string;   // YYYY-MM-DD
  minAttendancePercentage?: number; // Minimum attendance required for hall ticket (e.g. 75)
  semesters?: SemesterConfig[]; // History of explicit semester metadata
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
  activeSemester?: 'Odd' | 'Even' | 'Both';
  academicYear?: string;
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
    studentId?: string; // Links to StudentRecord.id
}

export interface TimetableEntry {
  id: string;
  day: 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday' | 'Sunday';
  subjectId: string;
  subjectName: string; // Denormalized for display convenience
  className: string;
  startTime: string; // e.g., "10:00"
  endTime: string;   // e.g., "11:00"
  semester?: 'Odd' | 'Even';
  academicYear?: string;
}

export interface ExamTimetableEntry {
  id: string;
  date: string; // YYYY-MM-DD
  day: string;  // e.g., "Monday"
  subjectId: string;
  subjectName: string;
  className: string;
  semester: 'Odd' | 'Even';
  academicYear?: string;
  startTime?: string;
  endTime?: string;
}

export interface HallTicketSettings {
  id: string;
  className: string;
  semester: 'Odd' | 'Even';
  academicYear?: string;
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
  semester?: 'Odd' | 'Even';
  academicYear?: string;
}

export interface SpecialDay {
  id: string;
  date: string;
  type: 'Leave' | 'Program';
  className?: string; // If optional, applies to all
  note: string;
  termKey?: string; // e.g. "2025-2026-Odd"
}

export interface AcademicCalendarEntry {
  id: string;
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  type: 'Public Holiday' | 'Continuous Vacation' | 'Program';
  name: string;
  appliesToClasses?: string[]; // If empty, applies to all
  termKey?: string; // e.g. "2025-2026-Odd"
}

export interface PeriodTimeSlot {
  startTime: string; // HH:mm
  endTime: string;   // HH:mm
}

export type TimetableRule =
  | { id: string; type: 'FixedSlot'; day: 'All' | string; periodIndex: number; subjectId: string }
  | { id: string; type: 'DayRestriction'; day: string; restrictedToSubjectIds: string[] }
  | { id: string; type: 'FixedFaculty'; day: 'All' | string; periodIndex: number; facultyName: string }
  | { id: string; type: 'FixedClass'; day: 'All' | string; periodIndex: number; className: string; subjectId: string };

export interface TimetableGeneratorConfig {
  id: string; // Now format: ${className}-${academicYear}-${semester}
  className: string;
  semester: 'Odd' | 'Even';
  academicYear?: string;
  workingDays: ('Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday' | 'Sunday')[];
  periodsPerDay: number;
  periodDurationMins: number; // e.g., 60
  subjectWeeklyHours: Record<string, number>; // subjectId -> hours
  breakSlots?: number[]; // indices of periods that are breaks
  timeSlots?: PeriodTimeSlot[]; // Granular control over slots
  rules?: TimetableRule[];
}
