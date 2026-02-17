import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { StudentRecord, SubjectConfig, DouraSubmission, DouraTask, KhatamProgress } from '../../domain/entities/types';
import { dataService } from '../../infrastructure/services/dataService';
import { useMobile } from '../hooks/useMobile';

interface PublicDouraTrackerProps {
    result: StudentRecord;
    subjects: SubjectConfig[];
    searchClass: string;
}

// Helper to determine Juz from Page number
const getJuzFromPage = (page: number) => {
    if (page <= 1) return 1;
    if (page >= 582) return 30;
    return Math.floor((page - 2) / 20) + 1;
};

const PublicDouraTracker: React.FC<PublicDouraTrackerProps> = ({ result, subjects, searchClass }) => {
    // Doura Status State
    const [douraSubmissions, setDouraSubmissions] = useState<DouraSubmission[]>([]);
    const [douraTasks, setDouraTasks] = useState<DouraTask[]>([]);
    const [khatamProgress, setKhatamProgress] = useState<KhatamProgress | null>(null);
    const [recitationDate, setRecitationDate] = useState<string>(new Date().toISOString().split('T')[0]);
    const [juzStart, setJuzStart] = useState<number>(1);
    const [juzEnd, setJuzEnd] = useState<number>(1);
    const [pageStart, setPageStart] = useState<number | ''>(1);
    const [pageEnd, setPageEnd] = useState<number | ''>(20);
    const [ayaStart, setAyaStart] = useState<number | ''>(1);
    const [ayaEnd, setAyaEnd] = useState<number | ''>(1);
    const [isSubmittingDoura, setIsSubmittingDoura] = useState(false);
    const [isLoadingDoura, setIsLoadingDoura] = useState(false);
    const [selectedTeacher, setSelectedTeacher] = useState<string>('');
    const [submissionType, setSubmissionType] = useState<'Task' | 'Self'>('Self');
    const [selectedTaskId, setSelectedTaskId] = useState<string | undefined>(undefined);
    const [douraSubTab, setDouraSubTab] = useState<'overview' | 'tasks' | 'submit' | 'history' | 'rankings'>('overview');
    const [leaderboardScope, setLeaderboardScope] = useState<'class' | 'college'>('class');
    const [leaderboardType, setLeaderboardType] = useState<'task' | 'self'>('task');
    const [collegeTaskReciters, setCollegeTaskReciters] = useState<{ name: string; juzCount: number }[]>([]);
    const [collegeSelfReciters, setCollegeSelfReciters] = useState<{ name: string; juzCount: number }[]>([]);
    const [classTaskReciters, setClassTaskReciters] = useState<{ name: string; juzCount: number }[]>([]);
    const [classSelfReciters, setClassSelfReciters] = useState<{ name: string; juzCount: number }[]>([]);

    const { isMobile } = useMobile();

    // Extract unique faculty names from Doura-related subjects
    const douraTeachers = useMemo(() => {
        const teachers = subjects
            .filter(s => s.name.toLowerCase().includes('doura') && s.facultyName)
            .map(s => s.facultyName as string);
        return Array.from(new Set(teachers)).sort();
    }, [subjects]);

    // Set default teacher if list changes
    useEffect(() => {
        if (douraTeachers.length > 0 && !selectedTeacher) {
            setSelectedTeacher(douraTeachers[0]);
        }
    }, [douraTeachers]);

    const loadDouraDashboardData = useCallback(async () => {
        if (!result) return;
        try {
            setIsLoadingDoura(true);
            const [history, tasks, progress] = await Promise.all([
                dataService.getDouraSubmissionsByAdNo(result.adNo),
                dataService.getDouraTasks(result.className, result.adNo),
                dataService.getKhatamProgress(result.adNo)
            ]);
            setDouraSubmissions(history);
            setDouraTasks(tasks.filter(t => t.status === 'Active'));
            setKhatamProgress(progress);

            // Smart Pre-fill Check
            // Sort history to ensure we get the latest
            const sortedHistory = [...history].sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());
            const lastApproved = sortedHistory.find(s => s.status === 'Approved');

            if (lastApproved) {
                // Check for Khatam Completion (Juz 30 reached and finished)
                // Assuming standard 604 pages, if pageEnd > 600 and juzEnd == 30, it's a Khatam
                if (lastApproved.juzEnd === 30 && (lastApproved.pageEnd || 0) >= 600) {
                    // Reset for new Khatam
                    setJuzStart(1);
                    setJuzEnd(1);
                    setPageStart(1);
                    setPageEnd(10);
                    setAyaStart(1);
                    setAyaEnd(1);
                } else {
                    // Normal Progression: Start = Previous End + 1
                    const prevPageEnd = lastApproved.pageEnd || 0;
                    const nextPageStart = prevPageEnd + 1;
                    const nextJuzStart = getJuzFromPage(nextPageStart);

                    setJuzStart(nextJuzStart);
                    setJuzEnd(nextJuzStart);

                    setPageStart(nextPageStart);
                    setPageEnd(nextPageStart + 10);

                    const prevAyaEnd = lastApproved.ayaEnd || 0;
                    setAyaStart(prevAyaEnd + 1);
                    setAyaEnd(prevAyaEnd + 10);
                }
            } else if (progress && progress.currentKhatamJuz && progress.currentKhatamJuz.length > 0) {
                // Fallback: If no history but Khatam Progress exists (e.g. legacy data)
                // Find the maximum completed Juz
                const maxJuz = Math.max(...progress.currentKhatamJuz);

                if (maxJuz === 30) {
                    // Completed 30 Juz, start fresh
                    setJuzStart(1);
                    setJuzEnd(1);
                    setPageStart(1);
                    setPageEnd(10);
                    setAyaStart(1);
                    setAyaEnd(1);
                } else {
                    // Start next Juz
                    const nextJuz = maxJuz + 1;
                    setJuzStart(nextJuz);
                    setJuzEnd(nextJuz);

                    // Estimate page start for next Juz
                    // Assuming 20 pages per Juz
                    const startPage = (nextJuz - 1) * 20 + 2;
                    setPageStart(startPage);
                    setPageEnd(startPage + 9);

                    setAyaStart(1);
                    setAyaEnd(1);
                }
            } else {
                // Reset to defaults for new starters
                setJuzStart(1);
                setJuzEnd(1);
                setPageStart(1);
                setPageEnd(10);
                setAyaStart(1);
                setAyaEnd(1);
            }
        } catch (error) {
            console.error('Error loading Doura dashboard:', error);
        } finally {
            setIsLoadingDoura(false);
        }
    }, [result]);

    const loadTopReciters = useCallback(async () => {
        try {
            // Fetch ALL approved submissions for college-wide leaderboard
            const allSubmissions = await dataService.getAllDouraSubmissions('all', 'Approved');

            // 1. College - Task Champions
            const colTaskAgg: Record<string, number> = {};
            allSubmissions.filter(s => s.type === 'Task').forEach(sub => {
                const count = Math.max(0, sub.juzEnd - sub.juzStart + 1);
                colTaskAgg[sub.studentName] = (colTaskAgg[sub.studentName] || 0) + count;
            });
            setCollegeTaskReciters(Object.entries(colTaskAgg)
                .map(([name, juzCount]) => ({ name, juzCount }))
                .sort((a, b) => b.juzCount - a.juzCount).slice(0, 10));

            // 2. College - Khatam Pace-Setters
            const colSelfAgg: Record<string, number> = {};
            allSubmissions.filter(s => s.type !== 'Task').forEach(sub => {
                const count = Math.max(0, sub.juzEnd - sub.juzStart + 1);
                colSelfAgg[sub.studentName] = (colSelfAgg[sub.studentName] || 0) + count;
            });
            setCollegeSelfReciters(Object.entries(colSelfAgg)
                .map(([name, juzCount]) => ({ name, juzCount }))
                .sort((a, b) => b.juzCount - a.juzCount).slice(0, 10));

            // 3. Class - Task Champions
            if (searchClass && searchClass !== 'all') {
                const clsTaskAgg: Record<string, number> = {};
                allSubmissions.filter(s => s.className === searchClass && s.type === 'Task').forEach(sub => {
                    const count = Math.max(0, sub.juzEnd - sub.juzStart + 1);
                    clsTaskAgg[sub.studentName] = (clsTaskAgg[sub.studentName] || 0) + count;
                });
                setClassTaskReciters(Object.entries(clsTaskAgg)
                    .map(([name, juzCount]) => ({ name, juzCount }))
                    .sort((a, b) => b.juzCount - a.juzCount).slice(0, 10));

                // 4. Class - Khatam Pace-Setters
                const clsSelfAgg: Record<string, number> = {};
                allSubmissions.filter(s => s.className === searchClass && s.type !== 'Task').forEach(sub => {
                    const count = Math.max(0, sub.juzEnd - sub.juzStart + 1);
                    clsSelfAgg[sub.studentName] = (clsSelfAgg[sub.studentName] || 0) + count;
                });
                setClassSelfReciters(Object.entries(clsSelfAgg)
                    .map(([name, juzCount]) => ({ name, juzCount }))
                    .sort((a, b) => b.juzCount - a.juzCount).slice(0, 10));
            }

        } catch (error) {
            console.error('Error loading leaderboards:', error);
        }
    }, [searchClass]);

    useEffect(() => {
        loadDouraDashboardData();
        loadTopReciters();
    }, [loadDouraDashboardData, loadTopReciters]);

    const handleDouraSubmit = useCallback(async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (!result) return;

        try {
            setIsSubmittingDoura(true);

            const submissionData: Omit<DouraSubmission, 'id'> = {
                studentAdNo: result.adNo,
                studentName: result.name,
                className: result.className,
                juzStart,
                juzEnd,
                pageStart: pageStart === '' ? 0 : Number(pageStart),
                pageEnd: pageEnd === '' ? 0 : Number(pageEnd),
                ayaStart: ayaStart === '' ? 0 : Number(ayaStart),
                ayaEnd: ayaEnd === '' ? 0 : Number(ayaEnd),
                recitationDate,
                teacherName: selectedTeacher || 'Self',
                status: submissionType === 'Self' ? 'Approved' : 'Pending',
                submittedAt: new Date().toISOString(),
                type: submissionType,
                taskId: selectedTaskId
            };

            await dataService.submitDouraStatus(submissionData);

            // Refresh dashboard
            await loadDouraDashboardData();
            await loadTopReciters();

            alert(submissionType === 'Self' ? 'Progress recorded successfully!' : 'Submission successful! Waiting for teacher approval.');
            setDouraSubTab('overview');

            // Reset task selection if it was a task
            if (submissionType === 'Task') {
                setSubmissionType('Self');
                setSelectedTaskId(undefined);
            }
        } catch (error) {
            console.error('Submission error:', error);
            alert('Failed to submit. Please try again.');
        } finally {
            setIsSubmittingDoura(false);
        }
    }, [result, juzStart, juzEnd, pageStart, pageEnd, ayaStart, ayaEnd, recitationDate, selectedTeacher, submissionType, selectedTaskId, loadDouraDashboardData, loadTopReciters]);

    const handleTaskComplete = useCallback(async (task: DouraTask) => {
        if (!result) return;
        setSubmissionType('Task');
        setSelectedTaskId(task.id);
        setJuzStart(task.juzStart);
        setJuzEnd(task.juzEnd);
        setPageStart(task.pageStart);
        setPageEnd(task.pageEnd);

        if (confirm(`Do you want to submit completion for Task: ${task.title}?`)) {
            try {
                setIsSubmittingDoura(true);
                await dataService.submitDouraStatus({
                    studentAdNo: result.adNo,
                    studentName: result.name,
                    className: result.className,
                    juzStart: task.juzStart,
                    juzEnd: task.juzEnd,
                    pageStart: task.pageStart,
                    pageEnd: task.pageEnd,
                    ayaStart: 1, // Default for tasks
                    ayaEnd: 1,   // Default for tasks
                    recitationDate: new Date().toISOString().split('T')[0],
                    teacherName: selectedTeacher || 'Self',
                    status: 'Pending',
                    submittedAt: new Date().toISOString(),
                    type: 'Task',
                    taskId: task.id
                });
                await loadDouraDashboardData();
                await loadTopReciters();
                alert('Task completion submitted for approval!');
            } catch (error) {
                console.error(error);
                alert('Failed to submit task completion.');
            } finally {
                setIsSubmittingDoura(false);
            }
        }
    }, [result, selectedTeacher, loadDouraDashboardData, loadTopReciters]);

    // Helper to get standard page range for a Juz (15-line Madinah Mushaf)
    const getJuzPageRange = (juz: number) => {
        if (juz <= 0) return { start: 0, end: 0 };
        if (juz === 30) return { start: 582, end: 604 };
        const start = (juz - 1) * 20 + 2;
        const end = juz * 20 + 1;
        return { start, end };
    };



    if (isLoadingDoura) {
        return (
            <div className="flex items-center justify-center p-12">
                <div className="text-center">
                    <div className="loader-ring mb-4"></div>
                    <p className="text-slate-600 font-bold">Loading your Doura progress...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Dashboard Sub-Tabs */}
            <div className="flex overflow-x-auto pb-2 scrollbar-hide gap-3 no-scrollbar print:hidden">
                {[
                    { id: 'overview', label: 'Overview', icon: 'fa-table-cells' },
                    { id: 'tasks', label: 'My Tasks', icon: 'fa-thumbtack', count: douraTasks.length },
                    { id: 'submit', label: 'New Entry', icon: 'fa-plus' },
                    { id: 'history', label: 'History', icon: 'fa-clock-rotate-left' },
                    { id: 'rankings', label: 'Leaderboard', icon: 'fa-crown' }
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setDouraSubTab(tab.id as any)}
                        className={`flex-shrink-0 px-5 py-3 rounded-2xl font-bold text-sm transition-all flex items-center gap-2 border-2 ${douraSubTab === tab.id
                            ? 'bg-emerald-600 border-emerald-500 text-white shadow-lg shadow-emerald-500/20'
                            : 'bg-white/5 border-white/10 text-slate-400 hover:text-white hover:bg-white/10'
                            }`}
                    >
                        <i className={`fa-solid ${tab.icon}`}></i>
                        {tab.label}
                        {tab.count !== undefined && tab.count > 0 && (
                            <span className="bg-white/20 text-white px-1.5 py-0.5 rounded-md text-[10px] ml-1">
                                {tab.count}
                            </span>
                        )}
                    </button>
                ))}
            </div>

            {/* Content for Overview, Tasks, Submit, History, Rankings */}
            {douraSubTab === 'overview' && (
                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    {/* Doura Header Stats */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {/* Khatham Counter Card */}
                        <div className="bg-gradient-to-br from-emerald-600 to-emerald-700 rounded-3xl p-8 shadow-xl shadow-emerald-500/20 relative overflow-hidden group">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 transition-transform group-hover:scale-110"></div>
                            <div className="relative z-10">
                                <p className="text-emerald-100 font-black uppercase tracking-widest text-xs mb-4 flex items-center gap-2">
                                    <i className="fa-solid fa-trophy"></i> Khatam Progress
                                </p>
                                <div className="flex items-center gap-4">
                                    <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-md">
                                        <span className="text-4xl font-black text-white">
                                            {khatamProgress?.khatamCount || 0}
                                        </span>
                                    </div>
                                    <div>
                                        <p className="text-2xl font-black text-white">Quran Hatm's</p>
                                        <p className="text-emerald-100/60 font-bold text-sm">Total 30 Juz Cycles</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Current Cycle Progress Card */}
                        <div className="bg-white/10 backdrop-blur-md rounded-3xl p-8 border border-white/20 shadow-xl text-center group">
                            <p className="text-amber-400 font-black uppercase tracking-widest text-xs mb-4 flex items-center justify-center gap-2">
                                <i className="fa-solid fa-rotate"></i> Current Cycle
                            </p>
                            <div className="flex flex-col items-center">
                                <div className="relative w-20 h-20 mb-3">
                                    <svg className="w-full h-full transform -rotate-90">
                                        <circle cx="40" cy="40" r="36" stroke="rgba(255,255,255,0.1)" strokeWidth="8" fill="none" />
                                        <circle
                                            cx="40" cy="40" r="36"
                                            stroke="currentColor"
                                            strokeWidth="8"
                                            fill="none"
                                            className="text-amber-500"
                                            strokeDasharray={2 * Math.PI * 36}
                                            strokeDashoffset={2 * Math.PI * 36 * (1 - ((khatamProgress?.currentKhatamJuz?.length || 0) % 30) / 30)}
                                        />
                                    </svg>
                                    <div className="absolute inset-0 flex items-center justify-center">
                                        <span className="text-2xl font-black text-white">
                                            {khatamProgress?.currentKhatamJuz?.length || 0}
                                        </span>
                                    </div>
                                </div>
                                <p className="text-white/40 font-bold text-sm tracking-widest uppercase">/ 30 JUZ'</p>
                            </div>
                        </div>

                        {/* Status Stats Card */}
                        <div className="bg-white/10 backdrop-blur-md rounded-3xl p-8 border border-white/20 shadow-xl flex flex-col justify-center">
                            <div className="flex items-center justify-around">
                                <div className="text-center">
                                    <p className="text-blue-400 font-black uppercase tracking-widest text-[10px] mb-1">Pending</p>
                                    <p className="text-3xl font-black text-white">
                                        {douraSubmissions.filter(s => s.status === 'Pending').length}
                                    </p>
                                    <p className="text-[10px] text-white/40 font-bold uppercase">Entries</p>
                                </div>
                                <div className="w-px h-12 bg-white/10"></div>
                                <div className="text-center">
                                    <p className="text-emerald-400 font-black uppercase tracking-widest text-[10px] mb-1">Approved</p>
                                    <p className="text-3xl font-black text-white">
                                        {douraSubmissions.filter(s => s.status === 'Approved').length}
                                    </p>
                                    <p className="text-[10px] text-white/40 font-bold uppercase">Entries</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Progress Grid */}
                    <div className="bg-white rounded-[2rem] p-8 shadow-2xl border-2 border-slate-200/50">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                            <div>
                                <h3 className="text-2xl font-black text-slate-900 tracking-tight">30 Juz' Calendar</h3>
                                <p className="text-slate-500 font-medium text-sm">Visual tracking through the complete Quran</p>
                            </div>
                            <div className="flex flex-wrap gap-4 text-[10px] font-black uppercase tracking-widest">
                                <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 bg-emerald-500 rounded-full shadow-lg shadow-emerald-500/20"></div>
                                    <span className="text-slate-600">Completed</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 bg-amber-500 rounded-full shadow-lg shadow-amber-500/20"></div>
                                    <span className="text-slate-600">Pending</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 bg-slate-100 border border-slate-200 rounded-full"></div>
                                    <span className="text-slate-600">Open</span>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-5 sm:grid-cols-6 md:grid-cols-10 gap-3">
                            {Array.from({ length: 30 }, (_, i) => i + 1).map(num => {
                                const isCompleted = khatamProgress?.currentKhatamJuz?.includes(num);
                                const isPending = douraSubmissions.some(s => s.status === 'Pending' && num >= s.juzStart && num <= s.juzEnd);

                                return (
                                    <div
                                        key={num}
                                        className={`
                                            relative aspect-square flex flex-col items-center justify-center rounded-2xl font-black text-lg transition-all duration-300 transform hover:scale-110 cursor-default group
                                            ${isCompleted ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' :
                                                isPending ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/20' :
                                                    'bg-slate-100 text-slate-300 border-2 border-slate-50'
                                            }
                                        `}
                                    >
                                        <span className="text-[10px] absolute top-2 uppercase tracking-tighter opacity-40">Juz</span>
                                        {num}
                                        {isCompleted && <i className="fa-solid fa-check absolute bottom-2 text-[8px] animate-in zoom-in"></i>}

                                        {/* Hover Tooltip */}
                                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1 bg-slate-900 text-white text-[10px] rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-20 pointer-events-none">
                                            {isCompleted ? 'Juz Completed' : isPending ? 'Pending Approval' : 'Not Started'}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}

            {douraSubTab === 'tasks' && (
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {douraTasks.length === 0 ? (
                            <div className="col-span-full py-20 text-center bg-white rounded-[2rem] border-2 border-dashed border-slate-200">
                                <i className="fa-solid fa-clipboard-check text-5xl text-slate-200 mb-4"></i>
                                <h4 className="text-xl font-black text-slate-400">All caught up!</h4>
                                <p className="text-slate-400">No active tasks assigned to you right now.</p>
                            </div>
                        ) : (
                            douraTasks.filter(task => {
                                // Filter out completed tasks (they are in history)
                                const isCompleted = douraSubmissions.some(s => s.taskId === task.id && s.status === 'Approved');
                                return !isCompleted;
                            }).map(task => {
                                const isPending = douraSubmissions.some(s => s.taskId === task.id && s.status === 'Pending');

                                return (
                                    <div key={task.id} className={`bg-white rounded-[2rem] p-8 shadow-xl border-2 transition-all hover:shadow-2xl ${isPending ? 'border-amber-100' : 'border-slate-100'
                                        }`}>
                                        <div className="flex justify-between items-start mb-6">
                                            <div className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest ${isPending ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'
                                                }`}>
                                                {isPending ? 'Pending Approval' : 'Active'}
                                            </div>
                                            <div className="text-right">
                                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Due Date</p>
                                                <p className="text-sm font-bold text-slate-900">{new Date(task.dueDate).toLocaleDateString()}</p>
                                            </div>
                                        </div>

                                        <h4 className="text-xl font-black text-slate-900 mb-2 truncate">{task.title}</h4>
                                        <p className="text-slate-500 text-sm font-medium line-clamp-2 mb-6">{task.description || 'No description provided'}</p>

                                        <div className="bg-slate-50 rounded-2xl p-4 flex items-center justify-between mb-8">
                                            <div className="text-center">
                                                <span className="block text-[10px] font-black text-slate-300 uppercase tracking-tighter">Juz'</span>
                                                <span className="text-lg font-black text-slate-700">{task.juzStart}-{task.juzEnd}</span>
                                            </div>
                                            <div className="w-px h-8 bg-slate-200"></div>
                                            <div className="text-center">
                                                <span className="block text-[10px] font-black text-slate-300 uppercase tracking-tighter">Pages</span>
                                                <span className="text-lg font-black text-slate-700">{task.pageStart}-{task.pageEnd}</span>
                                            </div>
                                        </div>

                                        {!isPending && (
                                            <button
                                                onClick={() => handleTaskComplete(task)}
                                                className="w-full h-[56px] bg-slate-900 hover:bg-emerald-600 text-white rounded-xl font-black uppercase tracking-widest text-xs transition-all flex items-center justify-center gap-3 active:scale-95 group"
                                            >
                                                <span>Mark as Completed</span>
                                                <i className="fa-solid fa-check group-hover:scale-125 transition-transform"></i>
                                            </button>
                                        )}
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>
            )}

            {douraSubTab === 'submit' && (
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="max-w-2xl mx-auto bg-white rounded-[2rem] p-8 md:p-12 shadow-2xl border-2 border-slate-100">
                        <div className="mb-8">
                            <h3 className="text-2xl font-black text-slate-900 tracking-tight">New Recitation Entry</h3>
                            <p className="text-slate-500 font-medium text-sm">Submit your completed recitation for teacher's approval</p>
                        </div>

                        <div className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Recitation Date</label>
                                    <input
                                        type="date"
                                        value={recitationDate}
                                        onChange={(e) => setRecitationDate(e.target.value)}
                                        className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl px-4 py-3 font-bold text-slate-700 focus:border-emerald-500 focus:bg-white outline-none transition-all"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Under Teacher</label>
                                    <select
                                        value={selectedTeacher}
                                        onChange={(e) => setSelectedTeacher(e.target.value)}
                                        className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl px-4 py-3 font-bold text-slate-700 focus:border-emerald-500 focus:bg-white outline-none transition-all"
                                    >
                                        <option value="">Select a teacher</option>
                                        {submissionType === 'Self' && <option value="Self-Reading">Self Reading (Auto-Approve)</option>}
                                        {douraTeachers.map(teacher => (
                                            <option key={teacher} value={teacher}>{teacher}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Juz' Start <i className="fa-solid fa-lock text-slate-300 ml-1"></i></label>
                                    <input
                                        type="number"
                                        value={juzStart}
                                        readOnly
                                        disabled
                                        className="w-full bg-slate-100 border-2 border-slate-200 text-slate-500 rounded-xl px-4 py-3 font-bold cursor-not-allowed outline-none select-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Juz' End</label>
                                    <input
                                        type="number"
                                        min="1"
                                        max="30"
                                        value={juzEnd}
                                        onChange={(e) => {
                                            const val = parseInt(e.target.value);
                                            setJuzEnd(val);
                                            // Auto-update page end suggestion
                                            if (val) {
                                                const range = getJuzPageRange(val);
                                                setPageEnd(range.end);
                                            }
                                        }}
                                        className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl px-4 py-3 font-bold text-slate-700 focus:border-emerald-500 focus:bg-white outline-none transition-all"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Page Start <i className="fa-solid fa-lock text-slate-300 ml-1"></i></label>
                                    <input
                                        type="number"
                                        value={pageStart}
                                        readOnly
                                        disabled
                                        className="w-full bg-slate-100 border-2 border-slate-200 text-slate-500 rounded-xl px-4 py-3 font-bold cursor-not-allowed outline-none select-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Page End (Optional)</label>
                                    <input
                                        type="number"
                                        min="1"
                                        max="604"
                                        placeholder="Optional"
                                        value={pageEnd}
                                        onChange={(e) => setPageEnd(e.target.value === '' ? '' : parseInt(e.target.value))}
                                        className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl px-4 py-3 font-bold text-slate-700 focus:border-emerald-500 focus:bg-white outline-none transition-all"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Aya Start <i className="fa-solid fa-lock text-slate-300 ml-1"></i></label>
                                    <input
                                        type="number"
                                        value={ayaStart}
                                        readOnly
                                        disabled
                                        className="w-full bg-slate-100 border-2 border-slate-200 text-slate-500 rounded-xl px-4 py-3 font-bold cursor-not-allowed outline-none select-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Aya End (Optional)</label>
                                    <input
                                        type="number"
                                        min="1"
                                        placeholder="Optional"
                                        value={ayaEnd}
                                        onChange={(e) => setAyaEnd(e.target.value === '' ? '' : parseInt(e.target.value))}
                                        className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl px-4 py-3 font-bold text-slate-700 focus:border-emerald-500 focus:bg-white outline-none transition-all"
                                    />
                                </div>
                            </div>

                            <button
                                onClick={handleDouraSubmit}
                                className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-black uppercase tracking-[0.2em] shadow-xl shadow-emerald-500/20 transition-all active:scale-95 disabled:opacity-50 mt-4"
                                disabled={!selectedTeacher || !juzStart || !juzEnd}
                            >
                                {isSubmittingDoura ? 'Submitting...' : 'Submit Entry'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {douraSubTab === 'history' && (
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 py-12 text-center bg-white rounded-[2rem] border-2 border-slate-100">
                    <i className="fa-solid fa-clock-rotate-left text-5xl text-slate-100 mb-4"></i>
                    <h4 className="text-xl font-black text-slate-300">History Tracking</h4>
                    <p className="text-slate-400">View your detailed submission history in the sidebar or check here for expanded view.</p>
                </div>
            )}

            {douraSubTab === 'rankings' && (
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 py-12 text-center bg-white rounded-[2rem] border-2 border-slate-100">
                    <i className="fa-solid fa-crown text-5xl text-slate-100 mb-4"></i>
                    <h4 className="text-xl font-black text-slate-300">Class Leaderboards</h4>
                    <p className="text-slate-400">Competitive tracking and achievements coming soon.</p>
                </div>
            )}

            {/* Bottom Area: Leaderboard and History */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-12 animate-in fade-in slide-in-from-bottom-6 duration-700">
                {/* Top Reciters Leaderboard */}
                <div className="bg-white rounded-[2rem] p-8 shadow-2xl border-2 border-emerald-100 relative overflow-hidden h-fit">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full -mr-12 -mt-12"></div>
                    <div className="relative z-10 mb-6">
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <h3 className="text-xl font-black text-slate-900 tracking-tight">
                                    {leaderboardType === 'task' ? 'Task Champions' : 'Khatam Pace-Setters'}
                                </h3>
                                <p className="text-emerald-600 font-bold text-xs uppercase tracking-widest">
                                    {leaderboardScope === 'class' ? `Class: ${result.className}` : 'College Wide'}
                                </p>
                            </div>
                            <i className={`fa-solid ${leaderboardType === 'task' ? 'fa-medal text-blue-500' : 'fa-crown text-amber-500'} text-2xl animate-bounce`}></i>
                        </div>

                        {/* Leaderboard Toggles */}
                        <div className="space-y-2 mb-6">
                            <div className="flex p-1 bg-slate-100 rounded-xl">
                                <button
                                    onClick={() => setLeaderboardScope('class')}
                                    className={`flex-1 py-1.5 px-3 rounded-lg text-[10px] font-black transition-all ${leaderboardScope === 'class' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                                >
                                    CLASS
                                </button>
                                <button
                                    onClick={() => setLeaderboardScope('college')}
                                    className={`flex-1 py-1.5 px-3 rounded-lg text-[10px] font-black transition-all ${leaderboardScope === 'college' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                                >
                                    COLLEGE
                                </button>
                            </div>
                            <div className="flex p-1 bg-emerald-50 rounded-xl">
                                <button
                                    onClick={() => setLeaderboardType('task')}
                                    className={`flex-1 py-1.5 px-3 rounded-lg text-[10px] font-black transition-all ${leaderboardType === 'task' ? 'bg-emerald-600 text-white shadow-sm' : 'text-emerald-400 hover:text-emerald-600'}`}
                                >
                                    TASKS
                                </button>
                                <button
                                    onClick={() => setLeaderboardType('self')}
                                    className={`flex-1 py-1.5 px-3 rounded-lg text-[10px] font-black transition-all ${leaderboardType === 'self' ? 'bg-emerald-600 text-white shadow-sm' : 'text-emerald-400 hover:text-emerald-600'}`}
                                >
                                    KHATAM
                                </button>
                            </div>
                        </div>

                        <div className="space-y-3">
                            {(leaderboardScope === 'class'
                                ? (leaderboardType === 'task' ? classTaskReciters : classSelfReciters)
                                : (leaderboardType === 'task' ? collegeTaskReciters : collegeSelfReciters)
                            ).length === 0 ? (
                                <div className="text-center py-8">
                                    <p className="text-slate-400 text-xs">No records found yet</p>
                                </div>
                            ) : (
                                (leaderboardScope === 'class'
                                    ? (leaderboardType === 'task' ? classTaskReciters : classSelfReciters)
                                    : (leaderboardType === 'task' ? collegeTaskReciters : collegeSelfReciters)
                                ).map((reciter, idx) => (
                                    <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                                        <div className="flex items-center gap-3">
                                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black ${idx === 0 ? 'bg-amber-100 text-amber-700' :
                                                idx === 1 ? 'bg-slate-200 text-slate-700' :
                                                    idx === 2 ? 'bg-orange-100 text-orange-700' :
                                                        'bg-white text-slate-400'
                                                }`}>
                                                {idx + 1}
                                            </div>
                                            <p className="font-bold text-slate-700 text-sm truncate max-w-[120px]">{reciter.name}</p>
                                        </div>
                                        <div className="text-right">
                                            <span className="font-black text-slate-900 text-sm">{reciter.juzCount}</span>
                                            <span className="text-[10px] text-slate-400 uppercase ml-1">Juz</span>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>

                {/* History Sidebar */}
                <div className="bg-white rounded-[2rem] p-8 shadow-2xl border-2 border-slate-100 h-[600px] flex flex-col">
                    <h3 className="text-xl font-black text-slate-900 tracking-tight mb-6 flex items-center gap-2">
                        <i className="fa-solid fa-clock-rotate-left text-slate-300"></i>
                        Recent Activity
                    </h3>
                    <div className="flex-1 overflow-y-auto space-y-4 pr-2 custom-scrollbar">
                        {douraSubmissions.length === 0 ? (
                            <div className="text-center py-12">
                                <p className="text-slate-400">No submission history found</p>
                            </div>
                        ) : (
                            douraSubmissions.map(sub => (
                                <div key={sub.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 relative group hover:bg-white hover:shadow-lg transition-all">
                                    <div className="absolute top-4 right-4">
                                        <span className={`px-2 py-1 rounded-md text-[10px] font-black uppercase tracking-widest ${sub.status === 'Approved' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                                            {sub.status}
                                        </span>
                                    </div>
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
                                        {new Date(sub.submittedAt).toLocaleDateString()}
                                    </p>
                                    <div className="flex items-center gap-2 mb-2">
                                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${sub.type === 'Task' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
                                            {sub.type}
                                        </span>
                                        <h4 className="font-bold text-slate-800">
                                            Juz {sub.juzStart}-{sub.juzEnd}
                                        </h4>
                                    </div>
                                    <p className="text-xs text-slate-500 mb-2">
                                        Pages {sub.pageStart}-{sub.pageEnd}
                                    </p>
                                    <div className="flex items-center gap-1 text-[10px] text-slate-400 font-bold uppercase">
                                        <i className="fa-solid fa-chalkboard-user"></i>
                                        {sub.teacherName}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default React.memo(PublicDouraTracker);
