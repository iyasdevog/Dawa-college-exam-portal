
import React, { useState } from 'react';
import { StudentRecord, SubjectConfig } from '../types';
import { CLASSES } from '../constants';

interface ClassResultsProps {
  students: StudentRecord[];
  subjects: SubjectConfig[];
}

const ClassResults: React.FC<ClassResultsProps> = ({ students, subjects }) => {
  const [selectedClass, setSelectedClass] = useState(CLASSES[0]);
  const filteredStudents = students.filter(s => s.className === selectedClass);
  const classSubjects = subjects.filter(s => s.targetClasses?.includes(selectedClass));

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h3 className="text-xl font-bold text-slate-800">Class Performance Matrix</h3>
          <p className="text-sm text-slate-500">Subject-wise scores for {selectedClass}.</p>
        </div>
        <select 
          value={selectedClass} 
          onChange={(e) => setSelectedClass(e.target.value)}
          className="p-3 border border-slate-200 rounded-xl bg-white font-bold text-slate-700 outline-none focus:ring-2 focus:ring-emerald-500"
        >
          {CLASSES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-x-auto">
        {classSubjects.length > 0 ? (
          <table className="w-full text-xs text-left border-collapse min-w-[1200px]">
            <thead>
              <tr className="bg-slate-50 text-slate-400 font-black uppercase tracking-widest text-[10px]">
                <th className="px-4 py-3 border-r border-slate-100 sticky left-0 bg-slate-50 z-10" rowSpan={2}>AdNo</th>
                <th className="px-4 py-3 border-r border-slate-100 sticky left-[4.5rem] bg-slate-50 z-10 w-56" rowSpan={2}>Name</th>
                {classSubjects.map(s => (
                  <th key={s.id} className="px-3 py-2 text-center border-r border-slate-100 border-b" colSpan={3}>
                    <div className="arabic-text text-lg text-emerald-600 mb-0.5">{s.arabicName}</div>
                    <div className="text-[9px]">{s.name}</div>
                  </th>
                ))}
                <th className="px-4 py-3 border-l border-slate-100 text-center bg-slate-100 text-slate-800" rowSpan={2}>Grand Total</th>
                <th className="px-4 py-3 text-center bg-slate-100 text-slate-800" rowSpan={2}>Rank</th>
              </tr>
              <tr className="bg-white text-slate-400 uppercase font-black text-[9px] tracking-widest">
                {classSubjects.map(s => (
                  <React.Fragment key={`${s.id}-headers`}>
                    <th className="px-1 py-2 text-center border-r border-slate-50">TA</th>
                    <th className="px-1 py-2 text-center border-r border-slate-50">CE</th>
                    <th className="px-1 py-2 text-center border-r border-slate-100 bg-slate-50">TOT</th>
                  </React.Fragment>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredStudents.map(student => (
                <tr key={student.id} className="hover:bg-slate-50 transition-colors group">
                  <td className="px-4 py-3 border-r border-slate-100 font-mono text-slate-400 sticky left-0 bg-white group-hover:bg-slate-50 z-10">
                    {student.adNo}
                  </td>
                  <td className="px-4 py-3 border-r border-slate-100 font-bold text-slate-800 sticky left-[4.5rem] bg-white group-hover:bg-slate-50 z-10 w-56">
                    {student.name}
                  </td>
                  {classSubjects.map(s => {
                    const m = student.marks[s.id];
                    return (
                      <React.Fragment key={`${student.id}-${s.id}`}>
                        <td className="px-1 py-3 text-center border-r border-slate-50 text-slate-500 font-mono">{m?.ta ?? '-'}</td>
                        <td className="px-1 py-3 text-center border-r border-slate-50 text-slate-500 font-mono">{m?.ce ?? '-'}</td>
                        <td className={`px-1 py-3 text-center border-r border-slate-100 font-black font-mono ${m?.status === 'Failed' ? 'text-red-500 bg-red-50/50' : 'text-slate-800 bg-emerald-50/30'}`}>
                          {m?.total ?? '-'}
                        </td>
                      </React.Fragment>
                    );
                  })}
                  <td className="px-4 py-3 font-black text-emerald-600 text-center border-l border-slate-100 bg-emerald-50/20">{student.grandTotal}</td>
                  <td className="px-4 py-3 font-black text-center text-slate-800 bg-amber-50/20">#{student.rank}</td>
                </tr>
              ))}
              {filteredStudents.length === 0 && (
                <tr>
                  <td colSpan={2 + (classSubjects.length * 3) + 2} className="p-12 text-center text-slate-400 font-medium">No students registered in {selectedClass}</td>
                </tr>
              )}
            </tbody>
          </table>
        ) : (
          <div className="p-20 text-center">
            <i className="fa-solid fa-folder-open text-4xl text-slate-200 mb-4"></i>
            <h4 className="text-slate-800 font-bold text-lg">No subjects configured for {selectedClass}</h4>
            <p className="text-slate-500 mt-2">Go to Management to assign academic units to this class level.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ClassResults;
