
import React, { useState, useEffect } from 'react';
import Layout from './components/Layout.tsx';
import Dashboard from './components/Dashboard.tsx';
import FacultyEntry from './components/FacultyEntry.tsx';
import ClassResults from './components/ClassResults.tsx';
import StudentScorecard from './components/StudentScorecard.tsx';
import Management from './components/Management.tsx';
import PublicPortal from './components/PublicPortal.tsx';
import { ViewType } from './types.ts';

const App: React.FC = () => {
  const [mode, setMode] = useState<'public' | 'admin'>('public');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [activeView, setActiveView] = useState<ViewType>('dashboard');
  const [isLoading, setIsLoading] = useState(true);
  const [isCloudActive, setIsCloudActive] = useState(true);

  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');

  // Initial setup
  useEffect(() => {
    const initApp = async () => {
      try {
        // Simple connectivity check
        setIsCloudActive(navigator.onLine);
      } catch (err) {
        console.error("Initialization error:", err);
        setIsCloudActive(false);
      } finally {
        setIsLoading(false);
      }
    };
    initApp();
  }, []);

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
        <p className="text-emerald-400 text-[10px] font-black uppercase tracking-[0.3em] mt-4 animate-pulse">Syncing with AIC Cloud Systems</p>
      </div>
    );
  };

  const renderAdminContent = () => {
    switch (activeView) {
      case 'dashboard':
        return <Dashboard onNavigateToManagement={() => setActiveView('management')} />;
      case 'entry':
        return <FacultyEntry />;
      case 'class-report':
        return <ClassResults />;
      case 'student-card':
        return <StudentScorecard />;
      case 'management':
        return <Management />;
      default:
        return <Dashboard onNavigateToManagement={() => setActiveView('management')} />;
    }
  };

  if (mode === 'public') {
    return <PublicPortal onLoginClick={() => setMode('admin')} />;
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
