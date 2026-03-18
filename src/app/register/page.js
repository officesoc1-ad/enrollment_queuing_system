'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

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

  // Find matching schedule based on selected year_level and enrollment_type
  const matchingSchedule = schedules.find(
    s => s.year_level === parseInt(form.year_level) &&
         s.enrollment_type === form.enrollment_type &&
         s.is_active
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

    // Find any schedule (active or not) for this enrollment type + year level
    const schedule = schedules.find(
      s => s.year_level === parseInt(form.year_level) &&
           s.enrollment_type === form.enrollment_type
    );

    if (!schedule) {
      setError('No schedule found for your year level and enrollment type. Please check with the registrar.');
      return;
    }

    setSubmitting(true);
    try {
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
      if (!res.ok) throw new Error(data.error);

      // Redirect to student POV page
      router.push(`/student/${data.id}`);
    } catch (err) {
      setError(err.message);
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
      <section className="page-header">
        <div className="container">
          <h1>📝 Queue Registration</h1>
          <p>Enter your details to join the enrollment queue</p>
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
              />
            </div>

            <div className="form-group">
              <label className="form-label">Student ID</label>
              <input
                type="text"
                name="student_id"
                className="form-input"
                placeholder="e.g. 2024-00001"
                value={form.student_id}
                onChange={handleChange}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Course / Program</label>
              <select
                name="course_id"
                className="form-select"
                value={form.course_id}
                onChange={handleChange}
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

            {/* Show schedule info if a matching schedule exists */}
            {form.year_level && (
              <div style={{ marginBottom: '16px' }}>
                {matchingSchedule ? (
                  <div className="alert alert-success">
                    ✅ Your schedule: <strong>{matchingSchedule.schedule_date}</strong> from{' '}
                    <strong>{formatTime(matchingSchedule.start_time)}</strong> to{' '}
                    <strong>{formatTime(matchingSchedule.end_time)}</strong>
                  </div>
                ) : (
                  <div className="alert alert-warning">
                    ⏳ No active schedule found for your selection. You can still register and your queue will start when your schedule is activated.
                  </div>
                )}
              </div>
            )}

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
