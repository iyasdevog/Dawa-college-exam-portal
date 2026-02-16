import React, { useMemo, useState, useEffect } from 'react';
import { DouraSubmission } from '../../domain/entities/types';
import { CLASSES } from '../../domain/entities/constants';
import { dataService } from '../../infrastructure/services/dataService';

interface DouraReportsProps {
    className?: string;
}

export const DouraReports: React.FC<DouraReportsProps> = ({ className }) => {
    const [allSubmissions, setAllSubmissions] = useState<DouraSubmission[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'class' | 'student'>('class');
    const [selectedClass, setSelectedClass] = useState<string>('all');

    useEffect(() => {
        const loadData = async () => {
            setLoading(true);
            try {
                // Fetch all approved submissions for reports
                const data = await dataService.getAllDouraSubmissions(undefined, 'Approved');
                setAllSubmissions(data);
            } catch (error) {
                console.error('Error loading report data:', error);
            } finally {
                setLoading(false);
            }
        };
        loadData();
    }, []);

    // Aggregate Data
    const classStats = useMemo(() => {
        const stats: Record<string, { totalJuz: number; totalPages: number; studentCount: Set<string>; submissionCount: number }> = {};

        CLASSES.forEach(cls => {
            stats[cls] = { totalJuz: 0, totalPages: 0, studentCount: new Set(), submissionCount: 0 };
        });

        allSubmissions.forEach(sub => {
            if (!stats[sub.className]) {
                stats[sub.className] = { totalJuz: 0, totalPages: 0, studentCount: new Set(), submissionCount: 0 };
            }
            const juzCount = Math.max(0, sub.juzEnd - sub.juzStart + 1);
            const pageCount = Math.max(0, sub.pageEnd - sub.pageStart + 1);

            stats[sub.className].totalJuz += juzCount;
            stats[sub.className].totalPages += pageCount;
            stats[sub.className].studentCount.add(sub.studentAdNo);
            stats[sub.className].submissionCount += 1;
        });

        return Object.entries(stats).map(([cls, data]) => ({
            className: cls,
            totalJuz: data.totalJuz,
            totalPages: data.totalPages,
            studentCount: data.studentCount.size,
            submissionCount: data.submissionCount,
            averageJuzPerStudent: data.studentCount.size > 0 ? (data.totalJuz / data.studentCount.size).toFixed(1) : '0'
        })).sort((a, b) => b.totalJuz - a.totalJuz); // Sort by total juz descending
    }, [allSubmissions]);

    const studentStats = useMemo(() => {
        const stats: Record<string, { name: string; className: string; totalJuz: number; totalPages: number; lastSubmission: string }> = {};

        allSubmissions.forEach(sub => {
            const key = sub.studentAdNo;
            if (!stats[key]) {
                stats[key] = {
                    name: sub.studentName,
                    className: sub.className,
                    totalJuz: 0,
                    totalPages: 0,
                    lastSubmission: sub.recitationDate
                };
            }

            const juzCount = Math.max(0, sub.juzEnd - sub.juzStart + 1);
            const pageCount = Math.max(0, sub.pageEnd - sub.pageStart + 1);

            stats[key].totalJuz += juzCount;
            stats[key].totalPages += pageCount;
            if (new Date(sub.recitationDate) > new Date(stats[key].lastSubmission)) {
                stats[key].lastSubmission = sub.recitationDate;
            }
        });

        let result = Object.values(stats);
        if (selectedClass !== 'all') {
            result = result.filter(s => s.className === selectedClass);
        }

        return result.sort((a, b) => b.totalJuz - a.totalJuz);
    }, [allSubmissions, selectedClass]);

    if (loading) {
        return (
            <div className="p-12 text-center text-slate-500">
                <div className="w-8 h-8 border-4 border-slate-200 border-t-emerald-500 rounded-full animate-spin mx-auto mb-4"></div>
                <p className="font-bold">Generating reports...</p>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Tabs */}
            <div className="flex p-1 bg-slate-100 rounded-xl w-fit">
                <button
                    onClick={() => setActiveTab('class')}
                    className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'class' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                        }`}
                >
                    Class Performance
                </button>
                <button
                    onClick={() => setActiveTab('student')}
                    className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'student' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                        }`}
                >
                    Student Progress
                </button>
            </div>

            {/* Content */}
            {activeTab === 'class' ? (
                <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl p-6 text-white shadow-lg shadow-emerald-500/20">
                            <div className="text-emerald-100 text-xs font-bold uppercase tracking-widest mb-1">Top Performing Class</div>
                            <div className="text-3xl font-black">{classStats[0]?.className || 'N/A'}</div>
                            <div className="mt-2 text-emerald-100 text-sm font-bold">
                                {classStats[0]?.totalJuz || 0} Juz Completed
                            </div>
                        </div>
                        <div className="bg-white rounded-2xl p-6 border-2 border-slate-200 shadow-sm">
                            <div className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-1">Total Juz (All Classes)</div>
                            <div className="text-3xl font-black text-slate-800">
                                {classStats.reduce((acc, curr) => acc + curr.totalJuz, 0)}
                            </div>
                        </div>
                        <div className="bg-white rounded-2xl p-6 border-2 border-slate-200 shadow-sm">
                            <div className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-1">Active Students</div>
                            <div className="text-3xl font-black text-slate-800">
                                {classStats.reduce((acc, curr) => acc + curr.studentCount, 0)}
                            </div>
                        </div>
                    </div>

                    <div className="bg-white rounded-2xl shadow-xl border-2 border-slate-200 overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-slate-50 border-b border-slate-200">
                                        <th className="px-6 py-4 font-black uppercase tracking-widest text-[10px] text-slate-500">Class</th>
                                        <th className="px-6 py-4 font-black uppercase tracking-widest text-[10px] text-slate-500 text-center">Total Juz</th>
                                        <th className="px-6 py-4 font-black uppercase tracking-widest text-[10px] text-slate-500 text-center">Total Pages</th>
                                        <th className="px-6 py-4 font-black uppercase tracking-widest text-[10px] text-slate-500 text-center">Avg Juz/Student</th>
                                        <th className="px-6 py-4 font-black uppercase tracking-widest text-[10px] text-slate-500 text-right">Active Students</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {classStats.map((stat) => (
                                        <tr key={stat.className} className="hover:bg-slate-50 transition-colors">
                                            <td className="px-6 py-4">
                                                <div className="font-black text-slate-900">{stat.className}</div>
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <span className="bg-emerald-100 text-emerald-700 px-2 py-1 rounded text-xs font-black">
                                                    {stat.totalJuz}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <span className="text-sm font-bold text-slate-600">{stat.totalPages}</span>
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <span className="text-sm font-bold text-slate-600">{stat.averageJuzPerStudent}</span>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <span className="text-sm font-bold text-slate-600">{stat.studentCount}</span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="space-y-6">
                    {/* Class Filter */}
                    <div className="bg-white rounded-2xl p-4 shadow-sm border-2 border-slate-200 flex items-center gap-4">
                        <label className="text-sm font-bold text-slate-700 whitespace-nowrap">Filter by Class:</label>
                        <select
                            value={selectedClass}
                            onChange={(e) => setSelectedClass(e.target.value)}
                            className="p-2 border-2 border-slate-300 rounded-lg focus:ring-4 focus:ring-emerald-500/40 focus:border-emerald-500 bg-white"
                        >
                            <option value="all">All Classes</option>
                            {CLASSES.map(cls => (
                                <option key={cls} value={cls}>{cls}</option>
                            ))}
                        </select>
                    </div>

                    <div className="bg-white rounded-2xl shadow-xl border-2 border-slate-200 overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-slate-50 border-b border-slate-200">
                                        <th className="px-6 py-4 font-black uppercase tracking-widest text-[10px] text-slate-500">Student Name</th>
                                        <th className="px-6 py-4 font-black uppercase tracking-widest text-[10px] text-slate-500">Class</th>
                                        <th className="px-6 py-4 font-black uppercase tracking-widest text-[10px] text-slate-500 text-center">Total Juz</th>
                                        <th className="px-6 py-4 font-black uppercase tracking-widest text-[10px] text-slate-500 text-center">Total Pages</th>
                                        <th className="px-6 py-4 font-black uppercase tracking-widest text-[10px] text-slate-500 text-right">Last Active</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {studentStats.map((stat, idx) => (
                                        <tr key={idx} className="hover:bg-slate-50 transition-colors">
                                            <td className="px-6 py-4">
                                                <div className="font-black text-slate-900">{stat.name}</div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className="bg-slate-100 px-2 py-1 rounded text-xs font-bold text-slate-600">
                                                    {stat.className}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded text-xs font-black">
                                                    {stat.totalJuz}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <span className="text-sm font-bold text-slate-600">{stat.totalPages}</span>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="text-xs font-bold text-slate-500">
                                                    {new Date(stat.lastSubmission).toLocaleDateString()}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                    {studentStats.length === 0 && (
                                        <tr>
                                            <td colSpan={5} className="px-6 py-12 text-center text-slate-400 font-bold">
                                                No student data found
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
