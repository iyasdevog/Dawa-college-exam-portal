import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { DouraSubmission, DouraTask, StudentRecord } from '../../domain/entities/types';
import { User } from '../../domain/entities/User';
import { CLASSES } from '../../domain/entities/constants';
import { dataService } from '../../infrastructure/services/dataService';
import { OperationLoadingSkeleton } from './SkeletonLoaders';
import { DouraReports } from './DouraReports';
import AccessibleModal from './AccessibleModal';
import MobileFormInput from './MobileFormInput';

interface DouraMonitoringProps {
    currentUser: User | null;
}

const DouraMonitoring: React.FC<DouraMonitoringProps> = ({ currentUser }) => {
    const [activeTab, setActiveTab] = useState<'monitoring' | 'reports' | 'tasks'>('monitoring');
    const [douraMonitorSubmissions, setDouraMonitorSubmissions] = useState<DouraSubmission[]>([]);
    const [douraTasks, setDouraTasks] = useState<DouraTask[]>([]);
    const [classStudents, setClassStudents] = useState<StudentRecord[]>([]);
    const [monitoringLoading, setMonitoringLoading] = useState(false);
    const [tasksLoading, setTasksLoading] = useState(false);
    const [monitoringFilterClass, setMonitoringFilterClass] = useState<string>('all');
    const [monitoringFilterStatus, setMonitoringFilterStatus] = useState<'all' | 'Pending' | 'Approved'>('all');
    const [monitoringFilterType, setMonitoringFilterType] = useState<'all' | 'Task' | 'Self'>('all');

    // Data Management State
    const [isDataModalOpen, setIsDataModalOpen] = useState(false);
    const [dataMgmtClass, setDataMgmtClass] = useState<string>('');
    const [dataMgmtStudent, setDataMgmtStudent] = useState<string>('');
    const [cleanupStudents, setCleanupStudents] = useState<StudentRecord[]>([]);
    const [isDeletingData, setIsDeletingData] = useState(false);
    const [operationLoading, setOperationLoading] = useState<{
        type: 'saving' | 'clearing' | 'loading-students' | 'validating' | null;
        message?: string;
    }>({ type: null });

    // Task Creation State
    const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
    const [taskForm, setTaskForm] = useState({
        title: '',
        juzStart: 1,
        juzEnd: 1,
        dueDate: new Date().toISOString().split('T')[0],
        assignmentScope: 'class' as 'college' | 'class' | 'student',
        targetClass: '',
        targetStudentAdNo: ''
    });
    const [studentSearch, setStudentSearch] = useState('');

    // Approval State
    const [isApprovalModalOpen, setIsApprovalModalOpen] = useState(false);
    const [approvalForm, setApprovalForm] = useState({
        submissionId: '',
        submissionName: '',
        feedback: ''
    });

    // Confirmation State
    const [confirmModal, setConfirmModal] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
        onConfirm: () => void;
        type: 'danger' | 'warning';
    }>({
        isOpen: false,
        title: '',
        message: '',
        onConfirm: () => { },
        type: 'warning'
    });

    const loadMonitoringSubmissions = useCallback(async () => {
        try {
            setMonitoringLoading(true);
            const submissions = await dataService.getAllDouraSubmissions(
                monitoringFilterClass,
                monitoringFilterStatus === 'all' ? undefined : monitoringFilterStatus
            );
            setDouraMonitorSubmissions(submissions);
        } catch (error) {
            console.error('Error loading monitoring submissions:', error);
        } finally {
            setMonitoringLoading(false);
        }
    }, [monitoringFilterClass, monitoringFilterStatus]);

    const loadDouraTasks = useCallback(async () => {
        try {
            setTasksLoading(true);
            const tasks = await dataService.getDouraTasks(monitoringFilterClass);
            setDouraTasks(tasks);

            // Fetch students for the current class to allow individual assignments
            if (monitoringFilterClass !== 'all') {
                const students = await dataService.getStudentsByClass(monitoringFilterClass);
                setClassStudents(students.sort((a, b) => a.name.localeCompare(b.name)));
            } else {
                setClassStudents([]);
            }
        } catch (error) {
            console.error('Error loading tasks:', error);
        } finally {
            setTasksLoading(false);
        }
    }, [monitoringFilterClass]);

    const loadDouraData = useCallback(async () => {
        await loadMonitoringSubmissions();
        await loadDouraTasks();
    }, [loadMonitoringSubmissions, loadDouraTasks]);

    useEffect(() => {
        if (activeTab === 'monitoring') {
            loadMonitoringSubmissions();
        } else if (activeTab === 'tasks') {
            loadDouraTasks();
        }
    }, [monitoringFilterClass, monitoringFilterStatus, loadMonitoringSubmissions, loadDouraTasks, activeTab]);

    const handleUpdateDouraStatus = useCallback((id: string, name: string) => {
        setApprovalForm({
            submissionId: id,
            submissionName: name,
            feedback: ''
        });
        setIsApprovalModalOpen(true);
    }, []);

    const submitApproval = async () => {
        try {
            setIsApprovalModalOpen(false);
            setOperationLoading({ type: 'saving', message: `Updating submission status...` });
            await dataService.updateDouraSubmission(approvalForm.submissionId, {
                status: 'Approved',
                feedback: approvalForm.feedback || undefined,
                approvedBy: currentUser?.name || 'Faculty'
            });
            await loadMonitoringSubmissions();
        } catch (error) {
            console.error('Error updating status:', error);
            alert('Failed to update status.');
        } finally {
            setOperationLoading({ type: null });
        }
    };

    const handleCreateTask = useCallback(async () => {
        const defaultClass = monitoringFilterClass === 'all' ? CLASSES[0] : monitoringFilterClass;
        setTaskForm({
            title: '',
            juzStart: 1,
            juzEnd: 1,
            dueDate: new Date().toISOString().split('T')[0],
            assignmentScope: 'class',
            targetClass: defaultClass,
            targetStudentAdNo: ''
        });
        setStudentSearch('');
        setIsTaskModalOpen(true);

        // Ensure students are loaded for the target class for individual assignments
        if (defaultClass) {
            const students = await dataService.getStudentsByClass(defaultClass);
            setClassStudents(students.sort((a, b) => a.name.localeCompare(b.name)));
        }
    }, [monitoringFilterClass]);

    const handleCloseTaskModal = useCallback(() => {
        setIsTaskModalOpen(false);
    }, []);

    const handleSubmitTask = async () => {
        if (!taskForm.title) {
            alert('Please enter a task title');
            return;
        }

        if (taskForm.assignmentScope === 'student' && !taskForm.targetStudentAdNo) {
            alert('Please select a student');
            return;
        }

        try {
            setIsTaskModalOpen(false);
            setOperationLoading({ type: 'saving', message: 'Creating task...' });

            const targetClass = taskForm.assignmentScope === 'college' ? 'all' : taskForm.targetClass;

            await dataService.createDouraTask({
                title: taskForm.title,
                targetClass,
                targetStudentAdNo: taskForm.assignmentScope === 'student' ? taskForm.targetStudentAdNo : undefined,
                juzStart: taskForm.juzStart,
                juzEnd: taskForm.juzEnd,
                pageStart: (taskForm.juzStart - 1) * 20 + 2,
                pageEnd: taskForm.juzEnd * 20 + 1,
                dueDate: taskForm.dueDate,
                createdAt: new Date().toISOString(),
                createdBy: currentUser?.name || 'Faculty',
                status: 'Active'
            });
            await loadDouraTasks();
        } catch (error) {
            console.error('Error creating task:', error);
            alert('Failed to create task.');
        } finally {
            setOperationLoading({ type: null });
        }
    };

    const handleDeleteTask = useCallback((id: string) => {
        setConfirmModal({
            isOpen: true,
            title: 'Delete Task',
            message: 'Are you sure you want to permanently delete this task? This action cannot be undone.',
            type: 'danger',
            onConfirm: async () => {
                try {
                    setConfirmModal(prev => ({ ...prev, isOpen: false }));
                    setOperationLoading({ type: 'saving', message: 'Deleting task...' });
                    await dataService.deleteDouraTask(id);
                    await loadDouraTasks();
                } catch (error) {
                    console.error('Error deleting task:', error);
                    alert('Failed to delete task.');
                } finally {
                    setOperationLoading({ type: null });
                }
            }
        });
    }, [loadDouraTasks]);

    const handleToggleTaskStatus = useCallback(async (id: string, currentStatus: 'Active' | 'Closed') => {
        try {
            setOperationLoading({ type: 'saving', message: 'Updating task status...' });
            await dataService.updateDouraTask(id, {
                status: currentStatus === 'Active' ? 'Closed' : 'Active'
            });
            await loadDouraTasks();
        } catch (error) {
            console.error('Error updating task status:', error);
            alert('Failed to update task status.');
        } finally {
            setOperationLoading({ type: null });
        }
    }, [loadDouraTasks]);

    const handleDeleteDouraSubmission = async (id: string, studentName: string) => {
        if (confirm(`Are you sure you want to delete this submission for ${studentName}?`)) {
            try {
                setOperationLoading({ type: 'clearing', message: 'Deleting submission...' });
                await dataService.deleteDouraSubmission(id);
                // Refresh data
                loadDouraData();
            } catch (error) {
                console.error(error);
                alert('Failed to delete submission');
            } finally {
                setOperationLoading({ type: null, message: '' });
            }
        }
    };

    const handleDeleteAllData = async () => {
        if (!dataMgmtStudent) return;

        if (confirm(`DANGER: Are you sure you want to DELETE ALL Doura data for student ${dataMgmtStudent}? This action cannot be undone.`)) {
            // Second confirmation for safety
            const confirmation = prompt(`Type "DELETE" to confirm clearing all data for ${dataMgmtStudent}`);
            if (confirmation !== 'DELETE') return;

            try {
                setIsDeletingData(true);
                const count = await dataService.deleteAllStudentDouraSubmissions(dataMgmtStudent);
                alert(`Successfully deleted ${count} submissions and reset Khatam progress.`);
                setIsDataModalOpen(false);
                setDataMgmtStudent('');
                setDataMgmtClass('');
                loadDouraData();
            } catch (error) {
                console.error(error);
                alert('Failed to delete data. Please try again.');
            } finally {
                setIsDeletingData(false);
            }
        }
    };

    return (
        <div className="space-y-4 md:space-y-8">
            <div className="px-4 md:px-0">
                <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">Doura Monitoring</h1>
                <p className="text-slate-600 mt-2 text-sm md:text-base">Monitor and manage student Doura progress submissions</p>
            </div>

            {/* Main Tabs */}
            <div className="px-4 md:px-0">
                <div className="flex border-b border-slate-200">
                    <button
                        onClick={() => setActiveTab('monitoring')}
                        className={`px-6 py-3 font-bold text-sm transition-all border-b-2 ${activeTab === 'monitoring'
                            ? 'border-emerald-500 text-emerald-600'
                            : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                            }`}
                    >
                        <i className="fa-solid fa-list-check mr-2"></i>
                        Daily Entries
                    </button>
                    <button
                        onClick={() => setActiveTab('tasks')}
                        className={`px-6 py-3 font-bold text-sm transition-all border-b-2 ${activeTab === 'tasks'
                            ? 'border-emerald-500 text-emerald-600'
                            : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                            }`}
                    >
                        <i className="fa-solid fa-thumbtack mr-2"></i>
                        Task Assignments
                    </button>
                    <button
                        onClick={() => setActiveTab('reports')}
                        className={`px-6 py-3 font-bold text-sm transition-all border-b-2 ${activeTab === 'reports'
                            ? 'border-emerald-500 text-emerald-600'
                            : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                            }`}
                    >
                        <i className="fa-solid fa-chart-pie mr-2"></i>
                        Reports & Analytics
                    </button>
                </div>
            </div>

            <div className="px-4 md:px-0 space-y-6">
                {activeTab === 'reports' ? (
                    <DouraReports />
                ) : activeTab === 'tasks' ? (
                    <div className="space-y-6">
                        <div className="flex justify-between items-center">
                            <h3 className="text-xl font-black text-slate-900">Assigned Tasks</h3>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setIsDataModalOpen(true)}
                                    className="bg-red-50 hover:bg-red-100 text-red-600 px-4 py-2.5 rounded-xl font-bold transition-all border border-red-200 active:scale-95 flex items-center gap-2"
                                >
                                    <i className="fa-solid fa-trash-can"></i>
                                    Data Cleanup
                                </button>
                                <button
                                    onClick={handleCreateTask}
                                    className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2.5 rounded-xl font-bold transition-all shadow-lg active:scale-95 flex items-center gap-2"
                                >
                                    <i className="fa-solid fa-plus"></i>
                                    New Assignment
                                </button>
                            </div>
                        </div>

                        {tasksLoading ? (
                            <div className="p-12 text-center text-slate-500">
                                <div className="w-8 h-8 border-4 border-slate-200 border-t-emerald-500 rounded-full animate-spin mx-auto mb-4"></div>
                                <p className="font-bold">Loading tasks...</p>
                            </div>
                        ) : douraTasks.length === 0 ? (
                            <div className="bg-white p-12 text-center text-slate-500 rounded-2xl border-2 border-slate-100 shadow-md">
                                <i className="fa-solid fa-tasks text-4xl mb-4 text-slate-200"></i>
                                <p className="font-bold">No tasks found for this class</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {douraTasks.map(task => (
                                    <div key={task.id} className={`bg-white rounded-2xl shadow-lg border-2 overflow-hidden transition-all ${task.status === 'Closed' ? 'border-slate-100 opacity-75' : 'border-emerald-100 hover:border-emerald-300 shadow-emerald-500/5'}`}>
                                        <div className={`p-4 ${task.status === 'Closed' ? 'bg-slate-50' : 'bg-emerald-50'}`}>
                                            <div className="flex justify-between items-start mb-2">
                                                <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded ${task.status === 'Closed' ? 'bg-slate-200 text-slate-600' : 'bg-emerald-100 text-emerald-700'}`}>
                                                    {task.status}
                                                </span>
                                                <button onClick={() => handleDeleteTask(task.id)} className="text-slate-400 hover:text-red-500 transition-colors">
                                                    <i className="fa-solid fa-trash-can text-sm"></i>
                                                </button>
                                            </div>
                                            <h4 className="font-black text-slate-900 text-lg leading-tight">{task.title}</h4>
                                        </div>
                                        <div className="p-4 space-y-4">
                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="bg-slate-50 p-3 rounded-xl col-span-2">
                                                    <p className="text-[10px] font-black text-slate-400 uppercase">Assigned To</p>
                                                    <p className="font-bold text-slate-700">
                                                        {task.targetStudentAdNo ? (
                                                            <span className="text-emerald-600">
                                                                <i className="fa-solid fa-user mr-1"></i>
                                                                {classStudents.find(s => s.adNo === task.targetStudentAdNo)?.name || `Student (${task.targetStudentAdNo})`}
                                                            </span>
                                                        ) : task.targetClass === 'all' ? (
                                                            <span className="text-amber-600">
                                                                <i className="fa-solid fa-school mr-1"></i> Entire College
                                                            </span>
                                                        ) : (
                                                            <span><i className="fa-solid fa-users mr-1 text-slate-400"></i> All {task.targetClass} Students</span>
                                                        )}
                                                    </p>
                                                </div>
                                                <div className="bg-slate-50 p-3 rounded-xl">
                                                    <p className="text-[10px] font-black text-slate-400 uppercase">Class</p>
                                                    <p className="font-bold text-slate-700">{task.targetClass}</p>
                                                </div>
                                                <div className="bg-slate-50 p-3 rounded-xl">
                                                    <p className="text-[10px] font-black text-slate-400 uppercase">Due Date</p>
                                                    <p className="font-bold text-slate-700">{new Date(task.dueDate).toLocaleDateString()}</p>
                                                </div>
                                            </div>
                                            <div className="bg-blue-50 p-4 rounded-xl text-center">
                                                <p className="text-[10px] font-black text-blue-400 uppercase mb-1">Juz Range</p>
                                                <p className="text-2xl font-black text-blue-600">
                                                    {task.juzStart === task.juzEnd ? task.juzStart : `${task.juzStart}-${task.juzEnd}`}
                                                </p>
                                            </div>
                                            <button
                                                onClick={() => handleToggleTaskStatus(task.id, task.status)}
                                                className={`w-full py-2.5 rounded-xl font-bold transition-all text-sm ${task.status === 'Active' ? 'bg-slate-100 text-slate-600 hover:bg-amber-50 hover:text-amber-600' : 'bg-emerald-100 text-emerald-600 hover:bg-emerald-200'}`}
                                            >
                                                {task.status === 'Active' ? 'Close Assignment' : 'Reopen Assignment'}
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                ) : (
                    <>
                        {/* Filters */}
                        <div className="bg-white rounded-2xl p-6 shadow-lg border-2 border-slate-200">
                            <h3 className="text-lg font-bold text-slate-900 mb-4">
                                <i className="fa-solid fa-filter mr-2 text-emerald-600"></i>
                                Monitoring Controls
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-2">Class Filter</label>
                                    <select
                                        value={monitoringFilterClass}
                                        onChange={(e) => setMonitoringFilterClass(e.target.value)}
                                        className="w-full p-3 border-2 border-slate-300 rounded-xl focus:ring-4 focus:ring-emerald-500/40 focus:border-emerald-500 bg-white"
                                    >
                                        <option value="all">All Classes</option>
                                        {CLASSES.map(cls => (
                                            <option key={cls} value={cls}>{cls}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-2">Status Filter</label>
                                    <select
                                        value={monitoringFilterStatus}
                                        onChange={(e) => setMonitoringFilterStatus(e.target.value as any)}
                                        className="w-full p-3 border-2 border-slate-300 rounded-xl focus:ring-4 focus:ring-emerald-500/40 focus:border-emerald-500 bg-white"
                                    >
                                        <option value="all">All Statuses</option>
                                        <option value="Pending">Pending Approval</option>
                                        <option value="Approved">Approved</option>
                                    </select>
                                </div>
                                <div className="md:col-span-2">
                                    <label className="block text-sm font-bold text-slate-700 mb-2">Submission Type</label>
                                    <div className="flex p-1 bg-slate-100 rounded-xl">
                                        {(['all', 'Task', 'Self'] as const).map((type) => (
                                            <button
                                                key={type}
                                                onClick={() => setMonitoringFilterType(type)}
                                                className={`flex-1 py-2 px-4 rounded-lg text-xs font-black transition-all ${monitoringFilterType === type ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                                            >
                                                {type === 'all' ? 'ALL SUBMISSIONS' : type === 'Task' ? 'TASKS ONLY' : 'SELF-READING'}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Submissions List */}
                        <div className="bg-white rounded-2xl shadow-xl border-2 border-slate-200 overflow-hidden">
                            {monitoringLoading ? (
                                <div className="p-12 text-center text-slate-500">
                                    <div className="w-8 h-8 border-4 border-slate-200 border-t-emerald-500 rounded-full animate-spin mx-auto mb-4"></div>
                                    <p className="font-bold">Loading submissions...</p>
                                </div>
                            ) : douraMonitorSubmissions.length === 0 ? (
                                <div className="p-12 text-center text-slate-500">
                                    <i className="fa-solid fa-clipboard-check text-4xl mb-4 text-slate-200"></i>
                                    <p className="font-bold">No submissions found</p>
                                </div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="bg-slate-50 border-b border-slate-200">
                                                <th className="px-6 py-4 font-black uppercase tracking-widest text-[10px] text-slate-500">Student Details</th>
                                                <th className="px-6 py-4 font-black uppercase tracking-widest text-[10px] text-slate-500">Class</th>
                                                <th className="px-6 py-4 font-black uppercase tracking-widest text-[10px] text-slate-500 text-center">Type</th>
                                                <th className="px-6 py-4 font-black uppercase tracking-widest text-[10px] text-slate-500 text-center">Range</th>
                                                <th className="px-6 py-4 font-black uppercase tracking-widest text-[10px] text-slate-500 text-center">Stats</th>
                                                <th className="px-6 py-4 font-black uppercase tracking-widest text-[10px] text-slate-500 text-center">Status</th>
                                                <th className="px-6 py-4 font-black uppercase tracking-widest text-[10px] text-slate-500">Teacher</th>
                                                <th className="px-6 py-4 font-black uppercase tracking-widest text-[10px] text-slate-500 text-right">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {douraMonitorSubmissions
                                                .filter(sub => monitoringFilterType === 'all' || (sub.type || 'Self') === monitoringFilterType)
                                                .map((sub) => (
                                                    <tr key={sub.id} className="hover:bg-slate-50 transition-colors">
                                                        <td className="px-6 py-4">
                                                            <div className="font-black text-slate-900">{sub.studentName}</div>
                                                            <div className="text-xs text-slate-500 font-bold">Adm: {sub.studentAdNo}</div>
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <span className="bg-slate-100 px-3 py-1 rounded-lg text-xs font-black text-slate-700">
                                                                {sub.className}
                                                            </span>
                                                        </td>
                                                        <td className="px-6 py-4 text-center">
                                                            <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${sub.type === 'Task' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'}`}>
                                                                {sub.type || 'Self'}
                                                            </span>
                                                        </td>
                                                        <td className="px-6 py-4 text-center">
                                                            <span className="text-xl font-black text-blue-600">
                                                                {sub.juzStart === sub.juzEnd ? sub.juzStart : `${sub.juzStart}-${sub.juzEnd}`}
                                                            </span>
                                                            <div className="text-[10px] font-bold text-slate-400">
                                                                Page: {sub.pageStart}-{sub.pageEnd}
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4 text-center">
                                                            <div className="text-[10px] font-black text-slate-500">
                                                                <div>{Math.max(0, sub.juzEnd - sub.juzStart + 1)} JUZ</div>
                                                                <div>{Math.max(0, sub.pageEnd - sub.pageStart + 1)} PGS</div>
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4 text-center">
                                                            <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded ${sub.status === 'Approved' ? 'bg-emerald-100 text-emerald-700' :
                                                                'bg-amber-100 text-amber-700'
                                                                }`}>
                                                                {sub.status}
                                                            </span>
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <div className={`text-xs font-black p-1.5 rounded-lg border text-center ${sub.teacherName ? 'bg-slate-50 border-slate-200 text-slate-600' : 'bg-red-50 border-red-100 text-red-400 opacity-50'}`}>
                                                                {sub.teacherName || 'Not Specified'}
                                                            </div>
                                                            {sub.approvedBy && sub.status === 'Approved' && (
                                                                <div className="text-[10px] text-emerald-600 font-bold mt-1 flex items-center gap-1">
                                                                    <i className="fa-solid fa-check-double text-[8px]"></i>
                                                                    Approved by {sub.approvedBy}
                                                                </div>
                                                            )}
                                                        </td>
                                                        <td className="px-6 py-4 text-right">
                                                            {sub.status === 'Pending' && (
                                                                <div className="flex justify-end gap-2">
                                                                    <button
                                                                        onClick={() => handleUpdateDouraStatus(sub.id, sub.studentName)}
                                                                        className="w-10 h-10 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl shadow-lg shadow-emerald-500/20 active:scale-95 transition-all flex items-center justify-center"
                                                                        title="Approve"
                                                                    >
                                                                        <i className="fa-solid fa-check"></i>
                                                                    </button>
                                                                </div>
                                                            )}
                                                            <div className="flex justify-end mt-2">
                                                                <button
                                                                    onClick={() => handleDeleteDouraSubmission(sub.id, sub.studentName)}
                                                                    className="w-8 h-8 bg-slate-100 hover:bg-red-50 text-slate-400 hover:text-red-600 rounded-lg active:scale-95 transition-all flex items-center justify-center"
                                                                    title="Delete Submission"
                                                                >
                                                                    <i className="fa-solid fa-trash-can text-xs"></i>
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </>
                )}

                {/* Operation Loading Overlay */}
                {operationLoading.type && (
                    <OperationLoadingSkeleton
                        operation={operationLoading.type}
                        message={operationLoading.message}
                    />
                )}
            </div>

            {/* Task Creation Modal */}
            <AccessibleModal
                isOpen={isTaskModalOpen}
                onClose={handleCloseTaskModal}
                title="Create New Doura Assignment"
                description="Define assignment rules and target audience"
                size="md"
            >
                <div className="space-y-6">
                    <MobileFormInput
                        id="task-title-input"
                        label="Task Title"
                        placeholder="e.g., Weekly Hifz Challenge"
                        value={taskForm.title}
                        onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })}
                        required
                    />

                    <div className="grid grid-cols-3 gap-2">
                        {[
                            { id: 'college', label: 'College', icon: 'fa-school' },
                            { id: 'class', label: 'Class', icon: 'fa-users' },
                            { id: 'student', label: 'Student', icon: 'fa-user' }
                        ].map(scope => (
                            <button
                                key={scope.id}
                                onClick={() => setTaskForm({ ...taskForm, assignmentScope: scope.id as any })}
                                className={`flex flex-col items-center justify-center p-3 rounded-2xl border-2 transition-all gap-1 ${taskForm.assignmentScope === scope.id
                                    ? 'bg-emerald-50 border-emerald-500 text-emerald-700'
                                    : 'bg-white border-slate-100 text-slate-400 hover:border-slate-200'
                                    }`}
                            >
                                <i className={`fa-solid ${scope.icon} text-lg`}></i>
                                <span className="text-[10px] font-black uppercase tracking-widest">{scope.label}</span>
                            </button>
                        ))}
                    </div>

                    {taskForm.assignmentScope !== 'college' && (
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-2">Select Class</label>
                            <select
                                className="w-full p-4 border-2 border-slate-200 rounded-2xl focus:ring-4 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-bold text-slate-700"
                                value={taskForm.targetClass}
                                onChange={async (e) => {
                                    const newClass = e.target.value;
                                    setTaskForm({ ...taskForm, targetClass: newClass, targetStudentAdNo: '' });
                                    if (taskForm.assignmentScope === 'student') {
                                        // Fetch students for this class specifically for the modal
                                        const students = await dataService.getStudentsByClass(newClass);
                                        setClassStudents(students.sort((a, b) => a.name.localeCompare(b.name)));
                                    }
                                }}
                            >
                                {CLASSES.map(c => (
                                    <option key={c} value={c}>{c}</option>
                                ))}
                            </select>
                        </div>
                    )}

                    {taskForm.assignmentScope === 'student' && (
                        <div className="space-y-4">
                            <MobileFormInput
                                id="student-assignment-search"
                                label="Search Student (Name or Ad No)"
                                placeholder="Search..."
                                value={studentSearch}
                                onChange={(e) => setStudentSearch(e.target.value)}
                            />
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-2">Select Student</label>
                                <select
                                    className="w-full p-4 border-2 border-slate-200 rounded-2xl focus:ring-4 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-bold text-slate-700"
                                    value={taskForm.targetStudentAdNo}
                                    onChange={(e) => setTaskForm({ ...taskForm, targetStudentAdNo: e.target.value })}
                                >
                                    <option value="">Select a student...</option>
                                    {classStudents
                                        .filter(s =>
                                            s.name.toLowerCase().includes(studentSearch.toLowerCase()) ||
                                            s.adNo.includes(studentSearch)
                                        )
                                        .map(student => (
                                            <option key={student.adNo} value={student.adNo}>
                                                {student.name} ({student.adNo})
                                            </option>
                                        ))}
                                </select>
                            </div>
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                        <MobileFormInput
                            id="task-juz-start"
                            label="Start Juz"
                            type="number"
                            min={1}
                            max={30}
                            value={taskForm.juzStart}
                            onChange={(e) => setTaskForm({ ...taskForm, juzStart: parseInt(e.target.value) || 1 })}
                        />
                        <MobileFormInput
                            id="task-juz-end"
                            label="End Juz"
                            type="number"
                            min={1}
                            max={30}
                            value={taskForm.juzEnd}
                            onChange={(e) => setTaskForm({ ...taskForm, juzEnd: parseInt(e.target.value) || 1 })}
                        />
                    </div>

                    <MobileFormInput
                        id="task-due-date"
                        label="Due Date"
                        type="date"
                        value={taskForm.dueDate}
                        onChange={(e) => setTaskForm({ ...taskForm, dueDate: e.target.value })}
                    />

                    <div className="flex gap-3 pt-4">
                        <button
                            onClick={handleCloseTaskModal}
                            className="flex-1 py-3 border-2 border-slate-200 rounded-xl font-bold text-slate-600 hover:bg-slate-50 transition-all"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSubmitTask}
                            className="flex-2 py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-600/20"
                        >
                            Create Assignment
                        </button>
                    </div>
                </div>
            </AccessibleModal>

            {/* Data Cleanup Modal */}
            <AccessibleModal
                isOpen={isDataModalOpen}
                onClose={() => setIsDataModalOpen(false)}
                title="Data Cleanup"
                description="Permanently remove student records"
                size="sm"
            >
                <div className="space-y-6">
                    <div className="bg-red-50 p-4 rounded-xl border border-red-100 flex items-start gap-3">
                        <i className="fa-solid fa-triangle-exclamation text-red-500 mt-1"></i>
                        <p className="text-sm text-red-800 font-medium">
                            This action will permanently delete ALL Doura submissions and reset Khatam progress for the selected student. This cannot be undone.
                        </p>
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">Select Class</label>
                        <select
                            value={dataMgmtClass}
                            onChange={async (e) => {
                                const newClass = e.target.value;
                                setDataMgmtClass(newClass);
                                setDataMgmtStudent('');
                                if (newClass) {
                                    setOperationLoading({ type: 'loading-students', message: 'Loading students...' });
                                    try {
                                        const students = await dataService.getStudentsByClass(newClass);
                                        setCleanupStudents(students.sort((a, b) => a.name.localeCompare(b.name)));
                                    } finally {
                                        setOperationLoading({ type: null });
                                    }
                                } else {
                                    setCleanupStudents([]);
                                }
                            }}
                            className="w-full p-3 border-2 border-slate-300 rounded-xl focus:ring-4 focus:ring-red-500/40 focus:border-red-500 bg-white"
                        >
                            <option value="">Choose Class...</option>
                            {CLASSES.map(cls => (
                                <option key={cls} value={cls}>{cls}</option>
                            ))}
                        </select>
                    </div>

                    {dataMgmtClass && (
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-2">Select Student</label>
                            <select
                                value={dataMgmtStudent}
                                onChange={(e) => setDataMgmtStudent(e.target.value)}
                                className="w-full p-3 border-2 border-slate-300 rounded-xl focus:ring-4 focus:ring-red-500/40 focus:border-red-500 bg-white"
                            >
                                <option value="">Choose Student...</option>
                                {cleanupStudents.map(student => (
                                    <option key={student.adNo} value={student.adNo}>{student.name}</option>
                                ))}
                            </select>
                        </div>
                    )}

                    <button
                        onClick={handleDeleteAllData}
                        disabled={!dataMgmtStudent || isDeletingData}
                        className="w-full py-4 bg-red-600 hover:bg-red-700 text-white rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-red-500/20 active:scale-95 transition-all mt-4 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isDeletingData ? 'Deleting...' : 'Delete All Data'}
                    </button>
                </div>
            </AccessibleModal>

            {/* Approval Feedback Modal */}
            <AccessibleModal
                isOpen={isApprovalModalOpen}
                onClose={() => setIsApprovalModalOpen(false)}
                title="Approve Submission"
                description={`Reviewing submission for ${approvalForm.submissionName}`}
                size="md"
            >
                <div className="space-y-6">
                    <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-100 mb-6">
                        <p className="text-sm text-emerald-800 font-medium">
                            <i className="fa-solid fa-circle-info mr-2"></i>
                            You are about to approve this submission. You can add optional feedback for the student below.
                        </p>
                    </div>

                    <div className="space-y-2">
                        <label className="block text-sm font-bold text-slate-700">Teacher's Feedback (Optional)</label>
                        <textarea
                            className="w-full p-4 border-2 border-slate-200 rounded-2xl focus:ring-4 focus:ring-emerald-500/20 focus:border-emerald-500 min-h-[120px] transition-all"
                            placeholder="e.g., Excellent recitation, keep it up!"
                            value={approvalForm.feedback}
                            onChange={(e) => setApprovalForm({ ...approvalForm, feedback: e.target.value })}
                        />
                    </div>

                    <div className="flex gap-3 pt-4">
                        <button
                            onClick={() => setIsApprovalModalOpen(false)}
                            className="flex-1 py-3 border-2 border-slate-200 rounded-xl font-bold text-slate-600 hover:bg-slate-50 transition-all"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={submitApproval}
                            className="flex-2 py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-600/20"
                        >
                            Complete Approval
                        </button>
                    </div>
                </div>
            </AccessibleModal>

            {/* General Confirmation Modal */}
            <AccessibleModal
                isOpen={confirmModal.isOpen}
                onClose={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
                title={confirmModal.title}
                size="sm"
            >
                <div className="space-y-6">
                    <div className={`p-4 rounded-2xl flex items-start gap-4 ${confirmModal.type === 'danger' ? 'bg-red-50' : 'bg-amber-50'}`}>
                        <i className={`fa-solid ${confirmModal.type === 'danger' ? 'fa-triangle-exclamation text-red-500' : 'fa-circle-exclamation text-amber-500'} text-xl mt-1`}></i>
                        <p className={`text-sm font-medium ${confirmModal.type === 'danger' ? 'text-red-800' : 'text-amber-800'}`}>
                            {confirmModal.message}
                        </p>
                    </div>

                    <div className="flex gap-3 pt-2">
                        <button
                            onClick={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
                            className="flex-1 py-3 border-2 border-slate-200 rounded-xl font-bold text-slate-600 hover:bg-slate-50 transition-all"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={confirmModal.onConfirm}
                            className={`flex-1 py-3 rounded-xl font-bold text-white shadow-lg transition-all ${confirmModal.type === 'danger' ? 'bg-red-500 hover:bg-red-600 shadow-red-500/20' : 'bg-amber-500 hover:bg-amber-600 shadow-amber-500/20'}`}
                        >
                            Confirm
                        </button>
                    </div>
                </div>
            </AccessibleModal>
        </div>
    );
};

export default React.memo(DouraMonitoring);
