---
phase: 02-audit-logging
plan: 02
subsystem: audit
tags: [audit, pii-masking, fire-and-forget, prisma, server-action]
dependency_graph:
  requires: [audit_logs table, AuditLog prisma model]
  provides: [logAudit, maskPii, sanitizeForLog, getClientIp, AuditAction, AuditContext]
  affects: [all future mutation server actions that call logAudit]
tech_stack:
  added: []
  patterns: [fire-and-forget audit write, PII field masking, Prisma Decimal serialization]
key_files:
  created:
    - src/lib/audit.ts
  modified: []
decisions:
  - "maskPii result cast to `any` for Prisma InputJsonValue — Record<string, unknown> does not satisfy Prisma's readonly array union type"
  - "logAudit uses basePrisma (prisma import) not getTenantClient — AuditLog is excluded from tenant extension"
  - "getClientIp returns string|undefined (not string) — callers may omit ipAddress; DB column is nullable"
metrics:
  duration: "~3 minutes"
  completed: "2026-03-26"
  tasks: 1
  files: 1
---

# Phase 02 Plan 02: audit.ts Utility Module Summary

PII-masking audit helper with fire-and-forget logAudit(), sanitizeForLog(), and getClientIp() — ready for Plan 03 to wire into 15 mutation actions.

## What Was Done

### Task 1: src/lib/audit.ts created

**Exported symbols:**

| Export | Kind | Description |
|--------|------|-------------|
| `AuditAction` | type | `"CREATE" \| "UPDATE" \| "DELETE"` |
| `AuditContext` | interface | `{ userId, organizationId, ipAddress? }` |
| `maskPii` | function | Recursively masks PII fields to `"***MASKED***"` |
| `sanitizeForLog` | function | Strips excluded fields, converts Decimal/Date, applies maskPii |
| `getClientIp` | function | Extracts client IP from request headers with try/catch guard |
| `logAudit` | function | Writes to audit_logs via basePrisma; never throws |

**PII_FIELDS Set contents:**
- `residentNumber`
- `businessNumber`

**logAudit error handling strategy (fire-and-forget):**
- Entire `prisma.auditLog.create()` call is wrapped in try/catch
- On error: `console.error("[audit] 감사 로그 기록 실패:", err)` — never re-throws
- Audit log failure does not interrupt the caller's business logic flow

**prisma import path:** `@/lib/prisma` — imports `basePrisma as prisma` (not `getTenantClient`). AuditLog is not covered by the tenant client extension and must use the base client directly.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Prisma InputJsonValue type incompatibility**
- **Found during:** Task 1 (npx tsc --noEmit)
- **Issue:** `maskPii()` returns `Record<string, unknown>` which TypeScript cannot assign to Prisma's `NullableJsonNullValueInput | InputJsonValue` (the latter includes a readonly array variant that Record does not satisfy)
- **Fix:** Cast `maskPii(before)` and `maskPii(after)` to `any` at the `prisma.auditLog.create` call site. Runtime behavior is correct — this is a structural type narrowing issue only.
- **Files modified:** `src/lib/audit.ts` (lines 95-96)
- **Commit:** d10f4f8

## Known Stubs

None. All functions are fully implemented. No placeholder data flows to UI.

## Self-Check: PASSED

- src/lib/audit.ts: FOUND
- npx tsc --noEmit: 0 errors
- Commit d10f4f8: FOUND
- Exports verified: logAudit, maskPii, sanitizeForLog, getClientIp, AuditAction, AuditContext
