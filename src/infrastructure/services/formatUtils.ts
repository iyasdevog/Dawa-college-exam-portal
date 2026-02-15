/**
 * Formats a string to Title Case (e.g., "usman hudawi" -> "Usman Hudawi")
 * Handles multiple spaces and trims the input.
 */
export const toTitleCase = (str: string | null | undefined): string => {
    if (!str) return '';
    return str
        .trim()
        .replace(/\s+/g, ' ') // Replace multiple spaces with a single space
        .split(' ')
        .map(word => {
            if (!word) return '';
            return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
        })
        .join(' ');
};

/**
 * Shortens long subject names into common abbreviations.
 */
export const shortenSubjectName = (name: string | null | undefined): string => {
    if (!name) return '';

    const lowerName = name.toLowerCase().trim();

    // Mapping of long names to short versions
    const mapping: { [key: string]: string } = {
        'information and communication technology': 'ICT',
        'information and communication technology excel': 'ICT (Excel)',
        'information and communication technology theory': 'ICT (Theory)',
        'information and communication technology practical': 'ICT (Practical)',
        'ict excel': 'ICT (Excel)',
        'ict theory': 'ICT (Theory)',
        'ict practical': 'ICT (Practical)',
        'ict': 'ICT',
        'islamic history': 'Islamic Hist.',
        'malayalam': 'Mal.',
        'arabic': 'Ar.',
        'english': 'Eng.',
        'mathematics': 'Maths',
        'social science': 'Social Sci.',
        'natural science': 'Natural Sci.',
        'physical science': 'Physical Sci.',
        'computer science': 'Comp. Sci.',
        'general knowledge': 'GK',
        'moral science': 'Moral Sci.',
        'physical education': 'P.E.',
        'environmental science': 'EVS',
        'foundation of education': 'Edu. Found.',
        'teaching practice': 'TP',
        'practice teaching': 'PT',
        'educational psychology': 'Edu. Psych.',
        'sociological foundation of education': 'Soc. Found.',
        'philosophical foundation of education': 'Phil. Found.',
        'school management': 'School Mgmt.',
        'curriculum and evaluation': 'Curr. & Eval.',
        'pedagogy of english': 'Ped. Eng.',
        'pedagogy of malayalam': 'Ped. Mal.',
        'pedagogy of arabic': 'Ped. Ar.',
        'pedagogy of social science': 'Ped. Soc. Sci.',
        'pedagogy of mathematics': 'Ped. Maths.',
        'pedagogy of natural science': 'Ped. Nat. Sci.',
        'pedagogy of physical science': 'Ped. Phys. Sci.'
    };

    // Check if name contains any of the keys
    for (const key in mapping) {
        if (lowerName === key || (key.length > 5 && lowerName.includes(key))) {
            return mapping[key];
        }
    }

    // Default truncation for very long names not in mapping
    if (name.length > 25) {
        return name.substring(0, 22) + '...';
    }

    return name;
};

/**
 * Normalizes a name for comparison or storage.
 */
export const normalizeName = (name: string | null | undefined): string => {
    if (!name) return '';
    let normalized = toTitleCase(name);

    // Specifically handle ICT normalization
    const lower = name.toLowerCase().trim();
    if (lower === 'information and communication technology') return 'ICT';
    if (lower === 'information and communication technology excel') return 'ICT (Excel)';
    if (lower === 'information and communication technology theory') return 'ICT (Theory)';
    if (lower === 'information and communication technology practical') return 'ICT (Practical)';

    // General "Information and Communication Technology" replacement
    if (lower.includes('information and communication technology')) {
        normalized = normalized.replace(/Information And Communication Technology/gi, 'ICT');
    }

    return normalized;
};
