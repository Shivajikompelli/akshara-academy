-- Simplify the student registry: one record per student with school, class,
-- parent name, phone, address and admission date.
-- Replaces the separate batches and guardians tables.
-- Assumes the students table is still empty (step 2 not built yet).
-- Run in the Supabase SQL editor.

-- 1. message_log no longer points to guardians
drop index if exists message_log_dedupe;
alter table message_log drop column if exists guardian_id;
create unique index message_log_dedupe
  on message_log (student_id, kind, related_date)
  where status <> 'failed';

-- 2. Remove guardians and batches
drop table if exists guardians;
alter table students drop column if exists batch_id;
drop table if exists batches;

-- 3. New registry columns
alter table students rename column joined_on to admission_date;
alter table students add column school text;
alter table students add column class_level text not null;            -- e.g. 'Class 9', 'Class 10'
alter table students add column parent_name text not null;
alter table students add column phone text not null;                  -- parent's WhatsApp number, E.164
alter table students add column address text;
alter table students add column whatsapp_opt_in boolean not null default false;

-- Indian mobile numbers only: +91 followed by 10 digits starting 6-9
alter table students add constraint students_phone_format
  check (phone ~ '^\+91[6-9][0-9]{9}$');

-- 4. Speed up the attendance and fee screens
create index students_class_idx on students (class_level) where status = 'active';
create index students_name_idx on students (lower(full_name));