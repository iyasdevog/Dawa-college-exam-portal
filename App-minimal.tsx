import React, { useState } from 'react';

// Minimal app without any complex dependencies
const MinimalApp: React.FC = () => {
    const [mode, setMode] = useState<'public' | 'admin'>('public');
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');

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

    if (mode === 'public') {
        return (
            <div style={{ minHeight: '100vh', background: '#1e293b', color: 'white', padding: '20px' }}>
                <div style={{ maxWidth: '800px', margin: '0 auto', textAlign: 'center' }}>
                    <h1 style={{ fontSize: '2rem', marginBottom: '20px' }}>🎓 AIC Da'wa College Exam Portal</h1>
                    <p style={{ marginBottom: '30px' }}>Welcome to the exam portal. This is a minimal test version.</p>
                    <button
                        onClick={() => setMode('admin')}
                        style={{
                            background: '#10b981',
                            color: 'white',
                            padding: '12px 24px',
                            border: 'none',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            fontSize: '16px'
                        }}
                    >
                        Admin Login
                    </button>
                </div>
            </div>
        );
    }

    if (mode === 'admin' && !isLoggedIn) {
        return (
            <div style={{ minHeight: '100vh', background: '#1e293b', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
                <div style={{ background: 'white', borderRadius: '20px', padding: '40px', maxWidth: '400px', width: '100%' }}>
                    <div style={{ textAlign: 'center', marginBottom: '30px' }}>
                        <div style={{ background: '#f1f5f9', color: '#1e293b', width: '60px', height: '60px', borderRadius: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', fontSize: '24px' }}>
                            🛡️
                        </div>
                        <h2 style={{ color: '#1e293b', margin: '0 0 10px 0' }}>Admin Gateway</h2>
                        <p style={{ color: '#64748b', fontSize: '12px', margin: 0 }}>FACULTY IDENTIFICATION REQUIRED</p>
                    </div>
                    <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                        <input
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            placeholder="Registry ID"
                            style={{
                                padding: '15px',
                                background: '#f8fafc',
                                border: '1px solid #e2e8f0',
                                borderRadius: '12px',
                                outline: 'none',
                                fontSize: '16px'
                            }}
                        />
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Security PIN"
                            style={{
                                padding: '15px',
                                background: '#f8fafc',
                                border: '1px solid #e2e8f0',
                                borderRadius: '12px',
                                outline: 'none',
                                fontSize: '16px'
                            }}
                        />
                        <button
                            type="submit"
                            style={{
                                background: '#1e293b',
                                color: 'white',
                                padding: '15px',
                                border: 'none',
                                borderRadius: '12px',
                                cursor: 'pointer',
                                fontSize: '14px',
                                fontWeight: 'bold',
                                textTransform: 'uppercase',
                                letterSpacing: '1px'
                            }}
                        >
                            Authenticate
                        </button>
                        <button
                            type="button"
                            onClick={() => setMode('public')}
                            style={{
                                background: 'transparent',
                                color: '#64748b',
                                border: 'none',
                                cursor: 'pointer',
                                fontSize: '12px',
                                fontWeight: 'bold',
                                textTransform: 'uppercase',
                                letterSpacing: '1px',
                                marginTop: '10px'
                            }}
                        >
                            Cancel Access
                        </button>
                    </form>
                </div>
            </div>
        );
    }

    return (
        <div style={{ minHeight: '100vh', background: '#f8fafc', padding: '20px' }}>
            <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
                <div style={{ background: 'white', borderRadius: '12px', padding: '20px', marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h1 style={{ color: '#1e293b', margin: 0 }}>Admin Dashboard</h1>
                    <button
                        onClick={handleLogout}
                        style={{
                            background: '#ef4444',
                            color: 'white',
                            padding: '8px 16px',
                            border: 'none',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            fontSize: '14px'
                        }}
                    >
                        Logout
                    </button>
                </div>
                <div style={{ background: 'white', borderRadius: '12px', padding: '40px', textAlign: 'center' }}>
                    <h2 style={{ color: '#1e293b', marginBottom: '20px' }}>✅ Minimal App Working!</h2>
                    <p style={{ color: '#64748b', marginBottom: '30px' }}>
                        This minimal version is working, which means the issue is in the complex dependencies.
                    </p>
                    <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '20px' }}>
                        <h3 style={{ color: '#166534', margin: '0 0 10px 0' }}>Next Steps:</h3>
                        <ul style={{ color: '#166534', textAlign: 'left', margin: 0 }}>
                            <li>The basic React app is working</li>
                            <li>The issue is likely in the dependency injection system</li>
                            <li>Or in one of the complex service imports</li>
                            <li>We need to add imports one by one to isolate the problem</li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default MinimalApp;