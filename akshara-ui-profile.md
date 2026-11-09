# UI profile: Akshara Academy management app (bento version)

Data for the ui-design skill. Source: akshara_academy_ui_theme_design_system.md, adjusted for this app's real scope, for contrast, and for the approved bento layout. Where this file and the original design doc differ, THIS FILE WINS. This version replaces the earlier sidebar/red-status profile.

## 1. Platform and stack
- Next.js + Tailwind + shadcn/ui, mobile-first responsive web app. Used by 1-2 managers on a phone and an office PC.
- Under 768px: single bento grid of 2 columns, bottom tab bar (Home, Students, Attendance, Fees, Messages).
- 768px and up: top bar with logo, brand name and nav links (no sidebar). Content in a container with max-width 1100px, bento grid of 4 columns.
- Light theme only. English labels.

## 2. Tokens (CSS variables on :root, theme chosen by data-theme on <html>)
Default theme: purple. NO RED ANYWHERE in the app. Attention states use light orange.

```css
:root {
  --primary:#5B45E0; --primary-hover:#4D36D4; --primary-light:#EDEAFC; --primary-soft:#F4F2FD;
  --app-bg:#F8F9FE; --card-border:#E9D5FF; --hero-shadow:rgba(91,69,224,.25);
  --hero-gradient:linear-gradient(145deg,#5B45E0 0%,#684FF6 55%,#886DFC 100%);

  --text:#1F2438;
  --text-secondary:#5A6378;   /* replaces #7E869B, which fails AA as small text */
  --text-decor:#7E869B;       /* only icons, dividers, text 18px or larger */

  --present:#10B981;  --present-bg:#ECFDF5;  --present-text:#047857;   /* present, paid, collected */
  --attention:#FDBA74; --attention-bg:#FFF1E0; --attention-text:#9A4A00; /* absent, overdue, pending, failed, errors */
  --attention-row:#FFF8F0;                                              /* tint for an absent row inside a list */
  --whatsapp:#25D366; --whatsapp-bg:#E7F8E8; --whatsapp-text:#146C43;
}
[data-theme="mint"]   { --primary:#0F766E; --primary-hover:#0D655E; --primary-light:#CCFBF1; --primary-soft:#F0FDFA; --app-bg:#F6FAF8; --card-border:#CCFBF1; --hero-shadow:rgba(15,118,110,.2); --hero-gradient:linear-gradient(145deg,#0F766E,#14B8A6 60%,#2DD4BF); }
[data-theme="nordic"] { --primary:#0284C7; --primary-hover:#0369A1; --primary-light:#E0F2FE; --primary-soft:#F0F9FF; --app-bg:#F4F9FD; --card-border:#BAE6FD; --hero-shadow:rgba(2,132,199,.25); --hero-gradient:linear-gradient(145deg,#0369A1,#0284C7 60%,#38BDF8); }
[data-theme="rose"]   { --primary:#BE185D; --primary-hover:#9D174D; --primary-light:#FCE7F3; --primary-soft:#FDF2F8; --app-bg:#FDF6F9; --card-border:#FBCFE8; --hero-shadow:rgba(190,24,93,.25); --hero-gradient:linear-gradient(145deg,#BE185D,#DB2777 60%,#F472B6); }
```
The peach theme from the original doc is dropped: it clashes with orange as the attention color. Nordic's white-on-primary is about 4.1:1 (under AA for normal text); darken its primary if ever used. Rose is the least ideal here, as it sits close to red.

Rules:
- --present and --attention fills are for backgrounds, bars and icons. Words in those meanings use the -text variants.
- Status is never color alone: always a word ("Absent", "Overdue 5 days", "Failed", "Paid").
- Errors, destructive confirmations and failures use --attention-text on --attention-bg with an icon and a plain message. Destructive confirm buttons are solid #9A4A00 with white text. Never red.
- Verify every text/background pair with a contrast test (4.5:1 normal, 3:1 large text and icons).

## 3. Type (Inter; two weights only: 400 and 700)
| Role | Size | Use |
|---|---|---|
| Display number | 30-40px / 700 | The big figure inside a stat tile or hero |
| Title | 24-26px / 700 | Page title, greeting |
| Section | 16-18px / 700 | Tile headings |
| Body | 16px / 400, names 16px / 700 | Student names, amounts, buttons |
| Support | 14px / 400 | Class, school, parent, dates, tile labels |
| Metadata | 12px / 400 | Timestamps, counters. Never smaller. |

## 4. Spacing, radius, depth
- Spacing scale: 4, 8, 12, 16, 24, 40 (grid gap: 16 desktop, 12 phone; tile padding 22 desktop, 18 phone).
- Radius: tiles 24px, buttons 16px, toggles/inputs/small controls 12px, pills fully round, logo squircle 28px. No other values.
- Depth: tinted fills and one purple gradient hero. No shadows on tiles (shadow only on dialogs and sheets). Thin 1px #F1F2F8 dividers inside list tiles.
- Touch targets at least 44x44px.

