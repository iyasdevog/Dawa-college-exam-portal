
import React, { useState, useEffect, useMemo } from 'react';
import Layout from './components/Layout.tsx';
import Dashboard from './components/Dashboard.tsx';
import FacultyEntry from './components/FacultyEntry.tsx';
import ClassResults from './components/ClassResults.tsx';
import StudentScorecard from './components/StudentScorecard.tsx';
import Management from './components/Management.tsx';
import PublicPortal from './components/PublicPortal.tsx';
import { StudentRecord, SubjectConfig, ViewType, SubjectMarks } from './types.ts';
import { INITIAL_STUDENTS, SUBJECTS } from './constants.ts';
import { dbService } from './services/dbService.ts';

const App: React.FC = () => {
  const [mode, setMode] = useState<'public' | 'admin'>('public');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [activeView, setActiveView] = useState<ViewType>('dashboard');
  const [isLoading, setIsLoading] = useState(true);
  const [isCloudActive, setIsCloudActive] = useState(true);
  
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');

  const [students, setStudents] = useState<StudentRecord[]>([]);
  const [subjects, setSubjects] = useState<SubjectConfig[]>([]);

  // Initial Data Fetch
  useEffect(() => {
    const initDb = async () => {
      try {
        // Attempt cloud connection
        const cloudOk = await dbService.checkCloudConnection();
        setIsCloudActive(cloudOk);

        const fetchedStudents = await dbService.getAllStudents();
        const fetchedSubjects = await dbService.getAllSubjects();

        // Seed if absolutely empty in both cloud and local
        if (fetchedStudents.length === 0 && fetchedSubjects.length === 0) {
          console.log("Initializing database with baseline data...");
          await dbService.saveMultipleStudents(INITIAL_STUDENTS);
          for (const s of SUBJECTS) {
            await dbService.saveSubject(s);
          }
          setStudents(INITIAL_STUDENTS);
          setSubjects(SUBJECTS);
        } else {
          setStudents(fetchedStudents);
          setSubjects(fetchedSubjects);
        }
      } catch (err) {
        console.error("Initialization error:", err);
        setIsCloudActive(false);
      } finally {
        setIsLoading(false);
      }
    };
    initDb();
  }, []);

  const syncStudentsToCloud = async (update: React.SetStateAction<StudentRecord[]>) => {
    const newStudents = typeof update === 'function' ? update(students) : update;
    setStudents(newStudents);
    await dbService.saveMultipleStudents(newStudents);
  };

  const syncSubjectsToCloud = async (update: React.SetStateAction<SubjectConfig[]>) => {
    const newSubjects = typeof update === 'function' ? update(subjects) : update;
    setSubjects(newSubjects);
    for (const s of newSubjects) {
      await dbService.saveSubject(s);
    }
  };

  // Derived state
  const processedStudents = useMemo(() => {
    const withTotals = students.map(student => {
      const classSpecificSubjects = subjects.filter(sub => 
        sub.targetClasses?.includes(student.className)
      );
      const relevantSubjectIds = new Set(classSpecificSubjects.map(s => s.id));
      const relevantMarks = Object.entries(student.marks)
        .filter(([id]) => relevantSubjectIds.has(id))
        .map(([, m]) => m as SubjectMarks);

      const grandTotal = relevantMarks.reduce((acc, curr) => acc + curr.total, 0);
      const subjectCount = classSpecificSubjects.length || 1;
      const average = grandTotal / subjectCount;
      const hasFailed = relevantMarks.some(m => m.status === 'Failed');
      const performanceLevel = hasFailed 
        ? 'Failed' 
        : (average > 80 ? 'Excellent' : average > 60 ? 'Good' : average > 40 ? 'Average' : 'Needs Improvement');

      return { ...student, grandTotal, average, performanceLevel };
    });

    const classes = [...new Set(withTotals.map(s => s.className))];
    const rankedStudents: StudentRecord[] = [];
    classes.forEach(cls => {
      const classStudents = withTotals.filter(s => s.className === cls)
        .sort((a, b) => b.grandTotal - a.grandTotal);
      classStudents.forEach((s, idx) => {
        rankedStudents.push({ ...s, rank: idx + 1 });
      });
    });
    return rankedStudents;
  }, [students, subjects]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (username === 'admin' && password === '1234') {
      setIsLoggedIn(true);
      setMode('admin');
    } else {
      alert('Invalid credentials.');
    }
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setMode('public');
    setUsername('');
    setPassword('');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-8">
        <div className="loader-ring mb-8"></div>
        <h2 className="text-white text-xl font-black tracking-tighter">Establishing Academic Terminal</h2>
        <p className="text-emerald-400 text-[10px] font-black uppercase tracking-[0.3em] mt-4 animate-pulse">Syncing with IDA Cloud Systems</p>
      </div>
    );
  }

  const renderAdminContent = () => {
    switch (activeView) {
      case 'dashboard':
        return <Dashboard students={processedStudents} onNavigateToManagement={() => setActiveView('management')} />;
      case 'entry':
        return <FacultyEntry students={processedStudents} subjects={subjects} onUpdateMarks={syncStudentsToCloud} />;
      case 'class-report':
        return <ClassResults students={processedStudents} subjects={subjects} />;
      case 'student-card':
        return <StudentScorecard students={processedStudents} subjects={subjects} />;
      case 'management':
        return <Management 
          students={processedStudents} 
          subjects={subjects} 
          onUpdateStudents={syncStudentsToCloud} 
          onUpdateSubjects={syncSubjectsToCloud} 
        />;
      default:
        return <Dashboard students={processedStudents} onNavigateToManagement={() => setActiveView('management')} />;
    }
  };

  if (mode === 'public') {
    return <PublicPortal 
      students={processedStudents} 
      subjects={subjects} 
      onLoginClick={() => setMode('admin')} 
    />;
  }

  if (mode === 'admin' && !isLoggedIn) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="bg-white rounded-[3rem] w-full max-w-md p-10 shadow-2xl">
          <div className="text-center mb-10">
            <div className="bg-slate-100 text-slate-900 w-20 h-20 rounded-[2rem] flex items-center justify-center mx-auto mb-6 shadow-inner">
              <i className="fa-solid fa-shield-halved text-4xl"></i>
            </div>
            <h2 className="text-3xl font-black text-slate-900 tracking-tighter">Admin Gateway</h2>
            <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-2">Faculty Identification Required</p>
          </div>
          <form onSubmit={handleLogin} className="space-y-4">
            <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} className="w-full p-5 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 font-bold" placeholder="Registry ID" />
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full p-5 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 font-bold" placeholder="Security PIN" />
            <button type="submit" className="w-full bg-slate-900 text-white py-5 rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl transition-all hover:bg-slate-800">Authenticate</button>
            <button type="button" onClick={() => setMode('public')} className="w-full text-slate-400 text-[10px] font-black uppercase mt-6 tracking-[0.2em] hover:text-slate-600">Cancel Access</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <Layout activeView={activeView} setView={setActiveView} onLogout={handleLogout} isCloudActive={isCloudActive}>
      {renderAdminContent()}
    </Layout>
  );
};

export default App;
