
import React, { useState } from 'react';
import { StudentRecord, SubjectConfig } from '../types';
import { SUBJECTS, CLASSES } from '../constants';

interface ClassResultsProps {
  students: StudentRecord[];
}

const ClassResults: React.FC<ClassResultsProps> = ({ students }) => {
  const [selectedClass, setSelectedClass] = useState(CLASSES[0]);
  const filtered = students.filter(s => s.className === selectedClass)
    .sort((a, b) => (a.rank || 999) - (b.rank || 999));

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h3 className="text-xl font-bold text-slate-800">Master Result Sheet</h3>
        <select 
          value={selectedClass} 
          onChange={(e) => setSelectedClass(e.target.value)}
          className="p-2 border border-slate-200 rounded-lg bg-white"
        >
          {CLASSES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-x-auto">
        <table className="w-full text-xs text-left border-collapse min-w-[1200px]">
          <thead>
            <tr className="bg-slate-100 text-slate-600">
              <th className="px-3 py-2 border-r border-slate-200 sticky left-0 bg-slate-100 z-10" rowSpan={2}>AdNo</th>
              <th className="px-3 py-2 border-r border-slate-200 sticky left-[4.5rem] bg-slate-100 z-10 w-48" rowSpan={2}>Student Name</th>
              {SUBJECTS.map(s => (
                <th key={s.id} className="px-3 py-2 text-center border-r border-slate-200 border-b" colSpan={3}>
                  <div className="arabic-text text-lg">{s.arabicName}</div>
                  <div>{s.name}</div>
                </th>
              ))}
              <th className="px-3 py-2 border-l border-slate-200 text-center" rowSpan={2}>Total</th>
              <th className="px-3 py-2 text-center" rowSpan={2}>Rank</th>
            </tr>
            <tr className="bg-slate-50 text-slate-500 uppercase font-medium">
              {SUBJECTS.map(s => (
                <React.Fragment key={`${s.id}-headers`}>
                  <th className="px-1 py-1 text-center border-r border-slate-200">TA</th>
                  <th className="px-1 py-1 text-center border-r border-slate-200">CE</th>
                  <th className="px-1 py-1 text-center border-r border-slate-200 bg-slate-100">T</th>
                </React.Fragment>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {filtered.map(student => (
              <tr key={student.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-3 py-2 border-r border-slate-200 font-mono sticky left-0 bg-white group-hover:bg-slate-50 z-10">{student.adNo}</td>
                <td className="px-3 py-2 border-r border-slate-200 font-medium sticky left-[4.5rem] bg-white group-hover:bg-slate-50 z-10 w-48">{student.name}</td>
                {SUBJECTS.map(s => {
                  const m = student.marks[s.id];
                  return (
                    <React.Fragment key={`${student.id}-${s.id}`}>
                      <td className="px-1 py-2 text-center border-r border-slate-100">{m?.ta ?? '-'}</td>
                      <td className="px-1 py-2 text-center border-r border-slate-100">{m?.ce ?? '-'}</td>
                      <td className={`px-1 py-2 text-center border-r border-slate-100 font-bold ${m?.status === 'Failed' ? 'text-red-600 bg-red-50' : 'text-slate-700 bg-slate-50'}`}>
                        {m?.total ?? '-'}
                      </td>
                    </React.Fragment>
                  );
                })}
                <td className="px-3 py-2 font-bold text-emerald-600 text-center border-l border-slate-200 bg-emerald-50">{student.grandTotal}</td>
                <td className="px-3 py-2 font-bold text-center text-slate-800">{student.rank}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ClassResults;
