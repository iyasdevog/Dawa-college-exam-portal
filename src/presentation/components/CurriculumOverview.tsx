import React, { useState, useEffect } from 'react';
import { CurriculumEntry, CurriculumStage } from '../../domain/entities/types';
import { dataService } from '../../infrastructure/services/dataService';
import { useMobile } from '../hooks/useMobile';

export const CurriculumOverview: React.FC = () => {
    const { isMobile } = useMobile();
    const [activeStage, setActiveStage] = useState<CurriculumStage>('Foundational');
    const [activeStream, setActiveStream] = useState<'3-Year' | '5-Year'>('5-Year');
    const [curriculum, setCurriculum] = useState<CurriculumEntry[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchCurriculum = async () => {
            try {
                const data = await dataService.getAllCurriculum();
                setCurriculum(data);
            } catch (error) {
                console.error("Failed to load curriculum", error);
            } finally {
                setIsLoading(false);
            }
        };
        fetchCurriculum();
    }, []);

    const filteredCurriculum = curriculum
        .filter(c => c.stage === activeStage && (activeStage !== 'Foundational' || c.stream === activeStream))
        .sort((a, b) => a.semester - b.semester || a.subjectName.localeCompare(b.subjectName));

    const groupedBySemester = filteredCurriculum.reduce((acc, entry) => {
        if (!acc[entry.semester]) acc[entry.semester] = [];
        acc[entry.semester].push(entry);
        return acc;
    }, {} as Record<number, CurriculumEntry[]>);

    if (isLoading) {
        return (
            <div className="w-full max-w-5xl mx-auto p-12 text-center animate-in fade-in duration-500">
                <div className="loader-ring mx-auto mb-6"></div>
                <h3 className="text-white font-bold text-xl">Loading Foundation Curriculum...</h3>
            </div>
        );
    }

    return (
        <div className="w-full max-w-5xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-700 pb-16">
            <div className={`text-center mb-10 ${isMobile ? 'px-4' : ''}`}>
                <h2 className={`font-black tracking-tighter mb-4 text-transparent bg-clip-text bg-gradient-to-r from-emerald-300 to-teal-500 ${isMobile ? 'text-3xl' : 'text-5xl'}`}>
                    Academic Curriculum
                </h2>
                <p className="text-slate-300 max-w-2xl mx-auto">
                    Explore our comprehensive foundational courses structured for spiritual and academic excellence over our integrated programs.
                </p>
            </div>

            {/* Stage Selector */}
            <div className="flex justify-center mb-6">
                <div className="bg-white/10 backdrop-blur-md p-1.5 rounded-2xl flex flex-wrap justify-center gap-2 border border-white/20 shadow-xl w-full max-w-2xl mx-auto">
                    {(['Foundational', 'Undergraduate', 'Post Graduate'] as CurriculumStage[]).map(stage => (
                        <button
                            key={stage}
                            onClick={() => setActiveStage(stage)}
                            className={`flex-1 min-w-[120px] px-4 py-3 rounded-xl font-bold uppercase tracking-widest text-xs transition-all ${activeStage === stage
                                ? 'bg-emerald-500 text-white shadow-lg scale-105'
                                : 'text-slate-300 hover:bg-white/10 hover:text-white hover:scale-105'
                            }`}
                        >
                            {stage}
                        </button>
                    ))}
                </div>
            </div>

            {/* Stream Selector (Only for Foundational) */}
            {activeStage === 'Foundational' && (
                <div className="flex justify-center mb-8 animate-in fade-in slide-in-from-top-2">
                    <div className="bg-white/10 backdrop-blur-md p-1 rounded-full flex gap-1 border border-white/20 shadow-md">
                        <button
                            onClick={() => setActiveStream('3-Year')}
                            className={`px-5 py-2.5 rounded-full font-bold uppercase tracking-widest text-[10px] transition-all ${activeStream === '3-Year'
                                ? 'bg-emerald-500/80 text-white shadow-md backdrop-blur-md border border-emerald-400/50'
                                : 'text-slate-300 hover:bg-white/5 hover:text-white'
                            }`}
                        >
                            3-Year Stream
                        </button>
                        <button
                            onClick={() => setActiveStream('5-Year')}
                            className={`px-5 py-2.5 rounded-full font-bold uppercase tracking-widest text-[10px] transition-all ${activeStream === '5-Year'
                                ? 'bg-emerald-500/80 text-white shadow-md backdrop-blur-md border border-emerald-400/50'
                                : 'text-slate-300 hover:bg-white/5 hover:text-white'
                            }`}
                        >
                            5-Year Stream
                        </button>
                    </div>
                </div>
            )}

            {Object.keys(groupedBySemester).length === 0 ? (
                <div className="bg-white/10 backdrop-blur-lg rounded-3xl border border-white/20 p-12 text-center shadow-2xl">
                    <div className="w-24 h-24 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-6">
                        <i className="fa-solid fa-moon text-4xl text-emerald-400 opacity-50"></i>
                    </div>
                    <h3 className="text-2xl font-black text-white mb-2">Curriculum Updates in Progress</h3>
                    <p className="text-slate-300 max-w-sm mx-auto">
                        The detailed syllabus for {activeStage} {activeStage === 'Foundational' ? `(${activeStream})` : ''} is currently being updated. Please check back later.
                    </p>
                </div>
            ) : (
                <div className="space-y-6 relative">
                    {/* Decorative Timeline Line (Desktop only) */}
                    {!isMobile && (
                        <div className="absolute left-[39px] top-6 bottom-6 w-1 bg-gradient-to-b from-emerald-500/50 via-teal-500/20 to-transparent rounded-full z-0"></div>
                    )}

                    {Object.entries(groupedBySemester)
                        .sort(([sA], [sB]) => parseInt(sA) - parseInt(sB))
                        .map(([semester, entries], idx) => (
                        <div key={semester} className={`relative z-10 animate-in fade-in slide-in-from-bottom-4 fill-mode-both duration-500 flex gap-4 md:gap-8`} style={{ animationDelay: `${idx * 150}ms` }}>
                            {/* Semester Indicator Node */}
                            <div className="shrink-0 flex flex-col items-center">
                                <div className={`flex items-center justify-center font-black shadow-lg shadow-emerald-500/20 text-white z-10 border-4 border-slate-900 ${isMobile ? 'w-12 h-12 text-lg rounded-xl bg-emerald-600' : 'w-20 h-20 text-3xl rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600'}`}>
                                    S{semester}
                                </div>
                                {isMobile && idx < Object.keys(groupedBySemester).length - 1 && (
                                    <div className="w-1 flex-1 bg-white/10 my-2 rounded-full"></div>
                                )}
                            </div>

                            {/* Semester Content Card */}
                            <div className="flex-1 bg-white/10 backdrop-blur-xl border border-white/20 rounded-3xl p-6 md:p-8 shadow-2xl hover:bg-white/15 transition-all group overflow-hidden relative">
                                {/* Subtle background icon */}
                                <i className="fa-brands fa-pagelines absolute -right-6 -bottom-6 text-9xl text-white/5 rotate-12 group-hover:scale-110 transition-transform duration-700 pointer-events-none"></i>
                                
                                <h3 className="font-black text-white text-xl uppercase tracking-widest mb-6 flex items-center gap-3">
                                    <span className="text-emerald-400">SEMESTER {semester}</span>
                                    <div className="h-px flex-1 bg-gradient-to-r from-emerald-500/30 to-transparent"></div>
                                </h3>
                                
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {entries.map(entry => (
                                        <div key={entry.id} className="bg-slate-900/40 border border-white/10 rounded-2xl p-5 hover:border-emerald-500/50 transition-colors">
                                            <div className="flex justify-between items-start mb-3 gap-2">
                                                <div>
                                                    <div className="flex items-center gap-2 mb-1">
                                                        {entry.subjectType && (
                                                            <span className="text-[9px] font-bold bg-white/10 text-slate-300 px-2 py-0.5 rounded-full uppercase tracking-widest border border-white/20">
                                                                {entry.subjectType}
                                                            </span>
                                                        )}
                                                        {entry.subjectCode && (
                                                            <span className="text-[9px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded-full uppercase tracking-widest">
                                                                {entry.subjectCode}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <h4 className="font-bold text-white text-lg">{entry.subjectName}</h4>
                                                </div>
                                                <span className="bg-emerald-500/20 text-emerald-300 px-2 py-1 rounded-lg text-xs font-bold whitespace-nowrap self-start">
                                                    <i className="fa-solid fa-hourglass-half mr-1"></i> {entry.learningPeriod}
                                                </span>
                                            </div>
                                            <div className="text-slate-300 text-sm whitespace-pre-wrap leading-relaxed opacity-90 relative pl-4 border-l-2 border-emerald-500/30">
                                                {entry.portions}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default CurriculumOverview;
