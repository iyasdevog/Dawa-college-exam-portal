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
    const { activeTerm } = useTerm();
    const [activeTab, setActiveTab] = useState('marking');
    const [students, setStudents] = useState<StudentRecord[]>([]);
    const [subjects, setSubjects] = useState<SubjectConfig[]>([]);
    const [isLoading, setIsLoading] = useState(true);

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
                dataService.getAllStudents(),
                dataService.getAllSubjects()
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
    }, []);

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
                <h1 className={`font-black text-slate-900 tracking-tight ${isMobile ? 'text-2xl' : 'text-3xl'}`}>Attendance & Timetable Hub</h1>
                <p className={`text-slate-600 mt-2 ${isMobile ? 'text-sm' : ''}`}>Manage academic calendar, generate timetables, and track attendance</p>
            </div>

            {/* Sub-Navigation */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden print:hidden">
                <div className="border-b border-slate-200">
                    <nav className="flex overflow-x-auto no-scrollbar">
                        {tabs.map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`flex items-center gap-3 px-6 py-4 font-bold whitespace-nowrap transition-all ${activeTab === tab.id
                                    ? 'bg-emerald-50 text-emerald-600 border-b-2 border-emerald-600'
                                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                                    }`}
                            >
                                <i className={`fa-solid ${tab.icon}`}></i>
                                {tab.label}
                            </button>
                        ))}
                    </nav>
                </div>

                <div className="p-6">
                    {activeTab === 'marking' && (
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
