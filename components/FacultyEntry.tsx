import React, { useState, useEffect, useMemo } from 'react';
import { CLASSES } from '../constants';
import { StudentRecord, SubjectConfig, SubjectMarks } from '../types';
import { dbService } from '../services/dbService.ts';

interface FacultyEntryProps {
  students: StudentRecord[];
  subjects: SubjectConfig[];
  onUpdateMarks: React.Dispatch<React.SetStateAction<StudentRecord[]>>;
}

const FacultyEntry: React.FC<FacultyEntryProps> = ({ students, subjects, onUpdateMarks }) => {
  const [selectedClass, setSelectedClass] = useState(CLASSES[0]);
  const [selectedSubjectId, setSelectedSubjectId] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [tempMarks, setTempMarks] = useState<Record<string, { ta: string; ce: string }>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [syncProgress, setSyncProgress] = useState(0);

  const classSubjects = useMemo(() => subjects.filter(s => s.targetClasses?.includes(selectedClass)), [subjects, selectedClass]);
  const selectedSubject = useMemo(() => classSubjects.find(s => s.id === selectedSubjectId) || classSubjects[0], [classSubjects, selectedSubjectId]);
  
  const filteredStudents = useMemo(() => {
    return students
      .filter(s => s.className === selectedClass)
      .filter(s => 
        s.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
        s.adNo.includes(searchTerm)
      )
      .sort((a, b) => a.adNo.localeCompare(b.adNo, undefined, { numeric: true }));
  }, [students, selectedClass, searchTerm]);

  useEffect(() => {
    if (classSubjects.length > 0) {
      if (!classSubjects.find(s => s.id === selectedSubjectId)) {
        setSelectedSubjectId(classSubjects[0].id);
      }
    } else {
      setSelectedSubjectId('');
    }
  }, [classSubjects, selectedSubjectId]);

  useEffect(() => {
    if (saveStatus !== 'idle') {
      const timer = setTimeout(() => {
        setSaveStatus('idle');
        setSyncProgress(0);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [saveStatus]);

  const handleInputChange = (studentId: string, field: 'ta' | 'ce', value: string) => {
    setTempMarks(prev => ({
      ...prev,
      [studentId]: {
        ...prev[studentId] || { ta: '', ce: '' },
        [field]: value
      }
    }));
  };

  const saveAllMarks = async () => {
    if (!selectedSubject) return;
    setIsSaving(true);
    setSyncProgress(10);

    // FIX: Explicitly cast Object.entries to fix 'Property ta does not exist on type unknown' error
    const changedEntries = (Object.entries(tempMarks) as [string, { ta: string; ce: string }][]).filter(
      ([_, entry]) => entry.ta !== '' || entry.ce !== ''
    );

    if (changedEntries.length === 0) {
      setIsSaving(false);
      return;
    }

    try {
      // 1. Update Local State first for immediate UI feedback
      onUpdateMarks(prevStudents => {
        return prevStudents.map(student => {
          if (student.className !== selectedClass) return student;
          
          // Cast tempMarks entry to fix unknown type property access error
          const entry = tempMarks[student.id] as { ta: string; ce: string } | undefined;
          if (!entry || (entry.ta === '' && entry.ce === '')) return student;

          const ta = entry.ta === '' ? (student.marks[selectedSubject.id]?.ta || 0) : parseFloat(entry.ta);
          const ce = entry.ce === '' ? (student.marks[selectedSubject.id]?.ce || 0) : parseFloat(entry.ce);
          
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
      });

      // 2. Granular Cloud Update
      let completedCount = 0;
      // Cast loop entry to avoid unknown type error on 'ta' and 'ce' properties
      for (const [studentId, entryVal] of (changedEntries as [string, { ta: string; ce: string }][])) {
        const student = students.find(s => s.id === studentId);
        if (student) {
          const entry = entryVal;
          const ta = entry.ta === '' ? (student.marks[selectedSubject.id]?.ta || 0) : parseFloat(entry.ta);
          const ce = entry.ce === '' ? (student.marks[selectedSubject.id]?.ce || 0) : parseFloat(entry.ce);
          const total = ta + ce;
          const status = total >= selectedSubject.passingTotal ? 'Passed' : 'Failed';

          const marksToUpdate: Record<string, SubjectMarks> = {
            ...student.marks,
            [selectedSubject.id]: { ta, ce, total, status }
          };

          await dbService.updateStudentMarks(studentId, marksToUpdate);
          completedCount++;
          setSyncProgress(10 + Math.floor((completedCount / changedEntries.length) * 90));
        }
      }

      setTempMarks({});
      setSaveStatus('success');
    } catch (e) {
      console.error("Sync Error:", e);
      setSaveStatus('error');
    } finally {
      setIsSaving(false);
    }
  };

  if (subjects.length === 0) {
    return (
      <div className="bg-amber-50 border border-amber-200 p-12 rounded-[2rem] text-center max-w-2xl mx-auto mt-10">
        <h3 className="text-2xl font-black text-amber-900">Academic Registry Empty</h3>
        <p className="text-amber-700 mt-2">Please define subjects in Management to begin entry.</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-32">
      <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-slate-200">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Academic Grade</label>
            <select value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none focus:ring-2 focus:ring-emerald-500">
              {CLASSES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Target Subject</label>
            <select value={selectedSubjectId} onChange={(e) => setSelectedSubjectId(e.target.value)} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none focus:ring-2 focus:ring-emerald-500" disabled={classSubjects.length === 0}>
              {classSubjects.length > 0 ? classSubjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>) : <option value="">No subjects assigned</option>}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Quick Search</label>
            <input type="text" placeholder="Name or AdNo..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none focus:ring-2 focus:ring-emerald-500" />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-[2rem] shadow-sm border border-slate-200 overflow-hidden">
        {selectedSubject ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left min-w-[700px]">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 text-slate-400 uppercase text-[10px] font-black tracking-widest">
                  <th className="px-8 py-5">AD No</th>
                  <th className="px-8 py-5">Student Name</th>
                  <th className="px-8 py-5 text-center">TA (Max: {selectedSubject.maxTA})</th>
                  <th className="px-8 py-5 text-center">CE (Max: {selectedSubject.maxCE})</th>
                  <th className="px-8 py-5 text-right">Current Cloud Mark</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filteredStudents.map(student => {
                  const currentMarks = student.marks[selectedSubject.id];
                  return (
                    <tr key={student.id} className="hover:bg-slate-50/30 group">
                      <td className="px-8 py-5 font-mono text-sm text-slate-400">{student.adNo}</td>
                      <td className="px-8 py-5 font-bold text-slate-800 uppercase">{student.name}</td>
                      <td className="px-8 py-5 text-center">
                        <input 
                          type="number" 
                          max={selectedSubject.maxTA}
                          placeholder={currentMarks?.ta.toString() || '0'} 
                          value={tempMarks[student.id]?.ta ?? ''} 
                          onChange={(e) => handleInputChange(student.id, 'ta', e.target.value)} 
                          className="w-20 p-2 border border-slate-200 rounded-xl text-center font-bold outline-none focus:ring-2 focus:ring-emerald-500" 
                        />
                      </td>
                      <td className="px-8 py-5 text-center">
                        <input 
                          type="number" 
                          max={selectedSubject.maxCE}
                          placeholder={currentMarks?.ce.toString() || '0'} 
                          value={tempMarks[student.id]?.ce ?? ''} 
                          onChange={(e) => handleInputChange(student.id, 'ce', e.target.value)} 
                          className="w-20 p-2 border border-slate-200 rounded-xl text-center font-bold outline-none focus:ring-2 focus:ring-emerald-500" 
                        />
                      </td>
                      <td className="px-8 py-5 text-right font-mono text-xs text-slate-400">
                        {currentMarks ? (
                          <span className="bg-slate-100 px-3 py-1 rounded-full">{currentMarks.total} pts</span>
                        ) : (
                          <span className="italic">Not Set</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-20 text-center text-slate-400 italic">Select subject to begin entry.</div>
        )}
      </div>

      {selectedSubject && filteredStudents.length > 0 && (
        <div className="fixed bottom-10 right-10 z-30 flex items-center gap-4">
          {saveStatus === 'success' && (
            <div className="bg-emerald-500 text-white px-6 py-4 rounded-2xl font-bold text-xs animate-in slide-in-from-right-full flex items-center gap-2 shadow-lg">
              <i className="fa-solid fa-check-circle"></i>
              Cloud Records Updated
            </div>
          )}
          {saveStatus === 'error' && (
            <div className="bg-red-500 text-white px-6 py-4 rounded-2xl font-bold text-xs animate-in slide-in-from-right-full flex items-center gap-2 shadow-lg">
              <i className="fa-solid fa-circle-exclamation"></i>
              Cloud Sync Error - Check Connection
            </div>
          )}
          
          <div className="relative group">
            {isSaving && (
               <div className="absolute -top-12 left-0 w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                  <div className="bg-emerald-500 h-full transition-all duration-300" style={{ width: `${syncProgress}%` }}></div>
               </div>
            )}
            <button 
              disabled={isSaving}
              onClick={saveAllMarks} 
              className={`bg-slate-900 hover:bg-slate-800 text-white px-10 py-5 rounded-[2rem] font-black uppercase text-xs tracking-widest shadow-2xl transition-all flex items-center gap-4 ${isSaving ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {isSaving ? (
                <i className="fa-solid fa-circle-notch animate-spin text-emerald-400"></i>
              ) : (
                <i className="fa-solid fa-cloud-arrow-up text-emerald-400"></i>
              )}
              {isSaving ? `Syncing (${syncProgress}%)` : 'Commit Class Results'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default FacultyEntry;