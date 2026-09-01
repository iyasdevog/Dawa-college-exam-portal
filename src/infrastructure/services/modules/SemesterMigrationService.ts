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
    /**
     * COMPREHENSIVE SYSTEM-WIDE DATA MIGRATION:
     * 1. Permanently normalizes historical classNames across all academicHistory entries in Firestore.
     * 2. Recalculates and persists grandTotal, average, and performanceLevel for every history term.
     * 3. Normalizes subject ID keys (trims whitespace) inside student marks maps.
     * 4. Ensures top-level currentClass and className fields are populated and in sync.
     * 5. Normalizes subject targetClasses in the subjects collection so historical & DB names align.
     */
    public async migrateLegacyStudentMarks(): Promise<{
        migrated: number;
        skipped: number;
        errors: number;
        details: string[];
    }> {
        const result = { migrated: 0, skipped: 0, errors: 0, details: [] as string[] };

        try {
            // A. Migrate & Normalize Students Collection
            const snapshot = await getDocs(collection(this.db, this.studentsCollection));
            const toMigrate: Array<{ docRef: any; data: any; legacyTerm: string; updatedHistory: Record<string, any>; extraUpdates?: Record<string, any> }> = [];

            snapshot.docs.forEach(docSnap => {
                const data = docSnap.data();
                let needsUpdate = false;
                const academicHistory = { ...(data.academicHistory || {}) };
                const rawLegacyTerm: string = data.termKey || '2025-2026-Odd';
                const legacyTerm = (!rawLegacyTerm || rawLegacyTerm === '2025-Odd' || rawLegacyTerm === '2025') 
                    ? '2025-2026-Odd' 
                    : (rawLegacyTerm === '2025-Even' ? '2025-2026-Even' : rawLegacyTerm);
                const extraUpdates: Record<string, any> = {};

                // Normalize top-level termKey if non-canonical
                if (data.termKey && data.termKey !== legacyTerm) {
                    extraUpdates.termKey = legacyTerm;
                    needsUpdate = true;
                }

                // 1. Top-level currentClass & className normalization
                const currentCls = data.currentClass || data.className || 'Unknown';
                if (!data.currentClass || !data.className || data.currentClass !== currentCls || data.className !== currentCls) {
                    extraUpdates.currentClass = currentCls;
                    extraUpdates.className = currentCls;
                    needsUpdate = true;
                }

                // Migrate non-canonical history keys (e.g. '2025-Odd' -> '2025-2026-Odd')
                Object.keys(academicHistory).forEach(tk => {
                    const canonicalKey = (!tk || tk === '2025-Odd' || tk === '2025') 
                        ? '2025-2026-Odd' 
                        : (tk === '2025-Even' ? '2025-2026-Even' : tk);

                    if (canonicalKey !== tk) {
                        academicHistory[canonicalKey] = {
                            ...(academicHistory[canonicalKey] || {}),
                            ...academicHistory[tk]
                        };
                        delete academicHistory[tk];
                        needsUpdate = true;
                    }
                });

                // 2. Normalize classNames, recalculate totals, and trim subject keys across ALL academicHistory entries
                Object.keys(academicHistory).forEach(termKey => {
                    const entry = academicHistory[termKey];
                    if (!entry) return;

                    let entryChanged = false;
                    let updatedEntry = { ...entry };

                    // 2a. Normalize className (e.g. FS2 -> S1 for Odd terms)
                    if (entry.className) {
                        const normalizedCls = this.getHistoricalClassName(termKey, entry.className);
                        if (normalizedCls !== entry.className) {
                            updatedEntry.className = normalizedCls;
                            entryChanged = true;
                        }
                    } else {
                        updatedEntry.className = this.getHistoricalClassName(termKey, currentCls);
                        entryChanged = true;
                    }

                    // 2b. Trim subject ID keys in marks map
                    const marksMap = entry.marks || {};
                    const cleanedMarks: Record<string, any> = {};
                    let marksKeyChanged = false;

                    Object.entries(marksMap).forEach(([subId, markData]: [string, any]) => {
                        const trimmedId = subId.trim();
                        cleanedMarks[trimmedId] = markData;
                        if (trimmedId !== subId) marksKeyChanged = true;
                    });

                    if (marksKeyChanged) {
                        updatedEntry.marks = cleanedMarks;
                        entryChanged = true;
                    }

                    // 2c. Recalculate grandTotal, average, performanceLevel if total is 0 but marks exist
                    const markValues = Object.values(updatedEntry.marks || {}) as any[];
                    if (markValues.length > 0) {
                        let sum = 0;
                        let validCount = 0;
                        let failCount = 0;

                        markValues.forEach(m => {
                            const subTotal = typeof m.total === 'number' ? m.total : ((Number(m.int) || 0) + (Number(m.ext) || 0));
                            sum += subTotal;
                            if (subTotal > 0 || m.int !== undefined || m.ext !== undefined) validCount++;
                            if (m.status === 'Failed') failCount++;
                        });

                        if ((updatedEntry.grandTotal === undefined || updatedEntry.grandTotal === 0) && sum > 0) {
                            updatedEntry.grandTotal = sum;
                            entryChanged = true;
                        }
                        if ((updatedEntry.average === undefined || updatedEntry.average === 0) && validCount > 0 && sum > 0) {
                            updatedEntry.average = Math.round((sum / validCount) * 10) / 10;
                            entryChanged = true;
                        }
                        if ((!updatedEntry.performanceLevel || updatedEntry.performanceLevel === 'Pending' || updatedEntry.performanceLevel === 'Not Assessed') && sum > 0) {
                            updatedEntry.performanceLevel = failCount > 0 ? 'Failed' : 'Passed';
                            entryChanged = true;
                        }
                    }

                    if (entryChanged) {
                        academicHistory[termKey] = updatedEntry;
                        needsUpdate = true;
                    }
                });

                // 3. Populate legacy top-level marks into academicHistory[legacyTerm] if missing
                if (data.marks && Object.keys(data.marks).length > 0) {
                    const existingHistoryEntry = academicHistory[legacyTerm] || {};
                    const historyHasMarks = existingHistoryEntry.marks && Object.keys(existingHistoryEntry.marks).length > 0;

                    if (!historyHasMarks) {
                        const semesterType = legacyTerm.endsWith('-Odd') ? 'Odd' : 'Even';
                        const rawClassName = existingHistoryEntry.className || currentCls;
                        const resolvedClassName = this.getHistoricalClassName(legacyTerm, rawClassName);

                        // Clean marks keys
                        const cleanedTopMarks: Record<string, any> = {};
                        Object.entries(data.marks).forEach(([k, v]: [string, any]) => {
                            cleanedTopMarks[k.trim()] = v;
                        });

                        let calculatedTotal = data.grandTotal || 0;
                        let calculatedAverage = data.average || 0;
                        let failCount = 0;
                        let validCount = 0;

                        if (calculatedTotal === 0) {
                            let sum = 0;
                            Object.values(cleanedTopMarks).forEach((m: any) => {
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
                            marks: cleanedTopMarks,
                            grandTotal: calculatedTotal,
                            average: calculatedAverage,
                            rank: existingHistoryEntry.rank || data.rank || 0,
                            performanceLevel,
                        };
                        needsUpdate = true;
                    }
                }

                if (needsUpdate) {
                    toMigrate.push({ docRef: docSnap.ref, data, legacyTerm, updatedHistory: academicHistory, extraUpdates });
                } else {
                    result.skipped++;
                }
            });

            // Execute batched updates for Students in Firestore
            if (toMigrate.length > 0) {
                await this.runBatchedOperation(toMigrate, (batch, item) => {
                    try {
                        batch.update(item.docRef, {
                            academicHistory: item.updatedHistory,
                            ...item.extraUpdates
                        });
                        result.migrated++;
                        const adNo = item.data.adNo || item.data.id;
                        const histCls = item.updatedHistory[item.legacyTerm]?.className || 'Updated';
                        result.details.push(`Updated Student: ${adNo} (${histCls}) → ${item.legacyTerm}`);
                    } catch (err) {
                        result.errors++;
                        result.details.push(`Error updating student ${item.data?.adNo || 'unknown'}`);
                    }
                });
            }

            // B. Normalize Subjects Collection (Ensure targetClasses contain both historical & database aliases)
            const subjectsSnap = await getDocs(collection(this.db, this.subjectsCollection));
            const subjectUpdates: Array<{ docRef: any; targetClasses: string[]; id: string }> = [];

            subjectsSnap.docs.forEach(subDoc => {
                const sub = subDoc.data() as SubjectConfig;
                if (!sub || !sub.targetClasses || sub.targetClasses.length === 0) return;

                const expandedSet = new Set<string>();
                let changed = false;

                sub.targetClasses.forEach(tc => {
                    if (!tc) return;
                    expandedSet.add(tc);
                    // Add historical alias if applicable (e.g. FS2 <-> S1)
                    const hist = this.getHistoricalClassName('2025-2026-Odd', tc);
                    const dbCls = this.getDatabaseClassName('2025-2026-Odd', tc);
                    if (hist && hist !== tc && !sub.targetClasses.includes(hist)) {
                        expandedSet.add(hist);
                        changed = true;
                    }
                    if (dbCls && dbCls !== tc && !sub.targetClasses.includes(dbCls)) {
                        expandedSet.add(dbCls);
                        changed = true;
                    }
                });

                if (changed) {
                    subjectUpdates.push({
                        docRef: subDoc.ref,
                        targetClasses: Array.from(expandedSet),
                        id: subDoc.id
                    });
                }
            });

            if (subjectUpdates.length > 0) {
                await this.runBatchedOperation(subjectUpdates, (batch, item) => {
                    batch.update(item.docRef, { targetClasses: item.targetClasses });
                    result.details.push(`Normalized Subject: ${item.id} targetClasses → [${item.targetClasses.join(', ')}]`);
                });
            }

            result.details.unshift(`Migration complete: ${result.migrated} students and ${subjectUpdates.length} subjects updated permanently in Firestore. ${result.skipped} already clean, ${result.errors} errors.`);
        } catch (error) {
            console.error('Fatal error during comprehensive legacy migration:', error);
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
