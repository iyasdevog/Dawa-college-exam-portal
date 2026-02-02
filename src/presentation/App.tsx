
import React, { useState, useEffect, Suspense, lazy } from 'react';
import { ApplicationErrorBoundary, FeatureErrorBoundary } from './components/ErrorBoundary';
import { MobileProvider } from './viewmodels/MobileContext';
import { ViewType } from '../domain/entities/types';
import { ErrorReportingService } from '../infrastructure/services/ErrorReportingService';

// Lazy load components for code splitting
const Layout = lazy(() => import('./components/Layout'));
const Dashboard = lazy(() => import('./components/Dashboard'));
const FacultyEntry = lazy(() => import('./components/FacultyEntry'));
const ClassResults = lazy(() => import('./components/ClassResults'));
const StudentScorecard = lazy(() => import('./components/StudentScorecard'));
const Management = lazy(() => import('./components/Management'));
const PublicPortal = lazy(() => import('./components/PublicPortal'));

// Loading fallback components
const ComponentLoadingFallback: React.FC<{ componentName: string }> = ({ componentName }) => (
  <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-8">
    <div className="loader-ring mb-8"></div>
    <h2 className="text-white text-xl font-black tracking-tighter">Loading {componentName}</h2>
    <p className="text-emerald-400 text-[10px] font-black uppercase tracking-[0.3em] mt-4 animate-pulse">
      Optimizing Performance
    </p>
  </div>
);

const AdminLoadingFallback: React.FC = () => (
  <div className="flex items-center justify-center h-64">
    <div className="text-center">
      <div className="loader-ring mb-4"></div>
      <p className="text-slate-600">Loading interface...</p>
    </div>
  </div>
);

const App: React.FC = () => {
  const [mode, setMode] = useState<'public' | 'admin'>('public');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [activeView, setActiveView] = useState<ViewType>('dashboard');
  const [isLoading, setIsLoading] = useState(true);
  const [isCloudActive, setIsCloudActive] = useState(true);

  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');

  // Initialize error reporting service
  const [errorReporter] = useState(() => {
    const service = new ErrorReportingService();
    service.loadPersistedData();
    return service;
  });

  // Enhanced initialization with PWA features
  useEffect(() => {
    const initApp = async () => {
      try {
        console.log('App: Initializing...');

        // Simple connectivity check
        setIsCloudActive(navigator.onLine);

        // Setup online/offline listeners
        const handleOnline = () => {
          setIsCloudActive(true);
          console.log('App: Back online');
        };

        const handleOffline = () => {
          setIsCloudActive(false);
          console.log('App: Gone offline');
        };

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        // Cleanup function
        return () => {
          window.removeEventListener('online', handleOnline);
          window.removeEventListener('offline', handleOffline);
        };

      } catch (err) {
        console.error("Initialization error:", err);
        setIsCloudActive(false);
      } finally {
        setIsLoading(false);
      }
    };

    initApp();
  }, []);

  // PWA event handlers
  // PWA event handlers removed

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
        return (
          <FeatureErrorBoundary featureName="Dashboard" errorReporter={errorReporter}>
            <Suspense fallback={<AdminLoadingFallback />}>
              <Dashboard onNavigateToManagement={() => setActiveView('management')} />
            </Suspense>
          </FeatureErrorBoundary>
        );
      case 'entry':
        return (
          <FeatureErrorBoundary featureName="Faculty Entry" errorReporter={errorReporter}>
            <Suspense fallback={<AdminLoadingFallback />}>
              <FacultyEntry />
            </Suspense>
          </FeatureErrorBoundary>
        );
      case 'class-report':
        return (
          <FeatureErrorBoundary featureName="Class Results" errorReporter={errorReporter}>
            <Suspense fallback={<AdminLoadingFallback />}>
              <ClassResults />
            </Suspense>
          </FeatureErrorBoundary>
        );
      case 'student-card':
        return (
          <FeatureErrorBoundary featureName="Student Scorecard" errorReporter={errorReporter}>
            <Suspense fallback={<AdminLoadingFallback />}>
              <StudentScorecard />
            </Suspense>
          </FeatureErrorBoundary>
        );

      case 'management':
        return (
          <FeatureErrorBoundary featureName="Management" errorReporter={errorReporter}>
            <Suspense fallback={<AdminLoadingFallback />}>
              <Management />
            </Suspense>
          </FeatureErrorBoundary>
        );
      default:
        return (
          <FeatureErrorBoundary featureName="Dashboard" errorReporter={errorReporter}>
            <Suspense fallback={<AdminLoadingFallback />}>
              <Dashboard onNavigateToManagement={() => setActiveView('management')} />
            </Suspense>
          </FeatureErrorBoundary>
        );
    }
  };

  if (mode === 'public') {
    return (
      <ApplicationErrorBoundary level="application" errorReporter={errorReporter}>
        <MobileProvider>
          <FeatureErrorBoundary featureName="Public Portal" errorReporter={errorReporter}>
            <Suspense fallback={<ComponentLoadingFallback componentName="Public Portal" />}>
              <PublicPortal onLoginClick={() => setMode('admin')} />
            </Suspense>
          </FeatureErrorBoundary>

        </MobileProvider>
      </ApplicationErrorBoundary>
    );
  }

  if (mode === 'admin' && !isLoggedIn) {
    return (
      <ApplicationErrorBoundary level="application" errorReporter={errorReporter}>
        <MobileProvider>
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

        </MobileProvider>
      </ApplicationErrorBoundary>
    );
  }

  return (
    <ApplicationErrorBoundary level="application" errorReporter={errorReporter}>
      <MobileProvider>
        <FeatureErrorBoundary featureName="Layout" errorReporter={errorReporter}>
          <Suspense fallback={<ComponentLoadingFallback componentName="Admin Interface" />}>
            <Layout activeView={activeView} setView={setActiveView} onLogout={handleLogout} isCloudActive={isCloudActive}>
              {renderAdminContent()}
            </Layout>
          </Suspense>
        </FeatureErrorBoundary>

        {/* PWA Install Prompt */}
      </MobileProvider>
    </ApplicationErrorBoundary>
  );
};

export default App;
