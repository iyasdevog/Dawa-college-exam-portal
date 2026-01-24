
import React, { useState, useEffect } from 'react';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import FacultyEntry from './components/FacultyEntry';
import ClassResults from './components/ClassResults';
import StudentScorecard from './components/StudentScorecard';
import Management from './components/Management';
import PublicPortal from './components/PublicPortal';
import { StudentRecord, SubjectConfig, ViewType } from './types';
import { INITIAL_STUDENTS, SUBJECTS } from './constants';

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

  useEffect(() => {
    // Recalculate ranks whenever student data changes
    const updatedWithRanks = [...students].sort((a, b) => b.grandTotal - a.grandTotal)
      .map((s, idx) => ({ ...s, rank: idx + 1 }));
    
    if (JSON.stringify(updatedWithRanks) !== JSON.stringify(students)) {
      setStudents(updatedWithRanks);
    }
    
    localStorage.setItem('edumark_students', JSON.stringify(updatedWithRanks));
  }, [students]);

  useEffect(() => {
    localStorage.setItem('edumark_subjects', JSON.stringify(subjects));
  }, [subjects]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    // Simplified faculty credentials
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
        return <Dashboard students={students} onNavigateToManagement={() => setActiveView('management')} />;
      case 'entry':
        return <FacultyEntry students={students} onUpdateMarks={setStudents} />;
      case 'class-report':
        return <ClassResults students={students} />;
      case 'student-card':
        return <StudentScorecard students={students} />;
      case 'management':
        return <Management 
          students={students} 
          subjects={subjects} 
          onUpdateStudents={setStudents} 
          onUpdateSubjects={setSubjects} 
        />;
      default:
        return <Dashboard students={students} onNavigateToManagement={() => setActiveView('management')} />;
    }
  };

  if (mode === 'public') {
    return <PublicPortal 
      students={students} 
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
                className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all"
                placeholder="e.g. admin"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Password</label>
              <input 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all"
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
