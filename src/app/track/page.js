'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import InteractiveParticles from '@/components/InteractiveParticles';
import Turnstile from '@/components/Turnstile';

export default function TrackPage() {
  const router = useRouter();
  const [studentId, setStudentId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [turnstileToken, setTurnstileToken] = useState('');
  const [turnstileResetKey, setTurnstileResetKey] = useState(0);

  const handleTurnstileVerify = useCallback((token) => {
    setTurnstileToken(token);
  }, []);

  const handleTurnstileExpire = useCallback(() => {
    setTurnstileToken('');
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!studentId.trim()) {
      setError('Please enter your Student ID');
      return;
    }
    if (!/^\d{8}$/.test(studentId.trim())) {
      setError('Student ID must be exactly 8 digits');
      return;
    }
    if (!turnstileToken) {
      setError('Please complete the bot verification');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const params = new URLSearchParams({
        student_id: studentId.trim(),
        turnstile_token: turnstileToken
      });
      const res = await fetch(`/api/track?${params}`);
      const data = await res.json();

      if (!res.ok) throw new Error(data.error);

      // Redirect to their existing queue tracker
      router.push(`/student/${data.id}`);
    } catch (err) {
      setError(err.message);
      // Reset Turnstile for retry
      setTurnstileToken('');
      setTurnstileResetKey(k => k + 1);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: '#f3f4f6' }}>
      <section className="page-header" style={{ padding: '48px 0', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
        <InteractiveParticles />
        <div className="container" style={{ position: 'relative', zIndex: 1, pointerEvents: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <h1 className="track-title">
            <img src="/findqueue-icon.svg" alt="Find Queue Icon" className="track-title-icon" />
            Find Your Queue
          </h1>
          <p style={{ fontSize: '1.125rem', opacity: 0.9 }}>Enter your Student ID to check your queue status</p>
        </div>
      </section>

      <div className="container" style={{ maxWidth: '500px', flex: 1, marginTop: '32px' }}>
        <div className="card" style={{ padding: '32px' }}>
          {error && <div className="alert alert-danger" style={{ marginBottom: '24px' }}>{error}</div>}

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">Student ID</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. 12345678"
                value={studentId}
                onChange={e => setStudentId(e.target.value)}
                autoComplete="off"
                maxLength={8}
                minLength={8}
                pattern="\d{8}"
                title="Student ID must be exactly 8 digits"
                required
                autoFocus
              />
            </div>

            {/* Cloudflare Turnstile bot protection */}
            <Turnstile
              siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || '1x00000000000000000000AA'}
              onVerify={handleTurnstileVerify}
              onExpire={handleTurnstileExpire}
              resetKey={turnstileResetKey}
            />

            <button
              type="submit"
              className="btn btn-primary btn-lg"
              style={{ width: '100%', marginTop: '16px' }}
              disabled={loading || !turnstileToken}
            >
              {loading ? 'Searching...' : !turnstileToken ? 'Verifying...' : 'Find Queue'}
            </button>
          </form>

          <div style={{ marginTop: '24px', textAlign: 'center' }}>
            <Link href="/" style={{ color: 'var(--primary-800)', textDecoration: 'none', fontWeight: 600 }}>
              ← Back to Home
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
