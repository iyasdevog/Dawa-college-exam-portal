import { loadExcelLibrary, ExcelLibrary } from '../services/dynamicImports';

/**
 * Utility for common Excel operations used across the application.
 * Leverages lazy-loading for the XLSX library to optimize bundle size.
 */
export class ExcelUtils {
    /**
     * Exports raw data to an Excel file with multiple sheets support.
     */
    public static async exportToExcel(
        fileName: string,
        sheets: { name: string; data: any[][] | any[] }[]
    ): Promise<void> {
        try {
            const XLSX = await loadExcelLibrary();
            const workbook = XLSX.utils.book_new();

            sheets.forEach(sheet => {
                let worksheet;
                if (Array.isArray(sheet.data[0])) {
                    // Array of Arrays format
                    worksheet = XLSX.utils.aoa_to_sheet(sheet.data as any[][]);
                } else {
                    // JSON format
                    worksheet = XLSX.utils.json_to_sheet(sheet.data);
                }
                XLSX.utils.book_append_sheet(workbook, worksheet, sheet.name);
            });

            XLSX.writeFile(workbook, fileName);
        } catch (error) {
            console.error('Excel Export failed:', error);
            throw error;
        }
    }

    /**
     * Parses an Excel file into JSON objects.
     */
    public static async parseExcelFile(file: File): Promise<any[]> {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = async (e) => {
                try {
                    const data = new Uint8Array(e.target?.result as ArrayBuffer);
                    const XLSX = await loadExcelLibrary();
                    const workbook = XLSX.read(data, { type: 'array' });
                    const firstSheetName = workbook.SheetNames[0];
                    const worksheet = workbook.Sheets[firstSheetName];
                    const json = XLSX.utils.sheet_to_json(worksheet);
                    resolve(json);
                } catch (error) {
                    reject(error);
                }
            };
            reader.onerror = (error) => reject(error);
            reader.readAsArrayBuffer(file);
        });
    }

    /**
     * Highly specific parser for student CSV/Excel data.
     * Uses fuzzy matching for headers to be robust against case/spacing variations.
     */
    public static parseStudentData(json: any[]): any[] {
        if (!json || json.length === 0) return [];

        const mappings = {
            adNo: ['adno', 'admissionno', 'admission number', 'admission_no', 'adm no', 'adm_no', 'admission_number'],
            name: ['name', 'student name', 'student_name', 'full name', 'fullname'],
            className: ['classname', 'class', 'standard', 'grade', 'class_name'],
            semester: ['semester', 'sem', 'term']
        };

        return json.map(row => {
            const mapped: any = {};
            const keys = Object.keys(row);

            Object.entries(mappings).forEach(([targetKey, synonyms]) => {
                const sourceKey = keys.find(k => {
                    const normalizedKey = k.toLowerCase().replace(/[\s_-]/g, '').trim();
                    return synonyms.some(s => s.toLowerCase().replace(/[\s_-]/g, '') === normalizedKey);
                });
                
                if (sourceKey) {
                    mapped[targetKey] = row[sourceKey];
                }
            });

            return {
                adNo: String(mapped.adNo || '').trim(),
                name: String(mapped.name || '').trim(),
                className: String(mapped.className || '').trim() || 'S1',
                semester: String(mapped.semester || '').trim() || 'Odd'
            };
        }).filter(s => s.adNo && s.name && s.adNo !== 'undefined' && s.name !== 'undefined');
    }
}
