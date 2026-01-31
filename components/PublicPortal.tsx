import React, { useState, useEffect } from 'react';
import { StudentRecord, SubjectConfig } from '../types.ts';
import { CLASSES } from '../constants.ts';
import { dataService } from '../services/dataService';

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
            {/* Navbar - Hidden on Print */}
            <nav className="bg-white/10 backdrop-blur-md border-b border-white/20 px-8 py-6 flex justify-between items-center sticky top-0 z-50 print:hidden">
                <div className="flex items-center gap-4">
                    <div className="bg-emerald-500 text-white p-3 rounded-2xl shadow-lg">
                        <i className="fa-solid fa-graduation-cap text-xl"></i>
                    </div>
                    <div>
                        <h1 className="text-xl font-black text-white tracking-tighter leading-none">AIC DA'WA COLLEGE</h1>
                        <p className="text-[9px] text-emerald-400 font-black uppercase tracking-[0.3em] mt-1">Exam Portal</p>
                    </div>
                </div>
                <button
                    type="button"
                    onClick={onLoginClick}
                    className="text-[10px] font-black text-white/80 hover:text-white transition-all uppercase tracking-widest flex items-center gap-2 border border-white/20 px-4 py-2 rounded-xl hover:bg-white/10"
                >
                    <i className="fa-solid fa-shield-halved text-xs"></i> Faculty Access
                </button>
            </nav>

            <main className="flex-1 container mx-auto px-6 py-12 print:py-0 print:px-0 print:max-w-none">
                {/* Search Header - Hidden on Print */}
                <div className="w-full max-w-4xl mx-auto text-center mb-12 print:hidden">
                    <h2 className="text-5xl font-black text-white tracking-tighter mb-6">Academic Excellence Portal</h2>
                    <p className="text-slate-300 text-lg max-w-2xl mx-auto">
                        Access your comprehensive academic records and performance analytics with complete transparency
                    </p>
                </div>

                {/* Search Form - Hidden on Print */}
                <div className="w-full max-w-2xl mx-auto bg-white/10 backdrop-blur-lg rounded-3xl p-8 border border-white/20 mb-8 print:hidden">
                    <h3 className="text-2xl font-black text-white mb-6 flex items-center gap-3">
                        <i className="fa-solid fa-search text-emerald-400"></i>
                        Student Result Search
                    </h3>

                    <form onSubmit={handleSearch} className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-bold text-slate-300 mb-2 uppercase tracking-widest">
                                    Admission Number
                                </label>
                                <input
                                    type="text"
                                    value={searchAdNo}
                                    onChange={(e) => setSearchAdNo(e.target.value)}
                                    className="w-full p-4 bg-white/10 border border-white/20 rounded-2xl text-white placeholder-slate-400 outline-none focus:ring-4 focus:ring-emerald-500/30 focus:border-emerald-400 transition-all"
                                    placeholder="Enter admission number (e.g., 138)"
                                    required
                                    disabled={isSearching}
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-slate-300 mb-2 uppercase tracking-widest">
                                    Academic Class
                                </label>
                                <select
                                    value={searchClass}
                                    onChange={(e) => setSearchClass(e.target.value)}
                                    className="w-full p-4 bg-white/10 border border-white/20 rounded-2xl text-white outline-none focus:ring-4 focus:ring-emerald-500/30 focus:border-emerald-400 transition-all"
                                    disabled={isSearching}
                                >
                                    {CLASSES.map(c => <option key={c} value={c} className="bg-slate-800">{c}</option>)}
                                </select>
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={isSearching || !searchAdNo.trim()}
                            className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white py-4 rounded-2xl font-black uppercase text-sm tracking-widest transition-all shadow-xl flex items-center justify-center gap-3"
                        >
                            {isSearching ? (
                                <>
                                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                    Searching...
                                </>
                            ) : (
                                <>
                                    <i className="fa-solid fa-search"></i>
                                    Verify & Search Records
                                </>
                            )}
                        </button>
                    </form>

                    {hasSearched && (
                        <div className="mt-6 p-4 rounded-2xl bg-white/5 border border-white/10">
                            {result ? (
                                <div className="text-emerald-400 flex items-center gap-2">
                                    <i className="fa-solid fa-check-circle"></i>
                                    <span>Student found: <strong>{result.name}</strong></span>
                                </div>
                            ) : (
                                <div className="text-red-400 flex items-center gap-2">
                                    <i className="fa-solid fa-exclamation-circle"></i>
                                    <span>No student found with admission number: <strong>{searchAdNo}</strong></span>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Result Display */}
                {hasSearched && result && (
                    <div className="w-full max-w-5xl mx-auto animate-in fade-in slide-in-from-bottom-8 duration-700 print:mt-0 print:max-w-full">
                        {/* Print Control Bar - Hidden on Print */}
                        <div className="flex justify-between items-center mb-6 print:hidden">
                            <div className="flex items-center gap-2 text-emerald-400">
                                <i className="fa-solid fa-shield-check"></i>
                                <span className="text-xs font-bold uppercase tracking-widest">Authenticated Result</span>
                            </div>
                            <button
                                type="button"
                                onClick={handlePrint}
                                className="flex items-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black text-[10px] uppercase tracking-widest transition-all shadow-lg active:scale-95"
                            >
                                <i className="fa-solid fa-print"></i>
                                Print Official Transcript
                            </button>
                        </div>

                        {/* The Actual Result Card */}
                        <div className="bg-white rounded-[3rem] overflow-hidden shadow-2xl border border-slate-200 print:shadow-none print:border print:border-slate-300 print:rounded-none">
                            {/* Header */}
                            <div className="bg-gradient-to-r from-slate-900 to-emerald-800 p-12 text-white print:p-8">
                                <div className="flex justify-between items-start flex-wrap gap-8">
                                    <div>
                                        <h3 className="text-4xl font-black tracking-tighter mb-2 print:text-3xl">{result.name}</h3>
                                        <div className="flex gap-4 items-center flex-wrap">
                                            <span className="px-4 py-2 bg-white/20 rounded-lg text-[10px] font-black tracking-widest uppercase">{result.className}</span>
                                            <span className="text-emerald-300 font-bold text-sm">Admission: {result.adNo}</span>
                                            <span className="text-emerald-300 font-bold text-sm">Semester: {result.semester}</span>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <span className="text-[9px] uppercase font-black tracking-[0.3em] text-white/60 mb-2 block">Class Rank</span>
                                        <span className="text-5xl font-black text-emerald-300 print:text-3xl">#{result.rank}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Performance Summary */}
                            <div className="p-12 print:p-8">
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12 print:grid-cols-3 print:mb-8">
                                    <div className="bg-slate-50 p-8 rounded-[2rem] border border-slate-100 text-center print:p-4 print:rounded-2xl">
                                        <p className="text-[10px] uppercase font-black text-slate-400 mb-2 tracking-widest">Total Points</p>
                                        <p className="text-4xl font-black text-slate-900 print:text-2xl">{result.grandTotal}</p>
                                    </div>
                                    <div className="bg-slate-50 p-8 rounded-[2rem] border border-slate-100 text-center print:p-4 print:rounded-2xl">
                                        <p className="text-[10px] uppercase font-black text-slate-400 mb-2 tracking-widest">Average Score</p>
                                        <p className="text-4xl font-black text-slate-900 print:text-2xl">{result.average.toFixed(1)}%</p>
                                    </div>
                                    <div className="bg-slate-50 p-8 rounded-[2rem] border border-slate-100 text-center print:p-4 print:rounded-2xl">
                                        <p className="text-[10px] uppercase font-black text-slate-400 mb-2 tracking-widest">Performance</p>
                                        <p className={`text-4xl font-black print:text-2xl ${result.performanceLevel === 'Failed' ? 'text-red-500' :
                                            result.performanceLevel === 'Excellent' ? 'text-emerald-500' :
                                                result.performanceLevel === 'Good' ? 'text-blue-500' : 'text-amber-500'
                                            }`}>
                                            {result.performanceLevel}
                                        </p>
                                    </div>
                                </div>

                                {/* Subject-wise Results */}
                                {resultSubjects.length > 0 ? (
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
                                ) : (
                                    <div className="p-12 text-center bg-slate-50 rounded-[2rem] border border-dashed border-slate-200">
                                        <i className="fa-solid fa-book-open text-4xl text-slate-300 mb-4"></i>
                                        <p className="text-slate-400 font-bold uppercase text-xs tracking-widest">Subject details not available</p>
                                    </div>
                                )}

                                {/* Authentication Footer for Print Only */}
                                <div className="hidden print:flex justify-between items-center mt-20 pt-8 border-t border-slate-200">
                                    <div>
                                        <p className="text-[8px] font-black uppercase text-slate-400 tracking-widest">Generated On</p>
                                        <p className="text-[10px] font-bold text-slate-600">{new Date().toLocaleString()}</p>
                                    </div>
                                    <div className="text-center">
                                        <div className="w-32 h-1 bg-slate-200 mb-2"></div>
                                        <p className="text-[8px] font-black uppercase text-slate-400 tracking-widest">Controller of Examinations</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[8px] font-black uppercase text-slate-400 tracking-widest">Digital Authentication</p>
                                        <p className="text-[10px] font-mono font-bold text-emerald-600">AIC-CERT-{result.adNo}-{Date.now().toString().slice(-6)}</p>
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