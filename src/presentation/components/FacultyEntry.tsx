import React, { useState, useEffect, useRef, useMemo } from 'react';
import { StudentRecord, SubjectConfig, ClassReleaseSettings } from '../../domain/entities/types';
import { User } from '../../domain/entities/User';
import { SYSTEM_CLASSES as CLASSES } from '../../domain/entities/constants';
import { dataService } from '../../infrastructure/services/dataService';
import { ProgressiveLoadingSkeleton } from './SkeletonLoaders';
import { useMobile, useTouchInteraction } from '../hooks/useMobile';
import { useOfflineCapability } from '../hooks/useOfflineCapability';
import { useTerm } from '../viewmodels/TermContext';
import UploadTrackerTab from './faculty/UploadTrackerTab';
import ReleaseSettingsTab from './faculty/ReleaseSettingsTab';
import MarksEntryTab from './faculty/MarksEntryTab';
import { useFacultyEntry } from '../hooks/useFacultyEntry';

interface FacultyEntryProps {
    currentUser: User | null;
}

const FacultyEntry: React.FC<FacultyEntryProps> = ({ currentUser }) => {
    const [availableClasses, setAvailableClasses] = useState<string[]>(CLASSES);

    const allowedClasses = useMemo(() => {
        if (!currentUser || currentUser.role === 'admin') return availableClasses;
        return availableClasses.filter(cls => currentUser.assignedClasses?.includes(cls));
    }, [currentUser, availableClasses]);

    const { activeTerm } = useTerm();

    const [activeTab, setActiveTab] = useState<'marks-entry' | 'upload-tracker' | 'release-settings'>('marks-entry');
    const [releaseSettings, setReleaseSettings] = useState<ClassReleaseSettings>({});
    const [selectedClass, setSelectedClass] = useState('');
    const [subjectType, setSubjectType] = useState<'general' | 'elective'>('general');
    const [selectedSubject, setSelectedSubject] = useState('');
    const [students, setStudents] = useState<StudentRecord[]>([]);
    const [allStudents, setAllStudents] = useState<StudentRecord[]>([]);
    const [subjects, setSubjects] = useState<SubjectConfig[]>([]);
    const [classSubjects, setClassSubjects] = useState<SubjectConfig[]>([]);
    const { getTouchProps } = useTouchInteraction();
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [attendanceStats, setAttendanceStats] = useState<Record<string, { present: number; total: number; percentage: number }>>({});

    const [loadingStage, setLoadingStage] = useState<'initializing' | 'loading-subjects' | 'loading-students' | 'preparing-interface'>('initializing');
    const [loadingProgress, setLoadingProgress] = useState(0);

    const studentRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});
    const loadedSubjectIdRef = useRef<string>('');

    const { isOnline } = useOfflineCapability();

    // Load initial data
    useEffect(() => {
        const loadInit = async () => {
            try {
                setIsLoading(true);
                setLoadingStage('initializing');
                setLoadingProgress(25);
                const [allSubjects, allStudentsData, termClasses] = await Promise.all([
                    dataService.getAllSubjects(activeTerm),
                    dataService.getAllStudents(activeTerm),
                    dataService.getClassesByTerm(activeTerm)
                ]);
                setSubjects(allSubjects);
                setAllStudents(allStudentsData);
                setAvailableClasses(termClasses);
                setLoadingProgress(100);
            } catch (error) {
                console.error('Error loading initial data:', error);
            } finally {
                setTimeout(() => setIsLoading(false), 300);
            }
        };
        loadInit();
    }, [activeTerm]);

    // Handle tab switching data refreshes
    useEffect(() => {
        if (activeTab === 'upload-tracker') {
            const loadTrackerData = async () => {
                try {
                    const data = await dataService.getAllStudents(activeTerm);
                    setAllStudents(data);
                } catch (e) { console.error(e); }
            };
            loadTrackerData();
        } else if (activeTab === 'release-settings') {
            const loadSettings = async () => {
                try {
                    const settings = await dataService.getReleaseSettings();
                    setReleaseSettings(settings || {});
                } catch (e) { console.error(e); }
            };
            loadSettings();
        }
    }, [activeTab, activeTerm]);

    useEffect(() => {
        if (allowedClasses.length > 0 && (!selectedClass || !allowedClasses.includes(selectedClass))) {
            setSelectedClass(allowedClasses[0]);
        }
    }, [allowedClasses, selectedClass]);

    // Update class subjects when class or type changes
    useEffect(() => {
        const filtered = subjects.filter(s => {
            if (subjectType === 'elective') return s.subjectType === 'elective';
            return s.targetClasses.includes(selectedClass) && s.subjectType === 'general';
        });
        setClassSubjects(filtered);
        if (filtered.length > 0) {
            if (!selectedSubject || !filtered.find(s => s.id === selectedSubject)) {
                setSelectedSubject(filtered[0].id);
            }
        } else {
            setSelectedSubject('');
        }
    }, [selectedClass, subjects, subjectType, selectedSubject]);

    const loadStudentsByClass = async () => {
        if (!selectedSubject) return;
        try {
            setIsSaving(true);
            const studentsToShow = await dataService.getEnrolledStudentsForSubject(selectedSubject, activeTerm);
            const filteredByClass = subjectType === 'general' 
                ? studentsToShow.filter(s => s.className === selectedClass)
                : studentsToShow;
            
            setStudents(filteredByClass);
            loadedSubjectIdRef.current = selectedSubject;

            const atts: Record<string, any> = {};
            for (const s of filteredByClass) {
                const percentage = await dataService.calculateAttendancePercentage(s.id, selectedSubject, activeTerm);
                atts[s.id] = { percentage };
            }
            setAttendanceStats(atts);
        } catch (error) {
            console.error('Error loading students:', error);
        } finally {
            setIsSaving(false);
        }
    };

    // Load students when context changes
    useEffect(() => {
        loadStudentsByClass();
    }, [selectedClass, selectedSubject, activeTerm, subjectType]);

    const handleUpdateReleaseSetting = async (className: string, field: keyof ClassReleaseSettings[string], value: any) => {
        try {
            const currentSetting = releaseSettings[className] || { isReleased: false };
            const updated = {
                ...releaseSettings,
                [className]: { ...currentSetting, [field]: value }
            };
            setReleaseSettings(updated);
            await dataService.updateReleaseSettings(updated);
        } catch (error) {
            console.error('Error updating release setting:', error);
        }
    };

    const facultyHook = useFacultyEntry({
        students,
        subjects,
        selectedSubject,
        selectedClass,
        activeTerm,
        isOnline,
        loadStudentsByClass
    });

    if (isLoading) {
        return <ProgressiveLoadingSkeleton stage={loadingStage} progress={loadingProgress} />;
    }

    return (
        <div className="min-h-screen bg-slate-50 pb-20">
            <header className="bg-white border-b border-slate-200 sticky top-0 z-30 px-6 py-4 shadow-sm">
                <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-emerald-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-emerald-200">
                            <i className="fa-solid fa-graduation-cap text-xl"></i>
                        </div>
                        <div>
                            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Academic Portal</h1>
                            <p className="text-slate-500 font-bold text-xs uppercase tracking-widest">Faculty Management</p>
                        </div>
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto mt-8 px-6">
                <nav className="flex flex-wrap gap-2 mb-8 bg-white p-2 rounded-2xl shadow-sm border border-slate-200">
                    <button
                        onClick={() => setActiveTab('marks-entry')}
                        className={`px-6 py-3 rounded-xl font-bold text-sm transition-all flex items-center ${activeTab === 'marks-entry' ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-100' : 'text-slate-600 hover:bg-slate-50'}`}
                    >
                        <i className="fa-solid fa-pen-to-square mr-2"></i> Marks Entry
                    </button>
                    <button
                        onClick={() => setActiveTab('upload-tracker')}
                        className={`px-6 py-3 rounded-xl font-bold text-sm transition-all flex items-center ${activeTab === 'upload-tracker' ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-100' : 'text-slate-600 hover:bg-slate-50'}`}
                    >
                        <i className="fa-solid fa-chart-line mr-2"></i> Upload Tracker
                    </button>
                    {(currentUser?.role === 'admin' || currentUser?.role === 'super') && (
                        <button
                            onClick={() => setActiveTab('release-settings')}
                            className={`px-6 py-3 rounded-xl font-bold text-sm transition-all flex items-center ${activeTab === 'release-settings' ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-100' : 'text-slate-600 hover:bg-slate-50'}`}
                        >
                            <i className="fa-solid fa-bullhorn mr-2"></i> Release Settings
                        </button>
                    )}
                </nav>

                {activeTab === 'marks-entry' && (
                    <MarksEntryTab
                        {...facultyHook}
                        selectedClass={selectedClass}
                        setSelectedClass={setSelectedClass}
                        subjectType={subjectType}
                        setSubjectType={setSubjectType}
                        selectedSubject={selectedSubject}
                        setSelectedSubject={setSelectedSubject}
                        allowedClasses={allowedClasses}
                        classSubjects={classSubjects}
                        selectedSubjectData={subjects.find(s => s.id === selectedSubject)}
                        students={students}
                        attendanceStats={attendanceStats}
                        isSaving={isSaving}
                        getTouchProps={getTouchProps}
                        studentRefs={studentRefs}
                    />
                )}

                {activeTab === 'upload-tracker' && (
                    <UploadTrackerTab
                        subjects={subjects}
                        allStudents={allStudents}
                        allowedClasses={allowedClasses}
                    />
                )}

                {activeTab === 'release-settings' && (
                    <ReleaseSettingsTab
                        releaseSettings={releaseSettings}
                        onUpdateSetting={handleUpdateReleaseSetting}
                        allowedClasses={allowedClasses}
                    />
                )}
            </main>
        </div>
    );
};

export default React.memo(FacultyEntry);