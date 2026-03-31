import React, { useState, useEffect } from 'react';
import { dataService } from '../../infrastructure/services/dataService';
import { TimetableEntry, ExamTimetableEntry, SpecialDay, SubjectConfig, HallTicketSettings } from '../../domain/entities/types';
import { CLASSES, DAYS } from '../../domain/entities/constants';

const TimetableManager: React.FC = () => {
    const [selectedClass, setSelectedClass] = useState('S1');
    const [selectedSemester, setSelectedSemester] = useState<'Odd' | 'Even'>('Odd');
    const [activeSubTab, setActiveSubTab] = useState<'general' | 'exam' | 'special'>('general');

    const [timetable, setTimetable] = useState<TimetableEntry[]>([]);
    const [examTimetable, setExamTimetable] = useState<ExamTimetableEntry[]>([]);
    const [isHallTicketReleased, setIsHallTicketReleased] = useState(false);

    const [specialDays, setSpecialDays] = useState<SpecialDay[]>([]);
    const [subjects, setSubjects] = useState<SubjectConfig[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [showAIModal, setShowAIModal] = useState(false);
    const [aiInput, setAIInput] = useState('');
    const [isExtracting, setIsExtracting] = useState(false);

    useEffect(() => {
        loadData();
    }, [selectedClass, selectedSemester]);

    const loadData = async () => {
        setIsLoading(true);
        try {
            const [tt, et, releaseStatus, sd, allSubjects] = await Promise.all([
                dataService.getTimetableByClass(selectedClass),
                dataService.getExamTimetable(selectedClass, selectedSemester),
                dataService.getHallTicketReleaseStatus(selectedClass, selectedSemester),
                dataService.getSpecialDays(),
                dataService.getAllSubjects()
            ]);
            setTimetable(tt);
            setExamTimetable(et);
            setIsHallTicketReleased(releaseStatus);
            setSpecialDays(sd);
            setSubjects(allSubjects);
        } catch (error) {
            console.error('Error loading timetable data:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleAIExtract = async () => {
        if (!aiInput.trim()) return;
        setIsExtracting(true);
        try {
            console.log('Extracting from:', aiInput);
            await new Promise(resolve => setTimeout(resolve, 2000));

            if (activeSubTab === 'exam') {
                // Mock Exam Extraction
                const mockExamEntries: Omit<ExamTimetableEntry, 'id'>[] = [
                    {
                        className: selectedClass,
                        semester: selectedSemester,
                        date: '2026-02-15',
                        day: 'Sunday',
                        subjectId: subjects[0]?.id || 'mock-id-1',
                        subjectName: subjects[0]?.name || 'Example Subject',
                        startTime: '10:00 AM',
                        endTime: '12:30 PM'
                    }
                ];

                if (window.confirm(`AI extracted ${mockExamEntries.length} exam entries. Apply to ${selectedClass} ${selectedSemester} Semester?`)) {
                    await dataService.saveExamTimetableEntries(mockExamEntries);
                    await loadData();
                    setShowAIModal(false);
                    setAIInput('');
                }
            } else {
                // Mock General Extraction
                const mockEntries: Omit<TimetableEntry, 'id'>[] = [
                    {
                        className: selectedClass,
                        day: 'Friday',
                        startTime: '09:00',
                        endTime: '10:00',
                        subjectId: subjects[0]?.id || 'mock-id-1',
                        subjectName: subjects[0]?.name || 'English'
                    }
                ];

                if (window.confirm(`AI extracted ${mockEntries.length} entries. Apply to ${selectedClass}?`)) {
                    await dataService.saveTimetableEntries(mockEntries);
                    await loadData();
                    setShowAIModal(false);
                    setAIInput('');
                }
            }
        } catch (error) {
            alert('Failed to extract: ' + (error instanceof Error ? error.message : 'Unknown error'));
        } finally {
            setIsExtracting(false);
        }
    };

    const handleToggleRelease = async () => {
        const newStatus = !isHallTicketReleased;
        if (window.confirm(`${newStatus ? 'Release' : 'Revoke'} hall tickets for ${selectedClass} ${selectedSemester} semester?`)) {
            try {
                setIsSaving(true);
                await dataService.setHallTicketReleaseStatus(selectedClass, selectedSemester, newStatus);
                setIsHallTicketReleased(newStatus);
            } catch (error) {
                alert('Failed to update release status');
            } finally {
                setIsSaving(false);
            }
        }
    };

    const handleDeleteEntry = async (id: string) => {
        if (window.confirm('Delete this entry?')) {
            // Logic to delete entry (need to add to dataService)
            // For now just mock/skip
            alert('Delete functionality to be implemented in dataService');
        }
    };

    return (
        <div className="p-6 space-y-8 max-w-7xl mx-auto">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 flex items-center gap-3">
                        <i className="fa-solid fa-calendar-days text-emerald-600"></i>
                        Timetable & Attendance Management
                    </h1>
                    <p className="text-slate-500 mt-1 font-medium">Configure class schedules and manage special program days</p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    <select
                        value={selectedClass}
                        onChange={(e) => setSelectedClass(e.target.value)}
                        className="p-3 bg-white border-2 border-slate-200 rounded-xl font-bold text-slate-700 outline-none focus:border-emerald-500 transition-all shadow-sm"
                    >
                        {CLASSES.map(cls => <option key={cls} value={cls}>{cls}</option>)}
                    </select>

                    <select
                        value={selectedSemester}
                        onChange={(e) => setSelectedSemester(e.target.value as any)}
                        className="p-3 bg-white border-2 border-slate-200 rounded-xl font-bold text-slate-700 outline-none focus:border-emerald-500 transition-all shadow-sm"
                    >
                        <option value="Odd">Odd Semester</option>
                        <option value="Even">Even Semester</option>
                    </select>

                    <button
                        onClick={() => setShowAIModal(true)}
                        className="px-6 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-xl font-black uppercase tracking-wider shadow-lg hover:shadow-emerald-500/20 active:scale-95 transition-all flex items-center gap-2"
                    >
                        <i className="fa-solid fa-wand-magic-sparkles"></i>
                        {isExtracting ? 'Extracting...' : 'AI Extract'}
                    </button>
                </div>
            </div>

            {/* Navigation Tabs */}
            <div className="flex gap-4 p-1 bg-slate-100 rounded-2xl w-fit">
                {[
                    { id: 'general', label: 'Regular Schedule', icon: 'fa-calendar-week' },
                    { id: 'exam', label: 'Exam Schedule', icon: 'fa-file-signature' },
                    { id: 'special', label: 'Special Days', icon: 'fa-star' }
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveSubTab(tab.id as any)}
                        className={`px-6 py-2 rounded-xl font-black text-xs uppercase tracking-widest transition-all flex items-center gap-2 ${activeSubTab === tab.id
                            ? 'bg-white text-emerald-600 shadow-sm'
                            : 'text-slate-500 hover:text-slate-700'
                            }`}
                    >
                        <i className={`fa-solid ${tab.icon}`}></i>
                        {tab.label}
                    </button>
                ))}
            </div>

            {activeSubTab === 'exam' && (
                <div className={`p-6 rounded-3xl border-2 transition-all flex flex-col md:flex-row md:items-center justify-between gap-6 ${isHallTicketReleased ? 'bg-emerald-50 border-emerald-200' : 'bg-orange-50 border-orange-200'
                    }`}>
                    <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl ${isHallTicketReleased ? 'bg-emerald-500 text-white' : 'bg-orange-500 text-white'
                            }`}>
                            <i className={`fa-solid ${isHallTicketReleased ? 'fa-check-circle' : 'fa-lock'}`}></i>
                        </div>
                        <div>
                            <h3 className="font-black text-slate-900 uppercase tracking-tight">Hall Ticket Release Status</h3>
                            <p className="text-sm font-medium text-slate-500">
                                {isHallTicketReleased
                                    ? 'Students can now download their hall tickets from the public portal.'
                                    : 'Hall tickets are currently locked. Admins must approve before student download.'}
                            </p>
                        </div>
                    </div>

                    <button
                        onClick={handleToggleRelease}
                        disabled={isSaving}
                        className={`px-8 py-4 rounded-2xl font-black uppercase tracking-widest transition-all shadow-lg active:scale-95 flex items-center gap-2 ${isHallTicketReleased
                            ? 'bg-red-500 hover:bg-red-600 text-white shadow-red-500/20'
                            : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20'
                            }`}
                    >
                        <i className={`fa-solid ${isHallTicketReleased ? 'fa-xmark-circle' : 'fa-paper-plane'}`}></i>
                        {isHallTicketReleased ? 'Revoke Hall Tickets' : 'Approve & Release'}
                    </button>
                </div>
            )}

            {activeSubTab === 'general' ? (
                /* Timetable Grid */
                <div className="bg-white rounded-[2rem] shadow-xl border-2 border-slate-100 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full border-collapse">
                            <thead>
                                <tr className="bg-slate-50 border-b-2 border-slate-100">
                                    <th className="p-4 text-left font-black text-slate-400 uppercase tracking-widest text-xs">Day</th>
                                    <th className="p-4 text-left font-black text-slate-400 uppercase tracking-widest text-xs">Schedule</th>
                                </tr>
                            </thead>
                            <tbody>
                                {DAYS.map(day => (
                                    <tr key={day} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                                        <td className="p-4 align-top">
                                            <span className="font-black text-slate-700 uppercase">{day}</span>
                                        </td>
                                        <td className="p-4">
                                            <div className="flex flex-wrap gap-3">
                                                {timetable.filter(e => e.day === day).length > 0 ? (
                                                    timetable.filter(e => e.day === day).map(entry => (
                                                        <div key={entry.id} className="bg-emerald-50 border border-emerald-100 p-3 rounded-xl flex items-center gap-4 group">
                                                            <div>
                                                                <p className="font-bold text-emerald-900 text-sm">{entry.subjectName}</p>
                                                                <p className="text-xs text-emerald-600 font-medium">{entry.startTime} - {entry.endTime}</p>
                                                            </div>
                                                            <button
                                                                onClick={() => handleDeleteEntry(entry.id)}
                                                                className="text-slate-300 hover:text-red-500 transition-colors"
                                                            >
                                                                <i className="fa-solid fa-circle-xmark"></i>
                                                            </button>
                                                        </div>
                                                    ))
                                                ) : (
                                                    <span className="text-slate-300 text-sm italic">No classes scheduled</span>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            ) : activeSubTab === 'exam' ? (
                /* Exam Timetable Grid */
                <div className="bg-white rounded-[2rem] shadow-xl border-2 border-slate-100 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full border-collapse">
                            <thead>
                                <tr className="bg-slate-50 border-b-2 border-slate-100">
                                    <th className="p-4 text-left font-black text-slate-400 uppercase tracking-widest text-xs">Date</th>
                                    <th className="p-4 text-left font-black text-slate-400 uppercase tracking-widest text-xs">Day</th>
                                    <th className="p-4 text-left font-black text-slate-400 uppercase tracking-widest text-xs">Subject</th>
                                    <th className="p-4 text-left font-black text-slate-400 uppercase tracking-widest text-xs">Session</th>
                                    <th className="p-4 text-right font-black text-slate-400 uppercase tracking-widest text-xs">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {examTimetable.length > 0 ? (
                                    examTimetable.map(entry => (
                                        <tr key={entry.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                                            <td className="p-4 font-bold text-slate-700">{entry.date}</td>
                                            <td className="p-4 font-medium text-slate-500">{entry.day}</td>
                                            <td className="p-4">
                                                <div className="font-black text-slate-900">{entry.subjectName}</div>
                                            </td>
                                            <td className="p-4">
                                                <div className="text-xs font-bold text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full w-fit">
                                                    {entry.startTime} - {entry.endTime}
                                                </div>
                                            </td>
                                            <td className="p-4 text-right">
                                                <button className="text-slate-300 hover:text-red-500 transition-all">
                                                    <i className="fa-solid fa-trash"></i>
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan={5} className="p-12 text-center text-slate-400">
                                            <i className="fa-solid fa-file-circle-exclamation text-4xl mb-3 opacity-20"></i>
                                            <p className="font-medium">No exam schedules found. Use AI Extract to import.</p>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            ) : (
                /* Special Days Section */
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="bg-white rounded-[2rem] p-8 shadow-xl border-2 border-slate-100">
                        <h2 className="text-xl font-black text-slate-900 mb-6 flex items-center gap-3">
                            <i className="fa-solid fa-star text-orange-500"></i>
                            Special & Program Days
                        </h2>

                        <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
                            {specialDays.length > 0 ? (
                                specialDays.map(day => (
                                    <div key={day.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between">
                                        <div>
                                            <p className="font-bold text-slate-700">{day.note}</p>
                                            <p className="text-xs text-slate-500">{day.date} • <span className="capitalize">{day.type}</span></p>
                                        </div>
                                        <div className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${day.type === 'Leave' ? 'bg-red-100 text-red-600' : 'bg-orange-100 text-orange-600'
                                            }`}>
                                            {day.type}
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="text-center py-12 text-slate-400">
                                    <i className="fa-solid fa-calendar-xmark text-4xl mb-4 opacity-20"></i>
                                    <p>No special days marked yet</p>
                                </div>
                            )}
                        </div>

                        <button className="w-full mt-6 p-4 bg-slate-900 text-white rounded-2xl font-black uppercase tracking-widest hover:bg-slate-800 transition-all flex items-center justify-center gap-3">
                            <i className="fa-solid fa-plus"></i>
                            Mark Special Day
                        </button>
                    </div>

                    <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-[2rem] p-8 shadow-xl text-white">
                        <h2 className="text-xl font-black mb-6 flex items-center gap-3">
                            <i className="fa-solid fa-circle-info text-emerald-400"></i>
                            Attendance Overview
                        </h2>
                        <div className="space-y-6">
                            <div className="bg-white/10 p-6 rounded-3xl backdrop-blur-md">
                                <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px] mb-2">Total Classes Conducted</p>
                                <p className="text-4xl font-black">128</p>
                            </div>
                            <div className="bg-white/10 p-6 rounded-3xl backdrop-blur-md">
                                <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px] mb-2">Average Attendance Rate</p>
                                <p className="text-4xl font-black text-emerald-400">92.4%</p>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* AI Extraction Modal */}
            {showAIModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => !isExtracting && setShowAIModal(false)}></div>
                    <div className="relative bg-white w-full max-w-2xl rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-8 bg-gradient-to-r from-emerald-600 to-teal-600 text-white">
                            <h3 className="text-2xl font-black flex items-center gap-3">
                                <i className="fa-solid fa-wand-magic-sparkles"></i>
                                AI Timetable Extraction
                            </h3>
                            <p className="text-emerald-100 font-medium mt-1">Paste text or upload an image of your timetable</p>
                        </div>

                        <div className="p-8 space-y-6">
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-2 uppercase tracking-widest">Input Timetable Data</label>
                                <textarea
                                    value={aiInput}
                                    onChange={(e) => setAIInput(e.target.value)}
                                    placeholder="e.g. Monday: 9-10 English, 10-11 Math..."
                                    className="w-full h-48 p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none focus:border-emerald-500 transition-all font-mono text-sm"
                                    disabled={isExtracting}
                                ></textarea>
                            </div>

                            <div className="flex gap-4">
                                <button
                                    onClick={() => setShowAIModal(false)}
                                    className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-2xl font-black uppercase tracking-widest hover:bg-slate-200 transition-all"
                                    disabled={isExtracting}
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleAIExtract}
                                    disabled={isExtracting || !aiInput.trim()}
                                    className="flex-[2] py-4 bg-emerald-600 text-white rounded-2xl font-black uppercase tracking-widest hover:bg-emerald-700 shadow-xl shadow-emerald-600/20 active:scale-95 transition-all flex items-center justify-center gap-3"
                                >
                                    {isExtracting ? (
                                        <>
                                            <div className="w-5 h-5 border-3 border-white/30 border-t-white rounded-full animate-spin"></div>
                                            Extracting...
                                        </>
                                    ) : (
                                        <>
                                            <i className="fa-solid fa-bolt"></i>
                                            Start AI Extraction
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TimetableManager;
