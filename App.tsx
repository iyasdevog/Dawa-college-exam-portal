
import React, { useState, useEffect } from 'react';
import Layout from './components/Layout.tsx';
import Dashboard from './components/Dashboard.tsx';
import FacultyEntry from './components/FacultyEntry.tsx';
import ClassResults from './components/ClassResults.tsx';
import StudentScorecard from './components/StudentScorecard.tsx';
import Management from './components/Management.tsx';
import PublicPortal from './components/PublicPortal.tsx';
import PWAInstallPrompt from './components/PWAInstallPrompt.tsx';
import { MobileProvider } from './contexts/MobileContext.tsx';
import { ViewType } from './types.ts';
import { serviceWorkerService } from './services/serviceWorkerService';

const App: React.FC = () => {
  const [mode, setMode] = useState<'public' | 'admin'>('public');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [activeView, setActiveView] = useState<ViewType>('dashboard');
  const [isLoading, setIsLoading] = useState(true);
  const [isCloudActive, setIsCloudActive] = useState(true);
  const [showPWAPrompt, setShowPWAPrompt] = useState(false);
  const [swUpdateAvailable, setSwUpdateAvailable] = useState(false);

  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');

  // Enhanced initialization with PWA features
  useEffect(() => {
    const initApp = async () => {
      try {
        // Simple connectivity check
        setIsCloudActive(navigator.onLine);

        // Register service worker with enhanced PWA features
        if (process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'development') {
          try {
            const swStatus = await serviceWorkerService.register();
            console.log('Service Worker registration status:', swStatus);

            // Setup service worker event listeners
            serviceWorkerService.on('updateAvailable', () => {
              console.log('App: Service worker update available');
              setSwUpdateAvailable(true);
            });

            serviceWorkerService.on('installPromptAvailable', () => {
              console.log('App: PWA install prompt available');
              setShowPWAPrompt(true);
            });

            serviceWorkerService.on('appInstalled', () => {
              console.log('App: PWA installed successfully');
              setShowPWAPrompt(false);
            });

            serviceWorkerService.on('syncComplete', (data) => {
              console.log('App: Background sync completed:', data);
              // Could show a toast notification here
            });

            serviceWorkerService.on('performanceMetrics', (metrics) => {
              console.log('App: Performance metrics:', metrics);
              // Could update performance dashboard
            });

            // Check if PWA install prompt should be shown
            const pwaStatus = serviceWorkerService.getPWAInstallStatus();
            if (pwaStatus.canInstall && !pwaStatus.isInstalled) {
              // Delay showing prompt to avoid interrupting initial load
              setTimeout(() => setShowPWAPrompt(true), 5000);
            }

          } catch (error) {
            console.error('Service Worker registration failed:', error);
          }
        }

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
  const handlePWAInstall = async () => {
    try {
      const success = await serviceWorkerService.triggerInstallPrompt();
      if (success) {
        console.log('App: PWA installation initiated');
        setShowPWAPrompt(false);
      }
    } catch (error) {
      console.error('App: PWA installation failed:', error);
    }
  };

  const handlePWADismiss = () => {
    setShowPWAPrompt(false);
    console.log('App: PWA install prompt dismissed');
  };

  const handleSWUpdate = async () => {
    try {
      await serviceWorkerService.skipWaiting();
      setSwUpdateAvailable(false);
      // Page will reload automatically
    } catch (error) {
      console.error('App: Service worker update failed:', error);
    }
  };

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
    return (
      <MobileProvider>
        <PublicPortal onLoginClick={() => setMode('admin')} />

        {/* PWA Install Prompt */}
        {showPWAPrompt && (
          <PWAInstallPrompt
            onInstall={handlePWAInstall}
            onDismiss={handlePWADismiss}
          />
        )}

        {/* Service Worker Update Notification */}
        {swUpdateAvailable && (
          <div className="fixed top-4 left-4 right-4 z-50 md:left-auto md:right-4 md:max-w-sm">
            <div className="bg-blue-600 text-white rounded-xl p-4 shadow-lg">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-semibold">Update Available</h4>
                  <p className="text-sm opacity-90">A new version is ready to install</p>
                </div>
                <button
                  onClick={handleSWUpdate}
                  className="bg-white text-blue-600 px-3 py-1 rounded-lg text-sm font-semibold hover:bg-blue-50 transition-colors"
                >
                  Update
                </button>
              </div>
            </div>
          </div>
        )}
      </MobileProvider>
    );
  }

  if (mode === 'admin' && !isLoggedIn) {
    return (
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

        {/* PWA Install Prompt */}
        {showPWAPrompt && (
          <PWAInstallPrompt
            onInstall={handlePWAInstall}
            onDismiss={handlePWADismiss}
          />
        )}
      </MobileProvider>
    );
  }

  return (
    <MobileProvider>
      <Layout activeView={activeView} setView={setActiveView} onLogout={handleLogout} isCloudActive={isCloudActive}>
        {renderAdminContent()}
      </Layout>

      {/* PWA Install Prompt */}
      {showPWAPrompt && (
        <PWAInstallPrompt
          onInstall={handlePWAInstall}
          onDismiss={handlePWADismiss}
        />
      )}

      {/* Service Worker Update Notification */}
      {swUpdateAvailable && (
        <div className="fixed top-4 left-4 right-4 z-50 md:left-auto md:right-4 md:max-w-sm">
          <div className="bg-blue-600 text-white rounded-xl p-4 shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-semibold">Update Available</h4>
                <p className="text-sm opacity-90">A new version is ready to install</p>
              </div>
              <button
                onClick={handleSWUpdate}
                className="bg-white text-blue-600 px-3 py-1 rounded-lg text-sm font-semibold hover:bg-blue-50 transition-colors"
              >
                Update
              </button>
            </div>
          </div>
        </div>
      )}
    </MobileProvider>
  );
};

export default App;
