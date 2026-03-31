import React from 'react';
import { StudentRecord, ExamTimetableEntry } from '../../domain/entities/types';

interface HallTicketViewProps {
    student: StudentRecord;
    timetable: ExamTimetableEntry[];
    semester: 'Odd' | 'Even';
}

const HallTicketView: React.FC<HallTicketViewProps> = ({ student, timetable, semester }) => {
    const handlePrint = () => {
        window.print();
    };

    const currentYear = new Date().getFullYear();
    const academicYear = `${currentYear}-${(currentYear + 1).toString().slice(-2)}`;

    return (
        <div className="max-w-4xl mx-auto p-4 sm:p-8 bg-white" id="hall-ticket-container">
            {/* Action Header - Hidden on Print */}
            <div className="flex justify-between items-center mb-8 print:hidden bg-emerald-50 p-4 rounded-2xl border border-emerald-100">
                <div>
                    <h2 className="text-emerald-900 font-black uppercase tracking-tight">Hall Ticket Preview</h2>
                    <p className="text-emerald-600 text-sm font-medium">Verify details before downloading</p>
                </div>
                <button
                    onClick={handlePrint}
                    className="px-6 py-3 bg-emerald-600 text-white rounded-xl font-black uppercase tracking-widest shadow-lg hover:bg-emerald-700 transition-all flex items-center gap-2"
                >
                    <i className="fa-solid fa-print"></i>
                    Print / Download PDF
                </button>
            </div>

            {/* Hall Ticket Document */}
            <div className="border-4 border-slate-900 p-1 bg-white">
                <div className="border border-slate-900 p-8 space-y-8">
                    {/* Header */}
                    <div className="text-center space-y-2">
                        <div className="flex justify-center mb-4">
                            <i className="fa-solid fa-mosque text-4xl text-slate-800"></i>
                        </div>
                        <h1 className="text-2xl font-black uppercase tracking-widest text-slate-900">Islamic Dawa Academy</h1>
                        <h2 className="text-lg font-bold uppercase text-slate-700 border-b-2 border-slate-900 pb-2 inline-block px-4">
                            {semester} Semester Regular Examination - January {academicYear}
                        </h2>
                        <div className="bg-slate-900 text-white py-2 px-12 inline-block mt-4 font-black uppercase tracking-[0.3em] text-xl">
                            Hall Ticket
                        </div>
                    </div>

                    {/* Student Info Table */}
                    <table className="w-full border-collapse">
                        <tbody>
                            <tr>
                                <td className="border-2 border-slate-900 p-3 font-black uppercase text-sm w-1/3 bg-slate-50">Admission Number</td>
                                <td className="border-2 border-slate-900 p-3 font-bold text-center text-lg">{student.adNo}</td>
                            </tr>
                            <tr>
                                <td className="border-2 border-slate-900 p-3 font-black uppercase text-sm bg-slate-50">Name</td>
                                <td className="border-2 border-slate-900 p-3 font-bold text-center text-lg uppercase">{student.name}</td>
                            </tr>
                            <tr>
                                <td className="border-2 border-slate-900 p-3 font-black uppercase text-sm bg-slate-50">Class</td>
                                <td className="border-2 border-slate-900 p-3 font-bold text-center text-lg">{student.className}</td>
                            </tr>
                        </tbody>
                    </table>

                    {/* Signature Section 1 */}
                    <div className="flex justify-end pt-4 italic text-slate-400">
                        (Name & Signature of student)
                    </div>

                    {/* Verification Section */}
                    <div className="space-y-4">
                        <h3 className="font-black underline uppercase text-slate-900">Verification Section (Class Teacher)</h3>
                        <p className="text-slate-800 font-medium leading-relaxed">
                            I hereby verify that the above student is eligible to appear for the respective semester examination.
                        </p>
                        <div className="flex justify-end pt-4">
                            <div className="text-center border-t border-slate-400 pt-1 px-8 italic text-slate-500">
                                Signature of Class Teacher
                            </div>
                        </div>
                    </div>

                    {/* Exam Timetable */}
                    <table className="w-full border-collapse">
                        <thead>
                            <tr className="bg-slate-50">
                                <th className="border-2 border-slate-900 p-3 text-center font-black uppercase text-xs">Date</th>
                                <th className="border-2 border-slate-900 p-3 text-center font-black uppercase text-xs">Day</th>
                                <th className="border-2 border-slate-900 p-3 text-center font-black uppercase text-xs text-right">Subject</th>
                                <th className="border-2 border-slate-900 p-3 text-center font-black uppercase text-xs">Signature of Invigilator</th>
                            </tr>
                        </thead>
                        <tbody>
                            {timetable.map((entry, idx) => (
                                <tr key={entry.id || idx}>
                                    <td className="border-2 border-slate-900 p-3 text-center font-bold">{entry.date}</td>
                                    <td className="border-2 border-slate-900 p-3 text-center font-medium capitalize">{entry.day}</td>
                                    <td className="border-2 border-slate-900 p-3 text-center font-black text-lg text-right arabic-text">
                                        {entry.subjectName}
                                    </td>
                                    <td className="border-2 border-slate-900 p-3"></td>
                                </tr>
                            ))}
                            {timetable.length === 0 && (
                                <tr>
                                    <td colSpan={4} className="border-2 border-slate-900 p-8 text-center text-slate-400 italic font-medium">
                                        No exams scheduled for this semester.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>

                    {/* Instructions */}
                    <div className="space-y-4 pt-4 border-t-2 border-slate-100">
                        <h4 className="font-black text-slate-900">Instructions to Candidates:</h4>
                        <ol className="list-decimal list-inside space-y-2 text-sm text-slate-800 font-medium">
                            <li>This Hall Ticket must be brought to the examination hall on all days of the exam.</li>
                            <li>Candidates must be seated at least 15 minutes before the commencement of the examination.</li>
                            <li>Possession of any kind of unfair means will lead to disqualification.</li>
                            <li>No student will be allowed to enter the exam hall after 30 minutes from the start time.</li>
                            <li>Use only blue/black ink pens. Answers written in pencil will not be evaluated.</li>
                            <li>Signature of both the Invigilator and Class Teacher must be obtained for each exam attended.</li>
                        </ol>
                    </div>

                    {/* Footer Authority */}
                    <div className="flex flex-col items-end pt-12 space-y-1">
                        <p className="font-black text-slate-900">Controller of Examinations</p>
                        <p className="text-slate-500 font-bold border-t border-slate-300 pt-1 px-4 min-w-[200px] text-center">Signature:</p>
                    </div>
                </div>
            </div>

            {/* Print Styles */}
            <style dangerouslySetInnerHTML={{
                __html: `
                @media print {
                    body * { visibility: hidden; }
                    #hall-ticket-container, #hall-ticket-container * { visibility: visible; }
                    #hall-ticket-container {
                        position: absolute;
                        left: 0;
                        top: 0;
                        width: 100%;
                        margin: 0;
                        padding: 0;
                    }
                    .print\\:hidden { display: none !important; }
                }
                .arabic-text {
                    font-family: 'Amiri', serif;
                }
            ` }} />
        </div>
    );
};

export default HallTicketView;
