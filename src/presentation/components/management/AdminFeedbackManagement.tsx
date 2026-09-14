import React, { useState, useEffect, useMemo } from 'react';
import type { StudentFeedback, TeacherAccount } from '../../../domain/entities/types';
import { SYSTEM_CLASSES } from '../../../domain/entities/constants';
import { dataService } from '../../../infrastructure/services/dataService';

export const AdminFeedbackManagement: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'feedback' | 'teachers'>('feedback');
    const [feedbacks, setFeedbacks] = useState<StudentFeedback[]>([]);
    const [teachers, setTeachers] = useState<TeacherAccount[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(true);

    // Filters for feedback
    const [filterSemester, setFilterSemester] = useState<string>('All');
    const [filterClass, setFilterClass] = useState<string>('All');
    const [filterTeacher, setFilterTeacher] = useState<string>('All');
    const [filterAnonymity, setFilterAnonymity] = useState<'All' | 'Anonymous' | 'Named'>('All');
    const [searchKeyword, setSearchKeyword] = useState<string>('');

    // Teacher account modal / form
    const [showTeacherModal, setShowTeacherModal] = useState<boolean>(false);
    const [editingTeacher, setEditingTeacher] = useState<TeacherAccount | null>(null);
    const [teacherForm, setTeacherForm] = useState({
        name: '',
        username: '',
        mobileNumber: '',
        password: '',
        assignedClasses: [] as string[],
        isActive: true
    });
    const [actionStatus, setActionStatus] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

    const loadData = async () => {
        setIsLoading(true);
        try {
            await dataService.syncLocalFeedbackToFirestore().catch(() => {});
            const [fbList, teacherList] = await Promise.all([
                dataService.getAllFeedback(),
                dataService.getAllTeacherAccounts()
            ]);
            setFeedbacks(fbList);
            setTeachers(teacherList);
        } catch (err) {
            console.error('Failed to load admin feedback management data:', err);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    // Derived options for filters
    const semesterOptions = useMemo(() => {
        const set = new Set<string>();
        feedbacks.forEach(f => { if (f.semester) set.add(f.semester); });
        return ['All', ...Array.from(set).sort()];
    }, [feedbacks]);

    const teacherNameOptions = useMemo(() => {
        const set = new Set<string>();
        feedbacks.forEach(f => { if (f.teacherName) set.add(f.teacherName); });
        teachers.forEach(t => { if (t.name) set.add(t.name); });
        return ['All', ...Array.from(set).sort()];
    }, [feedbacks, teachers]);

    // Filtered feedback list
    const filteredFeedbacks = useMemo(() => {
        return feedbacks.filter(f => {
            const semMatch = filterSemester === 'All' || f.semester === filterSemester;
            const clsMatch = filterClass === 'All' || f.className === filterClass;
            const tMatch = filterTeacher === 'All' || f.teacherName.toLowerCase() === filterTeacher.toLowerCase();
            const anonMatch = filterAnonymity === 'All' ||
                (filterAnonymity === 'Anonymous' && f.isAnonymous) ||
                (filterAnonymity === 'Named' && !f.isAnonymous);

            const searchClean = searchKeyword.toLowerCase().trim();
            const searchMatch = !searchClean ||
                (f.teacherName && f.teacherName.toLowerCase().includes(searchClean)) ||
                (f.className && f.className.toLowerCase().includes(searchClean)) ||
                (f.studentName && f.studentName.toLowerCase().includes(searchClean)) ||
                (f.responses && Object.values(f.responses).some(val => val && val.toLowerCase().includes(searchClean)));

            return semMatch && clsMatch && tMatch && anonMatch && searchMatch;
        });
    }, [feedbacks, filterSemester, filterClass, filterTeacher, filterAnonymity, searchKeyword]);

    // Class counts breakdown
    const classCounts = useMemo(() => {
        const counts: Record<string, number> = {};
        feedbacks.forEach(f => {
            if (filterSemester === 'All' || f.semester === filterSemester) {
                counts[f.className] = (counts[f.className] || 0) + 1;
            }
        });
        return counts;
    }, [feedbacks, filterSemester]);

    // Open Teacher Form Modal
    const handleOpenTeacherModal = (teacher?: TeacherAccount) => {
        if (teacher) {
            setEditingTeacher(teacher);
            setTeacherForm({
                name: teacher.name,
                username: teacher.username,
                mobileNumber: teacher.mobileNumber,
                password: teacher.password,
                assignedClasses: teacher.assignedClasses || [],
                isActive: teacher.isActive
            });
        } else {
            setEditingTeacher(null);
            setTeacherForm({
                name: '',
                username: '',
                mobileNumber: '',
                password: '',
                assignedClasses: [],
                isActive: true
            });
        }
        setActionStatus(null);
        setShowTeacherModal(true);
    };

    // Save Teacher Account
    const handleSaveTeacher = async (e: React.FormEvent) => {
        e.preventDefault();
        setActionStatus(null);

        if (!teacherForm.name.trim() || !teacherForm.username.trim() || !teacherForm.mobileNumber.trim() || !teacherForm.password.trim()) {
            setActionStatus({ type: 'error', msg: 'Name, Username, Mobile Number, and Password are all required.' });
            return;
        }

        try {
            if (editingTeacher) {
                await dataService.updateTeacherAccount(editingTeacher.id, {
                    name: teacherForm.name.trim(),
                    username: teacherForm.username.trim(),
                    mobileNumber: teacherForm.mobileNumber.trim(),
                    password: teacherForm.password.trim(),
                    assignedClasses: teacherForm.assignedClasses,
                    isActive: teacherForm.isActive
                });
                setActionStatus({ type: 'success', msg: 'Teacher profile updated successfully!' });
            } else {
                await dataService.saveTeacherAccount({
                    name: teacherForm.name.trim(),
                    username: teacherForm.username.trim(),
                    mobileNumber: teacherForm.mobileNumber.trim(),
                    password: teacherForm.password.trim(),
                    assignedClasses: teacherForm.assignedClasses,
                    isActive: teacherForm.isActive
                });
                setActionStatus({ type: 'success', msg: 'New teacher account created successfully!' });
            }
            await loadData();
            setTimeout(() => setShowTeacherModal(false), 1200);
        } catch (err) {
            console.error('Failed to save teacher account:', err);
            setActionStatus({ type: 'error', msg: 'Error saving teacher account.' });
        }
    };

    // Toggle Delete / Inactive
    const handleDeleteTeacher = async (id: string) => {
        if (!window.confirm('Are you sure you want to delete this teacher account?')) return;
        try {
            await dataService.deleteTeacherAccount(id);
            await loadData();
        } catch (err) {
            console.error('Failed to delete teacher account:', err);
        }
    };

    const toggleClassAssignment = (cls: string) => {
        setTeacherForm(prev => {
            const exists = prev.assignedClasses.includes(cls);
            return {
                ...prev,
                assignedClasses: exists
                    ? prev.assignedClasses.filter(c => c !== cls)
                    : [...prev.assignedClasses, cls]
            };
        });
    };

    return (
        <div className="space-y-6">
            {/* Top Navigation Tabs */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-slate-900/90 border border-slate-800 p-4 rounded-3xl">
                <div>
                    <h2 className="text-xl font-black text-white flex items-center gap-2">
                        💬 Student Feedback & Teacher Auth Management
                    </h2>
                    <p className="text-slate-400 text-xs mt-0.5">
                        Manage continuous student feedback, review open-ended reflections, and configure teacher mobile accounts.
                    </p>
                </div>

                <div className="flex items-center gap-2 bg-slate-800 p-1.5 rounded-2xl border border-slate-700">
                    <button
                        onClick={() => setActiveTab('feedback')}
                        className={`px-4 py-2 rounded-xl text-xs font-black transition-all ${
                            activeTab === 'feedback'
                                ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-500/20'
                                : 'text-slate-400 hover:text-white'
                        }`}
                    >
                        📋 Feedback Reports ({feedbacks.length})
                    </button>
                    <button
                        onClick={() => setActiveTab('teachers')}
                        className={`px-4 py-2 rounded-xl text-xs font-black transition-all ${
                            activeTab === 'teachers'
                                ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-500/20'
                                : 'text-slate-400 hover:text-white'
                        }`}
                    >
                        🔐 Teacher Accounts ({teachers.length})
                    </button>
                </div>
            </div>

            {/* TAB 1: FEEDBACK REPORTS */}
            {activeTab === 'feedback' && (
                <div className="space-y-6">
                    {/* Class-wise Received Feedback Counts Summary */}
                    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl">
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-xs font-bold text-slate-300 uppercase tracking-widest flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                                Class-Wise Received Feedback Counts
                            </span>
                            <span className="text-xs text-emerald-400 font-bold">Total: {feedbacks.length} Entries</span>
                        </div>
                        <div className="flex flex-wrap gap-2.5">
                            {SYSTEM_CLASSES.map(cls => {
                                const count = classCounts[cls] || 0;
                                return (
                                    <div key={cls} className="bg-slate-800/90 border border-slate-700/80 rounded-2xl px-3.5 py-2 flex items-center gap-2">
                                        <span className="text-xs font-bold text-slate-300">{cls}:</span>
                                        <span className={`px-2 py-0.5 text-xs font-black rounded-lg ${count > 0 ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-slate-700 text-slate-500'}`}>
                                            {count}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Filters Bar */}
                    <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 shadow-xl space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                            <div>
                                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Semester</label>
                                <select
                                    value={filterSemester}
                                    onChange={e => setFilterSemester(e.target.value)}
                                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                                >
                                    {semesterOptions.map(sem => (
                                        <option key={sem} value={sem}>{sem}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Class / Batch</label>
                                <select
                                    value={filterClass}
                                    onChange={e => setFilterClass(e.target.value)}
                                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                                >
                                    <option value="All">All Classes</option>
                                    {SYSTEM_CLASSES.map(cls => (
                                        <option key={cls} value={cls}>{cls}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Faculty / Teacher</label>
                                <select
                                    value={filterTeacher}
                                    onChange={e => setFilterTeacher(e.target.value)}
                                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                                >
                                    {teacherNameOptions.map(t => (
                                        <option key={t} value={t}>{t}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Confidentiality</label>
                                <select
                                    value={filterAnonymity}
                                    onChange={e => setFilterAnonymity(e.target.value as any)}
                                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                                >
                                    <option value="All">All (Anonymous & Named)</option>
                                    <option value="Anonymous">Anonymous Only</option>
                                    <option value="Named">Named Only</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Search Keywords</label>
                                <input
                                    type="text"
                                    value={searchKeyword}
                                    onChange={e => setSearchKeyword(e.target.value)}
                                    placeholder="Search teacher, suggestions..."
                                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                                />
                            </div>
                        </div>

                        <div className="flex items-center justify-between text-xs text-slate-400 pt-2 border-t border-slate-800">
                            <span>Found <strong className="text-emerald-400">{filteredFeedbacks.length}</strong> matching feedback items</span>
                            <button
                                onClick={() => window.print()}
                                className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl border border-slate-700 transition-all flex items-center gap-1.5"
                            >
                                🖨️ Print Report
                            </button>
                        </div>
                    </div>

                    {/* Feedback Items List */}
                    {isLoading ? (
                        <div className="py-12 text-center text-slate-400 text-sm animate-pulse">Loading feedback records...</div>
                    ) : filteredFeedbacks.length === 0 ? (
                        <div className="bg-slate-900/50 border border-slate-800 rounded-3xl p-12 text-center text-slate-400 text-xs">
                            No feedback matches the selected filters.
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {filteredFeedbacks.map((fb, idx) => (
                                <div key={fb.id || idx} className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
                                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
                                        <div className="flex items-center gap-3">
                                            <span className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-400 font-bold text-xs flex items-center justify-center">
                                                #{idx + 1}
                                            </span>
                                            <div>
                                                <h4 className="text-white font-bold text-sm">
                                                    Teacher: <span className="text-emerald-400 font-black">{fb.teacherName}</span>
                                                </h4>
                                                <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
                                                    <span>Class: <strong className="text-slate-200">{fb.className}</strong></span>
                                                    <span>•</span>
                                                    <span>Semester: <strong className="text-slate-200">{fb.semester}</strong></span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-3">
                                            {fb.isAnonymous ? (
                                                <span className="px-3 py-1 bg-emerald-500/20 text-emerald-300 text-xs font-bold rounded-xl border border-emerald-500/30">
                                                    🛡️ Anonymous
                                                </span>
                                            ) : (
                                                <span className="px-3 py-1 bg-slate-800 text-slate-300 text-xs font-bold rounded-xl border border-slate-700">
                                                    👤 {fb.studentName || 'Student'} {fb.studentAdNo ? `(Ad: ${fb.studentAdNo})` : ''}
                                                </span>
                                            )}
                                            <span className="text-amber-400 text-sm font-bold bg-slate-800 px-3 py-1 rounded-xl border border-slate-700">
                                                ★ {fb.overallRating || 5} / 5
                                            </span>
                                        </div>
                                    </div>

                                    {/* Open Reflections */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                                        {fb.responses?.teachingLearning && (
                                            <div className="bg-slate-800/50 p-3.5 rounded-2xl border border-slate-700/60">
                                                <span className="text-emerald-400 font-bold block mb-1">📚 Teaching & Learning</span>
                                                <p className="text-slate-200 leading-relaxed">{fb.responses.teachingLearning}</p>
                                            </div>
                                        )}
                                        {fb.responses?.spiritualMoral && (
                                            <div className="bg-slate-800/50 p-3.5 rounded-2xl border border-slate-700/60">
                                                <span className="text-emerald-400 font-bold block mb-1">🕌 Spiritual & Moral</span>
                                                <p className="text-slate-200 leading-relaxed">{fb.responses.spiritualMoral}</p>
                                            </div>
                                        )}
                                        {fb.responses?.residentialCommunity && (
                                            <div className="bg-slate-800/50 p-3.5 rounded-2xl border border-slate-700/60">
                                                <span className="text-emerald-400 font-bold block mb-1">🏠 Residential & Community</span>
                                                <p className="text-slate-200 leading-relaxed">{fb.responses.residentialCommunity}</p>
                                            </div>
                                        )}
                                        {fb.responses?.communication && (
                                            <div className="bg-slate-800/50 p-3.5 rounded-2xl border border-slate-700/60">
                                                <span className="text-emerald-400 font-bold block mb-1">💬 Communication</span>
                                                <p className="text-slate-200 leading-relaxed">{fb.responses.communication}</p>
                                            </div>
                                        )}
                                    </div>

                                    {/* Open Suggestions */}
                                    <div className="space-y-2 pt-2 text-xs">
                                        {fb.responses?.strengths && (
                                            <div className="bg-emerald-950/30 border border-emerald-500/30 p-3 rounded-xl">
                                                <span className="text-emerald-400 font-bold block">✨ Strengths:</span>
                                                <p className="text-slate-200 mt-0.5">{fb.responses.strengths}</p>
                                            </div>
                                        )}
                                        {fb.responses?.improvements && (
                                            <div className="bg-amber-950/30 border border-amber-500/30 p-3 rounded-xl">
                                                <span className="text-amber-400 font-bold block">🎯 Suggestions for Improvement:</span>
                                                <p className="text-slate-200 mt-0.5">{fb.responses.improvements}</p>
                                            </div>
                                        )}
                                        {fb.responses?.bridgingDisconnection && (
                                            <div className="bg-indigo-950/30 border border-indigo-500/30 p-3 rounded-xl">
                                                <span className="text-indigo-400 font-bold block">🤝 Bridging Disconnection & Extra Support:</span>
                                                <p className="text-slate-200 mt-0.5">{fb.responses.bridgingDisconnection}</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* TAB 2: TEACHER ACCOUNTS & CREDENTIALS */}
            {activeTab === 'teachers' && (
                <div className="space-y-6">
                    <div className="flex items-center justify-between bg-slate-900 border border-slate-800 p-5 rounded-3xl">
                        <div>
                            <h3 className="text-base font-bold text-white">Teacher Mobile & Username Accounts</h3>
                            <p className="text-xs text-slate-400">Configure login credentials for teachers so they can access their feedback directly</p>
                        </div>

                        <button
                            onClick={() => handleOpenTeacherModal()}
                            className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-2xl shadow-lg transition-all flex items-center gap-2"
                        >
                            <span>+ Create Teacher Account</span>
                        </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {teachers.map(teacher => (
                            <div key={teacher.id} className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl space-y-3 relative">
                                <div className="flex items-start justify-between">
                                    <div>
                                        <h4 className="text-sm font-bold text-white">{teacher.name}</h4>
                                        <span className={`inline-block px-2 py-0.5 text-[10px] font-bold rounded-md mt-1 ${teacher.isActive ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-rose-500/20 text-rose-400'}`}>
                                            {teacher.isActive ? 'Active' : 'Inactive'}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <button
                                            onClick={() => handleOpenTeacherModal(teacher)}
                                            className="p-2 text-slate-400 hover:text-emerald-400"
                                            title="Edit"
                                        >
                                            ✏️
                                        </button>
                                        <button
                                            onClick={() => handleDeleteTeacher(teacher.id)}
                                            className="p-2 text-slate-400 hover:text-rose-400"
                                            title="Delete"
                                        >
                                            🗑️
                                        </button>
                                    </div>
                                </div>

                                <div className="space-y-1.5 text-xs text-slate-300 bg-slate-800/60 p-3 rounded-2xl border border-slate-700/50">
                                    <div>📱 Mobile: <strong className="text-emerald-400">{teacher.mobileNumber}</strong></div>
                                    <div>👤 Username: <strong className="text-emerald-400">{teacher.username}</strong></div>
                                    <div>🔑 Password: <strong className="text-slate-200">{teacher.password}</strong></div>
                                </div>

                                <div className="text-[11px] text-slate-400">
                                    <span>Assigned Classes: </span>
                                    <span className="font-bold text-slate-200">
                                        {teacher.assignedClasses && teacher.assignedClasses.length > 0 ? teacher.assignedClasses.join(', ') : 'All Classes'}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Teacher Modal */}
            {showTeacherModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
                    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl space-y-5">
                        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                            <h3 className="text-lg font-bold text-white">
                                {editingTeacher ? 'Edit Teacher Account' : 'Create New Teacher Account'}
                            </h3>
                            <button onClick={() => setShowTeacherModal(false)} className="text-slate-400 hover:text-white font-bold">✕</button>
                        </div>

                        {actionStatus && (
                            <div className={`p-3 text-xs rounded-xl ${actionStatus.type === 'success' ? 'bg-emerald-950 text-emerald-300 border border-emerald-500' : 'bg-rose-950 text-rose-300 border border-rose-500'}`}>
                                {actionStatus.msg}
                            </div>
                        )}

                        <form onSubmit={handleSaveTeacher} className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-300 mb-1">Faculty Full Name</label>
                                <input
                                    type="text"
                                    value={teacherForm.name}
                                    onChange={e => setTeacherForm(prev => ({ ...prev, name: e.target.value }))}
                                    placeholder="e.g. Dr. Ahmad Usthad"
                                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                                    required
                                />
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-bold text-slate-300 mb-1">Mobile Number</label>
                                    <input
                                        type="text"
                                        value={teacherForm.mobileNumber}
                                        onChange={e => setTeacherForm(prev => ({ ...prev, mobileNumber: e.target.value }))}
                                        placeholder="e.g. 9876543210"
                                        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-300 mb-1">Username</label>
                                    <input
                                        type="text"
                                        value={teacherForm.username}
                                        onChange={e => setTeacherForm(prev => ({ ...prev, username: e.target.value }))}
                                        placeholder="e.g. usthad_ahmad"
                                        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                                        required
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-300 mb-1">Password / PIN</label>
                                <input
                                    type="text"
                                    value={teacherForm.password}
                                    onChange={e => setTeacherForm(prev => ({ ...prev, password: e.target.value }))}
                                    placeholder="Enter login password"
                                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-300 mb-1.5">Assigned Classes</label>
                                <div className="flex flex-wrap gap-2">
                                    {SYSTEM_CLASSES.map(cls => {
                                        const isSelected = teacherForm.assignedClasses.includes(cls);
                                        return (
                                            <button
                                                type="button"
                                                key={cls}
                                                onClick={() => toggleClassAssignment(cls)}
                                                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${isSelected ? 'bg-emerald-500 text-slate-950 shadow-md' : 'bg-slate-800 text-slate-400 border border-slate-700'}`}
                                            >
                                                {cls}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                                <button
                                    type="button"
                                    onClick={() => setShowTeacherModal(false)}
                                    className="px-4 py-2 bg-slate-800 text-slate-300 text-xs font-bold rounded-xl hover:bg-slate-700"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="px-6 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow-lg"
                                >
                                    Save Account
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminFeedbackManagement;
