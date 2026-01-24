
import React, { useState } from 'react';
import { StudentRecord, SubjectConfig } from '../types';
import { CLASSES } from '../constants';

interface ManagementProps {
  students: StudentRecord[];
  subjects: SubjectConfig[];
  onUpdateStudents: (students: StudentRecord[]) => void;
  onUpdateSubjects: (subjects: SubjectConfig[]) => void;
}

const Management: React.FC<ManagementProps> = ({ students, subjects, onUpdateStudents, onUpdateSubjects }) => {
  const [activeTab, setActiveTab] = useState<'students' | 'subjects'>('students');
  const [editingStudent, setEditingStudent] = useState<StudentRecord | null>(null);
  const [isAddingStudent, setIsAddingStudent] = useState(false);

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        if (Array.isArray(json)) {
          onUpdateStudents(json);
          alert('Successfully imported ' + json.length + ' students.');
        }
      } catch (err) {
        alert('Invalid file format. Please upload a JSON array of students.');
      }
    };
    reader.readAsText(file);
  };

  const handleSaveStudent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStudent) return;
    
    if (isAddingStudent) {
      onUpdateStudents([...students, { ...editingStudent, id: Date.now().toString() }]);
    } else {
      const updated = students.map(s => s.id === editingStudent.id ? editingStudent : s);
      onUpdateStudents(updated);
    }
    
    setEditingStudent(null);
    setIsAddingStudent(false);
  };

  const handleUpdateSubjectField = (subjectId: string, field: keyof SubjectConfig, value: any) => {
    const updated = subjects.map(s => s.id === subjectId ? { ...s, [field]: value } : s);
    onUpdateSubjects(updated);
  };

  const startAddStudent = () => {
    setIsAddingStudent(true);
    setEditingStudent({
      id: '',
      adNo: '',
      name: '',
      className: CLASSES[0],
      semester: 'Odd',
      marks: {},
      grandTotal: 0,
      average: 0,
      rank: 0,
      performanceLevel: 'Average'
    });
  };

  const MarkSelector = ({ 
    label, 
    value, 
    onChange 
  }: { 
    label: string, 
    value: number, 
    onChange: (val: number) => void 
  }) => {
    const standardOptions = [30, 50, 70];
    const isCustom = !standardOptions.includes(value);
    const [localIsCustom, setLocalIsCustom] = useState(isCustom);

    return (
      <div className="flex-1">
        <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">{label}</label>
        <div className="flex flex-col gap-2">
          <select 
            value={localIsCustom ? 'custom' : value}
            onChange={(e) => {
              if (e.target.value === 'custom') {
                setLocalIsCustom(true);
              } else {
                setLocalIsCustom(false);
                onChange(Number(e.target.value));
              }
            }}
            className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-emerald-500"
          >
            {standardOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
            <option value="custom">Other (Manual)</option>
          </select>
          {localIsCustom && (
            <input 
              type="number"
              value={value}
              onChange={(e) => onChange(Number(e.target.value))}
              placeholder="Enter marks"
              className="w-full p-2 bg-white border border-emerald-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-emerald-500"
            />
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex border-b border-slate-200">
        <button 
          onClick={() => setActiveTab('students')}
          className={`px-6 py-3 font-bold transition-all ${activeTab === 'students' ? 'text-emerald-600 border-b-2 border-emerald-600' : 'text-slate-400'}`}
        >
          Manage Students
        </button>
        <button 
          onClick={() => setActiveTab('subjects')}
          className={`px-6 py-3 font-bold transition-all ${activeTab === 'subjects' ? 'text-emerald-600 border-b-2 border-emerald-600' : 'text-slate-400'}`}
        >
          Manage Subjects & Faculty
        </button>
      </div>

      {activeTab === 'students' ? (
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 bg-white p-6 rounded-xl border border-slate-200 flex flex-col md:flex-row justify-between items-center gap-4">
              <div>
                <h3 className="font-bold text-slate-800">Bulk Import</h3>
                <p className="text-sm text-slate-500">Upload JSON student data.</p>
              </div>
              <label className="cursor-pointer bg-slate-100 hover:bg-slate-200 px-4 py-2 rounded-lg border border-slate-300 font-medium transition-all text-sm">
                <i className="fa-solid fa-file-import mr-2"></i> Select File
                <input type="file" accept=".json" onChange={handleImport} className="hidden" />
              </label>
            </div>
            <button 
              onClick={startAddStudent}
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-4 rounded-xl font-bold shadow-lg shadow-emerald-100 transition-all flex items-center justify-center gap-2"
            >
              <i className="fa-solid fa-plus"></i>
              Add New Student
            </button>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
            <table className="w-full text-left">
              <thead className="bg-slate-50 border-b border-slate-200 text-xs font-bold uppercase text-slate-500">
                <tr>
                  <th className="px-6 py-4">AD No</th>
                  <th className="px-6 py-4">Name</th>
                  <th className="px-6 py-4">Class</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {students.map(s => (
                  <tr key={s.id} className="hover:bg-slate-50/50">
                    <td className="px-6 py-4 font-mono">{s.adNo}</td>
                    <td className="px-6 py-4 font-medium">{s.name}</td>
                    <td className="px-6 py-4">{s.className}</td>
                    <td className="px-6 py-4 text-right">
                      <button 
                        onClick={() => { setEditingStudent(s); setIsAddingStudent(false); }}
                        className="text-emerald-600 hover:underline font-bold text-sm"
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {subjects.map(s => (
            <div key={s.id} className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col h-full">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h4 className="font-bold text-slate-800 text-lg leading-tight">{s.name}</h4>
                  <p className="arabic-text text-emerald-600 text-xl mt-1">{s.arabicName}</p>
                </div>
                <div className="bg-slate-100 px-2 py-1 rounded text-[10px] font-bold uppercase text-slate-500">
                  {s.id}
                </div>
              </div>
              
              <div className="space-y-6 flex-1">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Faculty Member</label>
                  <div className="relative">
                    <i className="fa-solid fa-user-tie absolute left-3 top-1/2 -translate-y-1/2 text-slate-300"></i>
                    <input 
                      type="text"
                      value={s.facultyName || ''}
                      onChange={(e) => handleUpdateSubjectField(s.id, 'facultyName', e.target.value)}
                      placeholder="Assign faculty..."
                      className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-100">
                  <MarkSelector 
                    label="Max TA" 
                    value={s.maxTA} 
                    onChange={(val) => handleUpdateSubjectField(s.id, 'maxTA', val)} 
                  />
                  <MarkSelector 
                    label="Max CE" 
                    value={s.maxCE} 
                    onChange={(val) => handleUpdateSubjectField(s.id, 'maxCE', val)} 
                  />
                </div>

                <div className="pt-4 border-t border-slate-100">
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Passing Threshold</label>
                  <input 
                    type="number"
                    value={s.passingTotal}
                    onChange={(e) => handleUpdateSubjectField(s.id, 'passingTotal', Number(e.target.value))}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Edit/Add Student Modal */}
      {editingStudent && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in duration-200">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="text-xl font-bold text-slate-800">
                {isAddingStudent ? 'Add New Student' : 'Edit Student Details'}
              </h3>
              <button onClick={() => setEditingStudent(null)} className="text-slate-400 hover:text-slate-600 w-8 h-8 rounded-full hover:bg-slate-100 transition-all flex items-center justify-center">
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>
            <form onSubmit={handleSaveStudent} className="p-8 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-1">
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Admission No</label>
                  <input 
                    type="text" 
                    required
                    value={editingStudent.adNo} 
                    onChange={(e) => setEditingStudent({...editingStudent, adNo: e.target.value})}
                    placeholder="AdNo"
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div className="col-span-1">
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Class</label>
                  <select 
                    value={editingStudent.className} 
                    onChange={(e) => setEditingStudent({...editingStudent, className: e.target.value})}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    {CLASSES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Full Name</label>
                <input 
                  type="text" 
                  required
                  value={editingStudent.name} 
                  onChange={(e) => setEditingStudent({...editingStudent, name: e.target.value})}
                  placeholder="Enter full name"
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div className="pt-4 flex gap-4">
                <button 
                  type="button" 
                  onClick={() => setEditingStudent(null)} 
                  className="flex-1 px-4 py-3 border border-slate-200 rounded-xl font-bold text-slate-600 hover:bg-slate-50 transition-all"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="flex-1 px-4 py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 shadow-lg shadow-emerald-100 transition-all"
                >
                  {isAddingStudent ? 'Create Record' : 'Save Updates'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Management;
