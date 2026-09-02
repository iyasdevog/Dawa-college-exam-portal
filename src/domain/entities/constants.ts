
import { StudentRecord } from './types';

export const SYSTEM_CLASSES = ['FS1', 'FS2', 'FS3', 'HS1', 'HS2', 'HS3', 'D1', 'D2', 'D3', 'PG1', 'PG-F', 'UG-F', 'Hifz'];

// System starts completely empty - no pre-seeded data
export const INITIAL_STUDENTS: StudentRecord[] = [];

export const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const;
