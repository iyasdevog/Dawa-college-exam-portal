
import React, { useState } from 'react';
import { SUBJECTS, CLASSES } from '../constants';
import { StudentRecord, SubjectMarks } from '../types';

interface FacultyEntryProps {
  students: StudentRecord[];
  onUpdateMarks: (updatedStudents: StudentRecord[]) => void;
}

const FacultyEntry: React.FC<FacultyEntryProps> = ({ students, onUpdateMarks }) => {
  const [selectedClass, setSelectedClass] = useState(CLASSES[0]);
  const [selectedSubject, setSelectedSubject] = useState(SUBJECTS[0]);
  const [tempMarks, setTempMarks] = useState<Record<string, { ta: string; ce: string }>>({});

  const filteredStudents = students.filter(s => s.className === selectedClass);

  const handleInputChange = (studentId: string, field: 'ta' | 'ce', value: string) => {
    setTempMarks(prev => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        [field]: value
      }
    }));
  };

  const saveAllMarks = () => {
    const updatedStudents = students.map(student => {
      if (student.className !== selectedClass) return student;
      
      const marks = tempMarks[student.id];
      if (!marks) return student;

      const ta = parseFloat(marks.ta) || 0;
      const ce = parseFloat(marks.ce) || 0;
      const total = ta + ce;
      const status = total >= selectedSubject.passingTotal ? 'Passed' : 'Failed';

      const updatedRecord: StudentRecord = {
        ...student,
        marks: {
          ...student.marks,
          [selectedSubject.id]: { ta, ce, total, status }
        }
      };

      // Recalculate Grand Total & Average
      const allSubjectMarks = Object.values(updatedRecord.marks);
      updatedRecord.grandTotal = allSubjectMarks.reduce((acc, curr) => acc + curr.total, 0);
      updatedRecord.average = updatedRecord.grandTotal / (SUBJECTS.length || 1);
      
      // Simple logic: If any main subject failed, set level to Failed
      const hasFailed = allSubjectMarks.some(m => m.status === 'Failed');
      updatedRecord.performanceLevel = hasFailed ? 'Failed' : (updatedRecord.average > 80 ? 'Excellent' : 'Good');

      return updatedRecord;
    });

    onUpdateMarks(updatedStudents);
    alert(`Marks for ${selectedSubject.name} saved successfully!`);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
        <h3 className="text-lg font-bold text-slate-800 mb-4">Select Session</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-2">Class Name</label>
            <select 
              value={selectedClass} 
              onChange={(e) => setSelectedClass(e.target.value)}
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
            >
              {CLASSES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-2">Subject</label>
            <select 
              value={selectedSubject.id} 
              onChange={(e) => setSelectedSubject(SUBJECTS.find(s => s.id === e.target.value)!)}
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
            >
              {SUBJECTS.map(s => <option key={s.id} value={s.id}>{s.name} {s.arabicName && `(${s.arabicName})`}</option>)}
            </select>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase text-xs font-bold">
              <th className="px-6 py-4">AD No</th>
              <th className="px-6 py-4">Student Name</th>
              <th className="px-6 py-4">TA (Max: {selectedSubject.maxTA})</th>
              <th className="px-6 py-4">CE (Max: {selectedSubject.maxCE})</th>
              <th className="px-6 py-4">Current Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {filteredStudents.map(student => {
              const currentMarks = student.marks[selectedSubject.id];
              return (
                <tr key={student.id} className="hover:bg-slate-50">
                  <td className="px-6 py-4 font-mono text-sm">{student.adNo}</td>
                  <td className="px-6 py-4 font-medium text-slate-800">{student.name}</td>
                  <td className="px-6 py-4">
                    <input 
                      type="number" 
                      placeholder={currentMarks?.ta.toString() || '0'}
                      value={tempMarks[student.id]?.ta ?? ''}
                      onChange={(e) => handleInputChange(student.id, 'ta', e.target.value)}
                      className="w-24 p-2 border border-slate-200 rounded-md focus:border-emerald-500 outline-none"
                    />
                  </td>
                  <td className="px-6 py-4">
                    <input 
                      type="number" 
                      placeholder={currentMarks?.ce.toString() || '0'}
                      value={tempMarks[student.id]?.ce ?? ''}
                      onChange={(e) => handleInputChange(student.id, 'ce', e.target.value)}
                      className="w-24 p-2 border border-slate-200 rounded-md focus:border-emerald-500 outline-none"
                    />
                  </td>
                  <td className="px-6 py-4">
                    <span className={`font-bold ${currentMarks?.status === 'Failed' ? 'text-red-500' : 'text-emerald-600'}`}>
                      {currentMarks?.total || 0}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex justify-end sticky bottom-6 z-20">
        <button 
          onClick={saveAllMarks}
          className="bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-3 rounded-full font-bold shadow-lg transition-all flex items-center gap-2"
        >
          <i className="fa-solid fa-save"></i>
          Save Subject Marks
        </button>
      </div>
    </div>
  );
};

export default FacultyEntry;
