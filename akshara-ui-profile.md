# UI profile: Akshara Academy management app

Data for the ui-design skill. Source: akshara_academy_ui_theme_design_system.md, adjusted for this app's real scope and for contrast. Where this file and the original design doc differ, THIS FILE WINS.

## 1. Platform and stack
- Next.js + Tailwind + shadcn/ui, mobile-first responsive web app. Used by 1-2 managers, on a phone and on an office PC.
- Under 768px: single column, bottom tab bar (Home, Students, Attendance, Fees, Messages).
- 1024px and up: left sidebar nav, content in a container with max-width 960px. Do not stretch to fill wide screens.
- Light theme only. English labels.

## 2. Tokens (single swap point: CSS variables on :root, theme chosen by data-theme on <html>)
Default theme: purple (matches the logo). Other themes only override the brand variables.

```css
:root {
  --primary:#5B45E0; --primary-hover:#4D36D4; --primary-light:#EDEAFC; --primary-soft:#F4F2FD;
  --app-bg:#F8F9FE; --card-border:#E9D5FF; --hero-shadow:rgba(91,69,224,.25);
  --hero-gradient:linear-gradient(145deg,#5B45E0 0%,#684FF6 55%,#886DFC 100%);

  --text:#1F2438;
  --text-secondary:#5A6378;   /* replaces #7E869B, which fails AA as small text */
  --text-decor:#7E869B;       /* only for icons, dividers, text 18px or larger */

  --present:#10B981; --present-bg:#ECFDF5; --present-text:#047857;
  --absent:#EF4444;  --absent-bg:#FEF2F2;  --absent-text:#B42318;
  --warn:#F59E0B;    --warn-bg:#FFFBEB;    --warn-text:#8A5300;   /* "Not taken yet", partial fee */
  --whatsapp:#25D366; --whatsapp-bg:#E7F8E8; --whatsapp-text:#146C43;
}
[data-theme="mint"]   { --primary:#0F766E; --primary-hover:#0D655E; --primary-light:#CCFBF1; --primary-soft:#F0FDFA; --app-bg:#F6FAF8; --card-border:#CCFBF1; --hero-shadow:rgba(15,118,110,.2); --hero-gradient:linear-gradient(145deg,#0F766E,#14B8A6 60%,#2DD4BF); }
[data-theme="peach"]  { --primary:#EA580C; --primary-hover:#C2410C; --primary-light:#FFEDD5; --primary-soft:#FFF7ED; --app-bg:#FFF9F5; --card-border:#FFEDD5; --hero-shadow:rgba(234,88,12,.25); --hero-gradient:linear-gradient(145deg,#EA580C,#F97316 60%,#FB923C); }
[data-theme="nordic"] { --primary:#0284C7; --primary-hover:#0369A1; --primary-light:#E0F2FE; --primary-soft:#F0F9FF; --app-bg:#F4F9FD; --card-border:#BAE6FD; --hero-shadow:rgba(2,132,199,.25); --hero-gradient:linear-gradient(145deg,#0369A1,#0284C7 60%,#38BDF8); }
[data-theme="rose"]   { --primary:#BE185D; --primary-hover:#9D174D; --primary-light:#FCE7F3; --primary-soft:#FDF2F8; --app-bg:#FDF6F9; --card-border:#FBCFE8; --hero-shadow:rgba(190,24,93,.25); --hero-gradient:linear-gradient(145deg,#BE185D,#DB2777 60%,#F472B6); }
```

Contrast warning: white text on the peach primary is about 3.6:1 and on the nordic primary about 4.1:1, both under the 4.5:1 AA bar for normal-size button text. If either theme is chosen, darken its primary until white text passes. Purple, mint and rose pass.

Rule: --present, --absent, --warn and --whatsapp are for icons, fills and borders. Text in those meanings uses the -text variants. Status is never color alone: always a word or icon too.

## 3. Type (Inter; two weights only: 400 and 700)
| Role | Size | Use |
|---|---|---|
| Title | 24px / 700 | Page title, hero numbers |
| Section | 18px / 700 | Card and section headings |
| Body | 16px / 400, names 16px / 700 | Student names, fee amounts, buttons |
| Support | 14px / 400 | School, parent name, dates |
| Metadata | 12px / 400 | Counters, timestamps. Never smaller. |

The original doc's 10-12px student names and captions are NOT used. Phone body text is 16px.

## 4. Spacing, radius, depth
- Spacing scale: 4, 8, 16, 24, 40. More space around a group than inside it.
- Radius: hero card and cards 24px, inputs and buttons 12px, pills fully round, logo squircle 28px. No other values.
- Depth: color and accent edges first. Shadow only for the hero card, sheets and dialogs. Rows are separated by space or background, not borders.
- Touch targets at least 44x44px.

## 5. Brand
- Logo: squircle with the purple gradient from the design doc and a white graduation-cap glyph (stroke 2.1, round caps), soft glow shadow. Shown on the login screen and in the header.
- Post-login splash animation: NOT built. A manager logs in daily and a 2.8 second animation each time is a cost. Revisit later.

## 6. Scope decisions (the design doc has more than this app does)
Keep, mapped to real features:
- Screens: Login, Home, Students, Attendance, Fees, Message log.
- Home: hero card with today's numbers (Enrolled, Present, Absent), quick actions "Take attendance" and "Send fee reminders", an overdue-fees alert with one tap to the Fees page, and a list of classes with "Taken / Not taken yet".
- Attendance rows: initials avatar, student name, parent name, two-state toggle Present / Absent.
- Fees: summary card (collected vs outstanding), tabs All / Pending / Paid mapped to the fee_summary statuses, "Record payment" dialog.
- Message log: kind filter (absent alert / fee reminder) and a WhatsApp-style preview bubble showing the template text for a selected message.

Drop or change (not in the database or not in scope):
- "Late" status: attendance has only present and absent.
- Batches, batch filters and "Today's Schedule": the app uses class (Class 8 to 12), not batches.
- "Weekly Exam Test Scores" broadcasts and the Parent Communications hub tiles: no such module.
- "Send Absentee SMS": it is WhatsApp. Use "Save and notify absentees".
- UPI payment link and receipt generator: later, with payments.
- Illustrated avatars: use an initials circle.

## 7. Measured state of the source design (for the skill's repair rules)
- #7E869B secondary text on white is about 3.6:1: fails. Replaced by --text-secondary.
- #10B981 green as text on white is about 2.5:1: fails. Use --present-text.
- #EF4444 red as text on #FEF2F2 is about 3.8:1: fails. Use --absent-text.
- 10-11px captions and 12px names: below the mobile floor. Replaced by the scale above.
Verify every color pair with a contrast function in a small test file. Do not eyeball.

## 8. Gate
Functionality is covered by akshara-rules.md and the manual tests from steps 1 to 6. This UI work changes looks and layout only: no schema changes, no logic changes, no new features.
