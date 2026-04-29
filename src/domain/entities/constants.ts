
import { StudentRecord } from './types';

export const SYSTEM_CLASSES = ['S1', 'S2', 'S3', 'D1', 'D2', 'D3', 'P1', 'P2', 'PG1', 'PG2', 'HS1', 'FS1'];

// System starts completely empty - no pre-seeded data
export const INITIAL_STUDENTS: StudentRecord[] = [];

export const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const;
