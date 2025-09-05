'use client';

import { signIn } from 'next-auth/react';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

function LoginContent() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl') || '/dashboard';

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      padding: '20px'
    }}>
      <div style={{
        background: 'white',
        borderRadius: '16px',
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
        width: '100%',
        maxWidth: '400px',
        padding: '48px',
        textAlign: 'center'
      }}>
        {/* Logo */}
        <div style={{
          width: '80px',
          height: '80px',
          background: 'linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)',
          borderRadius: '16px',
          margin: '0 auto 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
            <rect x="3" y="3" width="7" height="7" />
            <rect x="14" y="3" width="7" height="7" />
            <rect x="14" y="14" width="7" height="7" />
            <rect x="3" y="14" width="7" height="7" />
          </svg>
        </div>

        <h1 style={{
          fontSize: '28px',
          fontWeight: '700',
          color: '#111827',
          marginBottom: '8px'
        }}>
          SubscriptionHub Pro
        </h1>
        
        <p style={{
          color: '#6B7280',
          fontSize: '16px',
          marginBottom: '32px'
        }}>
          Enterprise Subscription Management
        </p>

        {/* Azure AD Sign In Button */}
        <button
          onClick={() => signIn('azure-ad', { callbackUrl })}
          style={{
            width: '100%',
            padding: '14px',
            background: '#0078d4',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            fontSize: '16px',
            fontWeight: '600',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '12px',
            transition: 'background 0.2s',
            marginBottom: '16px'
          }}
          onMouseEnter={e => e.currentTarget.style.background = '#106ebe'}
          onMouseLeave={e => e.currentTarget.style.background = '#0078d4'}
        >
          {/* Microsoft Logo */}
          <svg width="20" height="20" viewBox="0 0 21 21" fill="currentColor">
            <path d="M10 0H0v10h10V0z"/>
            <path d="M21 0H11v10h10V0z" opacity="0.8"/>
            <path d="M10 11H0v10h10V11z" opacity="0.6"/>
            <path d="M21 11H11v10h10V11z" opacity="0.4"/>
          </svg>
          Sign in with Microsoft
        </button>

        <div style={{
          marginTop: '24px',
          paddingTop: '24px',
          borderTop: '1px solid #E5E7EB'
        }}>
          <p style={{
            fontSize: '12px',
            color: '#9CA3AF',
            lineHeight: '1.5'
          }}>
            Use your corporate Microsoft account to access the subscription management system.
          </p>
        </div>

        {/* Security Badge */}
        <div style={{
          marginTop: '24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          color: '#9CA3AF',
          fontSize: '12px'
        }}>
          <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
          </svg>
          Secured with Azure AD
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
      }}>
        <div>Loading...</div>
      </div>
    }>
      <LoginContent />
    </Suspense>
  );
}