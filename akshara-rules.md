# Project rules: Akshara Academy management app

## Scope (strict)
Build ONLY these two modules. Do not add anything else (no student/parent login, no exams, no timetable, no reports beyond what is listed).

1. **Students and attendance**
   - Add/edit/deactivate students. Each student is a single record in the `students` table (fields: `full_name`, `school`, `class_level`, `parent_name`, `phone`, `address`, `admission_date`, `whatsapp_opt_in`, `monthly_fee`, `fee_due_day`, `status`, `admission_no`, `notes`).
   - Daily attendance screen: pick a class (e.g. Class 10), all students default to present, the manager taps absentees only.
   - "Save and notify absentees" button sends a WhatsApp absent alert to each absent student's parent if `whatsapp_opt_in` is true.
2. **Fees**
   - Dashboard with filters: Paid, Pending, Partial, Overdue (use the `fee_summary` view). Sort by days overdue.
   - Record a payment against a fee row (amount, date, mode, reference).
   - Daily scheduled job sends fee reminders for pending/overdue fees.
   - Message log screen: what was sent, to whom, status, with a Retry button for failed ones.

Users: management only (2 admin accounts). Sign-ups disabled.

## Stack
- Next.js (App Router, TypeScript), Tailwind CSS, shadcn/ui
- Supabase: Postgres, Auth, Edge Functions, pg_cron. Schema is in `schema.sql` and `migration_student_registry.sql`.
- WhatsApp Cloud API (Meta), called only from server code or Edge Functions.

## UI
- Simple, clean, large tap targets, works well on phone and desktop.
- Few screens: Login, Students, Attendance, Fees, Message log. Left nav on desktop, bottom tabs on mobile.
- Plain language labels. No jargon.

## WhatsApp
- Only approved templates can be sent outside a 24h window. Template names:
  - `absent_alert_v1`:
    ```
    Dear Parent,
    This is an attendance update.
    {{1}} has been marked absent today ({{2}}).
    Kindly contact us if you have any concerns.

    – Akshara Academy
    ```
  - `fee_reminder_v1`:
    ```
    Dear Parent,
    This is a fee reminder for {{1}}.
    The tuition fee of ₹{{2}} for {{3}} is due on {{4}}.
    Kindly ignore this message if already paid.

    – Akshara Academy
    ```
  - `payment_receipt_v1`:
    ```
    Dear Parent,
    This is a payment confirmation for {{1}}.
    We have received the tuition fee of ₹{{2}} for {{3}} on {{4}} (Receipt: {{5}}).
    Thank you for your payment.

    – Akshara Academy
    ```
- Never message a parent whose `whatsapp_opt_in` is false.
- Log every attempt in `message_log`; store failures with the error text.
- Send in small batches with a short delay, not all at once.

## Security
- WhatsApp token, Supabase service key and any secret live in environment variables / Supabase secrets only. Never in client code or git. Provide `.env.example`.
- Keep Row Level Security on for every table.

## Working style
- Build in this order and stop after each step for me to test: (1) schema + login, (2) student registry CRUD, (3) attendance screen, (4) WhatsApp absent alert, (5) fees dashboard + payments, (6) fee reminder job, (7) message log.
- Make a git commit after each step.
- Keep code simple and commented. Ask before adding a library.
- Design so online payments can be added later (a payment record already has `mode` and `reference`), but do not build payments now.
