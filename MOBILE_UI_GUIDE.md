# Akshara Academy Mobile UI/UX & Responsiveness Guide

This guide establishes the mobile design standards, responsive architecture, touch target guidelines, and component patterns for the Akshara Academy management portal.

---

## 1. Viewport & Breakpoint Strategy

| Breakpoint | CSS Media Query | Target Devices | Layout Behavior |
| :--- | :--- | :--- | :--- |
| **Compact Mobile** | `< 360px` | Small Android Go phones, iPhone SE (1st gen) | Single column, tight badges, 96px compact toggles |
| **Standard Mobile** | `360px – 639px` | iPhone 12–16, Samsung Galaxy S21–S24, Pixel 6–9 | Single column, 2-column filter grids, adaptive cards |
| **Phablet / Small Tablet** | `640px – 767px` | iPad Mini portrait, Foldables unfolded | Fluid 2-column layouts, expanded filter controls |
| **Tablet / Desktop** | `>= 768px` (`md:`) | iPad landscape, Laptops, Desktops | Desktop top bar, table/row views, multi-column grids |

---

## 2. Safe Area & Dynamic Viewport Handling

Mobile browsers have dynamic UI bars (URL bar collapsing, navigation controls) and hardware cutouts (notches, Dynamic Island, Android gesture bars).

### Key Rules:
1. **Never use fixed `100vh` on mobile forms/auth screens.** Use `100dvh` (dynamic viewport height) so virtual keyboards don't push content offscreen or cause layout jumps:
   ```tsx
   className="min-h-[100dvh] flex items-center justify-center p-4 pt-safe pb-safe ..."
   ```
2. **Safe Area Insets:** Global utility classes in `src/app/globals.css`:
   ```css
   .pb-safe {
     padding-bottom: env(safe-area-inset-bottom, 0px);
   }
   .pt-safe {
     padding-top: env(safe-area-inset-top, 0px);
   }
   ```
3. **Sticky Bottom Dock & Navigation Clearance:**
   - `MobileBottomNav` is docked at `bottom-0` with `pb-safe`.
   - Any secondary floating bar (e.g., Attendance "Save & Notify" dock) must float above the bottom nav on mobile:
     ```tsx
     className="fixed bottom-[calc(4.75rem+env(safe-area-inset-bottom,0px))] md:bottom-0 left-0 right-0 z-30 ..."
     ```
   - Main page containers must apply bottom padding to ensure content is never obscured:
     ```tsx
     className="pb-[calc(6.5rem+env(safe-area-inset-bottom,0px))] md:pb-8"
     ```

---

## 3. The Golden 3-Tier Modal Dialog Architecture

> [!IMPORTANT]
> Never put form inputs and action buttons in a single unconstrained scrolling container. Doing so causes action buttons to disappear below the viewport on phones.
> 
> **Never mix `bottom-0 translate-y-0` with base `top-1/2 -translate-y-1/2`:** `DialogContent` centers dialogs via `fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2`. Overriding `translate-y-0` while `top-1/2` is active anchors the top of the dialog at 50% screen height, pushing the footer off-screen. Always use `rounded-[20px] sm:rounded-[24px] max-h-[88dvh] flex flex-col`.

All modals in Akshara Academy must strictly adhere to the **3-Tier Structure**:

```tsx
<Dialog open={open} onOpenChange={onOpenChange}>
  <DialogContent className="p-0 gap-0 overflow-hidden bg-white border border-[var(--card-border)] shadow-2xl rounded-[20px] sm:rounded-[24px] w-[calc(100%-1.5rem)] sm:max-w-2xl max-h-[88dvh] flex flex-col">
    
    {/* Tier 1: Fixed Header */}
    <div className="px-5 py-4 sm:px-6 sm:py-5 border-b border-[var(--card-border)]/80 bg-white shrink-0 pr-12">
      <DialogHeader>
        <DialogTitle className="text-base sm:text-lg font-bold text-[var(--text)]">
          Modal Title
        </DialogTitle>
        <DialogDescription className="text-xs text-[var(--text-secondary)]">
          Contextual subtitle or instructions
        </DialogDescription>
      </DialogHeader>
    </div>

    {/* Tier 2: Scrollable Content Body */}
    <div className="flex-1 min-h-0 overflow-y-auto px-5 py-5 sm:px-7 sm:py-6 space-y-6">
      {/* Form sections, inputs, previews go here */}
    </div>

    {/* Tier 3: Docked Sticky Footer */}
    <div className="px-5 py-3.5 sm:px-7 sm:py-4 border-t border-[var(--card-border)]/80 bg-white shrink-0 shadow-[0_-4px_16px_rgba(0,0,0,0.03)] flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2.5">
      <button type="button" className="min-h-[44px] flex-1 sm:flex-initial ...">
        Cancel
      </button>
      <button type="submit" className="min-h-[44px] flex-1 sm:flex-initial ...">
        Save
      </button>
    </div>

  </DialogContent>
</Dialog>
```

---

## 4. Touch Target & Accessibility Guidelines

- **Minimum Tap Target:** Every interactive element (buttons, toggles, select triggers, links, icon buttons) must have a clickable area of at least **44 × 44 px** (`min-h-[44px]`).
- **Touch Manipulation:** `touch-action: manipulation;` is enabled on `body` in `globals.css` to prevent unwanted 300ms double-tap zoom delays.
- **iOS Zoom Prevention:** All `<input>` and `<select>` elements must have a font size of at least `16px` (`text-base` or `text-sm sm:text-base`) on mobile to prevent Safari from automatically zooming into the field.
- **Hit Area Spacing:** Place at least 8px between adjacent touch targets.

---

## 5. Mobile Data Card Architecture

Tables with horizontal scrollbars (`overflow-x: auto`) degrade usability on mobile phones. Akshara Academy uses **Adaptive Hybrid Rows**:

### Desktop (`md: >= 768px`):
Displays structured horizontal rows with balanced columns.

### Mobile (`< 768px`):
Reorganizes into a compact, high-contrast card:
1. **Header Row:** Student Initials Avatar + Student Name + Phone + 3-Dot Quick Action Menu.
2. **Metric Strip:** 2-column or 3-column pill grid displaying key indicators (e.g., Amount Due, Due Date, Class).
3. **Action Footer:** Status chip (e.g., Overdue, Paid, Partial) + full-width primary touch action (e.g., Record Payment, Edit).

---

## 6. Color Tokens & High-Contrast Typography

| Element | CSS Variable / Token | Usage |
| :--- | :--- | :--- |
| **Primary Brand** | `var(--primary)` (`#7B1FA2`) | Primary buttons, active tabs, header icons |
| **Primary Soft** | `var(--primary-soft)` (`#F3E8FF`) | Hover states, secondary icon containers |
| **Attention / Overdue** | `var(--attention-text)` (`#B91C1C`) | Overdue balances, absent tags, error banners |
| **Attention Background** | `var(--attention-bg)` (`#FEF2F2`) | Absent student rows, warning cards |
| **Present / Success** | `var(--present-text)` (`#047857`) | Present toggles, paid badges, success messages |
| **Present Background** | `var(--present-bg)` (`#ECFDF5`) | Present status pills, paid tags |
| **WhatsApp Accent** | `var(--whatsapp)` (`#25D366`) | WhatsApp badges, delivery checkmarks |

