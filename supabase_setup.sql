-- ============================================
-- Enrollment Queuing System — Supabase Schema
-- ============================================
-- Run this in the Supabase SQL Editor (Dashboard > SQL Editor > New Query)

-- 1. Courses table
CREATE TABLE courses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Enrollment schedules table
CREATE TABLE enrollment_schedules (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  enrollment_type TEXT NOT NULL CHECK (enrollment_type IN ('block_section', 'irregular')),
  year_level INT NOT NULL CHECK (year_level BETWEEN 1 AND 4),
  schedule_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  is_active BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (enrollment_type, year_level, schedule_date, start_time)
);

-- 3. Queue entries table
CREATE TABLE queue_entries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  schedule_id UUID NOT NULL REFERENCES enrollment_schedules(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  year_level INT NOT NULL CHECK (year_level BETWEEN 1 AND 4),
  enrollment_type TEXT NOT NULL CHECK (enrollment_type IN ('block_section', 'irregular')),
  student_name TEXT NOT NULL,
  student_id TEXT NOT NULL,
  queue_number INT NOT NULL,
  status TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'serving', 'completed', 'skipped')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Queue configs table (per course per year level per schedule)
CREATE TABLE queue_configs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  schedule_id UUID NOT NULL REFERENCES enrollment_schedules(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  year_level INT NOT NULL CHECK (year_level BETWEEN 1 AND 4),
  enrollment_type TEXT NOT NULL CHECK (enrollment_type IN ('block_section', 'irregular')),
  current_serving INT DEFAULT 0,
  is_active BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (schedule_id, course_id, year_level, enrollment_type)
);

-- ============================================
-- Indexes for performance
-- ============================================
CREATE INDEX idx_queue_entries_lookup ON queue_entries (schedule_id, course_id, year_level, enrollment_type, status);
CREATE INDEX idx_queue_entries_status ON queue_entries (status);
CREATE INDEX idx_queue_configs_lookup ON queue_configs (schedule_id, course_id, year_level, enrollment_type);
CREATE INDEX idx_schedules_date ON enrollment_schedules (schedule_date, enrollment_type);

-- ============================================
-- Enable Realtime for live queue updates
-- ============================================
ALTER PUBLICATION supabase_realtime ADD TABLE queue_entries;
ALTER PUBLICATION supabase_realtime ADD TABLE queue_configs;

-- ============================================
-- Row Level Security (RLS)
-- ============================================

-- Courses: public read, admin write
ALTER TABLE courses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can read courses" ON courses FOR SELECT USING (true);
CREATE POLICY "Authenticated can manage courses" ON courses FOR ALL USING (auth.role() = 'authenticated');

-- Schedules: public read, admin write
ALTER TABLE enrollment_schedules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can read schedules" ON enrollment_schedules FOR SELECT USING (true);
CREATE POLICY "Authenticated can manage schedules" ON enrollment_schedules FOR ALL USING (auth.role() = 'authenticated');

-- Queue entries: public read + insert, admin update
ALTER TABLE queue_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can read queue entries" ON queue_entries FOR SELECT USING (true);
CREATE POLICY "Public can insert queue entries" ON queue_entries FOR INSERT WITH CHECK (true);
CREATE POLICY "Authenticated can manage queue entries" ON queue_entries FOR ALL USING (auth.role() = 'authenticated');

-- Queue configs: public read, admin write
ALTER TABLE queue_configs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can read queue configs" ON queue_configs FOR SELECT USING (true);
CREATE POLICY "Authenticated can manage queue configs" ON queue_configs FOR ALL USING (auth.role() = 'authenticated');

-- ============================================
-- Seed data: sample courses (School of Computing)
-- ============================================
INSERT INTO courses (code, name) VALUES
  ('BSCS', 'BS Computer Science'),
  ('BSIT', 'BS Information Technology'),
  ('BSIS', 'BS Information Systems');
