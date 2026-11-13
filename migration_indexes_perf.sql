-- ============================================================================
-- PERFORMANCE OPTIMIZATION: ESSENTIAL COMPOSITE & COLUMN INDEXES
-- Run this in the Supabase SQL Editor.
-- Speeds up daily attendance, monthly fee ledger exports, and audit log lookups.
-- ============================================================================

-- 1. Attendance Date Query Index
-- Resolves sequential table scans when querying attendance by date (e.g. att_date = 'YYYY-MM-DD')
create index if not exists attendance_att_date_idx 
  on public.attendance (att_date);

-- 2. Fees Period & Student Indexes
-- Speeds up fee balance sheet aggregation, monthly generation, and student history
create index if not exists fees_period_idx 
  on public.fees (period);

create index if not exists fees_student_id_idx 
  on public.fees (student_id);

create index if not exists fees_due_date_idx 
  on public.fees (due_date);

-- 3. Fee Payments Foreign Key & Payment Date Indexes
-- Accelerates sum(amount) joins in fee_summary view and export-fees route
create index if not exists fee_payments_fee_id_idx 
  on public.fee_payments (fee_id);

create index if not exists fee_payments_paid_on_idx 
  on public.fee_payments (paid_on);

-- 4. Message Log Audit Indexes
-- Optimizes message audit log list, failed status filtering, and retry queries
create index if not exists message_log_created_at_desc_idx 
  on public.message_log (created_at desc);

create index if not exists message_log_status_idx 
  on public.message_log (status);

create index if not exists message_log_student_id_idx 
  on public.message_log (student_id);

