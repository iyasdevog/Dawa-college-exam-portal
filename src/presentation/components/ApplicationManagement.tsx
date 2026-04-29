import React, { useState, useEffect } from 'react';
import { dataService } from '../../infrastructure/services/dataService';
import { StudentApplication, ApplicationStatus, ApplicationType } from '../../domain/entities/types';
import { SYSTEM_CLASSES as CLASSES } from '../../domain/entities/constants';
import { useTerm } from '../viewmodels/TermContext';

const ApplicationManagement: React.FC = () => {
    const { activeTerm } = useTerm();
    const [applications, setApplications] = useState<StudentApplication[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [filterStatus, setFilterStatus] = useState<ApplicationStatus | 'all'>('pending');
    const [filterClass, setFilterClass] = useState<string>('all');
    const [availableClasses, setAvailableClasses] = useState<string[]>([]);
    const [filterType, setFilterType] = useState<ApplicationType | 'all'>('all');
    const [filterSubject, setFilterSubject] = useState<string>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [updateMessage, setUpdateMessage] = useState<string | null>(null);
    const [isSelectionMode, setIsSelectionMode] = useState(false);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    useEffect(() => {
        loadApplications();
        loadClasses();
    }, [activeTerm]);

    const loadClasses = async () => {
        const classes = await dataService.getClassesByTerm(activeTerm);
        setAvailableClasses(classes);
        // If current filter is not in new list, reset to 'all'
        if (filterClass !== 'all' && !classes.includes(filterClass)) {
            setFilterClass('all');
        }
    };

    const loadApplications = async () => {
        setIsLoading(true);
        try {
            const apps = await dataService.getAllApplications(activeTerm);
            setApplications(apps);
        } catch (error) {
            console.error('Error loading applications:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleUpdateStatus = async (appId: string, status: ApplicationStatus) => {
        let comment = '';
        
        if (status === 'approved') {
            const usePreset = window.confirm('Use default approval message? (OK for "Qualified for examination", Cancel to type custom)');
            if (usePreset) {
                comment = 'Qualified for examination.';
            } else {
                const custom = window.prompt(`Enter custom comment for approval:`);
                if (custom === null) return; // cancelled
                comment = custom;
            }
        } else if (status === 'rejected') {
            const reason = window.prompt(
                'Enter rejection reason or choose an option:\n' +
                '1: Submit relevant documents\n' +
                '2: Complete payment to 7559989590\n' +
                'Leave blank or type custom reason:'
            );
            if (reason === null) return; // cancelled
            
            if (reason === '1') {
                comment = 'Please submit the relevant documents to proceed.';
            } else if (reason === '2') {
                comment = 'Please complete the fee payment to 7559989590 to proceed.';
            } else {
                comment = reason || 'Your application was rejected. Please contact the office.';
            }
        }

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

    const handleDelete = async (appId: string) => {
        if (!window.confirm('Are you sure you want to delete this application? This action cannot be undone.')) return;
        try {
            await dataService.deleteApplication(appId);
            setUpdateMessage(`Application deleted successfully.`);
            loadApplications();
            setTimeout(() => setUpdateMessage(null), 3000);
        } catch (error) {
            console.error('Error deleting application:', error);
            alert('Failed to delete application.');
        }
    };

    const toggleSelection = (id: string) => {
        const newSelection = new Set(selectedIds);
        if (newSelection.has(id)) {
            newSelection.delete(id);
        } else {
            newSelection.add(id);
        }
        setSelectedIds(newSelection);
    };

    const handleSelectAll = (filteredLength: number) => {
        if (selectedIds.size === filteredLength) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(filteredApps.map(app => app.id!)));
        }
    };

    const handleBulkAction = async (action: 'approve' | 'reject' | 'delete') => {
        if (selectedIds.size === 0) return;
        
        let confirmMsg = `Are you sure you want to ${action} ${selectedIds.size} applications?`;
        if (action === 'delete') {
            confirmMsg += ' This action cannot be undone.';
        }
        if (!window.confirm(confirmMsg)) return;

        let comment = '';
        if (action === 'approve') {
            comment = 'Qualified for examination.';
        } else if (action === 'reject') {
            comment = 'Your application was rejected. Please contact the office.';
        }

        setIsLoading(true);
        try {
            const promises = Array.from(selectedIds).map(id => {
                if (action === 'delete') {
                    return dataService.deleteApplication(id);
                } else {
                    return dataService.updateApplicationStatus(id, action === 'approve' ? 'approved' : 'rejected', comment);
                }
            });
            await Promise.all(promises);
            setUpdateMessage(`Successfully processed ${selectedIds.size} applications.`);
            setSelectedIds(new Set());
            setIsSelectionMode(false);
            loadApplications();
            setTimeout(() => setUpdateMessage(null), 3000);
        } catch (error) {
            console.error(`Error performing bulk ${action}:`, error);
            alert(`Failed to perform bulk ${action}.`);
            setIsLoading(false);
        }
    };

    // Derive unique subjects from loaded applications (grouped by normalized name)
    const uniqueSubjects = React.useMemo(() => {
        const subjectMap = new Map<string, { name: string; count: number }>();
        applications.forEach(app => {
            if (app.subjectName) {
                const key = app.subjectName.trim().toUpperCase();
                const existing = subjectMap.get(key);
                if (existing) {
                    existing.count++;
                } else {
                    // Display name: capitalize first letter of each word
                    const displayName = app.subjectName.trim().replace(/\w\S*/g, w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
                    subjectMap.set(key, { name: displayName, count: 1 });
                }
            }
        });
        return Array.from(subjectMap.entries())
            .map(([key, { name, count }]) => ({ key, name, count }))
            .sort((a, b) => a.name.localeCompare(b.name));
    }, [applications]);

    const filteredApps = applications.filter(app => 
        (filterStatus === 'all' ? true : app.status === filterStatus) &&
        (filterClass === 'all' ? true : app.className === filterClass) &&
        (filterType === 'all' ? true : app.type === filterType) &&
        (filterSubject === 'all' ? true : (app.subjectName?.trim().toUpperCase() === filterSubject)) &&
        (searchQuery ? 
            app.studentName.toLowerCase().includes(searchQuery.toLowerCase()) || 
            app.adNo.toLowerCase().includes(searchQuery.toLowerCase())
        : true)
    );

    return (
        <div className="p-6 md:p-10 max-w-6xl mx-auto">
            <div className="flex flex-col gap-4 mb-10">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div>
                        <h1 className="text-3xl font-black text-slate-900 tracking-tight">Application Management</h1>
                        <p className="text-slate-500 font-bold mt-1">Review and process student service requests</p>
                    </div>
                    <div className="flex gap-2">
                        <button 
                            onClick={() => {
                                setIsSelectionMode(!isSelectionMode);
                                if (isSelectionMode) setSelectedIds(new Set());
                            }}
                            className={`px-4 py-2 rounded-xl font-bold text-sm transition-all flex items-center gap-2 ${isSelectionMode ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                        >
                            <i className="fa-solid fa-check-double"></i>
                            {isSelectionMode ? 'Cancel Selection' : 'Bulk Actions'}
                        </button>
                    </div>
                </div>

                <div className="bg-slate-50 p-4 rounded-2xl flex flex-col md:flex-row gap-4 items-center">
                    <div className="relative flex-1 w-full">
                        <i className="fa-solid fa-search absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"></i>
                        <input 
                            type="text" 
                            placeholder="Search by Name or Adm No..." 
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 text-sm font-bold"
                        />
                    </div>
                    <div className="flex gap-2 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
                        <select
                            value={filterClass}
                            onChange={(e) => setFilterClass(e.target.value)}
                            className="px-4 py-3 rounded-xl text-xs font-black bg-white text-slate-700 border border-slate-200 focus:ring-2 focus:ring-emerald-500 min-w-[120px]"
                        >
                            <option value="all">All Classes</option>
                            {availableClasses.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                        <select
                            value={filterType}
                            onChange={(e) => setFilterType(e.target.value as ApplicationType | 'all')}
                            className="px-4 py-3 rounded-xl text-xs font-black bg-white text-slate-700 border border-slate-200 focus:ring-2 focus:ring-emerald-500 min-w-[140px]"
                        >
                            <option value="all">All Types</option>
                            <option value="revaluation">Revaluation</option>
                            <option value="improvement">Improvement</option>
                            <option value="external-supp">External Supp</option>
                            <option value="internal-supp">Internal Supp</option>
                            <option value="special-supp">Special Supp</option>
                        </select>
                        <select
                            value={filterSubject}
                            onChange={(e) => setFilterSubject(e.target.value)}
                            className="px-4 py-3 rounded-xl text-xs font-black bg-white text-slate-700 border border-slate-200 focus:ring-2 focus:ring-emerald-500 min-w-[140px]"
                        >
                            <option value="all">All Subjects ({applications.length})</option>
                            {uniqueSubjects.map(s => <option key={s.key} value={s.key}>{s.name} ({s.count})</option>)}
                        </select>
                        <div className="flex bg-white p-1 rounded-xl border border-slate-200 shrink-0">
                            {(['all', 'pending', 'approved', 'rejected'] as const).map(status => {
                                const baseList = applications.filter(app => 
                                    (filterClass === 'all' ? true : app.className === filterClass) &&
                                    (filterType === 'all' ? true : app.type === filterType)
                                );
                                const count = status === 'all' 
                                    ? baseList.length 
                                    : baseList.filter(app => app.status === status).length;

                                return (
                                    <button
                                        key={status}
                                        onClick={() => setFilterStatus(status)}
                                        className={`px-4 py-2 rounded-lg text-xs font-black capitalize transition-all flex items-center gap-2 ${filterStatus === status ? 'bg-emerald-50 text-emerald-700' : 'text-slate-500 hover:text-slate-700'}`}
                                    >
                                        <span>{status}</span>
                                        <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-black ${filterStatus === status ? 'bg-emerald-200/50 text-emerald-800' : 'bg-slate-100 text-slate-400'}`}>
                                            {count}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {isSelectionMode && (
                    <div className="bg-indigo-50 border border-indigo-100 p-4 rounded-xl flex flex-wrap items-center justify-between gap-4 animate-in fade-in slide-in-from-top-2">
                        <div className="flex items-center gap-4">
                            <button 
                                onClick={() => handleSelectAll(filteredApps.length)}
                                className="text-sm font-bold text-indigo-700 hover:text-indigo-900"
                            >
                                {selectedIds.size === filteredApps.length ? 'Deselect All' : 'Select All'}
                            </button>
                            <span className="text-sm font-bold text-indigo-400">|</span>
                            <span className="text-sm font-bold text-indigo-900">{selectedIds.size} selected</span>
                        </div>
                        <div className="flex gap-2">
                            <button 
                                onClick={() => handleBulkAction('reject')}
                                disabled={selectedIds.size === 0}
                                className="px-4 py-2 bg-white text-red-600 rounded-lg text-xs font-black hover:bg-red-50 border border-red-100 disabled:opacity-50"
                            >
                                Reject Selected
                            </button>
                            <button 
                                onClick={() => handleBulkAction('approve')}
                                disabled={selectedIds.size === 0}
                                className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-xs font-black hover:bg-emerald-700 shadow-sm disabled:opacity-50"
                            >
                                Approve Selected
                            </button>
                            <button 
                                onClick={() => handleBulkAction('delete')}
                                disabled={selectedIds.size === 0}
                                className="px-4 py-2 bg-slate-800 text-white rounded-lg text-xs font-black hover:bg-slate-900 shadow-sm disabled:opacity-50 ml-2"
                            >
                                Delete Selected
                            </button>
                        </div>
                    </div>
                )}
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
                        <div key={app.id} className={`bg-white p-6 rounded-[2rem] border transition-all group relative ${selectedIds.has(app.id!) ? 'border-indigo-300 shadow-md ring-2 ring-indigo-50' : 'border-slate-100 shadow-sm hover:shadow-md'}`}>
                            
                            {isSelectionMode && (
                                <div 
                                    className="absolute -left-3 top-1/2 -translate-y-1/2 z-10 cursor-pointer p-2"
                                    onClick={() => toggleSelection(app.id!)}
                                >
                                    <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${selectedIds.has(app.id!) ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-slate-300'}`}>
                                        {selectedIds.has(app.id!) && <i className="fa-solid fa-check text-xs"></i>}
                                    </div>
                                </div>
                            )}

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
                                    <button 
                                        onClick={() => handleDelete(app.id!)}
                                        className="mt-3 w-full px-6 py-2 bg-white text-slate-400 rounded-xl font-black text-xs hover:bg-red-50 hover:text-red-600 transition-all border border-slate-100 hover:border-red-100 flex items-center justify-center gap-2"
                                    >
                                        <i className="fa-solid fa-trash-can"></i>
                                        Delete
                                    </button>
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
