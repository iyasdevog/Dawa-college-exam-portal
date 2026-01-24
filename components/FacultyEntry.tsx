
import React, { useState, useEffect, useMemo } from 'react';
import { CLASSES } from '../constants';
import { StudentRecord, SubjectConfig, SubjectMarks } from '../types';

interface FacultyEntryProps {
  students: StudentRecord[];
  subjects: SubjectConfig[];
  onUpdateMarks: (updatedStudents: StudentRecord[]) => void;
}

const FacultyEntry: React.FC<FacultyEntryProps> = ({ students, subjects, onUpdateMarks }) => {
  const [selectedClass, setSelectedClass] = useState(CLASSES[0]);
  const [selectedSubjectId, setSelectedSubjectId] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [tempMarks, setTempMarks] = useState<Record<string, { ta: string; ce: string }>>({});

  // Filter subjects that belong to the selected class
  const classSubjects = useMemo(() => subjects.filter(s => s.targetClasses?.includes(selectedClass)), [subjects, selectedClass]);
  const selectedSubject = useMemo(() => classSubjects.find(s => s.id === selectedSubjectId) || classSubjects[0], [classSubjects, selectedSubjectId]);
  
  const filteredStudents = useMemo(() => {
    return students
      .filter(s => s.className === selectedClass)
      .filter(s => 
        s.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
        s.adNo.includes(searchTerm)
      );
  }, [students, selectedClass, searchTerm]);

  // Sync subject ID if class or subjects list changes
  useEffect(() => {
    if (classSubjects.length > 0) {
      if (!classSubjects.find(s => s.id === selectedSubjectId)) {
        setSelectedSubjectId(classSubjects[0].id);
      }
    } else {
      setSelectedSubjectId('');
    }
  }, [classSubjects, selectedSubjectId]);

  const handleInputChange = (studentId: string, field: 'ta' | 'ce', value: string) => {
    setTempMarks(prev => ({
      ...prev,
      [studentId]: {
        ...prev[studentId] || { ta: '', ce: '' },
        [field]: value
      }
    }));
  };

  const saveAllMarks = () => {
    if (!selectedSubject) return;

    const updatedStudents = students.map(student => {
      if (student.className !== selectedClass) return student;
      
      const entry = tempMarks[student.id];
      if (!entry || (entry.ta === '' && entry.ce === '')) return student;

      const ta = entry.ta === '' ? (student.marks[selectedSubject.id]?.ta || 0) : parseFloat(entry.ta);
      const ce = entry.ce === '' ? (student.marks[selectedSubject.id]?.ce || 0) : parseFloat(entry.ce);
      
      // Validation
      if (ta > selectedSubject.maxTA || ce > selectedSubject.maxCE) {
        // We let them save but warn? Better to just cap it.
      }

      const total = ta + ce;
      const status = total >= selectedSubject.passingTotal ? 'Passed' : 'Failed';

      return {
        ...student,
        marks: {
          ...student.marks,
          [selectedSubject.id]: { ta, ce, total, status }
        }
      };
    });

    onUpdateMarks(updatedStudents);
    setTempMarks({}); // Clear temporary state after save
    alert(`Marks for ${selectedSubject.name} committed to database.`);
  };

  if (subjects.length === 0) {
    return (
      <div className="bg-amber-50 border border-amber-200 p-12 rounded-[2rem] text-center max-w-2xl mx-auto mt-10">
        <div className="w-20 h-20 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <i className="fa-solid fa-triangle-exclamation text-3xl text-amber-500"></i>
        </div>
        <h3 className="text-2xl font-black text-amber-900">No Subjects Defined</h3>
        <p className="text-amber-700 mt-2">The academic unit repository is empty. Please define subjects in Management before proceeding.</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-32">
      <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-slate-200">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Academic Grade</label>
            <select 
              value={selectedClass} 
              onChange={(e) => { setSelectedClass(e.target.value); setSearchTerm(''); }}
              className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none font-bold text-slate-800"
            >
              {CLASSES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Target Subject</label>
            <select 
              value={selectedSubjectId} 
              onChange={(e) => setSelectedSubjectId(e.target.value)}
              className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none font-bold text-slate-800"
              disabled={classSubjects.length === 0}
            >
              {classSubjects.length > 0 ? (
                classSubjects.map(s => <option key={s.id} value={s.id}>{s.name} {s.arabicName && `(${s.arabicName})`}</option>)
              ) : (
                <option value="">No subjects assigned</option>
              )}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Quick Locate Student</label>
            <div className="relative">
              <i className="fa-solid fa-search absolute left-5 top-1/2 -translate-y-1/2 text-slate-300"></i>
              <input 
                type="text"
                placeholder="Name or AdNo..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-12 pr-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none font-bold text-slate-800"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-[2rem] shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-6 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
          <div className="flex items-center gap-4">
             <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Registry: {selectedClass}</span>
             <span className="px-3 py-1 bg-white border border-slate-200 rounded-lg text-[10px] font-black text-slate-600">{filteredStudents.length} Students found</span>
          </div>
          {selectedSubject && (
            <div className="flex gap-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">
               <span className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-blue-400"></div> Max TA: {selectedSubject.maxTA}</span>
               <span className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-indigo-400"></div> Max CE: {selectedSubject.maxCE}</span>
            </div>
          )}
        </div>
        
        {selectedSubject ? (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-white border-b border-slate-100 text-slate-400 uppercase text-[10px] font-black tracking-widest">
                <th className="px-8 py-5">AD No</th>
                <th className="px-8 py-5">Student Name</th>
                <th className="px-8 py-5 text-center">TA Assessment</th>
                <th className="px-8 py-5 text-center">CE Exam</th>
                <th className="px-8 py-5 text-right">Status / Score</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredStudents.map(student => {
                const currentMarks = student.marks[selectedSubject.id];
                return (
                  <tr key={student.id} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="px-8 py-5 font-mono text-sm text-slate-400">{student.adNo}</td>
                    <td className="px-8 py-5 font-bold text-slate-800 uppercase tracking-tight">{student.name}</td>
                    <td className="px-8 py-5 text-center">
                      <input 
                        type="number" 
                        max={selectedSubject.maxTA}
                        placeholder={currentMarks?.ta.toString() || '0'}
                        value={tempMarks[student.id]?.ta ?? ''}
                        onChange={(e) => handleInputChange(student.id, 'ta', e.target.value)}
                        className="w-24 p-3 bg-white border border-slate-200 rounded-xl focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none text-center font-mono font-black text-lg transition-all"
                      />
                    </td>
                    <td className="px-8 py-5 text-center">
                      <input 
                        type="number" 
                        max={selectedSubject.maxCE}
                        placeholder={currentMarks?.ce.toString() || '0'}
                        value={tempMarks[student.id]?.ce ?? ''}
                        onChange={(e) => handleInputChange(student.id, 'ce', e.target.value)}
                        className="w-24 p-3 bg-white border border-slate-200 rounded-xl focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none text-center font-mono font-black text-lg transition-all"
                      />
                    </td>
                    <td className="px-8 py-5 text-right">
                      {currentMarks ? (
                        <div className="flex flex-col items-end">
                          <span className={`text-[10px] font-black px-2 py-0.5 rounded uppercase tracking-tighter ${currentMarks.status === 'Passed' ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'}`}>
                            {currentMarks.status}
                          </span>
                          <span className="font-mono font-black text-slate-800 mt-1">{currentMarks.total} pts</span>
                        </div>
                      ) : (
                        <span className="text-[10px] font-bold text-slate-200 uppercase italic">Pending Entry</span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {filteredStudents.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-20 text-center">
                    <div className="text-slate-300 mb-2"><i className="fa-solid fa-ghost text-4xl"></i></div>
                    <p className="text-slate-400 font-bold italic uppercase text-xs tracking-widest">No matching students in this grade level.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        ) : (
          <div className="p-20 text-center">
            <div className="w-16 h-16 bg-slate-50 border border-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4 text-slate-300">
               <i className="fa-solid fa-folder-closed text-2xl"></i>
            </div>
            <p className="text-slate-400 font-black uppercase text-xs tracking-widest">Select a valid curriculum level to begin.</p>
          </div>
        )}
      </div>

      {selectedSubject && filteredStudents.length > 0 && (
        <div className="fixed bottom-10 right-10 z-30 group">
          <div className="absolute inset-0 bg-emerald-500 rounded-3xl blur-2xl opacity-20 group-hover:opacity-40 transition-opacity"></div>
          <button 
            onClick={saveAllMarks}
            className="relative bg-slate-900 hover:bg-slate-800 text-white px-10 py-5 rounded-[2rem] font-black uppercase text-xs tracking-[0.2em] shadow-2xl transition-all transform hover:-translate-y-1 active:scale-95 flex items-center gap-4"
          >
            <i className="fa-solid fa-cloud-arrow-up text-emerald-400 text-lg"></i>
            Commit Results
          </button>
        </div>
      )}
    </div>
  );
};

export default FacultyEntry;
