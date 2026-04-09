'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { fetchQueuesDirectly, fetchQueueEntriesDirectly } from '@/lib/supabase-client';

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
  const selectedQueueRef = useRef(null);
  const debounceTimer = useRef(null);
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

  // Action loading state for instant visual feedback
  const [loadingAction, setLoadingAction] = useState(null);

  // Kiosk authorization state
  const [kioskAuthorized, setKioskAuthorized] = useState(null);

  // Toast notification state
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);

  // Auth check + auto-refresh listener
  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        router.push('/admin');
      } else {
        setSession(session);
        setLoading(false);
      }
    });

    // Listen for token refreshes and sign-out events
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, newSession) => {
      if (event === 'SIGNED_OUT') {
        setSession(null);
        router.push('/admin');
      } else if (newSession) {
        // Covers TOKEN_REFRESHED, SIGNED_IN, and INITIAL_SESSION
        setSession(newSession);
      }
    });

    return () => subscription.unsubscribe();
  }, [router]);

  // Authenticated fetch helper — always uses the latest token from state
  const authFetch = useCallback(async (url, options = {}) => {
    // Re-fetch session to guarantee freshest token (handles edge case where
    // state hasn't propagated yet after a background refresh)
    const { data: { session: freshSession } } = await supabase.auth.getSession();
    const token = freshSession?.access_token || session?.access_token;

    if (!token) {
      router.push('/admin');
      throw new Error('Session expired. Please log in again.');
    }

    return fetch(url, {
      ...options,
      headers: {
        ...options.headers,
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });
  }, [session, router]);

  const fetchAll = useCallback(async () => {
    try {
      const opts = { cache: 'no-store' };
      const [qRes, sRes, cRes] = await Promise.all([
        fetch('/api/queue', opts),
        fetch('/api/schedules', opts),
        fetch('/api/courses', opts)
      ]);
      setQueues(await qRes.json());
      setSchedules(await sRes.json());
      setCourses(await cRes.json());
    } catch (err) {
      console.error('Failed to fetch data:', err);
    }
  }, []);

  // Targeted re-fetch via API (used after write operations for consistency)
  const fetchQueuesOnly = useCallback(async () => {
    try {
      const res = await fetch('/api/queue', { cache: 'no-store' });
      const data = await res.json();
      setQueues(data);
    } catch (err) {
      console.error('Failed to fetch queues:', err);
    }
  }, []);

  // Direct Supabase reads — no Vercel invocations (used by Realtime handler)
  const fetchQueuesRealtime = useCallback(async () => {
    try {
      const data = await fetchQueuesDirectly();
      setQueues(data);
    } catch (err) {
      console.error('Failed to refresh queues from Supabase:', err);
    }
  }, []);

  const fetchQueueEntriesRealtime = useCallback(async (config) => {
    try {
      const data = await fetchQueueEntriesDirectly({
        schedule_id: config.schedule_id,
        course_id: config.course_id,
        year_level: config.year_level,
        enrollment_type: config.enrollment_type
      });
      setQueueEntries(data);
    } catch (err) {
      console.error('Failed to refresh entries from Supabase:', err);
    }
  }, []);

  useEffect(() => {
    if (session) fetchAll();
  }, [session, fetchAll]);

  // Fetch kiosk authorization status
  useEffect(() => {
    if (session) {
      fetch('/api/kiosk/status', { cache: 'no-store' })
        .then(res => res.json())
        .then(data => setKioskAuthorized(data.authorized))
        .catch(() => setKioskAuthorized(false));
    }
  }, [session]);

  // Keep selectedQueueRef in sync without triggering effects
  useEffect(() => {
    selectedQueueRef.current = selectedQueue;
  }, [selectedQueue]);

  // Real-time subscriptions (Debounced) — reads directly from Supabase
  useEffect(() => {
    const handleRealtimeChange = () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      debounceTimer.current = setTimeout(() => {
        fetchQueuesRealtime();
        if (selectedQueueRef.current) fetchQueueEntriesRealtime(selectedQueueRef.current);
      }, 300); // 300ms quiet period before fetching
    };

    const channel = supabase
      .channel('admin-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'queue_configs' }, handleRealtimeChange)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'queue_entries' }, handleRealtimeChange)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [fetchQueuesRealtime, fetchQueueEntriesRealtime]);

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
    setLoadingAction('call-next');
    
    // OPTIMISTIC UI: Find the next waiting person
    const nextEntry = queueEntries.find(e => e.status === 'waiting');
    if (nextEntry) {
      setQueueEntries(prev => prev.map(e => e.id === nextEntry.id ? { ...e, status: 'serving' } : e));
      const updateData = (q) => {
        if (q.id === configId) {
          return {
            ...q,
            current_serving: nextEntry.queue_number,
            counts: { ...q.counts, waiting: Math.max(0, (q.counts?.waiting || 0) - 1), serving: (q.counts?.serving || 0) + 1 }
          };
        }
        return q;
      };
      setQueues(prev => prev.map(updateData));
      if (selectedQueue && selectedQueue.id === configId) setSelectedQueue(prev => updateData(prev));
    }

    try {
      const res = await authFetch('/api/queue/next', {
        method: 'POST',
        body: JSON.stringify({ configId })
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      // Success! Realtime listener will handle background true-up.
      showToast('Next student called successfully');
    } catch (err) {
      showToast(err.message || 'Failed to call next', 'error');
      // Revert optimistic updates
      fetchQueuesOnly();
      if (selectedQueue) fetchQueueEntries(selectedQueue);
    } finally {
      setLoadingAction(null);
    }
  };

  const handleStatusChange = async (entryId, action) => {
    setLoadingAction(`${action}-${entryId}`);

    // OPTIMISTIC UI
    const newStatus = action === 'complete' ? 'completed' : 'skipped';
    setQueueEntries(prev => prev.map(e => e.id === entryId ? { ...e, status: newStatus } : e));
    if (selectedQueue) {
      const updateData = (q) => {
        if (q.id === selectedQueue.id) {
          return {
            ...q,
            counts: { ...q.counts, serving: Math.max(0, (q.counts?.serving || 0) - 1), completed: action === 'complete' ? (q.counts?.completed || 0) + 1 : (q.counts?.completed || 0) }
          };
        }
        return q;
      };
      setQueues(prev => prev.map(updateData));
      setSelectedQueue(prev => updateData(prev));
    }

    try {
      const res = await authFetch('/api/queue/status', {
        method: 'POST',
        body: JSON.stringify({ entryId, action })
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      // Success!
      showToast(`Student ${action === 'complete' ? 'completed' : 'skipped'} successfully`);
    } catch (err) {
      showToast(err.message || 'Failed to update status', 'error');
      // Revert optimistic updates
      fetchQueuesOnly();
      if (selectedQueue) fetchQueueEntries(selectedQueue);
    } finally {
      setLoadingAction(null);
    }
  };

  const handleToggleQueue = async (configId, isActive) => {
    setLoadingAction(`toggle-q-${configId}`);
    
    // OPTIMISTIC UI
    const updateData = q => q.id === configId ? { ...q, is_active: isActive } : q;
    setQueues(prev => prev.map(updateData));
    if (selectedQueue && selectedQueue.id === configId) setSelectedQueue(prev => updateData(prev));

    try {
      const res = await authFetch(`/api/queue-config/${configId}`, {
        method: 'PUT',
        body: JSON.stringify({ is_active: isActive })
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      showToast(`Queue ${isActive ? 'activated' : 'paused'}`);
    } catch (err) {
      showToast(err.message || 'Failed to toggle queue', 'error');
      fetchQueuesOnly();
    } finally {
      setLoadingAction(null);
    }
  };

  const handleToggleSchedule = async (scheduleId, isActive) => {
    setLoadingAction(`toggle-s-${scheduleId}`);
    try {
      const res = await authFetch(`/api/schedules/${scheduleId}`, {
        method: 'PUT',
        body: JSON.stringify({ is_active: isActive })
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      await fetchAll();
      showToast(`Schedule ${isActive ? 'activated' : 'deactivated'}`);
    } catch (err) {
      showToast(err.message || 'Failed to toggle schedule', 'error');
    } finally {
      setLoadingAction(null);
    }
  };

  const handleSaveSchedule = async (e) => {
    e.preventDefault();

    const activeConflict = queues.find(q => 
      q.course_id === scheduleForm.course_id &&
      q.year_level === parseInt(scheduleForm.year_level) &&
      q.enrollment_type === scheduleForm.enrollment_type &&
      q.is_active &&
      (!editingSchedule || q.schedule_id !== editingSchedule.id)
    );

    if (activeConflict) {
      showToast('Cannot save schedule: An active queue already exists for this course, year level, and enrollment type.', 'error');
      return;
    }

    setLoadingAction('save-schedule');
    try {
      let res;
      if (editingSchedule) {
        res = await authFetch(`/api/schedules/${editingSchedule.id}`, {
          method: 'PUT',
          body: JSON.stringify({
            ...scheduleForm,
            year_level: parseInt(scheduleForm.year_level)
          })
        });
      } else {
        res = await authFetch('/api/schedules', {
          method: 'POST',
          body: JSON.stringify({
            ...scheduleForm,
            year_level: parseInt(scheduleForm.year_level)
          })
        });
      }
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      
      const savedSchedule = await res.json();

      // Optimistic state update — no extra DB call needed
      if (editingSchedule) {
        setSchedules(prev => prev.map(s => s.id === editingSchedule.id ? savedSchedule : s));
      } else {
        setSchedules(prev => [...prev, savedSchedule]);
      }

      showToast(editingSchedule ? 'Schedule updated' : 'Schedule created');
      setShowScheduleModal(false);

      if (!editingSchedule) {
        // Fetch queues only (lightweight) to pick up the new queue config
        setActiveTab('queues');
        await fetchQueuesOnly();
        // Select the newly created queue
        setQueues(current => {
          const newlyCreated = current.find(q => q.schedule_id === savedSchedule.id);
          if (newlyCreated) {
            setSelectedQueue(newlyCreated);
            fetchQueueEntries(newlyCreated);
          }
          return current;
        });
      }

      setEditingSchedule(null);
      setScheduleForm({
        course_id: '', enrollment_type: 'block_section', year_level: '1',
        schedule_date: '', start_time: '', end_time: ''
      });
    } catch (err) {
      showToast(err.message || 'Failed to save schedule', 'error');
    } finally {
      setLoadingAction(null);
    }
  };

  const handleDeleteSchedule = async (id) => {
    if (!confirm('Delete this schedule? This will also remove associated queue entries.')) return;
    try {
      const res = await authFetch(`/api/schedules/${id}`, { method: 'DELETE' });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }

      // Optimistic state update
      setSchedules(prev => prev.filter(s => s.id !== id));
      // Queues may have changed too (cascade delete)
      await fetchQueuesOnly();
      showToast('Schedule deleted');
    } catch (err) {
      showToast(err.message || 'Failed to delete schedule', 'error');
    }
  };

  const handleSaveCourse = async (e) => {
    e.preventDefault();
    try {
      const res = await authFetch('/api/courses', {
        method: 'POST',
        body: JSON.stringify(courseForm)
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }

      // Optimistic state update
      const savedCourse = await res.json();
      setCourses(prev => [...prev, savedCourse]);

      showToast('Course created');
      setShowCourseModal(false);
      setCourseForm({ code: '', name: '' });
    } catch (err) {
      showToast(err.message || 'Failed to save course', 'error');
    }
  };

  const handleDeleteCourse = async (id) => {
    if (!confirm('Delete this course?')) return;
    try {
      const res = await authFetch(`/api/courses/${id}`, { method: 'DELETE' });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }

      // Optimistic state update
      setCourses(prev => prev.filter(c => c.id !== id));
      // Schedules tied to this course may have been cascade-deleted
      setSchedules(prev => prev.filter(s => s.course_id !== id));
      await fetchQueuesOnly();

      showToast('Course deleted');
    } catch (err) {
      showToast(err.message || 'Failed to delete course', 'error');
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

  // Toast helper
  const showToast = useCallback((message, type = 'success') => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ message, type });
    toastTimer.current = setTimeout(() => setToast(null), 4000);
  }, []);

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

  const handleKioskAuthorize = async () => {
    setLoadingAction('kiosk-authorize');
    try {
      const res = await authFetch('/api/kiosk/authorize', { method: 'POST' });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      setKioskAuthorized(true);
      showToast('This device is now authorized for student registration');
    } catch (err) {
      showToast(err.message || 'Failed to authorize device', 'error');
    } finally {
      setLoadingAction(null);
    }
  };

  const handleKioskRevoke = async () => {
    if (!confirm('Revoke kiosk authorization? Students will not be able to register on this device until re-authorized.')) return;
    setLoadingAction('kiosk-revoke');
    try {
      const res = await authFetch('/api/kiosk/revoke', { method: 'POST' });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      setKioskAuthorized(false);
      showToast('Kiosk authorization revoked');
    } catch (err) {
      showToast(err.message || 'Failed to revoke', 'error');
    } finally {
      setLoadingAction(null);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: '#f3f4f6' }}>
      {/* Toast notification */}
      {toast && (
        <div
          onClick={() => setToast(null)}
          style={{
            position: 'fixed',
            top: '20px',
            right: '20px',
            zIndex: 9999,
            padding: '14px 24px',
            borderRadius: '10px',
            color: 'white',
            fontWeight: 600,
            fontSize: '0.9rem',
            background: toast.type === 'error'
              ? 'linear-gradient(135deg, #ef4444, #dc2626)'
              : 'linear-gradient(135deg, #22c55e, #16a34a)',
            boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
            cursor: 'pointer',
            animation: 'slideIn 0.3s ease-out',
            maxWidth: '400px'
          }}
        >
          {toast.type === 'error' ? '❌' : '✅'} {toast.message}
        </div>
      )}
      <style>{`@keyframes slideIn { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }`}</style>
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

        {/* Kiosk Authorization Banner */}
        <div style={{
          marginBottom: '24px',
          padding: '16px 20px',
          borderRadius: '12px',
          border: `2px solid ${kioskAuthorized ? '#86efac' : '#fca5a5'}`,
          background: kioskAuthorized
            ? 'linear-gradient(135deg, #f0fdf4, #dcfce7)'
            : 'linear-gradient(135deg, #fef2f2, #fee2e2)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px',
          flexWrap: 'wrap'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '1.5rem' }}>{kioskAuthorized ? '🔓' : '🔒'}</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.95rem', color: kioskAuthorized ? '#166534' : '#991b1b' }}>
                Kiosk Mode: {kioskAuthorized ? 'Authorized' : 'Not Authorized'}
              </div>
              <div style={{ fontSize: '0.8rem', color: kioskAuthorized ? '#15803d' : '#b91c1c', marginTop: '2px' }}>
                {kioskAuthorized
                  ? 'This device can accept student registrations. Authorization expires at midnight.'
                  : 'Students cannot register on this device. Click "Authorize" to enable registration.'}
              </div>
            </div>
          </div>
          {kioskAuthorized ? (
            <button
              className="btn btn-secondary btn-sm"
              onClick={handleKioskRevoke}
              disabled={loadingAction === 'kiosk-revoke'}
            >
              {loadingAction === 'kiosk-revoke' ? 'Revoking...' : 'Revoke'}
            </button>
          ) : (
            <button
              className="btn btn-primary btn-sm"
              onClick={handleKioskAuthorize}
              disabled={loadingAction === 'kiosk-authorize'}
              style={{ background: 'linear-gradient(135deg, #22c55e, #16a34a)', border: 'none' }}
            >
              {loadingAction === 'kiosk-authorize' ? 'Authorizing...' : '🔑 Authorize This Device'}
            </button>
          )}
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div className="alert alert-warning" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ fontSize: '1.5rem' }}>⚠️</span>
              <div>
                <strong>Important Note:</strong> You must activate a queue using the toggle switch before students can register for it.
              </div>
            </div>
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
                              disabled={loadingAction === `toggle-q-${q.id}`}
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
                      disabled={loadingAction === 'call-next'}
                    >
                      {loadingAction === 'call-next' ? 'Calling...' : '▶ Call Next'}
                    </button>
                  </div>

                  <div style={{ marginBottom: '16px', display: 'flex', gap: '12px' }}>
                    <div className="stat-card card" style={{ flex: 1, padding: '12px' }}>
                      <div className="stat-value" style={{ fontSize: '1.75rem', color: '#6366f1' }}>
                        {selectedQueue.current_serving ? `#${selectedQueue.current_serving}` : '—'}
                      </div>
                      <div className="stat-label" style={{ fontSize: '0.6875rem' }}>Ticket Called</div>
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
                                      disabled={loadingAction === `complete-${entry.id}`}
                                    >
                                      {loadingAction === `complete-${entry.id}` ? '...' : '✓ Done'}
                                    </button>
                                    <button
                                      className="btn btn-warning btn-sm"
                                      onClick={() => handleStatusChange(entry.id, 'skip')}
                                      disabled={loadingAction === `skip-${entry.id}`}
                                    >
                                      {loadingAction === `skip-${entry.id}` ? '...' : 'Skip'}
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
                <button type="submit" className="btn btn-primary" disabled={loadingAction === 'save-schedule'}>
                  {loadingAction === 'save-schedule' ? 'Saving...' : editingSchedule ? 'Save Changes' : 'Create Schedule'}
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