## 5. Bento system
Grid: desktop 4 columns x 3 rows (equal), phone 2 columns, auto rows. A screen has ONE primary action.
Tile types:
1. Hero tile: purple gradient, white text, the day's key numbers and the screen's one primary action. Home only.
2. Stat tile: tinted fill, small label (14px), display number. Green tint = present / paid / collected. Orange tint = absent / pending / overdue. Soft purple = neutral info.
3. List tile: white fill, 1px --card-border, a heading and rows separated by dividers. Student, fee and message lists live INSIDE one list tile, never one tile per row.
4. Action tile/button: solid primary, full width of its tile, used for the screen's primary action.
Tile size shows importance: hero is largest, stat tiles are small, list tiles are as tall as their content allows.

## 6. Screens
Home (approved, desktop): grid of 4x3. Hero col 1-2 rows 1-2 (date, greeting, Enrolled and Present numbers, "Take attendance" white button on purple). Stat "Absent today" (orange) col 3 row 1 with "N parents notified". Stat "Fees collected" (green) col 4 row 1 with progress bar and percent of the month's total. List tile "Needs follow-up" col 3-4 row 2: two most overdue (name, class, days and amount in orange text, Remind link). List tile "Attendance by class" col 1-2 row 3 (Taken 9:40 / Not taken + Open). Stat tile "WhatsApp messages today" (soft purple) col 3-4 row 3 with sent and failed counts and a "View message log" link.
Home (phone): hero full width with a "Take attendance" button; Absent and Collected tiles side by side; follow-up list tile full width; attendance-by-class list tile full width.

Attendance (phone, approved): row of three small tiles (Class + date selector, Present count, Absent count); one list tile with rows: name (bold), school, and a two-state toggle Present / Absent (selected Present = solid #047857 with white text, selected Absent = #FFE0BD with #9A4A00 text). An absent row gets --attention-row background. Primary button below: "Save and notify N absentee(s)". On desktop: the same tiles in a row, the list tile wide beneath, primary button in the same tile row or a bar under the list.
Fees (phone, approved): Collected (green) and Pending (orange, with overdue count) stat tiles side by side; filter pills All / Pending / Paid (selected pill uses --primary-light); one list tile with name, class and due date, amount, and a status word (Overdue N days in orange text, Pending in secondary text, Paid in green text); primary button "Send reminders". "Record payment" is the row's tap action; history and single reminder live in the row menu. Desktop: stats row, pills, wide list tile.
Students: search field and the single primary "Add student" button; pills for class and status; stat tiles Active students, Classes, and "WhatsApp opted in N of M"; one list tile with rows (initials avatar, name bold, class and school, parent name and phone). Add/edit form: full-screen sheet on phone, dialog on desktop, with grouped fields (Student, Parent, Fees).
Message log: stat tiles Sent and Failed (today); filter pills (All, Absent alerts, Fee reminders); one list tile with rows (student, kind, time, status word; Failed in orange text); selecting a row shows a WhatsApp-style preview bubble with the exact template text, and the error text and a Retry button for failed ones.

## 7. Brand and scope
- Logo: squircle with the purple gradient and a white graduation-cap glyph (stroke 2.1, round caps). The mock shows a letter "A" as a placeholder; use the glyph in the app. Shown on the login screen and in the top bar / phone header.
- Post-login splash animation: NOT built.
- Avatars: initials circle. No illustrated avatars.
- Not in this app: Late status, batches, Today's Schedule, exam score broadcasts, SMS, UPI links and receipts (payments come later).

## 8. Gate
Functionality is covered by akshara-rules.md and the manual tests from steps 1 to 6. This UI work changes looks and layout only: no schema changes, no logic changes, no new features.

## 9. Navigation and account menu (added)
Bottom navigation (phone, under 768px), light style:
- White bar with 24px top radius and a 1px top border, fixed to the bottom, with a home-indicator pill under it (safe-area padding on real devices).
- Five items, each an icon (24px, 2px stroke, round caps) above a 12px label: Home, Students, Attendance, Fees, Messages.
- Active item: icon stroke in --primary with a --primary-light fill, label in --primary and bold. Inactive: icon and label #4B5468. Each target at least 44px tall.
- Icon names (lucide or similar): home, users, calendar-check, wallet, message-circle. Messages may show a small orange dot (--attention) when there are failed messages.
Desktop (768px and up): the same five destinations as text links in the top bar; active link bold with a 2px --primary underline.

Header with avatar (every screen):
- Phone: page title or greeting on the left, a 44px circular initials avatar button (--primary-light fill, --primary text) on the right.
- Desktop: avatar button at the far right of the top bar.
- Tapping the avatar opens an account menu: a card (24px radius, dialog shadow) anchored under the avatar on desktop and phone, over a dim scrim. Tap outside or press Escape to close. The avatar shows a 3px --primary ring while open.
- Menu content: large initials avatar, full name (18px bold), role ("Manager"), then labeled rows Email, Academy, Last sign-in, then a full-width "Log out" button (outlined in --primary, 48px tall, 16px radius). Log out is not destructive, so it never uses red or orange.
- Data comes from the signed-in Supabase user (email, name from user metadata, last_sign_in_at). Log out calls Supabase sign-out and returns to /login.