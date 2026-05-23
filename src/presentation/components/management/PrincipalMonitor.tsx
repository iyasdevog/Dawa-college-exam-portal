import React, { useMemo, useState } from 'react';
import { StudentRecord, SubjectConfig, AttendanceRecord, LeavePermission } from '../../../domain/entities/types';
import { useMobile } from '../../hooks/useMobile';
import { dataService } from '../../../infrastructure/services/dataService';

interface PrincipalMonitorProps {
    students: StudentRecord[];
    subjects: SubjectConfig[];
    records: AttendanceRecord[];
    leavePermissions: LeavePermission[];
    onRefresh: () => void;
}

const PrincipalMonitor: React.FC<PrincipalMonitorProps> = ({ students, subjects, records, leavePermissions, onRefresh }) => {
    const { isMobile } = useMobile();
    const [searchQuery, setSearchQuery] = useState('');
    const [expandedStudent, setExpandedStudent] = useState<string | null>(null);
    const [isActionLoading, setIsActionLoading] = useState(false);

    const studentMap = useMemo(() => {
        const map: Record<string, StudentRecord> = {};
        students.forEach(s => map[s.id] = s);
        return map;
    }, [students]);

    const activeLeaves = useMemo(() => {
        const today = new Date().toISOString().split('T')[0];
        return leavePermissions.filter(lp => lp.date >= today)
            .sort((a, b) => a.date.localeCompare(b.date));
    }, [leavePermissions]);

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
            history: Array<{ 
                date: string, 
                type: string, 
                reason: string, 
                approvedBy: string,
                source: 'record' | 'permission'
            }>
        }> = {};

        // Process marked records (Past & Present)
        records.forEach(record => {
            const granular = record.granularPermissions || {};
            const principal = record.principalApprovedAbsences || [];
            
            const ids = new Set([...principal, ...Object.keys(granular)]);

            ids.forEach(studentId => {
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
                        history: []
                    };
                }

                studentStats[studentId].count += 1;
                
                const type = granular[studentId] || 'Principal';
                if (type === 'Principal') studentStats[studentId].principalCount += 1;
                else if (type === 'Medical') studentStats[studentId].medicalCount += 1;
                else studentStats[studentId].otherCount += 1;

                if (!studentStats[studentId].history.some(h => h.date === record.date)) {
                    studentStats[studentId].history.push({
                        date: record.date,
                        type,
                        reason: record.absentReasons?.[studentId] || 'No reason specified',
                        approvedBy: 'Logged in Record',
                        source: 'record'
                    });
                }
            });
        });

        // Add pre-authorized leaves that haven't been marked yet
        leavePermissions.forEach(lp => {
            if (!studentStats[lp.studentId]) {
                const s = studentMap[lp.studentId];
                studentStats[lp.studentId] = {
                    id: lp.studentId,
                    name: s?.name || lp.studentName || 'Unknown',
                    className: s?.className || lp.className || 'Unknown',
                    adNo: s?.adNo || 'N/A',
                    count: 0,
                    principalCount: 0,
                    medicalCount: 0,
                    otherCount: 0,
                    history: []
                };
            }

            // Only add to count if not already in records for that date
            if (!studentStats[lp.studentId].history.some(h => h.date === lp.date)) {
                studentStats[lp.studentId].count += 1;
                if (lp.type === 'Principal') studentStats[lp.studentId].principalCount += 1;
                else if (lp.type === 'Medical') studentStats[lp.studentId].medicalCount += 1;
                else studentStats[lp.studentId].otherCount += 1;

                studentStats[lp.studentId].history.push({
                    date: lp.date,
                    type: lp.type,
                    reason: lp.note || 'No reason specified',
                    approvedBy: lp.approvedBy || 'Principal',
                    source: 'permission'
                });
            } else {
                // If already in records, update the history with metadata from permission if better
                const idx = studentStats[lp.studentId].history.findIndex(h => h.date === lp.date);
                if (idx !== -1) {
                    studentStats[lp.studentId].history[idx].approvedBy = lp.approvedBy || studentStats[lp.studentId].history[idx].approvedBy;
                    if (lp.note && studentStats[lp.studentId].history[idx].reason === 'No reason specified') {
                        studentStats[lp.studentId].history[idx].reason = lp.note;
                    }
                }
            }
        });

        return Object.values(studentStats)
            .map(s => ({
                ...s,
                history: s.history.sort((a, b) => b.date.localeCompare(a.date))
            }))
            .sort((a, b) => b.count - a.count);
    }, [records, leavePermissions, studentMap]);

    const filteredStats = useMemo(() => {
        if (!searchQuery.trim()) return stats;
        const q = searchQuery.toLowerCase().trim();
        return stats.filter(s => 
            s.name.toLowerCase().includes(q) || 
            s.adNo.toLowerCase().includes(q) ||
            s.className.toLowerCase().includes(q)
        );
    }, [stats, searchQuery]);

    const handleEndLeave = async (permissionId: string) => {
        if (!window.confirm('Are you sure you want to end this leave permission? This will remove it from upcoming records.')) return;
        
        setIsActionLoading(true);
        try {
            await dataService.deleteLeavePermission(permissionId);
            onRefresh();
        } catch (error) {
            console.error('Error ending leave:', error);
            alert('Failed to end leave permission.');
        } finally {
            setIsActionLoading(false);
        }
    };

    return (
        <div className="space-y-10 animate-in fade-in duration-500 pb-20">
            {/* Header / Summary */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-slate-900 p-8 rounded-[2.5rem] text-white shadow-2xl relative overflow-hidden">
                    <div className="absolute -right-8 -bottom-8 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl"></div>
                    <div className="relative z-10">
                        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 mb-2">Semester Overview</p>
                        <h2 className="text-5xl font-black mb-1">{stats.reduce((acc, curr) => acc + curr.count, 0)}</h2>
                        <p className="text-xs font-bold text-slate-400">Total Authorized Absences Managed</p>
                    </div>
                </div>
                
                <div className="bg-white p-8 rounded-[2.5rem] border-2 border-slate-100 flex flex-col justify-center shadow-sm">
                    <div className="flex items-center justify-around w-full">
                        <div className="text-center">
                            <div className="text-2xl font-black text-emerald-600">{stats.reduce((acc, curr) => acc + curr.principalCount, 0)}</div>
                            <div className="text-[8px] font-black text-slate-400 uppercase tracking-widest mt-1">Principal</div>
                        </div>
                        <div className="w-px h-8 bg-slate-100"></div>
                        <div className="text-center">
                            <div className="text-2xl font-black text-amber-500">{stats.reduce((acc, curr) => acc + curr.medicalCount, 0)}</div>
                            <div className="text-[8px] font-black text-slate-400 uppercase tracking-widest mt-1">Medical</div>
                        </div>
                        <div className="w-px h-8 bg-slate-100"></div>
                        <div className="text-center">
                            <div className="text-2xl font-black text-indigo-500">{stats.reduce((acc, curr) => acc + curr.otherCount, 0)}</div>
                            <div className="text-[8px] font-black text-slate-400 uppercase tracking-widest mt-1">Other</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Active & Future Leaves Section */}
            {activeLeaves.length > 0 && (
                <div className="bg-emerald-50/50 rounded-[2.5rem] border-2 border-emerald-100 overflow-hidden shadow-sm">
                    <div className="p-8 border-b border-emerald-100 flex justify-between items-center">
                        <div>
                            <h4 className="text-lg font-black text-emerald-900 flex items-center gap-2">
                                <i className="fa-solid fa-calendar-star"></i>
                                Active & Upcoming Leaves
                            </h4>
                            <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mt-1">Currently Granted Permissions</p>
                        </div>
                        <span className="px-4 py-1.5 bg-emerald-100 text-emerald-700 rounded-full font-black text-[10px] uppercase tracking-widest">
                            {activeLeaves.length} Pending
                        </span>
                    </div>
                    <div className="overflow-x-auto no-scrollbar">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="bg-emerald-50/80">
                                    <th className="px-8 py-4 text-[9px] font-black text-emerald-600 uppercase tracking-widest">Student</th>
                                    <th className="px-8 py-4 text-[9px] font-black text-emerald-600 uppercase tracking-widest">Date</th>
                                    <th className="px-8 py-4 text-[9px] font-black text-emerald-600 uppercase tracking-widest">Type</th>
                                    <th className="px-8 py-4 text-[9px] font-black text-emerald-600 uppercase tracking-widest">Reason</th>
                                    <th className="px-8 py-4 text-[9px] font-black text-emerald-600 uppercase tracking-widest text-right">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-emerald-100">
                                {activeLeaves.map(leave => (
                                    <tr key={leave.id} className="hover:bg-emerald-100/50 transition-colors">
                                        <td className="px-8 py-5">
                                            <div className="font-black text-slate-800">{leave.studentName}</div>
                                            <div className="text-[9px] font-bold text-emerald-600 uppercase tracking-tighter">{leave.className}</div>
                                        </td>
                                        <td className="px-8 py-5">
                                            <div className="text-sm font-black text-slate-700">{leave.date}</div>
                                        </td>
                                        <td className="px-8 py-5">
                                            <span className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-widest ${
                                                leave.type === 'Principal' ? 'bg-emerald-100 text-emerald-700' :
                                                leave.type === 'Medical' ? 'bg-amber-100 text-amber-700' :
                                                'bg-indigo-100 text-indigo-700'
                                            }`}>
                                                {leave.type}
                                            </span>
                                        </td>
                                        <td className="px-8 py-5">
                                            <div className="text-[10px] font-bold text-slate-500 max-w-xs truncate" title={leave.note}>
                                                {leave.note || '---'}
                                            </div>
                                            <div className="text-[8px] font-black text-slate-400 mt-0.5">By {leave.approvedBy || 'Principal'}</div>
                                        </td>
                                        <td className="px-8 py-5 text-right">
                                            <button 
                                                disabled={isActionLoading}
                                                onClick={() => handleEndLeave(leave.id)}
                                                className="px-4 py-2 bg-white border border-emerald-200 text-emerald-600 rounded-xl font-black text-[9px] uppercase tracking-widest hover:bg-emerald-600 hover:text-white transition-all shadow-sm"
                                            >
                                                End Leave
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Ranking and History Section */}
            <div className="bg-white rounded-[2.5rem] border-2 border-slate-100 overflow-hidden shadow-sm">
                <div className="p-8 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div>
                        <h4 className="text-lg font-black text-slate-900">Student Monitoring</h4>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Sorted by Absence Frequency</p>
                    </div>
                    
                    <div className="relative w-full md:w-80">
                        <i className="fa-solid fa-search absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"></i>
                        <input 
                            type="text"
                            placeholder="Search student or class..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-12 pr-4 py-3 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 transition-all font-bold text-slate-600 outline-none"
                        />
                    </div>
                </div>

                <div className="overflow-x-auto no-scrollbar">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-slate-50/50">
                                <th className="px-8 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">Rank</th>
                                <th className="px-8 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">Student</th>
                                <th className="px-8 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">Class</th>
                                <th className="px-8 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest text-center">Stats</th>
                                <th className="px-8 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {filteredStats.map((item, index) => {
                                const isExpanded = expandedStudent === item.id;
                                return (
                                    <React.Fragment key={item.id}>
                                        <tr className={`hover:bg-slate-50/50 transition-colors group ${isExpanded ? 'bg-slate-50/50' : ''}`}>
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
                                                <div className="font-black text-slate-900">{item.name}</div>
                                                <div className="text-[9px] font-bold text-slate-400">{item.adNo}</div>
                                            </td>
                                            <td className="px-8 py-6">
                                                <span className="bg-slate-100 text-slate-600 text-[10px] font-black uppercase tracking-tighter px-2.5 py-1 rounded-md">
                                                    {item.className}
                                                </span>
                                            </td>
                                            <td className="px-8 py-6">
                                                <div className="flex justify-center items-center gap-3">
                                                    <div className="text-center" title="Principal">
                                                        <div className="text-xs font-black text-emerald-600">{item.principalCount}</div>
                                                        <div className="w-4 h-0.5 bg-emerald-100 rounded-full mx-auto"></div>
                                                    </div>
                                                    <div className="text-center" title="Medical">
                                                        <div className="text-xs font-black text-amber-500">{item.medicalCount}</div>
                                                        <div className="w-4 h-0.5 bg-amber-100 rounded-full mx-auto"></div>
                                                    </div>
                                                    <div className="text-center" title="Other">
                                                        <div className="text-xs font-black text-indigo-500">{item.otherCount}</div>
                                                        <div className="w-4 h-0.5 bg-indigo-100 rounded-full mx-auto"></div>
                                                    </div>
                                                    <div className="w-px h-6 bg-slate-200 mx-2"></div>
                                                    <div className="text-center">
                                                        <div className="text-sm font-black text-slate-900">{item.count}</div>
                                                        <div className="text-[7px] font-black text-slate-400 uppercase">Total</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-8 py-6 text-right">
                                                <button 
                                                    onClick={() => setExpandedStudent(isExpanded ? null : item.id)}
                                                    className={`px-4 py-2 rounded-xl font-black text-[9px] uppercase tracking-widest transition-all ${
                                                        isExpanded ? 'bg-slate-900 text-white shadow-lg' : 'bg-slate-50 text-slate-500 hover:bg-slate-100 border border-slate-200'
                                                    }`}
                                                >
                                                    {isExpanded ? 'Hide History' : 'View History'}
                                                </button>
                                            </td>
                                        </tr>
                                        {isExpanded && (
                                            <tr>
                                                <td colSpan={5} className="px-8 py-8 bg-slate-50/50">
                                                    <div className="bg-white rounded-3xl border border-slate-200 shadow-inner overflow-hidden animate-in slide-in-from-top-4 duration-300">
                                                        <div className="p-6 border-b border-slate-100 bg-slate-50/30">
                                                            <h5 className="text-[10px] font-black text-slate-900 uppercase tracking-[0.3em]">Leave History Details</h5>
                                                        </div>
                                                        <div className="divide-y divide-slate-50">
                                                            {item.history.map((h, i) => (
                                                                <div key={i} className="px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-50/50 transition-colors">
                                                                    <div className="flex items-center gap-4">
                                                                        <div className="text-xs font-black text-slate-900 tabular-nums w-24">{h.date}</div>
                                                                        <div className={`w-1.5 h-1.5 rounded-full ${
                                                                            h.type === 'Principal' ? 'bg-emerald-500' :
                                                                            h.type === 'Medical' ? 'bg-amber-500' :
                                                                            'bg-indigo-500'
                                                                        }`}></div>
                                                                        <div className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md ${
                                                                            h.type === 'Principal' ? 'text-emerald-600 bg-emerald-50' :
                                                                            h.type === 'Medical' ? 'text-amber-600 bg-amber-50' :
                                                                            'text-indigo-600 bg-indigo-50'
                                                                        }`}>
                                                                            {h.type}
                                                                        </div>
                                                                    </div>
                                                                    <div className="flex-1 flex flex-col gap-0.5">
                                                                        <p className="text-[10px] font-bold text-slate-600">"{h.reason}"</p>
                                                                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">
                                                                            Authorized By: <span className="text-slate-500">{h.approvedBy}</span>
                                                                        </p>
                                                                    </div>
                                                                    <div className="flex items-center gap-2">
                                                                        <span className={`text-[8px] font-black uppercase tracking-widest px-2 py-1 rounded-full ${
                                                                            h.source === 'record' ? 'bg-slate-100 text-slate-500' : 'bg-emerald-100 text-emerald-600'
                                                                        }`}>
                                                                            {h.source === 'record' ? 'Past Record' : 'Future Permission'}
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </React.Fragment>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                {filteredStats.length === 0 && (
                    <div className="px-8 py-24 text-center">
                        <div className="flex flex-col items-center gap-3">
                            <i className="fa-solid fa-ghost text-4xl text-slate-200"></i>
                            <p className="text-sm font-bold text-slate-400">No monitoring records found</p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default PrincipalMonitor;
