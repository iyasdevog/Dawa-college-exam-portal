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
 * Gets the max marks for a subject, accounting for exceptional subjects like Doura and Arabic.
 * - If the subject's DB record explicitly configures a non-zero maxINT (e.g. 30 INT / 70 EXT split),
 *   those configured values are respected and both INT and EXT fields will be enabled.
 * - If maxINT is not configured (0 or absent), Doura/Arabic defaults to 100 EXT / 0 INT.
 */
export const getSubjectMaxMarks = (subject: any, snap?: any) => {
    const name = snap?.name || subject?.name || '';
    const lowerName = name.toLowerCase().trim();
    const isDouraOrArabic = lowerName.includes('doura') || lowerName.includes('arabic') || lowerName.startsWith('ar.') || lowerName === 'ar';

    const configuredINT = snap?.maxINT ?? subject?.maxINT ?? 0;
    const configuredEXT = snap?.maxEXT ?? subject?.maxEXT ?? 0;

    if (isDouraOrArabic && configuredINT === 0) {
        // No explicit split configured: treat as 100-mark external paper
        return { maxINT: 0, maxEXT: configuredEXT || 100, maxTotal: configuredEXT || 100 };
    }

    const maxINT = configuredINT;
    const maxEXT = configuredEXT;
    return { maxINT, maxEXT, maxTotal: maxINT + maxEXT };
};

export const getMarkForSubject = (marksObj: Record<string, any> | undefined, subject: any, metadataObj?: Record<string, any>) => {
    if (!marksObj || !subject) return undefined;
    
    // 1. Direct ID lookup
    if (marksObj[subject.id] !== undefined) return marksObj[subject.id];

    // 2. Case-insensitive / trimmed ID lookup
    const sId = (subject.id || '').toLowerCase().trim();
    if (sId) {
        const idKey = Object.keys(marksObj).find(k => k.toLowerCase().trim() === sId);
        if (idKey) return marksObj[idKey];
    }

    // 3. Name or Arabic Name lookup
    const sNameNorm = normalizeSubjectName(subject.name || '');
    const sArabicNorm = normalizeSubjectName(subject.arabicName || '');

    const foundKey = Object.keys(marksObj).find(k => {
        const kNorm = normalizeSubjectName(k);
        if (sNameNorm && kNorm === sNameNorm) return true;
        if (sArabicNorm && kNorm === sArabicNorm) return true;

        const snap = metadataObj?.[k];
        if (snap) {
            const snapNameNorm = normalizeSubjectName(snap.name || '');
            const snapArabicNorm = normalizeSubjectName(snap.arabicName || '');
            if (sNameNorm && snapNameNorm === sNameNorm) return true;
            if (sArabicNorm && snapArabicNorm === sArabicNorm) return true;
        }

        return false;
    });

    if (foundKey) return marksObj[foundKey];
    return undefined;
};
