import { 
    collection, 
    getDocs, 
    addDoc, 
    writeBatch, 
    doc 
} from 'firebase/firestore';
import { BaseDataService } from './BaseDataService';
import { 
    SubjectConfig, 
    CurriculumEntry, 
    GlobalSettings 
} from '../../../domain/entities/types';

export class SemesterMigrationService extends BaseDataService {
    /**
     * Deep clones selected configuration (Subjects, Curriculum) from one semester to another.
     *
     * @param fromTermKey  Source term key (e.g. "2025-2026-Odd")
     * @param toTermKey    Destination term key (e.g. "2025-2026-Even")
     * @param selectedSubjectIds  If provided, ONLY these subject IDs will be cloned.
     *                            If omitted/empty, NO subjects are cloned (clean slate).
     * @param selectedFacultyNames If provided, only subjects whose facultyName matches
     *                             one of these will be cloned (applied AFTER selectedSubjectIds).
     */
    public async initializeNewSemester(
        fromTermKey: string,
        toTermKey: string,
        selectedSubjectIds?: string[],
        selectedFacultyNames?: string[]
    ): Promise<{ subjectsCloned: number; curriculumCloned: number }> {
        try {
            console.log(`Initializing migration from ${fromTermKey} to ${toTermKey}...`);
            
            const [fromYear, fromSem] = this.parseTermKey(fromTermKey);
            const [toYear, toSem]     = this.parseTermKey(toTermKey);

            // 1. Clone Subjects (respecting user selections)
            const subjectsCloned = await this.cloneSubjects(
                fromYear, fromSem as 'Odd' | 'Even',
                toYear,   toSem   as 'Odd' | 'Even',
                selectedSubjectIds,
                selectedFacultyNames
            );

            // 2. Clone Curriculum (only for selected subjects when filter is active)
            const curriculumCloned = await this.cloneCurriculum(fromTermKey, toTermKey, toYear, selectedSubjectIds);

            console.log(`Migration Complete: ${subjectsCloned} subjects, ${curriculumCloned} curriculum entries.`);
            return { subjectsCloned, curriculumCloned };
        } catch (error) {
            console.error('Error during semester initialization:', error);
            throw error;
        }
    }

    private parseTermKey(termKey: string): [string, string] {
        const parts = termKey.split('-');
        const sem   = parts.pop() || '';
        const year  = parts.join('-');
        return [year, sem];
    }

    private async cloneSubjects(
        fromYear: string,
        fromSem: 'Odd' | 'Even',
        toYear: string,
        toSem: 'Odd' | 'Even',
        selectedSubjectIds?: string[],
        selectedFacultyNames?: string[]
    ): Promise<number> {
        // If no subjects were selected at all, clone nothing
        if (selectedSubjectIds !== undefined && selectedSubjectIds.length === 0) {
            console.log('[SemesterMigrationService] No subjects selected — skipping subject clone.');
            return 0;
        }

        const subjectsSnap = await getDocs(collection(this.db, this.subjectsCollection));
        let count = 0;

        const operations: SubjectConfig[] = [];
        const selectedIdSet     = selectedSubjectIds     ? new Set(selectedSubjectIds)     : null;
        const selectedFacultySet = selectedFacultyNames  ? new Set(selectedFacultyNames.map(f => (f || '').toLowerCase().trim())) : null;

        subjectsSnap.docs.forEach(docSnap => {
            const data = docSnap.data() as SubjectConfig;

            // Skip deleted subjects
            if (data.isDeleted) return;

            // Must match the source year and semester (or be 'Both')
            if (data.academicYear !== fromYear) return;
            if (data.activeSemester !== fromSem && data.activeSemester !== 'Both') return;

            // Honour whitelist: if a selection was passed, only clone listed subjects
            if (selectedIdSet && !selectedIdSet.has(docSnap.id)) return;

            // Honour faculty filter: if faculty names were passed, only clone subjects matching
            if (selectedFacultySet && data.facultyName) {
                const normalizedFaculty = (data.facultyName || '').toLowerCase().trim();
                if (!selectedFacultySet.has(normalizedFaculty)) return;
            }

            operations.push({ id: docSnap.id, ...data } as SubjectConfig);
        });

        await this.runBatchedOperation(operations, (batch, subject) => {
            const newRef = doc(collection(this.db, this.subjectsCollection));
            const { id, ...cloneData } = subject as any;
            batch.set(newRef, {
                ...cloneData,
                academicYear: toYear,
                activeSemester: toSem,
                enrolledStudents: [] // Clear enrollment for new term
            });
            count++;
        });

        return count;
    }

