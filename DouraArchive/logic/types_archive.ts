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
    academicTerm: string; // The term this task belongs to
}

export interface KhatamProgress {
    id: string;
    studentAdNo: string;
    khatamCount: number;
    currentKhatamJuz: number[]; // Array of completed Juz numbers (1-30) for the current Khatam
    lastCompletedDate?: string;
}

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
    academicTerm: string; // The term this submission belongs to
}
