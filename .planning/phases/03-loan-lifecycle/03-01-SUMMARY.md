---
phase: 03-loan-lifecycle
plan: "01"
subsystem: database-schema
tags: [prisma, migration, loan, prepayment]
dependency_graph:
  requires: []
  provides: [Loan.prepaymentFeeRate field, loans.prepaymentFeeRate column]
  affects: [Wave 2 loan-calculator.ts, Wave 3 server actions]
tech_stack:
  added: []
  patterns: [Prisma nullable Decimal field, manual migrate deploy pattern]
key_files:
  created:
    - prisma/migrations/20260326012206_add_loan_prepayment_fee_rate/migration.sql
  modified:
    - prisma/schema.prisma
decisions:
  - "Manual migration SQL (migrate deploy) used due to shadow DB constraint error on P3006 — pre-existing migration history incompatibility"
  - "prepaymentFeeRate placed before memo field per plan spec, uses Decimal(5,2) matching interestRate precision"
metrics:
  duration: "5 min"
  completed: "2026-03-26"
  tasks_completed: 2
  files_changed: 2
---

# Phase 3 Plan 01: Add prepaymentFeeRate to Loan Model Summary

**One-liner:** Added `prepaymentFeeRate Decimal? @db.Decimal(5,2)` to Loan model and applied migration `20260326012206_add_loan_prepayment_fee_rate`.

## What Was Done

### Task 1: Schema field addition
Added `prepaymentFeeRate Decimal? @db.Decimal(5,2)` to the `Loan` model in `prisma/schema.prisma`, positioned after `overdueDays` and before `memo`. Validated with `npx prisma validate`.

### Task 2: Migration applied + Prisma Client regenerated
`npx prisma migrate dev --create-only` failed with P3006 (shadow DB constraint error on pre-existing migration history). Used the fallback approach:
- Manually authored `migration.sql` with `ALTER TABLE "loans" ADD COLUMN "prepaymentFeeRate" DECIMAL(5,2);`
- Applied with `npx prisma migrate deploy`
- Regenerated client with `npx prisma generate`

## Applied Migration File

`prisma/migrations/20260326012206_add_loan_prepayment_fee_rate/migration.sql`

```sql
ALTER TABLE "loans" ADD COLUMN "prepaymentFeeRate" DECIMAL(5,2);
```

## Added Fields

| Model | Field | Type | Notes |
|-------|-------|------|-------|
| Loan | prepaymentFeeRate | Decimal? @db.Decimal(5,2) | NULL for existing records; per-loan override of org-level rate |

## Setting Pattern (no schema change)

Org-level default prepayment fee rate is stored in the `Setting` table (unchanged):
- `key`: `"prepayment_fee_rate"`
- `value`: `"0"` (default, string-encoded percentage)
- `label`: `"중도상환수수료율 (%)"`

Wave 2 `loan-calculator.ts` will read `loan.prepaymentFeeRate ?? setting.prepayment_fee_rate` to resolve per-loan or org-level rate.

## Verification

- `npx prisma validate` — passed
- `npx prisma migrate status` — "All migrations have been applied"
- `npx prisma generate` — completed without errors
- `npx tsc --noEmit` — no errors

## Deviations from Plan

**1. [Rule 3 - Blocking Issue] Used manual migration instead of `migrate dev --create-only`**
- **Found during:** Task 1
- **Issue:** `npx prisma migrate dev --create-only` failed with P3006 — shadow database could not cleanly replay migration `20260325224945_set_organizationid_not_null` due to missing constraint `collaterals_organizationId_fkey`.
- **Fix:** Manually created migration directory and SQL file, then applied with `npx prisma migrate deploy`.
- **Files modified:** `prisma/migrations/20260326012206_add_loan_prepayment_fee_rate/migration.sql`
- **Commit:** 5408d3e

## Self-Check: PASSED

- `/Users/toolb/develop/tool/loan/prisma/schema.prisma` — FOUND, contains `prepaymentFeeRate`
- `/Users/toolb/develop/tool/loan/prisma/migrations/20260326012206_add_loan_prepayment_fee_rate/migration.sql` — FOUND
- Commit `5408d3e` — FOUND
