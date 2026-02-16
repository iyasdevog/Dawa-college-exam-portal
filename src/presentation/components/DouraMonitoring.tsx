import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { DouraSubmission } from '../../domain/entities/types';
import { User } from '../../domain/entities/User';
import { CLASSES } from '../../domain/entities/constants';
import { dataService } from '../../infrastructure/services/dataService';
import { OperationLoadingSkeleton } from './SkeletonLoaders';

interface DouraMonitoringProps {
    currentUser: User | null;
}

const DouraMonitoring: React.FC<DouraMonitoringProps> = ({ currentUser }) => {
    const [douraMonitorSubmissions, setDouraMonitorSubmissions] = useState<DouraSubmission[]>([]);
    const [monitoringLoading, setMonitoringLoading] = useState(false);
    const [monitoringFilterClass, setMonitoringFilterClass] = useState<string>('all');
    const [monitoringFilterStatus, setMonitoringFilterStatus] = useState<'Pending' | 'Approved' | 'Rejected' | 'all'>('Pending');
    const [operationLoading, setOperationLoading] = useState<{
        type: 'saving' | 'clearing' | 'loading-students' | 'validating' | null;
        message?: string;
    }>({ type: null });

    const loadMonitoringSubmissions = useCallback(async () => {
        try {
            setMonitoringLoading(true);
            const submissions = await dataService.getAllDouraSubmissions(
                monitoringFilterClass,
                monitoringFilterStatus === 'all' ? undefined : monitoringFilterStatus
            );
            setDouraMonitorSubmissions(submissions);
        } catch (error) {
            console.error('Error loading monitoring submissions:', error);
        } finally {
            setMonitoringLoading(false);
        }
    }, [monitoringFilterClass, monitoringFilterStatus]);

    useEffect(() => {
        loadMonitoringSubmissions();
    }, [monitoringFilterClass, monitoringFilterStatus, loadMonitoringSubmissions]);

    const handleUpdateDouraStatus = useCallback(async (id: string, status: 'Approved' | 'Rejected') => {
        const feedback = window.prompt(`Enter feedback for ${status.toLowerCase()} (optional):`);
        if (feedback === null) return; // Cancelled

        try {
            setOperationLoading({ type: 'saving', message: `Updating submission status...` });
            await dataService.updateDouraSubmission(id, {
                status,
                feedback: feedback || undefined,
                approvedBy: currentUser?.name || 'Faculty'
            });
            await loadMonitoringSubmissions();
        } catch (error) {
            console.error('Error updating status:', error);
            alert('Failed to update status.');
        } finally {
            setOperationLoading({ type: null });
        }
    }, [currentUser, loadMonitoringSubmissions]);

    const handleDeleteDouraSubmission = useCallback(async (id: string, name: string) => {
        if (!confirm(`Are you sure you want to permanently delete the submission for ${name}?`)) return;

        try {
            setOperationLoading({ type: 'saving', message: 'Deleting submission...' });
            await dataService.deleteDouraSubmission(id);
            await loadMonitoringSubmissions();
            alert('Submission deleted successfully.');
        } catch (error) {
            console.error('Error deleting submission:', error);
            alert('Failed to delete submission.');
        } finally {
            setOperationLoading({ type: null });
        }
    }, [loadMonitoringSubmissions]);

    return (
        <div className="space-y-4 md:space-y-8">
            <div className="px-4 md:px-0">
                <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">Doura Monitoring</h1>
                <p className="text-slate-600 mt-2 text-sm md:text-base">Monitor and manage student Doura progress submissions</p>
            </div>

            <div className="px-4 md:px-0 space-y-6">
                {/* Filters */}
                <div className="bg-white rounded-2xl p-6 shadow-lg border-2 border-slate-200">
                    <h3 className="text-lg font-bold text-slate-900 mb-4">
                        <i className="fa-solid fa-filter mr-2 text-emerald-600"></i>
                        Monitoring Controls
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-2">Class Filter</label>
                            <select
                                value={monitoringFilterClass}
                                onChange={(e) => setMonitoringFilterClass(e.target.value)}
                                className="w-full p-3 border-2 border-slate-300 rounded-xl focus:ring-4 focus:ring-emerald-500/40 focus:border-emerald-500 bg-white"
                            >
                                <option value="all">All Classes</option>
                                {CLASSES.map(cls => (
                                    <option key={cls} value={cls}>{cls}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-2">Status Filter</label>
                            <select
                                value={monitoringFilterStatus}
                                onChange={(e) => setMonitoringFilterStatus(e.target.value as any)}
                                className="w-full p-3 border-2 border-slate-300 rounded-xl focus:ring-4 focus:ring-emerald-500/40 focus:border-emerald-500 bg-white"
                            >
                                <option value="all">All Statuses</option>
                                <option value="Pending">Pending Approval</option>
                                <option value="Approved">Approved</option>
                                <option value="Rejected">Rejected</option>
                            </select>
                        </div>
                    </div>
                </div>

                {/* Submissions List */}
                <div className="bg-white rounded-2xl shadow-xl border-2 border-slate-200 overflow-hidden">
                    {monitoringLoading ? (
                        <div className="p-12 text-center text-slate-500">
                            <div className="w-8 h-8 border-4 border-slate-200 border-t-emerald-500 rounded-full animate-spin mx-auto mb-4"></div>
                            <p className="font-bold">Loading submissions...</p>
                        </div>
                    ) : douraMonitorSubmissions.length === 0 ? (
                        <div className="p-12 text-center text-slate-500">
                            <i className="fa-solid fa-clipboard-check text-4xl mb-4 text-slate-200"></i>
                            <p className="font-bold">No submissions found</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-slate-50 border-b border-slate-200">
                                        <th className="px-6 py-4 font-black uppercase tracking-widest text-[10px] text-slate-500">Student Details</th>
                                        <th className="px-6 py-4 font-black uppercase tracking-widest text-[10px] text-slate-500">Class</th>
                                        <th className="px-6 py-4 font-black uppercase tracking-widest text-[10px] text-slate-500 text-center">Date</th>
                                        <th className="px-6 py-4 font-black uppercase tracking-widest text-[10px] text-slate-500 text-center">Range</th>
                                        <th className="px-6 py-4 font-black uppercase tracking-widest text-[10px] text-slate-500 text-center">Stats</th>
                                        <th className="px-6 py-4 font-black uppercase tracking-widest text-[10px] text-slate-500 text-center">Status</th>
                                        <th className="px-6 py-4 font-black uppercase tracking-widest text-[10px] text-slate-500">Teacher</th>
                                        <th className="px-6 py-4 font-black uppercase tracking-widest text-[10px] text-slate-500">Submitted At</th>
                                        <th className="px-6 py-4 font-black uppercase tracking-widest text-[10px] text-slate-500 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {douraMonitorSubmissions.map((sub) => (
                                        <tr key={sub.id} className="hover:bg-slate-50 transition-colors">
                                            <td className="px-6 py-4">
                                                <div className="font-black text-slate-900">{sub.studentName}</div>
                                                <div className="text-xs text-slate-500 font-bold">Adm: {sub.studentAdNo}</div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className="bg-slate-100 px-3 py-1 rounded-lg text-xs font-black text-slate-700">
                                                    {sub.className}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <div className="text-sm font-bold text-slate-700">{new Date(sub.recitationDate).toLocaleDateString()}</div>
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <span className="text-xl font-black text-blue-600">
                                                    {sub.juzStart === sub.juzEnd ? sub.juzStart : `${sub.juzStart}-${sub.juzEnd}`}
                                                </span>
                                                <div className="text-[10px] font-bold text-slate-400">
                                                    Page: {sub.pageStart}-{sub.pageEnd}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <div className="text-[10px] font-black text-slate-500">
                                                    <div>{Math.max(0, sub.juzEnd - sub.juzStart + 1)} JUZ</div>
                                                    <div>{Math.max(0, sub.pageEnd - sub.pageStart + 1)} PGS</div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded ${sub.status === 'Approved' ? 'bg-emerald-100 text-emerald-700' :
                                                    sub.status === 'Pending' ? 'bg-amber-100 text-amber-700' :
                                                        'bg-red-100 text-red-700'
                                                    }`}>
                                                    {sub.status}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className={`text-xs font-black p-1.5 rounded-lg border text-center ${sub.teacherName ? 'bg-slate-50 border-slate-200 text-slate-600' : 'bg-red-50 border-red-100 text-red-400 opacity-50'}`}>
                                                    {sub.teacherName || 'Not Specified'}
                                                </div>
                                                {sub.approvedBy && sub.status === 'Approved' && (
                                                    <div className="text-[10px] text-emerald-600 font-bold mt-1 flex items-center gap-1">
                                                        <i className="fa-solid fa-check-double text-[8px]"></i>
                                                        Approved by {sub.approvedBy}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 text-xs text-slate-500">
                                                <div>{new Date(sub.submittedAt).toLocaleDateString()}</div>
                                                <div className="opacity-70">{new Date(sub.submittedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                {sub.status === 'Pending' && (
                                                    <div className="flex justify-end gap-2">
                                                        <button
                                                            onClick={() => handleUpdateDouraStatus(sub.id, 'Approved')}
                                                            className="w-10 h-10 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl shadow-lg shadow-emerald-500/20 active:scale-95 transition-all flex items-center justify-center"
                                                            title="Approve"
                                                        >
                                                            <i className="fa-solid fa-check"></i>
                                                        </button>
                                                        <button
                                                            onClick={() => handleUpdateDouraStatus(sub.id, 'Rejected')}
                                                            className="w-10 h-10 bg-red-500 hover:bg-red-600 text-white rounded-xl shadow-lg shadow-red-500/20 active:scale-95 transition-all flex items-center justify-center"
                                                            title="Reject"
                                                        >
                                                            <i className="fa-solid fa-xmark"></i>
                                                        </button>
                                                    </div>
                                                )}
                                                <div className="flex justify-end mt-2">
                                                    <button
                                                        onClick={() => handleDeleteDouraSubmission(sub.id, sub.studentName)}
                                                        className="w-8 h-8 bg-slate-100 hover:bg-red-50 text-slate-400 hover:text-red-600 rounded-lg active:scale-95 transition-all flex items-center justify-center"
                                                        title="Delete Submission"
                                                    >
                                                        <i className="fa-solid fa-trash-can text-xs"></i>
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* Operation Loading Overlay */}
                {operationLoading.type && (
                    <OperationLoadingSkeleton
                        operation={operationLoading.type}
                        message={operationLoading.message}
                    />
                )}
            </div>
        </div>
    );
};

export default DouraMonitoring;
