import React, { useState, useEffect } from 'react';
import { SubjectConfig, TimetableGeneratorConfig, TimetableEntry, StudentRecord, TimetableRule } from '../../../domain/entities/types';
import { dataService } from '../../../infrastructure/services/dataService';
import { DAYS } from '../../../domain/entities/constants';

interface TimetableGeneratorProps {
    subjects: SubjectConfig[];
    students: StudentRecord[];
}

const TimetableGenerator: React.FC<TimetableGeneratorProps> = ({ subjects, students }) => {
    const [selectedClass, setSelectedClass] = useState('');
    const [selectedSemester, setSelectedSemester] = useState<'Odd' | 'Even'>('Odd');
    const [config, setConfig] = useState<TimetableGeneratorConfig>({
        id: '',
        className: '',
        semester: 'Odd',
        workingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
        periodsPerDay: 4,
        periodDurationMins: 60,
        subjectWeeklyHours: {},
        breakSlots: [2], // Default break at period 3
        timeSlots: [
            { startTime: '09:00', endTime: '10:00' },
            { startTime: '10:00', endTime: '11:00' },
            { startTime: '11:00', endTime: '11:30' }, // Break
            { startTime: '11:30', endTime: '12:30' },
            { startTime: '12:30', endTime: '01:30' },
        ],
        rules: []
    });

    const [generatedTimetable, setGeneratedTimetable] = useState<TimetableEntry[]>([]);
    const [isGenerating, setIsGenerating] = useState(false);
    const [viewMode, setViewMode] = useState<'class' | 'subject'>('class');
    const [otherTimetables, setOtherTimetables] = useState<TimetableEntry[]>([]);

    const classes = [...new Set(students.map(s => s.className))];
    const filteredSubjects = subjects.filter(s => s.targetClasses.includes(selectedClass));

    useEffect(() => {
        if (selectedClass && selectedSemester) {
            loadConfig();
            loadGlobalTimetables();
        }
    }, [selectedClass, selectedSemester]);

    const loadGlobalTimetables = async () => {
        const allSystemTimetables = await dataService.getAllTimetables();
        setOtherTimetables(allSystemTimetables.filter(t => t.className !== selectedClass && t.semester === selectedSemester));
    };

    const isFacultyBusy = (facultyName: string | undefined, day: string, startTime: string, endTime: string) => {
        if (!facultyName || day === 'All') return false;
        return otherTimetables.some(t => {
            const sub = subjects.find(s => s.id === t.subjectId);
            if (sub?.facultyName !== facultyName) return false;
            if (t.day !== day) return false;
            if (!t.startTime || !startTime) return false;
            return (startTime < t.endTime && endTime > t.startTime);
        });
    };

    const getFacultyDailyCount = (facultyName: string | undefined, day: string, currentGrid?: Record<string, Record<number, TimetableEntry | null>>) => {
        if (!facultyName || day === 'All') return 0;
        let count = otherTimetables.filter(t => {
            if (t.day !== day) return false;
            const sub = subjects.find(s => s.id === t.subjectId);
            return sub?.facultyName === facultyName;
        }).length;
        if (currentGrid && currentGrid[day]) {
            Object.values(currentGrid[day]).forEach(entry => {
                if (entry) {
                    const sub = subjects.find(s => s.id === entry.subjectId);
                    if (sub?.facultyName === facultyName) count++;
                }
            });
        }
        return count;
    };

    const loadConfig = async () => {
        const savedConfig = await dataService.getGeneratorConfig(selectedClass, selectedSemester);
        if (savedConfig) {
            setConfig(savedConfig);
        } else {
            // Default weekly hours from subjects if available
            const initialHours: Record<string, number> = {};
            filteredSubjects.forEach(s => initialHours[s.id] = 4);
            setConfig({
                id: `${selectedClass}-${selectedSemester}`,
                className: selectedClass,
                semester: selectedSemester,
                workingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
                periodsPerDay: 4,
                periodDurationMins: 60,
                subjectWeeklyHours: initialHours,
                breakSlots: [2],
                timeSlots: [
                    { startTime: '09:00', endTime: '10:00' },
                    { startTime: '10:00', endTime: '11:00' },
                    { startTime: '11:00', endTime: '11:30' },
                    { startTime: '11:30', endTime: '12:30' },
                    { startTime: '12:30', endTime: '01:30' },
                ],
                rules: []
            });
        }
    };

    const handleSaveConfig = async () => {
        await dataService.saveGeneratorConfig(config);
        alert('Generator configuration saved!');
    };

    const generateTimetable = async () => {
        setIsGenerating(true);
        try {
            const days = config.workingDays;
            const periods = Array.from({ length: config.periodsPerDay }, (_, i) => i);

            // 1. Initialize grid
            const grid: Record<string, Record<number, TimetableEntry | null>> = {};
            days.forEach(day => {
                grid[day] = {};
                periods.forEach(p => grid[day][p] = null);
            });

            const subjectUsage: Record<string, number> = {};
            Object.keys(config.subjectWeeklyHours).forEach(id => subjectUsage[id] = 0);

                // 2. Apply FixedSlot rules first
                config.rules?.forEach(rule => {
                    if (rule.type === 'FixedSlot') {
                        const subject = subjects.find(s => s.id === rule.subjectId);
                        if (!subject) return;

                        const targetDays = rule.day === 'All' ? days : [rule.day].filter(d => days.includes(d as any));
                        targetDays.forEach(day => {
                            if (grid[day] && grid[day][rule.periodIndex] === null && !config.breakSlots?.includes(rule.periodIndex)) {
                                const slotTime = config.timeSlots?.[rule.periodIndex];
                                const facName = subject.facultyName;
                                if (slotTime?.startTime && slotTime?.endTime && isFacultyBusy(facName, day as string, slotTime.startTime, slotTime.endTime)) {
                                    console.warn(`Conflict: Faculty ${facName} is busy on ${day}. Skipping FixedSlot rule.`);
                                    return;
                                }
                                if (getFacultyDailyCount(facName, day as string, grid) >= 4) {
                                    console.warn(`Limit: Faculty ${facName} already has >= 4 classes on ${day}. Skipping FixedSlot rule.`);
                                    return;
                                }

                                grid[day][rule.periodIndex] = {
                                    id: Math.random().toString(36).substr(2, 9),
                                    day: day as any,
                                    subjectId: rule.subjectId,
                                    subjectName: subject.name,
                                    className: selectedClass,
                                    startTime: slotTime?.startTime || "",
                                    endTime: slotTime?.endTime || ""
                                };
                                subjectUsage[rule.subjectId] = (subjectUsage[rule.subjectId] || 0) + 1;
                            }
                        });
                    }

                    // FixedFaculty: Pin any subject taught by this faculty to the specified slot
                    if (rule.type === 'FixedFaculty') {
                        const facultySubject = filteredSubjects.find(s => s.facultyName?.toLowerCase() === rule.facultyName.toLowerCase());
                        if (!facultySubject) return;

                        const targetDays = rule.day === 'All' ? days : [rule.day].filter(d => days.includes(d as any));
                        targetDays.forEach(day => {
                            if (grid[day] && grid[day][rule.periodIndex] === null && !config.breakSlots?.includes(rule.periodIndex)) {
                                const slotTime = config.timeSlots?.[rule.periodIndex];
                                const facName = facultySubject.facultyName;
                                if (slotTime?.startTime && slotTime?.endTime && isFacultyBusy(facName, day as string, slotTime.startTime, slotTime.endTime)) {
                                    console.warn(`Conflict: Faculty ${facName} is busy on ${day}. Skipping FixedFaculty rule.`);
                                    return;
                                }
                                if (getFacultyDailyCount(facName, day as string, grid) >= 4) {
                                    console.warn(`Limit: Faculty ${facName} already has >= 4 classes on ${day}. Skipping FixedFaculty rule.`);
                                    return;
                                }

                                grid[day][rule.periodIndex] = {
                                    id: Math.random().toString(36).substr(2, 9),
                                    day: day as any,
                                    subjectId: facultySubject.id,
                                    subjectName: facultySubject.name,
                                    className: selectedClass,
                                    startTime: slotTime?.startTime || "",
                                    endTime: slotTime?.endTime || ""
                                };
                                subjectUsage[facultySubject.id] = (subjectUsage[facultySubject.id] || 0) + 1;
                            }
                        });
                    }

                    // FixedClass: Pin a specific class-subject combo to a slot
                    if (rule.type === 'FixedClass') {
                        const subject = subjects.find(s => s.id === rule.subjectId);
                        if (!subject) return;

                        const targetDays = rule.day === 'All' ? days : [rule.day].filter(d => days.includes(d as any));
                        targetDays.forEach(day => {
                            if (grid[day] && grid[day][rule.periodIndex] === null && !config.breakSlots?.includes(rule.periodIndex)) {
                                const slotTime = config.timeSlots?.[rule.periodIndex];
                                const facName = subject.facultyName;
                                if (slotTime?.startTime && slotTime?.endTime && isFacultyBusy(facName, day as string, slotTime.startTime, slotTime.endTime)) {
                                    console.warn(`Conflict: Faculty ${facName} is busy on ${day}. Skipping FixedClass rule.`);
                                    return;
                                }
                                if (getFacultyDailyCount(facName, day as string, grid) >= 4) {
                                    console.warn(`Limit: Faculty ${facName} already has >= 4 classes on ${day}. Skipping FixedClass rule.`);
                                    return;
                                }

                                grid[day][rule.periodIndex] = {
                                    id: Math.random().toString(36).substr(2, 9),
                                    day: day as any,
                                    subjectId: rule.subjectId,
                                    subjectName: subject.name,
                                    className: rule.className,
                                    startTime: slotTime?.startTime || "",
                                    endTime: slotTime?.endTime || ""
                                };
                                subjectUsage[rule.subjectId] = (subjectUsage[rule.subjectId] || 0) + 1;
                            }
                        });
                    }
                });

                // 3. Prepare remaining pool
                let pool: { subjectId: string, subjectName: string }[] = [];
                Object.entries(config.subjectWeeklyHours).forEach(([id, totalHours]) => {
                    const subject = subjects.find(s => s.id === id);
                    if (subject) {
                        const remaining = totalHours - (subjectUsage[id] || 0);
                        for (let i = 0; i < remaining; i++) {
                            pool.push({ subjectId: id, subjectName: subject.name });
                        }
                    }
                });

                // Shuffle pool
                pool = pool.sort(() => Math.random() - 0.5);

                // 4. Fill remaining slots randomly, respecting DayRestriction rules
                days.forEach(day => {
                    periods.forEach(p => {
                        if (config.breakSlots?.includes(p)) return;
                        if (grid[day][p] !== null) return;

                        // Check if day has restriction
                        const restriction = config.rules?.find(r => r.type === 'DayRestriction' && r.day === day);
                        const allowedIds = (restriction && restriction.type === 'DayRestriction') ? restriction.restrictedToSubjectIds : null;

                        const slotTime = config.timeSlots?.[p];
                        // Find first available subject that fits rule
                        const matchIndex = pool.findIndex(s => {
                            if (allowedIds && !allowedIds.includes(s.subjectId)) return false;
                            
                            const subject = subjects.find(sub => sub.id === s.subjectId);
                            const facName = subject?.facultyName;
                            
                            if (slotTime?.startTime && slotTime?.endTime && isFacultyBusy(facName, day as string, slotTime.startTime, slotTime.endTime)) {
                                return false;
                            }
                            
                            if (getFacultyDailyCount(facName, day as string, grid) >= 4) {
                                return false;
                            }
                            
                            return true;
                        });

                        if (matchIndex !== -1) {
                            grid[day][p] = {
                                id: Math.random().toString(36).substr(2, 9),
                                day: day as any,
                                subjectId: pool[matchIndex].subjectId,
                                subjectName: pool[matchIndex].subjectName,
                                className: selectedClass,
                                startTime: slotTime?.startTime || "",
                                endTime: slotTime?.endTime || ""
                            };
                            pool.splice(matchIndex, 1);
                        }
                    });
                });

                // Final flat list
                const finalEntries: TimetableEntry[] = [];
                days.forEach(day => {
                    periods.forEach(p => {
                        if (grid[day][p]) finalEntries.push(grid[day][p]!);
                    });
                });

                setGeneratedTimetable(finalEntries);
            } catch (error) {
                console.error('Generation failed:', error);
                alert('Generation failed. Please check if your rules and weekly hours are feasible.');
            } finally {
                setIsGenerating(false);
            }
    };

    const handleApplyTimetable = async () => {
        if (!generatedTimetable.length) return;
        if (confirm('This will overwrite any existing manual timetable for this class. Proceed?')) {
            try {
                const settings = await dataService.getGlobalSettings();
                const enrichedEntries = generatedTimetable.map(entry => ({
                    ...entry,
                    semester: selectedSemester,
                    academicYear: settings.currentAcademicYear
                }));
                
                await dataService.saveTimetableEntries(enrichedEntries);
                alert('Timetable applied successfully!');
            } catch (error) {
                console.error('Error applying timetable:', error);
                alert('Failed to apply timetable');
            }
        }
    };

    const handlePrint = () => {
        window.print();
    };

    const handleExportCSV = () => {
        if (!generatedTimetable.length) return;

        // Group by day for CSV structure
        const header = ['Day', ...Array.from({ length: config.periodsPerDay }).map((_, i) =>
            config.breakSlots?.includes(i) ? 'Break' : `Period ${i + 1}`
        )];

        const rows = config.workingDays.map(day => {
            const dayEntries = generatedTimetable.filter(e => e.day === day);
            const periodRow = Array.from({ length: config.periodsPerDay }).map((_, pIndex) => {
                if (config.breakSlots?.includes(pIndex)) return 'BREAK';

                const breakCount = config.breakSlots?.filter(s => s < pIndex).length || 0;
                const effectivePIndex = pIndex - breakCount;
                return dayEntries[effectivePIndex]?.subjectName || '---';
            });
            return [day, ...periodRow].map(cell => `"${cell}"`).join(',');
        });

        const csvContent = [header.join(','), ...rows].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `timetable_${config.className}_${config.semester}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="space-y-6">
            <style dangerouslySetInnerHTML={{
                __html: `
                @media print {
                    .no-print { display: none !important; }
                    .print-only { display: block !important; }
                    body { background: white !important; margin: 0 !important; padding: 0 !important; }
                    .print-container { 
                        width: 100% !important; 
                        margin: 0 !important; 
                        padding: 0 !important; 
                        box-shadow: none !important;
                        border: none !important;
                    }
                    table { border-collapse: collapse !important; width: 100% !important; }
                    th, td { border: 1px solid #cbd5e1 !important; padding: 12px !important; }
                    .bg-emerald-50 { background-color: #ecfdf5 !important; }
                    .text-emerald-700 { color: #047857 !important; }
                    .border-emerald-100 { border-color: #d1fae5 !important; }
                }
                .print-only { display: none; }
            `}} />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200">
                    <label className="block text-sm font-bold text-slate-700 mb-2">Class Selection</label>
                    <select
                        value={selectedClass}
                        onChange={(e) => setSelectedClass(e.target.value)}
                        className="w-full p-4 border border-slate-300 rounded-xl focus:ring-4 focus:ring-emerald-500/10"
                    >
                        <option value="">Select Class</option>
                        {classes.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                </div>
                <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200">
                    <label className="block text-sm font-bold text-slate-700 mb-2">Semester</label>
                    <div className="flex gap-2">
                        {['Odd', 'Even'].map(sem => (
                            <button
                                key={sem}
                                onClick={() => setSelectedSemester(sem as any)}
                                className={`flex-1 py-4 rounded-xl font-bold border transition-all ${selectedSemester === sem ? 'bg-slate-900 text-white border-slate-900 shadow-lg' : 'bg-white text-slate-600 border-slate-200'}`}
                            >
                                {sem} Semester
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {selectedClass && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Configuration Sidebar */}
                    <div className="lg:col-span-1 space-y-6">
                        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                            <h4 className="font-black text-slate-900 uppercase tracking-widest text-xs mb-6 flex items-center gap-2">
                                <i className="fa-solid fa-sliders text-emerald-500"></i> Generation Rules
                            </h4>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-2">Working Days</label>
                                    <div className="flex flex-wrap gap-2">
                                        {DAYS.map(day => (
                                            <button
                                                key={day}
                                                onClick={() => {
                                                    const updated = config.workingDays.includes(day as any)
                                                        ? config.workingDays.filter(d => d !== day)
                                                        : [...config.workingDays, day as any];
                                                    setConfig({ ...config, workingDays: updated });
                                                }}
                                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${config.workingDays.includes(day as any) ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' : 'bg-slate-50 text-slate-400 border border-slate-100'}`}
                                            >
                                                {day.slice(0, 3)}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-2">Periods / Day</label>
                                    <input
                                        type="number"
                                        value={config.periodsPerDay}
                                        onChange={(e) => {
                                            const count = parseInt(e.target.value);
                                            const updatedSlots = [...(config.timeSlots || [])];
                                            while (updatedSlots.length < count) updatedSlots.push({ startTime: '', endTime: '' });
                                            setConfig({ ...config, periodsPerDay: count, timeSlots: updatedSlots });
                                        }}
                                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl"
                                    />
                                </div>

                                <hr className="border-slate-100" />

                                <div>
                                    <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Time Slots & Durations</h5>
                                    <div className="space-y-2 max-h-48 overflow-y-auto pr-2 no-scrollbar">
                                        {Array.from({ length: config.periodsPerDay }).map((_, i) => (
                                            <div key={i} className={`p-3 rounded-xl border ${config.breakSlots?.includes(i) ? 'bg-amber-50 border-amber-100' : 'bg-slate-50 border-slate-100'}`}>
                                                <div className="flex justify-between items-center mb-2">
                                                    <span className="text-[10px] font-bold text-slate-500">Period {i + 1}</span>
                                                    <button
                                                        onClick={() => {
                                                            const updated = config.breakSlots?.includes(i)
                                                                ? config.breakSlots.filter(s => s !== i)
                                                                : [...(config.breakSlots || []), i];
                                                            setConfig({ ...config, breakSlots: updated });
                                                        }}
                                                        className={`text-[8px] font-black uppercase px-2 py-0.5 rounded ${config.breakSlots?.includes(i) ? 'bg-amber-500 text-white' : 'bg-slate-200 text-slate-500'}`}
                                                    >
                                                        {config.breakSlots?.includes(i) ? 'Break' : 'Mark Break'}
                                                    </button>
                                                </div>
                                                <div className="grid grid-cols-2 gap-2">
                                                    <input
                                                        type="time"
                                                        value={config.timeSlots?.[i]?.startTime || ''}
                                                        onChange={(e) => {
                                                            const updated = [...(config.timeSlots || [])];
                                                            if (!updated[i]) updated[i] = { startTime: '', endTime: '' };
                                                            updated[i].startTime = e.target.value;
                                                            setConfig({ ...config, timeSlots: updated });
                                                        }}
                                                        className="p-1 text-[10px] font-bold border border-slate-200 rounded bg-white"
                                                    />
                                                    <input
                                                        type="time"
                                                        value={config.timeSlots?.[i]?.endTime || ''}
                                                        onChange={(e) => {
                                                            const updated = [...(config.timeSlots || [])];
                                                            if (!updated[i]) updated[i] = { startTime: '', endTime: '' };
                                                            updated[i].endTime = e.target.value;
                                                            setConfig({ ...config, timeSlots: updated });
                                                        }}
                                                        className="p-1 text-[10px] font-bold border border-slate-200 rounded bg-white"
                                                    />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <hr className="border-slate-100" />

                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-2">Subject Hours (per week)</label>
                                    <div className="space-y-2 max-h-48 overflow-y-auto pr-2 no-scrollbar">
                                        {filteredSubjects.map(subject => (
                                            <div key={subject.id} className="flex items-center justify-between gap-3 p-2 bg-slate-50 rounded-lg">
                                                <span className="text-xs font-bold text-slate-700 truncate">{subject.name}</span>
                                                <input
                                                    type="number"
                                                    value={config.subjectWeeklyHours[subject.id] || 0}
                                                    onChange={(e) => setConfig({
                                                        ...config,
                                                        subjectWeeklyHours: {
                                                            ...config.subjectWeeklyHours,
                                                            [subject.id]: parseInt(e.target.value)
                                                        }
                                                    })}
                                                    className="w-16 p-1 text-center border border-slate-200 rounded-md text-xs font-black"
                                                />
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <hr className="border-slate-100" />

                                <div>
                                    <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Special Rules</h5>
                                    <div className="space-y-3">
                                        {config.rules?.map((rule, idx) => {
                                            let hasConflict = false;
                                            let hasLimit = false;
                                            let conflictReason = '';

                                            if (rule.type !== 'DayRestriction' && rule.day !== 'All') {
                                                const slotTime = config.timeSlots?.[rule.periodIndex];
                                                let facName = '';
                                                if (rule.type === 'FixedSlot' || rule.type === 'FixedClass') {
                                                    const sub = subjects.find(s => s.id === rule.subjectId);
                                                    facName = sub?.facultyName || '';
                                                } else if (rule.type === 'FixedFaculty') {
                                                    facName = rule.facultyName || '';
                                                }

                                                if (facName && slotTime?.startTime && slotTime?.endTime) {
                                                    if (isFacultyBusy(facName, rule.day as string, slotTime.startTime, slotTime.endTime)) {
                                                        hasConflict = true;
                                                        conflictReason = `Conflict: ${facName} is assigned elsewhere during this period.`;
                                                    } else if (getFacultyDailyCount(facName, rule.day as string) >= 4) {
                                                        hasLimit = true;
                                                        conflictReason = `Limit: ${facName} already has ≥4 classes on this day.`;
                                                    }
                                                }
                                            }

                                            return (
                                            <div key={rule.id} className={`p-3 rounded-xl border relative group/rule transition-all ${hasConflict ? 'bg-red-50 border-red-200' : hasLimit ? 'bg-orange-50 border-orange-200' : 'bg-slate-50 border-slate-100'}`}>
                                                <button
                                                    onClick={() => {
                                                        const updated = config.rules?.filter((_, i) => i !== idx);
                                                        setConfig({ ...config, rules: updated });
                                                    }}
                                                    className="absolute -top-2 -right-2 w-6 h-6 bg-red-100 text-red-600 rounded-full flex items-center justify-center opacity-0 group-hover/rule:opacity-100 transition-opacity z-10 shadow-sm"
                                                >
                                                    <i className="fa-solid fa-xmark text-[10px]"></i>
                                                </button>
                                                <div className="flex items-center gap-2 mb-1">
                                                <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase ${rule.type === 'FixedSlot' ? 'bg-blue-100 text-blue-600' : rule.type === 'FixedFaculty' ? 'bg-amber-100 text-amber-600' : rule.type === 'FixedClass' ? 'bg-teal-100 text-teal-600' : 'bg-purple-100 text-purple-600'}`}>
                                                        {rule.type === 'FixedSlot' ? 'Fixed Slot' : rule.type === 'FixedFaculty' ? 'Fixed Faculty' : rule.type === 'FixedClass' ? 'Fixed Class' : 'Restricted'}
                                                    </span>
                                                    <span className={`text-[10px] font-bold ${hasConflict || hasLimit ? 'text-red-700' : 'text-slate-600'}`}>{rule.day}</span>
                                                </div>

                                                {(hasConflict || hasLimit) && (
                                                    <div className={`mt-1 mb-2 flex items-center gap-1.5 px-2 py-1.5 rounded text-[9px] font-bold ${hasConflict ? 'bg-red-100 text-red-700 border border-red-200' : 'bg-orange-100 text-orange-700 border border-orange-200'}`}>
                                                        <i className="fa-solid fa-triangle-exclamation"></i>
                                                        <span>{conflictReason}</span>
                                                    </div>
                                                )}

                                                <div className="space-y-2 mt-2">
                                                    {rule.type === 'FixedSlot' ? (
                                                        <div className="grid grid-cols-2 gap-2">
                                                            <select
                                                                value={rule.day}
                                                                onChange={(e) => {
                                                                    const updated = [...(config.rules || [])];
                                                                    updated[idx] = { ...rule, day: e.target.value };
                                                                    setConfig({ ...config, rules: updated });
                                                                }}
                                                                className="p-1 text-[10px] bg-white border border-slate-200 rounded"
                                                            >
                                                                <option value="All">All Days</option>
                                                                {DAYS.map(d => <option key={d} value={d}>{d}</option>)}
                                                            </select>
                                                            <select
                                                                value={rule.periodIndex}
                                                                onChange={(e) => {
                                                                    const updated = [...(config.rules || [])];
                                                                    updated[idx] = { ...rule, periodIndex: parseInt(e.target.value) };
                                                                    setConfig({ ...config, rules: updated });
                                                                }}
                                                                className="p-1 text-[10px] bg-white border border-slate-200 rounded"
                                                            >
                                                                {Array.from({ length: config.periodsPerDay }).map((_, i) => (
                                                                    <option key={i} value={i}>Slot {i + 1}</option>
                                                                ))}
                                                            </select>
                                                            <select
                                                                value={rule.subjectId}
                                                                onChange={(e) => {
                                                                    const updated = [...(config.rules || [])];
                                                                    updated[idx] = { ...rule, subjectId: e.target.value };
                                                                    setConfig({ ...config, rules: updated });
                                                                }}
                                                                className="col-span-2 p-1 text-[10px] bg-white border border-slate-200 rounded"
                                                            >
                                                                {filteredSubjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                                            </select>
                                                        </div>
                                                    ) : rule.type === 'FixedFaculty' ? (
                                                        <div className="grid grid-cols-2 gap-2">
                                                            <select
                                                                value={rule.day}
                                                                onChange={(e) => {
                                                                    const updated = [...(config.rules || [])];
                                                                    updated[idx] = { ...rule, day: e.target.value };
                                                                    setConfig({ ...config, rules: updated });
                                                                }}
                                                                className="p-1 text-[10px] bg-white border border-slate-200 rounded"
                                                            >
                                                                <option value="All">All Days</option>
                                                                {DAYS.map(d => <option key={d} value={d}>{d}</option>)}
                                                            </select>
                                                            <select
                                                                value={rule.periodIndex}
                                                                onChange={(e) => {
                                                                    const updated = [...(config.rules || [])];
                                                                    updated[idx] = { ...rule, periodIndex: parseInt(e.target.value) };
                                                                    setConfig({ ...config, rules: updated });
                                                                }}
                                                                className="p-1 text-[10px] bg-white border border-slate-200 rounded"
                                                            >
                                                                {Array.from({ length: config.periodsPerDay }).map((_, i) => (
                                                                    <option key={i} value={i}>Slot {i + 1}</option>
                                                                ))}
                                                            </select>
                                                            <select
                                                                value={rule.facultyName}
                                                                onChange={(e) => {
                                                                    const updated = [...(config.rules || [])];
                                                                    updated[idx] = { ...rule, facultyName: e.target.value };
                                                                    setConfig({ ...config, rules: updated });
                                                                }}
                                                                className="col-span-2 p-1 text-[10px] bg-white border border-slate-200 rounded"
                                                            >
                                                                <option value="">Select Faculty</option>
                                                                {[...new Set(filteredSubjects.map(s => s.facultyName).filter(Boolean))].sort().map(f => (
                                                                    <option key={f} value={f}>{f}</option>
                                                                ))}
                                                            </select>
                                                        </div>
                                                    ) : rule.type === 'FixedClass' ? (
                                                        <div className="grid grid-cols-2 gap-2">
                                                            <select
                                                                value={rule.day}
                                                                onChange={(e) => {
                                                                    const updated = [...(config.rules || [])];
                                                                    updated[idx] = { ...rule, day: e.target.value };
                                                                    setConfig({ ...config, rules: updated });
                                                                }}
                                                                className="p-1 text-[10px] bg-white border border-slate-200 rounded"
                                                            >
                                                                <option value="All">All Days</option>
                                                                {DAYS.map(d => <option key={d} value={d}>{d}</option>)}
                                                            </select>
                                                            <select
                                                                value={rule.periodIndex}
                                                                onChange={(e) => {
                                                                    const updated = [...(config.rules || [])];
                                                                    updated[idx] = { ...rule, periodIndex: parseInt(e.target.value) };
                                                                    setConfig({ ...config, rules: updated });
                                                                }}
                                                                className="p-1 text-[10px] bg-white border border-slate-200 rounded"
                                                            >
                                                                {Array.from({ length: config.periodsPerDay }).map((_, i) => (
                                                                    <option key={i} value={i}>Slot {i + 1}</option>
                                                                ))}
                                                            </select>
                                                            <select
                                                                value={rule.className}
                                                                onChange={(e) => {
                                                                    const updated = [...(config.rules || [])];
                                                                    updated[idx] = { ...rule, className: e.target.value };
                                                                    setConfig({ ...config, rules: updated });
                                                                }}
                                                                className="p-1 text-[10px] bg-white border border-slate-200 rounded"
                                                            >
                                                                <option value="">Select Class</option>
                                                                {classes.map(c => <option key={c} value={c}>{c}</option>)}
                                                            </select>
                                                            <select
                                                                value={rule.subjectId}
                                                                onChange={(e) => {
                                                                    const updated = [...(config.rules || [])];
                                                                    updated[idx] = { ...rule, subjectId: e.target.value };
                                                                    setConfig({ ...config, rules: updated });
                                                                }}
                                                                className="p-1 text-[10px] bg-white border border-slate-200 rounded"
                                                            >
                                                                {filteredSubjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                                            </select>
                                                        </div>
                                                    ) : (
                                                        <div className="space-y-2">
                                                            <select
                                                                value={rule.day}
                                                                onChange={(e) => {
                                                                    const updated = [...(config.rules || [])];
                                                                    updated[idx] = { ...rule, day: e.target.value };
                                                                    setConfig({ ...config, rules: updated });
                                                                }}
                                                                className="w-full p-1 text-[10px] bg-white border border-slate-200 rounded"
                                                            >
                                                                {DAYS.map(d => <option key={d} value={d}>{d}</option>)}
                                                            </select>
                                                            <div className="flex flex-wrap gap-1">
                                                                {filteredSubjects.map(s => (
                                                                    <button
                                                                        key={s.id}
                                                                        onClick={() => {
                                                                            const current = rule.restrictedToSubjectIds;
                                                                            const updatedIds = current.includes(s.id)
                                                                                ? current.filter(id => id !== s.id)
                                                                                : [...current, s.id];
                                                                            const updated = [...(config.rules || [])];
                                                                            updated[idx] = { ...rule, restrictedToSubjectIds: updatedIds };
                                                                            setConfig({ ...config, rules: updated });
                                                                        }}
                                                                        className={`px-1.5 py-0.5 rounded-[4px] text-[8px] font-bold border transition-all ${rule.restrictedToSubjectIds.includes(s.id) ? 'bg-purple-100 text-purple-700 border-purple-200' : 'bg-white text-slate-400 border-slate-100'}`}
                                                                    >
                                                                        {s.name.slice(0, 8)}
                                                                    </button>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                            );
                                        })}

                                        <div className="grid grid-cols-2 gap-2">
                                            <button
                                                onClick={() => setConfig({
                                                    ...config,
                                                    rules: [
                                                        ...(config.rules || []),
                                                        {
                                                            id: Math.random().toString(36).substr(2, 9),
                                                            type: 'FixedSlot',
                                                            day: 'All',
                                                            periodIndex: 0,
                                                            subjectId: filteredSubjects[0]?.id || ''
                                                        }
                                                    ]
                                                })}
                                                className="py-2 border-2 border-dashed border-slate-200 rounded-xl text-[10px] font-black text-slate-400 hover:border-emerald-300 hover:text-emerald-500 transition-all"
                                            >
                                                + Fixed Slot
                                            </button>
                                            <button
                                                onClick={() => setConfig({
                                                    ...config,
                                                    rules: [
                                                        ...(config.rules || []),
                                                        {
                                                            id: Math.random().toString(36).substr(2, 9),
                                                            type: 'DayRestriction',
                                                            day: config.workingDays[0],
                                                            restrictedToSubjectIds: []
                                                        }
                                                    ]
                                                })}
                                                className="py-2 border-2 border-dashed border-slate-200 rounded-xl text-[10px] font-black text-slate-400 hover:border-purple-300 hover:text-purple-500 transition-all"
                                            >
                                                + Restriction
                                            </button>
                                            <button
                                                onClick={() => setConfig({
                                                    ...config,
                                                    rules: [
                                                        ...(config.rules || []),
                                                        {
                                                            id: Math.random().toString(36).substr(2, 9),
                                                            type: 'FixedFaculty',
                                                            day: 'All',
                                                            periodIndex: 0,
                                                            facultyName: filteredSubjects.find(s => s.facultyName)?.facultyName || ''
                                                        }
                                                    ]
                                                })}
                                                className="py-2 border-2 border-dashed border-slate-200 rounded-xl text-[10px] font-black text-slate-400 hover:border-amber-300 hover:text-amber-500 transition-all"
                                            >
                                                + Fixed Faculty
                                            </button>
                                            <button
                                                onClick={() => setConfig({
                                                    ...config,
                                                    rules: [
                                                        ...(config.rules || []),
                                                        {
                                                            id: Math.random().toString(36).substr(2, 9),
                                                            type: 'FixedClass',
                                                            day: 'All',
                                                            periodIndex: 0,
                                                            className: selectedClass,
                                                            subjectId: filteredSubjects[0]?.id || ''
                                                        }
                                                    ]
                                                })}
                                                className="py-2 border-2 border-dashed border-slate-200 rounded-xl text-[10px] font-black text-slate-400 hover:border-teal-300 hover:text-teal-500 transition-all"
                                            >
                                                + Fixed Class
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                <div className="pt-4 flex gap-2">
                                    <button
                                        onClick={handleSaveConfig}
                                        className="flex-1 py-3 bg-slate-100 text-slate-700 rounded-xl text-xs font-black hover:bg-slate-200 transition-all uppercase tracking-wider"
                                    >
                                        Save Params
                                    </button>
                                    <button
                                        onClick={generateTimetable}
                                        disabled={isGenerating}
                                        className="flex-[2] py-3 bg-emerald-600 text-white rounded-xl text-xs font-black hover:bg-emerald-700 transition-all shadow-lg uppercase tracking-wider disabled:opacity-50"
                                    >
                                        {isGenerating ? 'Generating...' : 'Generate New'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Preview Area */}
                    <div className="lg:col-span-2">
                        {generatedTimetable.length > 0 ? (
                            <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden print-container">
                                <div className="p-6 border-b border-slate-100 flex flex-wrap justify-between items-center gap-4 no-print">
                                    <h4 className="font-black text-slate-900 uppercase tracking-widest text-[10px]">Generated Timeline Preview</h4>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={handleExportCSV}
                                            className="px-4 py-2 bg-slate-100 text-slate-600 rounded-xl text-[10px] font-black hover:bg-slate-200 transition-all uppercase tracking-wider flex items-center gap-2"
                                        >
                                            <i className="fa-solid fa-file-csv"></i>
                                            CSV
                                        </button>
                                        <button
                                            onClick={handlePrint}
                                            className="px-4 py-2 bg-slate-800 text-white rounded-xl text-[10px] font-black hover:bg-slate-900 transition-all uppercase tracking-wider flex items-center gap-2"
                                        >
                                            <i className="fa-solid fa-print"></i>
                                            Print
                                        </button>
                                        <button
                                            onClick={handleApplyTimetable}
                                            className="bg-emerald-600 text-white px-4 py-2 rounded-xl text-[10px] font-black shadow-md hover:bg-emerald-700 uppercase tracking-wider"
                                        >
                                            Apply to System
                                        </button>
                                    </div>
                                </div>

                                {/* Print Header */}
                                <div className="print-only p-8 text-center border-b border-slate-200">
                                    <h1 className="text-2xl font-black text-slate-900 uppercase tracking-tighter">Academic Timetable</h1>
                                    <div className="flex justify-center gap-6 mt-2 text-xs font-black text-slate-500 uppercase tracking-widest">
                                        <span>Class: {config.className}</span>
                                        <span>Semester: {config.semester}</span>
                                        <span>Generated on: {new Date().toLocaleDateString()}</span>
                                    </div>
                                </div>

                                <div className="p-6">
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-left border-collapse min-w-[600px]">
                                            <thead>
                                                <tr>
                                                    <th className="p-4 text-[10px] font-black uppercase text-slate-400 tracking-widest border-b border-slate-100 bg-slate-50/50">Day</th>
                                                    {Array.from({ length: config.periodsPerDay }).map((_, i) => (
                                                        <th key={i} className="p-4 text-[10px] font-black uppercase text-slate-400 tracking-widest border-b border-slate-100 bg-slate-50/50">
                                                            <div className="flex flex-col">
                                                                <span>{config.breakSlots?.includes(i) ? 'Break' : `Period ${i + 1}`}</span>
                                                                <span className="text-[8px] font-bold text-slate-300 normal-case">
                                                                    {config.timeSlots?.[i]?.startTime || '--'} - {config.timeSlots?.[i]?.endTime || '--'}
                                                                </span>
                                                            </div>
                                                        </th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {config.workingDays.map(day => (
                                                    <tr key={day} className="hover:bg-slate-50/50 transition-colors">
                                                        <td className="p-4 font-black text-slate-900 border-b border-slate-100 bg-slate-50/30">{day}</td>
                                                        {Array.from({ length: config.periodsPerDay }).map((_, pIndex) => {
                                                            if (config.breakSlots?.includes(pIndex)) {
                                                                return <td key={pIndex} className="p-4 bg-slate-50/20 border-b border-slate-100 italic text-slate-300 text-[10px] text-center font-black uppercase tracking-widest">Break</td>;
                                                            }

                                                            const breakCount = config.breakSlots?.filter(s => s < pIndex).length || 0;
                                                            const effectivePIndex = pIndex - breakCount;

                                                            const dayEntries = generatedTimetable.filter(e => e.day === day);
                                                            const slotEntry = dayEntries[effectivePIndex];

                                                            return (
                                                                <td key={pIndex} className="p-4 border-b border-slate-100 min-w-[120px]">
                                                                    {slotEntry ? (
                                                                        <div className="bg-emerald-50 text-emerald-700 p-3 rounded-2xl border border-emerald-100 animate-in fade-in zoom-in-95 shadow-sm">
                                                                            <span className="text-[10px] font-black block leading-tight">{slotEntry.subjectName}</span>
                                                                            <span className="text-[8px] font-bold text-emerald-600/50 uppercase tracking-tighter mt-1 block">
                                                                                {subjects.find(s => s.id === slotEntry.subjectId)?.facultyName || 'Staff'}
                                                                            </span>
                                                                        </div>
                                                                    ) : (
                                                                        <div className="h-10 border-2 border-dashed border-slate-50 rounded-2xl"></div>
                                                                    )}
                                                                </td>
                                                            );
                                                        })}
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>

                                    <div className="mt-8 pt-8 border-t border-slate-50 flex justify-between items-center no-print">
                                        <div className="text-[10px] font-bold text-slate-400">
                                            <i className="fa-solid fa-circle-info mr-2"></i>
                                            Faculty names are automatically attached to subject blocks in the print view.
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-[3rem] p-24 text-center no-print">
                                <i className="fa-solid fa-wand-magic-sparkles text-6xl text-slate-200 mb-6 font-thin"></i>
                                <h3 className="text-slate-400 font-black uppercase tracking-widest text-sm">Waiting to Generate</h3>
                                <p className="text-slate-300 text-xs mt-2 font-bold italic tracking-tight">Adjust parameters on the left and start the engine</p>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default TimetableGenerator;
