import React, { useState, useEffect } from 'react';
import { AcademicCalendarEntry } from '../../../domain/entities/types';
import { dataService } from '../../../infrastructure/services/dataService';
import { CLASSES } from '../../../domain/entities/constants';

const AcademicCalendar: React.FC = () => {
    const [entries, setEntries] = useState<AcademicCalendarEntry[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showAddModal, setShowAddModal] = useState(false);
    const [newEntry, setNewEntry] = useState<Omit<AcademicCalendarEntry, 'id'>>({
        startDate: new Date().toISOString().split('T')[0],
        endDate: new Date().toISOString().split('T')[0],
        type: 'Public Holiday',
        name: '',
        appliesToClasses: []
    });

    useEffect(() => {
        loadEntries();
    }, []);

    const loadEntries = async () => {
        setIsLoading(true);
        try {
            const data = await dataService.getAcademicCalendar();
            setEntries(data.sort((a, b) => a.startDate.localeCompare(b.startDate)));
        } catch (error) {
            console.error('Error loading academic calendar:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleAddEntry = async () => {
        if (!newEntry.name) return;
        try {
            await dataService.saveAcademicCalendarEntry(newEntry);
            setShowAddModal(false);
            setNewEntry({
                startDate: new Date().toISOString().split('T')[0],
                endDate: new Date().toISOString().split('T')[0],
                type: 'Public Holiday',
                name: '',
                appliesToClasses: []
            });
            loadEntries();
        } catch (error) {
            alert('Failed to save calendar entry');
        }
    };

    const handleDeleteEntry = async (id: string) => {
        if (!confirm('Are you sure you want to delete this event?')) return;
        try {
            await dataService.deleteAcademicCalendarEntry(id);
            loadEntries();
        } catch (error) {
            alert('Failed to delete entry');
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h3 className="text-xl font-bold text-slate-900">Academic Events & Holidays</h3>
                <button
                    onClick={() => setShowAddModal(true)}
                    className="bg-emerald-600 text-white px-6 py-2 rounded-xl font-bold shadow-md hover:bg-emerald-700 transition-all"
                >
                    <i className="fa-solid fa-plus mr-2"></i> Add Event
                </button>
            </div>

            {isLoading ? (
                <div className="text-center py-12">
                    <div className="loader-ring mx-auto mb-4"></div>
                    <p className="text-slate-500">Syncing calendar data...</p>
                </div>
            ) : entries.length === 0 ? (
                <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-3xl p-12 text-center">
                    <i className="fa-solid fa-calendar-alt text-4xl text-slate-300 mb-4"></i>
                    <p className="text-slate-500 font-medium">No holidays or special events scheduled yet.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {entries.map((entry) => (
                        <div key={entry.id} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all relative group">
                            <button
                                onClick={() => handleDeleteEntry(entry.id)}
                                className="absolute top-4 right-4 text-slate-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                            >
                                <i className="fa-solid fa-trash-can"></i>
                            </button>
                            <div className="flex items-center gap-3 mb-3">
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${entry.type === 'Public Holiday' ? 'bg-red-100 text-red-600' : entry.type === 'Continuous Vacation' ? 'bg-amber-100 text-amber-600' : 'bg-blue-100 text-blue-600'}`}>
                                    <i className={`fa-solid ${entry.type === 'Public Holiday' ? 'fa-umbrella-beach' : 'fa-plane-departure'}`}></i>
                                </div>
                                <div>
                                    <span className="text-[10px] font-black uppercase tracking-wider opacity-60">{entry.type}</span>
                                    <h4 className="font-bold text-slate-900 leading-tight">{entry.name}</h4>
                                </div>
                            </div>
                            <div className="space-y-2 mt-4 text-sm">
                                <div className="flex items-center gap-2 text-slate-600 font-medium">
                                    <i className="fa-solid fa-clock opacity-40"></i>
                                    {entry.startDate === entry.endDate ? entry.startDate : `${entry.startDate} to ${entry.endDate}`}
                                </div>
                                <div className="flex items-center gap-2 text-slate-600 font-medium">
                                    <i className="fa-solid fa-users opacity-40"></i>
                                    {entry.appliesToClasses?.length ? entry.appliesToClasses.join(', ') : 'All Classes'}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Add Modal */}
            {showAddModal && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-[2.5rem] w-full max-w-lg p-8 shadow-2xl animate-in zoom-in-95 duration-200">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-2xl font-black text-slate-900">Add Calendar Event</h3>
                            <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-900"><i className="fa-solid fa-xmark text-xl"></i></button>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1">Event Name</label>
                                <input
                                    type="text"
                                    value={newEntry.name}
                                    onChange={(e) => setNewEntry({ ...newEntry, name: e.target.value })}
                                    placeholder="e.g., Eid Al-Fitr"
                                    className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 font-bold"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-1">Start Date</label>
                                    <input
                                        type="date"
                                        value={newEntry.startDate}
                                        onChange={(e) => setNewEntry({ ...newEntry, startDate: e.target.value })}
                                        className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 font-bold"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-1">End Date</label>
                                    <input
                                        type="date"
                                        value={newEntry.endDate}
                                        onChange={(e) => setNewEntry({ ...newEntry, endDate: e.target.value })}
                                        className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 font-bold"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1">Event Type</label>
                                <div className="grid grid-cols-3 gap-2">
                                    {['Public Holiday', 'Continuous Vacation', 'Program'].map((type) => (
                                        <button
                                            key={type}
                                            onClick={() => setNewEntry({ ...newEntry, type: type as any })}
                                            className={`py-3 rounded-xl font-bold text-xs transition-all ${newEntry.type === type ? 'bg-slate-900 text-white' : 'bg-slate-50 text-slate-600 border border-slate-200'}`}
                                        >
                                            {type}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1">Applies To</label>
                                <div className="flex flex-wrap gap-2">
                                    <button
                                        onClick={() => setNewEntry({ ...newEntry, appliesToClasses: [] })}
                                        className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${newEntry.appliesToClasses?.length === 0 ? 'bg-emerald-600 text-white' : 'bg-slate-50 text-slate-600'}`}
                                    >
                                        All Classes
                                    </button>
                                    {CLASSES.map((c) => (
                                        <button
                                            key={c}
                                            onClick={() => {
                                                const current = newEntry.appliesToClasses || [];
                                                const updated = current.includes(c) ? current.filter(x => x !== c) : [...current, c];
                                                setNewEntry({ ...newEntry, appliesToClasses: updated });
                                            }}
                                            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${newEntry.appliesToClasses?.includes(c) ? 'bg-emerald-600 text-white' : 'bg-slate-50 text-slate-600'}`}
                                        >
                                            {c}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <button
                                onClick={handleAddEntry}
                                className="w-full py-5 bg-emerald-600 text-white rounded-2xl font-black uppercase text-xs tracking-[0.2em] shadow-xl hover:bg-emerald-700 transition-all mt-4"
                            >
                                Schedule Event
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AcademicCalendar;
