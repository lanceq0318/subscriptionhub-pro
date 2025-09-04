'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const router = useRouter();
  const searchParams = useSearchParams();

  const handleLogin = (e) => {
    e.preventDefault();
    setError('');

    if (email === 'demo@example.com' && password === 'demo123') {
      document.cookie = 'isLoggedIn=true; path=/; max-age=86400; samesite=lax';
      localStorage.setItem('isLoggedIn', 'true');
      localStorage.setItem('userEmail', email);

      const cb = searchParams.get('callbackUrl') || '/dashboard';
      router.replace(cb);
    } else {
      setError('Invalid email or password. Use demo@example.com / demo123');
    }
  };

  const fillDemo = () => {
    setEmail('demo@example.com');
    setPassword('demo123');
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', padding: '20px' }}>
      <div style={{ background: 'white', padding: '40px', borderRadius: '10px', boxShadow: '0 10px 40px rgba(0,0,0,0.2)', width: '100%', maxWidth: '400px' }}>
        <h1 style={{ textAlign: 'center', marginBottom: '30px', color: '#333' }}>Subscription Tracker</h1>

        <div style={{ background: '#e3f2fd', padding: '15px', borderRadius: '5px', marginBottom: '20px' }}>
          <p style={{ margin: '0 0 10px 0', fontWeight: 'bold', color: '#1976d2' }}>Demo Account:</p>
          <p style={{ margin: 0, fontSize: '14px' }}>Email: demo@example.com<br />Password: demo123</p>
          <button onClick={fillDemo} style={{ marginTop: '10px', padding: '5px 15px', background: '#1976d2', color: 'white', border: 'none', borderRadius: '3px', cursor: 'pointer' }}>Use Demo Login</button>
        </div>

        {error && (
          <div style={{ background: '#fee', color: '#c00', padding: '10px', borderRadius: '5px', marginBottom: '20px' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleLogin}>
          <div style={{ marginBottom: '20px' }}>
            <label>Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '5px' }} placeholder="demo@example.com" />
          </div>
          <div style={{ marginBottom: '20px' }}>
            <label>Password</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '5px' }} placeholder="demo123" />
          </div>
          <button type="submit" style={{ width: '100%', padding: '12px', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white', border: 'none', borderRadius: '5px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer' }}>
            Sign In
          </button>
        </form>
      </div>
    </div>
  );
}
