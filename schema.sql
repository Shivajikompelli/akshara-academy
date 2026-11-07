-- Akshara Academy: students + attendance + fees + WhatsApp message log
-- Run in Supabase SQL editor. Management-only app: disable public sign-ups
-- in Auth settings and create admin users manually.

create table batches (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  timing text,
  created_at timestamptz default now()
);

create table students (
  id uuid primary key default gen_random_uuid(),
  admission_no text unique,
  full_name text not null,
  batch_id uuid references batches(id),
  joined_on date default current_date,
  status text not null default 'active' check (status in ('active','inactive')),
  monthly_fee numeric(10,2) not null default 0,
  fee_due_day int not null default 5 check (fee_due_day between 1 and 28),
  notes text,
  created_at timestamptz default now()
);

create table guardians (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students(id) on delete cascade,
  name text not null,
  relation text,
  phone text not null,                       -- E.164, e.g. +919876543210
  is_primary boolean default false,
  whatsapp_opt_in boolean not null default false,
  created_at timestamptz default now()
);

create table attendance (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students(id) on delete cascade,
  att_date date not null default current_date,
  status text not null default 'present' check (status in ('present','absent')),
  marked_by uuid references auth.users(id),
  created_at timestamptz default now(),
  unique (student_id, att_date)
);

-- One row per student per month
create table fees (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students(id) on delete cascade,
  period date not null,                      -- first day of the month
  amount_due numeric(10,2) not null,
  due_date date not null,
  created_at timestamptz default now(),
  unique (student_id, period)
);

create table fee_payments (
  id uuid primary key default gen_random_uuid(),
  fee_id uuid not null references fees(id) on delete cascade,
  amount numeric(10,2) not null check (amount > 0),
  paid_on date not null default current_date,
  mode text default 'cash',                  -- cash / upi / bank / online (later)
  reference text,                            -- txn id; Razorpay id later
  recorded_by uuid references auth.users(id),
  created_at timestamptz default now()
);

create table message_log (
  id uuid primary key default gen_random_uuid(),
  student_id uuid references students(id) on delete set null,
  guardian_id uuid references guardians(id) on delete set null,
  kind text not null check (kind in ('absent_alert','fee_reminder')),
  template_name text not null,
  status text not null default 'queued'
    check (status in ('queued','sent','delivered','read','failed')),
  wa_message_id text,
  error text,
  related_date date,                         -- attendance date or fee period
  created_at timestamptz default now()
);

-- Prevent double-sending the same alert for the same day/period
create unique index message_log_dedupe
  on message_log (guardian_id, kind, related_date)
  where status <> 'failed';

-- Fee status per row: paid, partial, pending, overdue
create view fee_summary as
select
  f.id as fee_id, f.student_id, s.full_name, f.period, f.amount_due, f.due_date,
  coalesce(sum(p.amount), 0) as amount_paid,
  f.amount_due - coalesce(sum(p.amount), 0) as balance,
  case
    when coalesce(sum(p.amount), 0) >= f.amount_due then 'paid'
    when f.due_date < current_date then 'overdue'
    when coalesce(sum(p.amount), 0) > 0 then 'partial'
    else 'pending'
  end as status
from fees f
join students s on s.id = f.student_id
left join fee_payments p on p.fee_id = f.id
group by f.id, s.full_name;

-- Create this month's fee rows for all active students (safe to re-run)
create or replace function generate_monthly_fees(p_month date default date_trunc('month', current_date)::date)
returns int language plpgsql as $$
declare n int;
begin
  insert into fees (student_id, period, amount_due, due_date)
  select id, p_month, monthly_fee, p_month + (fee_due_day - 1)
  from students
  where status = 'active' and monthly_fee > 0
  on conflict (student_id, period) do nothing;
  get diagnostics n = row_count;
  return n;
end $$;

-- Row Level Security: any signed-in user is management (sign-ups are disabled)
do $$
declare t text;
begin
  foreach t in array array['batches','students','guardians','attendance','fees','fee_payments','message_log']
  loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy "admin full access" on %I for all to authenticated using (true) with check (true)', t);
  end loop;
end $$;
