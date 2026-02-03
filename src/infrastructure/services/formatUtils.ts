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
 * Normalizes a name for comparison or storage.
 * Use this for faculty names to ensure consistency.
 */
export const normalizeName = (name: string | null | undefined): string => {
    return toTitleCase(name);
};
