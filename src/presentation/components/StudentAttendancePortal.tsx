import React, { useState } from 'react';
import { dataService } from '../../infrastructure/services/dataService';
import { StudentRecord, SubjectConfig, AttendanceRecord } from '../../domain/entities/types';
import { MobileFacultyEntrySkeleton } from './SkeletonLoaders';

const StudentAttendancePortal: React.FC = () => {
    const [adNo, setAdNo] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [student, setStudent] = useState<StudentRecord | null>(null);
    const [attendanceData, setAttendanceData] = useState<Array<{ subject: SubjectConfig; percentage: number; present: number; total: number }>>([]);
    const [error, setError] = useState('');

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!adNo.trim()) return;

        setIsLoading(true);
        setError('');
        setStudent(null);
        setAttendanceData([]);

        try {
            const foundStudent = await dataService.getStudentByAdNo(adNo.trim());
            if (!foundStudent) {
                setError('No student found with this admission number.');
                return;
            }

            setStudent(foundStudent);
            const subjects = await dataService.getSubjectsByClass(foundStudent.className);

            const attendanceStats = await Promise.all(subjects.map(async (subject) => {
                const records = await dataService.getAttendanceForStudent(foundStudent.id, subject.id);
                const total = records.length;
                const present = records.filter(r => r.presentStudentIds.includes(foundStudent.id)).length;
                const percentage = total > 0 ? (present / total) * 100 : 100;

                return {
                    subject,
                    percentage,
                    present,
                    total
                };
            }));

            setAttendanceData(attendanceStats);
        } catch (err) {
            setError('An error occurred while fetching attendance data.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="max-w-4xl mx-auto p-6 space-y-8">
            <div className="text-center">
                <h1 className="text-3xl font-black text-slate-900 tracking-tight">Student Attendance Portal</h1>
                <p className="text-slate-600 mt-2">View your live attendance records and subject-wise reports</p>
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
                                placeholder="Enter your Ad No..."
                                className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-bold text-lg"
                            />
                            <i className="fa-solid fa-id-card absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-xl"></i>
                        </div>
                    </div>
                    <button
                        type="submit"
                        disabled={isLoading || !adNo}
                        className="w-full py-4 bg-emerald-600 text-white font-black rounded-2xl shadow-lg shadow-emerald-200 hover:bg-emerald-700 disabled:opacity-50 transition-all flex items-center justify-center gap-3"
                    >
                        {isLoading ? <i className="fa-solid fa-circle-notch fa-spin"></i> : <i className="fa-solid fa-magnifying-glass"></i>}
                        Check Attendance
                    </button>
                </form>
                {error && <p className="text-rose-600 text-sm font-bold mt-4 text-center">{error}</p>}
            </div>

            {isLoading && <MobileFacultyEntrySkeleton studentCount={3} />}

            {student && attendanceData.length > 0 && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
                    <div className="bg-emerald-900 text-white p-8 rounded-3xl shadow-2xl relative overflow-hidden">
                        <div className="relative z-10">
                            <span className="px-3 py-1 bg-emerald-800 rounded-lg text-xs font-bold uppercase tracking-widest border border-emerald-700 mb-4 inline-block">Student Profile</span>
                            <h2 className="text-4xl font-black mb-1">{student.name}</h2>
                            <p className="text-emerald-300 font-medium">Class: {student.className} • Ad No: {student.adNo}</p>
                        </div>
                        <i className="fa-solid fa-user-graduate absolute -right-8 -bottom-8 text-9xl text-emerald-800 opacity-50"></i>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {attendanceData.map((stat, idx) => (
                            <div key={idx} className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm hover:border-emerald-500 transition-all group">
                                <div className="flex justify-between items-start mb-4">
                                    <div>
                                        <h3 className="font-black text-slate-900 group-hover:text-emerald-600 transition-colors">{stat.subject.name}</h3>
                                        <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">{stat.subject.facultyName || 'Faculty not assigned'}</p>
                                    </div>
                                    <div className={`px-4 py-2 rounded-2xl font-black text-xl ${stat.percentage < 75 ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'}`}>
                                        {Math.round(stat.percentage)}%
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                                        <div
                                            className={`h-full transition-all duration-1000 ${stat.percentage < 75 ? 'bg-rose-500' : 'bg-emerald-500'}`}
                                            style={{ width: `${stat.percentage}%` }}
                                        ></div>
                                    </div>
                                    <div className="flex justify-between items-baseline">
                                        <span className="text-xs font-bold text-slate-400 uppercase">Classes Attended</span>
                                        <span className="text-lg font-black text-slate-900">{stat.present}<span className="text-slate-300 mx-1">/</span>{stat.total}</span>
                                    </div>
                                    {stat.percentage < 75 && (
                                        <div className="flex items-center gap-2 text-rose-600 bg-rose-50 p-3 rounded-xl">
                                            <i className="fa-solid fa-triangle-exclamation"></i>
                                            <span className="text-xs font-bold uppercase tracking-tighter">Attendance below 75% - Exam eligibility at risk</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default StudentAttendancePortal;
