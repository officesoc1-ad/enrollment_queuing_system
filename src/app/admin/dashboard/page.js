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
  const [batchSize, setBatchSize] = useState(1);

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

  // Toast notification state
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);

  // Admin management states
  const [admins, setAdmins] = useState([]);
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [showDeleteAdminModal, setShowDeleteAdminModal] = useState(false);
  const [adminForm, setAdminForm] = useState({ email: '', password: '', currentPassword: '' });
  const [deleteAdminTarget, setDeleteAdminTarget] = useState(null);
  const [deleteAdminPassword, setDeleteAdminPassword] = useState('');

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
      const t = Date.now();
      const [qRes, sRes, cRes] = await Promise.all([
        fetch(`/api/queue?t=${t}`, { cache: 'no-store' }),
        fetch(`/api/schedules?t=${t}`, { cache: 'no-store' }),
        fetch(`/api/courses?t=${t}`, { cache: 'no-store' })
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
      const res = await fetch(`/api/queue?t=${Date.now()}`, { cache: 'no-store' });
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

  // Polling fallback — catches new entries that Realtime may miss (e.g. RPC inserts via service role)
  // Refreshes every 5 seconds when a queue is actively selected, reads directly from Supabase (no Vercel invocations)
  useEffect(() => {
    if (!selectedQueue) return;

    const pollInterval = setInterval(() => {
      fetchQueuesRealtime();
      if (selectedQueueRef.current) fetchQueueEntriesRealtime(selectedQueueRef.current);
    }, 5000);

    return () => clearInterval(pollInterval);
  }, [selectedQueue, fetchQueuesRealtime, fetchQueueEntriesRealtime]);

  const fetchQueueEntries = async (config) => {
    try {
      const params = new URLSearchParams({
        schedule_id: config.schedule_id,
        course_id: config.course_id,
        year_level: config.year_level,
        enrollment_type: config.enrollment_type
      });
      const res = await fetch(`/api/queue-entries?${params}&t=${Date.now()}`);
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
    const count = batchSize;
    setLoadingAction('call-next');
    
    // OPTIMISTIC UI: Find the next N waiting people
    const waitingEntries = queueEntries
      .filter(e => e.status === 'waiting')
      .sort((a, b) => a.queue_number - b.queue_number)
      .slice(0, count);

    if (waitingEntries.length > 0) {
      const waitingIds = new Set(waitingEntries.map(e => e.id));
      setQueueEntries(prev => prev.map(e => waitingIds.has(e.id) ? { ...e, status: 'serving' } : e));
      const lastEntry = waitingEntries[waitingEntries.length - 1];
      const updateData = (q) => {
        if (q.id === configId) {
          return {
            ...q,
            current_serving: lastEntry.queue_number,
            counts: {
              ...q.counts,
              waiting: Math.max(0, (q.counts?.waiting || 0) - waitingEntries.length),
              serving: (q.counts?.serving || 0) + waitingEntries.length
            }
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
        body: JSON.stringify({ configId, count })
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      const result = await res.json();
      const called = result.called || 0;
      // Success! Realtime listener will handle background true-up.
      if (called === 0) {
        showToast('No more students waiting', 'error');
      } else {
        showToast(`Called ${called} student${called > 1 ? 's' : ''} successfully`);
      }
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
      const prevEntry = queueEntries.find(e => e.id === entryId);
      const wasServing = prevEntry?.status === 'serving';
      const wasSkipped = prevEntry?.status === 'skipped';
      const updateData = (q) => {
        if (q.id === selectedQueue.id) {
          const counts = { ...q.counts };
          if (action === 'complete') {
            counts.completed = (counts.completed || 0) + 1;
            if (wasServing) counts.serving = Math.max(0, (counts.serving || 0) - 1);
            if (wasSkipped) counts.skipped = Math.max(0, (counts.skipped || 0) - 1);
          } else {
            // skip — stays visible in serving section, just increment skipped
            counts.skipped = (counts.skipped || 0) + 1;
            if (wasServing) counts.serving = Math.max(0, (counts.serving || 0) - 1);
          }
          return { ...q, counts };
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

  const handleSaveSchedule = async (e) => {
    e.preventDefault();

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
    setLoadingAction(`delete-s-${id}`);
    try {
      const res = await authFetch(`/api/schedules/${id}`, { method: 'DELETE' });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }

      // Wait for cache to potentially invalidate or just force a fresh fetch
      await fetchAll();
      showToast('Schedule deleted');
    } catch (err) {
      showToast(err.message || 'Failed to delete schedule', 'error');
    } finally {
      setLoadingAction(null);
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
    setLoadingAction(`delete-c-${id}`);
    try {
      const res = await authFetch(`/api/courses/${id}`, { method: 'DELETE' });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }

      await fetchAll();
      showToast('Course deleted');
    } catch (err) {
      showToast(err.message || 'Failed to delete course', 'error');
    } finally {
      setLoadingAction(null);
    }
  };

  // === Admin Management Handlers ===
  const fetchAdmins = useCallback(async () => {
    try {
      const res = await authFetch('/api/admins');
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      const data = await res.json();
      setAdmins(data);
    } catch (err) {
      console.error('Failed to fetch admins:', err);
    }
  }, [authFetch]);

  useEffect(() => {
    if (session && activeTab === 'admins') {
      fetchAdmins();
    }
  }, [session, activeTab, fetchAdmins]);

  const handleCreateAdmin = async (e) => {
    e.preventDefault();
    setLoadingAction('create-admin');
    try {
      const res = await authFetch('/api/admins', {
        method: 'POST',
        body: JSON.stringify(adminForm)
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      const newAdmin = await res.json();
      setAdmins(prev => [...prev, newAdmin]);
      showToast('Admin created successfully');
      setShowAdminModal(false);
      setAdminForm({ email: '', password: '', currentPassword: '' });
    } catch (err) {
      showToast(err.message || 'Failed to create admin', 'error');
    } finally {
      setLoadingAction(null);
    }
  };

  const openDeleteAdmin = (admin) => {
    setDeleteAdminTarget(admin);
    setDeleteAdminPassword('');
    setShowDeleteAdminModal(true);
  };

  const handleDeleteAdmin = async (e) => {
    e.preventDefault();
    if (!deleteAdminTarget) return;
    setLoadingAction('delete-admin');
    try {
      const res = await authFetch(`/api/admins/${deleteAdminTarget.id}`, {
        method: 'DELETE',
        body: JSON.stringify({ currentPassword: deleteAdminPassword })
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      setAdmins(prev => prev.filter(a => a.id !== deleteAdminTarget.id));
      showToast('Admin deleted successfully');
      setShowDeleteAdminModal(false);
      setDeleteAdminTarget(null);
      setDeleteAdminPassword('');
    } catch (err) {
      showToast(err.message || 'Failed to delete admin', 'error');
    } finally {
      setLoadingAction(null);
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
  const totalQueues = queues.length;
  const totalWaiting = queues.reduce((sum, q) => sum + (q.counts?.waiting || 0), 0);
  const totalServing = queues.reduce((sum, q) => sum + (q.counts?.serving || 0), 0);
  const totalCompleted = queues.reduce((sum, q) => sum + (q.counts?.completed || 0), 0);

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
            <div className="stat-value">{totalQueues}</div>
            <div className="stat-label">Total Queues</div>
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
          {['queues', 'schedules', 'courses', 'admins'].map(tab => (
            <button
              key={tab}
              className={`tab ${activeTab === tab ? 'active' : ''}`}
              onClick={() => setActiveTab(tab)}
            >
              {tab === 'queues' ? '📋 Queue Management' : tab === 'schedules' ? '📅 Schedules' : tab === 'courses' ? '📚 Courses' : '👥 Admins'}
            </button>
          ))}
        </div>

        {/* ===== QUEUES TAB ===== */}
        {activeTab === 'queues' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
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
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <select
                        id="batch-size-select"
                        value={batchSize}
                        onChange={(e) => setBatchSize(Number(e.target.value))}
                        style={{
                          padding: '8px 10px',
                          borderRadius: '8px',
                          border: '1.5px solid #d1d5db',
                          fontSize: '0.875rem',
                          fontWeight: 600,
                          background: 'white',
                          cursor: 'pointer',
                          color: '#374151',
                          minWidth: '52px',
                          textAlign: 'center'
                        }}
                      >
                        {[1, 3, 5, 10, 20].map(n => (
                          <option key={n} value={n}>{n}</option>
                        ))}
                      </select>
                      <button
                        className="btn btn-primary"
                        onClick={() => handleCallNext(selectedQueue.id)}
                        disabled={loadingAction === 'call-next'}
                      >
                        {loadingAction === 'call-next'
                          ? 'Calling...'
                          : `▶ Call Next${batchSize > 1 ? ` ${batchSize}` : ''}`}
                      </button>
                    </div>
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
                  <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                    <div className="table-wrapper">
                      <table className="table">
                        <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
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
                            [...queueEntries]
                              .sort((a, b) => {
                                const order = { serving: 0, skipped: 0, waiting: 1, completed: 2 };
                                const diff = (order[a.status] ?? 4) - (order[b.status] ?? 4);
                                return diff !== 0 ? diff : a.queue_number - b.queue_number;
                              })
                              .map(entry => (
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
                                  {entry.status === 'skipped' && (
                                    <div style={{ display: 'flex', gap: '4px' }}>
                                      <button
                                        className="btn btn-success btn-sm"
                                        onClick={() => handleStatusChange(entry.id, 'complete')}
                                        disabled={loadingAction === `complete-${entry.id}`}
                                      >
                                        {loadingAction === `complete-${entry.id}` ? '...' : '✓ Done'}
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
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {schedules.length === 0 ? (
                    <tr>
                      <td colSpan="6" style={{ textAlign: 'center', color: '#9ca3af', padding: '24px' }}>
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

        {/* ===== ADMINS TAB ===== */}
        {activeTab === 'admins' && (
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Admin Users</h3>
              <button className="btn btn-primary" onClick={() => {
                setAdminForm({ email: '', password: '', currentPassword: '' });
                setShowAdminModal(true);
              }}>
                + Add Admin
              </button>
            </div>
            <div className="table-wrapper">
              <table className="table">
                <thead>
                  <tr>
                    <th>Email</th>
                    <th>Created</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {admins.length === 0 ? (
                    <tr>
                      <td colSpan="3" style={{ textAlign: 'center', color: '#9ca3af', padding: '24px' }}>
                        No admin users found
                      </td>
                    </tr>
                  ) : (
                    admins.map(a => (
                      <tr key={a.id}>
                        <td style={{ fontWeight: 600 }}>
                          {a.email}
                          {a.id === session?.user?.id && (
                            <span style={{
                              marginLeft: '8px',
                              fontSize: '0.7rem',
                              padding: '2px 8px',
                              borderRadius: '999px',
                              background: 'linear-gradient(135deg, var(--primary-100), var(--primary-200))',
                              color: 'var(--primary-700)',
                              fontWeight: 700
                            }}>You</span>
                          )}
                        </td>
                        <td style={{ fontSize: '0.8125rem', color: '#6b7280' }}>
                          {new Date(a.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                        </td>
                        <td>
                          {a.id === session?.user?.id ? (
                            <span style={{ fontSize: '0.8125rem', color: '#9ca3af', fontStyle: 'italic' }}>Current account</span>
                          ) : (
                            <button
                              className="btn btn-danger btn-sm"
                              onClick={() => openDeleteAdmin(a)}
                            >
                              Delete
                            </button>
                          )}
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

      {/* ===== CREATE ADMIN MODAL ===== */}
      {showAdminModal && (
        <div className="modal-overlay" onClick={() => setShowAdminModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2 className="modal-title">Create Admin User</h2>
            <form onSubmit={handleCreateAdmin}>
              <div className="form-group">
                <label className="form-label">New Admin Email</label>
                <input
                  type="email"
                  className="form-input"
                  placeholder="newadmin@hau.edu.ph"
                  value={adminForm.email}
                  onChange={e => setAdminForm(f => ({ ...f, email: e.target.value }))}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">New Admin Password</label>
                <input
                  type="password"
                  className="form-input"
                  placeholder="Min. 6 characters"
                  value={adminForm.password}
                  onChange={e => setAdminForm(f => ({ ...f, password: e.target.value }))}
                  minLength={6}
                  required
                />
              </div>
              <div style={{
                margin: '20px 0 16px',
                padding: '16px',
                borderRadius: '10px',
                border: '2px solid #fbbf24',
                background: 'linear-gradient(135deg, #fffbeb, #fef3c7)'
              }}>
                <div style={{ fontWeight: 700, fontSize: '0.85rem', color: '#92400e', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  🔒 Identity Confirmation
                </div>
                <div style={{ fontSize: '0.8rem', color: '#a16207', marginBottom: '12px' }}>
                  Enter YOUR current password to confirm this action.
                </div>
                <input
                  type="password"
                  className="form-input"
                  placeholder="Your current password"
                  value={adminForm.currentPassword}
                  onChange={e => setAdminForm(f => ({ ...f, currentPassword: e.target.value }))}
                  required
                />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowAdminModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={loadingAction === 'create-admin'}>
                  {loadingAction === 'create-admin' ? 'Creating...' : 'Create Admin'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===== DELETE ADMIN MODAL ===== */}
      {showDeleteAdminModal && deleteAdminTarget && (
        <div className="modal-overlay" onClick={() => setShowDeleteAdminModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2 className="modal-title" style={{ color: '#dc2626' }}>Delete Admin User</h2>
            <form onSubmit={handleDeleteAdmin}>
              <div style={{
                padding: '16px',
                borderRadius: '10px',
                border: '2px solid #fca5a5',
                background: 'linear-gradient(135deg, #fef2f2, #fee2e2)',
                marginBottom: '20px'
              }}>
                <div style={{ fontSize: '0.9rem', color: '#991b1b', fontWeight: 600, marginBottom: '4px' }}>
                  ⚠️ You are about to permanently delete:
                </div>
                <div style={{ fontSize: '1rem', fontWeight: 700, color: '#7f1d1d' }}>
                  {deleteAdminTarget.email}
                </div>
                <div style={{ fontSize: '0.8rem', color: '#b91c1c', marginTop: '8px' }}>
                  This action cannot be undone. The admin will lose all access immediately.
                </div>
              </div>
              <div style={{
                padding: '16px',
                borderRadius: '10px',
                border: '2px solid #fbbf24',
                background: 'linear-gradient(135deg, #fffbeb, #fef3c7)'
              }}>
                <div style={{ fontWeight: 700, fontSize: '0.85rem', color: '#92400e', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  🔒 Identity Confirmation
                </div>
                <div style={{ fontSize: '0.8rem', color: '#a16207', marginBottom: '12px' }}>
                  Enter YOUR current password to confirm deletion.
                </div>
                <input
                  type="password"
                  className="form-input"
                  placeholder="Your current password"
                  value={deleteAdminPassword}
                  onChange={e => setDeleteAdminPassword(e.target.value)}
                  required
                />
              </div>
              <div className="modal-actions" style={{ marginTop: '20px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowDeleteAdminModal(false)}>
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-danger"
                  disabled={loadingAction === 'delete-admin'}
                >
                  {loadingAction === 'delete-admin' ? 'Deleting...' : '🗑️ Confirm Delete'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
