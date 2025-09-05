import Link from 'next/link';

export default function NotFound() {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      textAlign: 'center'
    }}>
      <div>
        <h2 style={{ fontSize: '24px', marginBottom: '16px' }}>404 - Page Not Found</h2>
        <Link href="/dashboard" style={{
          color: '#4F46E5',
          textDecoration: 'underline'
        }}>
          Return to Dashboard
        </Link>
      </div>
    </div>
  );
}