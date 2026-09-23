import React, { useState, useEffect, useMemo } from 'react';
import { loginAuditService, LoginAuditEntry } from '../../../infrastructure/services/loginAuditService';
import { dataService } from '../../../infrastructure/services/dataService';
import { SYSTEM_CLASSES } from '../../../domain/entities/constants';
import type { TeacherAccount } from '../../../domain/entities/types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDateTime(ts: number) {
    const d = new Date(ts);
    return d.toLocaleString('en-IN', {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
        hour12: true
    });
}

function timeAgo(ts: number) {
    const diff = Date.now() - ts;
    const mins = Math.floor(diff / 60000);
    const hrs = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    if (hrs < 24) return `${hrs}h ago`;
    return `${days}d ago`;
}

function deviceIcon(type: string) {
    if (type === 'mobile') return 'fa-mobile-screen';
    if (type === 'tablet') return 'fa-tablet-screen-button';
    return 'fa-desktop';
}

function exportToCSV(logs: LoginAuditEntry[]) {
    const headers = ['Time', 'Role', 'Username', 'Name', 'Status', 'IP Address', 'Country', 'City', 'ISP', 'Browser', 'OS', 'Device', 'Suspicious', 'Reason', 'Fail Reason'];
    const rows = logs.map(l => [
        formatDateTime(l.timestamp),
        l.role,
        l.username,
        l.name,
        l.success ? 'Success' : 'Failed',
        l.ipAddress,
        l.country || '',
        l.city || '',
        l.isp || '',
        l.browser,
        l.os,
        l.deviceType,
        l.isSuspicious ? 'YES' : 'No',
        (l.suspicionReasons || []).join('; '),
        l.failReason || '',
    ]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `login-audit-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
}

// ─── Main Component ───────────────────────────────────────────────────────────

const LoginAuditManagement: React.FC = () => {
    const [subTab, setSubTab] = useState<'audit' | 'teachers' | 'policy'>('audit');

    // Audit State
    const [logs, setLogs] = useState<LoginAuditEntry[]>([]);
    const [isLoadingLogs, setIsLoadingLogs] = useState(true);
    const [filterRole, setFilterRole] = useState<'all' | 'admin' | 'teacher'>('all');
    const [filterStatus, setFilterStatus] = useState<'all' | 'success' | 'failed' | 'suspicious'>('all');
    const [searchIP, setSearchIP] = useState('');
    const [isClearConfirm, setIsClearConfirm] = useState(false);
    const [isClearing, setIsClearing] = useState(false);
    const [expandedId, setExpandedId] = useState<string | null>(null);

    // Teacher Accounts State
    const [teachers, setTeachers] = useState<TeacherAccount[]>([]);
    const [isLoadingTeachers, setIsLoadingTeachers] = useState(false);
    const [teacherSearch, setTeacherSearch] = useState('');
    const [showTeacherModal, setShowTeacherModal] = useState(false);
    const [editingTeacher, setEditingTeacher] = useState<TeacherAccount | null>(null);
    const [isProvisioning, setIsProvisioning] = useState(false);
    const [visiblePasswords, setVisiblePasswords] = useState<Record<string, boolean>>({});
    const [teacherForm, setTeacherForm] = useState({
        name: '',
        username: '',
        mobileNumber: '',
        password: '',
        assignedClasses: [] as string[],
        isActive: true
    });
    const [actionStatus, setActionStatus] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

    // Load Audit Logs
    const loadLogs = async () => {
        setIsLoadingLogs(true);
        const data = await loginAuditService.getLogs(500);
        setLogs(data);
        setIsLoadingLogs(false);
    };

    // Load Teacher Accounts
    const loadTeachers = async () => {
        setIsLoadingTeachers(true);
        try {
            const list = await dataService.getAllTeacherAccounts();
            setTeachers(list);
        } catch (err) {
            console.error('Failed to load teacher accounts:', err);
        } finally {
            setIsLoadingTeachers(false);
        }
    };

    useEffect(() => {
        loadLogs();
        loadTeachers();
    }, []);

    // ── Audit Stats ───────────────────────────────────────────────────────────
    const stats = useMemo(() => {
        const last24h = Date.now() - 86400000;
        const uniqueIPs = new Set(logs.map(l => l.ipAddress)).size;
        const failed = logs.filter(l => !l.success).length;
        const suspicious = logs.filter(l => l.isSuspicious).length;
        const suspiciousRecent = logs.filter(l => l.isSuspicious && l.timestamp > last24h).length;
        return { total: logs.length, uniqueIPs, failed, suspicious, suspiciousRecent };
    }, [logs]);

    // ── Filtered Audit Logs ───────────────────────────────────────────────────
    const filteredLogs = useMemo(() => {
        return logs.filter(l => {
            if (filterRole !== 'all' && l.role !== filterRole) return false;
            if (filterStatus === 'success' && !l.success) return false;
            if (filterStatus === 'failed' && l.success) return false;
            if (filterStatus === 'suspicious' && !l.isSuspicious) return false;
            if (searchIP && !l.ipAddress.includes(searchIP) && !l.username.toLowerCase().includes(searchIP.toLowerCase()) && !l.name.toLowerCase().includes(searchIP.toLowerCase())) return false;
            return true;
        });
    }, [logs, filterRole, filterStatus, searchIP]);

    // ── Filtered Teachers ──────────────────────────────────────────────────────
    const filteredTeachers = useMemo(() => {
        const q = teacherSearch.trim().toLowerCase();
        if (!q) return teachers;
        return teachers.filter(t =>
            t.name.toLowerCase().includes(q) ||
            t.username.toLowerCase().includes(q) ||
            t.mobileNumber.includes(q) ||
            (t.assignedClasses || []).some(c => c.toLowerCase().includes(q))
        );
    }, [teachers, teacherSearch]);

    // ── Clear Logs Handlers ────────────────────────────────────────────────────
    const handleClearAll = async () => {
        setIsClearing(true);
        await loginAuditService.clearAllLogs();
        setLogs([]);
        setIsClearConfirm(false);
        setIsClearing(false);
    };

    const handleClearOld = async () => {
        setIsClearing(true);
        const n = await loginAuditService.clearOldLogs(90);
        alert(`Deleted ${n} log entries older than 90 days.`);
        await loadLogs();
        setIsClearing(false);
    };

    // ── Teacher CRUD & Auto Provisioning ──────────────────────────────────────
    const handleOpenTeacherModal = (teacher?: TeacherAccount) => {
        if (teacher) {
            setEditingTeacher(teacher);
            setTeacherForm({
                name: teacher.name,
                username: teacher.username,
                mobileNumber: teacher.mobileNumber,
                password: teacher.password,
                assignedClasses: teacher.assignedClasses || [],
                isActive: teacher.isActive
            });
        } else {
            setEditingTeacher(null);
            setTeacherForm({
                name: '',
                username: '',
                mobileNumber: '',
                password: '',
                assignedClasses: [],
                isActive: true
            });
        }
        setActionStatus(null);
        setShowTeacherModal(true);
    };

    const handleSaveTeacher = async (e: React.FormEvent) => {
        e.preventDefault();
        setActionStatus(null);

        if (!teacherForm.name.trim() || !teacherForm.username.trim() || !teacherForm.mobileNumber.trim() || !teacherForm.password.trim()) {
            setActionStatus({ type: 'error', msg: 'Name, Username, Mobile Number, and Password are all required.' });
            return;
        }

        try {
            if (editingTeacher) {
                await dataService.updateTeacherAccount(editingTeacher.id, {
                    name: teacherForm.name.trim(),
                    username: teacherForm.username.trim(),
                    mobileNumber: teacherForm.mobileNumber.trim(),
                    password: teacherForm.password.trim(),
                    assignedClasses: teacherForm.assignedClasses,
                    isActive: teacherForm.isActive
                });
                setActionStatus({ type: 'success', msg: 'Teacher profile updated successfully!' });
            } else {
                await dataService.saveTeacherAccount({
                    name: teacherForm.name.trim(),
                    username: teacherForm.username.trim(),
                    mobileNumber: teacherForm.mobileNumber.trim(),
                    password: teacherForm.password.trim(),
                    assignedClasses: teacherForm.assignedClasses,
                    isActive: teacherForm.isActive
                });
                setActionStatus({ type: 'success', msg: 'New teacher account created successfully!' });
            }
            await loadTeachers();
            setTimeout(() => setShowTeacherModal(false), 1000);
        } catch (err) {
            console.error('Failed to save teacher account:', err);
            setActionStatus({ type: 'error', msg: 'Error saving teacher account.' });
        }
    };

    const handleDeleteTeacher = async (id: string) => {
        if (!window.confirm('Are you sure you want to delete this teacher account?')) return;
        try {
            await dataService.deleteTeacherAccount(id);
            await loadTeachers();
        } catch (err) {
            console.error('Failed to delete teacher account:', err);
        }
    };

    const handleAutoProvisionTeachers = async () => {
        if (!confirm('This will scan all subjects in the system to discover faculty names without accounts, and automatically create teacher accounts with default password (dawa@2025).\n\nProceed?')) return;
        setIsProvisioning(true);
        try {
            const res = await dataService.provisionMissingTeacherAccounts();
            if (res.provisioned > 0) {
                alert(`✅ Successfully auto-provisioned ${res.provisioned} new teacher account(s):\n\n${res.teacherNames.join(', ')}\n\nDefault Password: dawa@2025`);
                await loadTeachers();
            } else {
                alert('ℹ️ All faculty members in current subjects already have active accounts.');
            }
        } catch (err) {
            console.error('Auto-provision failed:', err);
            alert('Error during auto-provisioning.');
        } finally {
            setIsProvisioning(false);
        }
    };

    const handleCopyCredentialSheet = () => {
        if (teachers.length === 0) return;
        let text = `====================================================\n`;
        text += `       AIC DAWA COLLEGE - FACULTY LOGIN CREDENTIALS  \n`;
        text += `====================================================\n\n`;
        teachers.forEach(t => {
            text += `Faculty Name : ${t.name}\n`;
            text += `Username     : ${t.username}\n`;
            text += `Mobile No.   : ${t.mobileNumber}\n`;
            text += `Password     : ${t.password}\n`;
            text += `Status       : ${t.isActive ? 'Active' : 'Inactive'}\n`;
            text += `----------------------------------------------------\n`;
        });
        navigator.clipboard.writeText(text);
        alert('📋 Credential Sheet copied to clipboard!');
    };

    const togglePasswordVisibility = (id: string) => {
        setVisiblePasswords(prev => ({ ...prev, [id]: !prev[id] }));
    };

    const toggleClassAssignment = (cls: string) => {
        setTeacherForm(prev => {
            const exists = prev.assignedClasses.includes(cls);
            return {
                ...prev,
                assignedClasses: exists
                    ? prev.assignedClasses.filter(c => c !== cls)
                    : [...prev.assignedClasses, cls]
            };
        });
    };

    return (
        <div className="space-y-6">
            {/* Header & Sub-Navigation */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-4 sm:p-6 rounded-3xl shadow-xl">
                <div>
                    <h2 className="text-xl font-black text-white flex items-center gap-3">
                        <div className="w-10 h-10 bg-indigo-600/20 border border-indigo-500/30 rounded-2xl flex items-center justify-center text-indigo-400">
                            <i className="fa-solid fa-shield-halved text-lg"></i>
                        </div>
                        Admin & Teacher Login Management
                    </h2>
                    <p className="text-slate-400 text-xs sm:text-sm mt-1">Manage authentication accounts, teacher credentials, and real-time security audit logs</p>
                </div>

                <div className="flex items-center gap-1.5 bg-slate-800 p-1.5 rounded-2xl border border-slate-700/80">
                    <button
                        onClick={() => setSubTab('audit')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all ${subTab === 'audit' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' : 'text-slate-400 hover:text-white'}`}
                    >
                        <i className="fa-solid fa-list-check"></i>
                        Login Audit ({logs.length})
                    </button>
                    <button
                        onClick={() => setSubTab('teachers')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all ${subTab === 'teachers' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' : 'text-slate-400 hover:text-white'}`}
                    >
                        <i className="fa-solid fa-user-gear"></i>
                        Teacher Accounts ({teachers.length})
                    </button>
                    <button
                        onClick={() => setSubTab('policy')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all ${subTab === 'policy' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' : 'text-slate-400 hover:text-white'}`}
                    >
                        <i className="fa-solid fa-lock"></i>
                        Security Policy
                    </button>
                </div>
            </div>

            {/* ══════════════════════════════════════════════════════════════════ */}
            {/* SUB-TAB 1: LOGIN AUDIT LOGS                                      */}
            {/* ══════════════════════════════════════════════════════════════════ */}
            {subTab === 'audit' && (
                <div className="space-y-6">
                    {/* Header Actions */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping"></span>
                            <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">Real-time Login Event Stream</h3>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                            <button
                                onClick={loadLogs}
                                className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs transition-all"
                            >
                                <i className="fa-solid fa-rotate"></i> Refresh Audit
                            </button>
                            <button
                                onClick={() => exportToCSV(filteredLogs)}
                                disabled={filteredLogs.length === 0}
                                className="flex items-center gap-2 px-4 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-xl font-bold text-xs transition-all disabled:opacity-40"
                            >
                                <i className="fa-solid fa-file-csv"></i> Export CSV
                            </button>
                            {!isClearConfirm ? (
                                <button
                                    onClick={() => setIsClearConfirm(true)}
                                    className="flex items-center gap-2 px-4 py-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl font-bold text-xs transition-all"
                                >
                                    <i className="fa-solid fa-trash"></i> Clear Logs
                                </button>
                            ) : (
                                <div className="flex items-center gap-2">
                                    <span className="text-red-600 text-xs font-bold">Are you sure?</span>
                                    <button onClick={handleClearAll} disabled={isClearing}
                                        className="px-3 py-1.5 bg-red-600 text-white rounded-lg text-xs font-black hover:bg-red-700 transition-all">
                                        {isClearing ? 'Clearing...' : 'Yes, Clear All'}
                                    </button>
                                    <button onClick={() => setIsClearConfirm(false)}
                                        className="px-3 py-1.5 bg-slate-200 text-slate-700 rounded-lg text-xs font-black hover:bg-slate-300 transition-all">
                                        Cancel
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Suspicious Alert Banner */}
                    {stats.suspiciousRecent > 0 && (
                        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-start gap-4 shadow-sm">
                            <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center flex-shrink-0">
                                <i className="fa-solid fa-triangle-exclamation text-red-500 text-lg animate-pulse"></i>
                            </div>
                            <div>
                                <p className="font-black text-red-700">⚠️ {stats.suspiciousRecent} Suspicious Login{stats.suspiciousRecent > 1 ? 's' : ''} in the last 24 hours!</p>
                                <p className="text-red-600 text-xs sm:text-sm mt-0.5">Failed attempts or foreign IP addresses detected. Review the entries below marked with <span className="bg-red-100 text-red-700 px-1 rounded font-bold">🚨 Suspicious</span>.</p>
                            </div>
                        </div>
                    )}

                    {/* Stats Cards */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        {[
                            { label: 'Total Logins', value: stats.total, icon: 'fa-key', color: 'indigo' },
                            { label: 'Unique IPs', value: stats.uniqueIPs, icon: 'fa-network-wired', color: 'blue' },
                            { label: 'Failed Attempts', value: stats.failed, icon: 'fa-xmark-circle', color: 'orange' },
                            { label: 'Suspicious Logins', value: stats.suspicious, icon: 'fa-user-secret', color: 'red' },
                        ].map(s => (
                            <div key={s.label} className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-xs font-bold text-slate-500">{s.label}</span>
                                    <div className="w-8 h-8 rounded-xl bg-slate-50 flex items-center justify-center">
                                        <i className={`fa-solid ${s.icon} text-slate-600 text-xs`}></i>
                                    </div>
                                </div>
                                <p className="text-2xl font-black text-slate-900">{s.value}</p>
                            </div>
                        ))}
                    </div>

                    {/* Filter Toolbar */}
                    <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm space-y-3">
                        <div className="flex flex-wrap gap-3 items-center">
                            <div className="flex items-center gap-1 bg-slate-100 rounded-xl p-1">
                                {(['all', 'admin', 'teacher'] as const).map(r => (
                                    <button key={r} onClick={() => setFilterRole(r)}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${filterRole === r ? 'bg-indigo-600 text-white shadow' : 'text-slate-500 hover:text-slate-800'}`}>
                                        {r}
                                    </button>
                                ))}
                            </div>
                            <div className="flex items-center gap-1 bg-slate-100 rounded-xl p-1">
                                {(['all', 'success', 'failed', 'suspicious'] as const).map(s => (
                                    <button key={s} onClick={() => setFilterStatus(s)}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${filterStatus === s
                                            ? s === 'suspicious' ? 'bg-red-600 text-white shadow'
                                            : s === 'failed' ? 'bg-orange-500 text-white shadow'
                                            : s === 'success' ? 'bg-emerald-600 text-white shadow'
                                            : 'bg-indigo-600 text-white shadow'
                                            : 'text-slate-500 hover:text-slate-800'}`}>
                                        {s}
                                    </button>
                                ))}
                            </div>
                            <div className="flex-1 min-w-[200px] relative">
                                <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
                                <input
                                    type="text"
                                    value={searchIP}
                                    onChange={e => setSearchIP(e.target.value)}
                                    placeholder="Search by IP, username, or name..."
                                    className="w-full pl-8 pr-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 outline-none"
                                />
                            </div>
                            <p className="text-xs text-slate-400 font-medium ml-auto">
                                Showing <span className="font-black text-slate-700">{filteredLogs.length}</span> of {logs.length} entries
                            </p>
                        </div>
                    </div>

                    {/* Audit Logs Table */}
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                        {isLoadingLogs ? (
                            <div className="flex items-center justify-center py-16">
                                <div className="text-center">
                                    <div className="loader-ring mb-4"></div>
                                    <p className="text-slate-500 text-xs font-bold">Loading login audit stream...</p>
                                </div>
                            </div>
                        ) : filteredLogs.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                                <i className="fa-solid fa-shield-halved text-5xl mb-3 opacity-20"></i>
                                <p className="font-bold text-base text-slate-600">No login records found</p>
                                <p className="text-xs text-slate-400 mt-0.5">Logins will automatically record here after the next attempt.</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead>
                                        <tr className="bg-slate-50 border-b border-slate-200">
                                            <th className="text-left text-[10px] font-black text-slate-500 uppercase tracking-widest px-4 py-3">Timestamp</th>
                                            <th className="text-left text-[10px] font-black text-slate-500 uppercase tracking-widest px-4 py-3">User & Role</th>
                                            <th className="text-left text-[10px] font-black text-slate-500 uppercase tracking-widest px-4 py-3">Status</th>
                                            <th className="text-left text-[10px] font-black text-slate-500 uppercase tracking-widest px-4 py-3">IP Address</th>
                                            <th className="text-left text-[10px] font-black text-slate-500 uppercase tracking-widest px-4 py-3">Location</th>
                                            <th className="text-left text-[10px] font-black text-slate-500 uppercase tracking-widest px-4 py-3">Device & Browser</th>
                                            <th className="text-left text-[10px] font-black text-slate-500 uppercase tracking-widest px-4 py-3">Flag</th>
                                            <th className="text-left text-[10px] font-black text-slate-500 uppercase tracking-widest px-4 py-3"></th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {filteredLogs.map(log => (
                                            <React.Fragment key={log.id}>
                                                <tr
                                                    onClick={() => setExpandedId(expandedId === log.id ? null : (log.id || null))}
                                                    className={`hover:bg-slate-50/80 transition-colors cursor-pointer ${log.isSuspicious ? 'bg-red-50/40' : ''}`}
                                                >
                                                    <td className="px-4 py-3">
                                                        <p className="text-xs font-bold text-slate-800">{timeAgo(log.timestamp)}</p>
                                                        <p className="text-[10px] text-slate-400 mt-0.5">{formatDateTime(log.timestamp)}</p>
                                                    </td>

                                                    <td className="px-4 py-3">
                                                        <div className="flex items-center gap-2">
                                                            <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${log.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                                                                <i className={`fa-solid ${log.role === 'admin' ? 'fa-user-shield' : 'fa-chalkboard-user'} text-xs`}></i>
                                                            </div>
                                                            <div>
                                                                <p className="text-xs font-black text-slate-800">{log.name}</p>
                                                                <div className="flex items-center gap-1 mt-0.5">
                                                                    <span className={`text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded ${log.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                                                                        {log.role}
                                                                    </span>
                                                                    <span className="text-[10px] text-slate-400">@{log.username}</span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </td>

                                                    <td className="px-4 py-3">
                                                        <span className={`inline-flex items-center gap-1.5 text-xs font-black px-2.5 py-1 rounded-full ${log.success
                                                            ? 'bg-emerald-100 text-emerald-700'
                                                            : 'bg-red-100 text-red-700'}`}>
                                                            <i className={`fa-solid ${log.success ? 'fa-check' : 'fa-xmark'} text-[10px]`}></i>
                                                            {log.success ? 'Success' : 'Failed'}
                                                        </span>
                                                        {log.failReason && (
                                                            <p className="text-[10px] text-red-500 font-medium mt-0.5">{log.failReason}</p>
                                                        )}
                                                    </td>

                                                    <td className="px-4 py-3">
                                                        <p className="text-xs font-mono font-bold text-slate-800">{log.ipAddress}</p>
                                                        {log.isp && <p className="text-[10px] text-slate-400 mt-0.5 truncate max-w-[140px]">{log.isp}</p>}
                                                    </td>

                                                    <td className="px-4 py-3">
                                                        {log.country ? (
                                                            <div className="flex items-center gap-1.5">
                                                                <i className="fa-solid fa-location-dot text-slate-400 text-xs"></i>
                                                                <div>
                                                                    <p className="text-xs font-bold text-slate-700">{log.country}</p>
                                                                    <p className="text-[10px] text-slate-400">{log.city}</p>
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <span className="text-xs text-slate-300">—</span>
                                                        )}
                                                    </td>

                                                    <td className="px-4 py-3">
                                                        <div className="flex items-center gap-1.5">
                                                            <i className={`fa-solid ${deviceIcon(log.deviceType)} text-slate-400 text-xs`}></i>
                                                            <div>
                                                                <p className="text-xs font-bold text-slate-700">{log.browser}</p>
                                                                <p className="text-[10px] text-slate-400">{log.os}</p>
                                                            </div>
                                                        </div>
                                                    </td>

                                                    <td className="px-4 py-3">
                                                        {log.isSuspicious ? (
                                                            <span className="inline-flex items-center gap-1 text-[10px] font-black bg-red-100 text-red-700 px-2 py-1 rounded-full border border-red-200">
                                                                <i className="fa-solid fa-triangle-exclamation text-[9px]"></i>
                                                                Suspicious
                                                            </span>
                                                        ) : (
                                                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600">
                                                                <i className="fa-solid fa-circle-check text-xs text-emerald-500"></i>
                                                                OK
                                                            </span>
                                                        )}
                                                    </td>

                                                    <td className="px-4 py-3 text-right">
                                                        <i className={`fa-solid fa-chevron-${expandedId === log.id ? 'up' : 'down'} text-slate-300 text-xs`}></i>
                                                    </td>
                                                </tr>

                                                {expandedId === log.id && (
                                                    <tr className={log.isSuspicious ? 'bg-red-50/80' : 'bg-slate-50'}>
                                                        <td colSpan={8} className="px-6 py-4">
                                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                                <div>
                                                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Full ISO Timestamp</p>
                                                                    <p className="text-xs font-mono font-bold text-slate-800">{new Date(log.timestamp).toISOString()}</p>
                                                                </div>
                                                                {log.suspicionReasons && log.suspicionReasons.length > 0 && (
                                                                    <div>
                                                                        <p className="text-[10px] font-black text-red-500 uppercase tracking-widest mb-1">⚠️ Suspicion Triggers</p>
                                                                        <ul className="space-y-1">
                                                                            {log.suspicionReasons.map((r, i) => (
                                                                                <li key={i} className="text-xs font-bold text-red-700 flex items-center gap-1.5">
                                                                                    <i className="fa-solid fa-circle-exclamation text-[10px]"></i>
                                                                                    {r}
                                                                                </li>
                                                                            ))}
                                                                        </ul>
                                                                    </div>
                                                                )}
                                                                <div className="sm:col-span-2">
                                                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">User Agent Header</p>
                                                                    <p className="text-[11px] text-slate-600 font-mono bg-white border border-slate-200 rounded-xl p-2.5 break-all">{log.userAgent}</p>
                                                                </div>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                )}
                                            </React.Fragment>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>

                    {logs.length > 0 && (
                        <div className="flex justify-end">
                            <button
                                onClick={handleClearOld}
                                disabled={isClearing}
                                className="flex items-center gap-2 px-4 py-2 text-slate-500 hover:text-slate-800 text-xs font-bold transition-all"
                            >
                                <i className="fa-solid fa-clock-rotate-left"></i>
                                Delete logs older than 90 days
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* ══════════════════════════════════════════════════════════════════ */}
            {/* SUB-TAB 2: TEACHER ACCOUNTS & CREDENTIAL MANAGEMENT               */}
            {/* ══════════════════════════════════════════════════════════════════ */}
            {subTab === 'teachers' && (
                <div className="space-y-6">
                    {/* Actions Bar */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white border border-slate-200 p-4 rounded-2xl shadow-sm">
                        <div className="flex-1 min-w-[240px] relative">
                            <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
                            <input
                                type="text"
                                value={teacherSearch}
                                onChange={e => setTeacherSearch(e.target.value)}
                                placeholder="Search teacher by name, username, mobile..."
                                className="w-full pl-8 pr-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 outline-none"
                            />
                        </div>

                        <div className="flex items-center gap-2 flex-wrap">
                            <button
                                onClick={handleCopyCredentialSheet}
                                disabled={teachers.length === 0}
                                className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all disabled:opacity-40"
                            >
                                <i className="fa-solid fa-copy"></i> Copy Credential Sheet
                            </button>
                            <button
                                onClick={handleAutoProvisionTeachers}
                                disabled={isProvisioning}
                                className="flex items-center gap-2 px-4 py-2 bg-purple-50 hover:bg-purple-100 text-purple-700 text-xs font-bold rounded-xl transition-all border border-purple-200 disabled:opacity-40"
                            >
                                <i className="fa-solid fa-wand-magic-sparkles"></i>
                                {isProvisioning ? 'Provisioning...' : 'Auto-Provision Faculty'}
                            </button>
                            <button
                                onClick={() => handleOpenTeacherModal()}
                                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-md transition-all"
                            >
                                <i className="fa-solid fa-plus"></i> Create Teacher Account
                            </button>
                        </div>
                    </div>

                    {/* Teacher Cards Grid */}
                    {isLoadingTeachers ? (
                        <div className="py-16 text-center text-slate-400 text-xs font-bold">Loading teacher accounts...</div>
                    ) : filteredTeachers.length === 0 ? (
                        <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center text-slate-400">
                            <i className="fa-solid fa-chalkboard-user text-4xl mb-3 opacity-30"></i>
                            <p className="font-bold text-base text-slate-700">No teacher accounts found</p>
                            <p className="text-xs text-slate-400 mt-1">Click "Auto-Provision Faculty" to automatically create accounts for all subject teachers, or click "Create Teacher Account".</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {filteredTeachers.map(teacher => {
                                const showPass = visiblePasswords[teacher.id];
                                return (
                                    <div key={teacher.id} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4 hover:border-slate-300 transition-all">
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 font-black text-sm flex-shrink-0">
                                                    {teacher.name.charAt(0).toUpperCase()}
                                                </div>
                                                <div>
                                                    <h4 className="text-sm font-black text-slate-900">{teacher.name}</h4>
                                                    <span className={`inline-block px-2 py-0.5 text-[9px] font-black uppercase tracking-wider rounded-md mt-0.5 ${teacher.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                                                        {teacher.isActive ? 'Active' : 'Inactive'}
                                                    </span>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-1">
                                                <button
                                                    onClick={() => handleOpenTeacherModal(teacher)}
                                                    className="p-1.5 text-slate-400 hover:text-indigo-600 rounded-lg hover:bg-slate-50 transition-colors"
                                                    title="Edit Account"
                                                >
                                                    <i className="fa-solid fa-pen-to-square text-xs"></i>
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteTeacher(teacher.id)}
                                                    className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-slate-50 transition-colors"
                                                    title="Delete Account"
                                                >
                                                    <i className="fa-solid fa-trash text-xs"></i>
                                                </button>
                                            </div>
                                        </div>

                                        <div className="bg-slate-50 rounded-xl p-3 space-y-2 border border-slate-100 text-xs">
                                            <div className="flex items-center justify-between">
                                                <span className="text-slate-400 font-medium">Username:</span>
                                                <span className="font-mono font-bold text-slate-800">@{teacher.username}</span>
                                            </div>
                                            <div className="flex items-center justify-between">
                                                <span className="text-slate-400 font-medium">Mobile:</span>
                                                <span className="font-mono font-bold text-slate-800">{teacher.mobileNumber}</span>
                                            </div>
                                            <div className="flex items-center justify-between">
                                                <span className="text-slate-400 font-medium">Password:</span>
                                                <div className="flex items-center gap-2">
                                                    <span className="font-mono font-bold text-slate-800">
                                                        {showPass ? teacher.password : '••••••••'}
                                                    </span>
                                                    <button
                                                        onClick={() => togglePasswordVisibility(teacher.id)}
                                                        className="text-slate-400 hover:text-slate-600 text-xs"
                                                    >
                                                        <i className={`fa-solid ${showPass ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                                                    </button>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="text-xs text-slate-500">
                                            <span className="font-bold text-slate-700">Assigned Classes: </span>
                                            {teacher.assignedClasses && teacher.assignedClasses.length > 0
                                                ? teacher.assignedClasses.join(', ')
                                                : <span className="text-slate-400 italic">All Classes</span>}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* ══════════════════════════════════════════════════════════════════ */}
            {/* SUB-TAB 3: ADMIN SECURITY POLICY                                  */}
            {/* ══════════════════════════════════════════════════════════════════ */}
            {subTab === 'policy' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
                        <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center">
                            <i className="fa-solid fa-user-shield text-lg"></i>
                        </div>
                        <h3 className="text-base font-black text-slate-900">Admin Authentication Policy</h3>
                        <p className="text-xs text-slate-500 leading-relaxed">
                            System Administrator accounts have unrestricted privileges over student marks, class structures, terms, and system settings.
                        </p>
                        <div className="space-y-3 pt-2">
                            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs">
                                <span className="font-bold text-slate-700">Environment Credentials</span>
                                <span className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded font-black text-[10px] uppercase">Active</span>
                            </div>
                            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs">
                                <span className="font-bold text-slate-700">Danger Zone Pin Lock</span>
                                <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded font-black text-[10px] uppercase">Enforced</span>
                            </div>
                            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs">
                                <span className="font-bold text-slate-700">Public Student Search Strict Class Check</span>
                                <span className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded font-black text-[10px] uppercase">Active</span>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
                        <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center">
                            <i className="fa-solid fa-shield-check text-lg"></i>
                        </div>
                        <h3 className="text-base font-black text-slate-900">Automatic Security Measures</h3>
                        <div className="space-y-3 text-xs text-slate-600">
                            <div className="flex items-start gap-2">
                                <i className="fa-solid fa-check text-emerald-500 mt-0.5"></i>
                                <p><strong>IP Geolocation & Device Tracking:</strong> Every login attempt (Admin & Faculty) resolves public IP, ISP, country, browser, and OS.</p>
                            </div>
                            <div className="flex items-start gap-2">
                                <i className="fa-solid fa-check text-emerald-500 mt-0.5"></i>
                                <p><strong>Non-Blocking Async Audit:</strong> Logging executes silently without affecting user login speed or crashing active sessions.</p>
                            </div>
                            <div className="flex items-start gap-2">
                                <i className="fa-solid fa-check text-emerald-500 mt-0.5"></i>
                                <p><strong>Suspicious Login Alerts:</strong> Automatic flags for failed login credentials and non-local country access.</p>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ══════════════════════════════════════════════════════════════════ */}
            {/* TEACHER CREATE/EDIT MODAL                                        */}
            {/* ══════════════════════════════════════════════════════════════════ */}
            {showTeacherModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
                    <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl space-y-5">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                            <h3 className="text-base font-black text-slate-900">
                                {editingTeacher ? 'Edit Teacher Account' : 'Create New Teacher Account'}
                            </h3>
                            <button onClick={() => setShowTeacherModal(false)} className="text-slate-400 hover:text-slate-600 font-bold">✕</button>
                        </div>

                        {actionStatus && (
                            <div className={`p-3 text-xs rounded-xl font-bold ${actionStatus.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                                {actionStatus.msg}
                            </div>
                        )}

                        <form onSubmit={handleSaveTeacher} className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">Faculty Full Name</label>
                                <input
                                    type="text"
                                    value={teacherForm.name}
                                    onChange={e => setTeacherForm(prev => ({ ...prev, name: e.target.value }))}
                                    placeholder="e.g. Dr. Ahmad Usthad"
                                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:ring-2 focus:ring-indigo-500 outline-none"
                                    required
                                />
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">Mobile Number (Login ID)</label>
                                    <input
                                        type="text"
                                        value={teacherForm.mobileNumber}
                                        onChange={e => setTeacherForm(prev => ({ ...prev, mobileNumber: e.target.value }))}
                                        placeholder="e.g. 9876543210"
                                        className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:ring-2 focus:ring-indigo-500 outline-none"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">Username (Login ID)</label>
                                    <input
                                        type="text"
                                        value={teacherForm.username}
                                        onChange={e => setTeacherForm(prev => ({ ...prev, username: e.target.value }))}
                                        placeholder="e.g. usthad_ahmad"
                                        className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:ring-2 focus:ring-indigo-500 outline-none"
                                        required
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">Password</label>
                                <input
                                    type="text"
                                    value={teacherForm.password}
                                    onChange={e => setTeacherForm(prev => ({ ...prev, password: e.target.value }))}
                                    placeholder="Enter login password"
                                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:ring-2 focus:ring-indigo-500 outline-none"
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1.5">Assigned Classes</label>
                                <div className="flex flex-wrap gap-1.5">
                                    {SYSTEM_CLASSES.map(cls => {
                                        const isSelected = teacherForm.assignedClasses.includes(cls);
                                        return (
                                            <button
                                                type="button"
                                                key={cls}
                                                onClick={() => toggleClassAssignment(cls)}
                                                className={`px-3 py-1 rounded-xl text-xs font-bold transition-all ${isSelected ? 'bg-indigo-600 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                                            >
                                                {cls}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            <div className="flex items-center gap-2 pt-2">
                                <input
                                    type="checkbox"
                                    id="teacherActive"
                                    checked={teacherForm.isActive}
                                    onChange={e => setTeacherForm(prev => ({ ...prev, isActive: e.target.checked }))}
                                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                />
                                <label htmlFor="teacherActive" className="text-xs font-bold text-slate-700">Account Active (Allow Login)</label>
                            </div>

                            <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
                                <button
                                    type="button"
                                    onClick={() => setShowTeacherModal(false)}
                                    className="px-4 py-2 bg-slate-100 text-slate-600 text-xs font-bold rounded-xl hover:bg-slate-200"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-md"
                                >
                                    Save Account
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default LoginAuditManagement;
