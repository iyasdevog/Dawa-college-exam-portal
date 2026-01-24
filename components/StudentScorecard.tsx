
import React, { useState, useEffect } from 'react';
import { StudentRecord, SubjectConfig } from '../types';
import { analyzePerformance } from '../services/aiService';

interface StudentScorecardProps {
  students: StudentRecord[];
  subjects: SubjectConfig[];
}

const StudentScorecard: React.FC<StudentScorecardProps> = ({ students, subjects }) => {
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(students[0]?.id || null);
  const [remarks, setRemarks] = useState<string>('Loading AI Analysis...');
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const student = students.find(s => s.id === selectedStudentId);

  useEffect(() => {
    if (student) {
      const getAiRemarks = async () => {
        setIsAnalyzing(true);
        setRemarks('Consulting Academic AI...');
        const feedback = await analyzePerformance(student);
        setRemarks(feedback);
        setIsAnalyzing(false);
      };
      getAiRemarks();
    }
  }, [selectedStudentId]);

  if (!student) return <div className="p-12 text-center text-slate-400 font-bold">No students found. Add students in Management.</div>;

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-20">
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Individual Student Insight</label>
        <select 
          value={selectedStudentId || ''} 
          onChange={(e) => setSelectedStudentId(e.target.value)}
          className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none font-bold text-slate-800 shadow-inner"
        >
          {students.map(s => <option key={s.id} value={s.id}>{s.adNo} - {s.name} ({s.className})</option>)}
        </select>
      </div>

      <div className="bg-white shadow-2xl rounded-3xl overflow-hidden border border-slate-200 print:shadow-none print:border-none animate-in zoom-in duration-300">
        <div className="bg-slate-900 text-white p-10 text-center relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-full opacity-5 flex items-center justify-center pointer-events-none">
             <i className="fa-solid fa-graduation-cap text-[20rem]"></i>
          </div>
          <div className="relative z-10">
            <h1 className="text-4xl font-black tracking-tighter mb-2">ISLAMIC DA'WA ACADEMY</h1>
            <p className="text-emerald-400 font-bold tracking-[0.3em] uppercase text-[10px] mb-8">Official Academic Performance Certificate</p>
            <div className="flex flex-wrap justify-center gap-4 text-xs">
              <div className="bg-white/10 px-5 py-2.5 rounded-2xl border border-white/10 backdrop-blur-md">
                <span className="text-white/40 uppercase font-black mr-2">AdNo</span> <span className="font-bold">{student.adNo}</span>
              </div>
              <div className="bg-white/10 px-5 py-2.5 rounded-2xl border border-white/10 backdrop-blur-md">
                <span className="text-white/40 uppercase font-black mr-2">Student</span> <span className="font-bold uppercase">{student.name}</span>
              </div>
              <div className="bg-white/10 px-5 py-2.5 rounded-2xl border border-white/10 backdrop-blur-md">
                <span className="text-white/40 uppercase font-black mr-2">Registry</span> <span className="font-bold">{student.className}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="p-10">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
            <div className="lg:col-span-2">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="text-slate-400 text-[10px] font-black uppercase tracking-[0.2em]">
                    <th className="px-4 py-4 border-b border-slate-100 text-left">Academic Unit</th>
                    <th className="px-4 py-4 border-b border-slate-100 text-center">TA</th>
                    <th className="px-4 py-4 border-b border-slate-100 text-center">CE</th>
                    <th className="px-4 py-4 border-b border-slate-100 text-center">TOT</th>
                    <th className="px-4 py-4 border-b border-slate-100 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {subjects.map(s => {
                    const m = student.marks[s.id];
                    return (
                      <tr key={s.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-4 py-4">
                          <div className="font-bold text-slate-800 leading-tight">{s.name}</div>
                          {s.arabicName && <div className="arabic-text text-base text-emerald-600 mt-0.5">{s.arabicName}</div>}
                        </td>
                        <td className="px-4 py-4 text-center text-slate-500 font-mono font-medium">{m?.ta ?? '-'}</td>
                        <td className="px-4 py-4 text-center text-slate-500 font-mono font-medium">{m?.ce ?? '-'}</td>
                        <td className="px-4 py-4 text-center font-black text-slate-900 font-mono text-lg">{m?.total ?? '-'}</td>
                        <td className="px-4 py-4 text-center">
                          {m ? (
                            <span className={`text-[9px] font-black px-2 py-1 rounded-md uppercase tracking-tighter ${m.status === 'Passed' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                              {m.status}
                            </span>
                          ) : <span className="text-[9px] font-bold text-slate-200 uppercase">N/A</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="space-y-8">
              <div className="bg-slate-900 rounded-3xl p-8 text-white shadow-xl shadow-slate-200">
                <h4 className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-6">Metrics Summary</h4>
                <div className="space-y-6">
                  <div>
                    <span className="text-[10px] text-white/50 uppercase font-bold block mb-1">Cumulative Points</span>
                    <span className="text-3xl font-black">{student.grandTotal} <span className="text-xs text-white/30 font-normal">Total</span></span>
                  </div>
                  <div>
                    <span className="text-[10px] text-white/50 uppercase font-bold block mb-1">Average Grade</span>
                    <span className="text-2xl font-black text-emerald-400">{student.average.toFixed(2)}%</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex-1">
                      <span className="text-[10px] text-white/50 uppercase font-bold block mb-1">Class Rank</span>
                      <span className="text-2xl font-black text-amber-400">#{student.rank}</span>
                    </div>
                    <div className={`px-4 py-2 rounded-2xl font-black text-xs uppercase tracking-widest ${student.performanceLevel === 'Failed' ? 'bg-red-500' : 'bg-emerald-500'}`}>
                      {student.performanceLevel}
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-emerald-50 rounded-3xl p-8 border border-emerald-100 relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-125 transition-transform">
                   <i className="fa-solid fa-bolt text-4xl text-emerald-600"></i>
                </div>
                <div className="flex items-center gap-2 mb-4">
                  <i className="fa-solid fa-microchip text-emerald-600 text-xs"></i>
                  <h4 className="text-[10px] font-black text-emerald-800 uppercase tracking-widest">Counselor AI Insights</h4>
                </div>
                <p className={`text-sm text-emerald-900 leading-relaxed font-medium italic ${isAnalyzing ? 'animate-pulse' : ''}`}>
                  "{remarks}"
                </p>
              </div>

              <button 
                onClick={() => window.print()}
                className="w-full bg-slate-100 hover:bg-slate-200 text-slate-900 py-4 rounded-2xl font-black uppercase text-xs tracking-widest transition-all flex items-center justify-center gap-3 shadow-sm border border-slate-200"
              >
                <i className="fa-solid fa-print"></i>
                Print Academic Card
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StudentScorecard;
