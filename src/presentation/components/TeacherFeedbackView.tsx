import React, { useState, useEffect, useMemo } from 'react';
import type { StudentFeedback, TeacherAccount, User } from '../../domain/entities/types';
import { dataService } from '../../infrastructure/services/dataService';

interface TeacherFeedbackViewProps {
    currentUser: User;
}

export const TeacherFeedbackView: React.FC<TeacherFeedbackViewProps> = ({ currentUser }) => {
    const isAdmin = currentUser.role === 'admin' || currentUser.username === 'admin';

    const [feedbacks, setFeedbacks] = useState<StudentFeedback[]>([]);
    const [allFeedbacksList, setAllFeedbacksList] = useState<StudentFeedback[]>([]);
    const [teacherProfile, setTeacherProfile] = useState<TeacherAccount | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [selectedSemester, setSelectedSemester] = useState<string>('All');
    const [selectedClass, setSelectedClass] = useState<string>('All');
    
    // Admin faculty filter
    const [selectedTeacherFilter, setSelectedTeacherFilter] = useState<string>('All Faculty');
    const [teacherFilterOptions, setTeacherFilterOptions] = useState<string[]>([]);

    // Edit credentials modal
    const [showEditModal, setShowEditModal] = useState<boolean>(false);
    const [isDefaultCredentials, setIsDefaultCredentials] = useState<boolean>(false);
    const [editForm, setEditForm] = useState({
        username: currentUser.username || '',
        mobileNumber: '',
        password: '',
        confirmPassword: ''
    });
    const [editSuccess, setEditSuccess] = useState<string>('');
    const [editError, setEditError] = useState<string>('');
    const [isSavingProfile, setIsSavingProfile] = useState<boolean>(false);

    // Load teacher profile & feedback
    const loadTeacherData = async () => {
        setIsLoading(true);
        try {
            const accounts = await dataService.getAllTeacherAccounts();
            const allFb = await dataService.getAllFeedback();
            setAllFeedbacksList(allFb);

            if (isAdmin) {
                // Admin Mode: discover all unique faculty names from feedback + accounts
                const namesSet = new Set<string>();
                allFb.forEach(f => { if (f.teacherName && f.teacherName.trim()) namesSet.add(f.teacherName.trim()); });
                accounts.forEach(a => { if (a.name && a.name.trim()) namesSet.add(a.name.trim()); });
                const sortedNames = Array.from(namesSet).sort();
                setTeacherFilterOptions(['All Faculty', ...sortedNames]);

                setIsDefaultCredentials(false);
                setTeacherProfile({
                    id: 'admin',
                    name: currentUser.name || 'System Administrator',
                    username: currentUser.username || 'admin',
                    mobileNumber: '',
                    password: '',
                    assignedClasses: [],
                    isActive: true
                });

                setFeedbacks(allFb);
            } else {
                const activeTeacherName = currentUser.name || currentUser.username;
                if (!activeTeacherName) {
                    setFeedbacks([]);
                    setTeacherProfile(null);
                    return;
                }

                // Match teacher profile by username, mobile, or name
                const foundAccount = accounts.find(a => 
                    a.id === currentUser.id ||
                    a.username.toLowerCase() === currentUser.username.toLowerCase() ||
                    a.name.toLowerCase() === activeTeacherName.toLowerCase()
                );

                if (foundAccount) {
                    setTeacherProfile(foundAccount);
                    const hasDefaultCreds = 
                        (foundAccount as any).isDefaultCredentials === true ||
                        foundAccount.password === 'dawa@2025' ||
                        foundAccount.mobileNumber === '0000000000' ||
                        !foundAccount.mobileNumber.trim();
                    setIsDefaultCredentials(hasDefaultCreds);
                    setEditForm({
                        username: foundAccount.username,
                        mobileNumber: foundAccount.mobileNumber === '0000000000' ? '' : foundAccount.mobileNumber,
                        password: '',
                        confirmPassword: ''
                    });
                    if (hasDefaultCreds) {
                        setShowEditModal(true);
                    }
                } else {
                    setTeacherProfile(null);
                    setIsDefaultCredentials(false);
                    setEditForm({
                        username: activeTeacherName.toLowerCase().replace(/\s+/g, '_'),
                        mobileNumber: '',
                        password: '',
                        confirmPassword: ''
                    });
                }

                const searchName = foundAccount?.name || activeTeacherName;
                const list = await dataService.getTeacherFeedback(searchName);
                setFeedbacks(list);
            }
        } catch (err) {
            console.error('Failed to load teacher feedback:', err);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadTeacherData();
    }, [currentUser]);

    // Handle Admin faculty dropdown filtering
    useEffect(() => {
        if (!isAdmin) return;
        if (selectedTeacherFilter === 'All Faculty') {
            setFeedbacks(allFeedbacksList);
        } else {
            const filtered = allFeedbacksList.filter(f => 
                f.teacherName && f.teacherName.trim().toLowerCase() === selectedTeacherFilter.trim().toLowerCase()
            );
            setFeedbacks(filtered);
        }
    }, [selectedTeacherFilter, allFeedbacksList, isAdmin]);

    // Unique semesters & classes for filters
    const semesterOptions = useMemo(() => {
        const set = new Set<string>();
        feedbacks.forEach(f => { if (f.semester) set.add(f.semester); });
        return ['All', ...Array.from(set).sort()];
    }, [feedbacks]);

    const classOptions = useMemo(() => {
        const set = new Set<string>();
        feedbacks.forEach(f => { if (f.className) set.add(f.className); });
        return ['All', ...Array.from(set).sort()];
    }, [feedbacks]);

    const handleDeleteFeedback = async (feedbackId: string) => {
        if (!feedbackId) return;
        if (!window.confirm('Are you sure you want to delete this feedback entry? This action cannot be undone.')) {
            return;
        }

        try {
            await dataService.deleteFeedback(feedbackId);
            await loadTeacherData();
        } catch (err) {
            console.error('Failed to delete feedback:', err);
            alert('Failed to delete feedback. Please try again.');
        }
    };

    // Filtered feedback list
    const filteredFeedbacks = useMemo(() => {
        return feedbacks.filter(f => {
            const semMatch = selectedSemester === 'All' || f.semester === selectedSemester;
            const clsMatch = selectedClass === 'All' || f.className === selectedClass;
            return semMatch && clsMatch;
        });
    }, [feedbacks, selectedSemester, selectedClass]);

    // Class-wise counts breakdown
    const classCounts = useMemo(() => {
        const counts: Record<string, number> = {};
        feedbacks.forEach(f => {
            if (selectedSemester === 'All' || f.semester === selectedSemester) {
                counts[f.className] = (counts[f.className] || 0) + 1;
            }
        });
        return counts;
    }, [feedbacks, selectedSemester]);

    // Save edited teacher credentials
    const handleSaveProfile = async (e: React.FormEvent) => {
        e.preventDefault();
        setEditError('');
        setEditSuccess('');

        if (!editForm.username.trim()) {
            setEditError('Username is required.');
            return;
        }
        if (!editForm.mobileNumber.trim()) {
            setEditError('Mobile number is required.');
            return;
        }
        if (!editForm.password.trim()) {
            setEditError('Please enter a new password.');
            return;
        }
        if (isDefaultCredentials && editForm.password.trim() === 'dawa@2025') {
            setEditError('Please choose a new personal password — the default password cannot be kept.');
            return;
        }
        if (editForm.confirmPassword !== editForm.password) {
            setEditError('Passwords do not match. Please re-enter.');
            return;
        }
        if (editForm.password.trim().length < 6) {
            setEditError('Password must be at least 6 characters long.');
            return;
        }

        const activeName = currentUser.name || currentUser.username;
        if (!activeName) {
            setEditError('Profile name is required.');
            return;
        }

        setIsSavingProfile(true);
        try {
            if (teacherProfile && teacherProfile.id !== 'admin') {
                await dataService.updateTeacherAccount(teacherProfile.id, {
                    name: activeName,
                    username: editForm.username.trim(),
                    mobileNumber: editForm.mobileNumber.trim(),
                    password: editForm.password.trim(),
                    isDefaultCredentials: false
                } as any);
                setEditSuccess('✅ Credentials updated successfully!');
            } else {
                await dataService.saveTeacherAccount({
                    name: activeName,
                    username: editForm.username.trim(),
                    mobileNumber: editForm.mobileNumber.trim(),
                    password: editForm.password.trim(),
                    isActive: true
                });
                setEditSuccess('✅ Credentials saved successfully!');
            }
            setIsDefaultCredentials(false);
            await loadTeacherData();
            setTimeout(() => setShowEditModal(false), 2000);
        } catch (err) {
            console.error('Failed to update credentials:', err);
            setEditError('Failed to save profile. Please try again.');
        } finally {
            setIsSavingProfile(false);
        }
    };

    return (
        <div className="max-w-6xl mx-auto p-4 sm:p-6 space-y-6">
            {/* Header Card */}
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl text-white flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                <div>
                    <div className="flex items-center gap-2 mb-2">
                        <span className={`px-3 py-1 text-xs font-bold rounded-full border uppercase tracking-wider ${
                            isAdmin 
                                ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30' 
                                : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                        }`}>
                            {isAdmin ? '🛡️ Administrator Portal' : 'Faculty Portal'}
                        </span>
                        <span className="text-xs text-slate-400">
                            {isAdmin ? 'Full Institution Feedback Review' : 'Authenticated Feedback Review'}
                        </span>
                    </div>
                    <h1 className="text-2xl sm:text-3xl font-black text-white">
                        {isAdmin ? 'System Administrator' : (teacherProfile?.name || currentUser.name || 'Faculty Member')}
                    </h1>
                    <div className="flex flex-wrap items-center gap-4 text-xs text-slate-300 mt-2">
                        <span>📱 Mobile: <strong className="text-emerald-400">{teacherProfile?.mobileNumber || 'Administrator Account'}</strong></span>
                        <span>👤 Username: <strong className="text-emerald-400">{teacherProfile?.username || currentUser.username}</strong></span>
                        <span>📊 Total Received: <strong className="text-emerald-400">{feedbacks.length}</strong></span>
                    </div>
                </div>

                <button
                    onClick={() => setShowEditModal(true)}
                    className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-2xl text-xs font-bold text-emerald-300 flex items-center gap-2 transition-all shrink-0"
                >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    Edit Credentials
                </button>
            </div>

            {/* Default Credentials Alert Banner – shown when still on provisioned defaults (teachers only) */}
            {!isAdmin && isDefaultCredentials && (
                <div className="bg-gradient-to-r from-rose-950/90 via-slate-900 to-slate-900 border-2 border-rose-500/60 rounded-3xl p-5 shadow-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 animate-fadeIn">
                    <div className="flex items-start gap-3">
                        <span className="text-2xl p-2 bg-rose-500/20 rounded-2xl border border-rose-500/40 shrink-0">🔐</span>
                        <div>
                            <h4 className="text-rose-300 font-black text-sm flex items-center gap-2">
                                ⚠️ Default Password Active — Action Required
                            </h4>
                            <p className="text-slate-300 text-xs mt-1 leading-relaxed">
                                Your account was provisioned with the shared default password <code className="px-1.5 py-0.5 bg-rose-900/60 text-rose-300 rounded font-mono text-[11px]">dawa@2025</code>.
                                Set your own <strong className="text-rose-300">Mobile Number</strong>, <strong className="text-rose-300">Username</strong>, and <strong className="text-rose-300">Password</strong> now to secure your account.
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={() => setShowEditModal(true)}
                        className="px-5 py-2.5 bg-rose-600 hover:bg-rose-500 text-white font-black text-xs rounded-2xl shadow-lg transition-all shrink-0 w-full sm:w-auto animate-pulse"
                    >
                        🔒 Set Personal Credentials Now
                    </button>
                </div>
            )}

            {/* First Time Setup Alert – when no mobile/profile exists but not default creds (teachers only) */}
            {!isAdmin && !isDefaultCredentials && (!teacherProfile || !teacherProfile.mobileNumber) && (
                <div className="bg-gradient-to-r from-amber-950/80 to-slate-900 border border-amber-500/40 rounded-3xl p-5 shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 animate-fadeIn">
                    <div className="flex items-start gap-3">
                        <span className="text-2xl p-2 bg-amber-500/20 rounded-2xl border border-amber-500/30">📌</span>
                        <div>
                            <h4 className="text-amber-300 font-bold text-sm">First-Time Setup Required</h4>
                            <p className="text-slate-300 text-xs mt-0.5">
                                Set your personal <strong className="text-amber-400">Mobile Number</strong>, <strong className="text-amber-400">Username</strong>, and <strong className="text-amber-400">Password</strong> so you can log in directly anytime.
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={() => setShowEditModal(true)}
                        className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-2xl shadow-lg transition-all shrink-0 w-full sm:w-auto"
                    >
                        Configure Login Credentials Now →
                    </button>
                </div>
            )}

            {/* Class-wise Received Feedback Count Summary */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 shadow-xl">
                <h3 className="text-xs font-bold text-slate-300 uppercase tracking-widest mb-3 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                    Class-Wise Received Feedback Counts
                </h3>
                <div className="flex flex-wrap gap-3">
                    {Object.keys(classCounts).length > 0 ? (
                        Object.entries(classCounts).map(([cls, count]) => (
                            <div key={cls} className="bg-slate-800 border border-slate-700/80 rounded-2xl px-4 py-2.5 flex items-center gap-3">
                                <span className="text-xs font-bold text-slate-200">{cls}</span>
                                <span className="px-2.5 py-0.5 bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-xs font-black rounded-lg">
                                    {count} {count === 1 ? 'feedback' : 'feedbacks'}
                                </span>
                            </div>
                        ))
                    ) : (
                        <p className="text-xs text-slate-400 italic">No feedback entries recorded yet for this selection.</p>
                    )}
                </div>
            </div>

            {/* Filters Bar */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex flex-wrap items-center gap-4 w-full sm:w-auto">
                    {isAdmin && (
                        <div>
                            <label className="block text-[10px] font-bold text-cyan-400 uppercase tracking-wider mb-1">Faculty Member</label>
                            <select
                                value={selectedTeacherFilter}
                                onChange={e => setSelectedTeacherFilter(e.target.value)}
                                className="bg-slate-800 border border-cyan-500/50 rounded-xl px-3 py-1.5 text-xs text-cyan-300 font-bold focus:outline-none focus:border-cyan-400"
                            >
                                {teacherFilterOptions.map(t => (
                                    <option key={t} value={t}>{t}</option>
                                ))}
                            </select>
                        </div>
                    )}

                    <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Semester</label>
                        <select
                            value={selectedSemester}
                            onChange={e => setSelectedSemester(e.target.value)}
                            className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                        >
                            {semesterOptions.map(sem => (
                                <option key={sem} value={sem}>{sem}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Class</label>
                        <select
                            value={selectedClass}
                            onChange={e => setSelectedClass(e.target.value)}
                            className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                        >
                            {classOptions.map(cls => (
                                <option key={cls} value={cls}>{cls}</option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="text-xs font-bold text-slate-400">
                    Showing <span className="text-emerald-400">{filteredFeedbacks.length}</span> of {feedbacks.length} entries
                </div>
            </div>

            {/* Feedback Cards List */}
            {isLoading ? (
                <div className="py-12 text-center text-slate-400 text-sm animate-pulse">
                    Loading student feedback records...
                </div>
            ) : filteredFeedbacks.length === 0 ? (
                <div className="bg-slate-900/50 border border-slate-800 rounded-3xl p-12 text-center space-y-3">
                    <span className="text-4xl">📬</span>
                    <h3 className="text-white font-bold text-base">No Feedback Entries Found</h3>
                    <p className="text-slate-400 text-xs max-w-sm mx-auto">
                        Student feedback for selected filters will appear here automatically once submitted.
                    </p>
                </div>
            ) : (
                <div className="space-y-6">
                    {filteredFeedbacks.map((fb, idx) => (
                        <div key={fb.id || idx} className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4 hover:border-slate-700 transition-all">
                            {/* Feedback Header */}
                            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
                                <div className="flex items-center gap-3">
                                    <span className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-400 font-bold text-xs flex items-center justify-center">
                                        #{idx + 1}
                                    </span>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <span className="font-bold text-white text-sm">{fb.className}</span>
                                            <span className="text-xs text-slate-400">•</span>
                                            <span className="text-xs font-medium text-emerald-400">{fb.semester}</span>
                                        </div>
                                        <div className="text-[11px] text-slate-400 mt-0.5">
                                            {fb.isAnonymous ? (
                                                <span className="inline-flex items-center gap-1 text-emerald-400 font-bold">
                                                    🛡️ Anonymous Student (Hidden)
                                                </span>
                                            ) : (
                                                <span>👤 {fb.studentName || 'Student'} {fb.studentAdNo ? `(Ad: ${fb.studentAdNo})` : ''}</span>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-3">
                                    <div className="flex items-center gap-2 bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-700">
                                        <span className="text-amber-400 text-sm font-bold">★ {fb.overallRating || 5} / 5</span>
                                        <span className="text-[10px] text-slate-400">({new Date(fb.createdAt).toLocaleDateString()})</span>
                                    </div>
                                    <button
                                        onClick={() => handleDeleteFeedback(fb.id)}
                                        className="px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm"
                                        title="Delete Feedback Entry"
                                    >
                                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                        </svg>
                                        Delete
                                    </button>
                                </div>
                            </div>

                            {/* Open Category Reflections */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {fb.responses?.teachingLearning && (
                                    <div className="bg-slate-800/50 p-4 rounded-2xl border border-slate-700/60">
                                        <h5 className="text-xs font-bold text-emerald-400 mb-1">📚 Teaching & Learning</h5>
                                        <p className="text-xs text-slate-200 leading-relaxed">{fb.responses.teachingLearning}</p>
                                    </div>
                                )}

                                {fb.responses?.spiritualMoral && (
                                    <div className="bg-slate-800/50 p-4 rounded-2xl border border-slate-700/60">
                                        <h5 className="text-xs font-bold text-emerald-400 mb-1">🕌 Spiritual & Moral Influence</h5>
                                        <p className="text-xs text-slate-200 leading-relaxed">{fb.responses.spiritualMoral}</p>
                                    </div>
                                )}

                                {fb.responses?.residentialCommunity && (
                                    <div className="bg-slate-800/50 p-4 rounded-2xl border border-slate-700/60">
                                        <h5 className="text-xs font-bold text-emerald-400 mb-1">🏠 Residential & Community Presence</h5>
                                        <p className="text-xs text-slate-200 leading-relaxed">{fb.responses.residentialCommunity}</p>
                                    </div>
                                )}

                                {fb.responses?.communication && (
                                    <div className="bg-slate-800/50 p-4 rounded-2xl border border-slate-700/60">
                                        <h5 className="text-xs font-bold text-emerald-400 mb-1">💬 Communication</h5>
                                        <p className="text-xs text-slate-200 leading-relaxed">{fb.responses.communication}</p>
                                    </div>
                                )}

                                {fb.responses?.studentDevelopment && (
                                    <div className="bg-slate-800/50 p-4 rounded-2xl border border-slate-700/60">
                                        <h5 className="text-xs font-bold text-emerald-400 mb-1">🌱 Student Development</h5>
                                        <p className="text-xs text-slate-200 leading-relaxed">{fb.responses.studentDevelopment}</p>
                                    </div>
                                )}

                                {fb.responses?.professionalConduct && (
                                    <div className="bg-slate-800/50 p-4 rounded-2xl border border-slate-700/60">
                                        <h5 className="text-xs font-bold text-emerald-400 mb-1">⚖️ Professional Conduct</h5>
                                        <p className="text-xs text-slate-200 leading-relaxed">{fb.responses.professionalConduct}</p>
                                    </div>
                                )}
                            </div>

                            {/* Open Reflection Questions */}
                            <div className="space-y-3 pt-2">
                                {fb.responses?.strengths && (
                                    <div className="bg-emerald-950/30 border border-emerald-500/30 p-4 rounded-2xl">
                                        <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest block mb-1">✨ Strengths & Exemplary Practices</span>
                                        <p className="text-xs text-slate-100">{fb.responses.strengths}</p>
                                    </div>
                                )}

                                {fb.responses?.continueDoing && (
                                    <div className="bg-slate-800/70 border border-slate-700 p-4 rounded-2xl">
                                        <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest block mb-1">🔄 Positive Practices to Continue</span>
                                        <p className="text-xs text-slate-100">{fb.responses.continueDoing}</p>
                                    </div>
                                )}

                                {fb.responses?.improvements && (
                                    <div className="bg-amber-950/30 border border-amber-500/30 p-4 rounded-2xl">
                                        <span className="text-[10px] font-bold text-amber-400 uppercase tracking-widest block mb-1">🎯 Constructive Suggestions for Growth</span>
                                        <p className="text-xs text-slate-100">{fb.responses.improvements}</p>
                                    </div>
                                )}

                                {fb.responses?.positiveExperience && (
                                    <div className="bg-teal-950/30 border border-teal-500/30 p-4 rounded-2xl">
                                        <span className="text-[10px] font-bold text-teal-400 uppercase tracking-widest block mb-1">❤️ Memorable Positive Experience</span>
                                        <p className="text-xs text-slate-100">{fb.responses.positiveExperience}</p>
                                    </div>
                                )}

                                {fb.responses?.bridgingDisconnection && (
                                    <div className="bg-indigo-950/30 border border-indigo-500/30 p-4 rounded-2xl">
                                        <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest block mb-1">🤝 Bridging Connection & Extra Support</span>
                                        <p className="text-xs text-slate-100">{fb.responses.bridgingDisconnection}</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Edit Credentials Modal */}
            {showEditModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
                    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                            <div>
                                <h3 className="text-lg font-bold text-white">
                                    {isDefaultCredentials ? '🔐 Set Your Personal Credentials' : 'Edit Mobile & Login Credentials'}
                                </h3>
                                {isDefaultCredentials && (
                                    <p className="text-rose-400 text-xs mt-0.5 font-medium">Required — default password must be changed</p>
                                )}
                            </div>
                            {/* Only allow closing if NOT on default credentials */}
                            {!isDefaultCredentials && (
                                <button onClick={() => setShowEditModal(false)} className="text-slate-400 hover:text-white text-lg font-bold">✕</button>
                            )}
                        </div>

                        {/* Default credentials warning inside modal */}
                        {isDefaultCredentials && (
                            <div className="p-4 bg-rose-950/60 border border-rose-500/40 rounded-2xl">
                                <p className="text-rose-300 text-xs leading-relaxed">
                                    🔑 You are logged in with the provisioned default password <code className="font-mono bg-rose-900/60 px-1 rounded">dawa@2025</code>.
                                    Please set your own credentials below. You cannot skip this step.
                                </p>
                            </div>
                        )}

                        {editSuccess && (
                            <div className="p-3 bg-emerald-950 border border-emerald-500 text-emerald-300 text-xs rounded-xl">
                                {editSuccess}
                            </div>
                        )}
                        {editError && (
                            <div className="p-3 bg-rose-950 border border-rose-500 text-rose-300 text-xs rounded-xl">
                                {editError}
                            </div>
                        )}

                        <form onSubmit={handleSaveProfile} className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-300 mb-1">Mobile Number <span className="text-rose-400">*</span></label>
                                <input
                                    type="text"
                                    value={editForm.mobileNumber}
                                    onChange={e => setEditForm(prev => ({ ...prev, mobileNumber: e.target.value }))}
                                    placeholder="e.g. 9876543210"
                                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-300 mb-1">Username <span className="text-rose-400">*</span></label>
                                <input
                                    type="text"
                                    value={editForm.username}
                                    onChange={e => setEditForm(prev => ({ ...prev, username: e.target.value }))}
                                    placeholder="e.g. usthad_ahmad"
                                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
                                    required
                                />
                                <p className="text-[11px] text-slate-500 mt-1">Used to log in. Lowercase, underscores allowed.</p>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-300 mb-1">
                                    {isDefaultCredentials ? 'New Password' : 'Password / PIN'} <span className="text-rose-400">*</span>
                                </label>
                                <input
                                    type="password"
                                    value={editForm.password}
                                    onChange={e => setEditForm(prev => ({ ...prev, password: e.target.value }))}
                                    placeholder={isDefaultCredentials ? 'Choose a personal password (min. 6 chars)' : 'Enter new password'}
                                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-300 mb-1">Confirm Password <span className="text-rose-400">*</span></label>
                                <input
                                    type="password"
                                    value={editForm.confirmPassword}
                                    onChange={e => setEditForm(prev => ({ ...prev, confirmPassword: e.target.value }))}
                                    placeholder="Re-enter your password"
                                    className={`w-full bg-slate-800 border rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500 ${
                                        editForm.confirmPassword && editForm.confirmPassword !== editForm.password
                                            ? 'border-rose-500'
                                            : editForm.confirmPassword && editForm.confirmPassword === editForm.password
                                            ? 'border-emerald-500'
                                            : 'border-slate-700'
                                    }`}
                                    required
                                />
                                {editForm.confirmPassword && editForm.confirmPassword !== editForm.password && (
                                    <p className="text-rose-400 text-[11px] mt-1">⚠️ Passwords do not match</p>
                                )}
                                {editForm.confirmPassword && editForm.confirmPassword === editForm.password && (
                                    <p className="text-emerald-400 text-[11px] mt-1">✓ Passwords match</p>
                                )}
                            </div>

                            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                                {!isDefaultCredentials && (
                                    <button
                                        type="button"
                                        onClick={() => setShowEditModal(false)}
                                        className="px-4 py-2 bg-slate-800 text-slate-300 text-xs font-bold rounded-xl hover:bg-slate-700"
                                    >
                                        Cancel
                                    </button>
                                )}
                                <button
                                    type="submit"
                                    disabled={isSavingProfile || (Boolean(editForm.confirmPassword) && editForm.confirmPassword !== editForm.password)}
                                    className="flex-1 sm:flex-none px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-lg transition-all"
                                >
                                    {isSavingProfile ? 'Saving...' : isDefaultCredentials ? '🔒 Save & Secure My Account' : 'Save Credentials'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TeacherFeedbackView;
