'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { fetchQueuesDirectly } from '@/lib/supabase-client';
import InteractiveParticles from '@/components/InteractiveParticles';

export default function QueueBoardPage() {
  const [queues, setQueues] = useState([]);
  const [loading, setLoading] = useState(true);
  const debounceTimer = useRef(null);

  // Initial load via API (one-time Vercel invocation)
  const fetchQueuesInitial = useCallback(async () => {
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

  // Realtime refresh — reads directly from Supabase, no Vercel invocation
  const fetchQueuesRealtime = useCallback(async () => {
    try {
      const data = await fetchQueuesDirectly();
      setQueues(data);
    } catch (err) {
      console.error('Failed to refresh queues from Supabase:', err);
    }
  }, []);

  useEffect(() => {
    fetchQueuesInitial();

    // Real-time subscriptions — debounced, reads directly from Supabase
    const handleRealtimeChange = () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      debounceTimer.current = setTimeout(fetchQueuesRealtime, 300);
    };

    const channel = supabase
      .channel('board-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'queue_configs' }, handleRealtimeChange)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'queue_entries' }, handleRealtimeChange)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [fetchQueuesInitial, fetchQueuesRealtime]);

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
      <section className="page-header" style={{ textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
        <InteractiveParticles />
        <div className="container" style={{ position: 'relative', zIndex: 1, pointerEvents: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
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
            <p className="empty-state-text">No queues at the moment</p>
            <p style={{ color: '#9ca3af', marginTop: '8px', fontSize: '0.875rem' }}>
              Queues will appear here once the admin creates enrollment schedules.
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
                      borderTop: '4px solid #10b981',
                      textAlign: 'center'
                    }}>
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
