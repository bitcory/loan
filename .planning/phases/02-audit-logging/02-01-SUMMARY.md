---
phase: 02-audit-logging
plan: 01
subsystem: database
tags: [prisma, postgresql, audit, migration, append-only]
dependency_graph:
  requires: []
  provides: [audit_logs table, AuditLog prisma model]
  affects: [all future audit log writes]
tech_stack:
  added: []
  patterns: [PostgreSQL RULE for append-only enforcement, denormalized organizationId (no FK)]
key_files:
  created:
    - prisma/migrations/20260326093949_add_audit_log/migration.sql
  modified:
    - prisma/schema.prisma
decisions:
  - AuditLog has no FK relations to Organization or User (intentional: prevents cascade delete destroying logs)
  - No updatedAt field (append-only records are never updated)
  - organizationId is plain String, not a relation (basePrisma direct writes, no tenant extension filtering)
  - Migration created manually (not via migrate dev --create-only) due to shadow DB failure on existing migration history
metrics:
  duration: "~5 minutes"
  completed: "2026-03-26"
  tasks: 2
  files: 2
---

# Phase 02 Plan 01: AuditLog Schema and Append-Only Migration Summary

AuditLog model added to Prisma schema with PostgreSQL RULE-based append-only enforcement (no UPDATE/DELETE possible at DB level).

## What Was Done

### Task 1: AuditLog model added to schema.prisma

Added `model AuditLog` after the `Setting` model with the following fields:

| Field | Type | Notes |
|-------|------|-------|
| id | String @id @default(cuid()) | Primary key |
| organizationId | String | Plain String, no FK relation |
| userId | String | Plain String, no FK relation |
| entityType | String | "Customer" / "Loan" / "Collateral" / "Mortgage" / "Payment" / "Setting" |
| entityId | String | ID of the affected entity |
| action | String | "CREATE" / "UPDATE" / "DELETE" |
| before | Json? | Null for CREATE |
| after | Json? | Null for DELETE |
| ipAddress | String? | Optional |
| userAgent | String? | Optional |
| createdAt | DateTime @default(now()) | No updatedAt |

Indexes: `(organizationId, createdAt)`, `(organizationId, entityType, entityId)`, `(organizationId, userId)`

Table name: `audit_logs` via `@@map("audit_logs")`

### Task 2: Migration applied with append-only PostgreSQL RULEs

**Migration file:** `prisma/migrations/20260326093949_add_audit_log/migration.sql`

Note: `prisma migrate dev --create-only` failed due to shadow database incompatibility with prior migration history (constraint `collaterals_organizationId_fkey` ordering issue). The migration SQL was crafted manually and applied via `prisma migrate deploy`, which bypasses the shadow database.

**Append-only RULEs confirmed in database:**

```
 schemaname | tablename  |       rulename
------------+------------+----------------------
 public     | audit_logs | no_delete_audit_logs
 public     | audit_logs | no_update_audit_logs
```

Both rules use `DO INSTEAD NOTHING` — UPDATE/DELETE statements execute without error but affect 0 rows.

## Verification Results

| Check | Result |
|-------|--------|
| `npx prisma validate` | Valid |
| `npx prisma migrate status` | "Database schema is up to date!" |
| `npx prisma generate` | Success (v7.5.0) |
| `npx tsc --noEmit` | 0 errors |
| `pg_rules` for `audit_logs` | Both `no_update_audit_logs` and `no_delete_audit_logs` present |
| `prisma.auditLog` available | Yes (TypeScript: no errors) |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Shadow database migration failure**
- **Found during:** Task 1 (migrate dev --create-only)
- **Issue:** Prisma shadow database could not replay existing migration `20260325224945_set_organizationid_not_null` cleanly — it tries to DROP CONSTRAINT `collaterals_organizationId_fkey` before migration `20260326000000_add_organization_nullable` adds it, but shadow DB applies migrations in timestamp order causing the drop to fail
- **Fix:** Manually wrote `migration.sql` with correct DDL and ran `prisma migrate deploy` (which applies to the real DB directly without shadow DB replay)
- **Files modified:** `prisma/migrations/20260326093949_add_audit_log/migration.sql` (created manually)
- **Commit:** 7aeb28b

## Known Stubs

None. This plan produces infrastructure only (table + Prisma model). No application-level stubs.

## Self-Check: PASSED

- prisma/schema.prisma: FOUND
- prisma/migrations/20260326093949_add_audit_log/migration.sql: FOUND
- .planning/phases/02-audit-logging/02-01-SUMMARY.md: FOUND
- Commit 7aeb28b: FOUND
