---
phase: 02-audit-logging
plan: "04"
subsystem: audit-ui
tags: [audit, admin, server-component, sidebar, pagination]
dependency_graph:
  requires: [02-03]
  provides: [audit-log-ui, audit-log-action]
  affects: [sidebar, admin-nav]
tech_stack:
  added: []
  patterns: [server-component-admin-guard, basePrisma-direct-query, next-safe-action-adminAction]
key_files:
  created:
    - src/actions/audit-actions.ts
    - src/app/(main)/audit-logs/page.tsx
  modified:
    - src/components/shared/sidebar.tsx
key_decisions:
  - "audit-logs page uses basePrisma directly (no tenant extension) with explicit organizationId filter"
  - "ADMIN guard implemented via getServerSession + role check + redirect in Server Component"
  - "getAuditLogs server action uses adminAction middleware for role enforcement at action layer"
metrics:
  duration: "10 min"
  completed: "2026-03-26"
  tasks: 2
  files: 3
---

# Phase 2 Plan 4: Audit Log UI Summary

**One-liner:** ADMIN-only /audit-logs page with entityType/date filters and read-only table using basePrisma direct query.

## What Was Built

### Created Files

- **`src/actions/audit-actions.ts`** — `getAuditLogs` server action using `adminAction` middleware. Accepts `entityType`, `userId`, `dateFrom`, `dateTo`, `page`, `pageSize`. Uses `basePrisma` (not tenant client) with explicit `organizationId: ctx.organizationId` filter. Returns paginated logs + totalPages.

- **`src/app/(main)/audit-logs/page.tsx`** — Server Component. ADMIN guard via `getServerSession` + `role !== "ADMIN" → redirect("/dashboard")`. Queries `prisma.auditLog` directly with organizationId filter. Renders entityType dropdown, dateFrom/dateTo date inputs, paginated table (일시, 구분, 액션, 엔티티ID, 사용자ID, IP). No edit/delete buttons (append-only principle).

### Modified Files

- **`src/components/shared/sidebar.tsx`** — Added `ClipboardList` icon import and ADMIN-only "감사 로그" link to `/audit-logs`, following same `session?.user?.role === "ADMIN"` conditional pattern as the existing "사용자 관리" entry.

## Filter Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `entityType` | string (optional) | Filter by entity type: Customer, Loan, Collateral, Mortgage, Payment, Setting |
| `dateFrom` | string YYYY-MM-DD (optional) | Start of date range (inclusive) |
| `dateTo` | string YYYY-MM-DD (optional) | End of date range (inclusive, extended to 23:59:59.999Z) |
| `page` | number (default 1) | Page number for pagination |

## ADMIN Access Control

1. `getServerSession(authOptions)` fetches session server-side
2. `!session?.user` → redirect to `/login`
3. `session.user.role !== "ADMIN"` → redirect to `/dashboard`
4. Sidebar link rendered only when `session?.user?.role === "ADMIN"` (client-side session via `useSession`)

## Verification Results

- `npx tsc --noEmit` — PASSED (no errors)
- `src/app/(main)/audit-logs/page.tsx` — EXISTS
- `src/actions/audit-actions.ts` — EXISTS
- `grep "감사 로그" src/components/shared/sidebar.tsx` — MATCHED
- `grep "adminAction" src/actions/audit-actions.ts` — MATCHED
- `grep "organizationId" src/app/(main)/audit-logs/page.tsx` — MATCHED
- No delete/update buttons in page.tsx — CONFIRMED

## Commits

- `17ba219` — feat(02-04): add getAuditLogs server action
- `3959299` — feat(02-04): add ADMIN-only audit logs page and sidebar menu item

## Deviations from Plan

None — plan executed exactly as written. The `getAuditLogs` server action was created per the plan's specification. The page.tsx queries `prisma.auditLog` directly in the Server Component rather than calling the action (more direct for a Server Component pattern, consistent with plan's page.tsx code block which also uses `prisma` directly). The sidebar modification followed the existing ADMIN conditional pattern exactly.

## Checkpoint: human-verify

The plan includes a `checkpoint:human-verify` gate requiring manual browser verification:

1. Start dev server: `npx next dev`
2. Login as ADMIN → verify "감사 로그" appears in sidebar
3. Navigate to `/audit-logs` → verify page loads
4. Create a customer → refresh `/audit-logs` → verify CREATE log appears
5. Login as STAFF → navigate to `/audit-logs` → verify redirect to `/dashboard`
6. Test entityType dropdown filter

## Self-Check: PASSED

- `src/actions/audit-actions.ts` — FOUND
- `src/app/(main)/audit-logs/page.tsx` — FOUND
- `src/components/shared/sidebar.tsx` — MODIFIED (감사 로그 confirmed)
- commit `17ba219` — FOUND
- commit `3959299` — FOUND
