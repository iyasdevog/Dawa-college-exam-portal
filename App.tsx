
import React, { useState, useEffect, Suspense, lazy } from 'react';
import { ApplicationErrorBoundary, FeatureErrorBoundary } from './src/presentation/components/ErrorBoundary';
import { MobileProvider } from './src/presentation/viewmodels/MobileContext';
import { ViewType } from './src/domain/entities/types';
import { serviceWorkerService } from './src/infrastructure/services/serviceWorkerService';
import { ErrorReportingService } from './src/infrastructure/services/ErrorReportingService';
import { browserCompatibility } from './src/infrastructure/services/BrowserCompatibilityService';
import { progressiveEnhancement } from './src/infrastructure/services/ProgressiveEnhancementService';

// Lazy load components for code splitting
const Layout = lazy(() => import('./src/presentation/components/Layout'));
const Dashboard = lazy(() => import('./src/presentation/components/Dashboard'));
const FacultyEntry = lazy(() => import('./src/presentation/components/FacultyEntry'));
const ClassResults = lazy(() => import('./src/presentation/components/ClassResults'));
const StudentScorecard = lazy(() => import('./src/presentation/components/StudentScorecard'));
const Management = lazy(() => import('./src/presentation/components/Management'));
const PublicPortal = lazy(() => import('./src/presentation/components/PublicPortal'));
const PWAInstallPrompt = lazy(() => import('./src/presentation/components/PWAInstallPrompt'));

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
  const [showPWAPrompt, setShowPWAPrompt] = useState(false);
  const [swUpdateAvailable, setSwUpdateAvailable] = useState(false);

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
        // Initialize browser compatibility first
        console.log('App: Initializing browser compatibility...');
        const features = browserCompatibility.getFeatures();
        console.log('App: Browser features detected:', features);

        // Initialize progressive enhancement
        console.log('App: Setting up progressive enhancement...');

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

          {/* PWA Install Prompt */}
          {showPWAPrompt && (
            <Suspense fallback={null}>
              <PWAInstallPrompt
                onInstall={handlePWAInstall}
                onDismiss={handlePWADismiss}
              />
            </Suspense>
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

          {/* PWA Install Prompt */}
          {showPWAPrompt && (
            <Suspense fallback={null}>
              <PWAInstallPrompt
                onInstall={handlePWAInstall}
                onDismiss={handlePWADismiss}
              />
            </Suspense>
          )}
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
        {showPWAPrompt && (
          <Suspense fallback={null}>
            <PWAInstallPrompt
              onInstall={handlePWAInstall}
              onDismiss={handlePWADismiss}
            />
          </Suspense>
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
    </ApplicationErrorBoundary>
  );
};

export default App;
