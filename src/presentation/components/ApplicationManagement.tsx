import React, { useState, useEffect } from 'react';
import { dataService } from '../../infrastructure/services/dataService';
import { StudentApplication, ApplicationStatus } from '../../domain/entities/types';

const ApplicationManagement: React.FC = () => {
    const [applications, setApplications] = useState<StudentApplication[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [filterStatus, setFilterStatus] = useState<ApplicationStatus | 'all'>('all');
    const [updateMessage, setUpdateMessage] = useState<string | null>(null);

    useEffect(() => {
        loadApplications();
    }, []);

    const loadApplications = async () => {
        setIsLoading(true);
        try {
            const apps = await dataService.getAllApplications();
            setApplications(apps);
        } catch (error) {
            console.error('Error loading applications:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleUpdateStatus = async (appId: string, status: ApplicationStatus) => {
        const comment = window.prompt(`Enter comment for ${status}:`);
        if (comment === null) return;

        try {
            await dataService.updateApplicationStatus(appId, status, comment);
            setUpdateMessage(`Application ${status} successfully.`);
            loadApplications();
            setTimeout(() => setUpdateMessage(null), 3000);
        } catch (error) {
            console.error('Error updating status:', error);
            alert('Failed to update status.');
        }
    };

    const filteredApps = applications.filter(app => 
        filterStatus === 'all' ? true : app.status === filterStatus
    );

    return (
        <div className="p-6 md:p-10 max-w-6xl mx-auto">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight">Application Management</h1>
                    <p className="text-slate-500 font-bold mt-1">Review and process student service requests</p>
                </div>

                <div className="flex bg-slate-100 p-1 rounded-2xl">
                    {(['all', 'pending', 'approved', 'rejected'] as const).map(status => (
                        <button
                            key={status}
                            onClick={() => setFilterStatus(status)}
                            className={`px-6 py-2 rounded-xl text-xs font-black capitalize transition-all ${filterStatus === status ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            {status}
                        </button>
                    ))}
                </div>
            </div>

            {updateMessage && (
                <div className="bg-emerald-50 text-emerald-700 p-4 rounded-2xl border border-emerald-100 mb-8 animate-in fade-in slide-in-from-top-4 duration-300 font-bold flex items-center gap-3">
                    <i className="fa-solid fa-circle-check"></i>
                    {updateMessage}
                </div>
            )}

            {isLoading ? (
                <div className="flex items-center justify-center py-20">
                    <div className="w-10 h-10 border-4 border-emerald-100 border-t-emerald-600 rounded-full animate-spin"></div>
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-4">
                    {filteredApps.map(app => (
                        <div key={app.id} className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm hover:shadow-md transition-all group">
                            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                                <div className="space-y-4">
                                    <div className="flex items-center gap-3">
                                        <div className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                                            app.status === 'pending' ? 'bg-amber-100 text-amber-700' :
                                            app.status === 'approved' ? 'bg-emerald-100 text-emerald-700' :
                                            'bg-red-100 text-red-700'
                                        }`}>
                                            {app.status}
                                        </div>
                                        <span className="text-slate-300">•</span>
                                        <span className="text-xs font-black text-slate-400 uppercase tracking-widest">{app.type.replace('-', ' ')}</span>
                                    </div>

                                    <div>
                                        <h3 className="text-xl font-black text-slate-800">{app.studentName}</h3>
                                        <div className="flex items-center gap-3 text-sm font-bold text-slate-500 mt-1">
                                            <span>Ad No: {app.adNo}</span>
                                            <span>•</span>
                                            <span>Class: {app.className}</span>
                                        </div>
                                    </div>

                                    <div className="bg-slate-50 p-4 rounded-2xl flex items-center justify-between">
                                        <div className="space-y-1">
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Subject</p>
                                            <p className="font-bold text-slate-700">{app.subjectName}</p>
                                        </div>
                                        <div className="text-right space-y-1">
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Fee Amount</p>
                                            <p className="font-black text-emerald-600">₹{app.fee}</p>
                                        </div>
                                    </div>

                                    {app.reason && (
                                        <div className="space-y-1">
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Reason / Details</p>
                                            <p className="text-sm font-bold text-slate-600 bg-amber-50/50 p-3 rounded-xl border border-amber-100/50">{app.reason}</p>
                                        </div>
                                    )}

                                    {app.adminComment && (
                                        <div className="space-y-1 pt-2 border-t border-slate-50">
                                            <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Admin Response</p>
                                            <p className="text-sm font-bold text-slate-600 italic">"{app.adminComment}"</p>
                                        </div>
                                    )}
                                </div>

                                <div className="flex lg:flex-col lg:items-end justify-between lg:justify-center gap-4 border-t lg:border-t-0 lg:border-l border-slate-50 pt-6 lg:pt-0 lg:pl-8">
                                    <div className="text-right hidden lg:block mb-4">
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Submitted On</p>
                                        <p className="text-xs font-bold text-slate-500">{new Date(app.createdAt).toLocaleString()}</p>
                                    </div>

                                    {app.status === 'pending' && (
                                        <div className="flex gap-2">
                                            <button 
                                                onClick={() => handleUpdateStatus(app.id!, 'rejected')}
                                                className="px-6 py-3 bg-red-50 text-red-600 rounded-xl font-black text-xs hover:bg-red-100 transition-all border border-red-100"
                                            >
                                                Reject
                                            </button>
                                            <button 
                                                onClick={() => handleUpdateStatus(app.id!, 'approved')}
                                                className="px-6 py-3 bg-emerald-600 text-white rounded-xl font-black text-xs hover:bg-emerald-700 shadow-lg shadow-emerald-600/20 transition-all"
                                            >
                                                Approve
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}

                    {filteredApps.length === 0 && (
                        <div className="text-center py-24 bg-slate-50 rounded-[3rem] border-2 border-dashed border-slate-200">
                            <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center mx-auto mb-6 shadow-sm">
                                <i className="fa-solid fa-folder-open text-4xl text-slate-200"></i>
                            </div>
                            <h3 className="text-xl font-black text-slate-800">No applications found</h3>
                            <p className="text-slate-500 font-bold mt-1">There are no records matching your current filter.</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default ApplicationManagement;
