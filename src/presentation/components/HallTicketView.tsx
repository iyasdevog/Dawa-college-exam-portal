import React from 'react';
import { StudentRecord, ExamTimetableEntry } from '../../domain/entities/types';

interface HallTicketViewProps {
    student: StudentRecord;
    timetable: ExamTimetableEntry[];
    semester: 'Odd' | 'Even';
    academicYear?: string;
}

const HallTicketView: React.FC<HallTicketViewProps> = ({ student, timetable, semester, academicYear }) => {
    const handlePrint = () => {
        window.print();
    };

    const displayYear = academicYear || `${new Date().getFullYear()}-${(new Date().getFullYear() + 1).toString().slice(-2)}`;

    return (
        <div className="w-full max-w-5xl mx-auto p-4 sm:p-8 relative">
            {/* Background Glows for Screen View */}
            <div className="absolute top-0 left-1/4 w-96 h-96 bg-emerald-500/20 rounded-full blur-[100px] pointer-events-none print:hidden" />
            <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-teal-500/20 rounded-full blur-[100px] pointer-events-none print:hidden" />

            {/* Action Header - Screen Only */}
            <div className="flex flex-col md:flex-row justify-between items-center mb-8 print:hidden bg-white/10 backdrop-blur-lg p-6 rounded-3xl border border-white/20 shadow-xl relative z-10">
                <div className="mb-4 md:mb-0 text-center md:text-left">
                    <h2 className="text-white font-black text-2xl uppercase tracking-widest drop-shadow-md flex items-center gap-3">
                        <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center shadow-lg">
                            <i className="fa-solid fa-id-card-clip text-white text-xl"></i>
                        </div>
                        Digital Hall Ticket
                    </h2>
                    <p className="text-emerald-300 font-medium tracking-wide mt-2 px-1">Verify your details before the examination</p>
                </div>
                <button
                    onClick={handlePrint}
                    className="px-8 py-4 bg-gradient-to-r from-emerald-600 to-teal-500 text-white rounded-2xl font-black uppercase tracking-widest shadow-[0_0_30px_rgba(16,185,129,0.3)] hover:shadow-[0_0_40px_rgba(16,185,129,0.5)] hover:scale-105 active:scale-95 transition-all duration-300 flex items-center gap-3 border border-emerald-400/50"
                >
                    <i className="fa-solid fa-print text-xl animate-pulse"></i>
                    Download PDF
                </button>
            </div>

            {/* Hall Ticket Document */}
            <div 
                id="hall-ticket-container" 
                className="relative z-10 bg-white print:bg-white rounded-[2.5rem] print:rounded-none overflow-hidden shadow-2xl print:shadow-none border-2 border-slate-200 print:border-none"
            >
                <div className="border-[8px] border-slate-900 m-3 print:m-0 bg-white rounded-3xl print:rounded-none overflow-hidden">
                    <div className="border border-slate-900 m-1 p-8 print:p-4 space-y-8">
                        
                        {/* Header Section */}
                        <div className="text-center relative pb-6 border-b-2 border-slate-300">
                            {/* Watermark in background */}
                            <div className="absolute inset-0 flex items-center justify-center opacity-[0.03] print:opacity-[0.05] pointer-events-none overflow-hidden">
                                <i className="fa-solid fa-mosque text-[24rem]"></i>
                            </div>

                            <div className="flex justify-center mb-6 text-emerald-800 print:text-black relative z-10">
                                <div className="w-24 h-24 rounded-full flex items-center justify-center border-[3px] border-current bg-white">
                                    <i className="fa-solid fa-mosque text-5xl"></i>
                                </div>
                            </div>
                            <h1 className="text-[2.5rem] font-black uppercase tracking-[0.2em] text-slate-900 mb-3 drop-shadow-sm relative z-10 leading-none">
                                Islamic Dawa Academy
                            </h1>
                            <h2 className="text-xl font-bold uppercase tracking-widest text-slate-700 bg-slate-100 print:bg-transparent border border-slate-200 print:border-none inline-block px-6 py-2 rounded-full print:rounded-none relative z-10">
                                {semester} Semester Regular Examination - {displayYear}
                            </h2>
                            <div className="mt-8 relative z-10">
                                <span className="bg-slate-900 text-white py-4 px-16 inline-block font-black uppercase tracking-[0.4em] text-2xl shadow-lg print:shadow-none rounded-sm">
                                    Hall Ticket
                                </span>
                            </div>
                        </div>

                        {/* Student Details Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 print:grid-cols-2 relative z-10">
                            <div className="bg-slate-50 border-2 border-slate-200 p-5 rounded-2xl print:rounded-none print:border-slate-900">
                                <p className="text-xs font-black uppercase tracking-widest text-slate-500 mb-1">Admission Number</p>
                                <p className="text-3xl font-black text-slate-900">{student.adNo}</p>
                            </div>
                            <div className="bg-slate-50 border-2 border-slate-200 p-5 rounded-2xl print:rounded-none print:border-slate-900">
                                <p className="text-xs font-black uppercase tracking-widest text-slate-500 mb-1">Academic Class</p>
                                <p className="text-3xl font-black text-slate-900">{student.className}</p>
                            </div>
                            <div className="md:col-span-2 print:col-span-2 bg-emerald-50/50 print:bg-transparent border-2 border-emerald-200 print:border-slate-900 p-6 rounded-2xl print:rounded-none">
                                <p className="text-xs font-black uppercase tracking-widest text-emerald-600 print:text-slate-500 mb-1">Candidate Name</p>
                                <p className="text-4xl font-black uppercase tracking-wide text-emerald-950 print:text-slate-900">{student.name}</p>
                            </div>
                        </div>

                        {/* Signature Section 1 */}
                        <div className="flex justify-end pt-2 italic text-slate-500 relative z-10">
                            <div className="text-center w-64 border-t-2 border-dashed border-slate-300 pt-2 mt-8">
                                (Name & Signature of student)
                            </div>
                        </div>

                        {/* Verification Section */}
                        <div className="bg-slate-50 print:bg-transparent border-2 border-slate-200 p-6 rounded-2xl print:rounded-none print:border-slate-900 print:border space-y-4 relative overflow-hidden z-10">
                            <div className="absolute top-0 left-0 w-3 h-full bg-emerald-500 print:bg-slate-900" />
                            <h3 className="font-black uppercase tracking-widest text-slate-900 flex items-center gap-3 text-lg">
                                <div className="w-8 h-8 rounded-full bg-emerald-100 print:bg-transparent flex items-center justify-center">
                                    <i className="fa-solid fa-check-double text-emerald-600 print:text-slate-900"></i>
                                </div>
                                Verification Section
                            </h3>
                            <p className="text-slate-700 font-medium leading-relaxed pl-[3.25rem] print:pl-11">
                                I hereby verify that the above student is eligible to appear for the respective semester examination. Verified against attendance and disciplinary records.
                            </p>
                            <div className="flex justify-end pt-8">
                                <div className="text-center w-64 border-t-2 border-slate-900 pt-2 font-black uppercase tracking-widest text-[10px] text-slate-800">
                                    Signature of Class Teacher
                                </div>
                            </div>
                        </div>

                        {/* Exam Timetable */}
                        <div className="mt-8 relative z-10">
                            <h3 className="font-black uppercase tracking-widest text-slate-900 mb-6 pb-2 border-b-2 border-slate-200 flex items-center gap-3 text-lg">
                                <div className="w-8 h-8 rounded-full bg-emerald-100 print:bg-transparent flex items-center justify-center">
                                    <i className="fa-regular fa-calendar-check text-emerald-600 print:text-slate-900"></i>
                                </div>
                                Examination Schedule
                            </h3>
                            <table className="w-full border-collapse rounded-2xl print:rounded-none overflow-hidden shadow-sm print:shadow-none bg-white">
                                <thead>
                                    <tr className="bg-slate-900 text-white">
                                        <th className="border border-slate-700 print:border-slate-900 print:bg-slate-200 print:text-slate-900 p-5 text-center font-black uppercase text-xs tracking-widest">Date / Day</th>
                                        <th className="border border-slate-700 print:border-slate-900 print:bg-slate-200 print:text-slate-900 p-5 text-center font-black uppercase text-xs tracking-widest">Subject</th>
                                        <th className="border border-slate-700 print:border-slate-900 print:bg-slate-200 print:text-slate-900 p-5 text-center font-black uppercase text-xs tracking-widest w-1/4">Invigilator Sign</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {timetable.map((entry, idx) => (
                                        <tr key={entry.id || idx} className="bg-white even:bg-slate-50 print:even:bg-transparent">
                                            <td className="border border-slate-300 print:border-slate-900 p-5 text-center align-middle">
                                                <div className="font-black text-lg text-slate-900">{entry.date}</div>
                                                <div className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-600 print:text-slate-500 mt-1">{entry.day}</div>
                                            </td>
                                            <td className="border border-slate-300 print:border-slate-900 p-5 text-center align-middle">
                                                <div className="font-black text-[1.35rem] text-slate-800 arabic-text">{entry.subjectName}</div>
                                            </td>
                                            <td className="border border-slate-300 print:border-slate-900 p-5"></td>
                                        </tr>
                                    ))}
                                    {timetable.length === 0 && (
                                        <tr>
                                            <td colSpan={3} className="border border-slate-300 print:border-slate-900 p-12 text-center text-slate-400 italic font-medium bg-slate-50">
                                                <i className="fa-regular fa-calendar-xmark text-5xl mb-4 block opacity-50"></i>
                                                <span className="opacity-70">No exams scheduled for this semester.</span>
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* Instructions */}
                        <div className="space-y-4 pt-8 mt-8 border-t-[4px] border-slate-300 print:border-slate-900 relative z-10">
                            <h4 className="font-black text-slate-900 uppercase tracking-widest flex items-center gap-3 text-lg mb-6">
                                <div className="w-8 h-8 rounded-full bg-slate-100 print:bg-transparent flex items-center justify-center">
                                    <i className="fa-solid fa-triangle-exclamation text-slate-600 print:hidden text-sm"></i>
                                </div>
                                Instructions to Candidates
                            </h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-5 text-[13px] text-slate-700 font-medium">
                                <div className="flex gap-3 items-start bg-slate-50 print:bg-transparent p-3 rounded-xl print:p-0">
                                    <span className="flex-shrink-0 w-6 h-6 bg-slate-200 print:bg-transparent print:border print:border-slate-900 rounded-full flex items-center justify-center font-black text-[10px] text-slate-600">1</span>
                                    <span className="pt-0.5">This Hall Ticket must be brought to the examination hall on all days of the exam.</span>
                                </div>
                                <div className="flex gap-3 items-start bg-slate-50 print:bg-transparent p-3 rounded-xl print:p-0">
                                    <span className="flex-shrink-0 w-6 h-6 bg-slate-200 print:bg-transparent print:border print:border-slate-900 rounded-full flex items-center justify-center font-black text-[10px] text-slate-600">2</span>
                                    <span className="pt-0.5">Candidates must be seated at least 15 minutes before the commencement of the examination.</span>
                                </div>
                                <div className="flex gap-3 items-start bg-slate-50 print:bg-transparent p-3 rounded-xl print:p-0 text-red-900 print:text-slate-700">
                                    <span className="flex-shrink-0 w-6 h-6 bg-red-100 print:bg-transparent print:border print:border-slate-900 rounded-full flex items-center justify-center font-black text-[10px] text-red-600 print:text-slate-600">3</span>
                                    <span className="pt-0.5 font-bold print:font-medium">Possession of any kind of unfair means will lead to immediate disqualification.</span>
                                </div>
                                <div className="flex gap-3 items-start bg-slate-50 print:bg-transparent p-3 rounded-xl print:p-0">
                                    <span className="flex-shrink-0 w-6 h-6 bg-slate-200 print:bg-transparent print:border print:border-slate-900 rounded-full flex items-center justify-center font-black text-[10px] text-slate-600">4</span>
                                    <span className="pt-0.5">No student will be allowed to enter the exam hall after 30 minutes from the start time.</span>
                                </div>
                                <div className="flex gap-3 items-start bg-slate-50 print:bg-transparent p-3 rounded-xl print:p-0">
                                    <span className="flex-shrink-0 w-6 h-6 bg-slate-200 print:bg-transparent print:border print:border-slate-900 rounded-full flex items-center justify-center font-black text-[10px] text-slate-600">5</span>
                                    <span className="pt-0.5">Use only blue/black ink pens. Answers written in pencil will not be evaluated.</span>
                                </div>
                                <div className="flex gap-3 items-start bg-slate-50 print:bg-transparent p-3 rounded-xl print:p-0">
                                    <span className="flex-shrink-0 w-6 h-6 bg-slate-200 print:bg-transparent print:border print:border-slate-900 rounded-full flex items-center justify-center font-black text-[10px] text-slate-600">6</span>
                                    <span className="pt-0.5">Signature of the Invigilator must be obtained for each exam attended.</span>
                                </div>
                            </div>
                        </div>

                        {/* Footer Authority */}
                        <div className="flex flex-col items-end pt-20 space-y-2 relative z-10">
                            <p className="font-black text-slate-900 uppercase tracking-widest">Controller of Examinations</p>
                            <p className="text-slate-500 font-bold border-t-[3px] border-slate-300 print:border-slate-900 pt-2 px-10 min-w-[300px] text-center text-xs uppercase tracking-widest">Authorized Signature</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Print Styles */}
            <style dangerouslySetInnerHTML={{
                __html: `
                @media print {
                    body {
                        background: white !important;
                    }
                    body * { 
                        visibility: hidden; 
                    }
                    #hall-ticket-container, #hall-ticket-container * { 
                        visibility: visible; 
                    }
                    #hall-ticket-container {
                        position: absolute;
                        left: 0;
                        top: 0;
                        width: 100%;
                        margin: 0;
                        padding: 0;
                        border: none !important;
                        box-shadow: none !important;
                    }
                    .print\\:hidden { display: none !important; }
                    .print\\:m-0 { margin: 0 !important; }
                    .print\\:p-4 { padding: 1rem !important; }
                    .print\\:border-none { border: none !important; }
                    .print\\:border-slate-900 { border-color: #0f172a !important; }
                    .print\\:border-slate-700 { border-color: #0f172a !important; }
                    .print\\:text-black { color: black !important; }
                    .print\\:text-slate-900 { color: #0f172a !important; }
                    .print\\:bg-slate-200 { background-color: #e2e8f0 !important; }
                    .print\\:shadow-none { box-shadow: none !important; }
                    .print\\:bg-transparent { background-color: transparent !important; }
                    .print\\:bg-white { background-color: white !important; }
                    .print\\:border { border-width: 1px !important; }
                    
                    @page {
                        margin: 1cm;
                        size: A4 portrait;
                    }
                }
                .arabic-text {
                    font-family: 'Amiri', serif;
                }
            ` }} />
        </div>
    );
};

export default HallTicketView;
