import React, { useState, useEffect } from 'react';
import { dataService } from '../../infrastructure/services/dataService';
import { SubjectConfig, TimetableEntry, AttendanceRecord, SpecialDay } from '../../domain/entities/types';
import { MobileFacultyEntrySkeleton } from './SkeletonLoaders';

const PublicAttendance: React.FC = () => {
    const [isLoading, setIsLoading] = useState(true);
    const [todaySchedule, setTodaySchedule] = useState<TimetableEntry[]>([]);
    const [subjects, setSubjects] = useState<SubjectConfig[]>([]);
    const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
    const [specialDays, setSpecialDays] = useState<SpecialDay[]>([]);

    useEffect(() => {
        loadTodayData();
    }, []);

    const loadTodayData = async () => {
        setIsLoading(true);
        try {
            const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
            const today = days[new Date().getDay()] as TimetableEntry['day'];
            const dateStr = new Date().toISOString().split('T')[0];

            const [schedule, allSubjects, records, specials] = await Promise.all([
                dataService.getTimetableByDay(today),
                dataService.getAllSubjects(),
                dataService.getAttendanceByClassAndDate('', dateStr), // We might need to fetch all and filter or modify service
                dataService.getSpecialDays(dateStr)
            ]);

            setTodaySchedule(schedule);
            setSubjects(allSubjects);
            setAttendanceRecords(records); // Note: dataService might need to be refined for "all classes"
            setSpecialDays(specials);
        } catch (error) {
            console.error('Error loading public attendance:', error);
        } finally {
            setIsLoading(false);
        }
    };

    if (isLoading) return <MobileFacultyEntrySkeleton studentCount={5} />;

    return (
        <div className="max-w-4xl mx-auto p-6 space-y-8">
            <div className="text-center">
                <h1 className="text-3xl font-black text-slate-900 tracking-tight">Today's Attendance Status</h1>
                <p className="text-slate-600 mt-2">Live updates of marked subjects for {new Date().toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
            </div>

            {specialDays.length > 0 && (
                <div className="space-y-4">
                    {specialDays.map(sd => (
                        <div key={sd.id} className="bg-amber-50 border-2 border-amber-200 p-6 rounded-2xl flex items-center gap-4 animate-in zoom-in-95">
                            <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center text-amber-600 text-xl">
                                <i className="fa-solid fa-calendar-day"></i>
                            </div>
                            <div>
                                <h3 className="font-bold text-amber-900">{sd.type}: {sd.note}</h3>
                                <p className="text-sm text-amber-700">{sd.className ? `Applies to ${sd.className}` : 'Applicable to all classes'}</p>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <div className="grid gap-4">
                {todaySchedule.length > 0 ? (
                    todaySchedule.map((entry, idx) => {
                        const subject = subjects.find(s => s.id === entry.subjectId);
                        const isMarked = attendanceRecords.some(r => r.subjectId === entry.subjectId && r.className === entry.className);

                        return (
                            <div key={idx} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between hover:border-emerald-200 transition-all">
                                <div className="flex items-center gap-4">
                                    <div className="w-16 text-center">
                                        <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">{entry.startTime}</div>
                                        <div className="text-xs text-slate-300">to</div>
                                        <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">{entry.endTime}</div>
                                    </div>
                                    <div className="h-10 w-[2px] bg-slate-100"></div>
                                    <div>
                                        <h3 className="font-bold text-slate-900">{subject?.name || 'Loading...'}</h3>
                                        <p className="text-sm text-slate-500">{entry.className}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    {isMarked ? (
                                        <span className="px-4 py-1.5 bg-emerald-100 text-emerald-700 text-xs font-black rounded-full uppercase tracking-widest flex items-center gap-2">
                                            <i className="fa-solid fa-check-double"></i>
                                            Marked
                                        </span>
                                    ) : (
                                        <span className="px-4 py-1.5 bg-slate-100 text-slate-400 text-xs font-black rounded-full uppercase tracking-widest flex items-center gap-2">
                                            <i className="fa-solid fa-clock"></i>
                                            Pending
                                        </span>
                                    )}
                                </div>
                            </div>
                        );
                    })
                ) : (
                    <div className="text-center py-12 bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200">
                        <i className="fa-solid fa-calendar-xmark text-4xl text-slate-200 mb-4"></i>
                        <p className="text-slate-400 font-medium">No schedule found for today.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default PublicAttendance;
