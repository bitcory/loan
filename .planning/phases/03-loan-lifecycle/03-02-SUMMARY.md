---
phase: 03-loan-lifecycle
plan: "02"
subsystem: lib/loan-calculator
tags: [financial-calculations, pure-functions, decimal, prepayment, overdue]
dependency_graph:
  requires:
    - src/lib/interest.ts (calculateInterestForDays)
    - src/lib/schedule-generator.ts (generateSchedule, ScheduleItem)
  provides:
    - calculatePrepaymentFee
    - recalculateSchedule
    - settleOverdueInterest
    - AccruedInterestResult
    - OverdueSettlementResult
    - LoanForCalculation
    - ScheduleForCalculation
    - ScheduleForSettlement
  affects:
    - src/actions/loan-lifecycle-actions.ts (Wave 3 — will import these functions)
tech_stack:
  added: []
  patterns:
    - PrismaDecimalLike interface for safe Prisma-to-Decimal.js conversion
    - Pure function library with no DB calls (testable in isolation)
    - installmentNumber offset pattern for schedule recalculation continuity
key_files:
  created:
    - src/lib/loan-calculator.ts
  modified: []
decisions:
  - "Reuse generateSchedule from schedule-generator.ts rather than re-implement amortization math"
  - "PrismaDecimalLike interface (toString(): string) used instead of importing Prisma types directly — avoids coupling"
  - "settleOverdueInterest includes SCHEDULED status (dueDate < settleDate) to handle missed payments not yet marked OVERDUE"
metrics:
  duration: "3 min"
  completed_date: "2026-03-26"
  tasks_completed: 1
  files_created: 1
  files_modified: 0
---

# Phase 03 Plan 02: loan-calculator.ts Pure Functions Summary

**One-liner:** Pure financial calculation library for prepayment fee, schedule recalculation, and overdue interest settlement using Decimal.js with actual/365 day-count convention.

## Exported Functions and Types

### Functions

**`calculatePrepaymentFee(loan, prepaymentAmount, prepaymentDate, orgFeeRate, isFull): AccruedInterestResult`**

Calculates accrued interest and prepayment fee for early repayment.

- `loan: LoanForCalculation` — loan with balance, interestRate, prepaymentFeeRate, schedules
- `prepaymentAmount: Decimal | number | string` — amount being repaid (full = loan.balance, partial = desired amount)
- `prepaymentDate: Date` — date of early repayment
- `orgFeeRate: Decimal | number | string | null` — org-level default fee rate from Setting
- `isFull: boolean` — true for full prepayment, false for partial

Returns `AccruedInterestResult` with `accruedInterest`, `prepaymentFee`, `totalDue`, `feeRate`.

---

**`recalculateSchedule(loan, fromDate, newEndDate?, newRate?, newBalance?): ScheduleItem[]`**

Generates replacement schedule items for unpaid future installments.

- `loan: LoanForCalculation` — loan with current schedules (PAID/PARTIAL/SCHEDULED)
- `fromDate: Date` — recalculation start date (extension date or prepayment date)
- `newEndDate?: Date` — new maturity date (defaults to `loan.endDate`)
- `newRate?: Decimal | number | string` — new interest rate (defaults to `loan.interestRate`)
- `newBalance?: Decimal | number | string` — new principal base (defaults to `loan.balance`)

Returns `ScheduleItem[]` from `schedule-generator.ts` with `installmentNumber` adjusted for continuity.

---

**`settleOverdueInterest(schedules, overdueRate, settleDate): OverdueSettlementResult`**

Calculates total overdue interest across all past-due schedules. Does not write to DB.

- `schedules: ScheduleForSettlement[]` — schedule array with `id` field
- `overdueRate: Decimal | number | string` — combined rate = loanRate + overdueRateAddition
- `settleDate: Date` — settlement reference date (usually today)

Returns `OverdueSettlementResult` with `totalOverdueInterest` and `affectedScheduleIds`.

---

### Interfaces (exports)

| Interface | Purpose |
|-----------|---------|
| `LoanForCalculation` | Input shape for loan data from Prisma (uses PrismaDecimalLike) |
| `ScheduleForCalculation` | Input shape for schedule rows (without id) |
| `ScheduleForSettlement` | Extends ScheduleForCalculation with `id: string` |
| `AccruedInterestResult` | Return type of `calculatePrepaymentFee` |
| `OverdueSettlementResult` | Return type of `settleOverdueInterest` |

---

## Fee Rate Priority Logic

```
if (loan.prepaymentFeeRate !== null)  → use loan-level rate
else if (orgFeeRate !== null)         → use org-level rate (from Setting key "prepayment_fee_rate")
else                                  → 0% (no fee)
```

Loan-level overrides always take precedence. Both levels are nullable — defaulting to zero means prepayment is always possible even without configuration.

## installmentNumber Offset Pattern

`recalculateSchedule` calls `generateSchedule` which always produces 1-based installment numbers. After a partial repayment (e.g., 3 of 12 installments paid), the new schedule must start at installment 4, not 1.

Offset computation:
```typescript
const paidInstallments = loan.schedules
  .filter(s => s.status === "PAID" || s.status === "PARTIAL")
  .map(s => s.installmentNumber);
const startInstallmentNumber = paidInstallments.length > 0 ? Math.max(...paidInstallments) + 1 : 1;

// Applied after generateSchedule:
installmentNumber: item.installmentNumber + startInstallmentNumber - 1
```

This preserves correct installment numbering in the DB across extension and partial prepayment events.

## Prisma Decimal Handling

All Prisma Decimal fields are typed as `PrismaDecimalLike` (interface with `toString(): string`) and converted at function entry:

```typescript
const balance = new Decimal(loan.balance.toString());
```

This avoids direct coupling to `@prisma/client` types while being safe against precision loss at the DB boundary.

## Deviations from Plan

None — plan executed exactly as written. The code in the plan action block was used verbatim. TypeScript compiled clean on first attempt (`npx tsc --noEmit` — no errors).

## Known Stubs

None — this is a pure calculation library with no UI rendering or data-fetching paths.

## Self-Check: PASSED

- `/Users/toolb/develop/tool/loan/src/lib/loan-calculator.ts` — exists (202 lines)
- Commit `38a9853` — confirmed in git log
- Exports verified: `calculatePrepaymentFee`, `recalculateSchedule`, `settleOverdueInterest`, `AccruedInterestResult`, `OverdueSettlementResult`, `LoanForCalculation`, `ScheduleForCalculation`, `ScheduleForSettlement`
- `npx tsc --noEmit` — zero errors
