
import type { StudentRecord } from './types';

export const SYSTEM_CLASSES = ['FS1', 'FS2', 'FS3', 'HS1', 'HS2', 'HS3', 'UG-F', 'D1', 'D2', 'D3', 'PG1', 'PG-F', 'S1', 'S2', 'P1', 'P2', 'Hifz'];

export const TERM_CLASS_MAP: Record<string, string[]> = {
    '2025-2026-Odd': ['S1', 'S2', 'P1', 'P2', 'D1', 'D2', 'D3', 'PG-F'],
    '2025-2026-Even': ['FS1', 'FS2', 'FS3', 'HS1', 'HS2', 'HS3', 'D1', 'D2', 'D3', 'PG1'],
    '2026-2027-Odd': ['FS1', 'FS2', 'FS3', 'HS1', 'HS2', 'UG-F', 'D2', 'D3', 'PG-F', 'PG1'],
    '2026-2027-Even': ['FS2', 'FS3', 'HS2', 'HS3', 'UG-F', 'D3', 'PG-F', 'PG1']
};

export function normalizeTermKey(tk?: string): string {
    if (!tk) return '2026-2027-Odd';
    let clean = tk.trim().replace(/_/g, '-');
    if (clean === '2025-Odd') return '2025-2026-Odd';
    if (clean === '2025-Even') return '2025-2026-Even';
    if (clean === '2026-Odd') return '2026-2027-Odd';
    if (clean === '2026-Even') return '2026-2027-Even';
    if (!clean.includes('-20') && clean.startsWith('2025-')) {
        clean = clean.replace(/^2025-/, '2025-2026-');
    }
    if (!clean.includes('-20') && clean.startsWith('2026-')) {
        clean = clean.replace(/^2026-/, '2026-2027-');
    }
    return clean;
}

export function getExpectedClassesForTerm(termKey?: string): string[] {
    const norm = normalizeTermKey(termKey);
    if (TERM_CLASS_MAP[norm]) return [...TERM_CLASS_MAP[norm]];
    if (norm.endsWith('-Odd')) {
        return ['FS1', 'FS2', 'FS3', 'HS1', 'HS2', 'UG-F', 'D2', 'D3', 'PG-F', 'PG1'];
    }
    if (norm.endsWith('-Even')) {
        return ['FS1', 'FS2', 'FS3', 'HS1', 'HS2', 'HS3', 'D1', 'D2', 'D3', 'PG1'];
    }
    return [...SYSTEM_CLASSES];
}

// System starts completely empty - no pre-seeded data
export const INITIAL_STUDENTS: StudentRecord[] = [];

export const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const;
