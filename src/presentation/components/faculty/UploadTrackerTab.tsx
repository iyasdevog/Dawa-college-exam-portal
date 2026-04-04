import React, { useMemo, useState } from 'react';
import { StudentRecord, SubjectConfig } from '../../../domain/entities/types';
import { normalizeName } from '../../../infrastructure/services/formatUtils';

interface UploadTrackerTabProps {
    subjects: SubjectConfig[];
    allStudents: StudentRecord[];
    allowedClasses: string[];
}

const UploadTrackerTab: React.FC<UploadTrackerTabProps> = ({
    subjects,
    allStudents,
    allowedClasses
}) => {
    const [trackerClassFilter, setTrackerClassFilter] = useState<string>('all');
    const [trackerTeacherFilter, setTrackerTeacherFilter] = useState<string>('all');
    const [trackerSubjectSearch, setTrackerSubjectSearch] = useState<string>('');
    const [trackerStatusFilter, setTrackerStatusFilter] = useState<'all' | 'complete' | 'in-progress' | 'not-started'>('all');
    // Unique faculty names for filter
    const facultyOptions = useMemo(() => {
        const facultyNames = subjects
            .map(s => s.facultyName)
            .filter(Boolean)
            .map(f => normalizeName(f!));

        const uniqueMap = new Map<string, string>();
        facultyNames.forEach(name => {
            const key = name.toLowerCase();
            if (!uniqueMap.has(key)) {
                uniqueMap.set(key, name);
            }
        });

        return Array.from(uniqueMap.values()).sort();
    }, [subjects]);

    // Calculate statistics and filter subjects
    const { subjectsWithStatus, completeCount, inProgressCount, notStartedCount, filteredByFiltersCount } = useMemo(() => {
        // Expand general subjects into separate entries per class
        const expandedSubjects = subjects.flatMap(subject => {
            if (subject.subjectType === 'general' && (subject.targetClasses?.length || 0) > 0) {
                return subject.targetClasses.map(className => ({
                    ...subject,
                    displayClass: className,
                    isExpanded: true
                }));
            } else {
                return [{
                    ...subject,
                    displayClass: null,
                    isExpanded: false
                }];
            }
        });

        const filteredByFilters = expandedSubjects.filter(subject => {
            const classMatch = trackerClassFilter === 'all' ||
                (subject.isExpanded ? subject.displayClass === trackerClassFilter : subject.targetClasses.includes(trackerClassFilter));
            const teacherMatch = trackerTeacherFilter === 'all' || subject.facultyName === trackerTeacherFilter;
            const searchMatch = trackerSubjectSearch === '' || subject.name.toLowerCase().includes(trackerSubjectSearch.toLowerCase());
            return classMatch && teacherMatch && searchMatch;
        });

        const checkMarkStatus = (student: StudentRecord, subjectId: string) => {
            const marks = student.marks && student.marks[subjectId];
            return {
                hasINT: !!(marks && (marks.int !== undefined && marks.int !== null && marks.int !== ('' as any))),
                hasEXT: !!(marks && (marks.ext !== undefined && marks.ext !== null && marks.ext !== ('' as any)))
            };
        };

        const stats = filteredByFilters.map(subject => {
            let totalStudents = 0;
            let uploadedINT = 0;
            let uploadedEXT = 0;

            if (subject.subjectType === 'general' && subject.isExpanded) {
                const className = subject.displayClass!;
                const classStudents = allStudents.filter(s => (s.className || s.currentClass) === className);
                totalStudents = classStudents.length;
                classStudents.forEach(s => {
                    const { hasINT, hasEXT } = checkMarkStatus(s, subject.id);
                    if (hasINT) uploadedINT++;
                    if (hasEXT || (subject.maxEXT || 0) === 0 || subject.maxINT === 100) uploadedEXT++;
                });
            } else {
                const enrolledStudentIds = subject.enrolledStudents || [];
                totalStudents = enrolledStudentIds.length;
                allStudents.filter(s => enrolledStudentIds.includes(s.id)).forEach(s => {
                    const { hasINT, hasEXT } = checkMarkStatus(s, subject.id);
                    if (hasINT) uploadedINT++;
                    if (hasEXT || (subject.maxEXT || 0) === 0 || subject.maxINT === 100) uploadedEXT++;
                });
            }

            const intPercentage = totalStudents > 0 ? Math.round((uploadedINT / totalStudents) * 100) : 0;
            const extPercentage = totalStudents > 0 ? Math.round((uploadedEXT / totalStudents) * 100) : 100;

            let status: 'complete' | 'in-progress' | 'not-started';
            if (intPercentage === 100 && extPercentage === 100) {
                status = 'complete';
            } else if (intPercentage === 0 && (extPercentage === 0 || (subject.maxEXT || 0) === 0 || subject.maxINT === 100)) {
                status = 'not-started';
            } else {
                status = 'in-progress';
            }

            return {
                ...subject,
                totalStudents,
                uploadedINT,
                uploadedEXT,
                intPercentage,
                extPercentage,
                status
            };
        });

        const finalFiltered = stats.filter(subject => {
            if (trackerStatusFilter === 'all') return true;
            return subject.status === trackerStatusFilter;
        });

        return {
            subjectsWithStatus: finalFiltered,
            completeCount: finalFiltered.filter(s => s.status === 'complete').length,
            inProgressCount: finalFiltered.filter(s => s.status === 'in-progress').length,
            notStartedCount: finalFiltered.filter(s => s.status === 'not-started').length,
            filteredByFiltersCount: filteredByFilters.length
        };
    }, [subjects, allStudents, trackerClassFilter, trackerTeacherFilter, trackerSubjectSearch, trackerStatusFilter]);

    return (
        <div className="px-4 md:px-0 mt-8 space-y-6">
            {/* Filters */}
            <div className="bg-white rounded-2xl p-6 shadow-lg border-2 border-slate-200">
                <h3 className="text-lg font-bold text-slate-900 mb-4">
                    <i className="fa-solid fa-filter mr-2 text-emerald-600"></i>
                    Filter Subjects
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">
                            <i className="fa-solid fa-layer-group mr-1 text-slate-500"></i>
                            Filter by Class
                        </label>
                        <select
                            value={trackerClassFilter}
                            onChange={(e) => setTrackerClassFilter(e.target.value)}
                            className="w-full p-3 border-2 border-slate-300 rounded-xl focus:ring-4 focus:ring-emerald-500/40 focus:border-emerald-500 bg-white"
                        >
                            <option value="all">All Classes</option>
                            {allowedClasses.map(cls => (
                                <option key={cls} value={cls}>{cls}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">
                            <i className="fa-solid fa-user-tie mr-1 text-slate-500"></i>
                            Filter by Faculty
                        </label>
                        <select
                            value={trackerTeacherFilter}
                            onChange={(e) => setTrackerTeacherFilter(e.target.value)}
                            className="w-full p-3 border-2 border-slate-300 rounded-xl focus:ring-4 focus:ring-emerald-500/40 focus:border-emerald-500 bg-white"
                        >
                            <option value="all">All Faculty Members</option>
                            {facultyOptions.map(teacher => (
                                <option key={teacher} value={teacher}>{teacher}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">
                            <i className="fa-solid fa-magnifying-glass mr-1 text-slate-500"></i>
                            Search Subject
                        </label>
                        <input
                            type="text"
                            value={trackerSubjectSearch}
                            onChange={(e) => setTrackerSubjectSearch(e.target.value)}
                            placeholder="Type subject name..."
                            className="w-full p-3 border-2 border-slate-300 rounded-xl focus:ring-4 focus:ring-emerald-500/40 focus:border-emerald-500"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">
                            <i className="fa-solid fa-check-double mr-1 text-slate-500"></i>
                            Status Filter
                        </label>
                        <select
                            value={trackerStatusFilter}
                            onChange={(e) => setTrackerStatusFilter(e.target.value as any)}
                            className="w-full p-3 border-2 border-slate-300 rounded-xl focus:ring-4 focus:ring-emerald-500/40 focus:border-emerald-500 bg-white"
                        >
                            <option value="all">All Status</option>
                            <option value="complete">Complete (100%)</option>
                            <option value="in-progress">In Progress</option>
                            <option value="not-started">Not Started (0%)</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white rounded-xl p-6 shadow border-2 border-slate-200">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-bold text-slate-600">Total Subjects</p>
                            <p className="text-3xl font-black text-slate-900 mt-1">{filteredByFiltersCount}</p>
                        </div>
                        <i className="fa-solid fa-book text-3xl text-slate-400"></i>
                    </div>
                </div>

                <div className="bg-emerald-50 rounded-xl p-6 shadow border-2 border-emerald-200">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-bold text-emerald-700">Complete</p>
                            <p className="text-3xl font-black text-emerald-900 mt-1">{completeCount}</p>
                        </div>
                        <i className="fa-solid fa-circle-check text-3xl text-emerald-400"></i>
                    </div>
                </div>

                <div className="bg-amber-50 rounded-xl p-6 shadow border-2 border-amber-200">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-bold text-amber-700">In Progress</p>
                            <p className="text-3xl font-black text-amber-900 mt-1">{inProgressCount}</p>
                        </div>
                        <i className="fa-solid fa-clock text-3xl text-amber-400"></i>
                    </div>
                </div>

                <div className="bg-red-50 rounded-xl p-6 shadow border-2 border-red-200">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-bold text-red-700">Not Started</p>
                            <p className="text-3xl font-black text-red-900 mt-1">{notStartedCount}</p>
                        </div>
                        <i className="fa-solid fa-circle-xmark text-3xl text-red-400"></i>
                    </div>
                </div>
            </div>

            {/* Subject Cards */}
            <div className="space-y-4">
                <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter">Subjects Upload Status</h3>
                {subjectsWithStatus.length === 0 ? (
                    <div className="bg-white rounded-xl p-12 shadow border border-slate-200 text-center">
                        <i className="fa-solid fa-filter text-4xl text-slate-400 mb-4"></i>
                        <h4 className="text-lg font-bold text-slate-900 mb-2">No Subjects Found</h4>
                        <p className="text-slate-600">Try adjusting your filters</p>
                    </div>
                ) : (
                    subjectsWithStatus.map(subject => (
                        <div key={`${subject.id}-${subject.displayClass || 'grouped'}`} className="bg-white rounded-xl p-6 shadow-lg border-2 border-slate-200 hover:shadow-xl transition-all">
                            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                                <div className="flex-1">
                                    <div className="flex items-start gap-3">
                                        <i className={`fa-solid fa-book text-2xl mt-1 ${subject.status === 'complete' ? 'text-emerald-600' :
                                            subject.status === 'in-progress' ? 'text-amber-600' :
                                                'text-red-600'
                                            }`}></i>
                                        <div className="flex-1">
                                            <h4 className="text-lg font-bold text-slate-900">
                                                {subject.name}
                                                {subject.arabicName && <span className="text-slate-600 ml-2">({subject.arabicName})</span>}
                                            </h4>
                                            <div className="flex flex-wrap gap-3 mt-2 text-sm">
                                                <span className="text-slate-600">
                                                    <i className="fa-solid fa-user-tie mr-1"></i>
                                                    {subject.facultyName || 'Not Assigned'}
                                                </span>
                                                <span className="text-slate-600">
                                                    <i className="fa-solid fa-layer-group mr-1"></i>
                                                    {subject.displayClass || subject.targetClasses.join(', ')}
                                                </span>
                                                <span className={`px-2 py-1 rounded font-bold text-xs ${subject.subjectType === 'general'
                                                    ? 'bg-blue-100 text-blue-700'
                                                    : 'bg-purple-100 text-purple-700'
                                                    }`}>
                                                    {subject.subjectType.toUpperCase()}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="md:w-80">
                                    <div className="space-y-3">
                                        {/* INT Progress */}
                                        <div>
                                            <div className="flex items-center justify-between mb-1">
                                                <span className="text-[10px] font-black text-slate-500 uppercase">INT Assessment</span>
                                                <span className={`text-[10px] font-black ${subject.intPercentage === 100 ? 'text-emerald-600' : 'text-slate-600'}`}>
                                                    {subject.uploadedINT}/{subject.totalStudents} ({subject.intPercentage}%)
                                                </span>
                                            </div>
                                            <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                                                <div
                                                    className={`h-full rounded-full transition-all duration-500 ${subject.intPercentage === 100 ? 'bg-emerald-500' : 'bg-blue-500'}`}
                                                    style={{ width: `${subject.intPercentage}%` }}
                                                ></div>
                                            </div>
                                        </div>

                                        {/* EXT Progress */}
                                        {(subject.maxEXT || 0) > 0 && subject.maxINT !== 100 ? (
                                            <div>
                                                <div className="flex items-center justify-between mb-1">
                                                    <span className="text-[10px] font-black text-slate-500 uppercase">EXT Examination</span>
                                                    <span className={`text-[10px] font-black ${subject.extPercentage === 100 ? 'text-emerald-600' : 'text-slate-600'}`}>
                                                        {subject.uploadedEXT}/{subject.totalStudents} ({subject.extPercentage}%)
                                                    </span>
                                                </div>
                                                <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                                                    <div
                                                        className={`h-full rounded-full transition-all duration-500 ${subject.extPercentage === 100 ? 'bg-emerald-500' : 'bg-purple-500'}`}
                                                        style={{ width: `${subject.extPercentage}%` }}
                                                    ></div>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 italic">
                                                <i className="fa-solid fa-info-circle"></i>
                                                EXT Not Applicable
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

export default React.memo(UploadTrackerTab);
