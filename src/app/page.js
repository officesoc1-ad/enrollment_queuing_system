import Link from 'next/link';
import InteractiveParticles from '@/components/InteractiveParticles';

export default async function HomePage({ searchParams }) {
  const params = await searchParams;
  const kioskUnauthorized = params?.kiosk === 'unauthorized';

  return (
    <>
      <section className="page-header" style={{ padding: '80px 0', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
        <InteractiveParticles />
        <div className="container" style={{ position: 'relative', zIndex: 1, pointerEvents: 'none' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '24px' }}>
            <img src="/soc2.png" alt="SOC Logo" style={{ height: '120px', width: 'auto' }} />
          </div>
          <h1 style={{ fontSize: '2.5rem', marginBottom: '8px' }}>
            <span><span className="hau-text">HAU</span> Enrollment Queuing System</span>
          </h1>
          <p style={{ fontSize: '1.125rem', maxWidth: '600px', margin: '0 auto' }}>
            Holy Angel University · School of Computing<br />
            Digital enrollment queue management
          </p>
        </div>
      </section>

      <div className="container" style={{ marginTop: '40px' }}>
        {kioskUnauthorized && (
          <div style={{
            maxWidth: '900px',
            margin: '0 auto 24px auto',
            padding: '16px 20px',
            borderRadius: '12px',
            border: '2px solid #fca5a5',
            background: 'linear-gradient(135deg, #fef2f2, #fee2e2)',
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          }}>
            <span style={{ fontSize: '1.5rem' }}>🔒</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#991b1b' }}>
                Access Restricted
              </div>
              <div style={{ fontSize: '0.85rem', color: '#b91c1c', marginTop: '2px' }}>
                This device is not authorized. Registration and queue board are only available on the designated computer at the encoding room.
              </div>
            </div>
          </div>
        )}
        <div className="grid grid-3" style={{ maxWidth: '900px', margin: '0 auto' }}>
          <Link href="/register" style={{ textDecoration: 'none' }}>
            <div className="card" style={{ textAlign: 'center', cursor: 'pointer', height: '100%' }}>
              <div style={{ marginBottom: '12px', display: 'flex', justifyContent: 'center', alignItems: 'center', height: '56px' }}><img src="/register-icon.svg" alt="Register Icon" style={{ height: '48px', width: 'auto' }} /></div>
              <h2 style={{ fontSize: '1.125rem', fontWeight: 700, color: '#111827', marginBottom: '8px' }}>
                Register
              </h2>
              <p style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                Enter the enrollment queue
              </p>
            </div>
          </Link>

          <Link href="/track" style={{ textDecoration: 'none' }}>
            <div className="card" style={{ textAlign: 'center', cursor: 'pointer', height: '100%' }}>
              <div style={{ marginBottom: '12px', display: 'flex', justifyContent: 'center', alignItems: 'center', height: '56px' }}><img src="/findqueue-icon.svg" alt="Find Queue Icon" style={{ height: '48px', width: 'auto' }} /></div>
              <h2 style={{ fontSize: '1.125rem', fontWeight: 700, color: '#111827', marginBottom: '8px' }}>
                Find Queue
              </h2>
              <p style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                Track your real-time status
              </p>
            </div>
          </Link>

          <Link href="/queue" style={{ textDecoration: 'none' }}>
            <div className="card" style={{ textAlign: 'center', cursor: 'pointer' }}>
              <div style={{ marginBottom: '12px', display: 'flex', justifyContent: 'center', alignItems: 'center', height: '56px' }}><img src="/queueboard-icon.svg" alt="Queue Board Icon" style={{ height: '48px', width: 'auto' }} /></div>
              <h2 style={{ fontSize: '1.125rem', fontWeight: 700, color: '#111827', marginBottom: '8px' }}>
                Queue Board
              </h2>
              <p style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                View all active queues
              </p>
            </div>
          </Link>

          <Link href="/admin" style={{ textDecoration: 'none' }}>
            <div className="card" style={{ textAlign: 'center', cursor: 'pointer' }}>
              <div style={{ marginBottom: '12px', display: 'flex', justifyContent: 'center', alignItems: 'center', height: '56px' }}><img src="/admin-icon.svg" alt="Admin Icon" style={{ height: '48px', width: 'auto' }} /></div>
              <h2 style={{ fontSize: '1.125rem', fontWeight: 700, color: '#111827', marginBottom: '8px' }}>
                Admin
              </h2>
              <p style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                Manage queues & schedules
              </p>
            </div>
          </Link>
        </div>
      </div>
    </>
  );
}
