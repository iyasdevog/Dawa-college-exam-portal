import React, { useState, useEffect } from 'react';
import { StudentRecord, SubjectConfig } from '../../domain/entities/types';
import { dataService } from '../../infrastructure/services/dataService';
import { useMobile } from '../hooks/useMobile';
import AttendanceManagement from './management/AttendanceManagement';
import ExamTimetable from './management/ExamTimetable';
import TimetableGenerator from './management/TimetableGenerator';
import AcademicCalendar from './management/AcademicCalendar';
import AttendanceMonitor from './management/AttendanceMonitor';
import MasterTimetable from './management/MasterTimetable';
import { useTerm } from '../viewmodels/TermContext';

const AttendancePortal: React.FC = () => {
    const { isMobile } = useMobile();
    const { activeTerm, currentAcademicYear, currentSemester } = useTerm();
    const [activeTab, setActiveTab] = useState('marking');
    const [students, setStudents] = useState<StudentRecord[]>([]);
    const [subjects, setSubjects] = useState<SubjectConfig[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const currentSystemTerm = `${currentAcademicYear}-${currentSemester}`;
    const isHistoricalTerm = activeTerm !== currentSystemTerm;

    const tabs = [
        { id: 'marking', label: 'Attendance Marking', icon: 'fa-clipboard-user' },
        { id: 'monitor', label: 'Academic Monitor', icon: 'fa-chart-pie' },
        { id: 'calendar', label: 'Academic Calendar', icon: 'fa-calendar-check' },
        { id: 'generator', label: 'Timetable Generator', icon: 'fa-wand-magic-sparkles' },
        { id: 'exam', label: 'Exam Timetables', icon: 'fa-file-signature' },
        { id: 'master', label: 'Master View', icon: 'fa-layer-group' },
    ];

    const loadData = async () => {
        try {
            const [studentsData, subjectsData] = await Promise.all([
                dataService.getAllStudents(activeTerm),
                dataService.getAllSubjects(activeTerm)
            ]);
            setStudents(studentsData);
            setSubjects(subjectsData);
        } catch (error) {
            console.error('Error loading attendance portal data:', error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, [activeTerm]);

    // When switching to a historical term, gracefully move away from marking tab
    useEffect(() => {
        if (isHistoricalTerm && activeTab === 'marking') {
            setActiveTab('monitor');
        }
    }, [isHistoricalTerm, activeTab]);

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="text-center">
                    <div className="loader-ring mb-4"></div>
                    <p className="text-slate-600">Loading Attendance Portal...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-8">
            <div className={isMobile ? 'text-center' : ''}>
                <h1 className={`font-black text-slate-900 tracking-tight ${isMobile ? 'text-2xl' : 'text-3xl'}`}>Attendance &amp; Timetable Hub</h1>
                <p className={`text-slate-600 mt-2 ${isMobile ? 'text-sm' : ''}`}>Manage academic calendar, generate timetables, and track attendance</p>
            </div>

            {/* Historical Semester Banner */}
            {isHistoricalTerm && (
                <div className="flex items-start gap-4 bg-amber-50 border border-amber-300 rounded-2xl px-5 py-4 shadow-sm">
                    <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center mt-0.5">
                        <i className="fa-solid fa-clock-rotate-left text-amber-600 text-lg"></i>
                    </div>
                    <div>
                        <p className="font-bold text-amber-800 text-sm">Viewing Historical Semester — Read-Only Mode</p>
                        <p className="text-amber-700 text-xs mt-1">
                            You are currently viewing <span className="font-semibold">{activeTerm}</span>. 
                            Attendance marking is disabled for past semesters to protect historical records. 
                            Switch to <span className="font-semibold">{currentSystemTerm}</span> to mark attendance.
                        </p>
                    </div>
                </div>
            )}

            {/* Sub-Navigation */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden print:hidden">
                <div className="border-b border-slate-200">
                    <nav className="flex overflow-x-auto no-scrollbar">
                        {tabs.map((tab) => {
                            const isDisabled = isHistoricalTerm && tab.id === 'marking';
                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => !isDisabled && setActiveTab(tab.id)}
                                    disabled={isDisabled}
                                    title={isDisabled ? 'Attendance marking is disabled for historical semesters' : undefined}
                                    className={`flex items-center gap-3 px-6 py-4 font-bold whitespace-nowrap transition-all
                                        ${isDisabled
                                            ? 'text-slate-300 cursor-not-allowed bg-slate-50'
                                            : activeTab === tab.id
                                                ? 'bg-emerald-50 text-emerald-600 border-b-2 border-emerald-600'
                                                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                                        }`}
                                >
                                    <i className={`fa-solid ${tab.icon}`}></i>
                                    {tab.label}
                                    {isDisabled && <i className="fa-solid fa-lock text-xs ml-1 text-slate-300"></i>}
                                </button>
                            );
                        })}
                    </nav>
                </div>

                <div className="p-6">
                    {activeTab === 'marking' && !isHistoricalTerm && (
                        <AttendanceManagement
                            students={students}
                            subjects={subjects}
                            onRefresh={loadData}
                        />
                    )}
                    {activeTab === 'monitor' && (
                        <AttendanceMonitor
                            students={students}
                            subjects={subjects}
                        />
                    )}
                    {activeTab === 'calendar' && (
                        <AcademicCalendar />
                    )}
                    {activeTab === 'generator' && (
                        <TimetableGenerator
                            subjects={subjects}
                            students={students}
                        />
                    )}
                    {activeTab === 'exam' && (
                        <ExamTimetable
                            subjects={subjects}
                            students={students}
                        />
                    )}
                    {activeTab === 'master' && (
                        <MasterTimetable
                            subjects={subjects}
                            students={students}
                        />
                    )}
                </div>
            </div>
        </div>
    );
};

export default AttendancePortal;
