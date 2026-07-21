/**
 * Utility functions for subject normalization and matching
 */

/**
 * Normalizes a subject name by:
 * 1. Converting to lowercase
 * 2. Trimming whitespace
 * 3. Removing non-alphanumeric characters (optional but helpful for aggressive matching)
 */
export const normalizeSubjectName = (name: string): string => {
    if (!name) return '';
    return name
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]/g, ''); // Aggressive: only alphanumeric
};

/**
 * Checks if two subjects are the same based on ID or normalized name
 */
export const isSameSubject = (
    id1: string, 
    name1: string | undefined, 
    id2: string, 
    name2: string | undefined
): boolean => {
    // 1. Check ID match (exact)
    if (id1.toLowerCase() === id2.toLowerCase()) return true;

    // 2. Check Name match (normalized)
    const norm1 = normalizeSubjectName(name1 || '');
    const norm2 = normalizeSubjectName(name2 || '');
    
    if (norm1 && norm2 && norm1 === norm2) return true;

    return false;
};

/**
 * Gets the max marks for a subject, accounting for exceptional subjects like Doura and Arabic that are strictly out of 100 on EXT.
 */
export const getSubjectMaxMarks = (subject: any, snap?: any) => {
    const name = snap?.name || subject?.name || '';
    const lowerName = name.toLowerCase().trim();
    if (lowerName.includes('doura') || lowerName.includes('arabic') || lowerName.startsWith('ar.') || lowerName === 'ar') {
        return { maxINT: 0, maxEXT: 100, maxTotal: 100 };
    }
    const maxINT = snap?.maxINT ?? subject?.maxINT ?? 0;
    const maxEXT = snap?.maxEXT ?? subject?.maxEXT ?? 0;
    return { maxINT, maxEXT, maxTotal: maxINT + maxEXT };
};
