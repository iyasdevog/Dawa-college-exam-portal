import React from 'react';

const SimpleApp: React.FC = () => {
    return (
        <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
            <h1>🎯 Simple Test App</h1>
            <p>If you can see this, React is working!</p>
            <div style={{ background: '#f0f0f0', padding: '10px', marginTop: '20px' }}>
                <h2>Status: ✅ App Loaded Successfully</h2>
                <p>This means the basic React setup is working.</p>
            </div>
        </div>
    );
};

export default SimpleApp;