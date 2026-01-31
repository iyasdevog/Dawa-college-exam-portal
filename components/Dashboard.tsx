import React, { useState, useEffect } from 'react';
import { StudentRecord, SubjectConfig } from '../types';
import { CLASSES } from '../constants';
import { dataService } from '../services/dataService';

interface DashboardProps {
    onNavigateToManagement: () => void;
}

const Dashboard: React.FC<DashboardProps> = ({ onNavigateToManagement }) => {
    const [students, setStudents] = useState<StudentRecord[]>([]);
    const [subjects, setSubjects] = useState<SubjectConfig[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedClass, setSelectedClass] = useState('All');

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            setIsLoading(true);
            // Just initialize connection, no seeding
            await dataService.initializeDatabase();

            const [studentsData, subjectsData] = await Promise.all([
                dataService.getAllStudents(),
                dataService.getAllSubjects()
            ]);

            setStudents(studentsData);
            setSubjects(subjectsData);
        } catch (error) {
            console.error('Error loading dashboard data:', error);
        } finally {
            setIsLoading(false);
        }
    };

    // Filter students by selected class
    const filteredStudents = selectedClass === 'All'
        ? students
        : students.filter(s => s.className === selectedClass);

    // Calculate statistics
    const totalStudents = students.length;
    const totalSubjects = subjects.length;
    const averageScore = students.length > 0
        ? Math.round(students.reduce((sum, s) => sum + s.average, 0) / students.length)
        : 0;

    // Performance distribution
    const performanceStats = {
        Excellent: students.filter(s => s.performanceLevel === 'Excellent').length,
        Good: students.filter(s => s.performanceLevel === 'Good').length,
        Average: students.filter(s => s.performanceLevel === 'Average').length,
        'Needs Improvement': students.filter(s => s.performanceLevel === 'Needs Improvement').length,
        Failed: students.filter(s => s.performanceLevel === 'Failed').length,
    };

    // Class-wise statistics
    const classStats = CLASSES.map(className => {
        const classStudents = students.filter(s => s.className === className);
        const classAverage = classStudents.length > 0
            ? Math.round(classStudents.reduce((sum, s) => sum + s.average, 0) / classStudents.length)
            : 0;

        return {
            className,
            studentCount: classStudents.length,
            average: classAverage,
            topStudent: classStudents.find(s => s.rank === 1)
        };
    });

    // Top performers
    const topPerformers = [...students]
        .sort((a, b) => b.grandTotal - a.grandTotal)
        .slice(0, 5);

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="text-center">
                    <div className="loader-ring mb-4"></div>
                    <p className="text-slate-600">Loading dashboard...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-8">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight">Academic Dashboard</h1>
                    <p className="text-slate-600 mt-2">Overview of academic performance and statistics</p>
                </div>
                <button
                    onClick={loadData}
                    className="px-4 py-2 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-all flex items-center gap-2 print:hidden"
                >
                    <i className="fa-solid fa-refresh"></i>
                    Refresh Data
                </button>
            </div>

            {/* Key Statistics */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-slate-600 text-sm font-medium">Total Students</p>
                            <p className="text-3xl font-black text-slate-900 mt-1">{totalStudents}</p>
                        </div>
                        <div className="bg-blue-100 p-3 rounded-xl">
                            <i className="fa-solid fa-users text-blue-600 text-xl"></i>
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-slate-600 text-sm font-medium">Total Subjects</p>
                            <p className="text-3xl font-black text-slate-900 mt-1">{totalSubjects}</p>
                        </div>
                        <div className="bg-emerald-100 p-3 rounded-xl">
                            <i className="fa-solid fa-book text-emerald-600 text-xl"></i>
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-slate-600 text-sm font-medium">Average Score</p>
                            <p className="text-3xl font-black text-slate-900 mt-1">{averageScore}%</p>
                        </div>
                        <div className="bg-amber-100 p-3 rounded-xl">
                            <i className="fa-solid fa-chart-line text-amber-600 text-xl"></i>
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-slate-600 text-sm font-medium">Active Classes</p>
                            <p className="text-3xl font-black text-slate-900 mt-1">{CLASSES.length}</p>
                        </div>
                        <div className="bg-purple-100 p-3 rounded-xl">
                            <i className="fa-solid fa-chalkboard text-purple-600 text-xl"></i>
                        </div>
                    </div>
                </div>
            </div>

            {/* Performance Distribution */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
                <h2 className="text-xl font-black text-slate-900 mb-6">Performance Distribution</h2>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    {Object.entries(performanceStats).map(([level, count]) => (
                        <div key={level} className="text-center">
                            <div className={`w-16 h-16 mx-auto rounded-full flex items-center justify-center text-white font-black text-lg mb-2 ${level === 'Excellent' ? 'bg-emerald-500' :
                                level === 'Good' ? 'bg-blue-500' :
                                    level === 'Average' ? 'bg-amber-500' :
                                        level === 'Needs Improvement' ? 'bg-orange-500' :
                                            'bg-red-500'
                                }`}>
                                {count}
                            </div>
                            <p className="text-xs font-bold text-slate-600 uppercase tracking-wider">{level}</p>
                        </div>
                    ))}
                </div>
            </div>

            {/* Class Overview */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-black text-slate-900">Class Overview</h2>
                    <button
                        onClick={onNavigateToManagement}
                        className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl font-bold hover:bg-slate-200 transition-all text-sm print:hidden"
                    >
                        Manage Classes
                    </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {classStats.map(stat => (
                        <div key={stat.className} className="bg-slate-50 rounded-xl p-4">
                            <div className="flex items-center justify-between mb-3">
                                <h3 className="font-black text-slate-900 text-lg">{stat.className}</h3>
                                <span className="text-xs bg-slate-200 text-slate-600 px-2 py-1 rounded-full font-bold">
                                    {stat.studentCount} students
                                </span>
                            </div>
                            <div className="space-y-2 text-sm">
                                <div className="flex justify-between">
                                    <span className="text-slate-600">Class Average:</span>
                                    <span className="font-bold text-slate-900">{stat.average}%</span>
                                </div>
                                {stat.topStudent && (
                                    <div className="flex justify-between">
                                        <span className="text-slate-600">Top Student:</span>
                                        <span className="font-bold text-emerald-600">{stat.topStudent.name}</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Top Performers */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
                <h2 className="text-xl font-black text-slate-900 mb-6">Top Performers</h2>

                {topPerformers.length > 0 ? (
                    <div className="space-y-4">
                        {topPerformers.map((student, index) => (
                            <div key={student.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
                                <div className="flex items-center gap-4">
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-black ${index === 0 ? 'bg-yellow-500' :
                                        index === 1 ? 'bg-slate-400' :
                                            index === 2 ? 'bg-amber-600' :
                                                'bg-slate-300'
                                        }`}>
                                        {index + 1}
                                    </div>
                                    <div>
                                        <p className="font-black text-slate-900">{student.name}</p>
                                        <p className="text-sm text-slate-600">{student.className} • Adm: {student.adNo}</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="font-black text-slate-900 text-lg">{student.grandTotal}</p>
                                    <p className="text-sm text-slate-600">{student.average.toFixed(1)}% avg</p>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-8">
                        <i className="fa-solid fa-users text-4xl text-slate-300 mb-4"></i>
                        <p className="text-slate-600 font-bold mb-2">No Students Found</p>
                        <p className="text-slate-500 text-sm mb-4">Get started by adding students to the system</p>
                        <button
                            onClick={onNavigateToManagement}
                            className="px-6 py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-all flex items-center gap-2 mx-auto print:hidden"
                        >
                            <i className="fa-solid fa-plus"></i>
                            Add Students
                        </button>
                    </div>
                )}
            </div>

            {/* Quick Actions */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 print:hidden">
                <h2 className="text-xl font-black text-slate-900 mb-6">Quick Actions</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <button
                        onClick={onNavigateToManagement}
                        className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl hover:bg-emerald-100 transition-all text-left"
                    >
                        <div className="flex items-center gap-3 mb-2">
                            <i className="fa-solid fa-users-cog text-emerald-600"></i>
                            <span className="font-bold text-emerald-900">Manage Students</span>
                        </div>
                        <p className="text-sm text-emerald-700">Add, edit, or remove student records</p>
                    </button>

                    <button
                        onClick={onNavigateToManagement}
                        className="p-4 bg-blue-50 border border-blue-200 rounded-xl hover:bg-blue-100 transition-all text-left"
                    >
                        <div className="flex items-center gap-3 mb-2">
                            <i className="fa-solid fa-book-open text-blue-600"></i>
                            <span className="font-bold text-blue-900">Manage Subjects</span>
                        </div>
                        <p className="text-sm text-blue-700">Configure subjects and class assignments</p>
                    </button>

                    <button
                        onClick={loadData}
                        className="p-4 bg-amber-50 border border-amber-200 rounded-xl hover:bg-amber-100 transition-all text-left"
                    >
                        <div className="flex items-center gap-3 mb-2">
                            <i className="fa-solid fa-sync-alt text-amber-600"></i>
                            <span className="font-bold text-amber-900">Sync Database</span>
                        </div>
                        <p className="text-sm text-amber-700">Refresh all data from Firebase</p>
                    </button>
                </div>
            </div>
        </div>
    );
};

export default Dashboard;