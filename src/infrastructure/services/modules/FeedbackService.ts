import { collection, doc, getDocs, addDoc, updateDoc, deleteDoc, query, where, setDoc } from 'firebase/firestore';
import { BaseDataService } from './BaseDataService';
import type { StudentFeedback, TeacherAccount } from '../../../domain/entities/types';

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
        const payload = {
            ...feedbackData,
            createdAt: timestamp
        };

        let createdId: string;
        try {
            const docRef = await addDoc(collection(this.db, this.studentFeedbackCollection), payload);
            createdId = docRef.id;
        } catch (error) {
            console.warn('Firestore write failed for student feedback, saving locally:', error);
            createdId = `feedback_${timestamp}_${Math.random().toString(36).substr(2, 6)}`;
        }

        const feedbackWithId: StudentFeedback = { id: createdId, ...payload };
        
        // Sync to local storage & update in-memory cache immediately
        this.saveFeedbackToLocalStorage(feedbackWithId);
        this.invalidateCache();

        return createdId;
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
        const allFeedback = await this.getAllFeedback(semester);
        const search = teacherNameOrId.trim().toLowerCase();
        return allFeedback.filter(f => 
            (f.teacherId && f.teacherId === teacherNameOrId) ||
            (f.teacherName && f.teacherName.trim().toLowerCase() === search)
        );
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
}
