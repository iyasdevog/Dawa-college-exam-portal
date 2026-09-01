import React, { useState } from 'react';
import { StudentRecord, SubjectConfig, SubjectMarks, ClassReleaseSettings } from '../../domain/entities/types';
import { useMobile } from '../hooks/useMobile';
import ClassResults from './ClassResults';
import { dataService } from '../../infrastructure/services/dataService';
import { useTerm } from '../viewmodels/TermContext';
import { TermSelector } from './TermSelector';
import AggregatedScorecard from './AggregatedScorecard';
import { isSameSubject, normalizeSubjectName, getSubjectMaxMarks } from '../../domain/utils/subjectUtils';


interface PublicScorecardProps {
    result: StudentRecord;
    subjects: SubjectConfig[];
    isResultsReleased?: boolean;
    isSuppReleased?: boolean;
    releaseSettings?: ClassReleaseSettings;
}

const PublicScorecard: React.FC<PublicScorecardProps> = ({ 
    result, 
    subjects, 
    isResultsReleased = true, 
    isSuppReleased = false,
    releaseSettings
}) => {
    const { isMobile } = useMobile();
    const { activeTerm, currentSemester, currentAcademicYear } = useTerm();
    const [showAggregatedView, setShowAggregatedView] = useState(false);
    const [branding, setBranding] = useState<any>(null);

    React.useEffect(() => {
        const loadBranding = async () => {
            const settings = await dataService.getGlobalSettings();
            setBranding(settings);
        };
        loadBranding();
    }, []);

    const handlePrint = () => {
        window.print();
    };

    // Get the specified term record
    let displayTerm = activeTerm;
    let activeTermRecord = result?.academicHistory?.[activeTerm];
    
    // Determine if we should fallback: only if no marks AND no subjects for this term
    const hasSubjectsForTerm = subjects.some(s => s.targetClasses?.includes(result?.currentClass || result?.className || ''));
    
    if (!activeTermRecord && !hasSubjectsForTerm && result?.academicHistory && Object.keys(result.academicHistory).length > 0) {
        // Fallback to latest available term only if current has no subjects assigned
        const terms = Object.keys(result.academicHistory).sort().reverse();
        displayTerm = terms[0];
        activeTermRecord = result.academicHistory[displayTerm];
    }

    const displayMarks = activeTermRecord?.marks || result?.marks || {};
    const displayRank = activeTermRecord?.rank || result?.rank || '-';
    // If only supp is released, totals/average might not make sense, maybe we should hide them or recalculate?
    // Let's just use the active term's totals for now or show N/A
    const isOnlySupp = !isResultsReleased && isSuppReleased;
    const displayTotal = isOnlySupp ? '-' : (activeTermRecord?.grandTotal ?? result?.grandTotal ?? 0);
    const displayAverage = isOnlySupp ? '-' : (activeTermRecord?.average ?? result?.average ?? 0);
    const displayPerformance = isOnlySupp ? 'Supplementary Phase' : (activeTermRecord?.performanceLevel || result?.performanceLevel || 'Not Assessed');
    const displayClass = activeTermRecord?.className || result?.currentClass || result?.className || '';
    const displaySemester = activeTermRecord?.semester || result?.semester || (displayTerm.endsWith('-Odd') ? 'Odd' : 'Even');

    // Merged marks mapping
    const suppExams = result?.supplementaryExams || [];
    const completedSuppIds = new Set(suppExams
        .filter(su => su.status === 'Completed' || su.status === 'Passed' || su.status === 'Failed')
        .map(su => su.subjectId.toLowerCase().trim())
    );
    const originalMarkIds = new Set(Object.keys(displayMarks).map(id => id.toLowerCase().trim()));

    let resultSubjects = result ? subjects.filter(s => {
        // Normalize search ID
        const sId = s.id.toLowerCase().trim();
        
        // Show subject if:
        // 1. It targets the student's class in this term
        // 2. The student has an original mark for it
        // 3. The student has a completed supplementary record for it
        const isTargetClass = s.targetClasses?.includes(displayClass);
        const hasOriginalMark = originalMarkIds.has(sId);
        const isSupplementarySubject = completedSuppIds.has(sId);
        
        if (!isTargetClass && !hasOriginalMark && !isSupplementarySubject) return false;

        // For elective subjects, only show if student is explicitly enrolled
        if (s.subjectType === 'elective') {
            return s.enrolledStudents?.includes(result.id) || hasOriginalMark || isSupplementarySubject;
        }

        return true;
    }) : [];
    
    // De-duplicate resultSubjects based on normalized names to handle case-variant legacy IDs
    const seenSubjectNames = new Set<string>();
    resultSubjects = resultSubjects.filter(s => {
        const normalizedName = normalizeSubjectName(s.name || s.id);
        if (seenSubjectNames.has(normalizedName)) return false;
        seenSubjectNames.add(normalizedName);
        return true;
    });

    // Sort subjects: Generally by name or id, but ensure consistency
    resultSubjects.sort((a, b) => (a.name || a.id).localeCompare(b.name || b.id));

    const finalMarks: Record<string, SubjectMarks> = {};
    // Build final marks map with case-insensitive lookup
    const markLookup: Record<string, SubjectMarks> = {};
    Object.entries(displayMarks).forEach(([id, m]) => {
        markLookup[id.toLowerCase().trim()] = m;
    });

    resultSubjects.forEach(s => {
        const sId = s.id.toLowerCase().trim();
        const originalMark = markLookup[sId];
        if (originalMark) {
            finalMarks[s.id] = { ...originalMark };
        }
    });

    if (isSuppReleased) {
        // Merge completed/processed supplementary marks
        const processedSupps = suppExams
            .filter(su => (su.status === 'Completed' || su.status === 'Passed' || su.status === 'Failed') && su.marks)
            // Sort by updatedAt descending so the latest one wins if duplicates exist
            .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));

        processedSupps.forEach(su => {
            if (!su.subjectId) return;

            const sId = su.subjectId.toLowerCase().trim();
            // Match by normalized ID or Name
            let targetSubject = resultSubjects.find(rs => 
                isSameSubject(rs.id, rs.name, su.subjectId, su.subjectName)
            );

            // VIRTUAL SUBJECT: If supplementary subject is not part of the current term's curriculum,
            // we create a virtual subject entry so it shows up in the scorecard.
            if (!targetSubject) {
                const globalSubject = subjects.find(s => s.id === su.subjectId);
                targetSubject = {
                    id: su.subjectId,
                    name: globalSubject?.name || ((su.subjectName && !/^[a-zA-Z0-9]{15,}$/.test(su.subjectName)) ? su.subjectName : su.subjectId),
                    arabicName: globalSubject?.arabicName || su.subjectName,
                    maxINT: su.maxINT || globalSubject?.maxINT || 30,
                    maxEXT: su.maxEXT || globalSubject?.maxEXT || 70,
                    subjectType: 'general',
                    targetClasses: [result?.currentClass || '']
                } as any;
                resultSubjects.push(targetSubject!);
            }

            if (targetSubject) {
                const originalMark = markLookup[targetSubject.id.toLowerCase().trim()];
                
                // Calculate previous total for display if missing
                // Prefer su.previousMarks if originalMark is missing or empty
                let prevMarks = (originalMark && Object.keys(originalMark).length > 0) ? originalMark : su.previousMarks;
                
                if (prevMarks && prevMarks.total === undefined) {
                    const intVal = typeof prevMarks.int === 'number' ? prevMarks.int : 0;
                    const extVal = typeof prevMarks.ext === 'number' ? prevMarks.ext : 0;
                    prevMarks = { ...prevMarks, total: intVal + extVal };
                }

                // Construct the merged mark with proper fallbacks for Max values
                const mergedMark = {
                    ...su.marks,
                    isSupplementary: true,
                    applicationType: su.applicationType,
                    // Prefer supplementary metadata if it's non-zero, otherwise fallback to global subject config
                    maxINT: (su.maxINT && su.maxINT > 0) ? su.maxINT : (targetSubject.maxINT || 0),
                    maxEXT: (su.maxEXT && su.maxEXT > 0) ? su.maxEXT : (targetSubject.maxEXT || 0),
                    previousMarks: prevMarks
                };

                finalMarks[targetSubject.id] = mergedMark as any;
            }
        });

        if (!isResultsReleased) {
            // ONLY SHOW supplementary subjects if regular results are not released
            const suppSubjectIds = new Set(processedSupps.map(su => su.subjectId.toLowerCase().trim()));
            const suppSubjectNames = new Set(processedSupps.map(su => su.subjectName?.toLowerCase().trim()).filter(Boolean));
            
            resultSubjects = resultSubjects.filter(s => 
                suppSubjectIds.has(s.id.toLowerCase().trim()) || 
                (s.name && suppSubjectNames.has(s.name.toLowerCase().trim()))
            );
        }
    }

    const hasSupplementary = Object.values(finalMarks).some(m => (m as any).isSupplementary);

    if (showAggregatedView) {
        return (
            <AggregatedScorecard 
                student={result} 
                allSubjects={subjects} 
                onClose={() => setShowAggregatedView(false)} 
                isPublicView={true}
                releaseSettings={releaseSettings}
            />
        );
    }

    return (
        <div className="space-y-6 animate-in fade-in zoom-in duration-500">
            {/* Enhanced Official Print Header - Visible only on Print */}
            <div className="hidden print:block text-center print:mb-6 print:break-inside-avoid print:keep-with-next">
                <div className="border-b-4 border-black print:pb-4 print:mb-4 print:a4-content">
                    {/* College Logo/Emblem Area */}
                    <div className="print:mb-3">
                        <img src="/logo-black.png" alt="AIC Logo" className="h-20 mx-auto object-contain print:mb-2" />
                    </div>

                    {/* Official College Header */}
                    <h1 className="print:text-2xl font-black text-black print:mb-2 print:leading-tight tracking-wider">
                        {branding?.institutionName || "AIC DA'WA COLLEGE"}
                    </h1>
                    <div className="print:text-xs text-black print:mb-3 print:leading-tight">
                        {branding?.institutionAddress || "Virippadam, Akkod, Vazhakkad, Kerala 673640"}
                    </div>

                    {/* Document Title */}
                    <h2 className="print:text-lg font-bold text-black print:mb-2 print:leading-tight uppercase tracking-widest">
                        OFFICIAL STUDENT RESULT VERIFICATION
                    </h2>

                    {/* Academic Session and Generation Info */}
                    <div className="grid grid-cols-3 gap-4 print:text-xs text-black print:leading-tight">
                        <div className="text-left">
                            <div className="font-bold">Academic Session:</div>
                            <div>{currentAcademicYear}</div>
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

            {/* Fallback Data Notice */}
            {displayTerm !== activeTerm && (
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 flex items-center gap-4 text-amber-200 print:hidden">
                    <i className="fa-solid fa-circle-info text-amber-500 text-xl"></i>
                    <div className="flex-1">
                        <p className="font-bold text-sm">Viewing Past Record</p>
                        <p className="text-xs opacity-80">No results found for <strong>{activeTerm}</strong>. Showing your most recent data from <strong>{displayTerm}</strong>.</p>
                    </div>
                </div>
            )}

            {/* The Actual Result Card */}
            <div className="bg-white/80 backdrop-blur-md rounded-[2.5rem] overflow-hidden shadow-xl border border-slate-200/60 print:shadow-none print:border print:border-slate-300 print:rounded-none">
                {/* Refined Header */}
                <div className={`bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-900 text-white print:p-8 ${isMobile ? 'p-5' : 'p-10'}`}>
                    <div className={`flex justify-between items-start gap-8 ${isMobile ? 'flex-col gap-6' : 'flex-wrap'}`}>
                        <div className={isMobile ? 'w-full' : 'flex-1'}>
                            <h3 className={`font-black tracking-tighter mb-1 print:text-2xl ${isMobile ? 'text-xl' : 'text-3xl'}`}>
                                {result.name}
                            </h3>
                            <div className={`flex gap-3 items-center ${isMobile ? 'flex-col items-start gap-2' : 'flex-wrap'}`}>
                                <span className={`bg-white/10 text-white/90 rounded-md font-black tracking-widest uppercase ${isMobile ? 'px-2 py-1 text-[10px]' : 'px-3 py-1.5 text-[9px]'}`}>
                                    {displayClass}
                                </span>
                                <span className={`text-emerald-400 font-bold ${isMobile ? 'text-xs' : 'text-xs'}`}>
                                    ID: {result.adNo}
                                </span>
                                <div className={`flex items-center gap-2 print:hidden ${isMobile ? 'flex-col items-start gap-2 w-full mt-1' : ''}`}>
                                    <div className="flex items-center gap-1.5">
                                        <span className="text-[8px] font-black text-white/40 uppercase tracking-widest">Term:</span>
                                        <TermSelector variant="dark" className="!bg-white/5 border-none !p-1 h-auto text-[10px] !text-emerald-300" />
                                    </div>
                                    <button 
                                        onClick={() => setShowAggregatedView(true)} 
                                        className="px-2.5 py-1 bg-amber-500/10 hover:bg-amber-500/20 rounded-md text-amber-300 font-bold text-[10px] transition border border-amber-500/20 whitespace-nowrap"
                                    >
                                        <i className="fa-solid fa-layer-group mr-1"></i> Full Transcript
                                    </button>
                                </div>
                                <span className="hidden print:inline text-emerald-300 font-bold text-sm">
                                    Term: {activeTerm}
                                </span>
                            </div>
                        </div>
                        <div className={`text-right ${isMobile ? 'w-full text-left pt-2 border-t border-white/5' : ''}`}>
                            <span className={`uppercase font-black tracking-[0.2em] text-white/40 mb-0.5 block ${isMobile ? 'text-[10px]' : 'text-[8px]'}`}>
                                Class Rank
                            </span>
                            <span className={`font-black text-emerald-400 print:text-2xl ${isMobile ? 'text-3xl' : 'text-4xl'}`}>
                                #{displayRank}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Refined Performance Summary */}
                <div className={`print:p-8 ${isMobile ? 'p-5' : 'p-8 pb-4'}`}>
                    <div className={`grid gap-4 mb-4 print:grid-cols-3 print:mb-6 ${isMobile ? 'grid-cols-1 mb-6' : 'grid-cols-1 md:grid-cols-3'}`}>
                        <div className={`bg-slate-100/50 border border-slate-200/50 text-center print:p-3 print:rounded-xl p-5 rounded-2xl`}>
                            <p className="uppercase font-black text-slate-500 mb-1 tracking-widest text-[9px]">
                                Total Marks
                            </p>
                            <p className={`font-black text-slate-900 print:text-xl ${isMobile ? 'text-2xl' : 'text-3xl'}`}>
                                {displayTotal}
                            </p>
                        </div>
                        <div className={`bg-slate-100/50 border border-slate-200/50 text-center print:p-3 print:rounded-xl p-5 rounded-2xl`}>
                            <p className="uppercase font-black text-slate-500 mb-1 tracking-widest text-[9px]">
                                Average
                            </p>
                            <p className={`font-black text-slate-900 print:text-xl ${isMobile ? 'text-2xl' : 'text-3xl'}`}>
                                {typeof displayAverage === 'number' ? displayAverage.toFixed(1) : displayAverage}%
                            </p>
                        </div>
                        <div className={`bg-slate-100/50 border border-slate-200/50 text-center print:p-3 print:rounded-xl p-5 rounded-2xl`}>
                            <p className="uppercase font-black text-slate-500 mb-1 tracking-widest text-[9px]">
                                Performance
                            </p>
                            <p className={`font-black print:text-xl ${isMobile ? 'text-xl' : 'text-2xl'} ${displayPerformance === 'F (Failed)' ? 'text-red-600' :
                                displayPerformance.includes('O') ? 'text-emerald-700' :
                                displayPerformance.includes('A+') ? 'text-emerald-600' :
                                displayPerformance.includes('A') ? 'text-blue-600' :
                                'text-slate-700'
                                }`}>
                                {displayPerformance}
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
                                        <h4 className="text-lg font-black text-slate-900 flex items-center gap-2">
                                            <i className="fa-solid fa-list-check text-emerald-700"></i>
                                            Subject Results
                                        </h4>
                                        <div className="text-xs text-slate-500 font-medium">
                                            {resultSubjects.length} subjects
                                        </div>
                                    </div>
                                    {resultSubjects.map((subject, index) => {
                                        const marks = finalMarks[subject.id];
                                        const { maxINT, maxEXT, maxTotal } = getSubjectMaxMarks(subject);
                                        return (
                                            <div
                                                key={subject.id}
                                                className="bg-white border-2 border-slate-100 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all mobile-card-layout animate-mobile-fade-in"
                                                style={{ animationDelay: `${index * 100}ms` }}
                                            >
                                                {/* Subject Header */}
                                                <div className="flex items-start justify-between mb-4">
                                                    <div className="flex-1">
                                                        <h5 className="font-black text-slate-800 text-base leading-tight mb-1 flex items-center gap-2">
                                                            {subject.name}
                                                            {marks?.isSupplementary && (
                                                                <span className={`text-[8px] px-1.5 py-0.5 rounded border uppercase tracking-wider font-bold ${
                                                                    marks.applicationType === 'special-supp' ? 'bg-rose-100 text-rose-700 border-rose-200' :
                                                                    marks.applicationType === 'revaluation' ? 'bg-sky-100 text-sky-700 border-sky-200' :
                                                                    marks.applicationType === 'improvement' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' :
                                                                    'bg-orange-100 text-orange-700 border-orange-200'
                                                                }`}>
                                                                    {marks.applicationType === 'special-supp' ? 'Special Supp' :
                                                                     marks.applicationType === 'revaluation' ? 'Revaluation' :
                                                                     marks.applicationType === 'improvement' ? 'Improvement' : 'Supp'}
                                                                </span>
                                                            )}
                                                        </h5>
                                                        {subject.arabicName && (
                                                            <p className="arabic-text text-lg text-emerald-600 leading-none">
                                                                {subject.arabicName}
                                                            </p>
                                                        )}
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
                                                <div className={`grid ${marks?.isSupplementary ? 'grid-cols-4' : 'grid-cols-3'} gap-2`}>
                                                    {marks?.isSupplementary && (
                                                        <div className="bg-amber-50/50 rounded-xl p-2 text-center border border-amber-200/30">
                                                            <p className="text-[9px] font-bold text-amber-900 uppercase tracking-wider mb-1">PREV</p>
                                                            <p className="text-base font-black text-slate-500">
                                                                {marks?.previousMarks?.total ?? '-'}
                                                            </p>
                                                            <p className="text-[7px] font-bold text-slate-400 uppercase tracking-tighter">
                                                                E:{marks?.previousMarks?.ext ?? '-'} I:{marks?.previousMarks?.int ?? '-'}
                                                            </p>
                                                        </div>
                                                    )}
                                                    <div className="bg-slate-100/50 rounded-xl p-2 text-center">
                                                        <p className="text-[9px] font-bold text-slate-600 uppercase tracking-wider mb-1">EXT</p>
                                                        <p className="text-base font-black text-slate-900">
                                                            {maxEXT === 0 ? 'N/A' : (
                                                                <>
                                                                    {marks?.ext ?? '-'}
                                                                    <span className="text-[9px] text-slate-500 ml-0.5">/{maxEXT}</span>
                                                                </>
                                                            )}
                                                        </p>
                                                    </div>
                                                    <div className="bg-slate-100/50 rounded-xl p-2 text-center">
                                                        <p className="text-[9px] font-bold text-slate-600 uppercase tracking-wider mb-1">INT</p>
                                                        <p className="text-base font-black text-slate-900">
                                                            {marks?.int ?? '-'}
                                                            <span className="text-[9px] text-slate-500 ml-0.5">/{maxINT}</span>
                                                        </p>
                                                    </div>
                                                    <div className={`rounded-xl p-2 text-center shadow-sm ${marks?.status === 'Failed'
                                                        ? 'bg-red-50 border border-red-200'
                                                        : 'bg-emerald-50 border border-emerald-200'
                                                        }`}>
                                                        <p className="text-[9px] font-bold text-slate-600 uppercase tracking-wider mb-1">Total</p>
                                                        <p className={`text-lg font-black ${marks?.status === 'Failed' ? 'text-red-700' : 'text-emerald-700'
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
                                                                {Math.round((marks.total / maxTotal) * 100)}%
                                                            </span>
                                                        </div>
                                                        <div className="w-full bg-slate-200 rounded-full h-2">
                                                            <div
                                                                className={`h-2 rounded-full transition-all duration-1000 ${marks.status === 'Failed'
                                                                    ? 'bg-red-500'
                                                                    : 'bg-emerald-500'
                                                                    }`}
                                                                style={{
                                                                    width: `${Math.min((marks.total / maxTotal) * 100, 100)}%`,
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
                                /* Desktop Table Layout - Aligned with StudentScorecard */
                                <div className="overflow-x-auto rounded-[1.5rem] border border-slate-100 print:border-slate-200">
                                    <table className="w-full border-collapse">
                                        <thead>
                                            <tr className="text-[9px] uppercase text-slate-600 font-black tracking-[0.15em] bg-slate-100/80 print:bg-slate-100">
                                                <th className="px-6 py-4 text-left">Subject</th>
                                                {hasSupplementary && <th className="px-4 py-4 text-center bg-amber-50/50 text-amber-900">Prev. Total</th>}
                                                <th className="px-4 py-4 text-center">External</th>
                                                <th className="px-4 py-4 text-center">Internal</th>
                                                <th className="px-4 py-4 text-center border-l border-slate-200">Total</th>
                                                <th className="px-4 py-4 text-center">Max</th>
                                                <th className="px-4 py-4 text-center border-l border-slate-200">Status</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-50 print:divide-slate-200">
                                            {resultSubjects.map(subject => {
                                                const marks = finalMarks[subject.id];
                                                const { maxINT, maxEXT, maxTotal } = getSubjectMaxMarks(subject);
                                                return (
                                                    <tr key={subject.id} className="hover:bg-slate-50/30 transition-colors">
                                                        <td className="px-6 py-4 print:px-4 print:py-3">
                                                            <p className="font-bold text-slate-800 text-sm tracking-tight print:text-xs flex items-center gap-2">
                                                                {subject.name}
                                                                {marks?.isSupplementary && (
                                                                    <span className={`text-[8px] px-1.5 py-0.5 rounded border uppercase tracking-wider font-bold ${
                                                                        marks.applicationType === 'special-supp' ? 'bg-rose-100 text-rose-700 border-rose-200' :
                                                                        marks.applicationType === 'revaluation' ? 'bg-sky-100 text-sky-700 border-sky-200' :
                                                                        marks.applicationType === 'improvement' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' :
                                                                        'bg-orange-100 text-orange-700 border-orange-200'
                                                                    }`}>
                                                                        {marks.applicationType === 'special-supp' ? 'Special Supp' :
                                                                         marks.applicationType === 'revaluation' ? 'Revaluation' :
                                                                         marks.applicationType === 'improvement' ? 'Improvement' : 'Supp'}
                                                                    </span>
                                                                )}
                                                            </p>
                                                            {subject.arabicName && (
                                                                <p className="arabic-text text-lg text-emerald-600 leading-none mt-0.5 print:text-sm">{subject.arabicName}</p>
                                                            )}
                                                        </td>
                                                        {hasSupplementary && (
                                                            <td className="px-4 py-4 text-center bg-amber-50/10">
                                                                {marks?.isSupplementary ? (
                                                                    <div className="flex flex-col items-center">
                                                                        <span className="text-sm font-black text-slate-400">
                                                                            {(marks as any).previousMarks?.total ?? '-'}
                                                                        </span>
                                                                        <span className="text-[8px] font-bold text-slate-500 uppercase tracking-tighter mt-0.5">
                                                                            E:{(marks as any).previousMarks?.ext ?? '-'} I:{(marks as any).previousMarks?.int ?? '-'}
                                                                        </span>
                                                                    </div>
                                                                ) : '-'}
                                                            </td>
                                                        )}
                                                        <td className="px-4 py-4 text-center">
                                                            <div className="flex flex-col items-center">
                                                                <span className={`text-sm font-black ${marks?.isSupplementary ? 'text-emerald-700' : 'text-slate-900'} print:text-xs`}>
                                                                    {maxEXT === 0 ? 'N/A' : (marks?.ext ?? '-')}
                                                                </span>
                                                                <span className="text-[9px] font-bold text-slate-500 uppercase tracking-tight opacity-70">
                                                                    MAX {maxEXT}
                                                                </span>
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-4 text-center">
                                                            <div className="flex flex-col items-center">
                                                                <span className="text-sm font-black text-slate-900 print:text-xs">
                                                                    {marks?.int ?? '-'}
                                                                </span>
                                                                <span className="text-[9px] font-bold text-slate-500 uppercase tracking-tight opacity-70">
                                                                    MAX {maxINT}
                                                                </span>
                                                            </div>
                                                        </td>
                                                        <td className={`px-4 py-4 text-center font-black text-xl border-l border-slate-50 print:px-3 print:py-2 print:text-base ${marks?.status === 'Failed' ? 'text-red-700' : marks?.isSupplementary ? 'text-emerald-700' : 'text-slate-900'
                                                            }`}>
                                                            {marks?.total ?? '-'}
                                                        </td>
                                                        <td className="px-4 py-4 text-center font-bold text-slate-900 print:px-3 print:py-2 text-xs">
                                                            {maxTotal}
                                                        </td>
                                                        <td className="px-4 py-4 text-center print:px-3 print:py-2">
                                                            {marks && (
                                                                <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest ${marks.status === 'Passed'
                                                                    ? 'bg-emerald-100 text-emerald-800 shadow-sm'
                                                                    : 'bg-red-100 text-red-800 shadow-sm'
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
                                This is an official result verification document generated by {branding?.institutionName || "AIC Da'wa College"} Examination System
                            </div>
                            <div className="print:mt-1">
                                For verification, contact: {branding?.contactEmail || "examinations@aicdawacollege.edu.in"} | Phone: {branding?.contactPhone || "+91-483-2734567"}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default React.memo(PublicScorecard);
