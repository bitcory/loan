---
phase: "01"
plan: "03"
subsystem: "auth-foundation"
tags: ["next-auth", "jwt", "safe-action", "tenant-client", "middleware", "prisma-extension"]
dependency_graph:
  requires: ["01-01", "01-02"]
  provides: ["getTenantClient Prisma extension", "NextAuth JWT auth", "authenticatedAction", "adminAction", "next-auth middleware", "NEXTAUTH_SECRET env var"]
  affects: ["src/lib/prisma.ts", "src/lib/auth.ts", "src/lib/safe-action.ts", "src/middleware.ts", "src/app/api/auth/[...nextauth]/route.ts"]
tech_stack:
  added: ["next-auth@4.24.13", "next-safe-action@8.1.8"]
  patterns: ["Prisma Client Extension for tenant isolation", "JWT session strategy", "safe-action middleware chain for auth context injection"]
key_files:
  created:
    - src/lib/auth.ts
    - src/lib/safe-action.ts
    - src/app/api/auth/[...nextauth]/route.ts
    - src/middleware.ts
    - .env.example
  modified:
    - src/lib/prisma.ts
    - package.json
    - package-lock.json
decisions:
  - "Used JWT strategy (no database sessions) — no @auth/prisma-adapter installed or needed"
  - "getTenantClient uses Prisma $extends query intercept to auto-inject organizationId on all reads/writes for 7 tenant-scoped models; User model intentionally excluded (auth-time queries need no tenant filter)"
  - "next-safe-action v8 API confirmed — createSafeActionClient with .use() middleware chain"
  - "Cast user.role as 'ADMIN' | 'STAFF' in authorize() to satisfy NextAuth User type compatibility"
metrics:
  duration: "3 minutes"
  completed: "2026-03-26"
  tasks_completed: 2
  files_changed: 8
---

# Phase 1 Plan 3: NextAuth + Tenant Client + Safe-Action Middleware Summary

Wired JWT-based NextAuth authentication with Prisma Client Extension for tenant isolation, safe-action middleware for session-scoped DB access, and Next.js route middleware for auth-guarded navigation.

## What Was Done

### Task 1: Install Packages + Environment Variables + Prisma Client Extension

**Packages installed:**
- `next-auth@4.24.13` — JWT session auth (no @auth/prisma-adapter, JWT strategy only)
- `next-safe-action@8.1.8` — type-safe server actions with middleware
- `bcryptjs` + `@types/bcryptjs` — already installed from Wave 2, skipped

**Environment variables added to `.env`:**
- `NEXTAUTH_SECRET` = generated with `openssl rand -base64 32`
- `NEXTAUTH_URL` = http://localhost:3000

**`.env.example` created** with placeholder values for both new vars.

**`src/lib/prisma.ts` replaced** with:
- `createPrismaClient()` still uses `PrismaPg` adapter (preserved from existing pattern)
- `basePrisma` singleton (globalForPrisma pattern preserved)
- `getTenantClient(organizationId)` — Prisma `$extends` factory that auto-injects `organizationId` into `where` (reads) and `data` (writes) for 7 models: customer, collateral, mortgage, loan, loanSchedule, payment, setting
- `User` model intentionally excluded from tenant intercept — auth queries use basePrisma with no organization context
- `export { basePrisma as prisma }` — named export for auth-time queries

### Task 2: NextAuth authOptions + Safe-Action Middleware + API Route + Middleware

**`src/lib/auth.ts` created:**
- `NextAuthOptions` with JWT strategy, custom `/login` sign-in page
- `CredentialsProvider` with username/password fields
- `authorize()` uses `basePrisma` (no tenant filter) to find active user, validates bcrypt password
- `jwt` callback: stores `userId`, `organizationId`, `role` in token
- `session` callback: exposes all three fields on `session.user`

**`src/lib/safe-action.ts` created:**
- `actionClient` — unauthenticated client (for login action)
- `authenticatedAction` — middleware: validates session, injects `{ userId, organizationId, role, db }` context where `db = getTenantClient(organizationId)`
- `adminAction` — same as authenticated but also checks `role === "ADMIN"`, throws "관리자 권한이 필요합니다." otherwise

**`src/app/api/auth/[...nextauth]/route.ts` created:**
- Standard NextAuth App Router handler exporting GET and POST

**`src/middleware.ts` created:**
- Re-exports `next-auth/middleware` default
- Matcher protects all routes except `api/auth`, `login`, static assets, and favicon

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] TypeScript error: `user.role: string` not assignable to `"ADMIN" | "STAFF"` in authorize()**
- **Found during:** Task 2 verification (npx tsc --noEmit)
- **Issue:** The plan's `authorize()` return cast `as { id: string; name: string; organizationId: string; role: string }` — but the project's `next-auth.d.ts` extends `User` with `role: "ADMIN" | "STAFF"`. TypeScript rejected the weaker `string` type.
- **Fix:** Changed to `role: user.role as "ADMIN" | "STAFF"` and updated jwt callback cast accordingly.
- **Files modified:** src/lib/auth.ts
- **Commit:** ebd2002

## Verification Results

```
getTenantClient exported from prisma.ts          PASS
basePrisma exported as prisma                    PASS
authOptions exported from auth.ts                PASS
strategy: "jwt" in auth.ts                       PASS
authenticatedAction exported from safe-action.ts PASS
adminAction exported from safe-action.ts         PASS
"관리자 권한이 필요합니다" in safe-action.ts          PASS
src/app/api/auth/[...nextauth]/route.ts exists   PASS
next-auth/middleware in middleware.ts             PASS
NEXTAUTH_SECRET in .env                          PASS
@auth/prisma-adapter NOT in package.json         PASS
npx tsc --noEmit                                 PASS (no errors)
```

## Commits

| Hash | Description |
|------|-------------|
| f5c7004 | feat(01-03): install next-auth+next-safe-action, add NEXTAUTH env vars, add getTenantClient extension |
| ebd2002 | feat(01-03): add NextAuth authOptions, safe-action middleware, API route, and middleware |

## Known Stubs

None — this plan is infrastructure/auth only. Action files still carry `DEFAULT_ORG_ID = "default-org-001"` TODO(01-03) bridge constants from plan 01-02; these are tracked for replacement in subsequent plans when actions are migrated to use `authenticatedAction` from safe-action.ts.

## Self-Check: PASSED

- src/lib/prisma.ts: EXISTS
- src/lib/auth.ts: EXISTS
- src/lib/safe-action.ts: EXISTS
- src/app/api/auth/[...nextauth]/route.ts: EXISTS
- src/middleware.ts: EXISTS
- .env.example: EXISTS
- Commit f5c7004: EXISTS
- Commit ebd2002: EXISTS
