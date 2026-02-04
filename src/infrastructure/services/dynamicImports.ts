/**
 * Dynamic import utilities for code splitting heavy libraries
 * This service provides lazy loading for large dependencies to improve initial bundle size
 */

// Type definitions for dynamic imports
export interface ExcelLibrary {
    utils: {
        book_new(): any;
        aoa_to_sheet(data: any[][]): any;
        book_append_sheet(workbook: any, worksheet: any, name: string): void;
        sheet_to_json(worksheet: any, options?: any): any[];
    };
    read(data: any, options?: any): any;
    writeFile(workbook: any, filename: string): void;
}

export interface ChartsLibrary {
    LineChart: React.ComponentType<any>;
    BarChart: React.ComponentType<any>;
    PieChart: React.ComponentType<any>;
    XAxis: React.ComponentType<any>;
    YAxis: React.ComponentType<any>;
    CartesianGrid: React.ComponentType<any>;
    Tooltip: React.ComponentType<any>;
    Legend: React.ComponentType<any>;
    Line: React.ComponentType<any>;
    Bar: React.ComponentType<any>;
    Cell: React.ComponentType<any>;
    ResponsiveContainer: React.ComponentType<any>;
}

export interface AILibrary {
    GoogleGenerativeAI: new (apiKey: string) => any;
}

// Dynamic import functions with error handling and caching
let excelLibCache: ExcelLibrary | null = null;
let chartsLibCache: ChartsLibrary | null = null;
let aiLibCache: AILibrary | null = null;

/**
 * Dynamically imports the XLSX library for Excel operations
 * Used for data export/import functionality
 */
export const loadExcelLibrary = async (): Promise<ExcelLibrary> => {
    if (excelLibCache) {
        return excelLibCache;
    }

    try {
        console.log('Loading Excel library (XLSX)...');
        const XLSX = await import('xlsx');
        excelLibCache = XLSX as ExcelLibrary;
        console.log('Excel library loaded successfully');
        return excelLibCache;
    } catch (error) {
        console.error('Failed to load Excel library:', error);
        throw new Error('Excel functionality is not available. Please refresh and try again.');
    }
};

/**
 * Dynamically imports the Recharts library for data visualization
 * Used for dashboard charts and analytics
 */
export const loadChartsLibrary = async (): Promise<ChartsLibrary> => {
    if (chartsLibCache) {
        return chartsLibCache;
    }

    try {
        console.log('Loading Charts library (Recharts)...');
        const recharts = await import('recharts');
        chartsLibCache = recharts as ChartsLibrary;
        console.log('Charts library loaded successfully');
        return chartsLibCache;
    } catch (error) {
        console.error('Failed to load Charts library:', error);
        throw new Error('Chart functionality is not available. Please refresh and try again.');
    }
};

/**
 * Dynamically imports the Google Generative AI library
 * Used for AI-powered features and analytics
 */
export const loadAILibrary = async (): Promise<AILibrary> => {
    if (aiLibCache) {
        return aiLibCache;
    }

    try {
        console.log('Loading AI library (Google GenAI)...');
        const genai = await import('@google/genai');
        aiLibCache = genai as AILibrary;
        console.log('AI library loaded successfully');
        return aiLibCache;
    } catch (error) {
        console.error('Failed to load AI library:', error);
        throw new Error('AI functionality is not available. Please refresh and try again.');
    }
};

/**
 * Preloads libraries based on user interaction patterns
 * This helps improve perceived performance by loading libraries before they're needed
 */
export const preloadLibraries = {
    /**
     * Preload Excel library when user shows intent to export data
     */
    excel: () => {
        if (!excelLibCache) {
            // Use requestIdleCallback if available, otherwise setTimeout
            if ('requestIdleCallback' in window) {
                requestIdleCallback(() => loadExcelLibrary().catch(() => { }));
            } else {
                setTimeout(() => loadExcelLibrary().catch(() => { }), 100);
            }
        }
    },

    /**
     * Preload Charts library when user navigates to dashboard
     */
    charts: () => {
        if (!chartsLibCache) {
            if ('requestIdleCallback' in window) {
                requestIdleCallback(() => loadChartsLibrary().catch(() => { }));
            } else {
                setTimeout(() => loadChartsLibrary().catch(() => { }), 100);
            }
        }
    },

    /**
     * Preload AI library when user accesses AI features
     */
    ai: () => {
        if (!aiLibCache) {
            if ('requestIdleCallback' in window) {
                requestIdleCallback(() => loadAILibrary().catch(() => { }));
            } else {
                setTimeout(() => loadAILibrary().catch(() => { }), 100);
            }
        }
    }
};

/**
 * Utility to check if a library is already loaded
 */
export const isLibraryLoaded = {
    excel: () => excelLibCache !== null,
    charts: () => chartsLibCache !== null,
    ai: () => aiLibCache !== null
};

/**
 * Clear library cache (useful for testing or memory management)
 */
export const clearLibraryCache = () => {
    excelLibCache = null;
    chartsLibCache = null;
    aiLibCache = null;
    console.log('Dynamic import cache cleared');
};