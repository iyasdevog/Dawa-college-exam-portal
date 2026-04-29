
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
  originalSemester: 'Odd' | 'Even' | 'Bridge';
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
  subjectName?: string; // Fallback name from application if subject record missing
  maxINT?: number; // Snapshot of max marks for validation
  maxEXT?: number; // Snapshot of max marks for validation
}

export interface SubjectSnapshot {
  name: string;
  arabicName?: string;
  maxINT: number;
  maxEXT: number;
  passingTotal: number;
  facultyName?: string;
  subjectType: 'general' | 'elective' | 'school_subject' | string;
  timestamp?: number;
}

export interface TermRecord {
  className: string;
  semester: 'Odd' | 'Even' | 'Bridge';
  marks: Record<string, SubjectMarks>;
  subjectMetadata?: Record<string, SubjectSnapshot>; // Snapshot of subject config at time of entry
  supplementaryMarks?: Record<string, SubjectMarks>;
  grandTotal: number;
  average: number;
  rank: number;
  performanceLevel: PerformanceLevel;
}

export type AcademicHistory = Record<string, TermRecord>;

export interface StudentRecord {
  id: string;
  adNo: string;
  name: string;
  currentClass: string; // The active class they are in right now
  isActive?: boolean; // Controls whether this student is actively enrolled in current workflows
  academicHistory?: Record<string, TermRecord>; // e.g. "2023-2024-Odd": { ... }

  // Legacy fields for migration
  className?: string;
  semester?: 'Odd' | 'Even' | 'Bridge';
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
  semester: 'Odd' | 'Even' | 'Bridge';
  startDate: string;
  endDate: string;
}

export interface GlobalSettings {
  currentAcademicYear: string; // e.g., "2025-2026"
  currentSemester: 'Odd' | 'Even' | 'Bridge';
  availableYears?: string[]; // Manually managed list of academic years
  attendanceStartDate?: string; // YYYY-MM-DD
  attendanceEndDate?: string;   // YYYY-MM-DD
  minAttendancePercentage?: number; // Minimum attendance required for hall ticket (e.g. 75)
  semesters?: SemesterConfig[]; // History of explicit semester metadata
  customClasses?: string[]; // Added: Manually managed classes
  disabledClasses?: string[]; // Added: Standard classes to hide (e.g. if renamed)
  institutionName?: string; // e.g. "Islamic Dawa Academy"
  contactEmail?: string; // e.g. "examinations@aicdawacollege.edu.in"
  contactPhone?: string; // e.g. "+91-483-2734567"
  systemAlias?: string; // e.g. "AIC_Dawa_Portal"
  classSemesters?: Record<string, 'Odd' | 'Even' | 'Bridge'>; // Added: Per-class semester mapping
}

export interface CourseOutcome {
  id: string; // Add random ID for React keys mapping
  description: string;
  learningDomains: string;
  psoNo: string;
}

export interface CourseContentUnit {
  id: string;
  unit: string;
  description: string;
  hours: string | number;
  codeNumber: string;
}

export interface CIAComponent {
  id: string;
  type: 'Writing' | 'Individual Presentation' | 'Group Presentation' | 'Class Test' | 'Other';
  details: string;
  units: string;
  timePeriod: string;
}

export interface AssessmentDetails {
  ciaComponents: CIAComponent[];
  semesterEndExamDetails: string;
}

export interface SubjectDetails {
  department: string;
  stage: string;
  courseName: string;
  courseType: string;
  courseLevel: string;
  semester: string;
  totalHours: string;
  totalStudentLearningTime: string;
  summaryAndJustification: string;
  prerequisites: string;
  courseOutcomes: CourseOutcome[];
  courseContent: CourseContentUnit[];
  teachingAndLearningApproach: string;
  assessment: AssessmentDetails;
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
  subjectType: 'general' | 'elective' | 'school_subject';
  enrolledStudents?: string[]; // Student IDs for elective subjects
  activeSemester?: 'Odd' | 'Even' | 'Both' | 'Bridge';
  academicYear?: string;
  details?: SubjectDetails;
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
    appliedSemester: 'Odd' | 'Even' | 'Bridge';
    termKey?: string;
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
  semester?: 'Odd' | 'Even' | 'Bridge';
  academicYear?: string;
}

export interface ExamTimetableEntry {
  id: string;
  date: string; // YYYY-MM-DD
  day: string;  // e.g., "Monday"
  subjectId: string;
  subjectName: string;
  className: string;
  semester: 'Odd' | 'Even' | 'Bridge';
  academicYear?: string;
  startTime?: string;
  endTime?: string;
}

export interface HallTicketSettings {
  id: string;
  className: string;
  semester: 'Odd' | 'Even' | 'Bridge';
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
  semester?: 'Odd' | 'Even' | 'Bridge';
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
  semester: 'Odd' | 'Even' | 'Bridge';
  academicYear?: string;
  workingDays: ('Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday' | 'Sunday')[];
  periodsPerDay: number;
  periodDurationMins: number; // e.g., 60
  subjectWeeklyHours: Record<string, number>; // subjectId -> hours
  breakSlots?: number[]; // indices of periods that are breaks
  timeSlots?: PeriodTimeSlot[]; // Granular control over slots
  rules?: TimetableRule[];
}

export type CurriculumStage = 'Foundational' | 'Undergraduate' | 'Post Graduate';

export interface CurriculumEntry {
  id: string;
  stage: CurriculumStage;
  stream: '3-Year' | '5-Year' | 'None';
  semester: number; // e.g., 1 to 10
  subjectCode?: string; // Optional for backward compatibility
  subjectName: string;
  subjectType?: 'general' | 'elective' | string;
  learningPeriod: string; // e.g., "60 hours" or "Jan - Jun"
  portions: string; // e.g., "Unit 1-4"
  academicYear?: string; // Added for historical tracking
  termKey?: string; // Added for historical tracking
}

