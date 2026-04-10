'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import InteractiveParticles from '@/components/InteractiveParticles';
import Turnstile from '@/components/Turnstile';
import { isWithinCampus } from '@/lib/geofence';

export default function RegisterPage() {
  const router = useRouter();
  const [courses, setCourses] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [turnstileToken, setTurnstileToken] = useState('');
  const [turnstileResetKey, setTurnstileResetKey] = useState(0);

  // Location state
  const [locationStatus, setLocationStatus] = useState('checking'); // 'checking' | 'granted' | 'denied' | 'outside' | 'unsupported'
  const [locationError, setLocationError] = useState('');
  const [userCoords, setUserCoords] = useState(null);

  const [form, setForm] = useState({
    student_name: '',
    student_id: '',
    course_id: '',
    year_level: '',
    enrollment_type: 'block_section'
  });

  // ============================================
  // Step 1: Request GPS location on mount
  // ============================================
  useEffect(() => {
    if (!navigator.geolocation) {
      setLocationStatus('unsupported');
      setLocationError('Your browser does not support GPS location. Please use a modern browser on your phone.');
      return;
    }

    setLocationStatus('checking');

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        const check = isWithinCampus(latitude, longitude);

        if (check.allowed) {
          setUserCoords({ latitude, longitude });
          setLocationStatus('granted');
        } else {
          setLocationStatus('outside');
          setLocationError(
            `You must be physically on campus to register. You appear to be approximately ${check.distance} meters away from campus.`
          );
        }
      },
      (err) => {
        setLocationStatus('denied');
        switch (err.code) {
          case err.PERMISSION_DENIED:
            setLocationError(
              'Location access was denied. Please enable location permissions in your browser settings and reload this page.'
            );
            break;
          case err.POSITION_UNAVAILABLE:
            setLocationError(
              'Unable to determine your location. Please make sure GPS is enabled on your device and try again.'
            );
            break;
          case err.TIMEOUT:
            setLocationError(
              'Location request timed out. Please check your GPS signal and reload this page.'
            );
            break;
          default:
            setLocationError('An unknown error occurred while checking your location. Please try again.');
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0
      }
    );
  }, []);

  // ============================================
  // Fetch courses & schedules
  // ============================================
  useEffect(() => {
    async function fetchData() {
      try {
        const [coursesRes, schedulesRes] = await Promise.all([
          fetch('/api/courses'),
          fetch('/api/schedules')
        ]);
        const coursesData = await coursesRes.json();
        const schedulesData = await schedulesRes.json();
        setCourses(coursesData);
        setSchedules(schedulesData);
      } catch (err) {
        setError('Failed to load data');
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const handleChange = (e) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
    setError('');
  };

  const handleTypeChange = (type) => {
    setForm(prev => ({ ...prev, enrollment_type: type }));
    setError('');
  };

  const handleTurnstileVerify = useCallback((token) => {
    setTurnstileToken(token);
  }, []);

  const handleTurnstileExpire = useCallback(() => {
    setTurnstileToken('');
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!form.student_name || !form.student_id || !form.course_id || !form.year_level) {
      setError('All fields are required');
      return;
    }

    if (!turnstileToken) {
      setError('Please complete the bot verification');
      return;
    }

    if (!userCoords) {
      setError('Location verification is required');
      return;
    }

    setSubmitting(true);
    try {
      const t = Date.now();
      // Fetch schedules fresh (bypass edge cache)
      const schedulesRes = await fetch(`/api/schedules?t=${t}`, { cache: 'no-store' });
      const freshSchedules = await schedulesRes.json();

      // Find the matching schedule (exists for this course/year/type)
      const schedule = freshSchedules.find(
        s => s.course_id === form.course_id &&
             s.year_level === parseInt(form.year_level) &&
             s.enrollment_type === form.enrollment_type
      );

      if (!schedule) {
        throw new Error('No schedule found for your selection. Please check with the admin.');
      }

      const res = await fetch('/api/queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schedule_id: schedule.id,
          course_id: form.course_id,
          year_level: parseInt(form.year_level),
          enrollment_type: form.enrollment_type,
          student_name: form.student_name,
          student_id: form.student_id,
          turnstileToken,
          latitude: userCoords.latitude,
          longitude: userCoords.longitude
        })
      });

      const data = await res.json();

      // Handle duplicate registration — redirect to existing queue
      if (res.status === 409 && data.existingEntryId) {
        router.push(`/student/${data.existingEntryId}`);
        return;
      }

      if (!res.ok) throw new Error(data.error);

      // Redirect to student POV page
      router.push(`/student/${data.id}`);
    } catch (err) {
      setError(err.message);
      // Reset Turnstile so user gets a fresh token for retry
      setTurnstileToken('');
      setTurnstileResetKey(k => k + 1);
      setTimeout(() => setError(''), 5000);
    } finally {
      setSubmitting(false);
    }
  };

  // ============================================
  // Loading state
  // ============================================
  if (loading && locationStatus === 'checking') {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Verifying your location...</p>
      </div>
    );
  }

  // ============================================
  // Location Gate — block the form if location is not verified
  // ============================================
  if (locationStatus !== 'granted') {
    return (
      <>
        <section className="page-header" style={{ textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
          <InteractiveParticles />
          <div className="container" style={{ position: 'relative', zIndex: 1, pointerEvents: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <h1 style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', margin: 0, paddingBottom: '8px' }}>
              <img src="/register-icon.svg" alt="Register Icon" style={{ height: '40px', width: 'auto' }} />
              Queue Registration
            </h1>
            <p style={{ margin: 0 }}>Enter your details to join the enrollment queue</p>
          </div>
        </section>

        <div className="container" style={{ maxWidth: '500px' }}>
          <div className="card" style={{ padding: '32px', textAlign: 'center' }}>

            {locationStatus === 'checking' && (
              <>
                <div style={{ fontSize: '3rem', marginBottom: '16px' }}>📍</div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '8px', color: '#1e40af' }}>
                  Checking Your Location
                </h2>
                <p style={{ color: '#6b7280', marginBottom: '24px' }}>
                  Please allow location access when prompted by your browser.
                </p>
                <div className="spinner" style={{ margin: '0 auto' }}></div>
              </>
            )}

            {locationStatus === 'denied' && (
              <>
                <div style={{ fontSize: '3rem', marginBottom: '16px' }}>🚫</div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '8px', color: '#dc2626' }}>
                  Location Access Required
                </h2>
                <div className="alert alert-danger" style={{ textAlign: 'left', marginBottom: '24px' }}>
                  {locationError}
                </div>
                <div style={{
                  textAlign: 'left',
                  padding: '16px',
                  borderRadius: '8px',
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  marginBottom: '20px'
                }}>
                  <p style={{ fontWeight: 700, marginBottom: '8px', fontSize: '0.9rem' }}>How to enable location:</p>
                  <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '0.85rem', color: '#475569', lineHeight: 1.8 }}>
                    <li><strong>Chrome (Android):</strong> Tap the lock icon in the address bar → Permissions → Location → Allow</li>
                    <li><strong>Safari (iPhone):</strong> Go to Settings → Safari → Location → Allow</li>
                    <li><strong>Chrome (Desktop):</strong> Click the lock icon in the address bar → Site Settings → Location → Allow</li>
                  </ul>
                </div>
                <button
                  className="btn btn-primary btn-lg"
                  style={{ width: '100%' }}
                  onClick={() => window.location.reload()}
                >
                  🔄 Reload and Try Again
                </button>
              </>
            )}

            {locationStatus === 'outside' && (
              <>
                <div style={{ fontSize: '3rem', marginBottom: '16px' }}>📍</div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '8px', color: '#d97706' }}>
                  You Must Be On Campus
                </h2>
                <div className="alert alert-warning" style={{ textAlign: 'left', marginBottom: '24px' }}>
                  {locationError}
                </div>
                <p style={{ color: '#6b7280', fontSize: '0.9rem', marginBottom: '20px' }}>
                  Registration is only available for students physically present at the Holy Angel University campus.
                  Please proceed to the campus and try again.
                </p>
                <button
                  className="btn btn-primary btn-lg"
                  style={{ width: '100%' }}
                  onClick={() => window.location.reload()}
                >
                  🔄 Check Location Again
                </button>
              </>
            )}

            {locationStatus === 'unsupported' && (
              <>
                <div style={{ fontSize: '3rem', marginBottom: '16px' }}>⚠️</div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '8px', color: '#dc2626' }}>
                  Browser Not Supported
                </h2>
                <div className="alert alert-danger" style={{ textAlign: 'left' }}>
                  {locationError}
                </div>
              </>
            )}

          </div>
        </div>
      </>
    );
  }

  // ============================================
  // Main registration form (only shown when location is verified)
  // ============================================
  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Loading registration form...</p>
      </div>
    );
  }

  return (
    <>
      <section className="page-header" style={{ textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
        <InteractiveParticles />
        <div className="container" style={{ position: 'relative', zIndex: 1, pointerEvents: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <h1 style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', margin: 0, paddingBottom: '8px' }}>
            <img src="/register-icon.svg" alt="Register Icon" style={{ height: '40px', width: 'auto' }} />
            Queue Registration
          </h1>
          <p style={{ margin: 0 }}>Enter your details to join the enrollment queue</p>
        </div>
      </section>

      <div className="container" style={{ maxWidth: '600px' }}>
        {/* Location verified badge */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '10px 16px',
          marginBottom: '16px',
          borderRadius: '8px',
          background: '#f0fdf4',
          border: '1px solid #bbf7d0',
          fontSize: '0.8125rem',
          color: '#166534'
        }}>
          <span>✅</span>
          <span>Location verified — you are on campus</span>
        </div>

        <div className="card">
          {error && <div className="alert alert-danger" style={{ marginBottom: '16px' }}>{error}</div>}

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">Full Name</label>
              <input
                type="text"
                name="student_name"
                className="form-input"
                placeholder="e.g. Juan Dela Cruz"
                value={form.student_name}
                onChange={handleChange}
                autoComplete="off"
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Student ID</label>
              <input
                type="text"
                name="student_id"
                className="form-input"
                placeholder="e.g. 12345678"
                value={form.student_id}
                onChange={handleChange}
                autoComplete="off"
                maxLength={8}
                minLength={8}
                pattern="\d{8}"
                title="Student ID must be exactly 8 digits"
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Course / Program</label>
              <select
                name="course_id"
                className="form-select"
                value={form.course_id}
                onChange={handleChange}
                required
              >
                <option value="">Select your course</option>
                {courses.map(c => (
                  <option key={c.id} value={c.id}>{c.code} — {c.name}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Year Level</label>
              <select
                name="year_level"
                className="form-select"
                value={form.year_level}
                onChange={handleChange}
                required
              >
                <option value="">Select year level</option>
                <option value="1">1st Year</option>
                <option value="2">2nd Year</option>
                <option value="3">3rd Year</option>
                <option value="4">4th Year</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Enrollment Type</label>
              <div className="radio-group">
                <label
                  className={`radio-option ${form.enrollment_type === 'block_section' ? 'selected' : ''}`}
                >
                  <input
                    type="radio"
                    name="enrollment_type"
                    value="block_section"
                    checked={form.enrollment_type === 'block_section'}
                    onChange={() => handleTypeChange('block_section')}
                  />
                  Block Section
                </label>
                <label
                  className={`radio-option ${form.enrollment_type === 'irregular' ? 'selected' : ''}`}
                >
                  <input
                    type="radio"
                    name="enrollment_type"
                    value="irregular"
                    checked={form.enrollment_type === 'irregular'}
                    onChange={() => handleTypeChange('irregular')}
                  />
                  Irregular / Free Select
                </label>
              </div>
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
              style={{ width: '100%' }}
              disabled={submitting || !turnstileToken}
            >
              {submitting ? 'Registering...' : !turnstileToken ? 'Verifying...' : 'Join Queue'}
            </button>
          </form>
        </div>
      </div>
    </>
  );
}
