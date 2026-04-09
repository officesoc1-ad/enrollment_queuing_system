'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';

export default function StudentPOVPage() {
  const { id } = useParams();
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lastUpdated, setLastUpdated] = useState(null);
  const intervalRef = useRef(null);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch(`/api/queue/${id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setStatus(data);
      setLastUpdated(new Date());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchStatus();

    // Poll every 60 seconds — saves Vercel invocations vs 30s
    const POLL_INTERVAL = 60_000;
    intervalRef.current = setInterval(fetchStatus, POLL_INTERVAL);

    // Visibility API: stop polling when tab is hidden, resume when visible
    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Tab hidden — stop wasting invocations
        if (intervalRef.current) clearInterval(intervalRef.current);
        intervalRef.current = null;
      } else {
        // Tab visible again — refresh immediately and restart polling
        fetchStatus();
        intervalRef.current = setInterval(fetchStatus, POLL_INTERVAL);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [fetchStatus]);

  // Stop polling once the student's queue entry reaches a terminal state
  useEffect(() => {
    if (status?.entry?.status === 'completed' || status?.entry?.status === 'skipped') {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
  }, [status]);

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Loading your queue status...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container" style={{ marginTop: '32px' }}>
        <div className="alert alert-danger">{error}</div>
      </div>
    );
  }

  const { entry, position, aheadCount, currentServing, isQueueActive } = status;
  const schedule = entry.enrollment_schedules;
  const course = entry.courses;

  const formatTime = (time) => {
    if (!time) return '';
    const [h, m] = time.split(':');
    const hour = parseInt(h);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
    return `${displayHour}:${m} ${ampm}`;
  };

  const yearSuffix = (y) => ['', '1st', '2nd', '3rd', '4th'][y] || `${y}th`;
  const typeLabel = entry.enrollment_type === 'block_section' ? 'Block Section' : 'Irregular / Free Select';

  const isCurrentlyServing = entry.status === 'serving';
  const isCompleted = entry.status === 'completed';
  const isSkipped = entry.status === 'skipped';

  const formatLastUpdated = () => {
    if (!lastUpdated) return '';
    return lastUpdated.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit' });
  };

  return (
    <>
      <section className="page-header">
        <div className="container">
          <h1 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <img src="/soc2.png" alt="SOC Logo" style={{ height: '36px', width: 'auto' }} /> Your Queue Status
          </h1>
          <p>
            {course?.code} — {yearSuffix(entry.year_level)} Year — {typeLabel}
          </p>
        </div>
      </section>

      <div className="container" style={{ maxWidth: '600px' }}>
        {/* Auto-refresh notice */}
        {entry.status === 'waiting' && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '10px 16px',
            marginBottom: '16px',
            borderRadius: '8px',
            background: '#f0f9ff',
            border: '1px solid #bae6fd',
            fontSize: '0.8125rem',
            color: '#0369a1'
          }}>
            <span>🔄 Auto-refreshes every 60 seconds{document.hidden ? ' (paused)' : ''}</span>
            <span style={{ color: '#6b7280' }}>Last: {formatLastUpdated()}</span>
          </div>
        )}

        {/* Queue Number Card */}
        <div className="card" style={{ marginBottom: '24px' }}>
          <div className="queue-number-display">
            <span className="queue-number-label">Your Queue Number</span>
            <span className="queue-number-big">{entry.queue_number}</span>
            <span style={{ color: '#6b7280', marginTop: '4px' }}>{entry.student_name}</span>
          </div>
        </div>

        {/* Status Card */}
        <div className="card" style={{ marginBottom: '24px' }}>
          {isCompleted && (
            <div className="alert alert-success" style={{ textAlign: 'center' }}>
              ✅ <strong>Your enrollment has been processed!</strong>
            </div>
          )}

          {isSkipped && (
            <div className="alert alert-warning" style={{ textAlign: 'center' }}>
              ⏭️ <strong>You have been skipped.</strong> Please proceed to the encoding room for assistance.
            </div>
          )}

          {isCurrentlyServing && (
            <div className="alert alert-success" style={{ textAlign: 'center', fontSize: '1.125rem' }}>
              🔔 <strong>It&apos;s your turn! Please proceed to the encoding room now.</strong>
            </div>
          )}

          {entry.status === 'waiting' && (
            <>
              {isQueueActive && schedule?.is_active ? (
                <div className="alert alert-info" style={{ textAlign: 'center' }}>
                  <span className="pulse-dot" style={{ marginRight: '8px' }}></span>
                  <strong>Your year level is currently enrolling!</strong>
                </div>
              ) : (
                <div className="alert alert-warning" style={{ textAlign: 'center' }}>
                  ⏳ Your queue will start at{' '}
                  <strong>{formatTime(schedule?.start_time)}</strong> on{' '}
                  <strong>{schedule?.schedule_date}</strong>
                </div>
              )}
            </>
          )}
        </div>

        {/* Position Info */}
        {entry.status === 'waiting' && (
          <div className="grid grid-3" style={{ marginBottom: '24px' }}>
            <div className="card stat-card">
              <div className="stat-value">{currentServing || '—'}</div>
              <div className="stat-label">Now Serving</div>
            </div>
            <div className="card stat-card">
              <div className="stat-value">{entry.queue_number}</div>
              <div className="stat-label">Your Number</div>
            </div>
            <div className="card stat-card">
              <div className="stat-value">{aheadCount}</div>
              <div className="stat-label">Ahead of You</div>
            </div>
          </div>
        )}

        {/* Details */}
        <div className="card">
          <h3 className="card-title" style={{ marginBottom: '16px' }}>Details</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '0.9375rem' }}>
            <div>
              <span style={{ color: '#6b7280', fontWeight: 600, fontSize: '0.8125rem' }}>Student ID</span>
              <p style={{ fontWeight: 600 }}>{entry.student_id}</p>
            </div>
            <div>
              <span style={{ color: '#6b7280', fontWeight: 600, fontSize: '0.8125rem' }}>Course</span>
              <p style={{ fontWeight: 600 }}>{course?.code}</p>
            </div>
            <div>
              <span style={{ color: '#6b7280', fontWeight: 600, fontSize: '0.8125rem' }}>Year Level</span>
              <p style={{ fontWeight: 600 }}>{yearSuffix(entry.year_level)} Year</p>
            </div>
            <div>
              <span style={{ color: '#6b7280', fontWeight: 600, fontSize: '0.8125rem' }}>Type</span>
              <p style={{ fontWeight: 600 }}>{typeLabel}</p>
            </div>
            <div>
              <span style={{ color: '#6b7280', fontWeight: 600, fontSize: '0.8125rem' }}>Status</span>
              <p><span className={`badge badge-${entry.status}`}>{entry.status}</span></p>
            </div>
            <div>
              <span style={{ color: '#6b7280', fontWeight: 600, fontSize: '0.8125rem' }}>Schedule</span>
              <p style={{ fontWeight: 600 }}>{schedule?.schedule_date}</p>
            </div>
          </div>
        </div>

        {/* Navigation Actions */}
        <div style={{ display: 'flex', gap: '16px', marginTop: '32px', justifyContent: 'center' }}>
          <Link href="/" className="btn btn-outline" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            🏠 Back to Home
          </Link>
          <Link href="/register" className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            📝 Register Another
          </Link>
        </div>
      </div>
    </>
  );
}
