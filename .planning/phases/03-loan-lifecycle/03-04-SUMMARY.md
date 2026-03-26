---
phase: 03-loan-lifecycle
plan: 04
subsystem: loan-lifecycle-ui
tags: [ui, dialogs, client-components, loan-lifecycle, overdue, prepayment, extension]
dependency_graph:
  requires: [03-03]
  provides: [loan-extend-dialog, prepayment-dialog, batch-overdue-button]
  affects: [loans-detail-page, overdue-page, settings-page]
tech_stack:
  added: []
  patterns: [next-safe-action-v8-result-check, 2-step-dialog, conditional-render-by-status, role-based-ui]
key_files:
  created:
    - src/components/loans/extend-loan-dialog.tsx
    - src/components/loans/prepayment-dialog.tsx
    - src/components/loans/batch-overdue-button.tsx
  modified:
    - src/app/(main)/loans/[id]/page.tsx
    - src/app/(main)/overdue/page.tsx
    - src/app/(main)/settings/page.tsx
decisions:
  - "Components placed in src/components/loans/ (not src/app/) per PLAN.md artifacts spec"
  - "ExtendLoanDialog defaults new end date to currentEndDate + 12 months for UX convenience"
  - "PrepaymentDialog 2-step: form collects type/date/amount → calculatePrepayment preview → processPrepayment confirm"
  - "BatchOverdueButton uses window.confirm for destructive action guard"
  - "overdue/page.tsx uses getServerSession(authOptions) to conditionally render BatchOverdueButton for ADMIN role only"
metrics:
  duration: "5 min"
  completed: "2026-03-26"
  tasks: 6
  files: 6
---

# Phase 3 Plan 04: Loan Lifecycle UI Components Summary

3 client-side dialog components created and integrated into 3 existing pages to expose server action loan lifecycle operations in the browser.

## What Was Built

### New Components

**`src/components/loans/extend-loan-dialog.tsx`**
- "만기 연장" button triggers a Dialog
- Fields: new end date (defaults to current + 12 months), new interest rate (optional, pre-filled with current rate), settle overdue interest checkbox, memo textarea
- Calls `extendLoan` server action, checks `result?.data?.success`, calls `router.refresh()` on success

**`src/components/loans/prepayment-dialog.tsx`**
- "중도상환" button triggers a 2-step Dialog
- Step 1 (form): prepayment type radio (FULL / PARTIAL), date picker, amount input (CurrencyInput, shown only for PARTIAL), memo
- Calls `calculatePrepayment` on form submit → shows preview step
- Step 2 (preview): displays balance/accrued interest/fee breakdown, "수정" button returns to form, "중도상환 확인" calls `processPrepayment` and closes on success
- Uses `formatCurrency` from `@/lib/formatters` for all monetary displays

**`src/components/loans/batch-overdue-button.tsx`**
- "연체 일괄 처리" button with `window.confirm` guard
- Calls `processBatchOverdue({ dryRun: false })`
- Shows completion count from `res.data.affectedLoans` or error message
- Calls `router.refresh()` on success

### Modified Pages

**`src/app/(main)/loans/[id]/page.tsx`**
- Added imports for `ExtendLoanDialog` and `PrepaymentDialog`
- Added `ExtendLoanDialog` inside PageHeader, rendered when `loan.status !== "COMPLETED"`
- Added `PrepaymentDialog` inside PageHeader, rendered when `loan.status === "ACTIVE" || "OVERDUE"`
- Existing `PaymentDialog` untouched

**`src/app/(main)/overdue/page.tsx`**
- Added imports: `getServerSession`, `authOptions`, `BatchOverdueButton`
- Added `const session = await getServerSession(authOptions)` and `const isAdmin = session?.user?.role === "ADMIN"`
- Added `{isAdmin && <BatchOverdueButton />}` as PageHeader children

**`src/app/(main)/settings/page.tsx`**
- Added `{ key: "prepayment_fee_rate", label: "중도상환수수료율 (%)", defaultValue: "0" }` to `DEFAULT_SETTINGS` array between `overdue_rate_addition` and `company_name`

## PrepaymentDialog 2-Step Flow

```
Open Dialog
    |
    v
Step "form"
  - Select FULL or PARTIAL
  - Set prepaymentDate
  - If PARTIAL: enter prepaymentAmount (CurrencyInput)
  - Optional memo
  - Click "예상액 확인"
    |
    v [calls calculatePrepayment]
Step "preview"
  - Shows: balance / accrued interest / fee (with rate%) / total due
  - "수정" → back to "form"
  - "중도상환 확인" → calls processPrepayment → closes dialog
```

## Status Conditions for Button Display

| Button | Condition |
|--------|-----------|
| PaymentDialog (existing) | Always shown |
| ExtendLoanDialog | `loan.status !== "COMPLETED"` |
| PrepaymentDialog | `loan.status === "ACTIVE" \|\| loan.status === "OVERDUE"` |
| BatchOverdueButton | Server-side: `isAdmin === true` (ADMIN role only) |

## Deviations from Plan

None - plan executed exactly as written.

## Self-Check: PASSED

- `src/components/loans/extend-loan-dialog.tsx` — FOUND
- `src/components/loans/prepayment-dialog.tsx` — FOUND
- `src/components/loans/batch-overdue-button.tsx` — FOUND
- `src/app/(main)/loans/[id]/page.tsx` — FOUND, contains ExtendLoanDialog + PrepaymentDialog imports
- `src/app/(main)/overdue/page.tsx` — FOUND, contains BatchOverdueButton with isAdmin guard
- `src/app/(main)/settings/page.tsx` — FOUND, contains prepayment_fee_rate entry
- Commits: 30b3f99 (components), 7591be6 (page integrations)
- `npx tsc --noEmit` — PASSED (0 errors)
