import React, { useState, useEffect, useMemo } from 'react';
import type { StudentFeedback } from '../../../domain/entities/types';
import { SYSTEM_CLASSES } from '../../../domain/entities/constants';
import { dataService } from '../../../infrastructure/services/dataService';

export const AdminFeedbackManagement: React.FC = () => {
    const [feedbacks, setFeedbacks] = useState<StudentFeedback[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(true);

    // Filters for feedback
    const [filterSemester, setFilterSemester] = useState<string>('All');
    const [filterClass, setFilterClass] = useState<string>('All');
    const [filterTeacher, setFilterTeacher] = useState<string>('All');
    const [filterAnonymity, setFilterAnonymity] = useState<'All' | 'Anonymous' | 'Named'>('All');
    const [searchKeyword, setSearchKeyword] = useState<string>('');
    const [isClassCountsExpanded, setIsClassCountsExpanded] = useState<boolean>(false);

    const loadData = async () => {
        setIsLoading(true);
        try {
            await dataService.syncLocalFeedbackToFirestore().catch(() => {});
            const fbList = await dataService.getAllFeedback();
            setFeedbacks(fbList);
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
        return ['All', ...Array.from(set).sort()];
    }, [feedbacks]);

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

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-slate-900/90 border border-slate-800 p-4 rounded-3xl">
                <div>
                    <h2 className="text-xl font-black text-white flex items-center gap-2">
                        💬 Student Feedback Reports & Reflections
                    </h2>
                    <p className="text-slate-400 text-xs mt-0.5">
                        Review continuous student feedback, ratings, and open-ended reflections across classes.
                    </p>
                </div>
            </div>

            {/* FEEDBACK REPORTS BODY */}
            <div className="space-y-6">
                {/* Class-wise Received Feedback Counts Summary – Collapsible & Compact */}
                <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl">
                    <button
                        type="button"
                        onClick={() => setIsClassCountsExpanded(!isClassCountsExpanded)}
                        className="w-full flex items-center justify-between text-left focus:outline-none group"
                    >
                        <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                            <span className="text-xs font-bold text-slate-300 uppercase tracking-widest">
                                Class-Wise Received Feedback Counts
                            </span>
                            <span className="px-2.5 py-0.5 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[10px] font-black rounded-full">
                                Total: {feedbacks.length} Entries
                            </span>
                        </div>
                        <div className="flex items-center gap-1 text-[11px] font-bold text-slate-400 group-hover:text-emerald-400 transition-colors">
                            <span>{isClassCountsExpanded ? 'Hide' : 'Show'} ({SYSTEM_CLASSES.length})</span>
                            <svg className={`w-3.5 h-3.5 transform transition-transform duration-200 ${isClassCountsExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                        </div>
                    </button>

                    {isClassCountsExpanded && (
                        <div className="mt-3 flex flex-wrap gap-2 animate-fadeIn">
                            {SYSTEM_CLASSES.map(cls => {
                                const count = classCounts[cls] || 0;
                                return (
                                    <div key={cls} className="bg-slate-800/90 border border-slate-700/80 rounded-xl px-3 py-1.5 flex items-center gap-2 text-xs">
                                        <span className="font-bold text-slate-300">{cls}:</span>
                                        <span className={`px-2 py-0.5 text-xs font-black rounded-md ${count > 0 ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-slate-700 text-slate-500'}`}>
                                            {count}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    )}
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
        </div>
    );
};

export default AdminFeedbackManagement;
