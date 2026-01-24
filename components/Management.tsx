
import React, { useState, useMemo } from 'react';
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
  const [studentSearch, setStudentSearch] = useState('');
  
  const [editingSubjectDef, setEditingSubjectDef] = useState<SubjectConfig | null>(null);
  const [isAddingSubject, setIsAddingSubject] = useState(false);

  const filteredStudents = useMemo(() => {
    return students.filter(s => 
      s.name.toLowerCase().includes(studentSearch.toLowerCase()) || 
      s.adNo.includes(studentSearch)
    );
  }, [students, studentSearch]);

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        if (Array.isArray(json)) {
          onUpdateStudents(json);
          alert('Imported ' + json.length + ' students.');
        } else if (json.students && Array.isArray(json.students)) {
          onUpdateStudents(json.students);
          if (json.subjects) onUpdateSubjects(json.subjects);
          alert('Full backup restored successfully.');
        }
      } catch (err) {
        alert('Invalid file format.');
      }
    };
    reader.readAsText(file);
  };

  const handleExportBackup = () => {
    const backupData = { version: "1.1", timestamp: new Date().toISOString(), students, subjects };
    const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `edumark_backup_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const toggleClassForSubject = (className: string) => {
    if (!editingSubjectDef) return;
    const current = editingSubjectDef.targetClasses || [];
    const updated = current.includes(className)
      ? current.filter(c => c !== className)
      : [...current, className];
    setEditingSubjectDef({ ...editingSubjectDef, targetClasses: updated });
  };

  const selectAllClasses = () => {
    if (!editingSubjectDef) return;
    setEditingSubjectDef({ ...editingSubjectDef, targetClasses: [...CLASSES] });
  };

  const clearAllClasses = () => {
    if (!editingSubjectDef) return;
    setEditingSubjectDef({ ...editingSubjectDef, targetClasses: [] });
  };

  const MarkSelector = ({ label, value, onChange }: { label: string, value: number, onChange: (val: number) => void }) => {
    const standardOptions = [30, 50, 70];
    const isCustom = !standardOptions.includes(value);
    const [localIsCustom, setLocalIsCustom] = useState(isCustom);

    return (
      <div className="flex-1">
        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">{label}</label>
        <div className="space-y-2">
          <select 
            value={localIsCustom ? 'custom' : value}
            onChange={(e) => {
              if (e.target.value === 'custom') setLocalIsCustom(true);
              else { setLocalIsCustom(false); onChange(Number(e.target.value)); }
            }}
            className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
          >
            {standardOptions.map(opt => <option key={opt} value={opt}>{opt} Points</option>)}
            <option value="custom">Manual Input...</option>
          </select>
          {localIsCustom && (
            <input 
              type="number"
              value={value}
              onChange={(e) => onChange(Number(e.target.value))}
              placeholder="Value"
              className="w-full p-2.5 bg-white border border-emerald-100 rounded-xl text-sm font-bold focus:ring-2 focus:ring-emerald-500 outline-none animate-in slide-in-from-top-1"
            />
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-20">
      <div className="bg-slate-900 p-8 rounded-[2.5rem] shadow-2xl flex flex-col lg:flex-row items-center justify-between gap-8 border border-white/5 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 blur-[100px] pointer-events-none"></div>
        <div className="relative z-10 text-center lg:text-left">
          <h2 className="text-3xl font-black text-white tracking-tight mb-2">Administrative Center</h2>
          <p className="text-slate-400 text-sm max-w-md">Global configuration for students, curriculum assignments, and official records.</p>
        </div>
        <div className="flex flex-wrap justify-center gap-3 relative z-10">
          <label className="cursor-pointer bg-white/10 hover:bg-white/20 text-white px-6 py-3 rounded-2xl border border-white/10 font-bold transition-all text-xs flex items-center gap-2">
            <i className="fa-solid fa-cloud-arrow-up text-emerald-400"></i> Restore
            <input type="file" accept=".json" onChange={handleImport} className="hidden" />
          </label>
          <button 
            onClick={handleExportBackup}
            className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-3 rounded-2xl font-bold transition-all text-xs flex items-center gap-2 shadow-lg shadow-emerald-500/20"
          >
            <i className="fa-solid fa-download"></i> Backup Local
          </button>
        </div>
      </div>

      <div className="flex p-1.5 bg-slate-200/50 rounded-2xl w-fit mx-auto lg:mx-0">
        <button 
          onClick={() => setActiveTab('students')}
          className={`px-8 py-3 rounded-xl font-bold text-sm transition-all ${activeTab === 'students' ? 'bg-white text-slate-900 shadow-md' : 'text-slate-500 hover:text-slate-700'}`}
        >
          Students Registry
        </button>
        <button 
          onClick={() => setActiveTab('subjects')}
          className={`px-8 py-3 rounded-xl font-bold text-sm transition-all ${activeTab === 'subjects' ? 'bg-white text-slate-900 shadow-md' : 'text-slate-500 hover:text-slate-700'}`}
        >
          Faculty & Subjects
        </button>
      </div>

      {activeTab === 'students' ? (
        <div className="space-y-6 animate-in fade-in duration-500">
          <div className="bg-white rounded-[2rem] border border-slate-200 overflow-hidden shadow-sm">
            <div className="p-8 border-b border-slate-100 flex flex-col md:flex-row justify-between items-center gap-6 bg-slate-50/50">
              <div className="flex items-center gap-6 w-full md:w-auto">
                <h3 className="font-black text-slate-800 uppercase text-xs tracking-[0.2em] whitespace-nowrap">Master List</h3>
                <div className="relative w-full max-w-xs">
                   <i className="fa-solid fa-search absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 text-xs"></i>
                   <input 
                    type="text"
                    placeholder="Search by name or id..."
                    value={studentSearch}
                    onChange={(e) => setStudentSearch(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 text-xs font-bold"
                   />
                </div>
              </div>
              <button 
                onClick={() => { setIsAddingStudent(true); setEditingStudent({ id: '', adNo: '', name: '', className: CLASSES[0], semester: 'Odd', marks: {}, grandTotal: 0, average: 0, rank: 0, performanceLevel: 'Average' }); }}
                className="w-full md:w-auto bg-slate-900 hover:bg-slate-800 text-white px-6 py-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-lg shadow-slate-200"
              >
                <i className="fa-solid fa-plus-circle text-emerald-400"></i> Register Student
              </button>
            </div>
            <table className="w-full text-left">
              <thead>
                <tr className="bg-white border-b border-slate-100 text-[10px] font-black uppercase text-slate-400 tracking-widest">
                  <th className="px-8 py-4">AD No</th>
                  <th className="px-8 py-4">Legal Student Name</th>
                  <th className="px-8 py-4">Grade Level</th>
                  <th className="px-8 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filteredStudents.map(s => (
                  <tr key={s.id} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="px-8 py-5 font-mono text-sm text-slate-400">{s.adNo}</td>
                    <td className="px-8 py-5 font-bold text-slate-800 uppercase tracking-tight">{s.name}</td>
                    <td className="px-8 py-5">
                       <span className="px-2 py-1 bg-slate-100 rounded-lg text-[10px] font-black text-slate-500">{s.className}</span>
                    </td>
                    <td className="px-8 py-5 text-right opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => { setEditingStudent(s); setIsAddingStudent(false); }}
                        className="text-emerald-600 hover:bg-emerald-50 px-4 py-2 rounded-lg font-bold text-xs transition-all"
                      >
                        Edit Profile
                      </button>
                    </td>
                  </tr>
                ))}
                {filteredStudents.length === 0 && (
                  <tr>
                    <td colSpan={4} className="p-20 text-center text-slate-400 italic font-bold uppercase text-[10px] tracking-widest">No matching records found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="space-y-8 animate-in fade-in duration-500">
          <div className="flex justify-between items-center">
            <h3 className="font-black text-slate-800 uppercase text-xs tracking-[0.2em]">Curriculum Repository</h3>
            <button 
              onClick={() => { setIsAddingSubject(true); setEditingSubjectDef({ id: '', name: '', arabicName: '', maxTA: 70, maxCE: 30, passingTotal: 35, facultyName: '', targetClasses: [] }); }}
              className="bg-slate-900 hover:bg-slate-800 text-white px-6 py-3 rounded-xl font-bold text-xs flex items-center gap-2 transition-all shadow-lg shadow-slate-200"
            >
              <i className="fa-solid fa-plus-circle text-emerald-400"></i> Create Academic Unit
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {subjects.map(s => (
              <div key={s.id} className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm flex flex-col group relative hover:shadow-2xl hover:shadow-slate-100 transition-all border-b-4 border-b-slate-100 hover:border-b-emerald-400">
                <div className="absolute top-6 right-6 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                   <button 
                    onClick={() => { setEditingSubjectDef(s); setIsAddingSubject(false); }}
                    className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center hover:bg-slate-800 shadow-xl"
                  >
                    <i className="fa-solid fa-gear text-xs"></i>
                  </button>
                  <button 
                    onClick={() => { if(confirm('Permanently delete this subject?')) onUpdateSubjects(subjects.filter(sub => sub.id !== s.id)) }}
                    className="w-10 h-10 rounded-xl bg-red-50 text-red-600 flex items-center justify-center hover:bg-red-100"
                  >
                    <i className="fa-solid fa-trash-can text-xs"></i>
                  </button>
                </div>
                <div className="mb-8">
                  <h4 className="font-black text-slate-800 text-xl leading-tight mb-2 uppercase tracking-tight">{s.name}</h4>
                  <p className="arabic-text text-emerald-600 text-3xl font-bold">{s.arabicName}</p>
                </div>
                <div className="space-y-6 flex-1">
                  <div className="flex flex-wrap gap-1.5">
                    {s.targetClasses?.map(c => (
                      <span key={c} className="px-2 py-1 bg-slate-900 text-white rounded-lg text-[9px] font-black tracking-widest">{c}</span>
                    ))}
                    {(!s.targetClasses || s.targetClasses.length === 0) && (
                      <span className="text-[9px] text-red-400 font-black italic uppercase tracking-widest">No Grades Assigned</span>
                    )}
                  </div>
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center text-slate-400 shadow-sm border border-slate-100">
                       <i className="fa-solid fa-user-tie text-xs"></i>
                    </div>
                    <div>
                      <label className="block text-[8px] font-black text-slate-400 uppercase tracking-widest">Assigned Faculty</label>
                      <span className="font-black text-xs text-slate-800 uppercase">{s.facultyName || 'Vacant Position'}</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                      <label className="block text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Max Score</label>
                      <span className="font-black text-slate-800 text-sm">{s.maxTA + s.maxCE}</span>
                    </div>
                    <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100">
                      <label className="block text-[8px] font-black text-emerald-600/50 uppercase tracking-widest mb-1">Pass Mark</label>
                      <span className="font-black text-emerald-700 text-sm">{s.passingTotal} pts</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Reusable Modal Layer */}
      {(editingStudent || editingSubjectDef) && (
        <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-xl z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[3rem] w-full max-w-lg shadow-2xl overflow-hidden animate-in zoom-in duration-300">
            <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h3 className="text-xl font-black text-slate-800 tracking-tight flex items-center gap-3">
                <i className={`fa-solid ${editingStudent ? 'fa-user-circle' : 'fa-book-open'} text-emerald-500`}></i>
                {editingStudent ? (isAddingStudent ? 'New Registration' : 'Edit Profile') : (isAddingSubject ? 'Create Academic Unit' : 'Configure Subject')}
              </h3>
              <button onClick={() => { setEditingStudent(null); setEditingSubjectDef(null); }} className="text-slate-400 hover:text-slate-900 w-12 h-12 rounded-full hover:bg-white shadow-sm transition-all flex items-center justify-center">
                <i className="fa-solid fa-xmark text-xl"></i>
              </button>
            </div>
            
            <form 
              onSubmit={(e) => {
                e.preventDefault();
                if (editingStudent) {
                  if (isAddingStudent) onUpdateStudents([...students, { ...editingStudent, id: Date.now().toString() }]);
                  else onUpdateStudents(students.map(s => s.id === editingStudent.id ? editingStudent : s));
                  setEditingStudent(null);
                } else if (editingSubjectDef) {
                  if (isAddingSubject) onUpdateSubjects([...subjects, editingSubjectDef]);
                  else onUpdateSubjects(subjects.map(s => s.id === editingSubjectDef.id ? editingSubjectDef : s));
                  setEditingSubjectDef(null);
                }
              }} 
              className="p-10 space-y-6"
            >
              {editingStudent && (
                <>
                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Admission No.</label>
                      <input type="text" required value={editingStudent.adNo} onChange={(e) => setEditingStudent({...editingStudent, adNo: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 font-mono font-black transition-all" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Current Grade</label>
                      <select value={editingStudent.className} onChange={(e) => setEditingStudent({...editingStudent, className: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 font-black transition-all">
                        {CLASSES.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Full Legal Name</label>
                    <input type="text" required value={editingStudent.name} onChange={(e) => setEditingStudent({...editingStudent, name: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 font-black uppercase transition-all" />
                  </div>
                </>
              )}

              {editingSubjectDef && (
                <>
                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Technical ID</label>
                      <input disabled={!isAddingSubject} type="text" required value={editingSubjectDef.id} onChange={(e) => setEditingSubjectDef({...editingSubjectDef, id: e.target.value})} className={`w-full p-4 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-emerald-500 font-mono font-black ${!isAddingSubject ? 'bg-slate-100 opacity-50' : 'bg-slate-50'}`} />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Faculty Lead</label>
                      <input type="text" value={editingSubjectDef.facultyName} onChange={(e) => setEditingSubjectDef({...editingSubjectDef, facultyName: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-emerald-500 font-black" />
                    </div>
                  </div>
                  <div className="space-y-4">
                    <input type="text" required placeholder="English Title" value={editingSubjectDef.name} onChange={(e) => setEditingSubjectDef({...editingSubjectDef, name: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-emerald-500 font-black uppercase" />
                    <input type="text" placeholder="Arabic Title (Optional)" value={editingSubjectDef.arabicName} onChange={(e) => setEditingSubjectDef({...editingSubjectDef, arabicName: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-emerald-500 arabic-text text-2xl font-bold" />
                  </div>
                  
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                       <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Assigned Grade Levels</label>
                       <div className="flex gap-2">
                          <button type="button" onClick={selectAllClasses} className="text-[9px] font-black text-emerald-600 hover:underline uppercase tracking-widest">Select All</button>
                          <button type="button" onClick={clearAllClasses} className="text-[9px] font-black text-red-400 hover:underline uppercase tracking-widest">Clear</button>
                       </div>
                    </div>
                    <div className="flex flex-wrap gap-2 p-4 bg-slate-50 rounded-[1.5rem] border border-slate-100">
                      {CLASSES.map(c => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => toggleClassForSubject(c)}
                          className={`px-4 py-2 rounded-xl text-[10px] font-black tracking-widest uppercase transition-all ${
                            editingSubjectDef.targetClasses?.includes(c)
                              ? 'bg-slate-900 text-white shadow-lg'
                              : 'bg-white text-slate-300 border border-slate-200 hover:border-slate-400'
                          }`}
                        >
                          {c}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <MarkSelector label="TA Weight" value={editingSubjectDef.maxTA} onChange={(val) => setEditingSubjectDef({...editingSubjectDef, maxTA: val})} />
                    <MarkSelector label="CE Weight" value={editingSubjectDef.maxCE} onChange={(val) => setEditingSubjectDef({...editingSubjectDef, maxCE: val})} />
                    <div>
                       <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Pass Mark</label>
                       <input type="number" required value={editingSubjectDef.passingTotal} onChange={(e) => setEditingSubjectDef({...editingSubjectDef, passingTotal: Number(e.target.value)})} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-black outline-none focus:ring-2 focus:ring-emerald-500" />
                    </div>
                  </div>
                </>
              )}

              <div className="pt-6 flex gap-4">
                <button type="button" onClick={() => { setEditingStudent(null); setEditingSubjectDef(null); }} className="flex-1 px-6 py-5 rounded-2xl font-black uppercase text-[10px] tracking-widest text-slate-400 border border-slate-200 hover:bg-slate-50 hover:text-slate-600 transition-all">Cancel</button>
                <button type="submit" className="flex-1 px-6 py-5 bg-slate-900 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-2xl shadow-slate-200 hover:bg-slate-800 transition-all">Apply Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Management;
