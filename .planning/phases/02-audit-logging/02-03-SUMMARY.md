---
phase: 02-audit-logging
plan: "03"
subsystem: audit
tags: [audit, actions, mutation-logging, before-after-snapshot]
dependency_graph:
  requires: [02-02]
  provides: [audit-mutation-coverage]
  affects: [customer-actions, collateral-actions, loan-actions, setting-actions]
tech_stack:
  added: []
  patterns: [fire-and-forget audit, before-snapshot via findFirst, sanitizeForLog]
key_files:
  modified:
    - src/actions/customer-actions.ts
    - src/actions/collateral-actions.ts
    - src/actions/loan-actions.ts
    - src/actions/setting-actions.ts
decisions:
  - "processPayment logs two audit entries: Payment CREATE and Loan UPDATE"
  - "sanitizeForLog masks PII and excludes organizationId/passwordHash/updatedAt from snapshots"
  - "updateSettings uses ctx.organizationId as entityId since settings have no single entity ID"
metrics:
  duration: "~15 min"
  completed: "2026-03-26"
  tasks_completed: 2
  files_modified: 4
---

# Phase 02 Plan 03: Audit Logging — Mutation Coverage Summary

logAudit() calls wired into all 15 mutations across 4 action files, with before/after snapshots and PII masking via sanitizeForLog.

## Mutation Inventory

| File | Function | Entity Type | Action | before | after |
|------|----------|-------------|--------|--------|-------|
| customer-actions.ts | createCustomer | Customer | CREATE | null | parsedInput (PII masked) |
| customer-actions.ts | updateCustomer | Customer | UPDATE | findFirst snapshot | parsedInput.data |
| customer-actions.ts | deleteCustomer | Customer | DELETE | findFirst snapshot | null |
| collateral-actions.ts | createCollateral | Collateral | CREATE | null | parsedInput |
| collateral-actions.ts | updateCollateral | Collateral | UPDATE | findFirst snapshot | parsedInput.data |
| collateral-actions.ts | deleteCollateral | Collateral | DELETE | findFirst snapshot | null |
| collateral-actions.ts | createMortgage | Mortgage | CREATE | null | parsedInput |
| collateral-actions.ts | updateMortgage | Mortgage | UPDATE | findFirst snapshot | parsedInput.data |
| collateral-actions.ts | deleteMortgage | Mortgage | DELETE | findFirst snapshot | null |
| loan-actions.ts | createLoan | Loan | CREATE | null | loan fields |
| loan-actions.ts | processPayment | Payment | CREATE | null | payment fields |
| loan-actions.ts | processPayment | Loan | UPDATE | loan (already fetched) | balance + status |
| loan-actions.ts | deleteLoan | Loan | DELETE | findFirst snapshot | null |
| setting-actions.ts | updateSettings | Setting | UPDATE | null | parsedInput (key/value map) |
| setting-actions.ts | updateSetting | Setting | UPDATE | findFirst snapshot | {key, value} |

## logAudit Call Counts per File

| File | Calls (excl. import) |
|------|----------------------|
| customer-actions.ts | 3 |
| collateral-actions.ts | 6 |
| loan-actions.ts | 4 |
| setting-actions.ts | 2 |
| **Total** | **15** |

## processPayment 2-Log Pattern

processPayment records two audit log entries per payment:

1. **Payment CREATE** — logged after `ctx.db.payment.create(...)`. The return value is now captured as `createdPayment` to obtain the payment id. Fields logged: loanId, paymentDate, principalAmount, interestAmount, overdueAmount, totalAmount.

2. **Loan UPDATE** — logged after `ctx.db.loan.update(...)`. The `loan` object fetched earlier (for balance calculation) is used as the `before` snapshot. The `after` contains the new balance and status.

## Functions Where before Snapshot Was Added

All UPDATE and DELETE mutations required a `findFirst` call before the write to capture the before state:

- updateCustomer — `ctx.db.customer.findFirst`
- deleteCustomer — `ctx.db.customer.findFirst`
- updateCollateral — `ctx.db.collateral.findFirst`
- deleteCollateral — `ctx.db.collateral.findFirst`
- updateMortgage — `ctx.db.mortgage.findFirst`
- deleteMortgage — `ctx.db.mortgage.findFirst`
- deleteLoan — `ctx.db.loan.findFirst`
- updateSetting — already had `existing` from upsert logic, reused for before

processPayment already fetched `loan` via `findFirst` for balance calculation — this was reused as the before snapshot for the Loan UPDATE entry.

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

- FOUND: src/actions/customer-actions.ts (3 logAudit calls)
- FOUND: src/actions/collateral-actions.ts (6 logAudit calls)
- FOUND: src/actions/loan-actions.ts (4 logAudit calls)
- FOUND: src/actions/setting-actions.ts (2 logAudit calls)
- FOUND: .planning/phases/02-audit-logging/02-03-SUMMARY.md
- FOUND: commit 8c129bf (feat(02-03): add logAudit() to all mutation actions)
- TypeScript: 0 errors (npx tsc --noEmit clean)
