import {
    collection,
    doc,
    getDoc,
    getDocs,
    addDoc,
    updateDoc,
    deleteDoc,
    query,
    where,
    writeBatch
} from 'firebase/firestore';
import { BaseDataService } from './BaseDataService';
import { StudentService } from './StudentService';
import { 
    SubjectConfig, 
    SubjectMarks, 
    PerformanceLevel,
    StudentRecord,
    GlobalSettings,
    AcademicHistory,
    SubjectSnapshot,
    TermRecord
} from '../../../domain/entities/types';
import { normalizeName } from '../formatUtils';
import { ExcelUtils } from '../../utils/excelUtils';

export class AcademicService extends BaseDataService {
    private studentService?: StudentService;

    constructor(studentService?: StudentService) {
        super();
        this.studentService = studentService;
    }

    /**
     * Calculates the performance level (O, A+, etc.) based on subject marks.
     */
    public calculatePerformanceLevel(marks: Record<string, SubjectMarks>, subjects: SubjectConfig[]): PerformanceLevel {
        const marksEntries = Object.entries(marks);
        if (marksEntries.length === 0) return 'Pending' as PerformanceLevel;

        let hasMarks = false;
        let minPercentage = 100;
        let hasFailedSubject = false;

        for (const [subjectId, mark] of marksEntries) {
            const subject = subjects.find(s => s.id === subjectId);
            if (!subject) continue;

            const totalMax = (subject.maxINT || 0) + (subject.maxEXT || 0);
            if (totalMax === 0) continue;

            hasMarks = true;
            
            if (mark.status === 'Failed') {
                hasFailedSubject = true;
            }

            const percentage = (this.getMarkValue(mark.total) / totalMax) * 100;
            if (percentage < minPercentage) {
                minPercentage = percentage;
            }
        }

        if (hasFailedSubject || minPercentage < 40) return 'F (Failed)';
        if (!hasMarks) return 'C (Average)';

        if (minPercentage >= 95) return 'O (Outstanding)';
        if (minPercentage >= 85) return 'A+ (Excellent)';
        if (minPercentage >= 75) return 'A (Very Good)';
        if (minPercentage >= 65) return 'B+ (Good)';
        if (minPercentage >= 55) return 'B (Good)';
        return 'C (Average)';
    }

    /**
     * Centralized logic to calculate grandTotal, average and performanceLevel for a term.
     */
    public calculateTermMetrics(marks: Record<string, SubjectMarks>, subjects: SubjectConfig[], supplementaryMarks?: Record<string, SubjectMarks>): {
        grandTotal: number;
        average: number;
        performanceLevel: PerformanceLevel;
    } {
        const combinedMarks: Record<string, SubjectMarks> = { ...marks };
        
        if (supplementaryMarks) {
            Object.entries(supplementaryMarks).forEach(([subId, suppMark]) => {
                if (suppMark.status === 'Passed') {
                    combinedMarks[subId] = suppMark;
                }
            });
        }

        const marksEntries = Object.entries(combinedMarks);
        const grandTotal = marksEntries.reduce((sum, [_, mark]) => sum + this.getMarkValue(mark.total), 0);

        const subjectCount = Object.keys(combinedMarks).length;
        let average = subjectCount > 0 ? grandTotal / subjectCount : 0;
        if (isNaN(average)) average = 0;
        average = Math.round(average * 100) / 100;

        const performanceLevel = this.calculatePerformanceLevel(combinedMarks, subjects);

        return { grandTotal, average, performanceLevel };
    }

    /**
     * Cache for filtered subjects, keyed by termKey.
     */
    private filteredSubjectsCache: Map<string, SubjectConfig[]> = new Map();

    /**
     * Override base invalidateCache to also clear the per-term subject cache.
     */
    public override invalidateCache(): void {
        super.invalidateCache();
        this.filteredSubjectsCache.clear();
        this.studentService?.invalidateCache();
    }

    public async getAllSubjects(termKey?: string, className?: string): Promise<SubjectConfig[]> {
        try {
            const activeTerm = termKey || this.getCurrentTermKey();
            
            // Return from cache if valid — keyed by term only (className filters are cheap)
            if (this.isCacheValid() && !className && this.filteredSubjectsCache.has(activeTerm)) {
                return this.filteredSubjectsCache.get(activeTerm)!;
            }

            // Robust parsing: Semester is the part after the LAST hyphen
            const lastHyphenIndex = activeTerm.lastIndexOf('-');
            let targetYear = '';
            let globalSem = '';
            
            if (lastHyphenIndex !== -1) {
                targetYear = activeTerm.substring(0, lastHyphenIndex);
                globalSem = activeTerm.substring(lastHyphenIndex + 1);
            } else {
                targetYear = activeTerm;
                globalSem = '';
            }

            // Use logical semester if className is provided
            const targetSem = className ? this.getLogicalSemester(className, globalSem as any) : globalSem;

            const snapshot = await getDocs(collection(this.db, this.subjectsCollection));
            const allSubjects = snapshot.docs
                .map(doc => ({ id: doc.id, ...doc.data() } as SubjectConfig))
                .filter(subject => !subject.isDeleted);
            
            // Determine the canonical fallback year for subjects with no academicYear field.
            // Use the configured available years to pick the right default.
            const availableYears: string[] = BaseDataService.currentGlobalSettings?.availableYears || ['2025-2026'];
            const defaultYear = availableYears[0] || '2025-2026';

            const semOk = (subject: SubjectConfig) => {
                if (!targetSem) return true;
                if (!subject.activeSemester || subject.activeSemester === 'Both') return true;
                return subject.activeSemester === targetSem;
            };

            // Primary filter: subjects whose academicYear matches targetYear,
            // OR subjects with no academicYear that belong to the default/legacy year (when it equals targetYear).
            let result = allSubjects.filter(subject => {
                const subjectYear = subject.academicYear || defaultYear;
                if (targetYear && subjectYear !== targetYear) return false;
                return semOk(subject);
            });

            // Safety net: if the strict filter returns nothing, try subjects with blank/missing
            // academicYear regardless of year — this recovers from orphaned subjects after
            // a test academic year is created and then deleted.
            if (result.length === 0 && targetYear) {
                result = allSubjects.filter(s => (!s.academicYear || s.academicYear === '') && semOk(s));
            }

            const mapped = result.map(subject => ({
                ...subject,
                targetClasses: (subject.targetClasses || []).map(c => this.getHistoricalClassName(activeTerm, this.getDatabaseClassName(activeTerm, c)))
            }));

            // Only cache full-term queries (not className-specific ones)
            if (!className) {
                this.filteredSubjectsCache.set(activeTerm, mapped);
                if (!this.isCacheValid()) this.cacheTimestamp = Date.now();
            }
            return mapped;
        } catch (error) {
            console.error('Error fetching all subjects:', error);
            return [];
        }
    }

