import React, { useState, useMemo, useRef } from 'react';
import { StudentRecord, SubjectConfig } from '../types';
import { CLASSES } from '../constants';
import * as XLSX from 'xlsx';
import { dbService } from '../services/dbService.ts';

interface ManagementProps {
  students: StudentRecord[];
  subjects: SubjectConfig[];
  onUpdateStudents: (students: StudentRecord[]) => Promise<void>;
  onUpdateSubjects: (subjects: SubjectConfig[]) => Promise<void>;
}

const Management: React.FC<ManagementProps> = ({ students, subjects, onUpdateStudents, onUpdateSubjects }) => {
  const [activeTab, setActiveTab] = useState<'students' | 'subjects' | 'sync'>('students');
  const [editingStudent, setEditingStudent] = useState<StudentRecord | null>(null);
  const [isAddingStudent, setIsAddingStudent] = useState(false);
  const [isBulkAdding, setIsBulkAdding] = useState(false);
  const [bulkInput, setBulkInput] = useState('');
  const [studentSearch, setStudentSearch] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [syncProgress, setSyncProgress] = useState(0);
  
  const [editingSubjectDef, setEditingSubjectDef] = useState<SubjectConfig | null>(null);
  const [isAddingSubject, setIsAddingSubject] = useState(false);
  const [collapsedClasses, setCollapsedClasses] = useState<Record<string, boolean>>({});
  
  const excelInputRef = useRef<HTMLInputElement>(null);

  // FIX: Explicitly type useMemo to StudentRecord[] to prevent unknown type errors on length and map
  const filteredStudents = useMemo<StudentRecord[]>(() => {
    return students
      .filter(s => 
        s.name.toLowerCase().includes(studentSearch.toLowerCase()) || 
        s.adNo.includes(studentSearch)
      )
      .sort((a, b) => {
        const classA = CLASSES.indexOf(a.className);
        const classB = CLASSES.indexOf(b.className);
        if (classA !== classB) return classA - classB;
        return a.adNo.localeCompare(b.adNo, undefined, { numeric: true });
      });
  }, [students, studentSearch]);

  const subjectsByClass = useMemo((): Record<string, SubjectConfig[]> => {
    const mapping: Record<string, SubjectConfig[]> = {};
    CLASSES.forEach(cls => {
      const classSubs = subjects.filter(s => s.targetClasses?.includes(cls));
      if (classSubs.length > 0) mapping[cls] = classSubs;
    });
    const unassigned = subjects.filter(s => !s.targetClasses || s.targetClasses.length === 0);
    if (unassigned.length > 0) mapping['Unassigned'] = unassigned;
    return mapping;
  }, [subjects]);

  const toggleClassCollapse = (cls: string) => {
    setCollapsedClasses(prev => ({ ...prev, [cls]: !prev[cls] }));
  };

  const handleForceSync = async () => {
    setIsProcessing(true);
    setSyncProgress(20);
    try {
      // Force write entire local array to Firestore
      await dbService.saveMultipleStudents(students);
      setSyncProgress(100);
      alert('Cloud Registry fully synchronized successfully.');
    } catch (err) {
      alert('Sync failed. Please check your internet connection.');
    } finally {
      setIsProcessing(false);
      setTimeout(() => setSyncProgress(0), 2000);
    }
  };

  const handleDeleteStudent = async (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (confirm('Permanently delete this student from Cloud Registry?')) {
      await dbService.deleteStudent(id);
      await onUpdateStudents(students.filter(s => s.id !== id));
    }
  };

  const handleClearAllStudents = async () => {
    if (confirm('DANGER: This will permanently delete ALL students from Cloud Firestore.')) {
      const finalCheck = confirm('Irreversible action. Proceed?');
      if (finalCheck) {
        setIsProcessing(true);
        await dbService.deleteAllStudents(students);
        await onUpdateStudents([]);
        setIsProcessing(false);
        alert('Cloud Registry Cleared.');
      }
    }
  };

  const handleExcelUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsProcessing(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rawRows = XLSX.utils.sheet_to_json(sheet) as any[];
        
        const existingMap = new Map<string, StudentRecord>(students.map(s => [s.adNo, s]));
        const updatedList = [...students];
        let newCount = 0;
        let updateCount = 0;
        
        rawRows.forEach((row, i) => {
          const adNo = String(row.adno || row.AdNo || row.AdmissionNo || row.id || Object.values(row)[0]).trim();
          const name = String(row.name || row.Name || row.StudentName || Object.values(row)[1]).trim().toUpperCase();
          const className = String(row.class || row.Class || row.Grade || row.ClassName || Object.values(row)[2]).trim().toUpperCase();
          
          if (adNo && name && CLASSES.includes(className)) {
            const existing = existingMap.get(adNo);
            if (existing) {
              const idx = updatedList.findIndex(s => s.adNo === adNo);
              updatedList[idx] = { ...existing, name, className };
              updateCount++;
            } else {
              updatedList.push({
                id: `st-${Date.now()}-${i}`,
                adNo, 
                name, 
                className, 
                semester: 'Odd', 
                marks: {},
                grandTotal: 0, 
                average: 0, 
                rank: 0, 
                performanceLevel: 'Average'
              });
              newCount++;
            }
          }
        });

        if (newCount > 0 || updateCount > 0) {
          await onUpdateStudents(updatedList);
          alert(`Import Complete: ${newCount} added, ${updateCount} updated. Click "Force Cloud Sync" to finalize.`);
          setIsBulkAdding(false);
        }
      } catch (err) { 
        alert("Import error. Please check file format."); 
      } finally {
        setIsProcessing(false);
        if (excelInputRef.current) excelInputRef.current.value = '';
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleBulkRegister = async () => {
    setIsProcessing(true);
    const lines = bulkInput.split('\n').filter(line => line.trim() !== '');
    const existingMap = new Map<string, StudentRecord>(students.map(s => [s.adNo, s]));
    const updatedList = [...students];

    lines.forEach((line, index) => {
      const parts = line.split(/[,;\t]/).map(p => p.trim());
      if (parts.length >= 3) {
        const [adNo, name, className] = parts;
        const normalizedClass = className.toUpperCase();
        if (CLASSES.includes(normalizedClass)) {
          const existing = existingMap.get(adNo);
          if (existing) {
            const idx = updatedList.findIndex(s => s.adNo === adNo);
            updatedList[idx] = { ...existing, name: name.toUpperCase(), className: normalizedClass };
          } else {
            updatedList.push({
              id: `bk-${Date.now()}-${index}`,
              adNo, 
              name: name.toUpperCase(), 
              className: normalizedClass,
              semester: 'Odd', 
              marks: {}, 
              grandTotal: 0, 
              average: 0, 
              rank: 0, 
              performanceLevel: 'Average'
            });
          }
        }
      }
    });
    
    await onUpdateStudents(updatedList);
    setIsBulkAdding(false);
    setBulkInput('');
    setIsProcessing(false);
  };

  const MarkSelector = ({ label, value, onChange }: { label: string, value: number, onChange: (val: number) => void }) => {
    const standardOptions = [30, 35, 50, 70, 100];
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
            className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-emerald-500"
          >
            {standardOptions.map(opt => <option key={opt} value={opt}>{opt} Points</option>)}
            <option value="custom">Manual...</option>
          </select>
          {localIsCustom && (
            <input type="number" value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-full p-2.5 bg-white border border-emerald-100 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-emerald-500" />
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
          <h2 className="text-3xl font-black text-white tracking-tight mb-2">Cloud Management Hub</h2>
          <p className="text-slate-400 text-sm max-w-md">Real-time academic synchronization across all faculty nodes.</p>
        </div>
        <div className="flex flex-wrap justify-center gap-3 relative z-10">
          <button onClick={() => window.location.reload()} className="bg-white/10 hover:bg-white/20 text-white px-6 py-3 rounded-2xl font-bold transition-all text-xs flex items-center gap-2 border border-white/10">
            <i className={`fa-solid fa-rotate ${isProcessing ? 'animate-spin' : ''}`}></i> 
            Refresh Terminal
          </button>
        </div>
      </div>

      <div className="flex p-1.5 bg-slate-200/50 rounded-2xl w-fit mx-auto lg:mx-0">
        <button onClick={() => setActiveTab('students')} className={`px-8 py-3 rounded-xl font-bold text-sm transition-all ${activeTab === 'students' ? 'bg-white text-slate-900 shadow-md' : 'text-slate-500'}`}>Students Registry</button>
        <button onClick={() => setActiveTab('subjects')} className={`px-8 py-3 rounded-xl font-bold text-sm transition-all ${activeTab === 'subjects' ? 'bg-white text-slate-900 shadow-md' : 'text-slate-500'}`}>Curriculum Units</button>
        <button onClick={() => setActiveTab('sync')} className={`px-8 py-3 rounded-xl font-bold text-sm transition-all ${activeTab === 'sync' ? 'bg-white text-emerald-600 shadow-md' : 'text-slate-500'}`}>Cloud Tools</button>
      </div>

      {activeTab === 'students' && (
        <div className="space-y-6 animate-in fade-in duration-500">
          <div className="bg-white rounded-[2rem] border border-slate-200 overflow-hidden shadow-sm">
            <div className="p-8 border-b border-slate-100 flex flex-col md:flex-row justify-between items-center gap-6 bg-slate-50/50">
              <div className="flex items-center gap-6 w-full md:w-auto">
                <h3 className="font-black text-slate-800 uppercase text-xs tracking-[0.2em]">Live Registry</h3>
                <div className="relative w-full max-w-xs">
                   <i className="fa-solid fa-search absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 text-xs"></i>
                   <input type="text" placeholder="Search..." value={studentSearch} onChange={(e) => setStudentSearch(e.target.value)} className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-emerald-500" />
                </div>
              </div>
              <div className="flex flex-wrap gap-3 w-full md:w-auto">
                <button disabled={isProcessing} onClick={handleClearAllStudents} className="flex-1 md:flex-none bg-red-50 text-red-600 px-6 py-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 border border-red-100"><i className="fa-solid fa-trash-can"></i> Delete All</button>
                <button disabled={isProcessing} onClick={() => setIsBulkAdding(true)} className="flex-1 md:flex-none bg-emerald-50 text-emerald-700 px-6 py-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 border border-emerald-100"><i className="fa-solid fa-list-check"></i> Import Students</button>
                <button disabled={isProcessing} onClick={() => { setIsAddingStudent(true); setEditingStudent({ id: '', adNo: '', name: '', className: CLASSES[0], semester: 'Odd', marks: {}, grandTotal: 0, average: 0, rank: 0, performanceLevel: 'Average' } as StudentRecord); }} className="flex-1 md:flex-none bg-slate-900 text-white px-6 py-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2"><i className="fa-solid fa-plus-circle text-emerald-400"></i> New Entry</button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left min-w-[600px]">
                <thead><tr className="bg-white border-b border-slate-100 text-[10px] font-black uppercase text-slate-400 tracking-widest"><th className="px-8 py-4">AD No</th><th className="px-8 py-4">Name</th><th className="px-8 py-4">Grade</th><th className="px-8 py-4 text-right">Actions</th></tr></thead>
                <tbody className="divide-y divide-slate-50">
                  {filteredStudents.map(s => (
                    <tr key={s.id} className="hover:bg-slate-50/50 group">
                      <td className="px-8 py-5 font-mono text-sm text-slate-400">{s.adNo}</td>
                      <td className="px-8 py-5 font-bold text-slate-800 uppercase">{s.name}</td>
                      <td className="px-8 py-5"><span className="px-2 py-1 bg-slate-100 rounded-lg text-[10px] font-black text-slate-500">{s.className}</span></td>
                      <td className="px-8 py-5 text-right"><div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => { setEditingStudent(s); setIsAddingStudent(false); }} className="text-emerald-600 hover:bg-emerald-50 w-8 h-8 rounded-lg flex items-center justify-center"><i className="fa-solid fa-pen-to-square"></i></button>
                          <button onClick={(e) => handleDeleteStudent(s.id, e)} className="text-red-600 hover:bg-red-50 w-8 h-8 rounded-lg flex items-center justify-center"><i className="fa-solid fa-trash-can"></i></button>
                      </div></td>
                    </tr>
                  ))}
                  {filteredStudents.length === 0 && (
                    <tr><td colSpan={4} className="p-12 text-center text-slate-400 font-medium">No records found.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'subjects' && (
        <div className="space-y-10 animate-in fade-in duration-500">
           <div className="flex justify-between items-center">
            <h3 className="font-black text-slate-800 uppercase text-xs tracking-[0.2em]">Cloud Curriculum</h3>
            <button disabled={isProcessing} onClick={() => { setIsAddingSubject(true); setEditingSubjectDef({ id: `sub-${Date.now()}`, name: '', arabicName: '', maxTA: 70, maxCE: 30, passingTotal: 35, facultyName: '', targetClasses: [] }); }} className="bg-slate-900 text-white px-6 py-3 rounded-xl font-bold text-xs flex items-center gap-2"><i className="fa-solid fa-plus-circle text-emerald-400"></i> New Subject</button>
          </div>
          <div className="space-y-6">
            {Object.entries(subjectsByClass).map(([cls, classSubs]) => (
              <div key={cls} className="bg-white rounded-[2rem] border border-slate-200 overflow-hidden shadow-sm">
                <button onClick={() => toggleClassCollapse(cls)} className="w-full p-6 flex items-center justify-between bg-slate-50/50 hover:bg-slate-100/50 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="bg-slate-900 text-white w-10 h-10 rounded-xl flex items-center justify-center font-black text-xs">{cls}</div>
                    <div className="text-left">
                      <h4 className="font-black text-slate-800 uppercase text-xs tracking-widest">{cls === 'Unassigned' ? 'Standalone Units' : `Level ${cls} Registry`}</h4>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">{classSubs.length} Active Units</p>
                    </div>
                  </div>
                  <i className={`fa-solid fa-chevron-down transition-transform duration-300 text-slate-300 ${collapsedClasses[cls] ? '-rotate-90' : ''}`}></i>
                </button>
                {!collapsedClasses[cls] && (
                  <div className="p-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {classSubs.map(s => (
                      <div key={s.id} className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex flex-col group relative hover:border-emerald-400 transition-all">
                        <div className="absolute top-4 right-4 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                           <button onClick={() => { setEditingSubjectDef(s); setIsAddingSubject(false); }} className="w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center"><i className="fa-solid fa-gear text-[10px]"></i></button>
                           <button onClick={async () => { if(confirm('Delete curriculum unit?')) { setIsProcessing(true); await dbService.deleteSubject(s.id); onUpdateSubjects(subjects.filter(sub => sub.id !== s.id)); setIsProcessing(false); }}} className="w-8 h-8 rounded-lg bg-red-50 text-red-600 flex items-center justify-center"><i className="fa-solid fa-trash-can text-[10px]"></i></button>
                        </div>
                        <h4 className="font-black text-slate-800 text-sm uppercase mb-1">{s.name}</h4>
                        <p className="arabic-text text-emerald-600 text-2xl font-bold">{s.arabicName}</p>
                        <div className="mt-4 pt-4 border-t border-slate-50 text-[9px] text-slate-400 font-bold uppercase flex justify-between">
                          <span>Pass: {s.passingTotal}</span>
                          <span className="text-slate-900">MAX: {s.maxTA + s.maxCE}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'sync' && (
        <div className="space-y-8 animate-in fade-in duration-500">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="bg-white p-10 rounded-[2.5rem] border border-slate-200 shadow-sm">
              <div className="bg-emerald-50 w-16 h-16 rounded-3xl flex items-center justify-center text-emerald-600 mb-6 text-2xl">
                <i className="fa-solid fa-cloud-arrow-up"></i>
              </div>
              <h3 className="text-2xl font-black text-slate-800 tracking-tight mb-2">Push Registry to Cloud</h3>
              <p className="text-slate-500 text-sm mb-8">If you have uploaded names or edited students locally and they are not appearing on other devices, use this to force an update to the cloud database.</p>
              
              <div className="space-y-4">
                {isProcessing && syncProgress > 0 && (
                  <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                    <div className="bg-emerald-500 h-full transition-all duration-300" style={{ width: `${syncProgress}%` }}></div>
                  </div>
                )}
                <button 
                  disabled={isProcessing}
                  onClick={handleForceSync}
                  className="w-full bg-slate-900 hover:bg-slate-800 text-white py-5 rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl transition-all flex items-center justify-center gap-3"
                >
                  {isProcessing ? <i className="fa-solid fa-circle-notch animate-spin"></i> : <i className="fa-solid fa-cloud"></i>}
                  {isProcessing ? 'Syncing...' : 'Sync Registry Now'}
                </button>
              </div>
            </div>

            <div className="bg-slate-50 p-10 rounded-[2.5rem] border border-slate-200 border-dashed">
              <h3 className="text-xl font-black text-slate-800 tracking-tight mb-2">Merge Strategy</h3>
              <p className="text-slate-500 text-sm mb-6">EduMark uses <strong>Admission Numbers</strong> as primary keys. To update student names or classes without losing existing marks:</p>
              <ul className="space-y-3 text-xs font-bold text-slate-600 list-disc list-inside">
                <li>Keep the same AdNo in your Excel sheet.</li>
                <li>Upload the sheet; EduMark will match the AdNo and preserve marks.</li>
                <li>New AdNos will be created as fresh entries.</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {isBulkAdding && (
        <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-xl z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[3rem] w-full max-w-2xl shadow-2xl overflow-hidden animate-in zoom-in">
            <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h3 className="text-xl font-black text-slate-800 tracking-tight">Bulk Student Merge</h3>
              <button onClick={() => setIsBulkAdding(false)} className="text-slate-400 hover:text-slate-900 transition-colors"><i className="fa-solid fa-xmark text-xl"></i></button>
            </div>
            <div className="p-10 space-y-8 overflow-y-auto max-h-[80vh]">
              <div className="bg-emerald-50 p-8 rounded-3xl border border-emerald-100 text-center group cursor-pointer hover:bg-emerald-100 transition-colors" onClick={() => excelInputRef.current?.click()}>
                <i className={`fa-solid ${isProcessing ? 'fa-circle-notch animate-spin' : 'fa-file-excel'} text-4xl text-emerald-600 mb-4`}></i>
                <h4 className="font-black uppercase text-[10px] tracking-widest mb-2 text-emerald-800">Merge Academic List</h4>
                <p className="text-emerald-700 text-xs font-bold mb-4">Updates Names/Classes & Adds New Students.<br/>Existing marks are NOT affected.</p>
                <input type="file" ref={excelInputRef} accept=".xlsx, .xls" onChange={handleExcelUpload} className="hidden" />
                <button disabled={isProcessing} className="bg-emerald-600 text-white px-8 py-3 rounded-xl font-bold text-xs shadow-lg shadow-emerald-500/20">Select Spreadsheet</button>
              </div>
              <div className="relative">
                <div className="absolute -top-3 left-6 bg-white px-2 text-[9px] font-black text-slate-400 uppercase tracking-widest">Manual Merge</div>
                <textarea placeholder="Format: AdNo, Name, Class" value={bulkInput} onChange={(e) => setBulkInput(e.target.value)} className="w-full h-40 p-6 bg-slate-50 border border-slate-200 rounded-3xl outline-none font-mono text-sm focus:ring-2 focus:ring-emerald-500" />
              </div>
              <div className="flex gap-4">
                <button onClick={() => setIsBulkAdding(false)} className="flex-1 py-5 rounded-2xl font-black uppercase text-[10px] tracking-widest text-slate-400 border border-slate-200">Cancel</button>
                <button disabled={isProcessing} onClick={handleBulkRegister} className="flex-1 py-5 bg-slate-900 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-2xl">Confirm Sync</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {(editingStudent || editingSubjectDef) && (
        <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-xl z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[3rem] w-full max-w-lg shadow-2xl overflow-hidden animate-in zoom-in">
            <form onSubmit={async (e) => {
              e.preventDefault();
              setIsProcessing(true);
              if (editingStudent) {
                const updated = isAddingStudent 
                  ? [...students, { ...editingStudent, id: `st-${Date.now()}` }]
                  : students.map(s => s.id === editingStudent.id ? editingStudent : s);
                await onUpdateStudents(updated);
                setEditingStudent(null);
              } else if (editingSubjectDef) {
                const updated = isAddingSubject
                  ? [...subjects, editingSubjectDef]
                  : subjects.map(s => s.id === editingSubjectDef.id ? editingSubjectDef : s);
                await onUpdateSubjects(updated);
                setEditingSubjectDef(null);
              }
              setIsProcessing(false);
            }} className="p-10 space-y-6">
              <h3 className="text-xl font-black text-slate-800 mb-8">{editingStudent ? 'Student Profile' : 'Curriculum Unit'}</h3>
              {editingStudent && (
                <div className="space-y-4">
                   <input type="text" required placeholder="AdNo" value={editingStudent.adNo} onChange={(e) => setEditingStudent({...editingStudent, adNo: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-black" />
                   <input type="text" required placeholder="Full Name" value={editingStudent.name} onChange={(e) => setEditingStudent({...editingStudent, name: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-black uppercase" />
                   <select value={editingStudent.className} onChange={(e) => setEditingStudent({...editingStudent, className: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-black">
                        {CLASSES.map(c => <option key={c} value={c}>{c}</option>)}
                   </select>
                </div>
              )}
              {editingSubjectDef && (
                <div className="space-y-4">
                   <input type="text" required placeholder="English Title" value={editingSubjectDef.name} onChange={(e) => setEditingSubjectDef({...editingSubjectDef, name: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-black uppercase" />
                   <input type="text" placeholder="Arabic Title" value={editingSubjectDef.arabicName} onChange={(e) => setEditingSubjectDef({...editingSubjectDef, arabicName: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-2xl font-bold arabic-text" />
                   <div className="grid grid-cols-3 gap-4">
                      <MarkSelector label="TA Max" value={editingSubjectDef.maxTA} onChange={(v) => setEditingSubjectDef({...editingSubjectDef, maxTA: v})} />
                      <MarkSelector label="CE Max" value={editingSubjectDef.maxCE} onChange={(v) => setEditingSubjectDef({...editingSubjectDef, maxCE: v})} />
                      <div className="flex-1">
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 text-center">Pass</label>
                        <input type="number" value={editingSubjectDef.passingTotal} onChange={(e) => setEditingSubjectDef({...editingSubjectDef, passingTotal: Number(e.target.value)})} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-black text-center" />
                      </div>
                   </div>
                   <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Assign to Classes</label>
                      <div className="flex flex-wrap gap-2">
                        {CLASSES.map(cls => (
                          <button type="button" key={cls} onClick={() => {
                              if (!editingSubjectDef) return;
                              const current = editingSubjectDef.targetClasses || [];
                              const next = current.includes(cls) ? current.filter(c => c !== cls) : [...current, cls];
                              setEditingSubjectDef({...editingSubjectDef, targetClasses: next});
                            }}
                            className={`px-3 py-1.5 rounded-xl text-[10px] font-black transition-all ${editingSubjectDef?.targetClasses?.includes(cls) ? 'bg-emerald-600 text-white shadow-lg' : 'bg-slate-100 text-slate-400'}`}
                          >
                            {cls}
                          </button>
                        ))}
                      </div>
                   </div>
                </div>
              )}
              <div className="pt-6 flex gap-4">
                <button type="button" onClick={() => { setEditingStudent(null); setEditingSubjectDef(null); }} className="flex-1 py-5 rounded-2xl font-black uppercase text-[10px] tracking-widest text-slate-400 border border-slate-200">Cancel</button>
                <button type="submit" disabled={isProcessing} className="flex-1 py-5 bg-slate-900 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-2xl">Confirm Sync</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Management;