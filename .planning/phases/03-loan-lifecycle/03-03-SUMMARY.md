---
phase: 03-loan-lifecycle
plan: "03"
subsystem: loan-lifecycle-actions
tags: [server-actions, prepayment, loan-extension, batch-overdue, cron]
dependency_graph:
  requires: [03-02]
  provides: [extendLoan, calculatePrepayment, processPrepayment, processBatchOverdue, GET /api/batch/overdue]
  affects: [loans, loan_schedules, payments]
tech_stack:
  added: []
  patterns: [adminAction, authenticatedAction, ctx.db.$transaction (interactive), organizationId in deleteMany]
key_files:
  created:
    - src/actions/loan-lifecycle-actions.ts
    - src/app/api/batch/overdue/route.ts
  modified:
    - src/lib/validators.ts
decisions:
  - "LoanSchedule uses status field (SCHEDULED/PAID/OVERDUE/PARTIAL) — no isOverdue boolean field"
  - "Payment model has no paymentType field — removed from create calls"
  - "Cron route uses Array.from(orgMap) for ES2015 Map iteration compatibility"
  - "extendLoan uses settleOverdueNow flag to optionally settle overdue interest before extension"
metrics:
  duration: "~15min"
  completed: "2026-03-26"
  tasks: 3
  files: 3
---

# Phase 03 Plan 03: Loan Lifecycle Server Actions Summary

Implemented loan lifecycle server actions and cron route handler for a multi-tenant loan management system using next-safe-action with authenticatedAction/adminAction wrappers and Prisma interactive transactions.

## Files Created/Modified

| File | Type | Purpose |
|------|------|---------|
| `src/actions/loan-lifecycle-actions.ts` | Created | 4 server actions for loan lifecycle |
| `src/app/api/batch/overdue/route.ts` | Created | GET cron route for daily overdue batch |
| `src/lib/validators.ts` | Modified | Added extendLoanSchema, prepaymentSchema |

## Action Permission Levels

| Action | Guard | Requirement |
|--------|-------|-------------|
| `extendLoan` | `adminAction` | LOAN-01, 02, 03 |
| `calculatePrepayment` | `authenticatedAction` | LOAN-07 (read-only) |
| `processPrepayment` | `authenticatedAction` | LOAN-04, 05 |
| `processBatchOverdue` | `adminAction` | LOAN-09, 10 |

## processBatchOverdue Transaction Strategy

Single `ctx.db.$transaction(async tx => { ... })` (interactive form) iterates all overdue loans in this org atomically. For each loan:
1. `tx.loanSchedule.updateMany` — sets overdue schedules to status `"OVERDUE"` (includes `organizationId` in where clause)
2. `tx.loan.update` — sets `status="OVERDUE"`, `overdueDays`, `overdueStage`

Supports `dryRun: true` mode to preview count without DB writes.

## Cron Route Authentication

`GET /api/batch/overdue` authenticates via `x-cron-secret` header checked against `process.env.CRON_SECRET`. No session context — uses `basePrisma` directly, processes all organizations. Returns 401 if secret is missing or mismatched.

## Validators.ts Schemas Added

- `extendLoanSchema` — loanId, newEndDate, newInterestRate (optional, max 20%), settleOverdueNow (bool, default true), memo
- `prepaymentSchema` — loanId, prepaymentDate, prepaymentType (FULL | PARTIAL), prepaymentAmount (optional), memo
- `ExtendLoanFormData` type
- `PrepaymentFormData` type

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed Map iteration for TypeScript ES target**
- **Found during:** Task 3 — tsc --noEmit
- **Issue:** `for (const [k, v] of orgMap)` fails with TS2802 when target is below es2015
- **Fix:** Changed to `Array.from(orgMap)` for compatibility
- **Files modified:** src/app/api/batch/overdue/route.ts
- **Commit:** 1682521

## Schema Verification Notes

Checked schema.prisma before writing code:
- `LoanSchedule.status` field exists (SCHEDULED/PAID/OVERDUE/PARTIAL) — no `isOverdue` boolean
- `Payment` has no `paymentType` field — removed from all `payment.create` calls
- Relation name is `schedules` (not `loanSchedules`) on the Loan model
- `Loan.prepaymentFeeRate Decimal?` field exists (added in Phase 03-01 migration)

## Commits

- `7ad879d` feat(03-03): add extendLoanSchema and prepaymentSchema to validators.ts
- `d70db65` feat(03-03): create loan-lifecycle-actions.ts with 4 server actions
- `1682521` feat(03-03): create GET /api/batch/overdue cron route handler

## Self-Check: PASSED

- src/actions/loan-lifecycle-actions.ts: EXISTS
- src/app/api/batch/overdue/route.ts: EXISTS
- src/lib/validators.ts: MODIFIED
- `npx tsc --noEmit`: PASSES (0 errors)
- All 4 actions exported: extendLoan, calculatePrepayment, processPrepayment, processBatchOverdue
