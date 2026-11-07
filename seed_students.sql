-- Seed Data: 10 Fake Students for Akshara Academy Testing
-- Classes: Class 8, Class 9, Class 10
-- ALL phone numbers are dummy test numbers (+919000000001 to +919000000010)
-- Tagged with notes = 'SEED_RECORD' for easy removal.

-- TO INSERT: Run this in your Supabase SQL Editor.
-- TO REMOVE LATER: Run: DELETE FROM students WHERE notes = 'SEED_RECORD';

insert into students (
  admission_no,
  full_name,
  class_level,
  school,
  parent_name,
  phone,
  address,
  admission_date,
  whatsapp_opt_in,
  monthly_fee,
  fee_due_day,
  status,
  notes
) values
  ('DEMO-001', 'Aarav Demo Sharma', 'Class 8', 'Demo Public School', 'Ramesh Sharma', '+919000000001', '12 Demo Enclave, Sector 1', '2026-06-01', true, 1500, 5, 'active', 'SEED_RECORD'),
  ('DEMO-002', 'Diya Demo Patel', 'Class 8', 'Demo Model Academy', 'Kiran Patel', '+919000000002', '45 Sample Street, Block B', '2026-06-05', true, 1500, 5, 'active', 'SEED_RECORD'),
  ('DEMO-003', 'Ishaan Demo Reddy', 'Class 8', 'Demo City High School', 'Venkat Reddy', '+919000000003', '78 Trial Colony, Flat 3', '2026-06-10', false, 1500, 10, 'active', 'SEED_RECORD'),
  ('DEMO-004', 'Ananya Demo Verma', 'Class 9', 'Demo Public School', 'Sunil Verma', '+919000000004', '101 Demo Nagar, Road 4', '2026-06-02', true, 1800, 5, 'active', 'SEED_RECORD'),
  ('DEMO-005', 'Rohan Demo Gupta', 'Class 9', 'Sample Convent School', 'Anil Gupta', '+919000000005', '22 Dummy Layout, Cross 2', '2026-06-15', false, 1800, 7, 'active', 'SEED_RECORD'),
  ('DEMO-006', 'Meera Demo Nair', 'Class 9', 'Demo Model Academy', 'Suresh Nair', '+919000000006', '56 Fake Lane, Phase 1', '2026-06-20', true, 1800, 5, 'active', 'SEED_RECORD'),
  ('DEMO-007', 'Kabir Demo Singh', 'Class 10', 'Demo Public School', 'Harpreet Singh', '+919000000007', '89 Mock Garden, Block C', '2026-05-15', true, 2200, 5, 'active', 'SEED_RECORD'),
  ('DEMO-008', 'Tanvi Demo Kulkarni', 'Class 10', 'Demo City High School', 'Prakash Kulkarni', '+919000000008', '14 Test Heights, Wing A', '2026-05-20', true, 2200, 5, 'active', 'SEED_RECORD'),
  ('DEMO-009', 'Aditya Demo Joshi', 'Class 10', 'Sample Convent School', 'Vijay Joshi', '+919000000009', '33 Dummy Apartments', '2026-06-01', false, 2200, 10, 'active', 'SEED_RECORD'),
  ('DEMO-010', 'Pooja Demo Rao', 'Class 10', 'Demo Model Academy', 'Mohan Rao', '+919000000010', '67 Trial Road, Sector 5', '2026-06-12', true, 2200, 5, 'inactive', 'SEED_RECORD');

