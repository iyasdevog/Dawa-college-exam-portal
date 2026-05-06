import React, { useState, useEffect, useMemo } from 'react';
import { StudentRecord, SubjectConfig, AttendanceRecord } from '../../../domain/entities/types';
import { dataService } from '../../../infrastructure/services/dataService';
import { useTerm } from '../../viewmodels/TermContext';

interface StudentAttendanceStatsProps {
    subjects: SubjectConfig[];
    students: StudentRecord[];
}

interface StudentAggregate {
    student: StudentRecord;
    average: number;
    hasAnyShortage: boolean;
    subjectCount: number;
    breakdown: Array<{
        subject: SubjectConfig;
        stat: { present: number; total: number } | undefined;
        percentage: number;
        isShortage: boolean;
    }>;
}

const StudentAttendanceStats: React.FC<StudentAttendanceStatsProps> = ({ subjects, students }) => {
    const { activeTerm } = useTerm();
    const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedClass, setSelectedClass] = useState('All');
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
    const [sortBy, setSortBy] = useState<'attendance-asc' | 'attendance-desc' | 'adno-asc'>('attendance-asc');

    const classes = useMemo(() => ['All', ...new Set(students.map(s => s.className))], [students]);

    useEffect(() => {
        const loadRecords = async () => {
            setIsLoading(true);
            try {
                const records = await dataService.getAllAttendanceRecords(activeTerm);
                setAttendanceRecords(records);
            } catch (error) {
                console.error('Error loading attendance records for stats:', error);
            } finally {
                setIsLoading(false);
            }
        };
        loadRecords();
    }, [activeTerm]);

    // Calculate raw stats per student per subject
    const statsMap = useMemo(() => {
        const studentStats: Record<string, Record<string, { present: number; total: number }>> = {};

        attendanceRecords.forEach(record => {
            const { subjectId, presentStudentIds, absentStudentIds } = record;
            
            presentStudentIds.forEach(id => {
                if (!studentStats[id]) studentStats[id] = {};
                if (!studentStats[id][subjectId]) studentStats[id][subjectId] = { present: 0, total: 0 };
                studentStats[id][subjectId].present++;
                studentStats[id][subjectId].total++;
            });

            absentStudentIds.forEach(id => {
                if (!studentStats[id]) studentStats[id] = {};
                if (!studentStats[id][subjectId]) studentStats[id][subjectId] = { present: 0, total: 0 };
                studentStats[id][subjectId].total++;
            });
        });

        return studentStats;
    }, [attendanceRecords]);

    // Calculate comprehensive aggregates for all students
    const aggregates = useMemo(() => {
        return students.map(s => {
            const studentSubjects = subjects.filter(sub => {
                const matchesClass = sub.targetClasses.includes(s.className);
                if (sub.enrolledStudents && sub.enrolledStudents.length > 0) {
                    return matchesClass && sub.enrolledStudents.includes(s.id);
                }
                return matchesClass;
            });

            let totalPresent = 0;
            let totalPossible = 0;
            let hasAnyShortage = false;

            const breakdown = studentSubjects.map(sub => {
                const stat = statsMap[s.id]?.[sub.id];
                const percentage = stat && stat.total > 0 ? Math.round((stat.present / stat.total) * 100) : 100;
                const isShortage = percentage < 75;
                if (isShortage) hasAnyShortage = true;

                totalPresent += (stat?.present || 0);
                totalPossible += (stat?.total || 0);

                return { subject: sub, stat, percentage, isShortage };
            });

            const average = totalPossible > 0 ? Math.round((totalPresent / totalPossible) * 100) : 100;

            return {
                student: s,
                average,
                hasAnyShortage,
                subjectCount: studentSubjects.length,
                breakdown
            } as StudentAggregate;
        });
    }, [students, subjects, statsMap]);

    const filteredAggregates = useMemo(() => {
        const lowerSearch = searchQuery.toLowerCase();
        let result = aggregates.filter(a => {
            const matchesClass = selectedClass === 'All' || a.student.className === selectedClass;
            const matchesSearch = !searchQuery || 
                                 a.student.name.toLowerCase().includes(lowerSearch) || 
                                 a.student.adNo.toLowerCase().includes(lowerSearch);
            return matchesClass && matchesSearch;
        });

        // Apply Sorting
        return result.sort((a, b) => {
            if (sortBy === 'attendance-asc') {
                return a.average - b.average || a.student.adNo.localeCompare(b.student.adNo);
            } else if (sortBy === 'attendance-desc') {
                return b.average - a.average || a.student.adNo.localeCompare(b.student.adNo);
            } else {
                return a.student.adNo.localeCompare(b.student.adNo);
            }
        });
    }, [aggregates, selectedClass, searchQuery, sortBy]);

    // Extract watchlist data
    const averageWatchlist = useMemo(() => 
        aggregates.filter(a => a.average < 75).sort((a, b) => a.average - b.average), 
    [aggregates]);

    const subjectShortages = useMemo(() => {
        const list: Array<{ studentName: string; subjectName: string; percentage: number; className: string }> = [];
        aggregates.forEach(a => {
            a.breakdown.forEach(b => {
                if (b.isShortage) {
                    list.push({
                        studentName: a.student.name,
                        subjectName: b.subject.name,
                        percentage: b.percentage,
                        className: a.student.className
                    });
                }
            });
        });
        return list.sort((a, b) => a.percentage - b.percentage);
    }, [aggregates]);

    const viewingAggregate = useMemo(() => 
        aggregates.find(a => a.student.id === selectedStudentId), 
    [aggregates, selectedStudentId]);

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center py-24">
                <div className="w-16 h-16 border-4 border-slate-200 border-t-slate-900 rounded-full animate-spin mb-4"></div>
                <p className="text-slate-500 font-black text-xs uppercase tracking-widest animate-pulse">Calculating Multi-tier Analytics...</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col lg:flex-row gap-8">
            {/* Main Stats Summary Table */}
            <div className="flex-1 space-y-6">
                <div className="bg-white p-6 rounded-[2.5rem] border border-slate-200 shadow-sm space-y-6">
                    <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                        <div>
                            <h2 className="text-xl font-black text-slate-900 tracking-tight">Active Student Pulse</h2>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-0.5">Aggregate Attendance Monitoring</p>
                        </div>
                        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                            <div className="relative flex-1 md:w-48">
                                <i className="fa-solid fa-search absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"></i>
                                <input 
                                    type="text" 
                                    placeholder="Search student..." 
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:ring-4 focus:ring-slate-900/10 outline-none transition-all"
                                />
                            </div>
                            <select
                                value={sortBy}
                                onChange={(e) => setSortBy(e.target.value as any)}
                                className="px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-[10px] font-black uppercase tracking-widest outline-none"
                            >
                                <option value="attendance-asc">Attendance (Low First)</option>
                                <option value="attendance-desc">Attendance (High First)</option>
                                <option value="adno-asc">Admission Number</option>
                            </select>
                            <select
                                value={selectedClass}
                                onChange={(e) => setSelectedClass(e.target.value)}
                                className="px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-[10px] font-black uppercase tracking-widest outline-none"
                            >
                                {classes.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </div>
                    </div>

                    <div className="overflow-x-auto rounded-[2rem] border border-slate-100">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-50/50">
                                    <th className="p-6 text-[10px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-100">Student Profile</th>
                                    <th className="p-6 text-[10px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-100 text-center">Avg. Percentage</th>
                                    <th className="p-6 text-[10px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-100 text-center">Risk Status</th>
                                    <th className="p-6 text-[10px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-100 text-right">View Stats</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {filteredAggregates.length === 0 ? (
                                    <tr>
                                        <td colSpan={4} className="p-20 text-center text-slate-400 font-bold">No records found.</td>
                                    </tr>
                                ) : (
                                    filteredAggregates.map(agg => (
                                        <tr key={agg.student.id} className="hover:bg-slate-50/40 transition-colors group">
                                            <td className="p-6">
                                                <div className="flex items-center gap-4">
                                                    <div className={`w-11 h-11 rounded-xl flex items-center justify-center font-black text-xs shadow-sm ${agg.average < 75 ? 'bg-rose-100 text-rose-600' : 'bg-slate-900 text-white'}`}>
                                                        {agg.student.name.charAt(0)}
                                                    </div>
                                                    <div>
                                                        <div className="font-black text-slate-800 tracking-tight">{agg.student.name}</div>
                                                        <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-0.5">{agg.student.adNo} • {agg.student.className}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="p-6 text-center">
                                                <div className="flex flex-col items-center gap-1.5">
                                                    <span className={`text-xl font-black ${agg.average < 75 ? 'text-rose-600' : 'text-slate-900'}`}>{agg.average}%</span>
                                                    <div className="w-20 h-1.5 bg-slate-100 rounded-full overflow-hidden border border-slate-200/50">
                                                        <div className={`h-full transition-all duration-1000 ${agg.average < 75 ? 'bg-rose-500' : 'bg-emerald-500'}`} style={{ width: `${agg.average}%` }} />
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="p-6 text-center">
                                                {agg.hasAnyShortage ? (
                                                    <span className="px-3 py-1.5 bg-rose-50 text-rose-600 border border-rose-100 rounded-xl text-[9px] font-black uppercase tracking-widest">
                                                        <i className="fa-solid fa-triangle-exclamation mr-1"></i> Critical
                                                    </span>
                                                ) : (
                                                    <span className="px-3 py-1.5 bg-emerald-50 text-emerald-600 border border-emerald-100 rounded-xl text-[9px] font-black uppercase tracking-widest">
                                                        <i className="fa-solid fa-check-double mr-1"></i> Stable
                                                    </span>
                                                )}
                                            </td>
                                            <td className="p-6 text-right">
                                                <button 
                                                    onClick={() => setSelectedStudentId(agg.student.id)}
                                                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-900 hover:text-white hover:border-slate-900 transition-all shadow-sm group/btn"
                                                >
                                                    Full Breakdown
                                                    <i className="fa-solid fa-chevron-right text-[8px] group-hover:translate-x-1 transition-transform"></i>
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Dual Watchlist Sidebar */}
            <div className="lg:w-96 space-y-6">
                {/* 1. Low Average Watchlist (Primary) */}
                <div className="bg-slate-900 p-8 rounded-[3rem] text-white shadow-2xl relative overflow-hidden group">
                    <div className="relative z-10 space-y-6">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center text-white text-lg border border-white/20">
                                    <i className="fa-solid fa-percent"></i>
                                </div>
                                <div>
                                    <h3 className="text-lg font-black tracking-tight">Average Risk</h3>
                                    <p className="text-[10px] font-black text-rose-400 uppercase tracking-widest">Overall &lt; 75%</p>
                                </div>
                            </div>
                            <span className="text-2xl font-black text-white/20">{averageWatchlist.length}</span>
                        </div>
                        
                        <div className="space-y-3">
                            {averageWatchlist.length === 0 ? (
                                <div className="py-8 text-center text-white/30 font-bold text-xs border border-white/5 rounded-[2rem] bg-white/5">No global risks detected.</div>
                            ) : (
                                averageWatchlist.slice(0, 5).map((agg, idx) => (
                                    <div key={idx} className="bg-white/10 backdrop-blur-sm p-4 rounded-2xl border border-white/10 flex justify-between items-center group/item hover:bg-white/20 transition-all">
                                        <div className="min-w-0 pr-2">
                                            <div className="font-black text-[11px] leading-tight text-white/90">{agg.student.name}</div>
                                            <div className="text-[8px] font-bold text-white/40 uppercase mt-0.5">{agg.student.className}</div>
                                        </div>
                                        <div className="text-lg font-black text-rose-400 shrink-0">{agg.average}%</div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                    <i className="fa-solid fa-shield-halved absolute -right-10 -bottom-10 text-[10rem] text-white/5 pointer-events-none group-hover:scale-110 transition-transform"></i>
                </div>

                {/* 2. Subject Shortage Watchlist */}
                <div className="bg-rose-50/50 p-8 rounded-[3rem] border border-rose-100 shadow-sm relative overflow-hidden">
                    <div className="relative z-10 space-y-6">
                        <div className="flex items-center justify-between">
                            <h3 className="text-sm font-black text-rose-900 uppercase tracking-widest flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse"></span>
                                Subject Shortages
                            </h3>
                            <span className="text-xs font-black text-rose-400 uppercase tracking-widest">{subjectShortages.length} Cases</span>
                        </div>
                        
                        <div className="space-y-4 max-h-[400px] overflow-y-auto no-scrollbar pr-1">
                            {subjectShortages.length === 0 ? (
                                <div className="py-10 text-center text-rose-300 font-bold text-xs">All individual subjects clear.</div>
                            ) : (
                                subjectShortages.slice(0, 15).map((item, idx) => (
                                    <div key={idx} className="bg-white p-4 rounded-[1.5rem] border border-rose-100 shadow-sm hover:translate-x-2 transition-all">
                                        <div className="flex justify-between items-start gap-3">
                                            <div className="min-w-0">
                                                <div className="font-black text-slate-800 text-[11px] leading-tight">{item.studentName}</div>
                                                <div className="text-[8px] font-bold text-rose-500 uppercase mt-0.5">{item.subjectName}</div>
                                            </div>
                                            <div className="text-xs font-black text-rose-600 shrink-0">{item.percentage}%</div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Tabular Breakdown Modal */}
            {selectedStudentId && viewingAggregate && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300">
                    <div className="bg-white w-full max-w-5xl max-h-[90vh] rounded-[3.5rem] shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-300 border border-slate-200">
                        <div className="p-10 bg-slate-50 border-b border-slate-200 flex justify-between items-center shrink-0">
                            <div className="flex items-center gap-6">
                                <div className={`w-20 h-20 rounded-3xl flex items-center justify-center text-3xl font-black shadow-xl shrink-0 ${viewingAggregate.average < 75 ? 'bg-rose-100 text-rose-600' : 'bg-slate-900 text-white'}`}>
                                    {viewingAggregate.student.name.charAt(0)}
                                </div>
                                <div>
                                    <h3 className="text-3xl font-black text-slate-900 tracking-tighter">{viewingAggregate.student.name}</h3>
                                    <div className="flex items-center gap-3 mt-1.5">
                                        <span className="px-3 py-1 bg-slate-200 text-slate-700 rounded-lg text-[10px] font-black uppercase tracking-[0.1em] border border-slate-300">{viewingAggregate.student.adNo}</span>
                                        <span className="w-1.5 h-1.5 rounded-full bg-slate-300"></span>
                                        <span className="px-3 py-1 bg-emerald-100 text-emerald-700 rounded-lg text-[10px] font-black uppercase tracking-[0.1em] border border-emerald-200">{viewingAggregate.student.className}</span>
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center gap-8">
                                <div className="text-right">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Semester Avg</p>
                                    <p className={`text-4xl font-black ${viewingAggregate.average < 75 ? 'text-rose-600' : 'text-slate-900'}`}>{viewingAggregate.average}%</p>
                                </div>
                                <button 
                                    onClick={() => setSelectedStudentId(null)}
                                    className="w-14 h-14 rounded-[1.5rem] bg-white border border-slate-200 shadow-sm flex items-center justify-center text-slate-400 hover:text-slate-900 hover:border-slate-900 transition-all active:scale-95"
                                >
                                    <i className="fa-solid fa-xmark text-2xl"></i>
                                </button>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto p-10 no-scrollbar bg-white">
                            <div className="flex items-center justify-between mb-8">
                                <h4 className="text-xs font-black text-slate-900 uppercase tracking-[0.2em] flex items-center gap-3">
                                    <span className="w-3 h-3 rounded-full bg-emerald-500 shadow-lg shadow-emerald-500/20"></span>
                                    Detailed Course Breakdown
                                </h4>
                                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                    Displaying {viewingAggregate.subjectCount} Enrolled Courses
                                </div>
                            </div>
                            
                            <div className="rounded-[2.5rem] border border-slate-200 overflow-hidden shadow-sm bg-white">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-slate-50/80">
                                            <th className="p-6 text-[10px] font-black uppercase tracking-widest text-slate-500 border-b border-slate-100">Subject Name</th>
                                            <th className="p-6 text-[10px] font-black uppercase tracking-widest text-slate-500 border-b border-slate-100 text-center">Enrolled Type</th>
                                            <th className="p-6 text-[10px] font-black uppercase tracking-widest text-slate-500 border-b border-slate-100 text-center">Presence (Count)</th>
                                            <th className="p-6 text-[10px] font-black uppercase tracking-widest text-slate-500 border-b border-slate-100 text-center">Score (%)</th>
                                            <th className="p-6 text-[10px] font-black uppercase tracking-widest text-slate-500 border-b border-slate-100 text-right">Audit Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50">
                                        {viewingAggregate.breakdown.map((item, idx) => (
                                            <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                                                <td className="p-6">
                                                    <div className="font-black text-slate-800 text-base">{item.subject.name}</div>
                                                    {item.subject.arabicName && <div className="text-xs text-slate-400 font-bold font-arabic mt-0.5">{item.subject.arabicName}</div>}
                                                </td>
                                                <td className="p-6 text-center">
                                                    <span className="text-[9px] font-black text-slate-400 uppercase px-3 py-1 bg-slate-100 rounded-lg border border-slate-200 tracking-tighter">
                                                        {item.subject.subjectType}
                                                    </span>
                                                </td>
                                                <td className="p-6 text-center">
                                                    <div className="text-sm font-black text-slate-700">{item.stat?.present || 0} <span className="text-slate-300 font-bold mx-1">/</span> {item.stat?.total || 0}</div>
                                                </td>
                                                <td className="p-6 text-center">
                                                    <div className="flex items-center justify-center gap-4">
                                                        <div className="w-20 h-2 bg-slate-100 rounded-full overflow-hidden shrink-0 shadow-inner">
                                                            <div 
                                                                className={`h-full transition-all duration-1000 ${item.isShortage ? 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.4)]' : 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]'}`}
                                                                style={{ width: `${item.percentage}%` }}
                                                            />
                                                        </div>
                                                        <span className={`text-base font-black w-10 text-right ${item.isShortage ? 'text-rose-600' : 'text-slate-800'}`}>{item.percentage}%</span>
                                                    </div>
                                                </td>
                                                <td className="p-6 text-right">
                                                    <span className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-sm border ${
                                                        item.isShortage 
                                                            ? 'bg-rose-50 text-rose-600 border-rose-200' 
                                                            : 'bg-emerald-50 text-emerald-600 border-emerald-200'
                                                    }`}>
                                                        {item.isShortage ? (
                                                            <><i className="fa-solid fa-circle-xmark"></i> Shortage</>
                                                        ) : (
                                                            <><i className="fa-solid fa-circle-check"></i> Satisfactory</>
                                                        )}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <div className="p-10 bg-slate-50 border-t border-slate-200 shrink-0 flex justify-between items-center text-[10px] text-slate-400 font-black uppercase tracking-[0.2em] px-12">
                            <div className="flex items-center gap-4">
                                <span>Report ID: {activeTerm?.replace(/-/g, '')}{viewingAggregate.student.adNo}</span>
                                <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                                <span>Academic Year: {activeTerm?.split('-')[0]}</span>
                            </div>
                            <div className="text-slate-300">Dawa Official Examination Portal &bull; System Verified</div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default StudentAttendanceStats;
