import { collection, doc, getDocs, addDoc, updateDoc, deleteDoc, query, where, setDoc } from 'firebase/firestore';
import { BaseDataService } from './BaseDataService';
import type { StudentFeedback, TeacherAccount, SubjectConfig } from '../../../domain/entities/types';

export class FeedbackService extends BaseDataService {
    protected readonly studentFeedbackCollection = 'studentFeedback';
    protected readonly teacherAccountsCollection = 'teacherAccounts';

    // Local storage keys
    private readonly LOCAL_FEEDBACK_KEY = 'dawa_app_student_feedback_data';
    private readonly LOCAL_TEACHERS_KEY = 'dawa_app_teacher_accounts_data';

    // In-memory caching for ultra-fast response & reduced database read quota
    private cachedFeedbackMap = new Map<string, { timestamp: number; data: StudentFeedback[] }>();
    private cachedTeachers: { timestamp: number; data: TeacherAccount[] } | null = null;
    private readonly FEEDBACK_CACHE_TTL = 300000; // 5 minutes

    public override invalidateCache(): void {
        super.invalidateCache();
        this.cachedFeedbackMap.clear();
        this.cachedTeachers = null;
    }

    // --- Student Feedback ---

    public async submitFeedback(feedbackData: Omit<StudentFeedback, 'id' | 'createdAt'>): Promise<string> {
        const timestamp = Date.now();
        const rawPayload = {
            ...feedbackData,
            createdAt: timestamp
        };
        // Sanitize out undefined properties so Firestore addDoc does not reject payload
        const payload = JSON.parse(JSON.stringify(rawPayload));

        // Write to Firestore – do NOT silently swallow errors (would hide permission issues)
        const docRef = await addDoc(collection(this.db, this.studentFeedbackCollection), payload);
        const createdId = docRef.id;

        const feedbackWithId: StudentFeedback = { id: createdId, ...payload };
        
        // Also cache locally for offline resilience
        this.saveFeedbackToLocalStorage(feedbackWithId);
        this.invalidateCache();

        return createdId;
    }

    /**
     * Re-pushes any feedback that was saved to localStorage but never made it to Firestore.
     * Called by AdminFeedbackManagement on mount to recover stuck submissions.
     */
    public async syncLocalFeedbackToFirestore(): Promise<number> {
        const localItems = this.getFeedbackFromLocalStorage();
        if (localItems.length === 0) return 0;

        // Get current Firestore IDs to avoid duplicates
        let firestoreIds = new Set<string>();
        try {
            const snap = await getDocs(collection(this.db, this.studentFeedbackCollection));
            snap.docs.forEach(d => firestoreIds.add(d.id));
        } catch { return 0; }

        const unsynced = localItems.filter(f => !firestoreIds.has(f.id));
        let synced = 0;

        for (const feedback of unsynced) {
            try {
                const { id, ...payload } = feedback;
                const cleanPayload = JSON.parse(JSON.stringify(payload));
                await setDoc(doc(this.db, this.studentFeedbackCollection, id), cleanPayload);
                synced++;
            } catch (err) {
                console.warn('Failed to sync local feedback to Firestore:', (err as Error).message);
            }
        }

        if (synced > 0) this.invalidateCache();
        return synced;
    }

