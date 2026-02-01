import React, { useState, useEffect } from 'react';
import { performanceService } from '../services/performanceService';
import { useMemoryMonitoring } from '../hooks/usePerformanceMonitoring';

interface PerformanceDashboardProps {
    isVisible: boolean;
    onClose: () => void;
}

/**
 * Performance Dashboard Component
 * Displays real-time performance metrics and debugging information
 */
export const PerformanceDashboard: React.FC<PerformanceDashboardProps> = ({
    isVisible,
    onClose,
}) => {
    const [summary, setSummary] = useState(performanceService.getPerformanceSummary());
    const [detailedMetrics, setDetailedMetrics] = useState(performanceService.getDetailedMetrics());
    const { memoryInfo, isHighMemory } = useMemoryMonitoring();
    const [refreshInterval, setRefreshInterval] = useState<NodeJS.Timeout | null>(null);

    useEffect(() => {
        if (isVisible) {
            // Refresh metrics every 2 seconds when dashboard is visible
            const interval = setInterval(() => {
                setSummary(performanceService.getPerformanceSummary());
                setDetailedMetrics(performanceService.getDetailedMetrics());
            }, 2000);

            setRefreshInterval(interval);

            return () => {
                if (interval) clearInterval(interval);
            };
        } else {
            if (refreshInterval) {
                clearInterval(refreshInterval);
                setRefreshInterval(null);
            }
        }
    }, [isVisible, refreshInterval]);

    const handleClearMetrics = () => {
        performanceService.clearMetrics();
        setSummary(performanceService.getPerformanceSummary());
        setDetailedMetrics(performanceService.getDetailedMetrics());
    };

    const handleExportMetrics = () => {
        const exportData = {
            timestamp: new Date().toISOString(),
            summary,
            detailedMetrics,
            memoryInfo,
            deviceInfo: {
                userAgent: navigator.userAgent,
                viewport: {
                    width: window.innerWidth,
                    height: window.innerHeight,
                },
                performanceTier: performanceService.getDevicePerformanceTier(),
                isMobile: performanceService.isMobileDevice(),
            },
        };

        const blob = new Blob([JSON.stringify(exportData, null, 2)], {
            type: 'application/json',
        });

        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `performance-metrics-${Date.now()}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    if (!isVisible) return null;

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
                {/* Header */}
                <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <h2 className="text-2xl font-bold">Performance Dashboard</h2>
                            <p className="text-blue-100 text-sm">Real-time performance monitoring</p>
                        </div>
                        <button
                            onClick={onClose}
                            className="w-10 h-10 rounded-full bg-white/20 hover:bg-white/30 transition-colors duration-200 flex items-center justify-center"
                        >
                            <i className="fa-solid fa-times text-lg"></i>
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
                    {/* Summary Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                        {/* Input Lag */}
                        <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 border border-emerald-200 rounded-xl p-4">
                            <div className="flex items-center justify-between mb-2">
                                <h3 className="font-bold text-emerald-800 text-sm">Input Lag</h3>
                                <i className="fa-solid fa-stopwatch text-emerald-600"></i>
                            </div>
                            <div className="text-2xl font-black text-emerald-900">
                                {summary.averageInputLag.toFixed(1)}ms
                            </div>
                            <div className={`text-xs font-medium ${summary.averageInputLag > 100 ? 'text-red-600' : 'text-emerald-600'
                                }`}>
                                {summary.averageInputLag > 100 ? 'High' : 'Good'}
                            </div>
                        </div>

                        {/* Response Time */}
                        <div className="bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200 rounded-xl p-4">
                            <div className="flex items-center justify-between mb-2">
                                <h3 className="font-bold text-blue-800 text-sm">Response Time</h3>
                                <i className="fa-solid fa-clock text-blue-600"></i>
                            </div>
                            <div className="text-2xl font-black text-blue-900">
                                {summary.averageResponseTime.toFixed(1)}ms
                            </div>
                            <div className={`text-xs font-medium ${summary.averageResponseTime > 200 ? 'text-red-600' : 'text-blue-600'
                                }`}>
                                {summary.averageResponseTime > 200 ? 'Slow' : 'Fast'}
                            </div>
                        </div>

                        {/* Memory Usage */}
                        <div className={`bg-gradient-to-br ${isHighMemory ? 'from-red-50 to-red-100 border-red-200' : 'from-purple-50 to-purple-100 border-purple-200'
                            } border rounded-xl p-4`}>
                            <div className="flex items-center justify-between mb-2">
                                <h3 className={`font-bold text-sm ${isHighMemory ? 'text-red-800' : 'text-purple-800'}`}>
                                    Memory Usage
                                </h3>
                                <i className={`fa-solid fa-memory ${isHighMemory ? 'text-red-600' : 'text-purple-600'}`}></i>
                            </div>
                            <div className={`text-2xl font-black ${isHighMemory ? 'text-red-900' : 'text-purple-900'}`}>
                                {summary.currentMemoryUsage.toFixed(1)}%
                            </div>
                            <div className={`text-xs font-medium ${isHighMemory ? 'text-red-600' : 'text-purple-600'
                                }`}>
                                {isHighMemory ? 'High' : 'Normal'}
                            </div>
                        </div>

                        {/* Errors */}
                        <div className="bg-gradient-to-br from-orange-50 to-orange-100 border border-orange-200 rounded-xl p-4">
                            <div className="flex items-center justify-between mb-2">
                                <h3 className="font-bold text-orange-800 text-sm">Errors</h3>
                                <i className="fa-solid fa-exclamation-triangle text-orange-600"></i>
                            </div>
                            <div className="text-2xl font-black text-orange-900">
                                {summary.totalErrors}
                            </div>
                            <div className={`text-xs font-medium ${summary.totalErrors > 0 ? 'text-red-600' : 'text-orange-600'
                                }`}>
                                {summary.totalErrors > 0 ? 'Issues Found' : 'No Issues'}
                            </div>
                        </div>
                    </div>

                    {/* Device Information */}
                    <div className="bg-slate-50 rounded-xl p-4 mb-6">
                        <h3 className="font-bold text-slate-800 mb-3">Device Information</h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                            <div>
                                <span className="font-medium text-slate-600">Device Type:</span>
                                <span className="ml-2 text-slate-800">
                                    {performanceService.isMobileDevice() ? 'Mobile' : 'Desktop'}
                                </span>
                            </div>
                            <div>
                                <span className="font-medium text-slate-600">Performance Tier:</span>
                                <span className="ml-2 text-slate-800 capitalize">
                                    {performanceService.getDevicePerformanceTier()}
                                </span>
                            </div>
                            <div>
                                <span className="font-medium text-slate-600">Viewport:</span>
                                <span className="ml-2 text-slate-800">
                                    {window.innerWidth} × {window.innerHeight}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Memory Details */}
                    {memoryInfo && (
                        <div className="bg-white border border-slate-200 rounded-xl p-4 mb-6">
                            <h3 className="font-bold text-slate-800 mb-3">Memory Details</h3>
                            <div className="space-y-2">
                                <div className="flex justify-between text-sm">
                                    <span className="text-slate-600">Used JS Heap:</span>
                                    <span className="font-mono text-slate-800">
                                        {(memoryInfo.usedJSHeapSize / 1024 / 1024).toFixed(1)} MB
                                    </span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-slate-600">Total JS Heap:</span>
                                    <span className="font-mono text-slate-800">
                                        {(memoryInfo.totalJSHeapSize / 1024 / 1024).toFixed(1)} MB
                                    </span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-slate-600">JS Heap Limit:</span>
                                    <span className="font-mono text-slate-800">
                                        {(memoryInfo.jsHeapSizeLimit / 1024 / 1024).toFixed(1)} MB
                                    </span>
                                </div>
                                <div className="mt-3">
                                    <div className="flex justify-between text-xs text-slate-600 mb-1">
                                        <span>Memory Usage</span>
                                        <span>{memoryInfo.percentage.toFixed(1)}%</span>
                                    </div>
                                    <div className="w-full bg-slate-200 rounded-full h-2">
                                        <div
                                            className={`h-2 rounded-full transition-all duration-300 ${memoryInfo.percentage > 80 ? 'bg-red-500' :
                                                    memoryInfo.percentage > 60 ? 'bg-orange-500' : 'bg-emerald-500'
                                                }`}
                                            style={{ width: `${Math.min(memoryInfo.percentage, 100)}%` }}
                                        ></div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Recent Errors */}
                    {detailedMetrics.errorMetrics.length > 0 && (
                        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
                            <h3 className="font-bold text-red-800 mb-3">Recent Errors</h3>
                            <div className="space-y-2 max-h-40 overflow-y-auto">
                                {detailedMetrics.errorMetrics.slice(-5).map((error, index) => (
                                    <div key={index} className="bg-white border border-red-200 rounded-lg p-3">
                                        <div className="font-medium text-red-800 text-sm">{error.message}</div>
                                        <div className="text-xs text-red-600 mt-1">
                                            {new Date(error.timestamp).toLocaleTimeString()}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Recent Input Metrics */}
                    {detailedMetrics.inputMetrics.length > 0 && (
                        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
                            <h3 className="font-bold text-blue-800 mb-3">Recent Input Interactions</h3>
                            <div className="space-y-2 max-h-40 overflow-y-auto">
                                {detailedMetrics.inputMetrics.slice(-10).map((input, index) => (
                                    <div key={index} className="bg-white border border-blue-200 rounded-lg p-3">
                                        <div className="flex justify-between items-center">
                                            <div className="text-sm">
                                                <span className="font-medium text-blue-800">{input.elementType}</span>
                                                <span className="text-blue-600 ml-2">({input.type})</span>
                                            </div>
                                            <div className={`text-sm font-mono ${input.lag > 100 ? 'text-red-600' : 'text-blue-600'
                                                }`}>
                                                {input.lag.toFixed(1)}ms
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Action Buttons */}
                    <div className="flex gap-4 pt-4 border-t border-slate-200">
                        <button
                            onClick={handleClearMetrics}
                            className="flex-1 py-3 px-4 bg-slate-600 hover:bg-slate-700 text-white font-bold rounded-xl transition-colors duration-200"
                        >
                            <i className="fa-solid fa-trash mr-2"></i>
                            Clear Metrics
                        </button>
                        <button
                            onClick={handleExportMetrics}
                            className="flex-1 py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-colors duration-200"
                        >
                            <i className="fa-solid fa-download mr-2"></i>
                            Export Data
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PerformanceDashboard;