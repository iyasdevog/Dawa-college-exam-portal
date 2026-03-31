import React, { useState, useEffect } from 'react';
import { SubjectConfig, StudentRecord, ExamTimetableEntry } from '../../../domain/entities/types';
import { dataService } from '../../../infrastructure/services/dataService';

interface ExamTimetableProps {
    subjects: SubjectConfig[];
    students: StudentRecord[];
}

const ExamTimetable: React.FC<ExamTimetableProps> = ({ subjects, students }) => {
    const [selectedClass, setSelectedClass] = useState('');
    const [selectedSemester, setSelectedSemester] = useState<'Odd' | 'Even'>('Odd');
    const [entries, setEntries] = useState<Omit<ExamTimetableEntry, 'id'>[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isReleased, setIsReleased] = useState(false);

    const classes = [...new Set(students.map(s => s.className))];
    const filteredSubjects = subjects.filter(s => s.targetClasses.includes(selectedClass));

    useEffect(() => {
        if (selectedClass) {
            loadExamTimetable();
        }
    }, [selectedClass, selectedSemester]);

    const loadExamTimetable = async () => {
        setIsLoading(true);
        try {
            const [timetableData, releaseStatus] = await Promise.all([
                dataService.getExamTimetable(selectedClass, selectedSemester),
                dataService.getHallTicketReleaseStatus(selectedClass, selectedSemester)
            ]);
            setEntries(timetableData.map(({ id, ...rest }) => rest));
            setIsReleased(releaseStatus);
        } catch (error) {
            console.error('Error loading exam timetable:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleToggleRelease = async () => {
        if (!selectedClass) return;

        const newStatus = !isReleased;
        const confirmMsg = newStatus
            ? `Are you sure you want to RELEASE Hall Tickets for ${selectedClass} (${selectedSemester} Sem)? Students will be able to download them immediately.`
            : `Are you sure you want to HIDE Hall Tickets for ${selectedClass}? Students will no longer be able to access them.`;

        if (!confirm(confirmMsg)) return;

        setIsSaving(true);
        try {
            await dataService.setHallTicketReleaseStatus(selectedClass, selectedSemester, newStatus);
            setIsReleased(newStatus);
            alert(`Hall Tickets ${newStatus ? 'released' : 'hidden'} successfully.`);
        } catch (error) {
            alert('Failed to update release status.');
        } finally {
            setIsSaving(false);
        }
    };

    const handleAddEntry = () => {
        if (!filteredSubjects.length) return;
        setEntries([...entries, {
            date: new Date().toISOString().split('T')[0],
            day: new Date().toLocaleDateString('en-US', { weekday: 'long' }),
            subjectId: filteredSubjects[0].id,
            subjectName: filteredSubjects[0].name,
            className: selectedClass,
            semester: selectedSemester,
            startTime: '10:00',
            endTime: '13:00'
        }]);
    };

    const handleRemoveEntry = (index: number) => {
        setEntries(entries.filter((_, i) => i !== index));
    };

    const handleUpdateEntry = (index: number, updates: Partial<Omit<ExamTimetableEntry, 'id'>>) => {
        const newEntries = [...entries];
        const updatedEntry = { ...newEntries[index], ...updates };

        // Update day if date changes
        if (updates.date) {
            const dateObj = new Date(updates.date);
            updatedEntry.day = dateObj.toLocaleDateString('en-US', { weekday: 'long' });
        }

        // Update subject name if ID changes
        if (updates.subjectId) {
            const sub = subjects.find(s => s.id === updates.subjectId);
            if (sub) {
                updatedEntry.subjectName = sub.name;
            }
        }

        newEntries[index] = updatedEntry;
        setEntries(newEntries);
    };

    const handleSave = async () => {
        if (!selectedClass) return;
        setIsSaving(true);
        try {
            await dataService.clearExamTimetable(selectedClass, selectedSemester);
            await dataService.saveExamTimetableEntries(entries);
            alert('Exam timetable saved successfully!');
        } catch (error) {
            alert('Failed to save exam timetable.');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="bg-slate-50 p-6 rounded-3xl border border-slate-200">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Target Class</label>
                        <select
                            value={selectedClass}
                            onChange={(e) => setSelectedClass(e.target.value)}
                            className="w-full p-4 bg-white border border-slate-200 rounded-2xl focus:ring-4 focus:ring-emerald-500/10 font-bold text-slate-700 appearance-none transition-all shadow-sm"
                        >
                            <option value="">Choose a class...</option>
                            {classes.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Semester Cycle</label>
                        <div className="flex bg-white p-1.5 rounded-2xl border border-slate-200 shadow-sm">
                            {(['Odd', 'Even'] as const).map(sem => (
                                <button
                                    key={sem}
                                    onClick={() => setSelectedSemester(sem)}
                                    className={`flex-1 py-3 rounded-xl text-xs font-black transition-all ${selectedSemester === sem
                                        ? 'bg-emerald-600 text-white shadow-lg'
                                        : 'text-slate-400 hover:text-slate-600'
                                        }`}
                                >
                                    {sem} Semester
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {selectedClass ? (
                <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden">
                    <div className="p-8 border-b border-slate-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 bg-slate-50/30">
                        <div>
                            <h3 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                                Exam Schedule
                                {isReleased && (
                                    <span className="px-3 py-1 bg-emerald-100 text-emerald-700 text-[10px] uppercase font-black rounded-full animate-pulse border border-emerald-200">
                                        Live
                                    </span>
                                )}
                            </h3>
                            <p className="text-slate-500 text-xs font-medium mt-1 uppercase tracking-widest">Define dates and sessions for {selectedClass}</p>
                        </div>
                        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                            <button
                                onClick={handleToggleRelease}
                                disabled={isSaving || entries.length === 0}
                                className={`flex-1 md:flex-none px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-wider transition-all shadow-lg flex items-center justify-center gap-2 border-2 ${isReleased
                                    ? 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'
                                    : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                                    } disabled:opacity-50`}
                            >
                                <i className={`fa-solid ${isReleased ? 'fa-eye-slash' : 'fa-paper-plane'}`}></i>
                                {isReleased ? 'Unrelease Hall Tickets' : 'Release Hall Tickets'}
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={isSaving}
                                className="flex-1 md:flex-none px-6 py-3 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-wider hover:bg-slate-800 transition-all shadow-xl flex items-center justify-center gap-2"
                            >
                                {isSaving ? <i className="fa-solid fa-circle-notch fa-spin"></i> : <i className="fa-solid fa-cloud-arrow-up"></i>}
                                Save Schedule
                            </button>
                        </div>
                    </div>

                    <div className="p-8">
                        {entries.length > 0 ? (
                            <div className="space-y-4">
                                {entries.map((entry, idx) => (
                                    <div key={idx} className="group grid grid-cols-1 md:grid-cols-4 gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100 hover:border-emerald-200 hover:bg-emerald-50/30 transition-all">
                                        <div>
                                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Subject</label>
                                            <select
                                                value={entry.subjectId}
                                                onChange={(e) => handleUpdateEntry(idx, { subjectId: e.target.value })}
                                                className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-[11px] font-bold text-slate-800"
                                            >
                                                {filteredSubjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Exam Date</label>
                                            <input
                                                type="date"
                                                value={entry.date}
                                                onChange={(e) => handleUpdateEntry(idx, { date: e.target.value })}
                                                className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-[11px] font-bold text-slate-800"
                                            />
                                        </div>
                                        <div className="grid grid-cols-2 gap-2">
                                            <div>
                                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">From</label>
                                                <input
                                                    type="time"
                                                    value={entry.startTime}
                                                    onChange={(e) => handleUpdateEntry(idx, { startTime: e.target.value })}
                                                    className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-[11px] font-bold text-slate-800"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">To</label>
                                                <input
                                                    type="time"
                                                    value={entry.endTime}
                                                    onChange={(e) => handleUpdateEntry(idx, { endTime: e.target.value })}
                                                    className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-[11px] font-bold text-slate-800"
                                                />
                                            </div>
                                        </div>
                                        <div className="flex items-end justify-between gap-4">
                                            <div className="w-full">
                                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Day</label>
                                                <input
                                                    type="text"
                                                    value={entry.day}
                                                    readOnly
                                                    className="w-full p-2.5 bg-slate-100 border border-transparent rounded-xl text-[11px] font-black text-slate-500 uppercase tracking-tighter cursor-default"
                                                />
                                            </div>
                                            <button
                                                onClick={() => handleRemoveEntry(idx)}
                                                className="p-3 text-slate-300 hover:text-red-500 transition-colors"
                                            >
                                                <i className="fa-solid fa-trash-can"></i>
                                            </button>
                                        </div>
                                    </div>
                                ))}
                                <button
                                    onClick={handleAddEntry}
                                    className="w-full py-4 border-2 border-dashed border-slate-200 rounded-2xl text-slate-400 text-xs font-black uppercase tracking-widest hover:border-emerald-300 hover:text-emerald-500 hover:bg-emerald-50/50 transition-all flex items-center justify-center gap-2"
                                >
                                    <i className="fa-solid fa-plus-circle"></i>
                                    Add Exam Paper
                                </button>
                            </div>
                        ) : (
                            <div className="text-center py-20 border-2 border-dashed border-slate-100 rounded-[2rem] bg-slate-50/30">
                                <i className="fa-solid fa-file-signature text-5xl text-slate-100 mb-4 block"></i>
                                <h4 className="text-slate-400 font-black uppercase tracking-widest text-sm">No Exam Schedule Found</h4>
                                <p className="text-slate-300 text-[10px] font-bold uppercase tracking-widest mt-2">Start by adding the first exam paper</p>
                                <button
                                    onClick={handleAddEntry}
                                    className="mt-6 px-8 py-3 bg-emerald-600 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-200"
                                >
                                    Create Schedule
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            ) : (
                <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-[3rem] p-24 text-center">
                    <i className="fa-solid fa-calendar-check text-6xl text-slate-200 mb-6 font-thin"></i>
                    <h3 className="text-slate-400 font-black uppercase tracking-widest text-sm">Exam Timetable Hub</h3>
                    <p className="text-slate-300 text-xs mt-2 font-bold italic tracking-tight">Select a class to manage its formal examination schedule</p>
                </div>
            )}
        </div>
    );
};

export default ExamTimetable;