    /**
     * ONE-TIME PERMANENT MIGRATION: Copies top-level student marks into the correct
     * academicHistory[legacyTerm] entry in Firestore for ALL students that still have
     * legacy data (marks stored at the root of the document rather than inside academicHistory).
     *
     * Safe to run multiple times — skips students that already have marks in history.
     *
     * @returns Summary of how many students were migrated and how many were already clean.
     */
    public async migrateLegacyStudentMarks(): Promise<{
        migrated: number;
        skipped: number;
        errors: number;
        details: string[];
    }> {
        const result = { migrated: 0, skipped: 0, errors: 0, details: [] as string[] };

        try {
            const snapshot = await getDocs(collection(this.db, this.studentsCollection));

            const toMigrate: Array<{ docRef: any; data: any; legacyTerm: string; updatedHistory: Record<string, any> }> = [];

            snapshot.docs.forEach(docSnap => {
                const data = docSnap.data();
                let needsUpdate = false;
                const academicHistory = { ...(data.academicHistory || {}) };
                const legacyTerm: string = data.termKey || '2025-2026-Odd';

                // 1. Permanently normalize classNames across ALL term entries in academicHistory (e.g. FS2 -> S1 in Odd terms)
                Object.keys(academicHistory).forEach(termKey => {
                    const entry = academicHistory[termKey];
                    if (entry && entry.className) {
                        const normalizedCls = this.getHistoricalClassName(termKey, entry.className);
                        if (normalizedCls !== entry.className) {
                            academicHistory[termKey] = { ...entry, className: normalizedCls };
                            needsUpdate = true;
                        }
                    }
                });

                // 2. Populate legacy top-level marks into academicHistory[legacyTerm] if missing
                if (data.marks && Object.keys(data.marks).length > 0) {
                    const existingHistoryEntry = academicHistory[legacyTerm] || {};
                    const historyHasMarks = existingHistoryEntry.marks && Object.keys(existingHistoryEntry.marks).length > 0;

                    if (!historyHasMarks) {
                        const semesterType = legacyTerm.endsWith('-Odd') ? 'Odd' : 'Even';
                        const rawClassName = existingHistoryEntry.className || data.currentClass || data.className || 'Unknown';
                        const resolvedClassName = this.getHistoricalClassName(legacyTerm, rawClassName);

                        // Calculate totals from marks if grandTotal is 0
                        const marks: Record<string, any> = data.marks || {};
                        let calculatedTotal = data.grandTotal || 0;
                        let calculatedAverage = data.average || 0;
                        let failCount = 0;
                        let validCount = 0;

                        if (calculatedTotal === 0) {
                            let sum = 0;
                            Object.values(marks).forEach((m: any) => {
                                const subTotal = typeof m.total === 'number' ? m.total : ((Number(m.int) || 0) + (Number(m.ext) || 0));
                                sum += subTotal;
                                if (subTotal > 0 || m.int !== undefined || m.ext !== undefined) validCount++;
                                if (m.status === 'Failed') failCount++;
                            });
                            calculatedTotal = sum;
                            calculatedAverage = validCount > 0 ? Math.round((sum / validCount) * 10) / 10 : 0;
                        }

                        const performanceLevel = data.performanceLevel ||
                            (calculatedTotal > 0 ? (failCount > 0 ? 'Failed' : 'Passed') : 'Pending');

                        academicHistory[legacyTerm] = {
                            ...existingHistoryEntry,
                            className: resolvedClassName,
                            semester: existingHistoryEntry.semester || semesterType,
                            marks,
                            grandTotal: calculatedTotal,
                            average: calculatedAverage,
                            rank: existingHistoryEntry.rank || data.rank || 0,
                            performanceLevel,
                        };
                        needsUpdate = true;
                    }
                }

                if (needsUpdate) {
                    toMigrate.push({ docRef: docSnap.ref, data, legacyTerm, updatedHistory: academicHistory });
                } else {
                    result.skipped++;
                }
            });

            if (toMigrate.length === 0) {
                result.details.push('All student records already have clean, normalized academic history. No migration needed.');
                return result;
            }

            // Execute batched updates in Firestore
            await this.runBatchedOperation(toMigrate, (batch, item) => {
                try {
                    batch.update(item.docRef, { academicHistory: item.updatedHistory });
                    result.migrated++;
                    const adNo = item.data.adNo || item.data.id;
                    const histCls = item.updatedHistory[item.legacyTerm]?.className || 'Updated';
                    result.details.push(`Updated: ${adNo} (${histCls}) → ${item.legacyTerm}`);
                } catch (err) {
                    result.errors++;
                    result.details.push(`Error updating student ${item.data?.adNo || 'unknown'}`);
                }
            });

            result.details.unshift(`Migration complete: ${result.migrated} students updated in Firestore, ${result.skipped} already clean, ${result.errors} errors.`);
        } catch (error) {
            console.error('Fatal error during legacy student migration:', error);
            result.errors++;
            result.details.push(`Fatal migration error: ${error}`);
        }

        return result;
    }

    private async cloneCurriculum(
        fromTermKey: string,
        toTermKey: string,
        toYear: string,
        selectedSubjectIds?: string[]
    ): Promise<number> {
        const curriculumSnap = await getDocs(collection(this.db, this.curriculumCollection));
        let count = 0;

        const selectedIdSet = selectedSubjectIds ? new Set(selectedSubjectIds) : null;

        const operations: CurriculumEntry[] = [];
        curriculumSnap.docs.forEach(docSnap => {
            const data = docSnap.data() as CurriculumEntry;
            if (data.termKey !== fromTermKey) return;

            // If a subject filter is active, only clone curriculum matching selected subjects
            if (selectedIdSet && data.subjectCode && !selectedIdSet.has(data.subjectCode)) return;

            operations.push({ id: docSnap.id, ...data } as CurriculumEntry);
        });

        await this.runBatchedOperation(operations, (batch, entry) => {
            const newRef = doc(collection(this.db, this.curriculumCollection));
            const { id, ...cloneData } = entry as any;
            batch.set(newRef, {
                ...cloneData,
                termKey: toTermKey,
                academicYear: toYear
            });
            count++;
        });

        return count;
    }
}
