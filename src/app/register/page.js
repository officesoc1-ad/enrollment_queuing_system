'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import InteractiveParticles from '@/components/InteractiveParticles';

export default function RegisterPage() {
  const router = useRouter();
  const [courses, setCourses] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    student_name: '',
    student_id: '',
    course_id: '',
    year_level: '',
    enrollment_type: 'block_section'
  });

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

  // Get today's date strictly in Philippine Time (Asia/Manila)
  const getPHDate = () => {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(new Date());
  };

  // Find matching schedule based on course, year, type, active status, AND proper timezone date
  const matchingSchedule = schedules.find(
    s => s.course_id === form.course_id &&
         s.year_level === parseInt(form.year_level) &&
         s.enrollment_type === form.enrollment_type &&
         s.is_active &&
         s.schedule_date === getPHDate()
  );

  const handleChange = (e) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
    setError('');
  };

  const handleTypeChange = (type) => {
    setForm(prev => ({ ...prev, enrollment_type: type }));
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!form.student_name || !form.student_id || !form.course_id || !form.year_level) {
      setError('All fields are required');
      return;
    }

    setSubmitting(true);
    try {
      const t = Date.now();
      // Fetch both schedules and queue configs fresh (bypass edge cache)
      const [schedulesRes, queuesRes] = await Promise.all([
        fetch(`/api/schedules?t=${t}`, { cache: 'no-store' }),
        fetch(`/api/queue?t=${t}`, { cache: 'no-store' })
      ]);
      const freshSchedules = await schedulesRes.json();
      const freshQueues = await queuesRes.json();

      // Find the matching schedule (exists for this course/year/type)
      const schedule = freshSchedules.find(
        s => s.course_id === form.course_id &&
             s.year_level === parseInt(form.year_level) &&
             s.enrollment_type === form.enrollment_type
      );

      if (!schedule) {
        throw new Error('No schedule found for your selection. Please check with the admin.');
      }

      // Check the queue config's is_active — this is the toggle the admin uses
      const queueConfig = freshQueues.find(
        q => q.schedule_id === schedule.id &&
             q.course_id === form.course_id &&
             q.year_level === parseInt(form.year_level) &&
             q.enrollment_type === form.enrollment_type &&
             q.is_active === true
      );

      if (!queueConfig) {
        throw new Error('This queue is currently inactive. Please wait for an admin to activate it.');
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
          student_id: form.student_id
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
      setTimeout(() => setError(''), 5000);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Loading registration form...</p>
      </div>
    );
  }

  const formatTime = (time) => {
    const [h, m] = time.split(':');
    const hour = parseInt(h);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
    return `${displayHour}:${m} ${ampm}`;
  };

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



            <button
              type="submit"
              className="btn btn-primary btn-lg"
              style={{ width: '100%' }}
              disabled={submitting}
            >
              {submitting ? 'Registering...' : 'Join Queue'}
            </button>
          </form>
        </div>
      </div>
    </>
  );
}
