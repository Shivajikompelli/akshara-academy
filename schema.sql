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
  marked_by uuid default auth.uid() references auth.users(id),
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
  recorded_by uuid default auth.uid() references auth.users(id),
  created_at timestamptz default now()
);

create table message_log (
  id uuid primary key default gen_random_uuid(),
  student_id uuid references students(id) on delete set null,
  guardian_id uuid references guardians(id) on delete set null,
  fee_id uuid references fees(id) on delete set null,
  payment_id uuid references fee_payments(id) on delete set null,
  kind text not null check (kind in ('absent_alert','fee_reminder','payment_receipt')),
  template_name text not null,
  status text not null default 'queued'
    check (status in ('queued','sent','delivered','read','failed')),
  wa_message_id text,
  error text,
  related_date date,                         -- attendance date or fee period
  created_at timestamptz default now()
);

-- Prevent double-sending the same absent alert or fee reminder on the same day
create unique index message_log_dedupe
  on message_log (student_id, kind, related_date)
  where status <> 'failed' and kind in ('absent_alert', 'fee_reminder');

-- Prevent duplicate receipt logs for the same payment transaction while allowing multiple partial payments per day
create unique index message_log_payment_dedupe
  on message_log (payment_id)
  where payment_id is not null and status <> 'failed';

-- Fee status per row: paid, partial, pending, overdue
-- security_invoker = true ensures the view respects the caller's Row Level Security (RLS) policies
create or replace view fee_summary with (security_invoker = true) as
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
returns int language plpgsql security invoker set search_path = public as $$
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

-- Restrict view and RPC execution strictly to authenticated managers (revoke anonymous access)
alter view fee_summary set (security_invoker = true);
revoke all on fee_summary from anon, public;
grant select on fee_summary to authenticated, service_role;
revoke all on function generate_monthly_fees(date) from anon, public;
grant execute on function generate_monthly_fees(date) to authenticated, service_role;

-- Ensure audit attribution columns default to the authenticated user's UID
alter table attendance alter column marked_by set default auth.uid();
alter table fee_payments alter column recorded_by set default auth.uid();

-- Helper: verify caller is an active, non-blocked authenticated manager at the DB layer
create or replace function public.is_authorized_manager()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    auth.role() = 'authenticated'
    and coalesce(auth.jwt() -> 'app_metadata' ->> 'role', 'manager') not in ('blocked', 'disabled');
$$;

-- Trigger: prevent modifying fees.amount_due once payments have been recorded for that fee row
create or replace function public.enforce_fee_amount_due_lock()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.amount_due is distinct from new.amount_due then
    if exists (select 1 from public.fee_payments where fee_id = old.id) then
      raise exception 'Amount due cannot be edited after payments have been recorded.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_enforce_fee_amount_due_lock on fees;
create trigger trg_enforce_fee_amount_due_lock
  before update on fees
  for each row
  execute function public.enforce_fee_amount_due_lock();

-- Row Level Security: enforce is_authorized_manager() and protect financial/audit tables
do $$
declare t text;
begin
  foreach t in array array['batches','students','guardians','attendance']
  loop
    if to_regclass('public.' || t) is not null then
      execute format('alter table %I enable row level security', t);
      execute format('drop policy if exists "admin full access" on %I', t);
      execute format('drop policy if exists "authorized manager access" on %I', t);
      execute format(
        'create policy "authorized manager access" on %I for all to authenticated using (public.is_authorized_manager()) with check (public.is_authorized_manager())',
        t
      );
    end if;
  end loop;
end $$;

-- Fees: allow SELECT, INSERT, UPDATE for authorized managers (disallow direct DELETE)
alter table fees enable row level security;
drop policy if exists "admin full access" on fees;
drop policy if exists "authorized manager select fees" on fees;
drop policy if exists "authorized manager insert fees" on fees;
drop policy if exists "authorized manager update fees" on fees;
create policy "authorized manager select fees" on fees
  for select to authenticated using (public.is_authorized_manager());
create policy "authorized manager insert fees" on fees
  for insert to authenticated with check (public.is_authorized_manager());
create policy "authorized manager update fees" on fees
  for update to authenticated using (public.is_authorized_manager()) with check (public.is_authorized_manager());

-- Fee Payments: allow SELECT, INSERT, DELETE for authorized managers (disallow direct UPDATE of payment amounts)
alter table fee_payments enable row level security;
drop policy if exists "admin full access" on fee_payments;
drop policy if exists "authorized manager select fee_payments" on fee_payments;
drop policy if exists "authorized manager insert fee_payments" on fee_payments;
drop policy if exists "authorized manager delete fee_payments" on fee_payments;
create policy "authorized manager select fee_payments" on fee_payments
  for select to authenticated using (public.is_authorized_manager());
create policy "authorized manager insert fee_payments" on fee_payments
  for insert to authenticated with check (public.is_authorized_manager());
create policy "authorized manager delete fee_payments" on fee_payments
  for delete to authenticated using (public.is_authorized_manager());

-- Message Log: allow SELECT, INSERT, UPDATE for authorized managers; strictly disallow DELETE to preserve audit trail
alter table message_log enable row level security;
drop policy if exists "admin full access" on message_log;
drop policy if exists "authorized manager select message_log" on message_log;
drop policy if exists "authorized manager insert message_log" on message_log;
drop policy if exists "authorized manager update message_log" on message_log;
create policy "authorized manager select message_log" on message_log
  for select to authenticated using (public.is_authorized_manager());
create policy "authorized manager insert message_log" on message_log
  for insert to authenticated with check (public.is_authorized_manager());
create policy "authorized manager update message_log" on message_log
  for update to authenticated using (public.is_authorized_manager()) with check (public.is_authorized_manager());

-- Ensure message_log supports payment_id, fee_id, payment_receipt kind, and multi-receipt same-day deduplication
alter table message_log add column if not exists fee_id uuid references fees(id) on delete set null;
alter table message_log add column if not exists payment_id uuid references fee_payments(id) on delete set null;
alter table message_log drop constraint if exists message_log_kind_check;
alter table message_log add constraint message_log_kind_check
  check (kind in ('absent_alert','fee_reminder','payment_receipt'));

drop index if exists message_log_dedupe;
create unique index message_log_dedupe
  on message_log (student_id, kind, related_date)
  where status <> 'failed' and kind in ('absent_alert', 'fee_reminder');

drop index if exists message_log_payment_dedupe;
create unique index message_log_payment_dedupe
  on message_log (payment_id)
  where payment_id is not null and status <> 'failed';
