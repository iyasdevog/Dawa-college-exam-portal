import React, { useState, useEffect } from 'react';
import { StudentRecord, SubjectConfig } from '../types.ts';
import { CLASSES } from '../constants.ts';
import { dataService } from '../services/dataService';
import { useMobile } from '../hooks/useMobile';
import { mobileStorage, preventIOSZoom } from '../utils/mobileUtils';

interface PublicPortalProps {
    onLoginClick: () => void;
}

const PublicPortal: React.FC<PublicPortalProps> = ({ onLoginClick }) => {
    const [searchAdNo, setSearchAdNo] = useState('');
    const [searchClass, setSearchClass] = useState(CLASSES[0]);
    const [result, setResult] = useState<StudentRecord | null>(null);
    const [hasSearched, setHasSearched] = useState(false);
    const [subjects, setSubjects] = useState<SubjectConfig[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSearching, setIsSearching] = useState(false);

    // Mobile detection and responsive state
    const {
        isMobile,
        isTouchDevice,
        screenSize,
        orientation,
        isIOS,
        isAndroid
    } = useMobile();

    // Initialize database and load subjects
    useEffect(() => {
        const initializeData = async () => {
            try {
                setIsLoading(true);

                // Initialize database connection (no seeding)
                await dataService.initializeDatabase();

                // Load subjects
                const allSubjects = await dataService.getAllSubjects();
                setSubjects(allSubjects);

            } catch (error) {
                console.error('Error initializing data:', error);
            } finally {
                setIsLoading(false);
            }
        };

        initializeData();
    }, []);

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!searchAdNo.trim()) return;

        try {
            setIsSearching(true);
            setHasSearched(true);

            const student = await dataService.getStudentByAdNo(searchAdNo.trim());
            setResult(student);

        } catch (error) {
            console.error('Error searching for student:', error);
            setResult(null);
        } finally {
            setIsSearching(false);
        }
    };

    const handlePrint = () => {
        window.print();
    };

    const resultSubjects = result ? subjects.filter(s => s.targetClasses?.includes(result.className)) : [];

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
            {/* Mobile-Optimized Navbar - Hidden on Print */}
            <nav className={`bg-white/10 backdrop-blur-md border-b border-white/20 flex justify-between items-center sticky top-0 z-50 print:hidden ${isMobile
                ? 'px-4 py-4'
                : 'px-8 py-6'
                }`}>
                <div className="flex items-center gap-4">
                    <div className={`bg-emerald-500 text-white rounded-2xl shadow-lg flex items-center justify-center ${isMobile ? 'p-2 w-10 h-10' : 'p-3'
                        }`}>
                        <i className={`fa-solid fa-graduation-cap ${isMobile ? 'text-lg' : 'text-xl'}`}></i>
                    </div>
                    <div>
                        <h1 className={`font-black text-white tracking-tighter leading-none ${isMobile ? 'text-lg' : 'text-xl'
                            }`}>
                            {isMobile ? 'AIC DA\'WA' : 'AIC DA\'WA COLLEGE'}
                        </h1>
                        <p className={`text-emerald-400 font-black uppercase tracking-[0.3em] mt-1 ${isMobile ? 'text-[8px]' : 'text-[9px]'
                            }`}>
                            Exam Portal
                        </p>
                    </div>
                </div>
                <button
                    type="button"
                    onClick={onLoginClick}
                    className={`font-black text-white/80 hover:text-white transition-all uppercase tracking-widest flex items-center gap-2 border border-white/20 rounded-xl hover:bg-white/10 touch-target-min ${isMobile
                        ? 'text-[9px] px-3 py-2'
                        : 'text-[10px] px-4 py-2'
                        }`}
                    style={{
                        WebkitTapHighlightColor: 'transparent',
                        userSelect: 'none'
                    }}
                >
                    <i className={`fa-solid fa-shield-halved ${isMobile ? 'text-xs' : 'text-xs'}`}></i>
                    {isMobile ? 'Faculty' : 'Faculty Access'}
                </button>
            </nav>

            <main className={`flex-1 container mx-auto print:py-0 print:px-0 print:max-w-none ${isMobile ? 'px-4 py-8' : 'px-6 py-12'
                }`}>
                {/* Mobile-Optimized Search Header - Hidden on Print */}
                <div className={`w-full max-w-4xl mx-auto text-center mb-12 print:hidden ${isMobile ? 'px-4' : ''
                    }`}>
                    <h2 className={`font-black text-white tracking-tighter mb-6 ${isMobile ? 'text-3xl' : 'text-5xl'
                        }`}>
                        {isMobile ? 'Academic Portal' : 'Academic Excellence Portal'}
                    </h2>
                    <p className={`text-slate-300 max-w-2xl mx-auto ${isMobile ? 'text-base px-2' : 'text-lg'
                        }`}>
                        {isMobile
                            ? 'Access your academic records and performance with complete transparency'
                            : 'Access your comprehensive academic records and performance analytics with complete transparency'
                        }
                    </p>
                </div>

                {/* Enhanced Mobile-First Search Form - Hidden on Print */}
                <div className={`w-full max-w-2xl mx-auto bg-white/10 backdrop-blur-lg rounded-3xl border border-white/20 mb-8 print:hidden mobile-layout-element ${isMobile ? 'p-6' : 'p-8'
                    }`}>
                    <h3 className={`font-black text-white mb-6 flex items-center gap-3 ${isMobile ? 'text-xl' : 'text-2xl'
                        }`}>
                        <i className="fa-solid fa-search text-emerald-400"></i>
                        {isMobile ? 'Search Results' : 'Student Result Search'}
                    </h3>

                    <form onSubmit={handleSearch} className="space-y-6">
                        {/* Enhanced Mobile-First Stacked Form Layout */}
                        <div className={`${isMobile
                            ? 'flex flex-col space-y-6 mobile-form-adaptive'
                            : 'grid grid-cols-1 md:grid-cols-2 gap-6'
                            }`}>
                            {/* Enhanced Admission Number Input - Mobile Optimized */}
                            <div className="w-full">
                                <label className={`block font-bold text-slate-300 mb-3 uppercase tracking-widest ${isMobile ? 'text-xs' : 'text-sm'
                                    }`}>
                                    <i className="fa-solid fa-id-card mr-2 text-emerald-400"></i>
                                    Admission Number
                                </label>
                                <div className="relative">
                                    <input
                                        ref={(input) => {
                                            if (input && isIOS) {
                                                preventIOSZoom(input);
                                            }
                                        }}
                                        type="text"
                                        inputMode="numeric"
                                        pattern="[0-9]*"
                                        value={searchAdNo}
                                        onChange={(e) => setSearchAdNo(e.target.value)}
                                        className={`w-full bg-white/10 border-2 border-white/20 rounded-2xl text-white placeholder-slate-400 outline-none focus:ring-4 focus:ring-emerald-500/30 focus:border-emerald-400 transition-all touch-target-large mobile-focus-ring ${isMobile
                                            ? 'p-5 text-lg min-h-[64px] pl-12'
                                            : 'p-4 text-base pl-10'
                                            }`}
                                        placeholder={isMobile ? "Enter number" : "Enter admission number (e.g., 138)"}
                                        required
                                        disabled={isSearching}
                                        style={{
                                            fontSize: isMobile && isIOS ? '16px' : undefined, // Prevent iOS zoom
                                            WebkitAppearance: 'none',
                                            WebkitTapHighlightColor: 'transparent'
                                        }}
                                    />
                                    {/* Enhanced Input Icon */}
                                    <div className={`absolute left-0 top-0 h-full flex items-center justify-center pointer-events-none ${isMobile ? 'w-12' : 'w-10'
                                        }`}>
                                        <i className="fa-solid fa-hashtag text-emerald-400 text-sm"></i>
                                    </div>
                                </div>
                                {isMobile && (
                                    <div className="mt-3 flex items-center justify-between">
                                        <p className="text-xs text-slate-400 flex items-center gap-1">
                                            <i className="fa-solid fa-mobile-alt text-emerald-400"></i>
                                            Numeric keypad enabled
                                        </p>
                                        <p className="text-xs text-emerald-300 font-medium">
                                            Required
                                        </p>
                                    </div>
                                )}
                            </div>

                            {/* Enhanced Academic Class Select - Mobile Optimized */}
                            <div className="w-full">
                                <label className={`block font-bold text-slate-300 mb-3 uppercase tracking-widest ${isMobile ? 'text-xs' : 'text-sm'
                                    }`}>
                                    <i className="fa-solid fa-graduation-cap mr-2 text-emerald-400"></i>
                                    Academic Class
                                </label>
                                <div className="relative">
                                    <select
                                        value={searchClass}
                                        onChange={(e) => setSearchClass(e.target.value)}
                                        className={`w-full bg-white/10 border-2 border-white/20 rounded-2xl text-white outline-none focus:ring-4 focus:ring-emerald-500/30 focus:border-emerald-400 transition-all appearance-none cursor-pointer touch-target-large mobile-focus-ring ${isMobile
                                            ? 'p-5 text-lg min-h-[64px] pl-12 pr-12'
                                            : 'p-4 text-base pl-10 pr-10'
                                            }`}
                                        disabled={isSearching}
                                        style={{
                                            WebkitAppearance: 'none',
                                            WebkitTapHighlightColor: 'transparent'
                                        }}
                                    >
                                        {CLASSES.map(c => (
                                            <option key={c} value={c} className="bg-slate-800 text-white">
                                                {c}
                                            </option>
                                        ))}
                                    </select>
                                    {/* Enhanced Select Icons */}
                                    <div className={`absolute left-0 top-0 h-full flex items-center justify-center pointer-events-none ${isMobile ? 'w-12' : 'w-10'
                                        }`}>
                                        <i className="fa-solid fa-layer-group text-emerald-400 text-sm"></i>
                                    </div>
                                    <div className={`absolute right-0 top-0 h-full flex items-center justify-center pointer-events-none ${isMobile ? 'w-12' : 'w-10'
                                        }`}>
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

                        {/* Enhanced Mobile-Optimized Search Button */}
                        <button
                            type="submit"
                            disabled={isSearching || !searchAdNo.trim()}
                            className={`w-full bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 disabled:from-slate-600 disabled:to-slate-700 disabled:cursor-not-allowed text-white rounded-2xl font-black uppercase tracking-widest transition-all shadow-xl flex items-center justify-center gap-3 touch-target-large active:scale-98 mobile-layout-transition ${isMobile
                                ? 'py-6 text-lg min-h-[64px]'
                                : 'py-4 text-sm min-h-[48px]'
                                }`}
                            style={{
                                WebkitTapHighlightColor: 'transparent',
                                userSelect: 'none'
                            }}
                        >
                            {isSearching ? (
                                <>
                                    <div className={`border-3 border-white/30 border-t-white rounded-full animate-spin ${isMobile ? 'w-7 h-7' : 'w-5 h-5'
                                        }`}></div>
                                    <span className="animate-pulse">
                                        {isMobile ? 'Searching Database...' : 'Searching...'}
                                    </span>
                                </>
                            ) : (
                                <>
                                    <i className={`fa-solid fa-search ${isMobile ? 'text-xl' : 'text-base'}`}></i>
                                    <span>
                                        {isMobile ? 'Find My Results' : 'Verify & Search Records'}
                                    </span>
                                </>
                            )}
                        </button>

                        {/* Enhanced Mobile-Optimized Search Tips */}
                        {isMobile && !hasSearched && (
                            <div className="bg-gradient-to-r from-white/5 to-emerald-500/5 border border-emerald-400/20 rounded-2xl p-5 mobile-layout-element">
                                <h4 className="text-emerald-400 font-bold text-sm mb-3 flex items-center gap-2">
                                    <div className="w-6 h-6 bg-emerald-500/20 rounded-full flex items-center justify-center">
                                        <i className="fa-solid fa-lightbulb text-xs"></i>
                                    </div>
                                    Quick Search Guide
                                </h4>
                                <div className="grid grid-cols-1 gap-3">
                                    <div className="flex items-start gap-3 p-3 bg-white/5 rounded-xl">
                                        <div className="w-5 h-5 bg-emerald-500/20 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                                            <i className="fa-solid fa-1 text-emerald-400 text-xs"></i>
                                        </div>
                                        <div>
                                            <p className="text-slate-200 text-sm font-medium">Enter Admission Number</p>
                                            <p className="text-slate-400 text-xs mt-1">Type your complete admission number (numbers only)</p>
                                        </div>
                                    </div>
                                    <div className="flex items-start gap-3 p-3 bg-white/5 rounded-xl">
                                        <div className="w-5 h-5 bg-emerald-500/20 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                                            <i className="fa-solid fa-2 text-emerald-400 text-xs"></i>
                                        </div>
                                        <div>
                                            <p className="text-slate-200 text-sm font-medium">Select Your Class</p>
                                            <p className="text-slate-400 text-xs mt-1">Choose the correct academic class from dropdown</p>
                                        </div>
                                    </div>
                                    <div className="flex items-start gap-3 p-3 bg-white/5 rounded-xl">
                                        <div className="w-5 h-5 bg-emerald-500/20 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                                            <i className="fa-solid fa-3 text-emerald-400 text-xs"></i>
                                        </div>
                                        <div>
                                            <p className="text-slate-200 text-sm font-medium">Tap Search Button</p>
                                            <p className="text-slate-400 text-xs mt-1">Results appear instantly with detailed scorecard</p>
                                        </div>
                                    </div>
                                </div>
                                <div className="mt-4 p-3 bg-emerald-500/10 border border-emerald-400/30 rounded-xl">
                                    <p className="text-emerald-300 text-xs font-medium flex items-center gap-2">
                                        <i className="fa-solid fa-shield-check"></i>
                                        All results are verified and authenticated in real-time
                                    </p>
                                </div>
                            </div>
                        )}
                    </form>

                    {/* Enhanced Mobile Search Results Feedback */}
                    {hasSearched && (
                        <div className={`mt-6 rounded-2xl border-2 mobile-layout-element animate-mobile-fade-in ${isMobile ? 'p-5' : 'p-4'
                            } ${result
                                ? 'bg-gradient-to-r from-emerald-50/10 to-emerald-100/5 border-emerald-400/40 shadow-lg shadow-emerald-500/10'
                                : 'bg-gradient-to-r from-red-50/10 to-red-100/5 border-red-400/40 shadow-lg shadow-red-500/10'
                            }`}>
                            {result ? (
                                <div className="text-emerald-400">
                                    <div className="flex items-center gap-4 mb-3">
                                        <div className={`flex-shrink-0 ${isMobile ? 'w-12 h-12' : 'w-8 h-8'
                                            } bg-gradient-to-br from-emerald-500/30 to-emerald-600/20 rounded-full flex items-center justify-center shadow-lg`}>
                                            <i className={`fa-solid fa-check-circle ${isMobile ? 'text-lg' : 'text-sm'
                                                }`}></i>
                                        </div>
                                        <div className="flex-1">
                                            <p className={`font-black ${isMobile ? 'text-lg' : 'text-base'} text-emerald-300`}>
                                                ✓ Student Record Found
                                            </p>
                                            <p className={`text-emerald-200 ${isMobile ? 'text-base' : 'text-sm'} font-medium`}>
                                                <strong className="text-white">{result.name}</strong> • Class <span className="text-emerald-300 font-bold">{result.className}</span>
                                            </p>
                                        </div>
                                        {isMobile && (
                                            <div className="flex-shrink-0 animate-bounce">
                                                <div className="w-8 h-8 bg-emerald-500/20 rounded-full flex items-center justify-center">
                                                    <i className="fa-solid fa-arrow-down text-emerald-400 text-sm"></i>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                    {isMobile && (
                                        <div className="grid grid-cols-2 gap-3 mt-4">
                                            <div className="bg-white/5 rounded-xl p-3 text-center">
                                                <p className="text-emerald-300 text-xs font-bold uppercase tracking-wider">Admission</p>
                                                <p className="text-white text-lg font-black">{result.adNo}</p>
                                            </div>
                                            <div className="bg-white/5 rounded-xl p-3 text-center">
                                                <p className="text-emerald-300 text-xs font-bold uppercase tracking-wider">Rank</p>
                                                <p className="text-white text-lg font-black">#{result.rank}</p>
                                            </div>
                                        </div>
                                    )}
                                    <div className="mt-4 p-3 bg-emerald-500/10 border border-emerald-400/30 rounded-xl">
                                        <p className="text-emerald-200 text-xs font-medium flex items-center gap-2">
                                            <i className="fa-solid fa-shield-check text-emerald-400"></i>
                                            Scroll down to view complete academic scorecard
                                        </p>
                                    </div>
                                </div>
                            ) : (
                                <div className="text-red-400">
                                    <div className="flex items-center gap-4 mb-3">
                                        <div className={`flex-shrink-0 ${isMobile ? 'w-12 h-12' : 'w-8 h-8'
                                            } bg-gradient-to-br from-red-500/30 to-red-600/20 rounded-full flex items-center justify-center shadow-lg`}>
                                            <i className={`fa-solid fa-exclamation-triangle ${isMobile ? 'text-lg' : 'text-sm'
                                                }`}></i>
                                        </div>
                                        <div className="flex-1">
                                            <p className={`font-black ${isMobile ? 'text-lg' : 'text-base'} text-red-300`}>
                                                ⚠ No Student Record Found
                                            </p>
                                            <p className={`text-red-200 ${isMobile ? 'text-base' : 'text-sm'} font-medium`}>
                                                Admission number <strong className="text-white">{searchAdNo}</strong> not found in <span className="text-red-300 font-bold">{searchClass}</span>
                                            </p>
                                        </div>
                                    </div>
                                    {isMobile && (
                                        <div className="mt-4 space-y-3">
                                            <div className="bg-white/5 rounded-xl p-4">
                                                <h5 className="text-red-300 font-bold text-sm mb-2 flex items-center gap-2">
                                                    <i className="fa-solid fa-search-plus"></i>
                                                    Search Suggestions
                                                </h5>
                                                <ul className="space-y-2 text-red-200 text-sm">
                                                    <li className="flex items-start gap-2">
                                                        <i className="fa-solid fa-arrow-right text-red-400 mt-1 text-xs"></i>
                                                        <span>Double-check your admission number</span>
                                                    </li>
                                                    <li className="flex items-start gap-2">
                                                        <i className="fa-solid fa-arrow-right text-red-400 mt-1 text-xs"></i>
                                                        <span>Verify you selected the correct class</span>
                                                    </li>
                                                    <li className="flex items-start gap-2">
                                                        <i className="fa-solid fa-arrow-right text-red-400 mt-1 text-xs"></i>
                                                        <span>Contact faculty if issue persists</span>
                                                    </li>
                                                </ul>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setSearchAdNo('');
                                                    setHasSearched(false);
                                                    setResult(null);
                                                }}
                                                className="w-full bg-red-600/20 hover:bg-red-600/30 border border-red-400/30 text-red-300 rounded-xl py-3 px-4 font-bold text-sm transition-all touch-target-min"
                                                style={{ WebkitTapHighlightColor: 'transparent' }}
                                            >
                                                <i className="fa-solid fa-redo mr-2"></i>
                                                Try Another Search
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Result Display */}
                {hasSearched && result && (
                    <div className="w-full max-w-5xl mx-auto animate-in fade-in slide-in-from-bottom-8 duration-700 print:mt-0 print:max-w-full">
                        {/* Enhanced Official Print Header - Visible only on Print */}
                        <div className="hidden print:block text-center print:mb-6 print:break-inside-avoid print:keep-with-next">
                            <div className="border-b-4 border-black print:pb-4 print:mb-4 print:a4-content">
                                {/* College Logo/Emblem Area */}
                                <div className="print:mb-3">
                                    <div className="w-16 h-16 mx-auto border-2 border-black rounded-full flex items-center justify-center print:mb-2">
                                        <span className="text-black font-bold text-lg">AIC</span>
                                    </div>
                                </div>

                                {/* Official College Header */}
                                <h1 className="print:text-2xl font-black text-black print:mb-2 print:leading-tight tracking-wider">
                                    AIC DA'WA COLLEGE
                                </h1>
                                <div className="print:text-sm text-black print:mb-2 print:leading-tight font-semibold">
                                    Affiliated to University of Calicut | NAAC Accredited
                                </div>
                                <div className="print:text-xs text-black print:mb-3 print:leading-tight">
                                    Melattur, Malappuram District, Kerala - 676517
                                </div>

                                {/* Document Title */}
                                <h2 className="print:text-lg font-bold text-black print:mb-2 print:leading-tight uppercase tracking-widest">
                                    OFFICIAL STUDENT RESULT VERIFICATION
                                </h2>

                                {/* Academic Session and Generation Info */}
                                <div className="grid grid-cols-3 gap-4 print:text-xs text-black print:leading-tight">
                                    <div className="text-left">
                                        <div className="font-bold">Academic Session:</div>
                                        <div>2024-25</div>
                                    </div>
                                    <div className="text-center">
                                        <div className="font-bold">Document Type:</div>
                                        <div>Result Verification</div>
                                    </div>
                                    <div className="text-right">
                                        <div className="font-bold">Generated:</div>
                                        <div>{new Date().toLocaleDateString('en-IN', {
                                            day: '2-digit',
                                            month: '2-digit',
                                            year: 'numeric'
                                        })}</div>
                                        <div>{new Date().toLocaleTimeString('en-IN', {
                                            hour: '2-digit',
                                            minute: '2-digit'
                                        })}</div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Mobile-Optimized Print Control Bar - Hidden on Print */}
                        <div className={`flex justify-between items-center mb-6 print:hidden ${isMobile ? 'flex-col gap-4' : ''}`}>
                            <div className={`flex items-center gap-2 text-emerald-400 ${isMobile ? 'order-2' : ''}`}>
                                <i className="fa-solid fa-shield-check"></i>
                                <span className={`font-bold uppercase tracking-widest ${isMobile ? 'text-xs' : 'text-xs'}`}>
                                    Authenticated Result
                                </span>
                            </div>
                            <button
                                type="button"
                                onClick={handlePrint}
                                className={`flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black uppercase tracking-widest transition-all shadow-lg active:scale-95 touch-target-large ${isMobile
                                    ? 'w-full py-4 text-sm order-1'
                                    : 'px-6 py-3 text-[10px]'
                                    }`}
                                style={{
                                    WebkitTapHighlightColor: 'transparent',
                                    userSelect: 'none'
                                }}
                            >
                                <i className={`fa-solid fa-print ${isMobile ? 'text-base' : 'text-xs'}`}></i>
                                <span>
                                    {isMobile ? 'Print Official Transcript' : 'Print Official Transcript'}
                                </span>
                            </button>
                        </div>

                        {/* The Actual Result Card */}
                        <div className="bg-white rounded-[3rem] overflow-hidden shadow-2xl border border-slate-200 print:shadow-none print:border print:border-slate-300 print:rounded-none">
                            {/* Mobile-Optimized Header */}
                            <div className={`bg-gradient-to-r from-slate-900 to-emerald-800 text-white print:p-8 ${isMobile ? 'p-6' : 'p-12'}`}>
                                <div className={`flex justify-between items-start gap-8 ${isMobile ? 'flex-col gap-6' : 'flex-wrap'}`}>
                                    <div className={isMobile ? 'w-full' : ''}>
                                        <h3 className={`font-black tracking-tighter mb-2 print:text-3xl ${isMobile ? 'text-2xl' : 'text-4xl'}`}>
                                            {result.name}
                                        </h3>
                                        <div className={`flex gap-4 items-center ${isMobile ? 'flex-col items-start gap-3' : 'flex-wrap'}`}>
                                            <span className={`bg-white/20 rounded-lg font-black tracking-widest uppercase ${isMobile ? 'px-3 py-1.5 text-xs' : 'px-4 py-2 text-[10px]'}`}>
                                                {result.className}
                                            </span>
                                            <span className={`text-emerald-300 font-bold ${isMobile ? 'text-sm' : 'text-sm'}`}>
                                                Admission: {result.adNo}
                                            </span>
                                            <span className={`text-emerald-300 font-bold ${isMobile ? 'text-sm' : 'text-sm'}`}>
                                                Semester: {result.semester}
                                            </span>
                                        </div>
                                    </div>
                                    <div className={`text-right ${isMobile ? 'w-full text-center' : ''}`}>
                                        <span className={`uppercase font-black tracking-[0.3em] text-white/60 mb-2 block ${isMobile ? 'text-xs' : 'text-[9px]'}`}>
                                            Class Rank
                                        </span>
                                        <span className={`font-black text-emerald-300 print:text-3xl ${isMobile ? 'text-4xl' : 'text-5xl'}`}>
                                            #{result.rank}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Mobile-Optimized Performance Summary */}
                            <div className={`print:p-8 ${isMobile ? 'p-6' : 'p-12'}`}>
                                <div className={`grid gap-8 mb-12 print:grid-cols-3 print:mb-8 ${isMobile ? 'grid-cols-1 gap-4 mb-8' : 'grid-cols-1 md:grid-cols-3'}`}>
                                    <div className={`bg-slate-50 border border-slate-100 text-center print:p-4 print:rounded-2xl ${isMobile ? 'p-6 rounded-2xl' : 'p-8 rounded-[2rem]'}`}>
                                        <p className={`uppercase font-black text-slate-400 mb-2 tracking-widest ${isMobile ? 'text-xs' : 'text-[10px]'}`}>
                                            Total Marks
                                        </p>
                                        <p className={`font-black text-slate-900 print:text-2xl ${isMobile ? 'text-3xl' : 'text-4xl'}`}>
                                            {result.grandTotal}
                                        </p>
                                    </div>
                                    <div className={`bg-slate-50 border border-slate-100 text-center print:p-4 print:rounded-2xl ${isMobile ? 'p-6 rounded-2xl' : 'p-8 rounded-[2rem]'}`}>
                                        <p className={`uppercase font-black text-slate-400 mb-2 tracking-widest ${isMobile ? 'text-xs' : 'text-[10px]'}`}>
                                            Average Percentage
                                        </p>
                                        <p className={`font-black text-slate-900 print:text-2xl ${isMobile ? 'text-3xl' : 'text-4xl'}`}>
                                            {result.average.toFixed(1)}%
                                        </p>
                                    </div>
                                    <div className={`bg-slate-50 border border-slate-100 text-center print:p-4 print:rounded-2xl ${isMobile ? 'p-6 rounded-2xl' : 'p-8 rounded-[2rem]'}`}>
                                        <p className={`uppercase font-black text-slate-400 mb-2 tracking-widest ${isMobile ? 'text-xs' : 'text-[10px]'}`}>
                                            Grade
                                        </p>
                                        <p className={`font-black print:text-2xl ${isMobile ? 'text-3xl' : 'text-4xl'} ${result.performanceLevel === 'Failed' ? 'text-red-500' :
                                            result.performanceLevel === 'Excellent' ? 'text-emerald-500' :
                                                result.performanceLevel === 'Good' ? 'text-blue-500' : 'text-amber-500'
                                            }`}>
                                            {result.performanceLevel}
                                        </p>
                                    </div>
                                </div>

                                {/* Subject-wise Results - Mobile-Optimized Display */}
                                {resultSubjects.length > 0 ? (
                                    <>
                                        {/* Mobile Card Layout */}
                                        {isMobile ? (
                                            <div className="space-y-4 mobile-layout-element">
                                                <div className="flex items-center justify-between mb-6">
                                                    <h4 className="text-lg font-black text-slate-800 flex items-center gap-2">
                                                        <i className="fa-solid fa-list-check text-emerald-600"></i>
                                                        Subject Results
                                                    </h4>
                                                    <div className="text-xs text-slate-500 font-medium">
                                                        {resultSubjects.length} subjects
                                                    </div>
                                                </div>
                                                {resultSubjects.map((subject, index) => {
                                                    const marks = result.marks[subject.id];
                                                    return (
                                                        <div
                                                            key={subject.id}
                                                            className="bg-white border-2 border-slate-100 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all mobile-card-layout animate-mobile-fade-in"
                                                            style={{ animationDelay: `${index * 100}ms` }}
                                                        >
                                                            {/* Subject Header */}
                                                            <div className="flex items-start justify-between mb-4">
                                                                <div className="flex-1">
                                                                    <h5 className="font-black text-slate-800 text-base leading-tight mb-1">
                                                                        {subject.name}
                                                                    </h5>
                                                                    <p className="arabic-text text-lg text-emerald-600 leading-none">
                                                                        {subject.arabicName}
                                                                    </p>
                                                                </div>
                                                                <div className="flex-shrink-0 ml-4">
                                                                    {marks && (
                                                                        <span className={`px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider ${marks.status === 'Passed'
                                                                            ? 'bg-emerald-100 text-emerald-700'
                                                                            : 'bg-red-100 text-red-700'
                                                                            }`}>
                                                                            {marks.status}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </div>

                                                            {/* Marks Grid */}
                                                            <div className="grid grid-cols-3 gap-3">
                                                                <div className="bg-slate-50 rounded-xl p-3 text-center">
                                                                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">TA</p>
                                                                    <p className="text-lg font-black text-slate-700">
                                                                        {marks?.ta ?? '-'}
                                                                    </p>
                                                                </div>
                                                                <div className="bg-slate-50 rounded-xl p-3 text-center">
                                                                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">CE</p>
                                                                    <p className="text-lg font-black text-slate-700">
                                                                        {marks?.ce ?? '-'}
                                                                    </p>
                                                                </div>
                                                                <div className={`rounded-xl p-3 text-center ${marks?.status === 'Failed'
                                                                    ? 'bg-red-50 border border-red-200'
                                                                    : 'bg-emerald-50 border border-emerald-200'
                                                                    }`}>
                                                                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Total</p>
                                                                    <p className={`text-xl font-black ${marks?.status === 'Failed' ? 'text-red-600' : 'text-emerald-600'
                                                                        }`}>
                                                                        {marks?.total ?? '-'}
                                                                    </p>
                                                                </div>
                                                            </div>

                                                            {/* Progress Bar for Mobile */}
                                                            {marks && marks.total !== undefined && (
                                                                <div className="mt-4">
                                                                    <div className="flex items-center justify-between mb-2">
                                                                        <span className="text-xs font-medium text-slate-500">Performance</span>
                                                                        <span className="text-xs font-bold text-slate-700">
                                                                            {((marks.total / 100) * 100).toFixed(0)}%
                                                                        </span>
                                                                    </div>
                                                                    <div className="w-full bg-slate-200 rounded-full h-2">
                                                                        <div
                                                                            className={`h-2 rounded-full transition-all duration-1000 ${marks.status === 'Failed'
                                                                                ? 'bg-red-500'
                                                                                : 'bg-emerald-500'
                                                                                }`}
                                                                            style={{
                                                                                width: `${Math.min((marks.total / 100) * 100, 100)}%`,
                                                                                animationDelay: `${index * 200}ms`
                                                                            }}
                                                                        ></div>
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        ) : (
                                            /* Desktop Table Layout */
                                            <div className="overflow-x-auto rounded-[2rem] border border-slate-100 print:border-slate-200">
                                                <table className="w-full border-collapse">
                                                    <thead>
                                                        <tr className="text-[10px] uppercase text-slate-400 font-black tracking-[0.2em] bg-slate-50 print:bg-slate-100">
                                                            <th className="px-8 py-6 text-left print:px-4 print:py-3">Subject</th>
                                                            <th className="px-6 py-6 text-center print:px-4 print:py-3">TA</th>
                                                            <th className="px-6 py-6 text-center print:px-4 print:py-3">CE</th>
                                                            <th className="px-6 py-6 text-center print:px-4 print:py-3">Total</th>
                                                            <th className="px-6 py-6 text-center print:px-4 print:py-3">Status</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-slate-50 print:divide-slate-200">
                                                        {resultSubjects.map(subject => {
                                                            const marks = result.marks[subject.id];
                                                            return (
                                                                <tr key={subject.id} className="hover:bg-slate-50/50 transition-colors">
                                                                    <td className="px-8 py-6 print:px-4 print:py-3">
                                                                        <p className="font-black text-slate-800 text-lg tracking-tight print:text-sm">{subject.name}</p>
                                                                        <p className="arabic-text text-xl text-emerald-600 leading-none mt-1 print:text-base">{subject.arabicName}</p>
                                                                    </td>
                                                                    <td className="px-6 py-6 text-center font-mono font-bold text-slate-500 print:px-4 print:py-3 print:text-xs">
                                                                        {marks?.ta ?? '-'}
                                                                    </td>
                                                                    <td className="px-6 py-6 text-center font-mono font-bold text-slate-500 print:px-4 print:py-3 print:text-xs">
                                                                        {marks?.ce ?? '-'}
                                                                    </td>
                                                                    <td className={`px-6 py-6 text-center font-black text-2xl print:px-4 print:py-3 print:text-lg ${marks?.status === 'Failed' ? 'text-red-500' : 'text-slate-900'
                                                                        }`}>
                                                                        {marks?.total ?? '-'}
                                                                    </td>
                                                                    <td className="px-6 py-6 text-center print:px-4 print:py-3">
                                                                        {marks && (
                                                                            <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${marks.status === 'Passed'
                                                                                ? 'bg-emerald-100 text-emerald-700'
                                                                                : 'bg-red-100 text-red-700'
                                                                                }`}>
                                                                                {marks.status}
                                                                            </span>
                                                                        )}
                                                                    </td>
                                                                </tr>
                                                            );
                                                        })}
                                                    </tbody>
                                                </table>
                                            </div>
                                        )}
                                    </>
                                ) : (
                                    <div className="p-12 text-center bg-slate-50 rounded-[2rem] border border-dashed border-slate-200">
                                        <i className="fa-solid fa-book-open text-4xl text-slate-300 mb-4"></i>
                                        <p className="text-slate-400 font-bold uppercase text-xs tracking-widest">Subject details not available</p>
                                    </div>
                                )}

                                {/* Enhanced Authentication Footer for Print Only */}
                                <div className="hidden print:block print:mt-6 print:pt-4 border-t-2 border-black print:break-inside-avoid print:keep-with-previous print:keep-together">
                                    <div className="grid grid-cols-3 gap-4 print:text-xs text-black print:leading-tight">
                                        {/* Generation Details */}
                                        <div>
                                            <div className="font-bold uppercase tracking-wider print:mb-2">Document Details</div>
                                            <div className="space-y-1">
                                                <div><span className="font-semibold">Generated On:</span></div>
                                                <div>{new Date().toLocaleDateString('en-IN', {
                                                    weekday: 'long',
                                                    year: 'numeric',
                                                    month: 'long',
                                                    day: 'numeric'
                                                })}</div>
                                                <div>{new Date().toLocaleTimeString('en-IN')}</div>
                                                <div className="print:mt-2">
                                                    <span className="font-semibold">Document ID:</span><br />
                                                    <span className="font-mono">AIC-RV-{result.adNo}-{Date.now().toString().slice(-8)}</span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Official Signatures */}
                                        <div className="text-center">
                                            <div className="space-y-4">
                                                <div>
                                                    <div className="border-b border-black w-32 mx-auto print:mb-2"></div>
                                                    <div className="font-bold uppercase tracking-wider">Academic Officer</div>
                                                </div>
                                                <div>
                                                    <div className="border-b border-black w-32 mx-auto print:mb-2"></div>
                                                    <div className="font-bold uppercase tracking-wider">Controller of Examinations</div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Verification & Seal */}
                                        <div className="text-right">
                                            <div className="font-bold uppercase tracking-wider print:mb-2">Official Seal</div>
                                            <div className="w-20 h-20 border-2 border-black rounded-full mx-auto print:mb-2 flex items-center justify-center">
                                                <span className="text-xs font-bold">SEAL</span>
                                            </div>
                                            <div className="print:text-xs">
                                                <div className="font-semibold">Verification Code:</div>
                                                <div className="font-mono">{btoa(result.adNo + Date.now()).slice(0, 8).toUpperCase()}</div>
                                            </div>
                                            <div className="print:mt-2 print:text-xs">
                                                <div className="font-semibold">Valid Until:</div>
                                                <div>{new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toLocaleDateString('en-IN')}</div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Footer Note */}
                                    <div className="print:mt-4 print:pt-2 border-t border-black text-center print:text-xs text-black print:break-inside-avoid">
                                        <div className="font-semibold">
                                            This is an official result verification document generated by AIC Da'wa College Examination System
                                        </div>
                                        <div className="print:mt-1">
                                            For verification, contact: examinations@aicdawacollege.edu.in | Phone: +91-483-2734567
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </main>

            {/* Footer - Hidden on Print */}
            <footer className="bg-slate-900/50 backdrop-blur-md py-12 px-8 text-center border-t border-white/10 print:hidden">
                <div className="flex items-center justify-center gap-3 mb-4 opacity-60">
                    <i className="fa-solid fa-graduation-cap text-xl text-emerald-400"></i>
                    <span className="text-white font-black tracking-widest text-sm">AIC EXAM PORTAL</span>
                </div>
                <p className="text-slate-400 text-[10px] font-bold uppercase tracking-[0.4em]">
                    &copy; 2024 AIC Da'wa College | Secure Academic Excellence System
                </p>
            </footer>
        </div>
    );
};

export default PublicPortal;