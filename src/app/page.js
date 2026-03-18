import Link from 'next/link';

export default function HomePage() {
  return (
    <>
      <section className="page-header" style={{ padding: '80px 0', textAlign: 'center' }}>
        <div className="container">
          <h1 style={{ fontSize: '2.5rem', marginBottom: '8px' }}>
            🎓 HAU Enrollment Queuing System
          </h1>
          <p style={{ fontSize: '1.125rem', maxWidth: '600px', margin: '0 auto' }}>
            Holy Angel University — School of Computing<br />
            Digital enrollment queue management
          </p>
        </div>
      </section>

      <div className="container" style={{ marginTop: '-40px' }}>
        <div className="grid grid-3" style={{ maxWidth: '900px', margin: '0 auto' }}>
          <Link href="/register" style={{ textDecoration: 'none' }}>
            <div className="card" style={{ textAlign: 'center', cursor: 'pointer' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '12px' }}>📝</div>
              <h2 style={{ fontSize: '1.125rem', fontWeight: 700, color: '#111827', marginBottom: '8px' }}>
                Register
              </h2>
              <p style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                Enter the enrollment queue
              </p>
            </div>
          </Link>

          <Link href="/queue" style={{ textDecoration: 'none' }}>
            <div className="card" style={{ textAlign: 'center', cursor: 'pointer' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '12px' }}>📊</div>
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
              <div style={{ fontSize: '2.5rem', marginBottom: '12px' }}>⚙️</div>
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
