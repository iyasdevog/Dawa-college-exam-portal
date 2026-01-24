
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

const App: React.FC = () => {
  const [mode, setMode] = useState<'public' | 'admin'>('public');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [activeView, setActiveView] = useState<ViewType>('dashboard');
  
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');

  const [students, setStudents] = useState<StudentRecord[]>(() => {
    const saved = localStorage.getItem('edumark_students');
    return saved ? JSON.parse(saved) : INITIAL_STUDENTS;
  });

  const [subjects, setSubjects] = useState<SubjectConfig[]>(() => {
    const saved = localStorage.getItem('edumark_subjects');
    return saved ? JSON.parse(saved) : SUBJECTS;
  });

  // Derived state (Ranks and Levels) memoized for precision
  const processedStudents = useMemo(() => {
    // 1. Calculate scores based on the subjects relevant to each student's class
    const withTotals = students.map(student => {
      const classSpecificSubjects = subjects.filter(sub => 
        sub.targetClasses?.includes(student.className)
      );
      
      const relevantSubjectIds = new Set(classSpecificSubjects.map(s => s.id));
      
      // Filter marks to only those that should belong to this student's curriculum
      const relevantMarks = Object.entries(student.marks)
        .filter(([id]) => relevantSubjectIds.has(id))
        .map(([, m]) => m as SubjectMarks);

      const grandTotal = relevantMarks.reduce((acc, curr) => acc + curr.total, 0);
      
      // Average is calculated based on the number of subjects assigned to their class
      const subjectCount = classSpecificSubjects.length || 1;
      const average = grandTotal / subjectCount;
      
      const hasFailed = relevantMarks.some(m => m.status === 'Failed');
      const performanceLevel = hasFailed 
        ? 'Failed' 
        : (average > 80 ? 'Excellent' : average > 60 ? 'Good' : average > 40 ? 'Average' : 'Needs Improvement');

      return { ...student, grandTotal, average, performanceLevel };
    });

    // 2. Determine ranks - Ranks are calculated by class
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

  useEffect(() => {
    localStorage.setItem('edumark_students', JSON.stringify(students));
  }, [students]);

  useEffect(() => {
    localStorage.setItem('edumark_subjects', JSON.stringify(subjects));
  }, [subjects]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (username === 'admin' && password === '1234') {
      setIsLoggedIn(true);
      setMode('admin');
    } else {
      alert('Invalid credentials. Use admin / 1234');
    }
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setMode('public');
    setUsername('');
    setPassword('');
  };

  const renderAdminContent = () => {
    switch (activeView) {
      case 'dashboard':
        return <Dashboard students={processedStudents} onNavigateToManagement={() => setActiveView('management')} />;
      case 'entry':
        return <FacultyEntry students={processedStudents} subjects={subjects} onUpdateMarks={setStudents} />;
      case 'class-report':
        return <ClassResults students={processedStudents} subjects={subjects} />;
      case 'student-card':
        return <StudentScorecard students={processedStudents} subjects={subjects} />;
      case 'management':
        return <Management 
          students={processedStudents} 
          subjects={subjects} 
          onUpdateStudents={setStudents} 
          onUpdateSubjects={setSubjects} 
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
        <div className="bg-white rounded-3xl w-full max-w-md p-8 shadow-2xl">
          <div className="text-center mb-8">
            <div className="bg-emerald-100 text-emerald-600 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <i className="fa-solid fa-user-lock text-3xl"></i>
            </div>
            <h2 className="text-2xl font-black text-slate-800">Faculty Login</h2>
            <p className="text-slate-500 text-sm mt-1">Please enter your academic credentials</p>
          </div>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Username</label>
              <input 
                type="text" 
                autoFocus
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all font-semibold"
                placeholder="e.g. admin"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Password</label>
              <input 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all font-semibold"
                placeholder="••••••••"
              />
            </div>
            <button 
              type="submit"
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-4 rounded-2xl font-bold shadow-lg shadow-emerald-200 transition-all"
            >
              Access Admin Panel
            </button>
            <button 
              type="button"
              onClick={() => setMode('public')}
              className="w-full text-slate-400 text-xs font-bold uppercase tracking-widest mt-4 hover:text-slate-600 transition-colors"
            >
              Back to Student Portal
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <Layout activeView={activeView} setView={setActiveView} onLogout={handleLogout}>
      {renderAdminContent()}
    </Layout>
  );
};

export default App;