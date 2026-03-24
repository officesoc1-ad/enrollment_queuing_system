'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

export default function QueueBoardPage() {
  const [queues, setQueues] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchQueues = useCallback(async () => {
    try {
      const res = await fetch('/api/queue');
      const data = await res.json();
      setQueues(data);
    } catch (err) {
      console.error('Failed to load queues:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchQueues();

    // Real-time subscriptions
    const configChannel = supabase
      .channel('board-queue-config')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'queue_configs' }, () => {
        fetchQueues();
      })
      .subscribe();

    const entryChannel = supabase
      .channel('board-queue-entries')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'queue_entries' }, () => {
        fetchQueues();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(configChannel);
      supabase.removeChannel(entryChannel);
    };
  }, [fetchQueues]);

  const yearSuffix = (y) => ['', '1st', '2nd', '3rd', '4th'][y] || `${y}th`;
  const typeLabel = (t) => t === 'block_section' ? 'Block Section' : 'Irregular';

  // Group queues by course
  const grouped = queues.reduce((acc, q) => {
    const courseCode = q.courses?.code || 'Unknown';
    if (!acc[courseCode]) acc[courseCode] = [];
    acc[courseCode].push(q);
    return acc;
  }, {});

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Loading queue board...</p>
      </div>
    );
  }

  return (
    <>
      <section className="page-header" style={{ textAlign: 'center' }}>
        <div className="container" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <h1 style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', margin: 0, paddingBottom: '8px' }}>
            <img src="/queueboard-icon.svg" alt="Queue Board Icon" style={{ height: '40px', width: 'auto' }} />
            Queue Board
          </h1>
          <p style={{ margin: 0 }}>Live enrollment queue status — all courses</p>
        </div>
      </section>

      <div className="container">
        {Object.keys(grouped).length === 0 ? (
          <div className="card empty-state">
            <div className="empty-state-icon">📭</div>
            <p className="empty-state-text">No active queues at the moment</p>
            <p style={{ color: '#9ca3af', marginTop: '8px', fontSize: '0.875rem' }}>
              Queues will appear here once the admin activates enrollment schedules.
            </p>
          </div>
        ) : (
          Object.entries(grouped).map(([courseCode, courseQueues]) => (
            <div key={courseCode} style={{ marginBottom: '32px' }}>
              <h2 style={{ fontSize: '1.375rem', fontWeight: 800, marginBottom: '16px', color: '#111827' }}>
                {courseCode}
                <span style={{ fontWeight: 400, color: '#6b7280', fontSize: '1rem', marginLeft: '8px' }}>
                  {courseQueues[0]?.courses?.name}
                </span>
              </h2>
              <div className="grid grid-4">
                {courseQueues
                  .sort((a, b) => a.year_level - b.year_level)
                  .map(q => (
                    <div key={q.id} className="card" style={{
                      borderTop: q.is_active ? '4px solid #10b981' : '4px solid #e5e7eb',
                      textAlign: 'center'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '8px' }}>
                        {q.is_active && <span className="pulse-dot"></span>}
                        <span className={`badge ${q.is_active ? 'badge-active' : 'badge-inactive'}`}>
                          {q.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </div>

                      <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#374151', marginBottom: '4px' }}>
                        {yearSuffix(q.year_level)} Year
                      </h3>
                      <p style={{ fontSize: '0.8125rem', color: '#9ca3af', marginBottom: '16px' }}>
                        {typeLabel(q.enrollment_type)}
                      </p>

                      <div className="stat-value" style={{ fontSize: '3rem', marginBottom: '4px' }}>
                        {q.current_serving || '—'}
                      </div>
                      <div className="stat-label">Now Serving</div>

                      <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', marginTop: '16px', fontSize: '0.8125rem' }}>
                        <div>
                          <strong style={{ color: '#3b82f6' }}>{q.counts?.waiting || 0}</strong>
                          <span style={{ color: '#9ca3af' }}> waiting</span>
                        </div>
                        <div>
                          <strong style={{ color: '#10b981' }}>{q.counts?.completed || 0}</strong>
                          <span style={{ color: '#9ca3af' }}> done</span>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          ))
        )}
      </div>
    </>
  );
}
