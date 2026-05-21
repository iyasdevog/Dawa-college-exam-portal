import React, { useMemo, useState } from 'react';
import { StudentRecord, SubjectConfig, AttendanceRecord } from '../../../domain/entities/types';
import { useMobile } from '../../hooks/useMobile';

interface PrincipalMonitorProps {
    students: StudentRecord[];
    subjects: SubjectConfig[];
    records: AttendanceRecord[];
}

const PrincipalMonitor: React.FC<PrincipalMonitorProps> = ({ students, subjects, records }) => {
    const { isMobile } = useMobile();
    const [searchQuery, setSearchQuery] = useState('');

    const studentMap = useMemo(() => {
        const map: Record<string, StudentRecord> = {};
        students.forEach(s => map[s.id] = s);
        return map;
    }, [students]);

    const stats = useMemo(() => {
        const studentStats: Record<string, {
            id: string,
            name: string,
            className: string,
            adNo: string,
            count: number,
            principalCount: number,
            medicalCount: number,
            otherCount: number,
            dates: string[]
        }> = {};

        records.forEach(record => {
            const authorizedIds = new Set([
                ...(record.principalApprovedAbsences || []),
                ...Object.keys(record.granularPermissions || {})
            ]);

            authorizedIds.forEach(studentId => {
                if (!studentStats[studentId]) {
                    const s = studentMap[studentId];
                    studentStats[studentId] = {
                        id: studentId,
                        name: s?.name || 'Unknown',
                        className: s?.className || record.className,
                        adNo: s?.adNo || 'N/A',
                        count: 0,
                        principalCount: 0,
                        medicalCount: 0,
                        otherCount: 0,
                        dates: []
                    };
                }

                studentStats[studentId].count += 1;
                
                // Determine type
                const type = record.granularPermissions?.[studentId] || 'Principal';
                if (type === 'Principal') studentStats[studentId].principalCount += 1;
                else if (type === 'Medical') studentStats[studentId].medicalCount += 1;
                else studentStats[studentId].otherCount += 1;

                if (!studentStats[studentId].dates.includes(record.date)) {
                    studentStats[studentId].dates.push(record.date);
                }
            });
        });

        return Object.values(studentStats)
            .sort((a, b) => b.count - a.count);
    }, [records, studentMap]);

    const filteredStats = useMemo(() => {
        if (!searchQuery.trim()) return stats;
        const q = searchQuery.toLowerCase().trim();
        return stats.filter(s => 
            s.name.toLowerCase().includes(q) || 
            s.adNo.toLowerCase().includes(q) ||
            s.className.toLowerCase().includes(q)
        );
    }, [stats, searchQuery]);

    // Total authorized leaves & breakdowns
    const totals = useMemo(() => {
        let total = 0;
        let p = 0;
        let m = 0;
        let o = 0;
        records.forEach(r => {
            const granular = r.granularPermissions || {};
            const principal = r.principalApprovedAbsences || [];
            
            const ids = new Set([...principal, ...Object.keys(granular)]);
            total += ids.size;

            ids.forEach(id => {
                const type = granular[id] || 'Principal';
                if (type === 'Principal') p++;
                else if (type === 'Medical') m++;
                else o++;
            });
        });
        return { total, p, m, o };
    }, [records]);

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Header / Summary */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-blue-900 p-8 rounded-[2.5rem] text-white shadow-2xl relative overflow-hidden">
                    <div className="absolute -right-8 -bottom-8 w-48 h-48 bg-white/5 rounded-full blur-3xl"></div>
                    <div className="relative z-10">
                        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-blue-300 mb-2">Grand Total</p>
                        <h2 className="text-5xl font-black mb-1">{totals.total}</h2>
                        <p className="text-xs font-bold text-blue-200">Authorized Leaves Granted This Semester</p>
                    </div>
                </div>
                
                <div className="bg-white p-8 rounded-[2.5rem] border-2 border-slate-100 flex flex-col justify-center">
                    <div className="flex items-center justify-around w-full">
                        <div className="text-center">
                            <div className="text-2xl font-black text-emerald-600">{totals.p}</div>
                            <div className="text-[8px] font-black text-slate-400 uppercase tracking-widest mt-1">Principal</div>
                        </div>
                        <div className="w-px h-8 bg-slate-100"></div>
                        <div className="text-center">
                            <div className="text-2xl font-black text-amber-500">{totals.m}</div>
                            <div className="text-[8px] font-black text-slate-400 uppercase tracking-widest mt-1">Medical</div>
                        </div>
                        <div className="w-px h-8 bg-slate-100"></div>
                        <div className="text-center">
                            <div className="text-2xl font-black text-indigo-500">{totals.o}</div>
                            <div className="text-[8px] font-black text-slate-400 uppercase tracking-widest mt-1">Other</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Search & Ranking Table */}
            <div className="bg-white rounded-[2.5rem] border-2 border-slate-100 overflow-hidden shadow-sm">
                <div className="p-8 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div>
                        <h4 className="text-lg font-black text-slate-900">Student Ranking</h4>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Sorted by Frequency</p>
                    </div>
                    
                    <div className="relative w-full md:w-80">
                        <i className="fa-solid fa-search absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"></i>
                        <input 
                            type="text"
                            placeholder="Search by name, ID or class..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-12 pr-4 py-3 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 transition-all font-bold text-slate-600 outline-none"
                        />
                    </div>
                </div>

                <div className="hidden md:block overflow-x-auto no-scrollbar">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50/50">
                                <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Rank</th>
                                <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Student</th>
                                <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Class</th>
                                <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-center">Frequency</th>
                                <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-right">Details</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {filteredStats.map((item, index) => (
                                <tr key={item.id} className="hover:bg-slate-50/50 transition-colors group">
                                    <td className="px-8 py-6">
                                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-black text-xs ${
                                            index === 0 ? 'bg-amber-100 text-amber-600' :
                                            index === 1 ? 'bg-slate-200 text-slate-600' :
                                            index === 2 ? 'bg-orange-100 text-orange-600' :
                                            'bg-slate-50 text-slate-400'
                                        }`}>
                                            #{index + 1}
                                        </div>
                                    </td>
                                    <td className="px-8 py-6">
                                        <div>
                                            <div className="font-black text-slate-900 group-hover:text-blue-600 transition-colors">{item.name}</div>
                                            <div className="text-[10px] font-bold text-slate-400">{item.adNo}</div>
                                        </div>
                                    </td>
                                    <td className="px-8 py-6">
                                        <span className="bg-slate-100 text-slate-600 text-[10px] font-black uppercase tracking-tighter px-2 py-1 rounded-md">
                                            {item.className}
                                        </span>
                                    </td>
                                    <td className="px-8 py-6 text-center">
                                        <div className="flex flex-col items-center gap-1">
                                            <div className="flex items-center gap-3">
                                                <div className="flex flex-col items-center" title="Principal Permissions">
                                                    <span className="text-sm font-black text-emerald-600">{item.principalCount}</span>
                                                    <div className="w-4 h-1 bg-emerald-100 rounded-full"></div>
                                                </div>
                                                <div className="flex flex-col items-center" title="Medical Permissions">
                                                    <span className="text-sm font-black text-amber-500">{item.medicalCount}</span>
                                                    <div className="w-4 h-1 bg-amber-100 rounded-full"></div>
                                                </div>
                                                <div className="flex flex-col items-center" title="Other Permissions">
                                                    <span className="text-sm font-black text-indigo-500">{item.otherCount}</span>
                                                    <div className="w-4 h-1 bg-indigo-100 rounded-full"></div>
                                                </div>
                                            </div>
                                            <span className="text-[10px] font-black text-slate-900 mt-1">{item.count} Total</span>
                                        </div>
                                    </td>
                                    <td className="px-8 py-6 text-right">
                                        <div className="flex flex-wrap justify-end gap-1 max-w-[200px] ml-auto">
                                            {item.dates.slice(0, 3).map(date => (
                                                <span key={date} className="text-[8px] font-bold text-slate-400 bg-white border border-slate-100 px-1.5 py-0.5 rounded">
                                                    {date}
                                                </span>
                                            ))}
                                            {item.dates.length > 3 && (
                                                <span className="text-[8px] font-bold text-blue-500 bg-blue-50 px-1.5 py-0.5 rounded">
                                                    +{item.dates.length - 3} more
                                                </span>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Mobile Card View */}
                <div className="md:hidden divide-y divide-slate-100">
                    {filteredStats.map((item, index) => (
                        <div key={item.id} className="p-6 active:bg-slate-50 transition-colors">
                            <div className="flex justify-between items-start mb-4">
                                <div className="flex gap-4">
                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm ${
                                        index === 0 ? 'bg-amber-100 text-amber-600' :
                                        index === 1 ? 'bg-slate-200 text-slate-600' :
                                        index === 2 ? 'bg-orange-100 text-orange-600' :
                                        'bg-slate-50 text-slate-400'
                                    }`}>
                                        #{index + 1}
                                    </div>
                                    <div>
                                        <div className="font-black text-slate-900 text-base">{item.name}</div>
                                        <div className="text-[10px] font-bold text-slate-400 flex items-center gap-2">
                                            {item.adNo}
                                            <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
                                            <span className="text-blue-500 uppercase tracking-widest">{item.className}</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="flex items-center justify-end gap-2 mb-1">
                                        <span className="text-xs font-black text-emerald-600">{item.principalCount}</span>
                                        <span className="text-xs font-black text-amber-500">{item.medicalCount}</span>
                                        <span className="text-xs font-black text-indigo-500">{item.otherCount}</span>
                                    </div>
                                    <div className="text-lg font-black text-slate-900 leading-none">{item.count}</div>
                                    <div className="text-[8px] font-black text-slate-400 uppercase tracking-widest mt-0.5">Total Leaves</div>
                                </div>
                            </div>
                            
                            <div className="flex flex-wrap gap-1.5 mt-2">
                                {item.dates.map(date => (
                                    <span key={date} className="text-[9px] font-bold text-slate-500 bg-slate-50 border border-slate-100 px-2 py-0.5 rounded-md">
                                        {date}
                                    </span>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>

                {filteredStats.length === 0 && (
                    <div className="px-8 py-24 text-center">
                        <div className="flex flex-col items-center gap-3">
                            <i className="fa-solid fa-ghost text-4xl text-slate-100"></i>
                            <p className="text-sm font-bold text-slate-400">No authorized leaves found or matching search</p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default PrincipalMonitor;
