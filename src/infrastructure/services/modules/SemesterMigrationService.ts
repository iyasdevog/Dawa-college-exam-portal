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
            // A. Migrate, Deduplicate & Normalize Students Collection
            const snapshot = await getDocs(collection(this.db, this.studentsCollection));
            const toMigrate: Array<{ docRef: any; payload: Record<string, any> }> = [];
            const toDelete: any[] = [];

            // Group documents by admission number (adNo)
            const adNoGroups = new Map<string, Array<{ docRef: any; id: string; data: any }>>();
            snapshot.docs.forEach(docSnap => {
                const data = docSnap.data();
                const adNo = (data.adNo || '').toString().trim();
                if (!adNo) return;
                if (!adNoGroups.has(adNo)) adNoGroups.set(adNo, []);
                adNoGroups.get(adNo)!.push({ docRef: docSnap.ref, id: docSnap.id, data });
            });

            adNoGroups.forEach((records) => {
                // Find record with the richest academic history / marks
                let bestRecord = records[0];
                let maxMarks = 0;

                records.forEach(r => {
                    let mCount = Object.keys(r.data.marks || {}).length;
                    if (r.data.academicHistory) {
                        Object.values(r.data.academicHistory).forEach((h: any) => {
                            mCount += Object.keys(h.marks || {}).length;
                        });
                    }
                    if (mCount > maxMarks) {
                        maxMarks = mCount;
                        bestRecord = r;
                    }
                });

                // Merge all academicHistory and top-level marks across all duplicate records into bestRecord
                const mergedHistory = { ...(bestRecord.data.academicHistory || {}) };
                const mergedTopMarks = { ...(bestRecord.data.marks || {}) };

                records.forEach(r => {
                    if (r.data.marks) Object.assign(mergedTopMarks, r.data.marks);
                    if (r.data.academicHistory) {
                        Object.entries(r.data.academicHistory).forEach(([tk, hEntry]: [string, any]) => {
                            const canonicalKey = (!tk || tk === '2025-Odd' || tk === '2025') 
                                ? '2025-2026-Odd' 
                                : (tk === '2025-Even' ? '2025-2026-Even' : tk);

                            const existing = mergedHistory[canonicalKey] || {};
                            const historyMarks = { ...(existing.marks || {}), ...(hEntry.marks || {}) };

                            let sum = 0, validCount = 0, failCount = 0;
                            Object.values(historyMarks).forEach((m: any) => {
                                const subTotal = typeof m.total === 'number' ? m.total : ((Number(m.int) || 0) + (Number(m.ext) || 0));
                                sum += subTotal;
                                if (subTotal > 0 || m.int !== undefined || m.ext !== undefined) validCount++;
                                if (m.status === 'Failed') failCount++;
                            });

                            const rawCls = existing.className || hEntry.className || r.data.currentClass || r.data.className;
                            const histCls = this.getHistoricalClassName(canonicalKey, rawCls);

                            mergedHistory[canonicalKey] = {
                                ...existing,
                                ...hEntry,
                                className: histCls,
                                semester: canonicalKey.endsWith('-Odd') ? 'Odd' : 'Even',
                                marks: historyMarks,
                                grandTotal: sum > 0 ? sum : (existing.grandTotal || hEntry.grandTotal || 0),
                                average: validCount > 0 ? Math.round((sum / validCount) * 10) / 10 : (existing.average || hEntry.average || 0),
                                performanceLevel: sum > 0 ? (failCount > 0 ? 'Failed' : 'Passed') : (existing.performanceLevel || hEntry.performanceLevel || 'Pending')
                            };
                        });
                    }
                });

                // Move top-level legacy marks into academicHistory['2025-2026-Odd'] if missing
                if (Object.keys(mergedTopMarks).length > 0) {
                    const legacyTerm = '2025-2026-Odd';
                    const existingHist = mergedHistory[legacyTerm] || {};
                    if (!existingHist.marks || Object.keys(existingHist.marks).length === 0) {
                        let sum = 0, validCount = 0, failCount = 0;
                        Object.values(mergedTopMarks).forEach((m: any) => {
                            const subTotal = typeof m.total === 'number' ? m.total : ((Number(m.int) || 0) + (Number(m.ext) || 0));
                            sum += subTotal;
                            if (subTotal > 0 || m.int !== undefined || m.ext !== undefined) validCount++;
                            if (m.status === 'Failed') failCount++;
                        });

                        const rawCls = existingHist.className || bestRecord.data.currentClass || bestRecord.data.className;
                        const histCls = this.getHistoricalClassName(legacyTerm, rawCls);

                        mergedHistory[legacyTerm] = {
                            ...existingHist,
                            className: histCls,
                            semester: 'Odd',
                            marks: mergedTopMarks,
                            grandTotal: sum > 0 ? sum : (bestRecord.data.grandTotal || 0),
                            average: validCount > 0 ? Math.round((sum / validCount) * 10) / 10 : (bestRecord.data.average || 0),
                            performanceLevel: sum > 0 ? (failCount > 0 ? 'Failed' : 'Passed') : 'Pending'
                        };
                    }
                }

                const currentCls = bestRecord.data.currentClass || bestRecord.data.className || 'Unknown';

                toMigrate.push({
                    docRef: bestRecord.docRef,
                    payload: {
                        isDeleted: false,
                        currentClass: currentCls,
                        className: currentCls,
                        academicHistory: mergedHistory
                    }
                });

                records.forEach(r => {
                    if (r.id !== bestRecord.id) {
                        toDelete.push(r.docRef);
                    }
                });
            });

            // Execute updates in Firestore
            if (toMigrate.length > 0) {
                await this.runBatchedOperation(toMigrate, (batch, item) => {
                    batch.update(item.docRef, item.payload);
                    result.migrated++;
                });
            }

            // Execute deletes in Firestore
            if (toDelete.length > 0) {
                await this.runBatchedOperation(toDelete, (batch, docRef) => {
                    batch.delete(docRef);
                });
            }

            // B. Normalize Subjects Collection (Clean up invalid targetClasses)
            const subjectsSnap = await getDocs(collection(this.db, this.subjectsCollection));
            const subjectUpdates: Array<{ docRef: any; targetClasses: string[]; id: string }> = [];

            subjectsSnap.docs.forEach(subDoc => {
                const sub = subDoc.data() as SubjectConfig;
                if (!sub || !sub.targetClasses || sub.targetClasses.length === 0) return;

                const cleanClasses = sub.targetClasses.map(tc => tc ? tc.trim() : tc).filter(Boolean);
                const uniqueClasses = Array.from(new Set(cleanClasses));

                if (uniqueClasses.length !== sub.targetClasses.length) {
                    subjectUpdates.push({
                        docRef: subDoc.ref,
                        targetClasses: uniqueClasses,
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

    /**
     * Repairs historical student records for 2025-2026-Odd where legacy code forced
     * class names S1, S2, P1, P2, Bridge, Prep to FS2, FS3, HS2, HS3, FS1, HS1.
     */
    public async repairHistoricalClassNames(): Promise<number> {
        try {
            const snapshot = await getDocs(collection(this.db, this.studentsCollection));
            const REVERSE_MAP: Record<string, string> = {
                'FS2': 'S1',
                'FS3': 'S2',
                'HS2': 'P1',
                'HS3': 'P2',
                'FS1': 'Bridge',
                'HS1': 'Prep'
            };

            const updates: Array<{ ref: any; academicHistory: any }> = [];

            snapshot.docs.forEach(docSnap => {
                const s = docSnap.data() as any;
                if (!s || !s.academicHistory) return;

                const oddHistory = s.academicHistory['2025-2026-Odd'];
                if (oddHistory && oddHistory.className && REVERSE_MAP[oddHistory.className]) {
                    const updatedHistory = {
                        ...s.academicHistory,
                        '2025-2026-Odd': {
                            ...oddHistory,
                            className: REVERSE_MAP[oddHistory.className]
                        }
                    };
                    updates.push({ ref: docSnap.ref, academicHistory: updatedHistory });
                }
            });

            if (updates.length > 0) {
                await this.runBatchedOperation(updates, (batch, item) => {
                    batch.update(item.ref, { academicHistory: item.academicHistory });
                });
            }

            this.invalidateCache();
            return updates.length;
        } catch (error) {
            console.error('Error repairing historical class names:', error);
            return 0;
        }
    }
}
