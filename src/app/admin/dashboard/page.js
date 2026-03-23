'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function AdminDashboardPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('queues');
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState(null);

  // Data states
  const [queues, setQueues] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [courses, setCourses] = useState([]);
  const [selectedQueue, setSelectedQueue] = useState(null);
  const [queueEntries, setQueueEntries] = useState([]);

  // Modal states
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [showCourseModal, setShowCourseModal] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState(null);

  // Form states
  const [scheduleForm, setScheduleForm] = useState({
    course_id: '',
    enrollment_type: 'block_section',
    year_level: '1',
    schedule_date: '',
    start_time: '',
    end_time: ''
  });
  const [courseForm, setCourseForm] = useState({ code: '', name: '' });

  // Auth check
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        router.push('/admin');
      } else {
        setSession(session);
        setLoading(false);
      }
    });
  }, [router]);

  // Data fetching
  const fetchAll = useCallback(async () => {
    try {
      const [qRes, sRes, cRes] = await Promise.all([
        fetch('/api/queue'),
        fetch('/api/schedules'),
        fetch('/api/courses')
      ]);
      setQueues(await qRes.json());
      setSchedules(await sRes.json());
      setCourses(await cRes.json());
    } catch (err) {
      console.error('Failed to fetch data:', err);
    }
  }, []);

  useEffect(() => {
    if (session) fetchAll();
  }, [session, fetchAll]);

  // Real-time subscriptions
  useEffect(() => {
    const channel = supabase
      .channel('admin-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'queue_configs' }, fetchAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'queue_entries' }, () => {
        fetchAll();
        if (selectedQueue) fetchQueueEntries(selectedQueue);
      })
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [fetchAll, selectedQueue]);

  const fetchQueueEntries = async (config) => {
    try {
      const params = new URLSearchParams({
        schedule_id: config.schedule_id,
        course_id: config.course_id,
        year_level: config.year_level,
        enrollment_type: config.enrollment_type
      });
      const res = await fetch(`/api/queue-entries?${params}`);
      const data = await res.json();
      setQueueEntries(data);
    } catch (err) {
      console.error('Failed to fetch entries:', err);
    }
  };

  // Handlers
  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/admin');
  };

  const handleCallNext = async (configId) => {
    try {
      await fetch('/api/queue/next', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ configId })
      });
      fetchAll();
      if (selectedQueue) fetchQueueEntries(selectedQueue);
    } catch (err) {
      console.error('Failed to call next:', err);
    }
  };

  const handleStatusChange = async (entryId, action) => {
    try {
      await fetch('/api/queue/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entryId, action })
      });
      fetchAll();
      if (selectedQueue) fetchQueueEntries(selectedQueue);
    } catch (err) {
      console.error('Failed to update status:', err);
    }
  };

  const handleToggleQueue = async (configId, isActive) => {
    try {
      await fetch(`/api/queue-config/${configId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: isActive })
      });
      fetchAll();
    } catch (err) {
      console.error('Failed to toggle queue:', err);
    }
  };

  const handleToggleSchedule = async (scheduleId, isActive) => {
    try {
      await fetch(`/api/schedules/${scheduleId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: isActive })
      });
      fetchAll();
    } catch (err) {
      console.error('Failed to toggle schedule:', err);
    }
  };

  const handleSaveSchedule = async (e) => {
    e.preventDefault();
    try {
      if (editingSchedule) {
        await fetch(`/api/schedules/${editingSchedule.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...scheduleForm,
            year_level: parseInt(scheduleForm.year_level)
          })
        });
      } else {
        await fetch('/api/schedules', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...scheduleForm,
            year_level: parseInt(scheduleForm.year_level)
          })
        });
      }
      setShowScheduleModal(false);
      setEditingSchedule(null);
      setScheduleForm({
        course_id: '', enrollment_type: 'block_section', year_level: '1',
        schedule_date: '', start_time: '', end_time: ''
      });
      fetchAll();
    } catch (err) {
      console.error('Failed to save schedule:', err);
    }
  };

  const handleDeleteSchedule = async (id) => {
    if (!confirm('Delete this schedule? This will also remove associated queue entries.')) return;
    try {
      await fetch(`/api/schedules/${id}`, { method: 'DELETE' });
      fetchAll();
    } catch (err) {
      console.error('Failed to delete schedule:', err);
    }
  };

  const handleSaveCourse = async (e) => {
    e.preventDefault();
    try {
      await fetch('/api/courses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(courseForm)
      });
      setShowCourseModal(false);
      setCourseForm({ code: '', name: '' });
      fetchAll();
    } catch (err) {
      console.error('Failed to save course:', err);
    }
  };

  const handleDeleteCourse = async (id) => {
    if (!confirm('Delete this course?')) return;
    try {
      await fetch(`/api/courses/${id}`, { method: 'DELETE' });
      fetchAll();
    } catch (err) {
      console.error('Failed to delete course:', err);
    }
  };

  const openEditSchedule = (schedule) => {
    setEditingSchedule(schedule);
    setScheduleForm({
      course_id: schedule.course_id,
      enrollment_type: schedule.enrollment_type,
      year_level: String(schedule.year_level),
      schedule_date: schedule.schedule_date,
      start_time: schedule.start_time,
      end_time: schedule.end_time
    });
    setShowScheduleModal(true);
  };

  // Helpers
  const yearSuffix = (y) => ['', '1st', '2nd', '3rd', '4th'][y] || `${y}th`;
  const typeLabel = (t) => t === 'block_section' ? 'Block Section' : 'Irregular';
  const formatTime = (time) => {
    if (!time) return '';
    const [h, m] = time.split(':');
    const hour = parseInt(h);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
    return `${displayHour}:${m} ${ampm}`;
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Loading dashboard...</p>
      </div>
    );
  }

  // Stats
  const totalWaiting = queues.reduce((sum, q) => sum + (q.counts?.waiting || 0), 0);
  const totalServing = queues.reduce((sum, q) => sum + (q.counts?.serving || 0), 0);
  const totalCompleted = queues.reduce((sum, q) => sum + (q.counts?.completed || 0), 0);
  const activeQueues = queues.filter(q => q.is_active).length;

  return (
    <div style={{ minHeight: '100vh', background: '#f3f4f6' }}>
      {/* Top bar */}
      <div style={{
        background: 'white',
        borderBottom: '1px solid #e5e7eb',
        padding: '12px 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <h1 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--primary-800)' }}>
          ⚙️ Admin Dashboard
        </h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '0.875rem', color: '#6b7280' }}>{session?.user?.email}</span>
          <button className="btn btn-secondary btn-sm" onClick={handleLogout}>Logout</button>
        </div>
      </div>

      <div className="container" style={{ padding: '24px 16px' }}>
        {/* Stats */}
        <div className="grid grid-4" style={{ marginBottom: '24px' }}>
          <div className="card stat-card">
            <div className="stat-value">{activeQueues}</div>
            <div className="stat-label">Active Queues</div>
          </div>
          <div className="card stat-card">
            <div className="stat-value" style={{ color: '#3b82f6' }}>{totalWaiting}</div>
            <div className="stat-label">Waiting</div>
          </div>
          <div className="card stat-card">
            <div className="stat-value" style={{ color: '#f59e0b' }}>{totalServing}</div>
            <div className="stat-label">Serving</div>
          </div>
          <div className="card stat-card">
            <div className="stat-value" style={{ color: '#10b981' }}>{totalCompleted}</div>
            <div className="stat-label">Completed</div>
          </div>
        </div>

        {/* Tabs */}
        <div className="tabs">
          {['queues', 'schedules', 'courses'].map(tab => (
            <button
              key={tab}
              className={`tab ${activeTab === tab ? 'active' : ''}`}
              onClick={() => setActiveTab(tab)}
            >
              {tab === 'queues' ? '📋 Queue Management' : tab === 'schedules' ? '📅 Schedules' : '📚 Courses'}
            </button>
          ))}
        </div>

        {/* ===== QUEUES TAB ===== */}
        {activeTab === 'queues' && (
          <div className="grid grid-2" style={{ alignItems: 'start' }}>
            {/* Left: Queue list */}
            <div>
              <div className="card">
                <div className="card-header">
                  <h3 className="card-title">All Queues</h3>
                </div>
                {queues.length === 0 ? (
                  <div className="empty-state">
                    <p className="empty-state-text">No queues created yet</p>
                    <p style={{ fontSize: '0.8125rem', color: '#9ca3af', marginTop: '4px' }}>
                      Create schedules first, then students can register into queues
                    </p>
                  </div>
                ) : (
                  <div>
                    {queues.map(q => (
                      <div
                        key={q.id}
                        onClick={() => { setSelectedQueue(q); fetchQueueEntries(q); }}
                        style={{
                          padding: '12px 16px',
                          borderBottom: '1px solid #f3f4f6',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          background: selectedQueue?.id === q.id ? 'var(--primary-50)' : 'transparent',
                          borderLeft: selectedQueue?.id === q.id ? '3px solid var(--gold-500)' : '3px solid transparent',
                          transition: 'all 150ms ease'
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 700, fontSize: '0.9375rem' }}>
                            {q.courses?.code} — {yearSuffix(q.year_level)} Year
                          </div>
                          <div style={{ fontSize: '0.8125rem', color: '#9ca3af' }}>
                            {typeLabel(q.enrollment_type)} · Serving #{q.current_serving || 0}
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span className={`badge ${q.counts?.waiting ? 'badge-waiting' : 'badge-inactive'}`}>
                            {q.counts?.waiting || 0} waiting
                          </span>
                          <label className="toggle" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={q.is_active}
                              onChange={() => handleToggleQueue(q.id, !q.is_active)}
                            />
                            <span className="toggle-slider"></span>
                          </label>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Right: Queue details */}
            <div>
              {selectedQueue ? (
                <div className="card">
                  <div className="card-header">
                    <h3 className="card-title">
                      {selectedQueue.courses?.code} — {yearSuffix(selectedQueue.year_level)} Year
                    </h3>
                    <button
                      className="btn btn-primary"
                      onClick={() => handleCallNext(selectedQueue.id)}
                    >
                      ▶ Call Next
                    </button>
                  </div>

                  <div style={{ marginBottom: '16px', display: 'flex', gap: '12px' }}>
                    <div className="stat-card card" style={{ flex: 1, padding: '12px' }}>
                      <div className="stat-value" style={{ fontSize: '1.75rem' }}>
                        {selectedQueue.current_serving || '—'}
                      </div>
                      <div className="stat-label" style={{ fontSize: '0.6875rem' }}>Now Serving</div>
                    </div>
                    <div className="stat-card card" style={{ flex: 1, padding: '12px' }}>
                      <div className="stat-value" style={{ fontSize: '1.75rem', color: '#3b82f6' }}>
                        {selectedQueue.counts?.waiting || 0}
                      </div>
                      <div className="stat-label" style={{ fontSize: '0.6875rem' }}>Waiting</div>
                    </div>
                    <div className="stat-card card" style={{ flex: 1, padding: '12px' }}>
                      <div className="stat-value" style={{ fontSize: '1.75rem', color: '#10b981' }}>
                        {selectedQueue.counts?.completed || 0}
                      </div>
                      <div className="stat-label" style={{ fontSize: '0.6875rem' }}>Done</div>
                    </div>
                  </div>

                  {/* Queue entries table */}
                  <div className="table-wrapper">
                    <table className="table">
                      <thead>
                        <tr>
                          <th>#</th>
                          <th>Student</th>
                          <th>ID</th>
                          <th>Status</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {queueEntries.length === 0 ? (
                          <tr>
                            <td colSpan="5" style={{ textAlign: 'center', color: '#9ca3af', padding: '24px' }}>
                              No entries in this queue
                            </td>
                          </tr>
                        ) : (
                          queueEntries.map(entry => (
                            <tr key={entry.id}>
                              <td style={{ fontWeight: 700 }}>{entry.queue_number}</td>
                              <td>{entry.student_name}</td>
                              <td style={{ fontSize: '0.8125rem', color: '#6b7280' }}>{entry.student_id}</td>
                              <td>
                                <span className={`badge badge-${entry.status}`}>{entry.status}</span>
                              </td>
                              <td>
                                {entry.status === 'serving' && (
                                  <div style={{ display: 'flex', gap: '4px' }}>
                                    <button
                                      className="btn btn-success btn-sm"
                                      onClick={() => handleStatusChange(entry.id, 'complete')}
                                    >
                                      ✓ Done
                                    </button>
                                    <button
                                      className="btn btn-warning btn-sm"
                                      onClick={() => handleStatusChange(entry.id, 'skip')}
                                    >
                                      Skip
                                    </button>
                                  </div>
                                )}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="card empty-state">
                  <div className="empty-state-icon">👈</div>
                  <p className="empty-state-text">Select a queue to view details</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ===== SCHEDULES TAB ===== */}
        {activeTab === 'schedules' && (
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Enrollment Schedules</h3>
              <button className="btn btn-primary" onClick={() => {
                setEditingSchedule(null);
                setScheduleForm({
                  course_id: '', enrollment_type: 'block_section', year_level: '1',
                  schedule_date: '', start_time: '', end_time: ''
                });
                setShowScheduleModal(true);
              }}>
                + Add Schedule
              </button>
            </div>
            <div className="table-wrapper">
              <table className="table">
                <thead>
                  <tr>
                    <th>Course</th>
                    <th>Type</th>
                    <th>Year Level</th>
                    <th>Date</th>
                    <th>Time</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {schedules.length === 0 ? (
                    <tr>
                      <td colSpan="7" style={{ textAlign: 'center', color: '#9ca3af', padding: '24px' }}>
                        No schedules created yet
                      </td>
                    </tr>
                  ) : (
                    schedules.map(s => (
                      <tr key={s.id}>
                        <td>{s.courses?.code || '—'}</td>
                        <td>{typeLabel(s.enrollment_type)}</td>
                        <td>{yearSuffix(s.year_level)} Year</td>
                        <td>{s.schedule_date}</td>
                        <td>{formatTime(s.start_time)} — {formatTime(s.end_time)}</td>
                        <td>
                          <label className="toggle">
                            <input
                              type="checkbox"
                              checked={s.is_active}
                              onChange={() => handleToggleSchedule(s.id, !s.is_active)}
                            />
                            <span className="toggle-slider"></span>
                          </label>
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: '4px' }}>
                            <button className="btn btn-secondary btn-sm" onClick={() => openEditSchedule(s)}>
                              Edit
                            </button>
                            <button className="btn btn-danger btn-sm" onClick={() => handleDeleteSchedule(s.id)}>
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ===== COURSES TAB ===== */}
        {activeTab === 'courses' && (
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Courses / Programs</h3>
              <button className="btn btn-primary" onClick={() => {
                setCourseForm({ code: '', name: '' });
                setShowCourseModal(true);
              }}>
                + Add Course
              </button>
            </div>
            <div className="table-wrapper">
              <table className="table">
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Name</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {courses.length === 0 ? (
                    <tr>
                      <td colSpan="3" style={{ textAlign: 'center', color: '#9ca3af', padding: '24px' }}>
                        No courses added yet
                      </td>
                    </tr>
                  ) : (
                    courses.map(c => (
                      <tr key={c.id}>
                        <td style={{ fontWeight: 700 }}>{c.code}</td>
                        <td>{c.name}</td>
                        <td>
                          <button className="btn btn-danger btn-sm" onClick={() => handleDeleteCourse(c.id)}>
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* ===== SCHEDULE MODAL ===== */}
      {showScheduleModal && (
        <div className="modal-overlay" onClick={() => setShowScheduleModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2 className="modal-title">
              {editingSchedule ? 'Edit Schedule' : 'Add Schedule'}
            </h2>
            <form onSubmit={handleSaveSchedule}>
              <div className="form-group">
                <label className="form-label">Course / Program</label>
                <select
                  className="form-select"
                  value={scheduleForm.course_id || ''}
                  onChange={e => setScheduleForm(f => ({ ...f, course_id: e.target.value }))}
                  required
                >
                  <option value="">Select a course</option>
                  {courses.map(c => (
                    <option key={c.id} value={c.id}>{c.code} — {c.name}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Enrollment Type</label>
                <select
                  className="form-select"
                  value={scheduleForm.enrollment_type || ''}
                  onChange={e => setScheduleForm(f => ({ ...f, enrollment_type: e.target.value }))}
                  required
                >
                  <option value="block_section">Block Section</option>
                  <option value="irregular">Irregular / Free Select</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Year Level</label>
                <select
                  className="form-select"
                  value={scheduleForm.year_level || ''}
                  onChange={e => setScheduleForm(f => ({ ...f, year_level: e.target.value }))}
                  required
                >
                  <option value="1">1st Year</option>
                  <option value="2">2nd Year</option>
                  <option value="3">3rd Year</option>
                  <option value="4">4th Year</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Date</label>
                <input
                  type="date"
                  className="form-input"
                  value={scheduleForm.schedule_date}
                  onChange={e => setScheduleForm(f => ({ ...f, schedule_date: e.target.value }))}
                  required
                />
              </div>
              <div className="grid grid-2">
                <div className="form-group">
                  <label className="form-label">Start Time</label>
                  <input
                    type="time"
                    className="form-input"
                    value={scheduleForm.start_time}
                    onChange={e => setScheduleForm(f => ({ ...f, start_time: e.target.value }))}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">End Time</label>
                  <input
                    type="time"
                    className="form-input"
                    value={scheduleForm.end_time}
                    onChange={e => setScheduleForm(f => ({ ...f, end_time: e.target.value }))}
                    required
                  />
                </div>
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowScheduleModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingSchedule ? 'Save Changes' : 'Create Schedule'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===== COURSE MODAL ===== */}
      {showCourseModal && (
        <div className="modal-overlay" onClick={() => setShowCourseModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2 className="modal-title">Add Course</h2>
            <form onSubmit={handleSaveCourse}>
              <div className="form-group">
                <label className="form-label">Course Code</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. BSCS"
                  value={courseForm.code}
                  onChange={e => setCourseForm(f => ({ ...f, code: e.target.value }))}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Course Name</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. BS Computer Science"
                  value={courseForm.name}
                  onChange={e => setCourseForm(f => ({ ...f, name: e.target.value }))}
                  required
                />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowCourseModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Add Course
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
