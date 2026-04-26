'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { fetchQueuesDirectly } from '@/lib/supabase-client';
import './queue-board.css';

export default function QueueBoardPage() {
  const [queues, setQueues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [clock, setClock] = useState('');
  const debounceTimer = useRef(null);
  const prevServing = useRef({}); // track previous serving numbers for flash animation
  const [flashCells, setFlashCells] = useState({}); // { queueId: true }

  // Clock
  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setClock(now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, []);

  // Initial load via API
  const fetchQueuesInitial = useCallback(async () => {
    try {
      const res = await fetch('/api/queue');
      const data = await res.json();
      setQueues(data);
      // Seed prev serving
      const map = {};
      data.forEach(q => { map[q.id] = q.current_serving; });
      prevServing.current = map;
    } catch (err) {
      console.error('Failed to load queues:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Realtime refresh — direct Supabase read
  const fetchQueuesRealtime = useCallback(async () => {
    try {
      const data = await fetchQueuesDirectly();
      // Detect which cells changed serving number
      const newFlash = {};
      data.forEach(q => {
        if (prevServing.current[q.id] !== undefined && prevServing.current[q.id] !== q.current_serving && q.current_serving) {
          newFlash[q.id] = true;
        }
        prevServing.current[q.id] = q.current_serving;
      });
      if (Object.keys(newFlash).length > 0) {
        setFlashCells(newFlash);
        setTimeout(() => setFlashCells({}), 1200);
      }
      setQueues(data);
    } catch (err) {
      console.error('Failed to refresh queues from Supabase:', err);
    }
  }, []);

  useEffect(() => {
    fetchQueuesInitial();

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
  const typeLabel = (t) => t === 'block_section' ? 'Block' : 'Irreg';

  // Build the matrix structure:
  // Group by course, then collect all unique (year_level, enrollment_type) combos as columns
  const grouped = queues.reduce((acc, q) => {
    const courseCode = q.courses?.code || 'Unknown';
    const courseName = q.courses?.name || '';
    if (!acc[courseCode]) acc[courseCode] = { name: courseName, queues: [] };
    acc[courseCode].queues.push(q);
    return acc;
  }, {});

  // Collect all unique column keys across all courses
  const allColumnKeys = new Set();
  queues.forEach(q => {
    allColumnKeys.add(`${q.year_level}-${q.enrollment_type}`);
  });

  // Sort columns: by year_level first, then block before irregular
  const sortedColumns = [...allColumnKeys].sort((a, b) => {
    const [ya, ta] = a.split('-');
    const [yb, tb] = b.split('-');
    if (ya !== yb) return Number(ya) - Number(yb);
    return ta === 'block_section' ? -1 : 1;
  });

  const columnLabels = sortedColumns.map(key => {
    const [y, t] = key.split('-');
    return { key, label: `${yearSuffix(Number(y))} Yr`, sub: typeLabel(t) };
  });

  if (loading) {
    return (
      <div className="qb" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <div style={{ textAlign: 'center' }}>
          <div className="spinner" style={{ margin: '0 auto 16px', borderTopColor: 'var(--qb-accent)' }}></div>
          <p style={{ color: 'var(--qb-text-muted)' }}>Loading queue board...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="qb">
      {/* Header */}
      <header className="qb-header">
        <div className="qb-header-left">
          <Link href="/" className="qb-back-btn" title="Back to Home">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12.5 15L7.5 10L12.5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </Link>
          <img src="/soc2.png" alt="SOC Logo" className="qb-logo" />
          <div>
            <div className="qb-header-title">
              <span className="qb-gold">HAU</span> Queue Board
            </div>
            <div className="qb-header-subtitle">School of Computing · Enrollment Queue Status</div>
          </div>
        </div>
        <div className="qb-header-right">
          <div className="qb-live-badge">
            <span className="qb-live-dot"></span>
            LIVE
          </div>
          <div className="qb-clock">{clock}</div>
        </div>
      </header>

      {/* Body */}
      <div className="qb-body">
        {Object.keys(grouped).length === 0 ? (
          <div className="qb-empty-state">
            <div className="qb-empty-state-icon">📭</div>
            <div className="qb-empty-state-text">No queues at the moment</div>
            <div className="qb-empty-state-sub">Queues will appear here once enrollment schedules are created.</div>
          </div>
        ) : (
          <table className="qb-matrix">
            <thead>
              <tr>
                <th>Course</th>
                {columnLabels.map(col => (
                  <th key={col.key}>
                    {col.label}
                    <br />
                    <span style={{ fontSize: '0.5625rem', fontWeight: 500, opacity: 0.7 }}>{col.sub}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Object.entries(grouped).map(([courseCode, { name, queues: courseQueues }]) => {
                // Build a lookup map for this course's queues
                const queueMap = {};
                courseQueues.forEach(q => {
                  queueMap[`${q.year_level}-${q.enrollment_type}`] = q;
                });

                return (
                  <tr key={courseCode}>
                    <td>
                      <span style={{ color: 'var(--qb-accent)', fontWeight: 700 }}>{courseCode}</span>
                      <br />
                      <span style={{ fontSize: '0.6875rem', color: 'var(--qb-text-muted)', fontWeight: 400 }}>{name}</span>
                    </td>
                    {sortedColumns.map(colKey => {
                      const q = queueMap[colKey];
                      if (!q) {
                        return (
                          <td key={colKey}>
                            <div className="qb-cell qb-cell--empty">
                              <div className="qb-cell-number" style={{ color: 'var(--qb-empty)' }}>—</div>
                              <div className="qb-cell-label">No Queue</div>
                            </div>
                          </td>
                        );
                      }
                      const isActive = q.current_serving && q.current_serving > 0;
                      const isFlashing = flashCells[q.id];
                      return (
                        <td key={colKey}>
                          <div className={`qb-cell ${isActive ? 'qb-cell--active' : ''} ${isFlashing ? 'qb-cell--flash' : ''}`}>
                            <div className="qb-cell-number">
                              {q.current_serving || '—'}
                            </div>
                            <div className="qb-cell-label">Now Serving</div>
                            <div className="qb-cell-stats">
                              <div className="qb-cell-stat">
                                <span className="qb-dot qb-dot--waiting"></span>
                                <span className="qb-cell-stat-value--waiting">{q.counts?.waiting || 0}</span>
                              </div>
                              <div className="qb-cell-stat">
                                <span className="qb-dot qb-dot--done"></span>
                                <span className="qb-cell-stat-value--done">{q.counts?.completed || 0}</span>
                              </div>
                            </div>
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