    public async getAllFeedback(semester?: string): Promise<StudentFeedback[]> {
        const cacheKey = semester || 'All';
        const cached = this.cachedFeedbackMap.get(cacheKey);
        if (cached && (Date.now() - cached.timestamp < this.FEEDBACK_CACHE_TTL)) {
            return cached.data;
        }

        let items: StudentFeedback[] = [];
        try {
            let snapshot;
            if (semester && semester !== 'All') {
                const q = query(
                    collection(this.db, this.studentFeedbackCollection),
                    where('semester', '==', semester)
                );
                snapshot = await getDocs(q);
            } else {
                snapshot = await getDocs(collection(this.db, this.studentFeedbackCollection));
            }

            items = snapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as any) } as StudentFeedback));
        } catch (error) {
            console.warn('Firestore read failed for student feedback, reading from local cache:', error);
            items = this.getFeedbackFromLocalStorage();
            if (semester && semester !== 'All') {
                items = items.filter(f => f.semester === semester);
            }
        }

        // Merge local unsynced entries
        const localItems = this.getFeedbackFromLocalStorage();
        const existingIds = new Set(items.map(i => i.id));
        for (const loc of localItems) {
            if (!existingIds.has(loc.id)) {
                if (!semester || semester === 'All' || loc.semester === semester) {
                    items.push(loc);
                }
            }
        }

        const sorted = items.sort((a, b) => b.createdAt - a.createdAt);
        this.cachedFeedbackMap.set(cacheKey, { timestamp: Date.now(), data: sorted });
        return sorted;
    }

    public async getTeacherFeedback(teacherNameOrId: string, semester?: string): Promise<StudentFeedback[]> {
        if (!teacherNameOrId || !teacherNameOrId.trim()) {
            return [];
        }
        const search = teacherNameOrId.trim().toLowerCase();
        if (search === 'all' || search === 'faculty member' || search === 'faculty') {
            // Do not leak feedback of all teachers for generic login
            return [];
        }
        const allFeedback = await this.getAllFeedback(semester);
        return allFeedback.filter(f => 
            (f.teacherId && f.teacherId === teacherNameOrId) ||
            (f.teacherName && f.teacherName.trim().toLowerCase() === search)
        );
    }

    public async deleteFeedback(id: string): Promise<void> {
        try {
            const docRef = doc(this.db, this.studentFeedbackCollection, id);
            await deleteDoc(docRef);
        } catch (e) {
            console.warn('Firestore delete error for feedback:', e);
        }
        this.deleteFeedbackFromLocalStorage(id);
        this.invalidateCache();
    }

    public async getClassFeedbackCounts(semester?: string): Promise<Record<string, number>> {
        const feedbackList = await this.getAllFeedback(semester);
        const counts: Record<string, number> = {};
        for (const f of feedbackList) {
            const cls = f.className || 'General';
            counts[cls] = (counts[cls] || 0) + 1;
        }
        return counts;
    }

    // --- Teacher Accounts ---

    public async getAllTeacherAccounts(): Promise<TeacherAccount[]> {
        if (this.cachedTeachers && (Date.now() - this.cachedTeachers.timestamp < this.FEEDBACK_CACHE_TTL)) {
            return this.cachedTeachers.data;
        }

        let teachers: TeacherAccount[] = [];
        try {
            const snapshot = await getDocs(collection(this.db, this.teacherAccountsCollection));
            teachers = snapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as any) } as TeacherAccount));
        } catch (error) {
            console.warn('Firestore read failed for teacher accounts, reading local:', error);
            teachers = this.getTeachersFromLocalStorage();
        }

        // Merge local storage items
        const localTeachers = this.getTeachersFromLocalStorage();
        const existingIds = new Set(teachers.map(t => t.id));
        for (const lt of localTeachers) {
            if (!existingIds.has(lt.id)) {
                teachers.push(lt);
            }
        }

        const sorted = teachers.sort((a, b) => a.name.localeCompare(b.name));
        this.cachedTeachers = { timestamp: Date.now(), data: sorted };
        return sorted;
    }

    public async saveTeacherAccount(account: Omit<TeacherAccount, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }): Promise<string> {
        const now = Date.now();
        let resultId: string;

        if (account.id) {
            const updates = {
                ...account,
                updatedAt: now
            };
            try {
                const docRef = doc(this.db, this.teacherAccountsCollection, account.id);
                await updateDoc(docRef, updates);
            } catch (e) {
                console.warn('Firestore update failed for teacher account, saving locally:', e);
            }
            this.updateTeacherInLocalStorage(account.id, updates as Partial<TeacherAccount>);
            resultId = account.id;
        } else {
            const newId = `teacher_${now}_${Math.random().toString(36).substr(2, 5)}`;
            const payload: TeacherAccount = {
                id: newId,
                name: account.name,
                username: account.username,
                mobileNumber: account.mobileNumber,
                password: account.password,
                assignedClasses: account.assignedClasses || [],
                isActive: account.isActive ?? true,
                createdAt: now,
                updatedAt: now
            };
            try {
                const docRef = doc(this.db, this.teacherAccountsCollection, newId);
                await setDoc(docRef, payload);
            } catch (e) {
                console.warn('Firestore set failed for teacher account, saving locally:', e);
            }
            this.saveTeacherToLocalStorage(payload);
            resultId = newId;
        }

        this.cachedTeachers = null;
        return resultId;
    }

    public async updateTeacherAccount(id: string, updates: Partial<TeacherAccount>): Promise<void> {
        const payload = { ...updates, updatedAt: Date.now() };
        try {
            const docRef = doc(this.db, this.teacherAccountsCollection, id);
            await updateDoc(docRef, payload);
        } catch (e) {
            console.warn('Firestore update error for teacher, local sync:', e);
        }
        this.updateTeacherInLocalStorage(id, payload);
        this.cachedTeachers = null;
    }

    public async deleteTeacherAccount(id: string): Promise<void> {
        try {
            const docRef = doc(this.db, this.teacherAccountsCollection, id);
            await deleteDoc(docRef);
        } catch (e) {
            console.warn('Firestore delete error for teacher:', e);
        }
        this.deleteTeacherFromLocalStorage(id);
        this.cachedTeachers = null;
    }

    public async authenticateTeacher(loginInput: string, passwordInput: string): Promise<TeacherAccount | null> {
        const teachers = await this.getAllTeacherAccounts();
        const cleanInput = loginInput.trim().toLowerCase();
        const cleanPass = passwordInput.trim();

        const match = teachers.find(t => 
            t.isActive &&
            (t.username.trim().toLowerCase() === cleanInput || t.mobileNumber.trim().replace(/\D/g, '') === cleanInput.replace(/\D/g, '')) &&
            t.password.trim() === cleanPass
        );

        return match || null;
    }

    public async provisionMissingTeacherAccounts(subjects: SubjectConfig[]): Promise<{ provisioned: number; teacherNames: string[] }> {
        const allFacultyNames = new Set<string>();
        subjects.forEach(s => {
            const name = (s.facultyName || '').trim();
            if (name && name.length > 1) {
                allFacultyNames.add(name);
            }
        });

        const existingTeachers = await this.getAllTeacherAccounts();
        const existingNames = new Set(existingTeachers.map(t => t.name.trim().toLowerCase()));
        const usedUsernames = new Set(existingTeachers.map(t => t.username.trim().toLowerCase()));

        const DEFAULT_PASSWORD = 'dawa@2025';
        const DEFAULT_MOBILE = '0000000000';
        let count = 0;
        const provisionedNames: string[] = [];

        for (const facultyName of Array.from(allFacultyNames)) {
            if (!existingNames.has(facultyName.toLowerCase())) {
                let baseUser = facultyName.trim().toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, '_');
                if (!baseUser) baseUser = 'teacher';
                let username = baseUser;
                let counter = 2;
                while (usedUsernames.has(username)) {
                    username = `${baseUser}_${counter++}`;
                }
                usedUsernames.add(username);

                await this.saveTeacherAccount({
                    name: facultyName,
                    username,
                    mobileNumber: DEFAULT_MOBILE,
                    password: DEFAULT_PASSWORD,
                    assignedClasses: [],
                    isActive: true
                });
                count++;
                provisionedNames.push(facultyName);
            }
        }

        return { provisioned: count, teacherNames: provisionedNames };
    }

    public async resetTeacherPassword(id: string, newPassword = 'dawa@2025'): Promise<void> {
        await this.updateTeacherAccount(id, {
            password: newPassword,
            isDefaultCredentials: true
        });
    }

    public async purgeInactiveTeachers(): Promise<number> {
        const teachers = await this.getAllTeacherAccounts();
        const inactive = teachers.filter(t => !t.isActive);
        for (const t of inactive) {
            await this.deleteTeacherAccount(t.id);
        }
        return inactive.length;
    }

    public async purgeUnlinkedTeachers(subjects: SubjectConfig[]): Promise<{ deleted: number; names: string[] }> {
        const activeFacultyNames = new Set<string>();
        subjects.forEach(s => {
            if (s.facultyName && s.facultyName.trim()) {
                activeFacultyNames.add(s.facultyName.trim().toLowerCase());
            }
        });

        const teachers = await this.getAllTeacherAccounts();
        const unlinked = teachers.filter(t => !activeFacultyNames.has(t.name.trim().toLowerCase()));
        const deletedNames: string[] = [];

        for (const t of unlinked) {
            await this.deleteTeacherAccount(t.id);
            deletedNames.push(t.name);
        }

        return { deleted: unlinked.length, names: deletedNames };
    }

    // --- Helper Local Storage Sync Methods ---

    private getFeedbackFromLocalStorage(): StudentFeedback[] {
        try {
            if (typeof window === 'undefined') return [];
            const raw = localStorage.getItem(this.LOCAL_FEEDBACK_KEY);
            return raw ? JSON.parse(raw) : [];
        } catch (e) {
            return [];
        }
    }

    private saveFeedbackToLocalStorage(feedback: StudentFeedback): void {
        try {
            if (typeof window === 'undefined') return;
            const items = this.getFeedbackFromLocalStorage();
            items.unshift(feedback);
            localStorage.setItem(this.LOCAL_FEEDBACK_KEY, JSON.stringify(items.slice(0, 500)));
        } catch (e) {
            // Ignore quota errors
        }
    }

    private getTeachersFromLocalStorage(): TeacherAccount[] {
        try {
            if (typeof window === 'undefined') return [];
            const raw = localStorage.getItem(this.LOCAL_TEACHERS_KEY);
            return raw ? JSON.parse(raw) : [];
        } catch (e) {
            return [];
        }
    }

    private saveTeacherToLocalStorage(teacher: TeacherAccount): void {
        try {
            if (typeof window === 'undefined') return;
            const teachers = this.getTeachersFromLocalStorage();
            const idx = teachers.findIndex(t => t.id === teacher.id);
            if (idx >= 0) {
                teachers[idx] = teacher;
            } else {
                teachers.push(teacher);
            }
            localStorage.setItem(this.LOCAL_TEACHERS_KEY, JSON.stringify(teachers));
        } catch (e) {
            // Ignore
        }
    }

    private updateTeacherInLocalStorage(id: string, updates: Partial<TeacherAccount>): void {
        try {
            if (typeof window === 'undefined') return;
            const teachers = this.getTeachersFromLocalStorage();
            const idx = teachers.findIndex(t => t.id === id);
            if (idx >= 0) {
                teachers[idx] = { ...teachers[idx], ...updates, updatedAt: Date.now() };
                localStorage.setItem(this.LOCAL_TEACHERS_KEY, JSON.stringify(teachers));
            }
        } catch (e) {
            // Ignore
        }
    }

    private deleteTeacherFromLocalStorage(id: string): void {
        try {
            if (typeof window === 'undefined') return;
            const teachers = this.getTeachersFromLocalStorage().filter(t => t.id !== id);
            localStorage.setItem(this.LOCAL_TEACHERS_KEY, JSON.stringify(teachers));
        } catch (e) {
            // Ignore
        }
    }

    private deleteFeedbackFromLocalStorage(id: string): void {
        try {
            if (typeof window === 'undefined') return;
            const items = this.getFeedbackFromLocalStorage().filter(f => f.id !== id);
            localStorage.setItem(this.LOCAL_FEEDBACK_KEY, JSON.stringify(items));
        } catch (e) {
            // Ignore
        }
    }
}
