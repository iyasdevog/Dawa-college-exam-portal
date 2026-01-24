
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

  const resultSubjects = result ? subjects.filter(s => s.targetClasses?.includes(result.className)) : [];

  return (
    <div className="min-h-screen bg-white flex flex-col font-inter">
      <nav className="bg-white border-b border-slate-100 px-8 py-6 flex justify-between items-center sticky top-0 z-50 backdrop-blur-md bg-white/80">
        <div className="flex items-center gap-4">
          <div className="bg-slate-900 text-emerald-400 p-3 rounded-2xl shadow-lg shadow-emerald-500/5">
            <i className="fa-solid fa-shield-halved text-xl"></i>
          </div>
          <div>
            <h1 className="text-xl font-black text-slate-900 tracking-tighter leading-none">ISLAMIC DA'WA ACADEMY</h1>
            <p className="text-[9px] text-slate-400 font-black uppercase tracking-[0.3em] mt-1">Official Result Authority</p>
          </div>
        </div>
        <button 
          onClick={onLoginClick}
          className="text-[10px] font-black text-slate-400 hover:text-slate-900 transition-all uppercase tracking-widest flex items-center gap-2 border border-slate-100 px-4 py-2 rounded-xl"
        >
          <i className="fa-solid fa-lock text-xs"></i> Faculty Access
        </button>
      </nav>

      <main className="flex-1 container mx-auto px-6 py-20 flex flex-col items-center">
        <div className="w-full max-w-2xl text-center mb-16">
          <h2 className="text-5xl font-black text-slate-900 tracking-tighter mb-6">Transparency in Excellence.</h2>
          <p className="text-slate-500 text-lg">Verify your academic progress. Enter your unique credentials below to unlock your digital score certificate.</p>
        </div>

        <div className="w-full max-w-xl bg-white rounded-[2.5rem] shadow-2xl shadow-slate-200/50 border border-slate-100 p-10">
          <form onSubmit={handleSearch} className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Admission Index</label>
                <div className="relative">
                  <i className="fa-solid fa-fingerprint absolute left-5 top-1/2 -translate-y-1/2 text-slate-300"></i>
                  <input 
                    type="text"
                    placeholder="e.g. 138"
                    required
                    value={searchAdNo}
                    onChange={(e) => setSearchAdNo(e.target.value)}
                    className="w-full pl-14 pr-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all font-bold text-slate-800"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Academic Unit</label>
                <div className="relative">
                  <i className="fa-solid fa-layer-group absolute left-5 top-1/2 -translate-y-1/2 text-slate-300"></i>
                  <select 
                    value={searchClass}
                    onChange={(e) => setSearchClass(e.target.value)}
                    className="w-full pl-14 pr-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all appearance-none font-bold text-slate-800"
                  >
                    {CLASSES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>
            </div>
            <button 
              type="submit"
              className="w-full bg-slate-900 hover:bg-slate-800 text-white py-5 rounded-2xl font-black uppercase text-xs tracking-[0.2em] shadow-xl shadow-slate-200 transition-all transform hover:-translate-y-1 active:scale-[0.98]"
            >
              Verify Credentials
            </button>
          </form>
        </div>

        {hasSearched && (
          <div className="w-full max-w-4xl mt-24 animate-in fade-in slide-in-from-bottom-8 duration-700">
            {result ? (
              <div className="bg-white rounded-[3rem] overflow-hidden shadow-2xl border border-slate-200 flex flex-col">
                <div className="bg-slate-900 p-12 text-white flex justify-between items-center flex-wrap gap-8">
                  <div>
                    <h3 className="text-4xl font-black tracking-tighter mb-2">{result.name}</h3>
                    <div className="flex gap-4 items-center">
                       <span className="px-3 py-1 bg-white/10 rounded-lg text-[10px] font-black tracking-widest uppercase">{result.className}</span>
                       <span className="text-emerald-400 font-bold text-sm"># {result.adNo}</span>
                    </div>
                  </div>
                  <div className="text-right flex flex-col items-end">
                    <span className="text-[9px] uppercase font-black tracking-[0.3em] text-white/40 mb-2">Final Certification</span>
                    <span className={`text-4xl font-black px-6 py-2 rounded-2xl ${result.performanceLevel === 'Failed' ? 'bg-red-500' : 'bg-emerald-500'}`}>
                      {result.performanceLevel}
                    </span>
                  </div>
                </div>
                <div className="p-12">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
                    <div className="bg-slate-50 p-8 rounded-[2rem] border border-slate-100 group hover:bg-slate-900 transition-all duration-500">
                      <p className="text-[10px] uppercase font-black text-slate-400 mb-2 group-hover:text-emerald-400 transition-colors">Point Aggregate</p>
                      <p className="text-4xl font-black text-slate-900 group-hover:text-white transition-colors">{result.grandTotal} <span className="text-xs opacity-30 font-normal group-hover:opacity-100">Total</span></p>
                    </div>
                    <div className="bg-slate-50 p-8 rounded-[2rem] border border-slate-100 group hover:bg-emerald-600 transition-all duration-500">
                      <p className="text-[10px] uppercase font-black text-slate-400 mb-2 group-hover:text-white transition-colors">Percentage Score</p>
                      <p className="text-4xl font-black text-slate-900 group-hover:text-white transition-colors">{result.average.toFixed(2)}%</p>
                    </div>
                    <div className="bg-slate-50 p-8 rounded-[2rem] border border-slate-100 group hover:bg-amber-500 transition-all duration-500">
                      <p className="text-[10px] uppercase font-black text-slate-400 mb-2 group-hover:text-white transition-colors">Academy Rank</p>
                      <p className="text-4xl font-black text-amber-500 group-hover:text-white transition-colors"># {result.rank}</p>
                    </div>
                  </div>

                  {resultSubjects.length > 0 ? (
                    <div className="overflow-x-auto rounded-[2rem] border border-slate-100">
                      <table className="w-full border-collapse">
                        <thead>
                          <tr className="text-[10px] uppercase text-slate-400 font-black tracking-[0.2em] bg-slate-50/50">
                            <th className="px-8 py-6 text-left">Academic Unit</th>
                            <th className="px-6 py-6 text-center">Assessment (TA)</th>
                            <th className="px-6 py-6 text-center">Exam (CE)</th>
                            <th className="px-6 py-6 text-center">Aggregate</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          {resultSubjects.map(s => {
                            const m = result.marks[s.id];
                            return (
                              <tr key={s.id} className="hover:bg-slate-50/50 transition-colors">
                                <td className="px-8 py-6">
                                  <p className="font-black text-slate-800 text-lg tracking-tight">{s.name}</p>
                                  <p className="arabic-text text-xl text-emerald-600 leading-none mt-1">{s.arabicName}</p>
                                </td>
                                <td className="px-6 py-6 text-center font-mono font-bold text-slate-500">{m?.ta ?? '-'}</td>
                                <td className="px-6 py-6 text-center font-mono font-bold text-slate-500">{m?.ce ?? '-'}</td>
                                <td className={`px-6 py-6 text-center font-black text-2xl ${m?.status === 'Failed' ? 'text-red-500' : 'text-slate-900'}`}>
                                  {m?.total ?? '-'}
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="p-12 text-center bg-slate-50 rounded-[2rem] border border-dashed border-slate-200">
                       <p className="text-slate-400 font-bold uppercase text-xs tracking-widest">No detailed marksheet available for this curriculum level.</p>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-center p-20 bg-white rounded-[3rem] border-2 border-dashed border-slate-200">
                <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-8 text-slate-300">
                   <i className="fa-solid fa-magnifying-glass text-3xl"></i>
                </div>
                <h3 className="text-2xl font-black text-slate-900 tracking-tight">Record Not Verified</h3>
                <p className="text-slate-500 mt-3 max-w-sm mx-auto">The credentials entered do not match our database. Please check your Admission Number and try again.</p>
              </div>
            )}
          </div>
        )}
      </main>

      <footer className="bg-slate-900 py-16 px-8 text-center">
        <div className="flex items-center justify-center gap-3 mb-6 opacity-30 grayscale contrast-200">
           <i className="fa-solid fa-graduation-cap text-2xl text-white"></i>
           <span className="text-white font-black tracking-widest text-sm">EDUMARK PORTAL</span>
        </div>
        <p className="text-slate-500 text-[10px] font-bold uppercase tracking-[0.4em]">&copy; 2024 Islamic Da'wa Academy | Secure Academic Systems</p>
      </footer>
    </div>
  );
};

export default PublicPortal;
