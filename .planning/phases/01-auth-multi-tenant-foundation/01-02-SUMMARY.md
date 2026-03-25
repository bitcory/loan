---
phase: "01"
plan: "02"
subsystem: "database-seed-migration"
tags: ["prisma", "migration", "seed", "backfill", "multi-tenant", "not-null"]
dependency_graph:
  requires: ["01-01"]
  provides: ["default-org-001 organization", "admin user account", "NOT NULL organizationId on all 7 models", "default Setting rows"]
  affects: ["prisma/schema.prisma", "prisma/seed.ts", "prisma/scripts/backfill-org.ts", "src/actions/setting-actions.ts", "src/actions/customer-actions.ts", "src/actions/collateral-actions.ts", "src/actions/loan-actions.ts"]
tech_stack:
  added: ["bcryptjs", "@types/bcryptjs"]
  patterns: ["upsert-based idempotent seed", "DEFAULT_ORG_ID bridge constant in actions (temporary until 01-03)"]
key_files:
  created:
    - prisma/scripts/backfill-org.ts
    - prisma/migrations/20260325224945_set_organizationid_not_null/migration.sql
  modified:
    - prisma/seed.ts
    - prisma/schema.prisma
    - src/actions/setting-actions.ts
    - src/actions/customer-actions.ts
    - src/actions/collateral-actions.ts
    - src/actions/loan-actions.ts
    - package.json
    - package-lock.json
decisions:
  - "Used PrismaPg adapter in seed.ts to match project's standard DB connection pattern (plan specified plain PrismaClient but this project requires the adapter)"
  - "Moved backfill script to prisma/scripts/ instead of prisma/migrations/backfill-org/ because Prisma migrate dev treats any subdirectory of migrations/ as a migration and requires a migration.sql file"
  - "Added DEFAULT_ORG_ID='default-org-001' bridge constant to all action files' create operations to keep TypeScript passing until session auth is wired in plan 01-03"
metrics:
  duration: "8 minutes"
  completed: "2026-03-26"
  tasks_completed: 2
  files_changed: 8
---

# Phase 1 Plan 2: Seed Default Organization + Backfill + NOT NULL Migration Summary

Seeded default-org-001 organization, admin user account, and 4 default Setting rows; backfilled all existing data to default organization; enforced NOT NULL on organizationId across all 7 tenant-scoped models via Prisma migration.

## What Was Done

### Task 1: Seed Default Organization, ADMIN Account, and Default Settings

Replaced `prisma/seed.ts` with a new idempotent seed that:
- Upserts organization `default-org-001` (name="기본 조직", slug="default")
- Upserts user `admin` (role=ADMIN, password=Admin1234 hashed with bcrypt rounds=12)
- Upserts 4 default Setting rows scoped to default-org-001: maxLtvRate=70, defaultInterestRate=5.5, legalMaxRate=20, overdueRate=15

**Dependency added:** `bcryptjs` + `@types/bcryptjs`

**Seed output:**
```
조직 생성/확인: 기본 조직 (default-org-001)
관리자 계정 생성/확인: admin (role: ADMIN)
설정 생성/확인: maxLtvRate = 70
설정 생성/확인: defaultInterestRate = 5.5
설정 생성/확인: legalMaxRate = 20
설정 생성/확인: overdueRate = 15
```

### Task 2: Backfill Existing Data + Migration 2 (NOT NULL)

**Step A - Backfill script** created at `prisma/scripts/backfill-org.ts`:
- Updates organizationId=null -> "default-org-001" for all 7 models
- Validates no null rows remain after update

**Step B - Backfill run:** All 7 models reported 0 rows updated (DB was fresh from new seed, no legacy null data existed).

**Step C - Schema update:** Changed `organizationId String?` to `organizationId String` and `Organization? @relation(...)` to `Organization @relation(...)` for all 7 existing models: Customer, Collateral, Mortgage, Loan, LoanSchedule, Payment, Setting.

**Step D - Migration created and applied:**
- Migration name: `20260325224945_set_organizationid_not_null`
- Applied via `npx prisma migrate dev --name set-organizationid-not-null`
- `npx prisma generate` ran successfully

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Plan specified plain PrismaClient in seed.ts but project uses PrismaPg adapter**
- **Found during:** Task 1 (seed run analysis)
- **Issue:** The project's `src/lib/prisma.ts` always wraps PrismaClient with PrismaPg adapter. The plan's seed template used `new PrismaClient()` without the adapter, which would not connect correctly in this environment.
- **Fix:** Used `new PrismaClient({ adapter })` with `PrismaPg` in seed.ts, consistent with the rest of the project.
- **Files modified:** prisma/seed.ts
- **Commit:** 2b692a5

**2. [Rule 3 - Blocking] Backfill script in prisma/migrations/ blocked prisma migrate dev**
- **Found during:** Task 2 Step D (prisma migrate dev)
- **Issue:** Placing the backfill script at `prisma/migrations/backfill-org/run.ts` caused Prisma to treat the directory as a migration and fail with P3015 (missing migration.sql).
- **Fix:** Moved backfill script to `prisma/scripts/backfill-org.ts` (outside migrations directory).
- **Files modified:** prisma/scripts/backfill-org.ts (created), old path removed
- **Commit:** ae3e298

**3. [Rule 2 - Missing critical functionality] Action files missing organizationId in create operations caused TypeScript errors**
- **Found during:** Task 2 verification (npx tsc --noEmit)
- **Issue:** Making organizationId NOT NULL caused TypeScript type errors in 4 action files (customer, collateral, loan, setting) because their `create` calls didn't pass `organizationId`.
- **Fix:** Added `const DEFAULT_ORG_ID = "default-org-001"` to each action file and injected it into all `create` operations. Marked with `// TODO(01-03)` comment for replacement with session-derived value in plan 01-03.
- **Files modified:** src/actions/setting-actions.ts, src/actions/customer-actions.ts, src/actions/collateral-actions.ts, src/actions/loan-actions.ts
- **Commit:** ae3e298

## Verification Results

```
npx prisma db seed                              → PASS (조직 생성/확인: 기본 조직 shown)
organizationId NOT NULL count                   → 8 (User + 7 existing models) PASS
organizationId String? remaining                → NONE (PASS)
ls migrations/ | grep set-organizationid        → 20260325224945_set_organizationid_not_null (PASS)
npx tsc --noEmit                                → No errors (PASS)
Backfill 완료 message                            → PASS
```

## Commits

| Hash | Description |
|------|-------------|
| 2b692a5 | feat(01-02): seed default organization, ADMIN account, and Setting rows |
| ae3e298 | feat(01-02): backfill organizationId + enforce NOT NULL on all 7 models |

## Known Stubs

None — this plan is schema/data migration only. Action files temporarily use `DEFAULT_ORG_ID = "default-org-001"` bridge constant (marked with TODO(01-03)) until session-based auth is wired in plan 01-03. The bridge constant is intentional and tracked for replacement.

## Self-Check: PASSED

- prisma/seed.ts: EXISTS
- prisma/scripts/backfill-org.ts: EXISTS
- prisma/migrations/20260325224945_set_organizationid_not_null/migration.sql: EXISTS
- Commit 2b692a5: EXISTS
- Commit ae3e298: EXISTS
