import React, { useState, useEffect, useMemo, useCallback, memo } from 'react';
import { StudentRecord, SubjectConfig, AttendanceRecord, SpecialDay, TimetableEntry } from '../../../domain/entities/types';
import { dataService } from '../../../infrastructure/services/dataService';
import { useMobile } from '../../hooks/useMobile';
import { useTerm } from '../../viewmodels/TermContext';

interface AttendanceManagementProps {
    subjects: SubjectConfig[];
    students: StudentRecord[];
    currentUser?: any; // Add this
    onRefresh: () => void;
}

// Memoized student row - re-renders ONLY when this student's attendance status changes
const StudentAttendanceRow = memo(({ student, isPresent, onToggle }: { student: StudentRecord, isPresent: boolean, onToggle: (id: string) => void }) => (
    <div
        onClick={() => onToggle(student.id)}
        className="flex items-center justify-between p-4 hover:bg-slate-50 transition-colors cursor-pointer active:bg-slate-100 touch-pan-y"
    >
        <div className="flex-1 select-none">
            <div className="font-bold text-slate-900 text-base">{student.name}</div>
            <div className="text-[10px] text-slate-500 mt-0.5 font-bold">
                <span className="bg-slate-100 px-1.5 py-0.5 rounded mr-2 uppercase tracking-tighter">{student.className}</span>
                {student.adNo}
            </div>
        </div>
        <div className={`w-14 h-7 rounded-full relative transition-colors ${isPresent ? 'bg-emerald-500' : 'bg-slate-300'}`}>
            <div className={`absolute top-1 w-5 h-5 bg-white rounded-full transition-all shadow-sm ${isPresent ? 'right-1' : 'left-1'}`}></div>
        </div>
    </div>
));

