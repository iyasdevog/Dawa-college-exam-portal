import React, { useState, useEffect } from 'react';

interface BeforeInstallPromptEvent extends Event {
    prompt(): Promise<void>;
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

interface PWAInstallPromptProps {
    onInstall?: () => void;
    onDismiss?: () => void;
}

const PWAInstallPrompt: React.FC<PWAInstallPromptProps> = ({ onInstall, onDismiss }) => {
    const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
    const [showPrompt, setShowPrompt] = useState(false);
    const [isInstalled, setIsInstalled] = useState(false);
    const [isStandalone, setIsStandalone] = useState(false);

    useEffect(() => {
        // Check if app is already installed or running in standalone mode
        const checkInstallStatus = () => {
            const isStandaloneMode = window.matchMedia('(display-mode: standalone)').matches ||
                (window.navigator as any).standalone ||
                document.referrer.includes('android-app://');

            setIsStandalone(isStandaloneMode);
            setIsInstalled(isStandaloneMode);
        };

        checkInstallStatus();

        // Listen for beforeinstallprompt event
        const handleBeforeInstallPrompt = (e: Event) => {
            const event = e as BeforeInstallPromptEvent;
            console.log('PWA: Before install prompt triggered');

            // Prevent the mini-infobar from appearing on mobile
            event.preventDefault();

            // Save the event so it can be triggered later
            setDeferredPrompt(event);

            // Show custom install prompt after a delay
            setTimeout(() => {
                if (!isInstalled && !isStandalone) {
                    setShowPrompt(true);
                }
            }, 3000); // Show after 3 seconds
        };

        // Listen for app installed event
        const handleAppInstalled = () => {
            console.log('PWA: App installed successfully');
            setIsInstalled(true);
            setShowPrompt(false);
            setDeferredPrompt(null);
            onInstall?.();
        };

        window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
        window.addEventListener('appinstalled', handleAppInstalled);

        return () => {
            window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
            window.removeEventListener('appinstalled', handleAppInstalled);
        };
    }, [isInstalled, isStandalone, onInstall]);

    const handleInstallClick = async () => {
        if (!deferredPrompt) return;

        try {
            // Show the install prompt
            await deferredPrompt.prompt();

            // Wait for the user to respond to the prompt
            const { outcome } = await deferredPrompt.userChoice;

            console.log('PWA: User choice:', outcome);

            if (outcome === 'accepted') {
                console.log('PWA: User accepted the install prompt');
                onInstall?.();
            } else {
                console.log('PWA: User dismissed the install prompt');
                onDismiss?.();
            }

            // Clear the deferredPrompt
            setDeferredPrompt(null);
            setShowPrompt(false);
        } catch (error) {
            console.error('PWA: Error during installation:', error);
        }
    };

    const handleDismiss = () => {
        setShowPrompt(false);
        onDismiss?.();

        // Don't show again for this session
        sessionStorage.setItem('pwa-install-dismissed', 'true');
    };

    // Don't show if already installed, dismissed, or no prompt available
    if (isInstalled || isStandalone || !showPrompt || !deferredPrompt) {
        return null;
    }

    // Check if user already dismissed in this session
    if (sessionStorage.getItem('pwa-install-dismissed')) {
        return null;
    }

    return (
        <div className="fixed bottom-4 left-4 right-4 z-50 md:left-auto md:right-4 md:max-w-sm">
            <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 p-6 transform transition-all duration-300 ease-out animate-slide-up">
                <div className="flex items-start space-x-4">
                    <div className="flex-shrink-0">
                        <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center">
                            <i className="fa-solid fa-download text-emerald-600 text-xl"></i>
                        </div>
                    </div>

                    <div className="flex-1 min-w-0">
                        <h3 className="text-lg font-bold text-slate-900 mb-1">
                            Install AIC Exam Portal
                        </h3>
                        <p className="text-sm text-slate-600 mb-4">
                            Get faster access and work offline. Install our app for the best experience.
                        </p>

                        <div className="flex space-x-3">
                            <button
                                onClick={handleInstallClick}
                                className="flex-1 bg-emerald-600 text-white px-4 py-2 rounded-xl font-semibold text-sm hover:bg-emerald-700 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
                            >
                                Install
                            </button>
                            <button
                                onClick={handleDismiss}
                                className="px-4 py-2 text-slate-500 hover:text-slate-700 font-medium text-sm transition-colors duration-200 focus:outline-none"
                            >
                                Not now
                            </button>
                        </div>
                    </div>

                    <button
                        onClick={handleDismiss}
                        className="flex-shrink-0 text-slate-400 hover:text-slate-600 transition-colors duration-200 focus:outline-none"
                    >
                        <i className="fa-solid fa-times text-lg"></i>
                    </button>
                </div>

                {/* Features list */}
                <div className="mt-4 pt-4 border-t border-slate-100">
                    <div className="grid grid-cols-2 gap-2 text-xs text-slate-500">
                        <div className="flex items-center space-x-2">
                            <i className="fa-solid fa-wifi-slash text-emerald-500"></i>
                            <span>Works offline</span>
                        </div>
                        <div className="flex items-center space-x-2">
                            <i className="fa-solid fa-bolt text-emerald-500"></i>
                            <span>Faster loading</span>
                        </div>
                        <div className="flex items-center space-x-2">
                            <i className="fa-solid fa-mobile-alt text-emerald-500"></i>
                            <span>App-like experience</span>
                        </div>
                        <div className="flex items-center space-x-2">
                            <i className="fa-solid fa-bell text-emerald-500"></i>
                            <span>Push notifications</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PWAInstallPrompt;