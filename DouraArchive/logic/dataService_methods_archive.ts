// Archived Doura methods from DataService.ts

// Collection Names
private douraCollection = 'doura_submissions';
private douraTasksCollection = 'doura_tasks';
private khatamCollection = 'khatam_progress';

// Cache Variables
private douraCache: DouraSubmission[] | null = null;
private douraCacheTimestamp: number = 0;
private readonly DOURA_CACHE_DURATION = 10000; // 10 seconds for doura

// Cache Management Methods
private isDouraCacheValid(): boolean {
    return this.douraCacheTimestamp > 0 && (Date.now() - this.douraCacheTimestamp) < this.DOURA_CACHE_DURATION;
}

private invalidateDouraCache(): void {
    this.douraCache = null;
    this.douraCacheTimestamp = 0;
}

private updateDouraCache(submissions: DouraSubmission[]): void {
    this.douraCache = submissions;
    this.douraCacheTimestamp = Date.now();
}

// Doura Status Operations
async submitDouraStatus(submission: Omit<DouraSubmission, 'id'>): Promise < string > {
    try {
        const isSelf = submission.type === 'Self';
        const status = isSelf ? 'Approved' : 'Pending';
        const approvedAt = isSelf ? new Date().toISOString() : undefined;

        const sanitizedSubmission = this.sanitizeObject({
            ...submission,
            status,
            approvedAt
        });

        const docRef = await addDoc(collection(this.db, this.douraCollection), {
            ...sanitizedSubmission,
            submittedAt: new Date().toISOString()
        });

        if(isSelf) {
            const juzRange = [];
            for (let i = submission.juzStart; i <= submission.juzEnd; i++) {
                juzRange.push(i);
            }
            await this.updateKhatamProgress(submission.studentAdNo, juzRange);
        }

        this.invalidateDouraCache();
        return docRef.id;
    } catch(error) {
        console.error('Error submitting Doura status:', error);
        throw error;
    }
}

async getDouraSubmissionsByAdNo(adNo: string): Promise < DouraSubmission[] > {
    try {
        const q = query(
            collection(this.db, this.douraCollection),
            where('studentAdNo', '==', adNo)
        );
        const querySnapshot = await getDocs(q);
        return querySnapshot.docs
            .map(doc => ({
                id: doc.id,
                ...doc.data()
            } as DouraSubmission))
            .sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());
    } catch(error) {
        console.error('Error fetching student Doura status:', error);
        return [];
    }
}

async getAllDouraSubmissions(className ?: string, status ?: 'Pending' | 'Approved' | 'Rejected', academicTerm ?: string): Promise < DouraSubmission[] > {
    if(this.isDouraCacheValid() && this.douraCache) {
    let submissions = [...this.douraCache];
    if (className && className !== 'all') {
        submissions = submissions.filter(s => s.className === className);
    }
    if (status && (status as string) !== 'all') {
        submissions = submissions.filter(s => s.status === status);
    }
    if (academicTerm && academicTerm !== 'all') {
        submissions = submissions.filter(s => s.academicTerm === academicTerm);
    }
    return submissions;
}

try {
    const q = query(collection(this.db, this.douraCollection), orderBy('submittedAt', 'desc'));
    const querySnapshot = await getDocs(q);

    const submissions = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
    } as DouraSubmission));

    this.updateDouraCache(submissions);

    let filtered = [...submissions];
    if (className && className !== 'all') {
        filtered = filtered.filter(s => s.className === className);
    }
    if (status && (status as string) !== 'all') {
        filtered = filtered.filter(s => s.status === status);
    }
    if (academicTerm && academicTerm !== 'all') {
        filtered = filtered.filter(s => s.academicTerm === academicTerm);
    }

    return filtered;
} catch (error) {
    console.error('Error fetching Doura submissions:', error);
    return [];
}
}

async deleteDouraSubmission(id: string): Promise < void> {
    try {
        await deleteDoc(doc(this.db, this.douraCollection, id));
    this.invalidateDouraCache();
} catch (error) {
    console.error('Error deleting Doura submission:', error);
    throw error;
}
}

async deleteAllStudentDouraSubmissions(adNo: string): Promise < number > {
    try {
        const q = query(collection(this.db, this.douraCollection), where('studentAdNo', '==', adNo));
        const snapshot = await getDocs(q);
        const batch = writeBatch(this.db);
        let count = 0;

        snapshot.docs.forEach((doc) => {
            batch.delete(doc.ref);
            count++;
        });

        await batch.commit();

        await setDoc(doc(this.db, this.khatamCollection, adNo), {
    studentAdNo: adNo,
        currentKhatamJuz: [],
            khatamCount: 0,
                lastUpdated: new Date().toISOString()
});

this.invalidateDouraCache();
return count;
    } catch (error) {
    console.error('Error deleting all student Doura submissions:', error);
    throw error;
}
}

