# Akshara Academy: Pre-Release Security & Performance Checklist

Use this checklist before releasing every new version of the Web Portal or Android APK.

---

## 1. Secrets & Credentials Scan
- [ ] Ensure `.env.local` and `.env` are NOT committed (`git status --ignored`).
- [ ] Verify `SUPABASE_SERVICE_ROLE_KEY` is never referenced in client code or prefixed with `NEXT_PUBLIC_`.
- [ ] Verify `WHATSAPP_TOKEN` and `CRON_SECRET` exist only in Vercel project environment variables.
- [ ] In Supabase Console: Confirm **Authentication $\rightarrow$ Settings $\rightarrow$ Disable Public Signups** is toggled ON.

## 2. API & Authentication Verification
- [ ] Verify every Route Handler in `src/app/api/` calls `verifyApiAuth(req)` before accessing database resources.
- [ ] Verify state-changing mutations (`POST`, `PUT`, `DELETE`) call `verifySameOrigin(req)` for CSRF protection.
- [ ] Verify failed login attempts trigger the rate limiter (lockout after 5 failed attempts).
- [ ] Test logout to confirm `supabase.auth.signOut({ scope: 'global' })` clears cookies and invalidates sessions.

## 3. Android & WebView Configuration
- [ ] Confirm `server.allowNavigation` in `capacitor.config.ts` includes only `akshara-academy-eta.vercel.app` and `*.supabase.co`.
- [ ] Verify `network_security_config.xml` is linked in `AndroidManifest.xml` with `cleartextTrafficPermitted="false"`.
- [ ] Test Android hardware and gesture back button: confirms it goes back in history rather than quitting the app.
- [ ] Test app launch in Airplane mode: confirms branded offline fallback screen appears rather than a browser network error.
- [ ] Verify release build generates with ProGuard minification:
  ```powershell
  cd android && .\gradlew assembleRelease
  ```

## 4. Performance & Core Web Vitals Budget
- [ ] Verify Turbopack production build compiles cleanly without TypeScript or ESLint errors:
  ```powershell
  npx tsc --noEmit; npm run build
  ```
- [ ] Verify all dashboard queries in `src/app/(dashboard)/page.tsx` remain parallelized via `Promise.all()`.
- [ ] Confirm database indexes from `migration_indexes_perf.sql` are active in the production database.
- [ ] Keep initial JS bundle under 150 KB gzipped per route.
- [ ] Verify all modal dialogs fit within `max-h-[88dvh]` with permanently docked action footers.
