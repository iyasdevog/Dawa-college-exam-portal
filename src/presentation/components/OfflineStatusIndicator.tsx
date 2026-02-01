import React, { useState, useEffect } from 'react';
import { offlineStorageService, OfflineStatus } from '../../infrastructure/services/offlineStorageService';
import { serviceWorkerService } from '../../infrastructure/services/serviceWorkerService';

interface OfflineStatusIndicatorProps {
    className?: string;
    showDetails?: boolean;
}

const OfflineStatusIndicator: React.FC<OfflineStatusIndicatorProps> = ({
    className = '',
    showDetails = false
}) => {
    const [status, setStatus] = useState<OfflineStatus>({
        isOnline: navigator.onLine,
        lastSync: null,
        pendingEntries: 0,
        pendingDrafts: 0
    });
    const [isExpanded, setIsExpanded] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);

    useEffect(() => {
        // Load initial status
        loadStatus();

        // Setup online/offline listeners
        const cleanup = serviceWorkerService.onOnlineStatusChange((isOnline) => {
            setStatus(prev => ({ ...prev, isOnline }));
            if (isOnline) {
                handleAutoSync();
            }
        });

        // Setup service worker listeners
        serviceWorkerService.on('syncComplete', handleSyncComplete);

        // Periodic status updates
        const interval = setInterval(loadStatus, 30000); // Every 30 seconds

        return () => {
            cleanup();
            serviceWorkerService.off('syncComplete', handleSyncComplete);
            clearInterval(interval);
        };
    }, []);

    const loadStatus = async () => {
        try {
            const currentStatus = await offlineStorageService.getOfflineStatus();
            setStatus(currentStatus);
        } catch (error) {
            console.error('OfflineStatusIndicator: Failed to load status:', error);
        }
    };

    const handleAutoSync = async () => {
        if (status.pendingEntries > 0) {
            setIsSyncing(true);
            try {
                await offlineStorageService.triggerSync();
            } catch (error) {
                console.error('OfflineStatusIndicator: Auto sync failed:', error);
            } finally {
                setIsSyncing(false);
            }
        }
    };

    const handleManualSync = async () => {
        setIsSyncing(true);
        try {
            await offlineStorageService.triggerSync();
            await loadStatus();
        } catch (error) {
            console.error('OfflineStatusIndicator: Manual sync failed:', error);
        } finally {
            setIsSyncing(false);
        }
    };

    const handleSyncComplete = (data: any) => {
        console.log('OfflineStatusIndicator: Sync completed:', data);
        setIsSyncing(false);
        loadStatus();
    };

    const formatLastSync = (timestamp: number | null): string => {
        if (!timestamp) return 'Never';

        const now = Date.now();
        const diff = now - timestamp;
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);

        if (days > 0) return `${days}d ago`;
        if (hours > 0) return `${hours}h ago`;
        if (minutes > 0) return `${minutes}m ago`;
        return 'Just now';
    };

    const getStatusColor = () => {
        if (!status.isOnline) return 'bg-red-500';
        if (status.pendingEntries > 0 || isSyncing) return 'bg-orange-500';
        return 'bg-emerald-500';
    };

    const getStatusText = () => {
        if (!status.isOnline) return 'Offline';
        if (isSyncing) return 'Syncing...';
        if (status.pendingEntries > 0) return `${status.pendingEntries} pending`;
        return 'Online';
    };

    const getStatusIcon = () => {
        if (!status.isOnline) return 'fa-wifi-slash';
        if (isSyncing) return 'fa-sync fa-spin';
        if (status.pendingEntries > 0) return 'fa-clock';
        return 'fa-wifi';
    };

    return (
        <div className={`relative ${className}`}>
            {/* Main Status Indicator */}
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-white text-sm font-medium transition-all duration-200 hover:shadow-md active:scale-95 ${getStatusColor()}`}
                title={`Network Status: ${getStatusText()}`}
            >
                <i className={`fa-solid ${getStatusIcon()} text-xs`}></i>
                <span className="hidden sm:inline">{getStatusText()}</span>
                {showDetails && (
                    <i className={`fa-solid fa-chevron-${isExpanded ? 'up' : 'down'} text-xs ml-1`}></i>
                )}
            </button>

            {/* Expanded Details Panel */}
            {showDetails && isExpanded && (
                <div className="absolute top-full right-0 mt-2 w-80 bg-white rounded-xl shadow-xl border border-slate-200 z-50 animate-in slide-in-from-top-2 duration-200">
                    <div className="p-4">
                        {/* Header */}
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-bold text-slate-900">Offline Status</h3>
                            <button
                                onClick={() => setIsExpanded(false)}
                                className="p-1 rounded-lg hover:bg-slate-100 transition-colors duration-200"
                            >
                                <i className="fa-solid fa-times text-slate-400"></i>
                            </button>
                        </div>

                        {/* Connection Status */}
                        <div className="space-y-3 mb-4">
                            <div className="flex items-center justify-between">
                                <span className="text-sm font-medium text-slate-700">Connection</span>
                                <div className="flex items-center gap-2">
                                    <div className={`w-2 h-2 rounded-full ${status.isOnline ? 'bg-emerald-500' : 'bg-red-500'}`}></div>
                                    <span className={`text-sm font-medium ${status.isOnline ? 'text-emerald-700' : 'text-red-700'}`}>
                                        {status.isOnline ? 'Online' : 'Offline'}
                                    </span>
                                </div>
                            </div>

                            <div className="flex items-center justify-between">
                                <span className="text-sm font-medium text-slate-700">Last Sync</span>
                                <span className="text-sm text-slate-600">
                                    {formatLastSync(status.lastSync)}
                                </span>
                            </div>
                        </div>

                        {/* Pending Data */}
                        <div className="space-y-3 mb-4 p-3 bg-slate-50 rounded-lg">
                            <h4 className="text-sm font-bold text-slate-800">Pending Data</h4>

                            <div className="flex items-center justify-between">
                                <span className="text-sm text-slate-600">Marks Entries</span>
                                <span className={`text-sm font-medium ${status.pendingEntries > 0 ? 'text-orange-700' : 'text-slate-600'}`}>
                                    {status.pendingEntries}
                                </span>
                            </div>

                            <div className="flex items-center justify-between">
                                <span className="text-sm text-slate-600">Draft Entries</span>
                                <span className={`text-sm font-medium ${status.pendingDrafts > 0 ? 'text-blue-700' : 'text-slate-600'}`}>
                                    {status.pendingDrafts}
                                </span>
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="space-y-2">
                            {status.isOnline && status.pendingEntries > 0 && (
                                <button
                                    onClick={handleManualSync}
                                    disabled={isSyncing}
                                    className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white text-sm font-medium rounded-lg transition-colors duration-200"
                                >
                                    {isSyncing ? (
                                        <>
                                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                            <span>Syncing...</span>
                                        </>
                                    ) : (
                                        <>
                                            <i className="fa-solid fa-sync text-xs"></i>
                                            <span>Sync Now</span>
                                        </>
                                    )}
                                </button>
                            )}

                            {!status.isOnline && (
                                <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg">
                                    <div className="flex items-start gap-2">
                                        <i className="fa-solid fa-exclamation-triangle text-orange-600 text-sm mt-0.5"></i>
                                        <div>
                                            <div className="text-sm font-medium text-orange-800">Offline Mode</div>
                                            <div className="text-xs text-orange-700 mt-1">
                                                Your changes are being saved locally and will sync when you're back online.
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {status.isOnline && status.pendingEntries === 0 && (
                                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
                                    <div className="flex items-center gap-2">
                                        <i className="fa-solid fa-check-circle text-emerald-600 text-sm"></i>
                                        <div className="text-sm font-medium text-emerald-800">All data synced</div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Simple Notification Dot for Mobile */}
            {!showDetails && (status.pendingEntries > 0 || !status.isOnline) && (
                <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-white animate-pulse"></div>
            )}
        </div>
    );
};

export default OfflineStatusIndicator;