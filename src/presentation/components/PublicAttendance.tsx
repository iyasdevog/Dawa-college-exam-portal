import React, { useState, useEffect, useMemo } from 'react';
import { dataService } from '../../infrastructure/services/dataService';
import { SubjectConfig, TimetableEntry, AttendanceRecord, SpecialDay } from '../../domain/entities/types';
import { SYSTEM_CLASSES } from '../../domain/entities/constants';
import { useTerm } from '../viewmodels/TermContext';
import { MobileFacultyEntrySkeleton } from './SkeletonLoaders';

const PublicAttendance: React.FC = () => {
    const { activeTerm } = useTerm();
    const [isLoading, setIsLoading] = useState(true);
    const [availableClasses, setAvailableClasses] = useState<string[]>(SYSTEM_CLASSES);
    const [selectedClass, setSelectedClass] = useState<string>('D1');
    
    // Anchor date for weekly navigation (defaults to today)
    const [anchorDate, setAnchorDate] = useState<Date>(new Date());
    const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
    const [showDatePicker, setShowDatePicker] = useState(false);
    
    const [timetable, setTimetable] = useState<TimetableEntry[]>([]);
    const [subjects, setSubjects] = useState<SubjectConfig[]>([]);
    const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
    const [specialDays, setSpecialDays] = useState<SpecialDay[]>([]);
    
    // Modal state for period inspection
    const [inspectedPeriod, setInspectedPeriod] = useState<{
        entry: TimetableEntry;
        subject?: SubjectConfig;
        record?: AttendanceRecord;
    } | null>(null);

    // Compute the Saturday-to-Saturday (8 days) week strip based on anchorDate
    const weekDays = useMemo(() => {
        const result = [];
        const current = new Date(anchorDate);
        // Find the Saturday preceding or on current date (Saturday is day 6 in JS getDay)
        const dayNum = current.getDay();
        const diffToSaturday = (dayNum + 1) % 7; // if Sat(6)->0, Sun(0)->1, Mon(1)->2, ...
        
        const sat = new Date(current);
        sat.setDate(current.getDate() - diffToSaturday);

        // Generate 8 days from Saturday to Saturday
        for (let i = 0; i < 8; i++) {
            const d = new Date(sat);
            d.setDate(sat.getDate() + i);
            const dateStr = d.toISOString().split('T')[0];
            const daysShort = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
            const dayNameFull: TimetableEntry['day'] = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][d.getDay()] as any;
            
            result.push({
                dateStr,
                dayShort: daysShort[d.getDay()],
                dayFull: dayNameFull,
                dayNumber: d.getDate(),
                monthShort: d.toLocaleString('en-US', { month: 'short' }),
                isToday: dateStr === new Date().toISOString().split('T')[0]
            });
        }
        return result;
    }, [anchorDate]);

    // Compute day of week from selectedDate
    const dayOfWeek = useMemo(() => {
        const days: TimetableEntry['day'][] = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const dateObj = new Date(selectedDate);
        return days[dateObj.getDay()];
    }, [selectedDate]);

    // Navigate to previous or next Saturday-to-Saturday week
    const handlePrevWeek = () => {
        const newAnchor = new Date(anchorDate);
        newAnchor.setDate(newAnchor.getDate() - 7);
        setAnchorDate(newAnchor);
        // Default selectedDate to the start Saturday of that new week
        const dayNum = newAnchor.getDay();
        const diffToSat = (dayNum + 1) % 7;
        newAnchor.setDate(newAnchor.getDate() - diffToSat);
        setSelectedDate(newAnchor.toISOString().split('T')[0]);
    };

    const handleNextWeek = () => {
        const newAnchor = new Date(anchorDate);
        newAnchor.setDate(newAnchor.getDate() + 7);
        setAnchorDate(newAnchor);
        const dayNum = newAnchor.getDay();
        const diffToSat = (dayNum + 1) % 7;
        newAnchor.setDate(newAnchor.getDate() - diffToSat);
        setSelectedDate(newAnchor.toISOString().split('T')[0]);
    };

    const handleResetToday = () => {
        const today = new Date();
        setAnchorDate(today);
        setSelectedDate(today.toISOString().split('T')[0]);
    };

    // Load available classes on mount or activeTerm change
    useEffect(() => {
        const fetchClasses = async () => {
            try {
                const termClasses = await dataService.getClassesByTerm(activeTerm);
                if (termClasses && termClasses.length > 0) {
                    setAvailableClasses(termClasses);
                    if (!termClasses.includes(selectedClass)) {
                        setSelectedClass(termClasses[0]);
                    }
                }
            } catch (err) {
                console.error('Error fetching classes:', err);
            }
        };
        fetchClasses();
    }, [activeTerm]);

    // Load schedule and attendance whenever selectedClass, selectedDate, or activeTerm changes
    useEffect(() => {
        loadData();
    }, [selectedClass, selectedDate, dayOfWeek, activeTerm]);

    const loadData = async () => {
        setIsLoading(true);
        try {
            const [daySchedule, allSubjects, records, specials] = await Promise.all([
                dataService.getTimetableByDay(dayOfWeek, activeTerm),
                dataService.getAllSubjects(activeTerm),
                dataService.getAttendanceByClassAndDate(selectedClass, selectedDate),
                dataService.getSpecialDays(activeTerm)
            ]);

            setTimetable(daySchedule);
            setSubjects(allSubjects);
            setAttendanceRecords(records);
            setSpecialDays(specials.filter(sd => sd.date === selectedDate));
        } catch (error) {
            console.error('Error loading public attendance table:', error);
        } finally {
            setIsLoading(false);
        }
    };

    // Format time from 24h to 12h format (e.g. "09:00" -> "9:00 AM")
    const formatTime = (timeStr: string) => {
        if (!timeStr) return '';
        const [hStr, mStr] = timeStr.split(':');
        let h = parseInt(hStr, 10);
        if (isNaN(h)) return timeStr;
        const ampm = h >= 12 ? 'PM' : 'AM';
        h = h % 12;
        if (h === 0) h = 12;
        return `${h}:${mStr || '00'} ${ampm}`;
    };

    // Filter schedule for selected class
    const classSchedule = useMemo(() => {
        if (selectedClass === 'All') return timetable;
        return timetable.filter(t => t.className === selectedClass);
    }, [timetable, selectedClass]);

    return (
        <div className="max-w-3xl mx-auto p-3 md:p-6 space-y-6">
            {/* Card Container matching the spec */}
            <div className="bg-white rounded-[2.5rem] border border-slate-200/80 shadow-2xl overflow-hidden">
                {/* Header section */}
                <div className="p-5 md:p-8 pb-4 space-y-5">
                    <div className="flex items-center justify-between flex-wrap gap-4">
                        <div>
                            <div className="flex items-center gap-2 text-emerald-600 font-black tracking-tight text-lg md:text-xl uppercase">
                                <i className="fa-solid fa-calendar-check text-xl"></i>
                                TODAY'S TABLE &amp; WEEKLY RECORDS
                            </div>
                            <p className="text-xs font-bold text-slate-400 mt-0.5">{selectedDate} &bull; {dayOfWeek}</p>
                        </div>
                        
                        <div className="flex items-center gap-2">
                            <button
                                onClick={handleResetToday}
                                className="px-3.5 py-2 bg-emerald-50 text-emerald-700 hover:bg-emerald-600 hover:text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all border border-emerald-200 flex items-center gap-1.5 active:scale-95"
                            >
                                <i className="fa-solid fa-calendar-day"></i>
                                TODAY
                            </button>
                            <button
                                onClick={() => setShowDatePicker(!showDatePicker)}
                                className={`px-3 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all border ${showDatePicker ? 'bg-slate-900 text-white border-slate-900' : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'}`}
                                title="Custom Date Search"
                            >
                                <i className="fa-regular fa-calendar-days"></i>
                            </button>
                        </div>
                    </div>

                    {/* Custom Date Picker if toggled */}
                    {showDatePicker && (
                        <div className="flex items-center gap-3 bg-slate-50 p-3 rounded-2xl border border-slate-200 animate-in fade-in duration-300">
                            <i className="fa-regular fa-calendar text-slate-400 ml-2"></i>
                            <input 
                                type="date" 
                                value={selectedDate} 
                                onChange={e => {
                                    setSelectedDate(e.target.value);
                                    setAnchorDate(new Date(e.target.value));
                                }}
                                className="bg-transparent font-bold text-sm text-slate-800 outline-none w-full cursor-pointer"
                            />
                        </div>
                    )}

                    {/* Saturday to Saturday Weekly Date Selector Strip */}
                    <div className="bg-slate-50/80 p-3 rounded-3xl border border-slate-200/70 space-y-2">
                        <div className="flex justify-between items-center px-2 text-[10px] font-black uppercase tracking-widest text-slate-400">
                            <button onClick={handlePrevWeek} className="hover:text-slate-900 transition-colors flex items-center gap-1">
                                <i className="fa-solid fa-chevron-left"></i> Prev Week
                            </button>
                            <span className="text-slate-600 font-bold">Saturday to Saturday Weekly Records</span>
                            <button onClick={handleNextWeek} className="hover:text-slate-900 transition-colors flex items-center gap-1">
                                Next Week <i className="fa-solid fa-chevron-right"></i>
                            </button>
                        </div>

                        {/* Day Pills Bar */}
                        <div className="flex gap-1.5 overflow-x-auto no-scrollbar py-1 px-1">
                            {weekDays.map((item, idx) => {
                                const isSelected = item.dateStr === selectedDate;
                                return (
                                    <button
                                        key={idx}
                                        onClick={() => setSelectedDate(item.dateStr)}
                                        className={`flex-1 min-w-[62px] py-2.5 px-2 rounded-2xl text-center transition-all duration-200 border flex flex-col items-center justify-center shrink-0 active:scale-95 ${
                                            isSelected 
                                                ? 'bg-emerald-600 text-white border-emerald-500 shadow-md shadow-emerald-500/20 scale-105' 
                                                : item.isToday
                                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200 font-black'
                                                    : 'bg-white text-slate-700 border-slate-200/60 hover:bg-slate-100'
                                        }`}
                                    >
                                        <span className={`text-[9px] font-black uppercase tracking-widest leading-none ${isSelected ? 'text-emerald-100' : 'text-slate-400'}`}>
                                            {item.dayShort}
                                        </span>
                                        <span className="text-base font-black leading-tight mt-0.5">
                                            {item.dayNumber}
                                        </span>
                                        {item.isToday && !isSelected && (
                                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-0.5"></span>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Class Selector Dropdown */}
                    <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Select Academic Class</label>
                        <select
                            value={selectedClass}
                            onChange={e => setSelectedClass(e.target.value)}
                            className="w-full p-3.5 bg-slate-50 border-2 border-slate-100 rounded-2xl font-black text-slate-800 focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all cursor-pointer text-base"
                        >
                            {availableClasses.map(c => (
                                <option key={c} value={c}>{c}</option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Special Days Alert */}
                {specialDays.length > 0 && (
                    <div className="px-6 md:px-8 space-y-3">
                        {specialDays.map(sd => (
                            <div key={sd.id} className="bg-amber-50 border-2 border-amber-200 p-4 rounded-2xl flex items-center gap-4">
                                <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center text-amber-600 text-lg flex-shrink-0">
                                    <i className="fa-solid fa-bullhorn"></i>
                                </div>
                                <div>
                                    <h4 className="font-bold text-amber-900 text-sm">{sd.type}: {sd.note}</h4>
                                    <p className="text-xs text-amber-700">{sd.className ? `Applies to ${sd.className}` : 'Applicable to all classes'}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Timetable Period Items List */}
                <div className="divide-y divide-slate-100">
                    {isLoading ? (
                        <div className="p-8">
                            <MobileFacultyEntrySkeleton studentCount={4} />
                        </div>
                    ) : classSchedule.length > 0 ? (
                        classSchedule.map((entry, idx) => {
                            const subject = subjects.find(s => s.id === entry.subjectId);
                            // Find matching attendance record for this period
                            const matchingRecord = attendanceRecords.find(r => 
                                (r.subjectId === entry.subjectId || r.subjectId.startsWith(`${entry.subjectId}_`)) &&
                                r.className === entry.className
                            );
                            const isMarked = Boolean(matchingRecord);
                            const facultyName = subject?.facultyName || entry.facultyName || 'Faculty Assigned';

                            return (
                                <div 
                                    key={idx} 
                                    className={`p-5 md:p-6 transition-all duration-300 flex items-center justify-between gap-4 group hover:bg-slate-50/80 ${isMarked ? 'bg-white' : 'bg-rose-50/20'}`}
                                >
                                    <div className="flex items-center gap-4 min-w-0">
                                        {/* Time pill badge */}
                                        <div className={`px-4 py-2.5 rounded-2xl text-xs font-black shrink-0 text-center tracking-tight border ${isMarked ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-rose-50 text-rose-600 border-rose-100'}`}>
                                            {formatTime(entry.startTime)}
                                        </div>

                                        {/* Content info */}
                                        <div className="min-w-0 space-y-1">
                                            <div className="flex items-center gap-2">
                                                {/* Colored Status Dot */}
                                                <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${isMarked ? 'bg-emerald-500 shadow-sm shadow-emerald-500/50' : 'bg-rose-500 animate-pulse'}`}></span>
                                                <h3 className="font-bold text-slate-900 text-base md:text-lg leading-tight truncate">
                                                    {entry.subjectName || subject?.name || 'Subject'}
                                                </h3>
                                            </div>
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-[10px] font-black uppercase rounded-md border border-slate-200">
                                                    {entry.className}
                                                </span>
                                                <span className={`px-2.5 py-0.5 text-[10px] font-bold uppercase rounded-md truncate max-w-[180px] ${isMarked ? 'bg-emerald-100/60 text-emerald-800' : 'bg-rose-100/60 text-rose-800'}`}>
                                                    {facultyName}
                                                </span>
                                                {!isMarked && (
                                                    <span className="text-[9px] font-bold text-rose-600 italic">
                                                        Unmarked — Remind Teacher
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Action Eye button */}
                                    <button
                                        onClick={() => setInspectedPeriod({ entry, subject, record: matchingRecord })}
                                        className={`w-11 h-11 rounded-2xl flex items-center justify-center transition-all shrink-0 border shadow-sm active:scale-95 ${
                                            isMarked 
                                                ? 'bg-emerald-50 text-emerald-600 border-emerald-200 hover:bg-emerald-600 hover:text-white' 
                                                : 'bg-white text-slate-400 border-slate-200 hover:bg-slate-900 hover:text-white'
                                        }`}
                                        title={isMarked ? 'View Period Attendance Details' : 'View Schedule Details'}
                                    >
                                        <i className="fa-regular fa-eye text-sm"></i>
                                    </button>
                                </div>
                            );
                        })
                    ) : (
                        <div className="text-center py-16 px-6 bg-slate-50/50">
                            <div className="w-16 h-16 bg-slate-100 text-slate-300 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl">
                                <i className="fa-solid fa-calendar-xmark"></i>
                            </div>
                            <h4 className="font-bold text-slate-700 text-base">No Schedule Found</h4>
                            <p className="text-slate-400 text-xs mt-1">There are no classes scheduled for {selectedClass} on {dayOfWeek} ({selectedDate}).</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Period Inspection Modal */}
            {inspectedPeriod && (
                <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white w-full max-w-md rounded-3xl p-6 shadow-2xl border border-slate-100 space-y-6 animate-in zoom-in-95 duration-200">
                        <div className="flex justify-between items-start">
                            <div>
                                <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${inspectedPeriod.record ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                                    {inspectedPeriod.record ? '✓ Attendance Marked' : '⚠ Attendance Pending'}
                                </span>
                                <h3 className="text-xl font-black text-slate-900 mt-2">{inspectedPeriod.entry.subjectName || inspectedPeriod.subject?.name}</h3>
                                <p className="text-xs text-slate-500 font-medium">Class {inspectedPeriod.entry.className} &bull; {formatTime(inspectedPeriod.entry.startTime)} - {formatTime(inspectedPeriod.entry.endTime)}</p>
                            </div>
                            <button 
                                onClick={() => setInspectedPeriod(null)}
                                className="w-9 h-9 bg-slate-100 text-slate-400 hover:text-slate-700 rounded-full flex items-center justify-center"
                            >
                                <i className="fa-solid fa-xmark"></i>
                            </button>
                        </div>

                        {inspectedPeriod.record ? (
                            <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-3 text-center">
                                    <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100">
                                        <div className="text-2xl font-black text-emerald-600">{inspectedPeriod.record.presentStudentIds.length}</div>
                                        <div className="text-[10px] font-black uppercase tracking-widest text-emerald-800">Present</div>
                                    </div>
                                    <div className="p-4 bg-rose-50 rounded-2xl border border-rose-100">
                                        <div className="text-2xl font-black text-rose-600">{inspectedPeriod.record.absentStudentIds.length}</div>
                                        <div className="text-[10px] font-black uppercase tracking-widest text-rose-800">Absent</div>
                                    </div>
                                </div>

                                <div className="text-xs text-slate-400 space-y-1 pt-2 border-t border-slate-100">
                                    <div>Marked By: <span className="font-bold text-slate-700">{inspectedPeriod.record.markedBy || 'Faculty'}</span></div>
                                    <div>Marked At: <span className="font-bold text-slate-700">{inspectedPeriod.record.markedAt ? new Date(inspectedPeriod.record.markedAt).toLocaleTimeString() : 'N/A'}</span></div>
                                </div>
                            </div>
                        ) : (
                            <div className="p-6 bg-rose-50/50 rounded-2xl border border-rose-100 text-center space-y-3">
                                <i className="fa-solid fa-clock-rotate-left text-3xl text-rose-400"></i>
                                <h4 className="font-bold text-rose-900 text-sm">Attendance Not Submitted Yet</h4>
                                <p className="text-xs text-rose-700">
                                    Faculty <span className="font-bold">{inspectedPeriod.subject?.facultyName || inspectedPeriod.entry.facultyName || 'assigned to this course'}</span> has not submitted attendance for this session on {selectedDate}.
                                </p>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Students can remind faculty to mark missing attendance.</p>
                            </div>
                        )}

                        <button
                            onClick={() => setInspectedPeriod(null)}
                            className="w-full py-3 bg-slate-900 text-white font-black text-xs uppercase tracking-widest rounded-2xl"
                        >
                            Close
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PublicAttendance;
