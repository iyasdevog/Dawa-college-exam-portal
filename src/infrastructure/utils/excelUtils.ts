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
     */
    public static parseStudentData(json: any[]): any[] {
        // Shared logic for mapping excel headers to student fields
        return json.map(row => ({
            adNo: row['adNo'] || row['Admission No'] || row['AD NO'] || '',
            name: row['name'] || row['Student Name'] || row['NAME'] || '',
            className: row['className'] || row['Class'] || row['CLASS'] || 'S1',
            semester: row['semester'] || row['Semester'] || row['SEMESTER'] || 'Odd'
        })).filter(s => s.adNo && s.name);
    }
}
