import React from 'react';
import { StudentRecord, SubjectConfig } from '../../domain/entities/types';
import { useMobile } from '../hooks/useMobile';
import ClassResults from './ClassResults';

interface PublicScorecardProps {
    result: StudentRecord;
    subjects: SubjectConfig[];
}

const PublicScorecard: React.FC<PublicScorecardProps> = ({ result, subjects }) => {
    const { isMobile } = useMobile();

    const handlePrint = () => {
        window.print();
    };

    const resultSubjects = result ? subjects.filter(s => s.targetClasses?.includes(result.className)) : [];

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
                        AIC DA'WA COLLEGE
                    </h1>
                    <div className="print:text-xs text-black print:mb-3 print:leading-tight">
                        Virippadam, Akkod, Vazhakkad, Kerala 673640
                    </div>

                    {/* Document Title */}
                    <h2 className="print:text-lg font-bold text-black print:mb-2 print:leading-tight uppercase tracking-widest">
                        OFFICIAL STUDENT RESULT VERIFICATION
                    </h2>

                    {/* Academic Session and Generation Info */}
                    <div className="grid grid-cols-3 gap-4 print:text-xs text-black print:leading-tight">
                        <div className="text-left">
                            <div className="font-bold">Academic Session:</div>
                            <div>2026-27</div>
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
                                Average
                            </p>
                            <p className={`font-black text-slate-900 print:text-2xl ${isMobile ? 'text-3xl' : 'text-4xl'}`}>
                                {result.average.toFixed(1)}%
                            </p>
                        </div>
                        <div className={`bg-slate-50 border border-slate-100 text-center print:p-4 print:rounded-2xl ${isMobile ? 'p-6 rounded-2xl' : 'p-8 rounded-[2rem]'}`}>
                            <p className={`uppercase font-black text-slate-400 mb-2 tracking-widest ${isMobile ? 'text-xs' : 'text-[10px]'}`}>
                                Grade
                            </p>
                            <p className={`font-black print:text-2xl ${isMobile ? 'text-2xl' : 'text-3xl'} ${result.performanceLevel === 'F (Failed)' ? 'text-red-500' :
                                result.performanceLevel.includes('Outstanding') ? 'text-emerald-600' :
                                    result.performanceLevel.includes('Excellent') ? 'text-emerald-500' :
                                        result.performanceLevel.includes('Very Good') ? 'text-blue-500' :
                                            result.performanceLevel.includes('Good') ? 'text-teal-500' :
                                                'text-amber-500'
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
                                                                    // animationDelay: `${index * 200}ms`
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
    );
};

export default React.memo(PublicScorecard);