    /**
     * Gets all subjects without any term-based filtering for global discovery.
     */
    public async getRawSubjects(): Promise<SubjectConfig[]> {
        return this.getRawAllSubjects().then(all => all.filter(s => !s.isDeleted));
    }

    public async getSubjectById(id: string, termKey?: string): Promise<SubjectConfig | null> {
        try {
            const docRef = doc(this.db, this.subjectsCollection, id);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                const data = docSnap.data();
                const activeTerm = termKey || this.getCurrentTermKey();
                return {
                    id: docSnap.id,
                    ...data,
                    targetClasses: (data.targetClasses || []).map((c: string) => this.getHistoricalClassName(activeTerm, c))
                } as SubjectConfig;
            }
            return null;
        } catch (error) {
            console.error('Error fetching subject:', error);
            return null;
        }
    }

    public async addSubject(subject: Omit<SubjectConfig, 'id'>): Promise<string> {
        try {
            const activeTerm = this.getCurrentTermKey();
            const normalizedSubject = {
                name: subject.name || '',
                arabicName: subject.arabicName || '',
                maxINT: Number(subject.maxINT) || 0,
                maxEXT: Number(subject.maxEXT) || 0,
                passingTotal: Number(subject.passingTotal) || 0,
                facultyName: subject.facultyName ? normalizeName(subject.facultyName) : '',
                // Use the current activeTerm for class name normalization, not a hardcoded term
                targetClasses: (subject.targetClasses || []).map(c => this.getDatabaseClassName(activeTerm, c)),
                subjectType: subject.subjectType || 'general',
                // Only set electiveType for elective/school_subject types; null for general
                electiveType: (subject.subjectType === 'elective' || subject.subjectType === 'school_subject')
                    ? (subject.electiveType || 'intra-class')
                    : null,
                enrolledStudents: subject.enrolledStudents || [],
                activeSemester: subject.activeSemester || 'Both',
                academicYear: subject.academicYear || ''
            };
            // Remove null values that crash Firestore
            const cleaned = JSON.parse(JSON.stringify(normalizedSubject));
            const docRef = await addDoc(collection(this.db, this.subjectsCollection), cleaned);
            this.invalidateCache();
            return docRef.id;
        } catch (error) {
            console.error('Error adding subject:', error);
            throw error;
        }
    }

    public async standardizeSubjectNames(): Promise<number> {
        try {
            const snapshot = await getDocs(collection(this.db, this.subjectsCollection));
            let count = 0;

            await this.runBatchedOperation(snapshot.docs, (batch, docSnap) => {
                const data = docSnap.data();
                const rawName = data.name || '';
                const standardized = rawName.trim().toUpperCase();
                if (rawName !== standardized && standardized.length > 0) {
                    batch.update(docSnap.ref, { name: standardized });
                    count++;
                }
            });

            this.invalidateCache();
            return count;
        } catch (error) {
            console.error('Error standardizing subject names:', error);
            throw error;
        }
    }

    /**
     * Applies semester-specific name substitutions across all subjects:
     *  - Even/Both semester: "Ar." / "AR." → "COMMUNICATIVE ARABIC"
     *  - Even/Both semester: "Mlm." / "MLM." → "COMMUNICATIVE MALAYALAM"
     *  - Odd  semester:      "Mlm." / "MLM." → "MALAYALAM"
     *
     * Semester matching is case-insensitive and handles all stored variants
     * e.g. "Both Sem", "BOTH SEM", "Even Sem", "ODD", "odd", etc.
     */
    public async applySubjectNameSubstitutions(): Promise<{ updated: number; previews: string[] }> {
        try {
            const snapshot = await getDocs(collection(this.db, this.subjectsCollection));
            const previews: string[] = [];
            let updated = 0;

            /** Normalise any semester string to 'even' | 'odd' | 'both' */
            const normSem = (raw: string): 'even' | 'odd' | 'both' => {
                const s = raw.trim().toLowerCase();
                if (s.startsWith('even')) return 'even';
                if (s.startsWith('odd'))  return 'odd';
                return 'both'; // "both sem", "both", "" → treat as both
            };

            /** True if the name matches the Ar. abbreviation (any case) */
            const isAr = (norm: string) =>
                norm === 'AR.' || norm === 'AR' ||
                (norm.startsWith('AR.') && norm.length < 8);

            /** True if the name matches the Mlm. abbreviation (any case) */
            const isMlm = (norm: string) =>
                norm === 'MLM.' || norm === 'MLM' ||
                (norm.startsWith('MLM.') && norm.length < 8);

            const resolveNewName = (rawName: string, semRaw: string): string | null => {
                const norm = rawName.trim().toUpperCase();
                const sem  = normSem(semRaw);

                // Arabic → COMMUNICATIVE ARABIC (Even or Both)
                if (isAr(norm) && (sem === 'even' || sem === 'both')) {
                    return 'COMMUNICATIVE ARABIC';
                }

                // Malayalam → COMMUNICATIVE MALAYALAM (Even or Both)
                if (isMlm(norm) && (sem === 'even' || sem === 'both')) {
                    return 'COMMUNICATIVE MALAYALAM';
                }

                // Malayalam → MALAYALAM (Odd only)
                if (isMlm(norm) && sem === 'odd') {
                    return 'MALAYALAM';
                }

                return null;
            };

            await this.runBatchedOperation(snapshot.docs, (batch, docSnap) => {
                const data    = docSnap.data();
                const rawName = data.name || '';
                const semRaw  = data.activeSemester || '';

                const newName = resolveNewName(rawName, semRaw);
                if (newName && newName !== rawName.trim().toUpperCase()) {
                    batch.update(docSnap.ref, { name: newName });
                    previews.push(`"${rawName.trim()}" [${semRaw || 'Both'}] → "${newName}"`);
                    updated++;
                }
            });

            this.invalidateCache();
            return { updated, previews };
        } catch (error) {
            console.error('Error applying subject name substitutions:', error);
            throw error;
        }
    }

    /** DEBUG: returns raw name + activeSemester for every subject so we can diagnose matching issues */
    public async diagnosticSubjectNames(): Promise<{ name: string; activeSemester: string; id: string }[]> {
        const snapshot = await getDocs(collection(this.db, this.subjectsCollection));
        return snapshot.docs.map(d => ({
            id: d.id,
            name: d.data().name ?? '(no name)',
            activeSemester: d.data().activeSemester ?? '(no field)',
        }));
    }

    public async updateSubject(id: string, updates: Partial<SubjectConfig>): Promise<void> {
        try {
            const docRef = doc(this.db, this.subjectsCollection, id);
            // Deep clone and clean undefined values which can crash Firebase
            const normalizedUpdates = JSON.parse(JSON.stringify(updates));
            
            if (updates.facultyName !== undefined) {
                normalizedUpdates.facultyName = updates.facultyName ? normalizeName(updates.facultyName) : '';
            }

            if (updates.targetClasses !== undefined) {
                // Use activeTerm for correct class name normalization (not hardcoded old term)
                const activeTerm = this.getCurrentTermKey();
                normalizedUpdates.targetClasses = (updates.targetClasses || []).map(c => this.getDatabaseClassName(activeTerm, c));
            }
            
            // Critical safeguard: ensure mandatory numeric fields don't become NaN
            if (updates.maxINT !== undefined) normalizedUpdates.maxINT = Number(updates.maxINT) || 30;
            if (updates.maxEXT !== undefined) normalizedUpdates.maxEXT = Number(updates.maxEXT) || 70;

            await updateDoc(docRef, normalizedUpdates);
            this.invalidateCache();
        } catch (error) {
            console.error('Error updating subject:', error);
            throw error;
        }
    }

    public async deleteSubject(id: string): Promise<void> {
        try {
            const docRef = doc(this.db, this.subjectsCollection, id);
            await updateDoc(docRef, { isDeleted: true, deletedAt: Date.now() });
            this.invalidateCache();
        } catch (error) {
            console.error('Error soft-deleting subject:', error);
            throw error;
        }
    }

    public async hardDeleteSubject(id: string): Promise<void> {
        try {
            const docRef = doc(this.db, this.subjectsCollection, id);
            await deleteDoc(docRef);
            this.invalidateCache();
        } catch (error) {
            console.error('Error hard-deleting subject:', error);
            throw error;
        }
    }

    public async restoreSubject(id: string): Promise<void> {
        try {
            const docRef = doc(this.db, this.subjectsCollection, id);
            await updateDoc(docRef, { isDeleted: false, deletedAt: null });
            this.invalidateCache();
        } catch (error) {
            console.error('Error restoring subject:', error);
            throw error;
        }
    }

    public async getDeletedSubjects(): Promise<SubjectConfig[]> {
        try {
            const snapshot = await getDocs(collection(this.db, this.subjectsCollection));
            return snapshot.docs
                .map(doc => ({ id: doc.id, ...doc.data() } as SubjectConfig))
                .filter(subject => subject.isDeleted);
        } catch (error) {
            console.error('Error fetching deleted subjects:', error);
            return [];
        }
    }

    public async getSupplementaryExamsByStudent(studentId: string): Promise<any[]> {
        // This will be properly implemented when we have a SupplementaryService link
        // For now, it's a bridge to satisfy DataService interface
        return [];
    }

    public async getSubjectsByClass(className: string, termKey?: string): Promise<SubjectConfig[]> {
        const activeTerm = termKey || this.getCurrentTermKey();
        const subjects = await this.getAllSubjects(activeTerm, className);
        
        const normalizedClassName = this.getHistoricalClassName(
            activeTerm,
            this.getDatabaseClassName(activeTerm, className)
        );

        // Include subjects targeted for this class AND cross-class electives.
        // Consumers (like ApplicationPortal) handle student-level enrollment filtering.
        return subjects.filter(s => 
            (s.targetClasses || []).some(tc => 
                tc === normalizedClassName || tc === className || this.getDatabaseClassName(activeTerm, tc) === this.getDatabaseClassName(activeTerm, className)
            ) || 
            (s.subjectType === 'elective' && s.electiveType === 'cross-class')
        );
    }

    public async enrollStudentInSubject(subjectId: string, studentId: string): Promise<void> {
        try {
            const subject = await this.getSubjectById(subjectId);
            if (subject) {
                const enrolled = subject.enrolledStudents || [];
                if (!enrolled.includes(studentId)) {
                    await this.updateSubject(subjectId, { enrolledStudents: [...enrolled, studentId] });
                }
            }
        } catch (error) {
            console.error('Error enrolling student in subject:', error);
            throw error;
        }
    }

    public async unenrollStudentFromSubject(subjectId: string, studentId: string): Promise<void> {
        try {
            const subject = await this.getSubjectById(subjectId);
            if (subject) {
                const enrolled = subject.enrolledStudents || [];
                const updated = enrolled.filter(id => id !== studentId);
                await this.updateSubject(subjectId, { enrolledStudents: updated });
            }
        } catch (error) {
            console.error('Error unenrolling student from subject:', error);
            throw error;
        }
    }

    /**
     * Transfer a student's marks from one optional subject to another within the same term.
     * Used when a student switches subjects (class stays the same).
     *
     * Steps:
     *  1. Read existing marks for oldSubjectId.
     *  2. Copy them to newSubjectId in the term's academic history.
     *  3. Delete marks for oldSubjectId.
     *  4. Re-enroll the student in newSubjectId, remove from oldSubjectId.
     *  5. Recalculate term metrics (grandTotal, average, performanceLevel).
     */
    public async transferStudentSubjectMarks(
        studentId: string,
        oldSubjectId: string,
        newSubjectId: string,
        termKey: string
    ): Promise<void> {
        try {
            const studentDocRef = doc(this.db, this.studentsCollection, studentId);
            const studentSnap = await getDoc(studentDocRef);
            if (!studentSnap.exists()) throw new Error('Student not found');

            const data = studentSnap.data();
            const academicHistory = { ...(data.academicHistory || {}) };
            const termData = { ...(academicHistory[termKey] || {}) };
            const currentMarks: Record<string, SubjectMarks> = { ...(termData.marks || {}) };
            const currentMetadata: Record<string, any> = { ...(termData.subjectMetadata || {}) };

            // Move marks: copy old → new, delete old
            if (currentMarks[oldSubjectId]) {
                currentMarks[newSubjectId] = { ...currentMarks[oldSubjectId] };
                delete currentMarks[oldSubjectId];
            }
            if (currentMetadata[oldSubjectId]) {
                currentMetadata[newSubjectId] = { ...currentMetadata[oldSubjectId] };
                delete currentMetadata[oldSubjectId];
            }

            // Enrich metadata for new subject if possible
            const newSubject = await this.getSubjectById(newSubjectId);
            if (newSubject) {
                currentMetadata[newSubjectId] = {
                    name: newSubject.name,
                    arabicName: newSubject.arabicName,
                    maxINT: newSubject.maxINT,
                    maxEXT: newSubject.maxEXT,
                    passingTotal: newSubject.passingTotal,
                    facultyName: newSubject.facultyName,
                    subjectType: newSubject.subjectType
                };
            }

            const allSubjects = await this.getRawAllSubjects();
            const { grandTotal, average, performanceLevel } = this.calculateTermMetrics(currentMarks, allSubjects);

            // Reconstruct termData
            termData.marks = currentMarks;
            termData.subjectMetadata = currentMetadata;
            termData.grandTotal = grandTotal;
            termData.average = average;
            termData.performanceLevel = performanceLevel;
            
            if (!termData.className) {
                termData.className = data.currentClass || data.className || 'Unknown';
            }
            if (!termData.semester) {
                termData.semester = this.getLogicalSemester(termData.className, termKey.includes('Even') ? 'Even' : (termKey.includes('Bridge') ? 'Bridge' : 'Odd'));
            }

            academicHistory[termKey] = termData;

            await updateDoc(studentDocRef, { academicHistory });

            // Update enrollment: remove from old, add to new (for elective subjects)
            await this.unenrollStudentFromSubject(oldSubjectId, studentId);
            await this.enrollStudentInSubject(newSubjectId, studentId);

            this.invalidateCache();
        } catch (error) {
            console.error('Error transferring student subject marks:', error);
            throw error;
        }
    }

    public async updateMarks(studentId: string, subjectId: string, marks: Partial<SubjectMarks>, termKey?: string): Promise<void> {
        try {
            const activeTerm = termKey || this.getCurrentTermKey();
            const studentDocRef = doc(this.db, this.studentsCollection, studentId);
            const studentSnap = await getDoc(studentDocRef);
            
            if (studentSnap.exists()) {
                const data = studentSnap.data();
                const history = data.academicHistory || {};
                const termData = history[activeTerm] || {};
                const currentMarks = termData.marks || {};
                
                const existingMark = currentMarks[subjectId] || {};
                const newInt = marks.int !== undefined ? (marks.int === 'A' ? 'A' : Number(marks.int) || 0) : (existingMark.int || 0);
                const newExt = marks.ext !== undefined ? (marks.ext === 'A' ? 'A' : Number(marks.ext) || 0) : (existingMark.ext || 0);
                
                const currentSubject = await this.getSubjectById(subjectId);
                const mINT = currentSubject?.maxINT ?? 30;
                const mEXT = currentSubject?.maxEXT ?? 70;

                const updatedMark: SubjectMarks = {
                    ...existingMark,
                    int: newInt,
                    ext: newExt,
                    total: (newInt === 'A' ? 0 : newInt) + (newExt === 'A' ? 0 : newExt),
                    status: (newInt !== 'A' && newExt !== 'A' && newInt >= Math.ceil(mINT * 0.5) && newExt >= Math.ceil(mEXT * 0.4)) ? 'Passed' : 'Failed',
                    updatedAt: Date.now()
                };

                currentMarks[subjectId] = updatedMark;
                
                const subjectMetadata = termData.subjectMetadata || {};
                if (currentSubject) {
                    subjectMetadata[subjectId] = {
                        name: currentSubject.name,
                        arabicName: currentSubject.arabicName,
                        maxINT: currentSubject.maxINT,
                        maxEXT: currentSubject.maxEXT,
                        passingTotal: currentSubject.passingTotal,
                        facultyName: currentSubject.facultyName,
                        subjectType: currentSubject.subjectType
                    };
                }
                
                const allSubjects = await this.getRawAllSubjects();
                const { grandTotal, average, performanceLevel } = this.calculateTermMetrics(currentMarks, allSubjects);

                // Reconstruct termData safely
                termData.marks = currentMarks;
                termData.subjectMetadata = subjectMetadata;
                termData.grandTotal = grandTotal;
                termData.average = average;
                termData.performanceLevel = performanceLevel;

                if (!termData.className) {
                    termData.className = this.getHistoricalClassName(activeTerm, data.currentClass || data.className || 'Unknown');
                    termData.semester = this.getLogicalSemester(termData.className, activeTerm.includes('Even') ? 'Even' : (activeTerm.includes('Bridge') ? 'Bridge' : 'Odd'));
                }

                history[activeTerm] = termData;

                await updateDoc(studentDocRef, { academicHistory: history });
                this.invalidateCache();
            }
        } catch (error) {
            console.error('Error updating marks:', error);
            throw error;
        }
    }

    public async getRankings(className: string, termKey?: string): Promise<any[]> {
        const activeTerm = termKey || this.getCurrentTermKey();
        const dbClassName = this.getDatabaseClassName(activeTerm, className);
        
        const studentsSnap = await getDocs(query(collection(this.db, this.studentsCollection)));
        const classStudents = studentsSnap.docs
            .map(d => this.processStudentRecord(d.data(), d.id, activeTerm))
            .filter(s => s.className === className && s.academicHistory?.[activeTerm])
            .map(s => {
                const history = s.academicHistory![activeTerm];
                return {
                    id: s.id,
                    name: s.name,
                    adNo: s.adNo,
                    grandTotal: history.grandTotal || 0,
                    average: history.average || 0,
                    performanceLevel: history.performanceLevel || ('Pending' as PerformanceLevel)
                };
            })
            .sort((a, b) => b.grandTotal - a.grandTotal);

        return classStudents.map((s, index) => ({ ...s, rank: index + 1 }));
    }

    /**
     * Internal raw fetch for ALL subjects (including deleted), bypassing term filters.
     * Results are NOT cached to ensure callers get the full picture for recalculation.
     */
    public async getRawAllSubjects(): Promise<SubjectConfig[]> {
        try {
            const snapshot = await getDocs(collection(this.db, this.subjectsCollection));
            return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as SubjectConfig));
        } catch (error) {
            console.error('Error fetching raw subjects:', error);
            return [];
        }
    }

    /**
     * Repair orphaned subjects — subjects whose academicYear field was set to a year
     * that no longer exists in the configured available years (e.g. after a test year
     * was created then deleted). Re-tags them to the current active academic year so
     * they become visible again in the subject catalog and class reports.
     *
     * @returns Summary: how many subjects were scanned, fixed, and which years were found
     */
    public async repairOrphanedSubjects(targetYear?: string): Promise<{
        scanned: number;
        fixed: number;
        orphanYears: string[];
        targetYear: string;
    }> {
        try {
            const settings = BaseDataService.currentGlobalSettings;
            const activeYear = targetYear ||
                (settings?.currentAcademicYear) ||
                '2025-2026';

            const configuredYears = new Set<string>(
                (settings?.availableYears || [activeYear])
            );

            // Always treat blank/missing academicYear as belonging to the FIRST configured year
            const allSubjects = await this.getRawAllSubjects();
            const orphans: { id: string; currentYear: string }[] = [];

            for (const s of allSubjects) {
                if (s.isDeleted) continue; // Skip soft-deleted subjects
                const subjectYear = s.academicYear || '';
                // A subject is orphaned if its year is set to something real but not configured
                if (subjectYear && !configuredYears.has(subjectYear)) {
                    orphans.push({ id: s.id, currentYear: subjectYear });
                }
            }

            const orphanYears = [...new Set(orphans.map(o => o.currentYear))];

            if (orphans.length === 0) {
                return { scanned: allSubjects.length, fixed: 0, orphanYears: [], targetYear: activeYear };
            }

            // Batch update orphaned subjects to use the active/target year
            await this.runBatchedOperation(orphans, (batch, orphan) => {
                const ref = doc(this.db, this.subjectsCollection, orphan.id);
                batch.update(ref, { academicYear: activeYear });
            });

            this.invalidateCache();

            return {
                scanned: allSubjects.length,
                fixed: orphans.length,
                orphanYears,
                targetYear: activeYear
            };
        } catch (error) {
            console.error('Error repairing orphaned subjects:', error);
            throw error;
        }
    }

    /**
     * Calculates summary metrics for all semesters discovered in student histories.
     */
    public async getSemesterSummaries(): Promise<any[]> {
        try {
            const students = await getDocs(collection(this.db, this.studentsCollection));
            const termStats: Record<string, { studentCount: number; passedCount: number; totalMarks: number }> = {};

            students.docs.forEach(doc => {
                const data = doc.data();
                if (data.academicHistory) {
                    Object.entries(data.academicHistory).forEach(([termKey, history]: [string, any]) => {
                        if (!termStats[termKey]) {
                            termStats[termKey] = { studentCount: 0, passedCount: 0, totalMarks: 0 };
                        }
                        termStats[termKey].studentCount++;
                        if (history.performanceLevel && !history.performanceLevel.includes('Failed')) {
                            termStats[termKey].passedCount++;
                        }
                        termStats[termKey].totalMarks += (history.grandTotal || 0);
                    });
                }
            });

            return Object.entries(termStats).map(([termKey, stats]) => {
                const lastHyphenIndex = termKey.lastIndexOf('-');
                let academicYear = termKey;
                let semester = '';

                if (lastHyphenIndex !== -1) {
                    academicYear = termKey.substring(0, lastHyphenIndex);
                    semester = termKey.substring(lastHyphenIndex + 1);
                    
                    // Further check: If the 'semester' part doesn't look like Odd/Even, 
                    // it might be part of a YYYY-YYYY year.
                    if (semester !== 'Odd' && semester !== 'Even') {
                        academicYear = termKey;
                        semester = 'Inconsistent';
                    }
                } else {
                    semester = 'Inconsistent';
                }

                return {
                    termKey,
                    academicYear,
                    semester,
                    studentCount: stats.studentCount,
                    passPercentage: stats.studentCount > 0 ? Math.round((stats.passedCount / stats.studentCount) * 100) : 0,
                    averageScore: stats.studentCount > 0 ? Math.round(stats.totalMarks / stats.studentCount) : 0
                };
            }).sort((a, b) => b.termKey.localeCompare(a.termKey));
        } catch (error) {
            console.error('Error fetching semester summaries:', error);
            return [];
        }
    }

    /**
     * Normalizes all faculty names in the subjects collection.
     */
    public async normalizeAllFacultyNames(): Promise<number> {
        try {
            const subjects = await this.getRawAllSubjects();
            let count = 0;
            
            await this.runBatchedOperation(subjects, (batch, subject) => {
                if (subject.facultyName) {
                    const normalized = normalizeName(subject.facultyName);
                    if (normalized !== subject.facultyName) {
                        const docRef = doc(this.db, this.subjectsCollection, subject.id);
                        batch.update(docRef, { facultyName: normalized });
                        count++;
                    }
                }
            });
            
            this.invalidateCache();
            return count;
        } catch (error) {
            console.error('Error normalizing faculty names:', error);
            throw error;
        }
    }

    public async recalculateAllMarkStatuses(targetTermKey?: string): Promise<{ updated: number }> {
        try {
            const students = await getDocs(collection(this.db, this.studentsCollection));
            let updatedCount = 0;

            await this.runBatchedOperation(students.docs, (batch, d) => {
                const data = d.data();
                const history = data.academicHistory || {};
                let changed = false;

                const keys = targetTermKey ? [targetTermKey] : Object.keys(history);

                keys.forEach(termKey => {
                    const termData = history[termKey];
                    if (termData && termData.marks) {
                        Object.entries(termData.marks).forEach(([subId, mark]: [string, any]) => {
                            const total = (mark.int || 0) + (mark.ext || 0);
                            const status = total >= 40 ? 'Passed' : 'Failed';
                            if (mark.total !== total || mark.status !== status) {
                                termData.marks[subId] = { ...mark, total, status };
                                changed = true;
                            }
                        });
                    }
                });

                if (changed) {
                    batch.update(d.ref, { academicHistory: history });
                    updatedCount++;
                }
            });

            return { updated: updatedCount };
        } catch (error) {
            console.error('Error recalculating mark statuses:', error);
            throw error;
        }
    }

    public async recalculateAllStudentTotals(targetTermKey?: string): Promise<{ updated: number }> {
        try {
            const subjects = await this.getRawAllSubjects();
            const students = await getDocs(collection(this.db, this.studentsCollection));
            let updatedCount = 0;

            await this.runBatchedOperation(students.docs, (batch, d) => {
                const data = d.data();
                const history = data.academicHistory || {};
                let changed = false;

                const keys = targetTermKey ? [targetTermKey] : Object.keys(history);

                keys.forEach(termKey => {
                    const termData = history[termKey];
                    if (termData && termData.marks) {
                        const { grandTotal, average } = this.calculateTermMetrics(termData.marks, subjects);
                        if (termData.grandTotal !== grandTotal || termData.average !== average) {
                            termData.grandTotal = grandTotal;
                            termData.average = average;
                            changed = true;
                        }
                    }
                });

                if (changed) {
                    batch.update(d.ref, { academicHistory: history });
                    updatedCount++;
                }
            });

            return { updated: updatedCount };
        } catch (error) {
            console.error('Error recalculating student totals:', error);
            throw error;
        }
    }

    public async recalculateAllStudentPerformanceLevels(targetTermKey?: string): Promise<{ updated: number }> {
        try {
            const subjects = await this.getRawAllSubjects();
            const students = await getDocs(collection(this.db, this.studentsCollection));
            let updatedCount = 0;

            await this.runBatchedOperation(students.docs, (batch, d) => {
                const data = d.data();
                const history = data.academicHistory || {};
                let changed = false;

                const keys = targetTermKey ? [targetTermKey] : Object.keys(history);

                keys.forEach(termKey => {
                    const termData = history[termKey];
                    if (termData && termData.marks) {
                        const { performanceLevel } = this.calculateTermMetrics(termData.marks, subjects);
                        if (termData.performanceLevel !== performanceLevel) {
                            termData.performanceLevel = performanceLevel;
                            changed = true;
                        }
                    }
                });

                if (changed) {
                    batch.update(d.ref, { academicHistory: history });
                    updatedCount++;
                }
            });

            return { updated: updatedCount };
        } catch (error) {
            console.error('Error recalculating performance levels:', error);
            throw error;
        }
    }



    public async exportMarksToExcel(className: string, termKey: string): Promise<void> {
        try {
            const studentsSnapshot = await getDocs(collection(this.db, this.studentsCollection));
            const classStudents = studentsSnapshot.docs
                .map(d => this.processStudentRecord(d.data(), d.id, termKey))
                .filter(s => s.className === className && s.academicHistory?.[termKey]);
            
            if (classStudents.length === 0) {
                throw new Error('No student data found for this class and term.');
            }

            const subjects = await this.getAllSubjects(termKey, className);
            // getAllSubjects already maps targetClasses to historical aliases, filter by historical name
            const classSubjects = subjects.filter(s => (s.targetClasses || []).includes(className));

            const excelData = classStudents.map(student => {
                const row: any = {
                    'Admission No': student.adNo,
                    'Student Name': student.name
                };

                classSubjects.forEach(sub => {
                    const mark = student.academicHistory![termKey].marks[sub.id];
                    row[`${sub.name} (INT)`] = mark?.int || 0;
                    row[`${sub.name} (EXT)`] = mark?.ext || 0;
                    row[`${sub.name} (Total)`] = mark?.total || 0;
                });

                row['Grand Total'] = student.academicHistory![termKey].grandTotal;
                row['Average'] = student.academicHistory![termKey].average;
                row['Performance'] = student.academicHistory![termKey].performanceLevel;
                return row;
            });

            await ExcelUtils.exportToExcel(`Marks_${className}_${termKey}.xlsx`, [
                { name: 'Marks', data: excelData }
            ]);
        } catch (error) {
            console.error('Error exporting to Excel:', error);
            throw error;
        }
    }

    public async importMarksFromExcel(file: File, termKey: string): Promise<{ updated: number; errors: string[] }> {
        try {
            const json = await ExcelUtils.parseExcelFile(file);
            const subjects = await this.getRawAllSubjects();
            let updated = 0;
            const errors: string[] = [];

            for (const row of json) {
                const adNo = row['Admission No']?.toString();
                if (!adNo) continue;

                const q = query(collection(this.db, this.studentsCollection), where('adNo', '==', adNo));
                const snap = await getDocs(q);
                if (snap.empty) {
                    errors.push(`Student with AdNo ${adNo} not found.`);
                    continue;
                }

                const studentDoc = snap.docs[0];
                const studentData = studentDoc.data();
                const history = studentData.academicHistory || {};
                const termData = history[termKey] || { marks: {} };
                const newMarks = { ...termData.marks };

                let rowChanged = false;
                Object.keys(row).forEach(key => {
                    if (key.includes('(INT)') || key.includes('(EXT)')) {
                        const subName = key.split('(')[0].trim();
                        const isInt = key.includes('(INT)');
                        const subject = subjects.find(s => s.name === subName);
                        if (subject) {
                            const val = parseInt(row[key]) || 0;
                            const subId = subject.id;
                            if (!newMarks[subId]) newMarks[subId] = { int: 0, ext: 0, total: 0, status: 'Pending' };
                            
                            if (isInt) newMarks[subId].int = val;
                            else newMarks[subId].ext = val;
                            
                            newMarks[subId].total = (newMarks[subId].int || 0) + (newMarks[subId].ext || 0);
                            newMarks[subId].status = newMarks[subId].total >= 40 ? 'Passed' : 'Failed';
                            rowChanged = true;
                        }
                    }
                });

                if (rowChanged) {
                    const { grandTotal, average, performanceLevel } = this.calculateTermMetrics(newMarks, subjects);
                    
                    // Capture snapshots for imported subjects
                    const snapshotData: Record<string, SubjectSnapshot> = termData.subjectMetadata || {};
                    Object.keys(newMarks).forEach(subId => {
                        const subConfig = subjects.find(s => s.id === subId);
                        if (subConfig && !snapshotData[subId]) {
                            snapshotData[subId] = {
                                name: subConfig.name,
                                arabicName: subConfig.arabicName || '',
                                facultyName: subConfig.facultyName || '',
                                maxINT: subConfig.maxINT,
                                maxEXT: subConfig.maxEXT,
                                passingTotal: subConfig.passingTotal || 40,
                                subjectType: subConfig.subjectType || 'general',
                                timestamp: Date.now()
                            };
                        }
                    });

                    await updateDoc(studentDoc.ref, {
                        [`academicHistory.${termKey}.marks`]: newMarks,
                        [`academicHistory.${termKey}.subjectMetadata`]: snapshotData,
                        [`academicHistory.${termKey}.grandTotal`]: grandTotal,
                        [`academicHistory.${termKey}.average`]: average,
                        [`academicHistory.${termKey}.performanceLevel`]: performanceLevel
                    });
                    updated++;
                }
            }
            return { updated, errors };
        } catch (err) {
            console.error('Error importing marks from Excel:', err);
            throw err;
        }
    }
    public async getEnrolledStudentsForSubject(subjectId: string, termKey?: string): Promise<string[]> {
        const subject = await this.getSubjectById(subjectId);
        return subject?.enrolledStudents || [];
    }

    public async clearStudentSubjectMarks(studentId: string, subjectId: string, termKey?: string): Promise<void> {
        try {
            const activeTerm = termKey || this.getCurrentTermKey();
            const studentDocRef = doc(this.db, this.studentsCollection, studentId);
            const studentSnap = await getDoc(studentDocRef);

            if (studentSnap.exists()) {
                const data = studentSnap.data();
                const history = data.academicHistory || {};
                const termData = history[activeTerm] || {};
                const currentMarks = termData.marks || {};

                delete currentMarks[subjectId];

                const allSubjects = await this.getRawAllSubjects();
                const { grandTotal, average, performanceLevel } = this.calculateTermMetrics(currentMarks, allSubjects);

                const updates: any = {
                    [`academicHistory.${activeTerm}.marks`]: currentMarks,
                    [`academicHistory.${activeTerm}.grandTotal`]: grandTotal,
                    [`academicHistory.${activeTerm}.average`]: average,
                    [`academicHistory.${activeTerm}.performanceLevel`]: performanceLevel
                };

                // CRITICAL: Maintain historical className integrity
                if (!termData.className) {
                    updates[`academicHistory.${activeTerm}.className`] = data.currentClass || data.className || 'Unknown';
                    updates[`academicHistory.${activeTerm}.semester`] = activeTerm.split('-').pop() || 'Odd';
                }

                await updateDoc(studentDocRef, updates);
                this.invalidateCache();
            }
        } catch (error) {
            console.error('Error clearing student marks:', error);
            throw error;
        }
    }

    public async clearSubjectMarks(subjectId: string, studentIds: string[], termKey?: string): Promise<void> {
        await Promise.all(studentIds.map(id => this.clearStudentSubjectMarks(id, subjectId, termKey)));
    }

    public async clearSubjectINTMarks(subjectId: string, studentIds: string[], termKey?: string): Promise<void> {
        if (!studentIds.length) return;
        // Use bulkUpdateMarks for efficient batched writes instead of sequential per-student awaits
        const updates = studentIds.map(studentId => ({ studentId, subjectId, marks: { int: 0 as number } }));
        return this.bulkUpdateMarks(updates, termKey);
    }

    public async clearSubjectEXTMarks(subjectId: string, studentIds: string[], termKey?: string): Promise<void> {
        if (!studentIds.length) return;
        // Use bulkUpdateMarks for efficient batched writes instead of sequential per-student awaits
        const updates = studentIds.map(studentId => ({ studentId, subjectId, marks: { ext: 0 as number } }));
        return this.bulkUpdateMarks(updates, termKey);
    }

    public async bulkUpdateMarks(updates: Array<{ studentId: string, subjectId: string, marks: Partial<SubjectMarks>, maxINT?: number, maxEXT?: number }>, termKey?: string): Promise<void> {
        if (!updates.length) return;
        const activeTerm = termKey || this.getCurrentTermKey();
        const allSubjects = await this.getRawAllSubjects();
        
        // Group updates by student to minimize doc interactions
        const studentUpdates = new Map<string, typeof updates>();
        updates.forEach(u => {
            const existing = studentUpdates.get(u.studentId) || [];
            existing.push(u);
            studentUpdates.set(u.studentId, existing);
        });

        const studentIds = Array.from(studentUpdates.keys());
        const studentSnaps = await Promise.all(studentIds.map(id => getDoc(doc(this.db, this.studentsCollection, id))));

        // Process in Firestore-safe batches of 400 writes per batch
        const SAFE_BATCH_SIZE = 400;
        let batch = writeBatch(this.db);
        let count = 0;

        const flushBatch = async () => {
            if (count > 0) {
                await batch.commit();
                batch = writeBatch(this.db); // IMPORTANT: create a fresh batch after commit
                count = 0;
            }
        };

        for (let i = 0; i < studentSnaps.length; i++) {
            const studentSnap = studentSnaps[i];
            const studentId = studentIds[i];
            const studentMarks = studentUpdates.get(studentId) || [];
            
            if (!studentSnap.exists()) continue;

            const data = studentSnap.data();
            const history = data.academicHistory || {};
            const termData = history[activeTerm] || { marks: {}, subjectMetadata: {} };
            const currentMarks = { ...termData.marks };
            const subjectMetadata = { ...termData.subjectMetadata };

            // Build subject ID lookup map for O(1) lookups
            const subjectMap = new Map(allSubjects.map(s => [s.id, s]));

            for (const u of studentMarks) {
                const existingMark = currentMarks[u.subjectId] || {};
                const newInt = u.marks.int !== undefined ? (u.marks.int === 'A' ? 'A' : Number(u.marks.int) || 0) : (existingMark.int || 0);
                const newExt = u.marks.ext !== undefined ? (u.marks.ext === 'A' ? 'A' : Number(u.marks.ext) || 0) : (existingMark.ext || 0);
                
                const subConfig = subjectMap.get(u.subjectId);
                const mINT = u.maxINT ?? subConfig?.maxINT ?? 30;
                const mEXT = u.maxEXT ?? subConfig?.maxEXT ?? 70;

                const updatedMark: SubjectMarks = {
                    ...existingMark,
                    int: newInt,
                    ext: newExt,
                    total: (newInt === 'A' ? 0 : newInt) + (newExt === 'A' ? 0 : newExt),
                    status: (newInt !== 'A' && newExt !== 'A' && newInt >= Math.ceil(mINT * 0.5) && newExt >= Math.ceil(mEXT * 0.4)) ? 'Passed' : 'Failed',
                    updatedAt: Date.now()
                };
                currentMarks[u.subjectId] = updatedMark;
                
                if (subConfig && !subjectMetadata[u.subjectId]) {
                    subjectMetadata[u.subjectId] = {
                        name: subConfig.name,
                        arabicName: subConfig.arabicName,
                        maxINT: subConfig.maxINT,
                        maxEXT: subConfig.maxEXT,
                        passingTotal: subConfig.passingTotal,
                        facultyName: subConfig.facultyName,
                        subjectType: subConfig.subjectType
                    };
                }
            }

            const { grandTotal, average, performanceLevel } = this.calculateTermMetrics(currentMarks, allSubjects);

            termData.marks = currentMarks;
            termData.subjectMetadata = subjectMetadata;
            termData.grandTotal = grandTotal;
            termData.average = average;
            termData.performanceLevel = performanceLevel;

            if (!termData.className) {
                termData.className = this.getHistoricalClassName(activeTerm, data.currentClass || data.className || 'Unknown');
                termData.semester = this.getLogicalSemester(termData.className, activeTerm.includes('Even') ? 'Even' : (activeTerm.includes('Bridge') ? 'Bridge' : 'Odd'));
            }

            history[activeTerm] = termData;
            batch.update(studentSnap.ref, { academicHistory: history });
            count++;

            if (count >= SAFE_BATCH_SIZE) {
                await flushBatch();
            }
        }

        await flushBatch();
        this.invalidateCache();
    }

    public async bulkUpdateEXTMarks(updates: Array<{ studentId: string, subjectId: string, ext: number | 'A', maxEXT?: number }>, termKey?: string): Promise<void> {
        const formattedUpdates = updates.map(u => ({
            studentId: u.studentId,
            subjectId: u.subjectId,
            marks: { ext: u.ext },
            maxEXT: u.maxEXT
        }));
        return this.bulkUpdateMarks(formattedUpdates, termKey);
    }
}
