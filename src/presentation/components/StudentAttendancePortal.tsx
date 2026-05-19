import React, { useState, useEffect } from 'react';
import { dataService } from '../../infrastructure/services/dataService';
import { StudentRecord, SubjectConfig } from '../../domain/entities/types';
import { MobileFacultyEntrySkeleton } from './SkeletonLoaders';
import { useTerm } from '../viewmodels/TermContext';
import { TermSelector } from './TermSelector';

const StudentAttendancePortal: React.FC = () => {
    const { activeTerm } = useTerm();
    const [selectedTermKey, setSelectedTermKey] = useState(activeTerm);
    const [adNo, setAdNo] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [student, setStudent] = useState<StudentRecord | null>(null);
    const [attendanceData, setAttendanceData] = useState<Array<{ 
        subject: SubjectConfig; 
        percentage: number; 
        present: number; 
        total: number;
        absentRecords: Array<{ date: string; className: string; reason?: string }>;
    }>>([]);
    const [expandedSubjectId, setExpandedSubjectId] = useState<string | null>(null);
    const [error, setError] = useState('');

    useEffect(() => {
        setSelectedTermKey(activeTerm);
    }, [activeTerm]);

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!adNo.trim()) return;

        setIsLoading(true);
        setError('');
        setStudent(null);
        setAttendanceData([]);

        try {
            const foundStudent = await dataService.getStudentByAdNo(adNo.trim(), selectedTermKey);
            if (!foundStudent) {
                setError(`No student found with this admission number in ${selectedTermKey}.`);
                return;
            }

            setStudent(foundStudent);
            const subjectsList = await dataService.getSubjectsByClass(foundStudent.className, selectedTermKey);

            const stats = await Promise.all(subjectsList.map(async (subject) => {
                const records = await dataService.getAttendanceForStudent(foundStudent.id, subject.id, selectedTermKey);
                const total = records.length;
                const present = records.filter(r => r.presentStudentIds.includes(foundStudent.id)).length;
                const percentage = total > 0 ? (present / total) * 100 : 100;

                const absentRecords = records
                    .filter(r => r.absentStudentIds.includes(foundStudent.id))
                    .map(r => ({
                        date: r.date,
                        className: r.className,
                        reason: r.absentReasons?.[foundStudent.id]
                    }))
                    .sort((a, b) => b.date.localeCompare(a.date));

                return {
                    subject,
                    percentage,
                    present,
                    total,
                    absentRecords
                };
            }));

            setAttendanceData(stats);
        } catch (err) {
            console.error(err);
            setError('An error occurred while fetching attendance data.');
        } finally {
            setIsLoading(false);
        }
    };

    const getDayOfWeek = (dateStr: string) => {
        const d = new Date(dateStr);
        return new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(d);
    };

    const formatDate = (dateStr: string) => {
        const d = new Date(dateStr);
        return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(d);
    };

    return (
        <div className="max-w-4xl mx-auto p-6 space-y-8 pb-20">
            <div className="text-center space-y-4 mb-4">
                <div className="animate-in fade-in slide-in-from-top-4 duration-500">
                    <h1 className="text-2xl font-black text-slate-900 tracking-tighter uppercase">Attendance</h1>
                    <p className="text-xs text-slate-500 font-medium italic">Track your academic progress</p>
                </div>
                
                <div className="inline-flex items-center gap-2 bg-white/50 backdrop-blur-sm p-1.5 rounded-2xl border border-slate-200/60 shadow-sm">
                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 ml-2">Term</span>
                    <TermSelector 
                        variant="light" 
                        className="!bg-white border-slate-100 shadow-none h-8 py-0 scale-90" 
                        value={selectedTermKey}
                        onChange={(val) => setSelectedTermKey(val)}
                    />
                </div>
            </div>

            <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-xl max-w-md mx-auto">
                <form onSubmit={handleSearch} className="space-y-4">
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">Admission Number</label>
                        <div className="relative">
                            <input
                                type="text"
                                value={adNo}
                                onChange={(e) => setAdNo(e.target.value)}
                                placeholder="Enter Ad No..."
                                className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all font-bold text-base"
                            />
                            <i className="fa-solid fa-hashtag absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-sm"></i>
                        </div>
                    </div>
                    <button
                        type="submit"
                        disabled={isLoading || !adNo}
                        className="w-full py-3 bg-emerald-600 text-white font-black text-sm uppercase tracking-widest rounded-2xl shadow-lg shadow-emerald-200 hover:bg-emerald-700 disabled:opacity-50 transition-all flex items-center justify-center gap-3"
                    >
                        {isLoading ? <i className="fa-solid fa-circle-notch fa-spin"></i> : <i className="fa-solid fa-search"></i>}
                        Check Attendance
                    </button>
                </form>
                {error && <p className="text-rose-600 text-sm font-bold mt-4 text-center">{error}</p>}
            </div>

            {isLoading && <MobileFacultyEntrySkeleton studentCount={3} />}

            {student && attendanceData.length > 0 && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-6 duration-700">
                    <div className="bg-slate-900 text-white p-7 rounded-[2.5rem] shadow-2xl relative overflow-hidden border border-slate-800">
                        <div className="relative z-10">
                            <div className="flex items-center gap-2 mb-4">
                                <span className="px-3 py-1 bg-emerald-500/10 text-emerald-400 rounded-full text-[9px] font-black uppercase tracking-widest border border-emerald-500/20">Official Transcript</span>
                                <div className="h-px flex-1 bg-slate-800"></div>
                            </div>
                            <h2 className="text-mobile-3xl font-black mb-1 text-white leading-none">{student.name}</h2>
                            <div className="flex items-center gap-2 mt-3">
                                <span className="text-slate-400 font-bold text-xs">Class {student.className}</span>
                                <span className="w-1 h-1 bg-slate-700 rounded-full"></span>
                                <span className="text-slate-400 font-bold text-sm">Adm #{student.adNo}</span>
                            </div>
                        </div>
                        <div className="absolute -right-6 -top-6 w-32 h-32 bg-emerald-500/5 rounded-full blur-3xl"></div>
                        <i className="fa-solid fa-user-graduate absolute -right-6 -bottom-6 text-8xl text-slate-800/40 rotate-12"></i>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {attendanceData.map((stat, idx) => (
                            <div key={idx} className={`bg-white rounded-[2rem] border transition-all duration-300 overflow-hidden ${expandedSubjectId === stat.subject.id ? 'border-emerald-500 shadow-xl shadow-emerald-500/10 ring-1 ring-emerald-500/20 scale-[1.02]' : 'border-slate-100 shadow-sm'}`}>
                                <div className="p-6 pt-7 cursor-pointer active:scale-[0.98] transition-transform" onClick={() => setExpandedSubjectId(expandedSubjectId === stat.subject.id ? null : stat.subject.id)}>
                                    <div className="flex justify-between items-start mb-5">
                                        <div className="min-w-0 pr-4">
                                            <h3 className={`text-mobile-xl font-bold leading-tight transition-colors ${expandedSubjectId === stat.subject.id ? 'text-emerald-600' : 'text-slate-900'}`}>{stat.subject.name}</h3>
                                            <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.1em] mt-1 truncate">{stat.subject.facultyName || 'No Faculty assigned'}</p>
                                        </div>
                                        <div className={`shrink-0 h-14 w-14 rounded-2xl flex flex-col items-center justify-center font-black ${stat.percentage < 75 ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'}`}>
                                            <span className="text-lg leading-none">{Math.round(stat.percentage)}</span>
                                            <span className="text-[9px] opacity-60 font-bold uppercase tracking-tighter">%</span>
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        <div className="w-full h-2 bg-slate-50 rounded-full overflow-hidden border border-slate-100">
                                            <div
                                                className={`h-full transition-all duration-1000 rounded-full ${stat.percentage < 75 ? 'bg-rose-500' : 'bg-emerald-500'}`}
                                                style={{ width: `${stat.percentage}%` }}
                                            ></div>
                                        </div>
                                        <div className="flex justify-between items-center bg-slate-50/50 p-2 rounded-xl border border-slate-100/50">
                                            <span className="text-[10px] font-black text-slate-400 uppercase ml-2 tracking-widest">Attendance Log</span>
                                            <span className="text-sm font-black text-slate-900 mr-2">{stat.present}<span className="text-slate-300 mx-1.5">/</span>{stat.total}</span>
                                        </div>
                                        {stat.percentage < 75 && (
                                            <div className="flex items-center gap-2 text-rose-600 bg-rose-50/80 backdrop-blur-sm p-3 rounded-xl border border-rose-100">
                                                <i className="fa-solid fa-triangle-exclamation animate-pulse"></i>
                                                <span className="text-[10px] font-black uppercase tracking-tighter">Attendance Warning: Low Eligibility</span>
                                            </div>
                                        )}
                                        <div className="flex justify-center pt-1">
                                            <div className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-[0.2em] transition-all flex items-center gap-2 ${expandedSubjectId === stat.subject.id ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                                                {expandedSubjectId === stat.subject.id ? 'Close Log' : 'View Absences'}
                                                <i className={`fa-solid ${expandedSubjectId === stat.subject.id ? 'fa-chevron-up' : 'fa-chevron-down'}`}></i>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {expandedSubjectId === stat.subject.id && (
                                    <div className="bg-slate-50 border-t border-slate-100 p-6 animate-in slide-in-from-top-4 duration-500">
                                        <div className="flex items-center gap-3 mb-6">
                                            <div className="h-px flex-1 bg-slate-200"></div>
                                            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] whitespace-nowrap">Missed Sessions Log</h4>
                                            <div className="h-px flex-1 bg-slate-200"></div>
                                        </div>
                                        
                                        {stat.absentRecords.length > 0 ? (
                                            <div className="space-y-4">
                                                {stat.absentRecords.map((absent, i) => (
                                                    <div key={i} className="bg-white p-5 rounded-2xl border border-slate-200/60 shadow-sm relative overflow-hidden group">
                                                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-rose-400 rounded-full opacity-60"></div>
                                                        <div className="flex justify-between items-start">
                                                            <div className="flex flex-col gap-1">
                                                                <div className="flex items-center gap-2">
                                                                    <span className="text-[13px] font-black text-slate-900 leading-none">{getDayOfWeek(absent.date)}</span>
                                                                    <span className="px-2 py-0.5 bg-slate-100 rounded text-[9px] font-black text-slate-500 uppercase tracking-tighter border border-slate-200/50">{absent.className}</span>
                                                                </div>
                                                                <span className="text-[11px] font-bold text-slate-400 flex items-center gap-1.5 mt-1">
                                                                    <i className="fa-regular fa-calendar text-[10px]"></i>
                                                                    {formatDate(absent.date)}
                                                                </span>
                                                            </div>
                                                            <div className="w-8 h-8 rounded-full bg-rose-50 flex items-center justify-center text-rose-500">
                                                                <i className="fa-solid fa-calendar-xmark text-xs"></i>
                                                            </div>
                                                        </div>
                                                        {absent.reason && (
                                                            <div className="mt-3 pt-3 border-t border-slate-50 flex items-start gap-2.5 bg-emerald-50/30 -mx-5 -mb-5 p-4 rounded-b-2xl">
                                                                <div className="w-6 h-6 bg-emerald-100 rounded-lg flex items-center justify-center flex-shrink-0">
                                                                    <i className="fa-solid fa-comment-dots text-[10px] text-emerald-600"></i>
                                                                </div>
                                                                <div>
                                                                    <p className="text-[9px] font-black text-emerald-600 uppercase tracking-[0.1em] mb-0.5 leading-none">Teacher Remark</p>
                                                                    <p className="text-[11px] font-medium text-slate-600 italic">"{absent.reason}"</p>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="text-center py-6">
                                                <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-3">
                                                    <i className="fa-solid fa-check"></i>
                                                </div>
                                                <p className="text-xs font-bold text-slate-500 uppercase">Perfect Attendance!</p>
                                                <p className="text-[10px] text-slate-400 mt-1">No classes missed for this subject.</p>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default StudentAttendancePortal;
