-- ============================================================================
-- STEP 6: DAILY SCHEDULED FEE REMINDERS (pg_cron + pg_net + Supabase Vault)
-- Run this in the Supabase SQL Editor.
-- ============================================================================

-- 1. Enable pg_cron and pg_net extensions (if not already enabled)
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- 2. Store Secrets in Supabase Vault (Never in git or client code)
-- Replace 'https://<your-project-ref>.supabase.co/functions/v1/send-fee-reminders'
-- and '<your-supabase-service-role-key>' with your actual values.

-- A) Function URL secret:
select vault.create_secret(
  'https://YOUR_PROJECT_REF.supabase.co/functions/v1/send-fee-reminders',
  'fee_reminder_edge_function_url',
  'Edge Function URL for sending scheduled fee reminders'
);

-- B) Service Role Key secret:
select vault.create_secret(
  'YOUR_SUPABASE_SERVICE_ROLE_KEY',
  'fee_reminder_service_role_key',
  'Service role key for authenticating pg_cron Edge Function calls'
);

-- 3. Schedule Daily Fee Reminder Job
-- Runs every day at 04:00 UTC (which is 09:30 AM Asia/Kolkata IST)
-- First unschedule any older job if exists
do $$
begin
  perform cron.unschedule('daily-fee-reminders');
exception when others then
  null;
end $$;

select cron.schedule(
  'daily-fee-reminders',
  '0 4 * * *', -- At 04:00 UTC every day (09:30 AM IST)
  $$
  select
    net.http_post(
      url := (select decrypted_secret from vault.decrypted_secrets where name = 'fee_reminder_edge_function_url' limit 1),
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'fee_reminder_service_role_key' limit 1)
      ),
      body := jsonb_build_object('source', 'pg_cron')
    ) as request_id;
  $$
);

-- ============================================================================
-- VERIFICATION & MONITORING QUERIES
-- ============================================================================

-- Check if the cron job is active:
-- select jobid, jobname, schedule, active from cron.job where jobname = 'daily-fee-reminders';

-- Check recent execution logs and status:
-- select * from cron.job_run_details where jobid in (select jobid from cron.job where jobname = 'daily-fee-reminders') order by start_time desc limit 10;

-- Trigger an immediate manual test run via SQL:
-- select net.http_post(
--   url := (select decrypted_secret from vault.decrypted_secrets where name = 'fee_reminder_edge_function_url' limit 1),
--   headers := jsonb_build_object(
--     'Content-Type', 'application/json',
--     'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'fee_reminder_service_role_key' limit 1)
--   ),
--   body := jsonb_build_object('source', 'sql_manual_test')
-- );

