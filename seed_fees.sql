-- Seed Fees & Payments: Sample fee records and payments for test students
-- To run: Execute in Supabase SQL Editor.
-- To remove later:
--   DELETE FROM fee_payments WHERE fee_id IN (SELECT id FROM fees WHERE student_id IN (SELECT id FROM students WHERE notes = 'SEED_RECORD'));
--   DELETE FROM fees WHERE student_id IN (SELECT id FROM students WHERE notes = 'SEED_RECORD');

-- 1. Insert Current Month Fee Rows
insert into fees (student_id, period, amount_due, due_date)
select 
  id as student_id,
  date_trunc('month', current_date)::date as period,
  monthly_fee,
  date_trunc('month', current_date)::date + (fee_due_day - 1) as due_date
from students
where notes = 'SEED_RECORD' and status = 'active'
on conflict (student_id, period) do update set amount_due = excluded.amount_due;

-- 2. Insert Previous Month Overdue Fee Rows (due date 25 days ago)
insert into fees (student_id, period, amount_due, due_date)
select 
  id as student_id,
  (date_trunc('month', current_date) - interval '1 month')::date as period,
  monthly_fee,
  (current_date - interval '20 days')::date as due_date
from students
where notes = 'SEED_RECORD' and status = 'active' and admission_no in ('DEMO-001', 'DEMO-004', 'DEMO-007')
on conflict (student_id, period) do update set amount_due = excluded.amount_due;

-- 3. Record Sample Payments:
-- A) Full payment for DEMO-002 (Class 8) via UPI
insert into fee_payments (fee_id, amount, paid_on, mode, reference)
select 
  f.id as fee_id,
  f.amount_due as amount,
  current_date as paid_on,
  'upi' as mode,
  'UPI-TXN-9843210' as reference
from fees f
join students s on s.id = f.student_id
where s.admission_no = 'DEMO-002' and f.period = date_trunc('month', current_date)::date;

-- B) Full payment for DEMO-006 (Class 9) via Cash
insert into fee_payments (fee_id, amount, paid_on, mode, reference)
select 
  f.id as fee_id,
  f.amount_due as amount,
  current_date as paid_on,
  'cash' as mode,
  'Receipt #1042' as reference
from fees f
join students s on s.id = f.student_id
where s.admission_no = 'DEMO-006' and f.period = date_trunc('month', current_date)::date;

-- C) Partial payment for DEMO-008 (Class 10) via Bank Transfer
insert into fee_payments (fee_id, amount, paid_on, mode, reference)
select 
  f.id as fee_id,
  1000.00 as amount,
  (current_date - interval '2 days')::date as paid_on,
  'bank' as mode,
  'IMPS/HDFC/20261105' as reference
from fees f
join students s on s.id = f.student_id
where s.admission_no = 'DEMO-008' and f.period = date_trunc('month', current_date)::date;