const AttendanceManagement: React.FC<AttendanceManagementProps> = ({ subjects, students, currentUser, onRefresh }) => {
    const { isMobile } = useMobile();
    const { currentAcademicYear, currentSemester } = useTerm();
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [selectedClass, setSelectedClass] = useState('');
    const [selectedSubject, setSelectedSubject] = useState('');
    const [attendanceData, setAttendanceData] = useState<Record<string, boolean>>({});
    const [isSaving, setIsSaving] = useState(false);
    const [isSpecialDayMode, setIsSpecialDayMode] = useState(false);
    const [specialDayType, setSpecialDayType] = useState<'Leave' | 'Program'>('Leave');
    const [specialDayNote, setSpecialDayNote] = useState('');
    const [reports, setReports] = useState<Record<string, number>>({});

    const [allTimetables, setAllTimetables] = useState<TimetableEntry[]>([]);
    const [currentTime, setCurrentTime] = useState(new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' }));

    const [searchQuery, setSearchQuery] = useState('');

    const classes = useMemo(() => [...new Set(students.map(s => s.className))], [students]);
    const filteredSubjects = useMemo(() => subjects.filter(s => s.targetClasses.includes(selectedClass)), [subjects, selectedClass]);
    
    const filteredStudents = useMemo(() => {
        const subject = subjects.find(s => s.id === selectedSubject);
        const isSharedSubject = subject?.electiveType === 'cross-class';

        // Base list: If shared/cross-class subject, use all students in the portal (then filter by enrollment)
        // Otherwise, filter by selected class.
        let list = isSharedSubject 
            ? students.filter(s => subject?.targetClasses?.includes(s.className))
            : students.filter(s => s.className === selectedClass);
        
        // Optimize for elective subjects: strictly show only enrolled students
        if (subject && subject.subjectType === 'elective') {
            if (subject.enrolledStudents) {
                list = list.filter(s => subject.enrolledStudents.includes(s.id));
            } else if (!isSharedSubject) {
                // If elective but no enrollment defined, and not shared, 
                // we treat it as "whole class" elective (rare but possible).
            }
        }

        // Apply quick search
        if (searchQuery.trim() !== '') {
            const query = searchQuery.toLowerCase();
            list = list.filter(s => 
                s.name.toLowerCase().includes(query) || 
                (s.adNo && s.adNo.toLowerCase().includes(query))
            );
        }

        return list;
    }, [students, selectedClass, selectedSubject, subjects, searchQuery]);

    useEffect(() => {
        const loadAllTimetables = async () => {
            const data = await dataService.getAllTimetables();
            setAllTimetables(data);
        };
        loadAllTimetables();

        const timer = setInterval(() => {
            setCurrentTime(new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' }));
        }, 60000);
        return () => clearInterval(timer);
    }, []);

    const dayName = useMemo(() => {
        return new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(new Date());
    }, []);

    const liveClasses = useMemo(() => {
        return allTimetables.filter(t => {
            if (t.day !== dayName) return false;
            // Ensure strictly HH:mm comparison
            const currentHM = currentTime.substring(0, 5);
            return currentHM >= t.startTime && currentHM <= t.endTime;
        });
    }, [allTimetables, currentTime, dayName]);

    const upcomingClasses = useMemo(() => {
        return allTimetables
            .filter(t => t.day === dayName && t.startTime > currentTime.substring(0, 5))
            .sort((a, b) => a.startTime.localeCompare(b.startTime))
            .slice(0, 4);
    }, [allTimetables, currentTime, dayName]);

    useEffect(() => {
        if (selectedClass && selectedSubject && selectedDate) {
            loadAttendance();
        }
    }, [selectedClass, selectedSubject, selectedDate]);

    const loadAttendance = async () => {
        const records = await dataService.getAttendanceByClassAndDate(selectedClass, selectedDate);
        const record = records.find(r => r.subjectId === selectedSubject);

        const initialAttendance: Record<string, boolean> = {};
        if (record) {
            record.presentStudentIds.forEach(id => initialAttendance[id] = true);
            record.absentStudentIds.forEach(id => initialAttendance[id] = false);
        } else {
            filteredStudents.forEach(s => initialAttendance[s.id] = true); // Default all present
        }
        setAttendanceData(initialAttendance);
    };

    const handleSelectLiveClass = (entry: TimetableEntry) => {
        setSelectedClass(entry.className);
        setSelectedSubject(entry.subjectId);
        setSelectedDate(new Date().toISOString().split('T')[0]);
        setSearchQuery('');
        setIsSpecialDayMode(false);
    };

    const handleToggleAttendance = useCallback((studentId: string) => {
        setAttendanceData(prev => ({ ...prev, [studentId]: !prev[studentId] }));
    }, []);

    const handleSaveAttendance = async () => {
        if (!selectedSubject) return;

        const subject = subjects.find(s => s.id === selectedSubject);
        const isSharedSubject = subject?.electiveType === 'cross-class';

        setIsSaving(true);
        try {
            // If shared subject, we might be saving for multiple classes at once
            if (isSharedSubject) {
                // Group students by their class
                const classGroups: Record<string, { present: string[], absent: string[] }> = {};
                filteredStudents.forEach(s => {
                    if (!classGroups[s.className]) {
                        classGroups[s.className] = { present: [], absent: [] };
                    }
                    if (attendanceData[s.id] ?? true) {
                        classGroups[s.className].present.push(s.id);
                    } else {
                        classGroups[s.className].absent.push(s.id);
                    }
                });

                // Save one record per class
                const savePromises = Object.entries(classGroups).map(([className, data]) => 
                    dataService.markAttendance({
                        date: selectedDate,
                        subjectId: selectedSubject,
                        className: className,
                        presentStudentIds: data.present,
                        absentStudentIds: data.absent,
                        markedBy: currentUser?.name || 'System Admin',
                        markedAt: Date.now(),
                        academicYear: currentAcademicYear,
                        semester: currentSemester
                    })
                );
                await Promise.all(savePromises);
            } else {
                // Standard single-class marking
                if (!selectedClass) {
                    alert('Please select a class.');
                    setIsSaving(false);
                    return;
                }
                const presentIds = Object.keys(attendanceData).filter(id => attendanceData[id] ?? true);
                const absentIds = filteredStudents.filter(s => !attendanceData[s.id]).map(s => s.id);

                await dataService.markAttendance({
                    date: selectedDate,
                    subjectId: selectedSubject,
                    className: selectedClass,
                    presentStudentIds: presentIds,
                    absentStudentIds: absentIds,
                    markedBy: currentUser?.name || 'System Admin',
                    markedAt: Date.now(),
                    academicYear: currentAcademicYear,
                    semester: currentSemester
                });
            }

            alert('Attendance saved!');
            onRefresh();
        } catch (error) {
            console.error('Attendance save error:', error);
            alert('Failed to save attendance.');
        } finally {
            setIsSaving(false);
        }
    };

    const handleSaveSpecialDay = async () => {
        if (!selectedDate || !specialDayNote) return;

        setIsSaving(true);
        try {
            await dataService.markSpecialDay({
                date: selectedDate,
                type: specialDayType,
                note: specialDayNote,
                className: selectedClass || undefined
            });
            alert(`${specialDayType} marked for ${selectedDate}`);
            setIsSpecialDayMode(false);
            setSpecialDayNote('');
            onRefresh();
        } catch (error) {
            alert('Failed to save special day.');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="space-y-6">
            {/* Live & Upcoming Classes Feed - Improved Visibility */}
            <div className="space-y-3">
                <div className="flex items-center justify-between px-2">
                    <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Live & Upcoming Today</h4>
                    <div className="text-[10px] font-bold text-emerald-500 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-100 uppercase tracking-tighter">
                        {dayName}, {currentTime.substring(0, 5)}
                    </div>
                </div>

                {allTimetables.length === 0 ? (
                    <div className="mx-2 p-4 bg-slate-50 border border-dashed border-slate-200 rounded-2xl text-center">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">No timetables found. Generate and apply one to see live feed.</p>
                    </div>
                ) : (liveClasses.length === 0 && upcomingClasses.length === 0) ? (
                    <div className="mx-2 p-4 bg-slate-50 border border-slate-200 rounded-2xl text-center">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">No sessions scheduled for the remainder of today.</p>
                    </div>
                ) : (
                    <div className="flex gap-4 overflow-x-auto pb-4 no-scrollbar -mx-2 px-2">
                        {liveClasses.map(entry => (
                            <div
                                key={entry.id}
                                onClick={() => handleSelectLiveClass(entry)}
                                className={`flex-shrink-0 w-64 p-5 rounded-[2rem] border-2 transition-all cursor-pointer group relative overflow-hidden ${selectedClass === entry.className && selectedSubject === entry.subjectId ? 'bg-emerald-600 border-emerald-500 shadow-xl scale-[1.02]' : 'bg-white border-emerald-100 hover:border-emerald-300 shadow-sm'}`}
                            >
                                <div className="absolute top-0 right-0 p-4">
                                    <div className={`w-2 h-2 rounded-full animate-pulse ${selectedClass === entry.className && selectedSubject === entry.subjectId ? 'bg-white' : 'bg-emerald-500'}`}></div>
                                </div>
                                <div className="space-y-3 relative z-10">
                                    <div>
                                        <span className={`text-[8px] font-black uppercase tracking-widest ${selectedClass === entry.className && selectedSubject === entry.subjectId ? 'text-emerald-100' : 'text-emerald-600'}`}>Ongoing Now</span>
                                        <h5 className={`text-base font-black leading-tight ${selectedClass === entry.className && selectedSubject === entry.subjectId ? 'text-white' : 'text-slate-900 group-hover:text-emerald-700'}`}>{entry.subjectName}</h5>
                                    </div>
                                    <div className="flex items-end justify-between">
                                        <div>
                                            <div className={`text-[10px] font-bold ${selectedClass === entry.className && selectedSubject === entry.subjectId ? 'text-emerald-100' : 'text-slate-400'}`}>{entry.className}</div>
                                            <div className={`text-[10px] font-black ${selectedClass === entry.className && selectedSubject === entry.subjectId ? 'text-white' : 'text-slate-900'}`}>{entry.startTime} - {entry.endTime}</div>
                                        </div>
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${selectedClass === entry.className && selectedSubject === entry.subjectId ? 'bg-white text-emerald-600' : 'bg-emerald-50 text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white'}`}>
                                            <i className="fa-solid fa-chevron-right text-[10px]"></i>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                        {upcomingClasses.map(entry => (
                            <div
                                key={entry.id}
                                onClick={() => handleSelectLiveClass(entry)}
                                className={`flex-shrink-0 w-64 p-5 rounded-[2rem] border-2 transition-all cursor-pointer group ${selectedClass === entry.className && selectedSubject === entry.subjectId ? 'bg-slate-800 border-slate-700 shadow-xl scale-[1.02]' : 'bg-white border-slate-100 hover:border-slate-300 shadow-sm'}`}
                            >
                                <div className="space-y-3">
                                    <div>
                                        <span className={`text-[8px] font-black uppercase tracking-widest ${selectedClass === entry.className && selectedSubject === entry.subjectId ? 'text-slate-400' : 'text-slate-400'}`}>Upcoming</span>
                                        <h5 className={`text-base font-black leading-tight ${selectedClass === entry.className && selectedSubject === entry.subjectId ? 'text-white' : 'text-slate-900 group-hover:text-slate-700'}`}>{entry.subjectName}</h5>
                                    </div>
                                    <div className="flex items-end justify-between">
                                        <div>
                                            <div className={`text-[10px] font-bold ${selectedClass === entry.className && selectedSubject === entry.subjectId ? 'text-slate-500' : 'text-slate-400'}`}>{entry.className}</div>
                                            <div className={`text-[10px] font-black ${selectedClass === entry.className && selectedSubject === entry.subjectId ? 'text-white' : 'text-slate-900'}`}>{entry.startTime}</div>
                                        </div>
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${selectedClass === entry.className && selectedSubject === entry.subjectId ? 'bg-white text-slate-800' : 'bg-slate-50 text-slate-400 group-hover:bg-slate-800 group-hover:text-white'}`}>
                                            <i className="fa-solid fa-calendar-check text-[10px]"></i>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
            <div className="flex flex-col md:flex-row md:items-end gap-4 bg-slate-50 p-6 rounded-2xl border border-slate-200">
                <div className="flex-1">
                    <label className="block text-sm font-medium text-slate-700 mb-1">Date</label>
                    <input
                        type="date"
                        value={selectedDate}
                        onChange={(e) => setSelectedDate(e.target.value)}
                        className="w-full p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500"
                    />
                </div>
                <div className="flex-1">
                    <label className="block text-sm font-medium text-slate-700 mb-1">Class</label>
                    <select
                        value={selectedClass}
                        onChange={(e) => setSelectedClass(e.target.value)}
                        className="w-full p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500"
                    >
                        <option value="">Select Class</option>
                        {classes.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                </div>
                {!isSpecialDayMode && (
                    <div className="flex-1">
                        <label className="block text-sm font-medium text-slate-700 mb-1">Subject</label>
                        <select
                            value={selectedSubject}
                            onChange={(e) => setSelectedSubject(e.target.value)}
                            disabled={!selectedClass}
                            className="w-full p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 disabled:bg-slate-100"
                        >
                            <option value="">Select Subject</option>
                            {filteredSubjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                    </div>
                )}
                <button
                    onClick={() => setIsSpecialDayMode(!isSpecialDayMode)}
                    className={`px-4 py-3 rounded-xl font-bold transition-all ${isSpecialDayMode ? 'bg-slate-200 text-slate-800' : 'bg-amber-100 text-amber-700 hover:bg-amber-200'}`}
                >
                    <i className={`fa-solid ${isSpecialDayMode ? 'fa-xmark' : 'fa-calendar-day'} mr-2`}></i>
                    {isSpecialDayMode ? 'Cancel' : 'Mark Special Day'}
                </button>
            </div>

            {isSpecialDayMode ? (
                <div className="bg-amber-50 p-6 rounded-2xl border border-amber-200 shadow-sm animate-in fade-in slide-in-from-top-4">
                    <h3 className="text-lg font-bold text-amber-900 mb-4">Register Special Day</h3>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-amber-800 mb-1">Event Type</label>
                            <div className="flex gap-4">
                                {['Leave', 'Program'].map(type => (
                                    <button
                                        key={type}
                                        onClick={() => setSpecialDayType(type as any)}
                                        className={`px-6 py-2 rounded-lg font-medium transition-all ${specialDayType === type ? 'bg-amber-600 text-white' : 'bg-white text-amber-600 border border-amber-300'}`}
                                    >
                                        {type}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-amber-800 mb-1">Note / Description</label>
                            <input
                                type="text"
                                value={specialDayNote}
                                onChange={(e) => setSpecialDayNote(e.target.value)}
                                placeholder="e.g., National Holiday, Sports Day, etc."
                                className="w-full p-3 border border-amber-300 rounded-xl focus:ring-2 focus:ring-amber-500"
                            />
                            <p className="text-xs text-amber-700 mt-1">This will apply to {selectedClass || 'all classes'} on {selectedDate}.</p>
                        </div>
                        <button
                            onClick={handleSaveSpecialDay}
                            disabled={!specialDayNote || isSaving}
                            className="w-full py-4 bg-amber-600 text-white font-bold rounded-xl shadow-lg hover:bg-amber-700 disabled:opacity-50"
                        >
                            Save Special Day
                        </button>
                    </div>
                </div>
            ) : selectedClass && selectedSubject ? (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden relative">
                    <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-col items-start gap-3 sticky top-0 z-10">
                        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center w-full gap-3">
                            <h3 className="font-bold text-slate-900">
                                Mark Attendance: {filteredStudents.length} Students
                            </h3>
                            <div className="relative w-full sm:w-64">
                                <i className="fa-solid fa-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"></i>
                                <input 
                                    type="text" 
                                    placeholder="Search student..." 
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full text-sm pl-9 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 bg-white"
                                />
                            </div>
                        </div>
                        <div className="flex gap-2 w-full justify-between sm:justify-end bg-white sm:bg-transparent p-2 sm:p-0 rounded-lg border sm:border-none border-slate-200">
                            <button onClick={() => {
                                const allPresent = { ...attendanceData };
                                filteredStudents.forEach(s => allPresent[s.id] = true);
                                setAttendanceData(allPresent);
                            }} className="flex-1 sm:flex-none text-xs font-bold text-emerald-600 hover:bg-emerald-50 sm:hover:bg-transparent rounded px-2 py-1 transition-colors">All Present</button>
                            <span className="text-slate-300 hidden sm:inline">|</span>
                            <button onClick={() => {
                                const allAbsent = { ...attendanceData };
                                filteredStudents.forEach(s => allAbsent[s.id] = false);
                                setAttendanceData(allAbsent);
                            }} className="flex-1 sm:flex-none text-xs font-bold text-rose-600 hover:bg-rose-50 sm:hover:bg-transparent rounded px-2 py-1 transition-colors">All Absent</button>
                        </div>
                    </div>
                    <div className="divide-y divide-slate-100">
                        {filteredStudents.map(student => (
                            <StudentAttendanceRow
                                key={student.id}
                                student={student}
                                isPresent={attendanceData[student.id] ?? true}
                                onToggle={handleToggleAttendance}
                            />
                        ))}
                    </div>
                    <div className="p-6 bg-slate-50 border-t border-slate-200">
                        <button
                            onClick={handleSaveAttendance}
                            disabled={isSaving}
                            className="w-full py-4 bg-emerald-600 text-white font-bold rounded-xl shadow-lg hover:bg-emerald-700 disabled:opacity-50 transition-all"
                        >
                            {isSaving ? 'Saving...' : 'Save Attendance Records'}
                        </button>
                    </div>
                </div>
            ) : (
                <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center">
                    <i className="fa-solid fa-clipboard-user text-4xl text-slate-300 mb-4"></i>
                    <p className="text-slate-500">Please select a class and subject to mark attendance.</p>
                </div>
            )}
        </div>
    );
};

export default AttendanceManagement;
