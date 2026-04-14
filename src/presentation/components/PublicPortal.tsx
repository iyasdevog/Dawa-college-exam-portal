import React, { useState, useEffect, useMemo, useCallback, Suspense } from 'react';
import { StudentRecord, SubjectConfig, ClassReleaseSettings, ExamTimetableEntry } from '../../domain/entities/types';
import { CLASSES } from '../../domain/entities/constants';
import { dataService } from '../../infrastructure/services/dataService';
import { useMobile } from '../hooks/useMobile';
import StudentAttendancePortal from './StudentAttendancePortal';
import HallTicketView from './HallTicketView';
import { mobileStorage, preventIOSZoom } from '../../infrastructure/services/mobileUtils';
import ClassResults from './ClassResults';
import ApplicationPortal from './ApplicationPortal';
import { TermSelector } from './TermSelector';
import CurriculumOverview from './CurriculumOverview';
import { useTerm } from '../viewmodels/TermContext';

const PublicScorecard = React.lazy(() => import('./PublicScorecard'));

interface PublicPortalProps {
    onLoginClick: () => void;
}

const PublicPortal: React.FC<PublicPortalProps> = ({ onLoginClick }) => {
    const { activeTerm } = useTerm();
    const [searchAdNo, setSearchAdNo] = useState('');
    const [searchClass, setSearchClass] = useState(CLASSES[0]);
    const [result, setResult] = useState<StudentRecord | null>(null);
    const [hasSearched, setHasSearched] = useState(false);
    const [subjects, setSubjects] = useState<SubjectConfig[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSearching, setIsSearching] = useState(false);
    const [releaseSettings, setReleaseSettings] = useState<ClassReleaseSettings>({});
    const [viewMode, setViewMode] = useState<'scorecard' | 'class-rank'>('scorecard');
    const [showAppPortal, setShowAppPortal] = useState(false); // Added state

    // Tabs state
    const [subView, setSubView] = useState<'results' | 'attendance' | 'live' | 'hall-ticket' | 'curriculum'>('curriculum');

    // Hall Ticket States
    const [htAdNo, setHtAdNo] = useState('');
    const [htClass, setHtClass] = useState(CLASSES[0]);
    const [htSemester, setHtSemester] = useState<'Odd' | 'Even'>('Odd');
    const [htStudent, setHtStudent] = useState<StudentRecord | null>(null);
    const [htTimetable, setHtTimetable] = useState<ExamTimetableEntry[]>([]);
    const [htStatus, setHtStatus] = useState<{ released: boolean; attendance: number; required: number; eligible: boolean; searched: boolean }>({ 
        released: false, 
        attendance: 0, 
        required: 75,
        eligible: true,
        searched: false 
    });
    const [isHtLoading, setIsHtLoading] = useState(false);
    const [htError, setHtError] = useState('');

    // Derived state for release status
    const isResultsReleased = useMemo(() => {
        const settings = releaseSettings[searchClass];
        if (!settings) return false;
        if (settings.isReleased) return true;
        if (settings.releaseDate) {
            return new Date(settings.releaseDate) <= new Date();
        }
        return false;
    }, [searchClass, releaseSettings]);

    const isSuppReleased = useMemo(() => {
        const settings = releaseSettings[searchClass];
        if (!settings) return false;
        if (settings.isSupplementaryReleased) return true;
        if (settings.supplementaryReleaseDate) {
            return new Date(settings.supplementaryReleaseDate) <= new Date();
        }
        return false;
    }, [searchClass, releaseSettings]);

    const canViewScorecard = isResultsReleased || isSuppReleased;
    const isOnlySupp = !isResultsReleased && isSuppReleased;

    // Effect to force Doura view if results differ
    // Effect to handle view mode on result release
    useEffect(() => {
        if (canViewScorecard && !hasSearched) {
            setViewMode('scorecard');
        }
    }, [canViewScorecard, hasSearched]);

    // Mobile detection
    const { isMobile, isIOS } = useMobile();

    // Initialize database and load subjects whenever term changes
    useEffect(() => {
        const initializeData = async () => {
            try {
                if (!hasSearched) setIsLoading(true); // Only show full loader on initial entry
                await dataService.initializeDatabase();
                const [allSubjects, settings] = await Promise.all([
                    dataService.getAllSubjects(activeTerm),
                    dataService.getReleaseSettings()
                ]);
                setSubjects(allSubjects);
                setReleaseSettings(settings);
            } catch (error) {
                console.error('Error initializing data:', error);
            } finally {
                setIsLoading(false);
            }
        };
        initializeData();
    }, [activeTerm]);

    const handleSearch = useCallback(async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (!searchAdNo.trim()) return;

        try {
            setIsSearching(true);
            setHasSearched(false);

            const student = await dataService.getStudentByAdNo(searchAdNo.trim(), activeTerm);

            if (student && student.className === searchClass) {
                try {
                    const suppExams = await dataService.getSupplementaryExamsByStudent(student.id);
                    student.supplementaryExams = suppExams;
                } catch (e) {
                    console.error('Error fetching supplementary exams:', e);
                }
                
                setResult(student);
                setHasSearched(true);
            } else {
                setResult(null);
                setHasSearched(true);
                alert('No student found in the selected class with this Admission Number.');
            }
        } catch (error) {
            console.error('Search error:', error);
            alert('An error occurred while searching. Please try again.');
        } finally {
            setIsSearching(false);
        }
    }, [searchAdNo, searchClass, activeTerm]);
 
    // Re-search automatically when term changes if a student is already being viewed
    useEffect(() => {
        if (hasSearched && searchAdNo) {
            handleSearch();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeTerm]);

    const handleHtSearch = useCallback(async (e: React.FormEvent) => {
        e.preventDefault();
        if (!htAdNo.trim()) return;

        try {
            setIsHtLoading(true);
            setHtError('');
            
            const student = await dataService.getStudentByAdNo(htAdNo.trim(), activeTerm);
            
            if (student && student.className === htClass) {
                const year = activeTerm.split('-').slice(0, 2).join('-');
                const [released, eligibility, timetable] = await Promise.all([
                    dataService.getHallTicketReleaseStatus(htClass, htSemester, year),
                    dataService.isEligibleForHallTicket(student.id, htClass, activeTerm),
                    dataService.getExamTimetable(htClass, htSemester, year)
                ]);
                
                setHtStudent(student);
                setHtTimetable(timetable);
                setHtStatus({ 
                    released, 
                    attendance: eligibility.percentage, 
                    required: eligibility.required,
                    eligible: eligibility.eligible,
                    searched: true 
                });
            } else {
                setHtStudent(null);
                setHtError('Student not found in the selected class.');
                setHtStatus({ released: false, attendance: 0, required: 75, eligible: false, searched: true });
            }
        } catch (error) {
            console.error('Hall Ticket Search Error:', error);
            setHtError('An error occurred during search.');
        } finally {
            setIsHtLoading(false);
        }
    }, [htAdNo, htClass, htSemester]);

    if (isLoading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-900 flex items-center justify-center">
                <div className="text-center">
                    <div className="loader-ring mb-4"></div>
                    <p className="text-white font-bold">Connecting to Database...</p>
                    <p className="text-emerald-400 text-sm mt-2">AIC Da'wa College Exam Portal</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-900 flex flex-col font-inter">
            {/* Navbar */}
            <nav className={`bg-white/10 backdrop-blur-md border-b border-white/20 flex justify-between items-center sticky top-0 z-50 print:hidden ${isMobile ? 'px-4 py-4' : 'px-8 py-6'}`}>
                <div className="flex items-center gap-4">
                    <div className={`bg-emerald-500 text-white rounded-2xl shadow-lg flex items-center justify-center ${isMobile ? 'p-2 w-10 h-10' : 'p-3'}`}>
                        <i className={`fa-solid fa-graduation-cap ${isMobile ? 'text-lg' : 'text-xl'}`}></i>
                    </div>
                    <div>
                        <h1 className={`font-black text-white tracking-tighter leading-none ${isMobile ? 'text-lg' : 'text-xl'}`}>
                            {isMobile ? 'AIC DA\'WA' : 'AIC DA\'WA COLLEGE'}
                        </h1>
                        <p className={`text-emerald-400 font-black uppercase tracking-[0.3em] mt-1 ${isMobile ? 'text-[8px]' : 'text-[9px]'}`}>
                            Exam Portal
                        </p>
                    </div>
                </div>
                <div className="flex-1"></div>
                <button
                    type="button"
                    onClick={onLoginClick}
                    className={`font-black text-white/80 hover:text-white transition-all uppercase tracking-widest flex items-center gap-2 border border-white/20 rounded-xl hover:bg-white/10 touch-target-min ${isMobile ? 'text-[9px] px-3 py-2' : 'text-[10px] px-4 py-2'}`}
                    style={{ WebkitTapHighlightColor: 'transparent', userSelect: 'none' }}
                >
                    <i className={`fa-solid fa-shield-halved ${isMobile ? 'text-xs' : 'text-xs'}`}></i>
                    {isMobile ? 'Faculty' : 'Faculty Access'}
                </button>
            </nav>


            <main className={`flex-1 container mx-auto print:py-0 print:px-0 print:max-w-none ${isMobile ? 'px-4 py-8' : 'px-6 py-12'}`}>
                {/* Apps Navigation Tabs */}
                <div className="flex justify-center bg-white/5 p-1 rounded-3xl mb-8 overflow-x-auto hide-scrollbar touch-pan-x print:hidden w-fit mx-auto">
                    {[
                        { id: 'results', label: 'Scorecards', icon: 'fa-file-invoice' },
                        { id: 'hall-ticket', label: 'Hall Ticket', icon: 'fa-id-card-clip' },
                        { id: 'attendance', label: 'Attendance', icon: 'fa-user-clock' },
                        { id: 'curriculum', label: 'Curriculum Map', icon: 'fa-sitemap' }
                    ].map(tab => (
                        <button
                            key={tab.id}
                            type="button"
                            onClick={() => {
                                setSubView(tab.id as any);
                                if (tab.id !== 'results') {
                                    setHasSearched(false);
                                    setResult(null);
                                }
                            }}
                            className={`flex items-center gap-3 px-6 py-4 rounded-2xl font-black uppercase tracking-widest transition-all whitespace-nowrap ${subView === tab.id
                                ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-500/20'
                                : 'text-slate-400 hover:text-white hover:bg-white/5'
                                }`}
                        >
                            <i className={`fa-solid ${tab.icon}`}></i>
                            {isMobile && subView !== tab.id ? '' : tab.label}
                        </button>
                    ))}
                </div>

                {subView === 'attendance' && <StudentAttendancePortal />}
                {subView === 'curriculum' && <CurriculumOverview />}
                {subView === 'hall-ticket' && (
                    <div className="w-full max-w-5xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-700">
                        {/* Hall Ticket Search Form */}
                        <div className="bg-white/10 backdrop-blur-lg rounded-3xl border border-white/20 p-6 md:p-8 mobile-layout-element print:hidden">
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                                <h3 className="font-black text-white flex items-center gap-3 text-xl md:text-2xl">
                                    <i className="fa-solid fa-id-card-clip text-emerald-400"></i>
                                    Download Hall Ticket
                                </h3>
                            </div>

                            <form onSubmit={handleHtSearch} className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div className="space-y-3">
                                    <label className="block text-xs font-bold text-slate-300 uppercase tracking-widest"><i className="fa-solid fa-hashtag text-emerald-400 mr-2"></i> Ad. No</label>
                                    <input 
                                        type="text" value={htAdNo} onChange={e => setHtAdNo(e.target.value)} 
                                        className="w-full bg-white/10 border-2 border-white/20 rounded-2xl p-4 text-white placeholder-slate-400 focus:ring-4 focus:ring-emerald-500/30 focus:border-emerald-400 outline-none transition-all" 
                                        placeholder="e.g. 138" required 
                                    />
                                </div>
                                <div className="space-y-3">
                                    <label className="block text-xs font-bold text-slate-300 uppercase tracking-widest"><i className="fa-solid fa-graduation-cap text-emerald-400 mr-2"></i> Class</label>
                                    <select 
                                        value={htClass} onChange={e => setHtClass(e.target.value)} 
                                        className="w-full bg-[#1e293b] border-2 border-white/20 rounded-2xl p-4 text-white focus:ring-4 focus:ring-emerald-500/30 focus:border-emerald-400 outline-none transition-all cursor-pointer"
                                    >
                                        {CLASSES.map(c => <option key={c} value={c}>{c}</option>)}
                                    </select>
                                </div>
                                <div className="space-y-3">
                                    <label className="block text-xs font-bold text-slate-300 uppercase tracking-widest"><i className="fa-solid fa-book-open text-emerald-400 mr-2"></i> Semester</label>
                                    <select 
                                        value={htSemester} onChange={e => setHtSemester(e.target.value as 'Odd'|'Even')} 
                                        className="w-full bg-[#1e293b] border-2 border-white/20 rounded-2xl p-4 text-white focus:ring-4 focus:ring-emerald-500/30 focus:border-emerald-400 outline-none transition-all cursor-pointer"
                                    >
                                        <option value="Odd">Odd Semester</option>
                                        <option value="Even">Even Semester</option>
                                    </select>
                                </div>
                                <div className="md:col-span-3 mt-4">
                                    <button 
                                        type="submit" 
                                        disabled={isHtLoading || !htAdNo.trim()}
                                        className="w-full bg-emerald-600 text-white p-4 rounded-2xl font-black uppercase tracking-widest shadow-lg hover:bg-emerald-700 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {isHtLoading ? <i className="fa-solid fa-circle-notch fa-spin"></i> : <><i className="fa-solid fa-search mr-2"></i> Check Hall Ticket</>}
                                    </button>
                                </div>
                            </form>
                        </div>

                        {/* Search Results / Status */}
                        {htStatus.searched && (
                            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                                {htError ? (
                                    <div className="bg-red-500/20 border border-red-500/30 rounded-3xl p-8 text-center print:hidden">
                                        <i className="fa-solid fa-triangle-exclamation text-4xl text-red-400 mb-3"></i>
                                        <h4 className="text-red-300 font-bold text-lg">{htError}</h4>
                                    </div>
                                ) : !htStatus.released ? (
                                    <div className="bg-orange-500/20 border border-orange-500/30 rounded-3xl p-8 text-center print:hidden">
                                        <i className="fa-solid fa-clock text-4xl text-orange-400 mb-3"></i>
                                        <h4 className="text-orange-300 font-bold text-lg">Not Released</h4>
                                        <p className="text-orange-200/70 mt-2">Hall tickets for {htClass} - {htSemester} semester are not yet available.</p>
                                    </div>
                                ) : !htStatus.eligible ? (
                                    <div className="bg-red-500/20 border border-red-500/30 rounded-3xl p-8 text-center print:hidden">
                                        <i className="fa-solid fa-user-xmark text-5xl text-red-400 mb-4 drop-shadow-lg"></i>
                                        <h4 className="text-red-300 font-black text-xl mb-1 uppercase tracking-widest">Ineligible</h4>
                                        <p className="text-red-200/90">Your attendance is <strong className="text-white text-lg mx-1">{htStatus.attendance.toFixed(1)}%</strong>, which is below the minimum required {htStatus.required}%.</p>
                                    </div>
                                ) : htStudent && (
                                    <div className="bg-transparent">
                                        <HallTicketView 
                                            student={htStudent} 
                                            timetable={htTimetable} 
                                            semester={htSemester} 
                                            academicYear={activeTerm.split('-').slice(0, 2).join('-')}
                                        />
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {subView === 'results' && (
                    <>
                {/* Search Header */}
                <div className={`w-full max-w-4xl mx-auto text-center mb-12 print:hidden ${isMobile ? 'px-4' : ''}`}>
                    <h2 className={`font-black text-white tracking-tighter mb-6 ${isMobile ? 'text-3xl' : 'text-5xl'}`}>
                        {isMobile ? 'Academic Portal' : 'Academic Excellence Portal'}
                    </h2>
                    <p className={`text-slate-300 max-w-2xl mx-auto ${isMobile ? 'text-base px-2' : 'text-lg'}`}>
                        {isMobile
                            ? 'Access your academic records and performance with complete transparency'
                            : 'Access your comprehensive academic records and performance analytics with complete transparency'
                        }
                    </p>
                </div>

                {/* Search Form */}
                <div className={`w-full max-w-2xl mx-auto bg-white/10 backdrop-blur-lg rounded-3xl border border-white/20 mb-8 print:hidden mobile-layout-element ${isMobile ? 'p-6' : 'p-8'}`}>
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                        <h3 className={`font-black text-white flex items-center gap-3 ${isMobile ? 'text-xl' : 'text-2xl'}`}>
                            <i className="fa-solid fa-search text-emerald-400"></i>
                            {isMobile ? 'Search Results' : 'Student Result Search'}
                        </h3>
                        <div className="flex items-center gap-2 bg-white/5 p-1.5 rounded-2xl border border-white/10">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-2 hidden sm:inline">Active Term</span>
                            <TermSelector variant="dark" className="border-none !bg-transparent" />
                        </div>
                    </div>

                    <form onSubmit={handleSearch} className="space-y-6">
                        <div className={`${isMobile ? 'flex flex-col space-y-6 mobile-form-adaptive' : 'grid grid-cols-1 md:grid-cols-2 gap-6'}`}>
                            {/* Admission Number */}
                            <div className="w-full">
                                <label className={`block font-bold text-slate-300 mb-3 uppercase tracking-widest ${isMobile ? 'text-xs' : 'text-sm'}`}>
                                    <i className="fa-solid fa-id-card mr-2 text-emerald-400"></i>
                                    Admission Number
                                </label>
                                <div className="relative">
                                    <input
                                        ref={(input) => { if (input && isIOS) preventIOSZoom(input); }}
                                        type="text"
                                        inputMode="numeric"
                                        pattern="[0-9]*"
                                        value={searchAdNo}
                                        onChange={(e) => setSearchAdNo(e.target.value)}
                                        className={`w-full bg-white/10 border-2 border-white/20 rounded-2xl text-white placeholder-slate-400 outline-none focus:ring-4 focus:ring-emerald-500/30 focus:border-emerald-400 transition-all touch-target-large mobile-focus-ring ${isMobile ? 'p-5 text-lg min-h-[64px] pl-12' : 'p-4 text-base pl-10'}`}
                                        placeholder={isMobile ? "Enter number" : "Enter admission number (e.g., 138)"}
                                        required
                                        disabled={isSearching}
                                        style={{ fontSize: isMobile && isIOS ? '16px' : undefined, WebkitAppearance: 'none', WebkitTapHighlightColor: 'transparent' }}
                                    />
                                    <div className={`absolute left-0 top-0 h-full flex items-center justify-center pointer-events-none ${isMobile ? 'w-12' : 'w-10'}`}>
                                        <i className="fa-solid fa-hashtag text-emerald-400 text-sm"></i>
                                    </div>
                                </div>
                                {isMobile && (
                                    <div className="mt-3 flex items-center justify-between">
                                        <p className="text-xs text-slate-400 flex items-center gap-1">
                                            <i className="fa-solid fa-mobile-alt text-emerald-400"></i>
                                            Numeric keypad enabled
                                        </p>
                                        <p className="text-xs text-emerald-300 font-medium">Required</p>
                                    </div>
                                )}
                            </div>
                            {/* Class */}
                            <div className="w-full">
                                <label className={`block font-bold text-slate-300 mb-3 uppercase tracking-widest ${isMobile ? 'text-xs' : 'text-sm'}`}>
                                    <i className="fa-solid fa-graduation-cap mr-2 text-emerald-400"></i>
                                    Academic Class
                                </label>
                                <div className="relative">
                                    <select
                                        value={searchClass}
                                        onChange={(e) => setSearchClass(e.target.value)}
                                        className={`w-full bg-white/10 border-2 border-white/20 rounded-2xl text-white outline-none focus:ring-4 focus:ring-emerald-500/30 focus:border-emerald-400 transition-all appearance-none cursor-pointer touch-target-large mobile-focus-ring ${isMobile ? 'p-5 text-lg min-h-[64px] pl-12 pr-12' : 'p-4 text-base pl-10 pr-10'}`}
                                        disabled={isSearching}
                                        style={{ WebkitAppearance: 'none', WebkitTapHighlightColor: 'transparent' }}
                                    >
                                        {CLASSES.map(c => (
                                            <option key={c} value={c} className="bg-slate-800 text-white">{c}</option>
                                        ))}
                                    </select>
                                    <div className={`absolute left-0 top-0 h-full flex items-center justify-center pointer-events-none ${isMobile ? 'w-12' : 'w-10'}`}>
                                        <i className="fa-solid fa-layer-group text-emerald-400 text-sm"></i>
                                    </div>
                                    <div className={`absolute right-0 top-0 h-full flex items-center justify-center pointer-events-none ${isMobile ? 'w-12' : 'w-10'}`}>
                                        <i className="fa-solid fa-chevron-down text-slate-400"></i>
                                    </div>
                                </div>
                                {isMobile && (
                                    <div className="mt-3 flex items-center justify-between">
                                        <p className="text-xs text-slate-400 flex items-center gap-1">
                                            <i className="fa-solid fa-touch text-emerald-400"></i>
                                            Touch to select
                                        </p>
                                        <p className="text-xs text-slate-300">
                                            Current: <span className="text-emerald-300 font-medium">{searchClass}</span>
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={isSearching || !searchAdNo.trim()}
                            className={`w-full bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 disabled:from-slate-600 disabled:to-slate-700 disabled:cursor-not-allowed text-white rounded-2xl font-black uppercase tracking-widest transition-all shadow-xl flex items-center justify-center gap-3 touch-target-large active:scale-98 mobile-layout-transition ${isMobile ? 'py-6 text-lg min-h-[64px]' : 'py-4 text-sm min-h-[48px]'}`}
                            style={{ WebkitTapHighlightColor: 'transparent', userSelect: 'none' }}
                        >
                            {isSearching ? (
                                <>
                                    <div className={`border-3 border-white/30 border-t-white rounded-full animate-spin ${isMobile ? 'w-7 h-7' : 'w-5 h-5'}`}></div>
                                    <span className="animate-pulse">{isMobile ? 'Searching Database...' : 'Searching...'}</span>
                                </>
                            ) : (
                                <>
                                    <i className={`fa-solid fa-search ${isMobile ? 'text-xl' : 'text-base'}`}></i>
                                    <span>{isMobile ? 'Find My Results' : 'Verify & Search Records'}</span>
                                </>
                            )}
                        </button>

                        {isMobile && !hasSearched && (
                            <div className="bg-gradient-to-r from-white/5 to-emerald-500/5 border border-emerald-400/20 rounded-2xl p-5 mobile-layout-element">
                                <h4 className="text-emerald-400 font-bold text-sm mb-3 flex items-center gap-2">
                                    <div className="w-6 h-6 bg-emerald-500/20 rounded-full flex items-center justify-center"><i className="fa-solid fa-lightbulb text-xs"></i></div>
                                    Quick Search Guide
                                </h4>
                                <div className="grid grid-cols-1 gap-3">
                                    <div className="flex items-start gap-3 p-3 bg-white/5 rounded-xl">
                                        <div className="w-5 h-5 bg-emerald-500/20 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"><i className="fa-solid fa-1 text-emerald-400 text-xs"></i></div>
                                        <div><p className="text-slate-200 text-sm font-medium">Enter Admission Number</p></div>
                                    </div>
                                    <div className="flex items-start gap-3 p-3 bg-white/5 rounded-xl">
                                        <div className="w-5 h-5 bg-emerald-500/20 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"><i className="fa-solid fa-2 text-emerald-400 text-xs"></i></div>
                                        <div><p className="text-slate-200 text-sm font-medium">Select Your Class</p></div>
                                    </div>
                                    <div className="flex items-start gap-3 p-3 bg-white/5 rounded-xl">
                                        <div className="w-5 h-5 bg-emerald-500/20 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"><i className="fa-solid fa-3 text-emerald-400 text-xs"></i></div>
                                        <div><p className="text-slate-200 text-sm font-medium">Tap Search Button</p></div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {hasSearched && (
                            <div className={`mt-6 rounded-2xl border-2 mobile-layout-element animate-mobile-fade-in ${isMobile ? 'p-5' : 'p-4'} ${result ? 'bg-gradient-to-r from-emerald-50/10 to-emerald-100/5 border-emerald-400/40 shadow-lg shadow-emerald-500/10' : 'bg-gradient-to-r from-red-50/10 to-red-100/5 border-red-400/40 shadow-lg shadow-red-500/10'}`}>
                                {result ? (
                                    <div className="text-emerald-400">
                                        <div className="flex items-center gap-4 mb-3">
                                            <div className={`flex-shrink-0 ${isMobile ? 'w-12 h-12' : 'w-8 h-8'} bg-gradient-to-br from-emerald-500/30 to-emerald-600/20 rounded-full flex items-center justify-center shadow-lg`}>
                                                <i className={`fa-solid fa-check-circle ${isMobile ? 'text-lg' : 'text-sm'}`}></i>
                                            </div>
                                            <div className="flex-1">
                                                <p className={`font-black ${isMobile ? 'text-lg' : 'text-base'} text-emerald-300`}>✓ Student Record Found</p>
                                                <p className={`text-emerald-200 ${isMobile ? 'text-base' : 'text-sm'} font-medium`}><strong className="text-white">{result.name}</strong> • Class <span className="text-emerald-300 font-bold">{result.className}</span></p>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="text-red-400">
                                        <div className="flex items-center gap-4 mb-3">
                                            <div className={`flex-shrink-0 ${isMobile ? 'w-12 h-12' : 'w-8 h-8'} bg-gradient-to-br from-red-500/30 to-red-600/20 rounded-full flex items-center justify-center shadow-lg`}>
                                                <i className={`fa-solid fa-exclamation-triangle ${isMobile ? 'text-lg' : 'text-sm'}`}></i>
                                            </div>
                                            <div className="flex-1">
                                                <p className={`font-black ${isMobile ? 'text-lg' : 'text-base'} text-red-300`}>⚠ No Student Record Found</p>
                                                <p className={`text-red-200 ${isMobile ? 'text-base' : 'text-sm'} font-medium`}>Admission number <strong className="text-white">{searchAdNo}</strong> not found in <span className="text-red-300 font-bold">{searchClass}</span></p>
                                            </div>
                                        </div>
                                        {isMobile && (
                                            <button type="button" onClick={() => { setSearchAdNo(''); setHasSearched(false); setResult(null); }} className="w-full bg-red-600/20 hover:bg-red-600/30 border border-red-400/30 text-red-300 rounded-xl py-3 px-4 font-bold text-sm transition-all touch-target-min" style={{ WebkitTapHighlightColor: 'transparent' }}>
                                                <i className="fa-solid fa-redo mr-2"></i> Try Another Search
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                    </form>
                </div>

                {hasSearched && result && (
                    <div className="w-full max-w-5xl mx-auto animate-in fade-in slide-in-from-bottom-8 duration-700 print:mt-0 print:max-w-full">
                        <div className="flex gap-2 mb-8 bg-white/10 p-1 rounded-2xl border border-white/20 print:hidden">
                            {canViewScorecard && (
                                <button
                                    onClick={() => setViewMode('scorecard')}
                                    className={`flex-1 py-4 px-6 rounded-xl font-black uppercase tracking-widest text-sm transition-all flex items-center justify-center gap-2 ${viewMode === 'scorecard' ? 'bg-emerald-600 text-white shadow-lg' : 'text-slate-300 hover:text-white hover:bg-white/5'}`}
                                >
                                    <i className="fa-solid fa-file-invoice"></i> {isMobile ? (isOnlySupp ? 'Supp. Result' : 'Scorecard') : (isOnlySupp ? 'Supplementary Result' : 'My Scorecard')}
                                </button>
                            )}
                            {isResultsReleased && (
                                <button
                                    onClick={() => setViewMode('class-rank')}
                                    className={`flex-1 py-4 px-6 rounded-xl font-black uppercase tracking-widest text-sm transition-all flex items-center justify-center gap-2 ${viewMode === 'class-rank' ? 'bg-emerald-600 text-white shadow-lg' : 'text-slate-300 hover:text-white hover:bg-white/5'}`}
                                >
                                    <i className="fa-solid fa-ranking-star"></i> {isMobile ? 'Rankings' : 'Class Rankings'}
                                </button>
                            )}
                        </div>

                        {viewMode === 'scorecard' && !canViewScorecard ? (
                            <div className="bg-white rounded-[3rem] p-12 text-center shadow-xl border border-slate-200 animate-in fade-in zoom-in duration-500">
                                <div className="w-24 h-24 bg-amber-50 rounded-full flex items-center justify-center mx-auto mb-6">
                                    <i className="fa-solid fa-clock-rotate-left text-4xl text-amber-500"></i>
                                </div>
                                <h3 className="text-2xl font-black text-slate-800 mb-2">Results Not Released</h3>
                                <p className="text-slate-500 max-w-md mx-auto mb-8">
                                    The official results for <span className="font-bold text-slate-700">{result.className}</span> have not been published yet.
                                    Please check back later or contact the examination office.
                                </p>
                                <div className="bg-slate-50 rounded-2xl p-6 max-w-sm mx-auto border border-slate-100">
                                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Student Verified</p>
                                    <p className="text-lg font-black text-slate-900">{result.name}</p>
                                    <p className="text-emerald-600 font-bold text-sm">Ad No: {result.adNo}</p>
                                </div>
                            </div>
                        ) : viewMode === 'scorecard' ? (
                            <Suspense fallback={<div className="p-12 text-center"><div className="loader-ring"></div></div>}>
                                <PublicScorecard result={result} subjects={subjects} isResultsReleased={isResultsReleased} isSuppReleased={isSuppReleased} />
                            </Suspense>
                        ) : (
                            <div className="bg-white rounded-[3rem] p-8 md:p-12 shadow-2xl border border-slate-200">
                                <ClassResults forcedClass={result.className} hideSelector={true} />
                            </div>
                        )}
                    </div>
                )}
                </>
                )}
            </main>

            {/* Application System Floating Button */}
            <button 
                onClick={() => setShowAppPortal(true)}
                className="fixed bottom-8 right-8 z-[2000] bg-emerald-600 text-white px-6 py-4 rounded-2xl font-black shadow-2xl shadow-emerald-600/40 hover:bg-emerald-700 hover:scale-105 active:scale-95 transition-all flex items-center gap-3 group"
            >
                <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center group-hover:bg-white/30 transition-all">
                    <i className="fa-solid fa-file-signature text-xl"></i>
                </div>
                <div className="text-left">
                    <p className="text-[10px] font-black uppercase tracking-widest opacity-70 leading-none mb-1">Apply for</p>
                    <p className="text-sm leading-none">Revaluation & Supp</p>
                </div>
            </button>

            {/* Application Portal Modal */}
            {showAppPortal && (
                <ApplicationPortal onClose={() => setShowAppPortal(false)} />
            )}
        </div >
    );
};

export default React.memo(PublicPortal);