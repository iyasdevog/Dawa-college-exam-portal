import React, { useState, useEffect } from 'react';

const OfflineStatusIndicator: React.FC<{ className?: string }> = ({ className = '' }) => {
    const [isOnline, setIsOnline] = useState(navigator.onLine);

    useEffect(() => {
        const updateStatus = () => setIsOnline(navigator.onLine);
        window.addEventListener('online', updateStatus);
        window.addEventListener('offline', updateStatus);
        return () => {
            window.removeEventListener('online', updateStatus);
            window.removeEventListener('offline', updateStatus);
        };
    }, []);

    if (isOnline) return null;

    return (
        <div className={`flex items-center gap-2 px-3 py-2 rounded-lg bg-red-500 text-white text-sm font-medium ${className}`}>
            <i className="fa-solid fa-wifi-slash text-xs"></i>
            <span>Offline Mode</span>
        </div>
    );
};

export default OfflineStatusIndicator;