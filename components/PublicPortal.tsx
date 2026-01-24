
import React, { useState } from 'react';
import { StudentRecord, SubjectConfig } from '../types';
import { CLASSES } from '../constants';

interface PublicPortalProps {
  students: StudentRecord[];
  subjects: SubjectConfig[];
  onLoginClick: () => void;
}

const PublicPortal: React.FC<PublicPortalProps> = ({ students, subjects, onLoginClick }) => {
  const [searchAdNo, setSearchAdNo] = useState('');
  const [searchClass, setSearchClass] = useState(CLASSES[0]);
  const [result, setResult] = useState<StudentRecord | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const found = students.find(s => s.adNo === searchAdNo && s.className === searchClass);
    setResult(found || null);
    setHasSearched(true);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <nav className="bg-white border-b border-slate-200 px-6 py-4 flex justify-between items-center sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="bg-emerald-600 text-white p-2 rounded-lg">
            <i className="fa-solid fa-graduation-cap text-xl"></i>
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-800 leading-tight">ISLAMIC DA'WA ACADEMY</h1>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Student Result Portal</p>
          </div>
        </div>
        <button 
          onClick={onLoginClick}
          className="text-xs font-bold text-slate-400 hover:text-emerald-600 transition-colors uppercase tracking-widest flex items-center gap-2"
        >
          <i className="fa-solid fa-lock"></i>
          Faculty Login
        </button>
      </nav>

      <main className="flex-1 container mx-auto px-4 py-12 flex flex-col items-center">
        <div className="w-full max-w-xl text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-black text-slate-900 mb-4">Check Your Results</h2>
          <p className="text-slate-500">Enter your official Admission Number and select your Class to view your semester performance report.</p>
        </div>

        <div className="w-full max-w-xl bg-white rounded-3xl shadow-xl shadow-slate-200 border border-slate-100 p-8">
          <form onSubmit={handleSearch} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Admission No</label>
                <div className="relative">
                  <i className="fa-solid fa-hashtag absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"></i>
                  <input 
                    type="text"
                    placeholder="e.g. 138"
                    required
                    value={searchAdNo}
                    onChange={(e) => setSearchAdNo(e.target.value)}
                    className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Class</label>
                <div className="relative">
                  <i className="fa-solid fa-school absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"></i>
                  <select 
                    value={searchClass}
                    onChange={(e) => setSearchClass(e.target.value)}
                    className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all appearance-none"
                  >
                    {CLASSES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>
            </div>
            <button 
              type="submit"
              className="w-full bg-slate-900 hover:bg-slate-800 text-white py-4 rounded-2xl font-bold shadow-lg shadow-slate-200 transition-all transform hover:-translate-y-0.5 active:translate-y-0"
            >
              Get My Result
            </button>
          </form>
        </div>

        {hasSearched && (
          <div className="w-full max-w-4xl mt-16 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {result ? (
              <div className="bg-white rounded-3xl overflow-hidden shadow-2xl border border-slate-200">
                <div className="bg-emerald-600 p-8 text-white flex justify-between items-center flex-wrap gap-4">
                  <div>
                    <h3 className="text-2xl font-bold">{result.name}</h3>
                    <p className="opacity-80 font-medium">Class: {result.className} | AdNo: {result.adNo}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] uppercase font-black tracking-widest opacity-60">Final Status</p>
                    <p className="text-2xl font-black">{result.performanceLevel}</p>
                  </div>
                </div>
                <div className="p-8">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                      <p className="text-[10px] uppercase font-bold text-slate-400 mb-1">Grand Total</p>
                      <p className="text-2xl font-black text-slate-800">{result.grandTotal} <span className="text-xs text-slate-400 font-normal">/ 1300</span></p>
                    </div>
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                      <p className="text-[10px] uppercase font-bold text-slate-400 mb-1">Average</p>
                      <p className="text-2xl font-black text-slate-800">{result.average.toFixed(2)}%</p>
                    </div>
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                      <p className="text-[10px] uppercase font-bold text-slate-400 mb-1">Class Rank</p>
                      <p className="text-2xl font-black text-amber-500">#{result.rank}</p>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="text-[10px] uppercase text-slate-400 font-bold tracking-wider">
                          <th className="px-4 py-2 text-left">Subject</th>
                          <th className="px-4 py-2 text-center">TA</th>
                          <th className="px-4 py-2 text-center">CE</th>
                          <th className="px-4 py-2 text-center">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {subjects.map(s => {
                          const m = result.marks[s.id];
                          return (
                            <tr key={s.id}>
                              <td className="px-4 py-4">
                                <p className="font-bold text-slate-800">{s.name}</p>
                                <p className="arabic-text text-sm text-slate-400 leading-none">{s.arabicName}</p>
                              </td>
                              <td className="px-4 py-4 text-center font-mono text-slate-600">{m?.ta ?? '-'}</td>
                              <td className="px-4 py-4 text-center font-mono text-slate-600">{m?.ce ?? '-'}</td>
                              <td className={`px-4 py-4 text-center font-black ${m?.status === 'Failed' ? 'text-red-500' : 'text-slate-800'}`}>
                                {m?.total ?? '-'}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center p-12 bg-white rounded-3xl border-2 border-dashed border-slate-200">
                <i className="fa-solid fa-search text-4xl text-slate-200 mb-4"></i>
                <h3 className="text-xl font-bold text-slate-800">No Record Found</h3>
                <p className="text-slate-500 mt-2">Please verify your Admission Number and Class and try again.</p>
              </div>
            )}
          </div>
        )}
      </main>

      <footer className="bg-white border-t border-slate-200 py-8 px-6 text-center text-slate-400 text-xs">
        <p>&copy; 2024 Islamic Da'wa Academy - Academic Management System</p>
      </footer>
    </div>
  );
};

export default PublicPortal;