async updateDouraSubmission(id: string, updates: Partial<DouraSubmission>): Promise < void> {
    try {
        const docRef = doc(this.db, this.douraCollection, id);

        if(updates.status === 'Approved') {
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
        const submission = docSnap.data() as DouraSubmission;
        const juzRange = [];
        for (let i = submission.juzStart; i <= submission.juzEnd; i++) {
            juzRange.push(i);
        }
        await this.updateKhatamProgress(submission.studentAdNo, juzRange);
    }
}

const sanitizedUpdates = this.sanitizeObject(updates);

await updateDoc(docRef, {
    ...sanitizedUpdates,
    approvedAt: updates.status === 'Approved' ? new Date().toISOString() : null
});
this.invalidateDouraCache();
    } catch (error) {
    console.error('Error updating Doura submission:', error);
    throw error;
}
}

async getTopReciters(className: string, academicTerm ?: string): Promise < { name: string; juzCount: number }[] > {
    try {
        const submissions = await this.getAllDouraSubmissions(className, 'Approved', academicTerm);

        const aggregation: Record<string, number> = { };
submissions.forEach(sub => {
    const count = Math.max(0, sub.juzEnd - sub.juzStart + 1);
    aggregation[sub.studentName] = (aggregation[sub.studentName] || 0) + count;
});

return Object.entries(aggregation)
    .map(([name, juzCount]) => ({ name, juzCount }))
    .sort((a, b) => b.juzCount - a.juzCount)
    .slice(0, 10);
    } catch (error) {
    console.error('Error fetching top reciters:', error);
    return [];
}
}

// Doura Task methods
async getDouraTasks(className ?: string, studentAdNo ?: string, academicTerm ?: string): Promise < DouraTask[] > {
    try {
        const q = query(collection(this.db, this.douraTasksCollection), orderBy('createdAt', 'desc'));
        const querySnapshot = await getDocs(q);
        let tasks = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as DouraTask));

        if(className && className !== 'all') {
    tasks = tasks.filter(t => t.targetClass === className || t.targetClass === 'all');
}

if (studentAdNo) {
    tasks = tasks.filter(t => !t.targetStudentAdNo || t.targetStudentAdNo === studentAdNo);
}

if (academicTerm && academicTerm !== 'all') {
    tasks = tasks.filter(t => t.academicTerm === academicTerm);
}

return tasks;
    } catch (error) {
    console.error('Error fetching Doura tasks:', error);
    return [];
}
}

async createDouraTask(task: Omit<DouraTask, 'id'>): Promise < string > {
    try {
        const sanitizedTask = this.sanitizeObject(task);
        const docRef = await addDoc(collection(this.db, this.douraTasksCollection), sanitizedTask);
        return docRef.id;
    } catch(error) {
        console.error('Error creating Doura task:', error);
        throw error;
    }
}

async updateDouraTask(id: string, updates: Partial<DouraTask>): Promise < void> {
    try {
        const sanitizedUpdates = this.sanitizeObject(updates);
        await updateDoc(doc(this.db, this.douraTasksCollection, id), sanitizedUpdates);
} catch (error) {
    console.error('Error updating Doura task:', error);
    throw error;
}
}

async deleteDouraTask(id: string): Promise < void> {
    try {
        await deleteDoc(doc(this.db, this.douraTasksCollection, id));
} catch (error) {
    console.error('Error deleting Doura task:', error);
    throw error;
}
}

// Khatam Progress methods
async getKhatamProgress(adNo: string): Promise < KhatamProgress | null > {
    try {
        const q = query(collection(this.db, this.khatamCollection), where('studentAdNo', '==', adNo));
        const querySnapshot = await getDocs(q);
        if(querySnapshot.empty) return null;
        const doc = querySnapshot.docs[0];
        return { id: doc.id, ...doc.data() } as KhatamProgress;
    } catch(error) {
        console.error('Error fetching Khatam progress:', error);
        return null;
    }
}

async updateKhatamProgress(adNo: string, completedJuz: number[]): Promise < void> {
    try {
        const existing = await this.getKhatamProgress(adNo);
        if(existing) {
            const newJuz = Array.from(new Set([...existing.currentKhatamJuz, ...completedJuz]));
            let khatamCount = existing.khatamCount;
            let finalJuz = newJuz;

            if (newJuz.length >= 30) {
                khatamCount += 1;
                finalJuz = [];
            }

            await updateDoc(doc(this.db, this.khatamCollection, existing.id), {
                currentKhatamJuz: finalJuz,
                khatamCount,
                lastCompletedDate: newJuz.length >= 30 ? new Date().toISOString() : existing.lastCompletedDate
            });
        } else {
            let khatamCount = 0;
            let finalJuz = completedJuz;
            if(completedJuz.length >= 30) {
    khatamCount = 1;
    finalJuz = [];
}
await addDoc(collection(this.db, this.khatamCollection), {
    studentAdNo: adNo,
    currentKhatamJuz: finalJuz,
    khatamCount,
    lastCompletedDate: khatamCount > 0 ? new Date().toISOString() : null
});
        }
    } catch (error) {
    console.error('Error updating Khatam progress:', error);
    throw error;
}
}
