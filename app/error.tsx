'use client';

export default function Error({
  error,
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px'
    }}>
      <div style={{ textAlign: 'center', maxWidth: '400px' }}>
        <h2 style={{ fontSize: '24px', marginBottom: '16px' }}>Something went wrong!</h2>
        <p style={{ marginBottom: '20px', color: '#6B7280' }}>{error.message}</p>
        <button onClick={reset} style={{
          padding: '10px 20px',
          background: '#4F46E5',
          color: 'white',
          border: 'none',
          borderRadius: '6px',
          cursor: 'pointer'
        }}>
          Try again
        </button>
      </div>
    </div>
  );
}