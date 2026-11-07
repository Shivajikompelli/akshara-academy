-- Seed Attendance: Dummy attendance records for the last 3 days for test students
-- To run: Execute in Supabase SQL Editor AFTER running seed_students.sql.
-- To remove later: 
--   DELETE FROM attendance WHERE student_id IN (SELECT id FROM students WHERE notes = 'SEED_RECORD');

insert into attendance (student_id, att_date, status)
select 
  id as student_id,
  (current_date - interval '1 day')::date as att_date,
  case 
    when admission_no in ('DEMO-002', 'DEMO-005', 'DEMO-008') then 'absent'
    else 'present'
  end as status
from students
where notes = 'SEED_RECORD' and status = 'active'
on conflict (student_id, att_date) do update set status = excluded.status;

insert into attendance (student_id, att_date, status)
select 
  id as student_id,
  (current_date - interval '2 day')::date as att_date,
  case 
    when admission_no in ('DEMO-003', 'DEMO-007') then 'absent'
    else 'present'
  end as status
from students
where notes = 'SEED_RECORD' and status = 'active'
on conflict (student_id, att_date) do update set status = excluded.status;

insert into attendance (student_id, att_date, status)
select 
  id as student_id,
  (current_date - interval '3 day')::date as att_date,
  case 
    when admission_no in ('DEMO-001', 'DEMO-006', 'DEMO-009') then 'absent'
    else 'present'
  end as status
from students
where notes = 'SEED_RECORD' and status = 'active'
on conflict (student_id, att_date) do update set status = excluded.status;
