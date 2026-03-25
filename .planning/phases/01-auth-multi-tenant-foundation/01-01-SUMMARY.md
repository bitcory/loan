---
phase: "01"
plan: "01"
subsystem: "database-schema"
tags: ["prisma", "multi-tenant", "organization", "nextauth", "migration"]
dependency_graph:
  requires: []
  provides: ["Organization model", "User model", "organizationId FK on all 7 tables", "NextAuth session types"]
  affects: ["prisma/schema.prisma", "src/types/next-auth.d.ts", "src/actions/setting-actions.ts", "prisma/seed.ts"]
tech_stack:
  added: []
  patterns: ["composite unique constraints for tenant-scoped uniqueness", "nullable FK for 3-step migration pattern"]
key_files:
  created:
    - prisma/migrations/20260326000000_add_organization_nullable/migration.sql
    - src/types/next-auth.d.ts
  modified:
    - prisma/schema.prisma
    - prisma/migrations/20260318070000_add_customer_number/migration.sql
    - src/actions/setting-actions.ts
    - prisma/seed.ts
decisions:
  - "Used nullable organizationId (String?) as step 1 of 3-step migration — backfill and NOT NULL enforcement are later plans"
  - "Renamed migration 20260318_add_customer_number to 20260318070000_add_customer_number to fix invalid timestamp format"
  - "Manually created migration SQL and used migrate deploy instead of migrate dev (non-interactive environment)"
  - "Fixed broken ROW_NUMBER SQL syntax in legacy migration to allow shadow database replay"
metrics:
  duration: "7 minutes"
  completed: "2026-03-26"
  tasks_completed: 2
  files_changed: 6
---

# Phase 1 Plan 1: Prisma Schema Organization/User Models + Nullable organizationId FK Summary

Added Organization and User models to the Prisma schema plus nullable organizationId FK on all 7 existing tables as step 1 of the 3-step multi-tenant migration, plus NextAuth session type extensions for userId/organizationId/role.

## What Was Done

### Task 1: Prisma Schema Changes + Migration

Added two new models before existing models in `prisma/schema.prisma`:

- **Organization**: id, name, slug (unique), createdAt, updatedAt — with relations to all 7 existing models
- **User**: id, organizationId (NOT NULL), username (unique), passwordHash, name, role, isActive, createdAt, updatedAt

Modified 7 existing models to add nullable `organizationId String?`:
- **Customer**: removed global `@unique` on customerNumber, added `@@unique([organizationId, customerNumber])`
- **Collateral**: added organizationId String?
- **Mortgage**: added organizationId String?
- **Loan**: removed global `@unique` on loanNumber, added `@@unique([organizationId, loanNumber])`
- **LoanSchedule**: added organizationId String?
- **Payment**: added organizationId String?
- **Setting**: removed global `@unique` on key, added `@@unique([organizationId, key])`

Migration created at: `prisma/migrations/20260326000000_add_organization_nullable/migration.sql`

**Migration approach:** `prisma migrate dev` requires interactive mode in this environment. The migration SQL was manually authored and applied via `prisma migrate deploy`.

**Pre-existing migration fixes:**
- `20260318_add_customer_number` had an invalid directory name (missing time portion) and SQL syntax error (`ROW_NUMBER` used without subquery alias). Renamed to `20260318070000_add_customer_number` and fixed the SQL.

### Task 2: NextAuth Session Type Extension

Created `src/types/next-auth.d.ts` extending:
- `Session.user` with `userId: string`, `organizationId: string`, `role: "ADMIN" | "STAFF"`, `name?: string | null`
- `User` interface with `organizationId: string`, `role: "ADMIN" | "STAFF"`
- `JWT` interface with `userId: string`, `organizationId: string`, `role: "ADMIN" | "STAFF"`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] PostgreSQL not running — started Docker container**
- **Found during:** Task 1 (migrate dev)
- **Issue:** `localhost:5432` unreachable — no PostgreSQL service installed or running
- **Fix:** Started `postgres:16-alpine` Docker container with matching credentials (postgres/postgres, loan_db)
- **Files modified:** None (infrastructure only)

**2. [Rule 1 - Bug] Pre-existing migration `20260318_add_customer_number` had invalid name and SQL syntax error**
- **Found during:** Task 1 (migrate dev shadow database validation)
- **Issue:** Directory name missing time digits, SQL used bare `ROW_NUMBER` instead of `ROW_NUMBER() OVER (...) AS row_num`
- **Fix:** Renamed directory to `20260318070000_add_customer_number`, fixed SQL subquery alias
- **Files modified:** prisma/migrations/20260318070000_add_customer_number/migration.sql
- **Commit:** 6d99848

**3. [Rule 1 - Bug] setting-actions.ts and seed.ts broken by removal of `key @unique` on Setting**
- **Found during:** Verification (tsc --noEmit)
- **Issue:** `findUnique({ where: { key } })` and `upsert({ where: { key } })` now invalid since `key` is only part of a composite unique `[organizationId, key]`
- **Fix:**
  - `setting-actions.ts`: replaced `findUnique` with `findFirst`, replaced `upsert` with `findFirst` + conditional `update`/`create`
  - `seed.ts`: replaced `upsert({ where: { key } })` with `findFirst({ where: { key, organizationId: null } })` + conditional create/update
- **Files modified:** src/actions/setting-actions.ts, prisma/seed.ts
- **Commit:** de419e5

## Verification Results

```
grep "model Organization" prisma/schema.prisma  → PASS
grep "model User" prisma/schema.prisma          → PASS
organizationId String? count                    → 7 (PASS)
customerNumber String @unique (global)          → NO MATCH (PASS)
@@unique([organizationId, customerNumber])      → PASS
@@unique([organizationId, key])                 → PASS
Migration directory                             → 20260326000000_add_organization_nullable (PASS)
npx tsc --noEmit                                → No errors (PASS)
userId: string in next-auth.d.ts               → PASS
```

## Commits

| Hash | Description |
|------|-------------|
| 6d99848 | feat(01-01): add Organization/User models + nullable organizationId FK |
| c5e563f | feat(01-01): extend NextAuth session types for multi-tenant auth |
| de419e5 | fix(01-01): update setting queries broken by composite unique constraint |

## Known Stubs

None — this plan is purely schema/type definitions. No UI or data rendering involved.

## Self-Check: PASSED

- prisma/schema.prisma: EXISTS
- prisma/migrations/20260326000000_add_organization_nullable/migration.sql: EXISTS
- src/types/next-auth.d.ts: EXISTS
- Commit 6d99848: EXISTS
- Commit c5e563f: EXISTS
- Commit de419e5: EXISTS
