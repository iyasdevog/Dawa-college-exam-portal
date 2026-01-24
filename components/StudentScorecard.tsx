
import React, { useState, useEffect } from 'react';
import { StudentRecord } from '../types';
import { SUBJECTS } from '../constants';
import { analyzePerformance } from '../services/aiService';

interface StudentScorecardProps {
  students: StudentRecord[];
}

const StudentScorecard: React.FC<StudentScorecardProps> = ({ students }) => {
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(students[0]?.id || null);
  const [remarks, setRemarks] = useState<string>('Loading AI Analysis...');
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const student = students.find(s => s.id === selectedStudentId);

  useEffect(() => {
    if (student) {
      const getAiRemarks = async () => {
        setIsAnalyzing(true);
        const feedback = await analyzePerformance(student);
        setRemarks(feedback);
        setIsAnalyzing(false);
      };
      getAiRemarks();
    }
  }, [selectedStudentId]);

  if (!student) return <div>No student selected.</div>;

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="bg-white p-4 rounded-xl border border-slate-200">
        <label className="block text-sm font-medium text-slate-600 mb-2">Select Student to View Report</label>
        <select 
          value={selectedStudentId || ''} 
          onChange={(e) => setSelectedStudentId(e.target.value)}
          className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
        >
          {students.map(s => <option key={s.id} value={s.id}>{s.adNo} - {s.name} ({s.className})</option>)}
        </select>
      </div>

      {/* Actual Card */}
      <div className="bg-white shadow-2xl rounded-2xl overflow-hidden border border-slate-200 print:shadow-none print:border-none">
        {/* Header */}
        <div className="bg-slate-900 text-white p-8 text-center relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-full opacity-10 flex items-center justify-center">
             <i className="fa-solid fa-graduation-cap text-[15rem]"></i>
          </div>
          <div className="relative z-10">
            <h1 className="text-3xl font-bold tracking-tight mb-2">ISLAMIC DA'WA ACADEMY</h1>
            <p className="text-emerald-400 font-medium tracking-[0.2em] uppercase text-sm">Odd Semester Exam Result - 2026</p>
            <div className="mt-6 flex flex-wrap justify-center gap-6 text-sm">
              <div className="bg-white/10 px-4 py-2 rounded-full border border-white/20">
                <span className="text-white/60 mr-2">AdNo:</span> {student.adNo}
              </div>
              <div className="bg-white/10 px-4 py-2 rounded-full border border-white/20">
                <span className="text-white/60 mr-2">Name:</span> {student.name}
              </div>
              <div className="bg-white/10 px-4 py-2 rounded-full border border-white/20">
                <span className="text-white/60 mr-2">Class:</span> {student.className}
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Table */}
            <div className="lg:col-span-2">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 text-xs font-bold uppercase tracking-wider">
                    <th className="px-4 py-3 border-b text-left">Subject</th>
                    <th className="px-4 py-3 border-b text-center">TA</th>
                    <th className="px-4 py-3 border-b text-center">CE</th>
                    <th className="px-4 py-3 border-b text-center">Total</th>
                    <th className="px-4 py-3 border-b text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {SUBJECTS.map(s => {
                    const m = student.marks[s.id];
                    return (
                      <tr key={s.id} className="hover:bg-slate-50/50">
                        <td className="px-4 py-3">
                          <div className="font-medium text-slate-800">{s.name}</div>
                          {s.arabicName && <div className="arabic-text text-sm text-slate-500">{s.arabicName}</div>}
                        </td>
                        <td className="px-4 py-3 text-center text-slate-600 font-mono">{m?.ta ?? '-'}</td>
                        <td className="px-4 py-3 text-center text-slate-600 font-mono">{m?.ce ?? '-'}</td>
                        <td className="px-4 py-3 text-center font-bold text-slate-800">{m?.total ?? '-'}</td>
                        <td className="px-4 py-3 text-center">
                          {m ? (
                            <span className={`text-[10px] font-bold px-2 py-1 rounded-full uppercase ${m.status === 'Passed' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                              {m.status}
                            </span>
                          ) : '-'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Summary Panel */}
            <div className="space-y-6">
              <div className="bg-slate-50 rounded-2xl p-6 border border-slate-200">
                <h4 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4">Performance Overview</h4>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-600">Grand Total</span>
                    <span className="text-2xl font-bold text-slate-900">{student.grandTotal} / 1300</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-600">Average Percentage</span>
                    <span className="text-xl font-bold text-emerald-600">{student.average.toFixed(2)}%</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-600">Class Rank</span>
                    <span className="text-xl font-bold text-amber-600">#{student.rank}</span>
                  </div>
                  <div className="flex justify-between items-center pt-2 border-t border-slate-200">
                    <span className="text-slate-600">Result Status</span>
                    <span className={`font-bold px-3 py-1 rounded-lg ${student.performanceLevel === 'Failed' ? 'bg-red-600 text-white' : 'bg-emerald-600 text-white'}`}>
                      {student.performanceLevel}
                    </span>
                  </div>
                </div>
              </div>

              {/* AI Insights */}
              <div className="bg-emerald-50 rounded-2xl p-6 border border-emerald-100">
                <div className="flex items-center gap-2 mb-3">
                  <i className="fa-solid fa-brain text-emerald-600"></i>
                  <h4 className="text-sm font-bold text-emerald-800 uppercase tracking-widest">Faculty Insights (AI)</h4>
                </div>
                <p className={`text-sm text-emerald-900 leading-relaxed italic ${isAnalyzing ? 'animate-pulse' : ''}`}>
                  "{remarks}"
                </p>
                <div className="mt-4 flex items-center gap-2 text-[10px] text-emerald-600 font-bold uppercase tracking-widest">
                  <i className="fa-solid fa-circle-check"></i>
                  Validated Academic Feedback
                </div>
              </div>

              <button 
                onClick={() => window.print()}
                className="w-full bg-slate-800 hover:bg-slate-900 text-white py-3 rounded-xl font-bold transition-all flex items-center justify-center gap-2 shadow-lg"
              >
                <i className="fa-solid fa-print"></i>
                Print Score Card
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StudentScorecard;
