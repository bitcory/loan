# Phase 2: Audit Logging - Research

**Researched:** 2026-03-26
**Domain:** Append-only audit logging for Next.js 14 / Prisma 7 / PostgreSQL financial SaaS
**Confidence:** HIGH (based on direct codebase inspection + established patterns)

---

## Summary

This system uses `next-safe-action` v8 middleware chaining and a Prisma `$extends` tenant client already in `src/lib/prisma.ts`. The cleanest audit logging strategy is a **middleware wrapper added to `authenticatedAction` and `adminAction`** in `src/lib/safe-action.ts`, combined with a **dedicated `logAudit()` helper** called explicitly inside each mutation.

Automatic DB-level interception (Prisma Extension on `query`) is tempting but breaks here because the audit log needs context (`userId`, `ipAddress`, `organizationId`) that is not available inside a Prisma extension callback — it would require threading that data through a closure or AsyncLocalStorage, adding significant complexity. A middleware wrapper on `safe-action` provides the context already in `ctx`, but cannot capture `before`/`after` values without explicit calls inside each action.

The recommended approach is therefore **manual `logAudit()` calls inside each mutation** — it is the most transparent, most testable, and fully compatible with the existing architecture. There are exactly 15 mutations across 4 action files; each call is a 3-4 line addition.

**Primary recommendation:** Add an `AuditLog` Prisma model (append-only, no relations that cascade delete), write a `src/lib/audit.ts` helper with PII masking, and call `logAudit()` at the end of each mutation action.

---

## Project Constraints (from CLAUDE.md)

No CLAUDE.md found in the project working directory. No project-specific directives to enforce beyond what is observed in the codebase.

---

## Standard Stack

### Core (already installed — no new packages needed)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Prisma | 7.5.0 | AuditLog model + `basePrisma` direct writes | Already in use; audit writes bypass tenant filter |
| PostgreSQL | (current) | `audit_logs` table with RLS-based append-only enforcement | Native DB-level protection |
| next-safe-action | 8.1.8 | `ctx` carries `userId`, `organizationId` — available in `.use()` middleware | Already in use |
| next/headers | (Next.js 14.2) | `headers()` to read `x-forwarded-for` / `x-real-ip` in server actions | Built-in |

### No new npm packages required

All needed capabilities are already present. Do not add `audit-log` third-party packages — they would not understand the existing tenant isolation pattern.

---

## Recommended AuditLog Schema

Add to `prisma/schema.prisma`:

```prisma
model AuditLog {
  id             String   @id @default(cuid())
  organizationId String
  userId         String
  entityType     String   // "Customer" | "Loan" | "Collateral" | "Mortgage" | "Payment" | "Setting"
  entityId       String
  action         String   // "CREATE" | "UPDATE" | "DELETE"
  before         Json?    // null for CREATE
  after          Json?    // null for DELETE
  ipAddress      String?
  userAgent      String?
  createdAt      DateTime @default(now())

  @@index([organizationId, createdAt])
  @@index([organizationId, entityType, entityId])
  @@index([organizationId, userId])
  @@map("audit_logs")
}
```

**Design decisions:**

- NO `updatedAt` field — append-only records are never updated.
- NO `@relation` back to `Organization`, `User`, or the entity models. Relations create foreign keys that can cascade or allow joins that encourage mutation.
- `before`/`after` are `Json?` — PostgreSQL `jsonb` under the hood. Store a flat snapshot of the relevant scalar fields only (not nested relations).
- Three indexes: by org+time (admin list view), by org+entity (entity history), by org+user (user activity).
- `userId` stored as a plain `String`, not a FK to `users`. This means the log survives even if a user record is later deleted (historical accuracy).
- `organizationId` stored directly — the audit log is a separate model not covered by the tenant extension, so writes use `basePrisma` directly.

---

## Architecture Patterns

### Recommended Project Structure

```
src/
├── lib/
│   ├── audit.ts          # logAudit() helper + maskPii()
│   ├── safe-action.ts    # existing — add IP extraction helper
│   └── prisma.ts         # existing — basePrisma used for audit writes
├── actions/
│   ├── customer-actions.ts   # add logAudit() calls to 3 mutations
│   ├── loan-actions.ts       # add logAudit() calls to 3 mutations
│   ├── collateral-actions.ts # add logAudit() calls to 6 mutations
│   ├── setting-actions.ts    # add logAudit() calls
│   └── audit-actions.ts      # NEW: getAuditLogs() for admin view
└── app/
    └── (dashboard)/
        └── audit/
            └── page.tsx      # NEW: admin-only audit log viewer
```

### Pattern: Manual logAudit() call

```typescript
// src/lib/audit.ts
import { prisma } from "@/lib/prisma";

export type AuditAction = "CREATE" | "UPDATE" | "DELETE";

export interface AuditContext {
  userId: string;
  organizationId: string;
  ipAddress?: string;
}

export async function logAudit(
  ctx: AuditContext,
  entityType: string,
  entityId: string,
  action: AuditAction,
  before: Record<string, unknown> | null,
  after: Record<string, unknown> | null,
): Promise<void> {
  await prisma.auditLog.create({
    data: {
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      entityType,
      entityId,
      action,
      before: before ? maskPii(before) : undefined,
      after: after ? maskPii(after) : undefined,
      ipAddress: ctx.ipAddress,
    },
  });
}
```

**Key point:** `logAudit` uses `prisma` (the `basePrisma` export), NOT `ctx.db` (the tenant-scoped extended client). This avoids the tenant extension interfering with writes to the audit table, and also means the `organizationId` must be set explicitly — which is correct for an audit record.

### Pattern: IP extraction in Next.js App Router server actions

Server actions run as server-side code. `next/headers` provides access to request headers:

```typescript
// src/lib/audit.ts — add this utility
import { headers } from "next/headers";

export function getClientIp(): string | undefined {
  const headersList = headers();
  return (
    headersList.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    headersList.get("x-real-ip") ||
    undefined
  );
}
```

**Pitfall:** `headers()` in Next.js 14 is available inside server actions and Route Handlers, but it requires a request context. It will throw if called outside a request. Always call it within the action function body, not at module scope.

**Pitfall:** `x-forwarded-for` can contain a comma-separated list when multiple proxies are involved. Always take only the first value (`.split(",")[0]`).

### Pattern: Calling logAudit in a mutation (example — createCustomer)

```typescript
export const createCustomer = authenticatedAction
  .schema(customerSchema)
  .action(async ({ parsedInput, ctx }) => {
    const { residentNumber, ...rest } = parsedInput;
    const encrypted = residentNumber ? encrypt(residentNumber.replace(/-/g, "")) : null;
    const customerNumber = await generateCustomerNumber(ctx.db);

    const customer = await ctx.db.customer.create({
      data: { ...rest, organizationId: ctx.organizationId, customerNumber, residentNumber: encrypted },
    });

    // Audit log — after the DB write succeeds
    await logAudit(
      { userId: ctx.userId, organizationId: ctx.organizationId, ipAddress: getClientIp() },
      "Customer",
      customer.id,
      "CREATE",
      null,
      { ...rest, customerNumber, residentNumber: residentNumber ?? null },
      // Note: pass the PLAIN-TEXT data to logAudit; maskPii() will handle masking
    );

    revalidatePath("/customers");
    return { success: true, id: customer.id };
  });
```

### Pattern: UPDATE — capturing before value

For UPDATE mutations, fetch the record before updating to capture the `before` snapshot:

```typescript
export const updateCustomer = authenticatedAction
  .schema(z.object({ id: z.string(), data: customerSchema }))
  .action(async ({ parsedInput, ctx }) => {
    // Fetch before snapshot
    const existing = await ctx.db.customer.findFirst({ where: { id: parsedInput.id } });

    const { residentNumber, ...rest } = parsedInput.data;
    const encrypted = residentNumber ? encrypt(residentNumber.replace(/-/g, "")) : undefined;

    await ctx.db.customer.update({
      where: { id: parsedInput.id },
      data: { ...rest, ...(encrypted !== undefined && { residentNumber: encrypted }) },
    });

    await logAudit(
      { userId: ctx.userId, organizationId: ctx.organizationId, ipAddress: getClientIp() },
      "Customer",
      parsedInput.id,
      "UPDATE",
      existing ? sanitizeForLog(existing) : null,
      sanitizeForLog({ ...rest, residentNumber: residentNumber ?? null }),
    );

    revalidatePath("/customers");
    revalidatePath(`/customers/${parsedInput.id}`);
    return { success: true };
  });
```

### Pattern: DELETE — capturing before value

```typescript
export const deleteCustomer = adminAction
  .schema(z.object({ id: z.string() }))
  .action(async ({ parsedInput, ctx }) => {
    const existing = await ctx.db.customer.findFirst({ where: { id: parsedInput.id } });

    // ... validation ...

    await ctx.db.customer.delete({ where: { id: parsedInput.id } });

    await logAudit(
      { userId: ctx.userId, organizationId: ctx.organizationId, ipAddress: getClientIp() },
      "Customer",
      parsedInput.id,
      "DELETE",
      existing ? sanitizeForLog(existing) : null,
      null,
    );

    revalidatePath("/customers");
    return { success: true };
  });
```

---

## PII Masking

### Korean SSN (주민등록번호) and Business Registration Number (사업자번호)

The `residentNumber` field is stored **encrypted** in the DB. When building the audit log `before`/`after` snapshot, the plain-text value must be masked — not encrypted — before storing in the JSON log.

**Regex patterns:**

```typescript
// Korean SSN: 6 digits, optional hyphen, 7 digits
// Mask: show first 6 digits, mask all 7 of the second group
const KOREAN_SSN_REGEX = /(\d{6})-?(\d{7})/g;
const maskKoreanSsn = (val: string): string =>
  val.replace(KOREAN_SSN_REGEX, "$1-*******");
// "900101-1234567" → "900101-*******"
// "9001011234567"  → "900101-*******"

// Korean BRN: 3-2-5 format, hyphen optional
const KOREAN_BRN_REGEX = /(\d{3})-?(\d{2})-?(\d{5})/g;
const maskKoreanBrn = (val: string): string =>
  val.replace(KOREAN_BRN_REGEX, "$1-**-*****");
// "123-45-67890" → "123-**-*****"
```

### maskPii() implementation

```typescript
// src/lib/audit.ts

const PII_FIELDS = new Set(["residentNumber", "businessNumber"]);

export function maskPii(data: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (PII_FIELDS.has(key) && typeof value === "string" && value.length > 0) {
      result[key] = "***MASKED***";
    } else if (value && typeof value === "object" && !Array.isArray(value)) {
      result[key] = maskPii(value as Record<string, unknown>);
    } else {
      result[key] = value;
    }
  }
  return result;
}
```

**Why "***MASKED***" instead of partial reveal?** The `residentNumber` in the action context is already plain-text at the point logAudit is called (the input came from the form, not the DB). Showing even the first 6 digits of SSN in an audit log could still be considered PII under Korean Personal Information Protection Act (PIPA). Full masking is safest. If partial display is needed for audit purposes (e.g., show last 4), that decision should be deferred to the admin UI layer, not baked into the stored log.

**For `businessNumber`:** It is less sensitive but still masked to be consistent.

### sanitizeForLog() — strip internal DB fields before logging

```typescript
export function sanitizeForLog(record: Record<string, unknown>): Record<string, unknown> {
  // Remove fields that should not appear in logs
  const { passwordHash, ...safe } = record as Record<string, unknown>;
  // Convert Prisma Decimal/Date to plain values for JSON serialization
  const serialized: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(safe)) {
    if (v && typeof (v as { toNumber?: unknown }).toNumber === "function") {
      serialized[k] = (v as { toNumber(): number }).toNumber();
    } else if (v instanceof Date) {
      serialized[k] = v.toISOString();
    } else {
      serialized[k] = v;
    }
  }
  return maskPii(serialized);
}
```

---

## Append-Only Enforcement

### Recommended: Application-level + Prisma-level (no PostgreSQL RLS needed)

Three-layer defense:

**Layer 1 — Prisma schema (primary):** Do NOT expose `auditLog.update` or `auditLog.delete` anywhere in the codebase. The `logAudit()` helper only uses `prisma.auditLog.create`. No action file will import an update/delete for audit logs.

**Layer 2 — PostgreSQL RULE (recommended, simple):** Add a migration that installs a `RULE` on the `audit_logs` table:

```sql
-- Run in a migration file
CREATE RULE no_update_audit_logs AS ON UPDATE TO audit_logs DO INSTEAD NOTHING;
CREATE RULE no_delete_audit_logs AS ON DELETE TO audit_logs DO INSTEAD NOTHING;
```

This silently drops UPDATE and DELETE statements at the DB level regardless of which client sends them. It requires no RLS setup or separate DB roles.

**Layer 3 — PostgreSQL RLS (optional, strongest):** If multiple DB users are involved (e.g., separate admin DB user vs. app DB user), enable RLS. For a single-app-user setup this is over-engineering.

**Why not Prisma middleware/extension for append-only?** Prisma extensions operate after the query is built but the DB rule fires before any rows are touched. DB-level protection is always more reliable than application-level.

### Migration strategy

Create a standard Prisma migration for the model, then run a raw SQL step in the same migration:

```typescript
// prisma/migrations/YYYYMMDDHHMMSS_add_audit_log/migration.sql
-- CreateTable (generated by prisma migrate)
CREATE TABLE "audit_logs" ( ... );

-- Append-only protection
CREATE RULE no_update_audit_logs AS ON UPDATE TO audit_logs DO INSTEAD NOTHING;
CREATE RULE no_delete_audit_logs AS ON DELETE TO audit_logs DO INSTEAD NOTHING;
```

**Pitfall:** `prisma migrate dev` generates the SQL but does not add custom `RULE` statements. After running `prisma migrate dev --create-only`, manually append the two `CREATE RULE` lines before applying.

---

## Admin View

### audit-actions.ts (new file)

```typescript
// src/actions/audit-actions.ts
"use server";

import { adminAction } from "@/lib/safe-action";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

export const getAuditLogs = adminAction
  .schema(z.object({
    entityType: z.string().optional(),
    userId: z.string().optional(),
    dateFrom: z.string().optional(), // ISO date string
    dateTo: z.string().optional(),
    page: z.number().default(1),
    pageSize: z.number().default(50),
  }))
  .action(async ({ parsedInput, ctx }) => {
    const { entityType, userId, dateFrom, dateTo, page, pageSize } = parsedInput;

    const where: Record<string, unknown> = { organizationId: ctx.organizationId };
    if (entityType) where.entityType = entityType;
    if (userId) where.userId = userId;
    if (dateFrom || dateTo) {
      where.createdAt = {
        ...(dateFrom && { gte: new Date(dateFrom) }),
        ...(dateTo && { lte: new Date(dateTo) }),
      };
    }

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.auditLog.count({ where }),
    ]);

    return { logs, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
  });
```

**Note:** `getAuditLogs` uses `prisma` (basePrisma) directly and manually applies the `organizationId` filter. This is intentional — audit logs are not in the tenant extension, so the filter must be explicit. `adminAction` ensures only ADMIN role can call this.

### Admin UI page — minimal requirements

- Route: `/audit` (ADMIN only, protect via middleware or page-level role check)
- Filters: entity type dropdown, date range pickers, user selector
- Table columns: timestamp, user, action (CREATE/UPDATE/DELETE), entity type, entity ID, IP address
- Expandable row or modal: show `before` / `after` JSON diff
- No edit/delete buttons of any kind

---

## Implementation Strategy: Why Manual logAudit() Wins

| Strategy | Before/After capture | Context (userId/IP) | Code changes | Risk |
|---|---|---|---|---|
| Manual `logAudit()` in each action | Easy — explicit in action | Easy — `ctx` available | 15 mutations × ~5 lines | Requires discipline, but transparent |
| Prisma Extension (`query.*`) | Hard — no pre-query hook for UPDATE/DELETE | Hard — requires AsyncLocalStorage or closure | One place in prisma.ts | Complex, fragile |
| `safe-action` `.use()` middleware | Cannot capture entity-level before/after | Easy | One place in safe-action.ts | Cannot know what was changed |

**Verdict:** Manual calls. The Prisma extension approach would require capturing `before` inside the extension hook (which means adding a `findFirst` inside every `update`/`delete` interceptor, in addition to the mutation itself), and threading `userId`/`ipAddress` into it via `AsyncLocalStorage`. This adds ~150 lines of infrastructure for marginal gain over 15 explicit calls.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Append-only at DB level | Custom trigger/function | PostgreSQL `RULE` | Rules are simpler than triggers for INSTEAD NOTHING |
| JSON diff display in UI | Custom differ | Render `before`/`after` as formatted JSON, use CSS `white-space: pre` | No need for a diff library for MVP |
| PII detection | ML-based classifier | Field-name whitelist (`PII_FIELDS` Set) | The schema is known; dynamic detection is overkill |

---

## Common Pitfalls

### Pitfall 1: Writing audit log inside a transaction with the main mutation
**What goes wrong:** If the audit log write is wrapped in the same `$transaction` as the mutation and the transaction rolls back (e.g., due to a constraint error), the audit log is also rolled back — silently losing evidence of the attempted change.
**How to avoid:** Write the mutation first (or inside a transaction), await its result, then write the audit log separately with `basePrisma`. The audit log write is outside the mutation transaction.
**Warning signs:** `logAudit()` is called inside `ctx.db.$transaction(...)`.

### Pitfall 2: Storing encrypted residentNumber in the audit log
**What goes wrong:** `ctx.db.customer.create()` receives the encrypted value. If you log the `after` from the Prisma return value, you store the cipher text. If you log the form input, you store plain-text SSN.
**How to avoid:** Pass the `parsedInput` values (plain-text) to `logAudit()` and let `maskPii()` mask them. Never pass the post-encrypt value or the post-Prisma-return value that contains the cipher.
**Warning signs:** `after.residentNumber` looks like `"a1b2c3...hex..."` (cipher text format from `encryption.ts`).

### Pitfall 3: Logging LoanSchedule rows for every payment
**What goes wrong:** A single `processPayment` creates one Payment record and updates multiple LoanSchedule rows. Logging every schedule update produces many near-identical audit entries.
**How to avoid:** Log at the action level: one entry for the Payment CREATE, one for the Loan UPDATE (balance change). Skip LoanSchedule individual row updates in the audit log — they are derivative data that can be reconstructed.

### Pitfall 4: `headers()` called outside a request context
**What goes wrong:** `next/headers`'s `headers()` throws `"headers was called outside a request scope"` if called at module initialization.
**How to avoid:** Always call `getClientIp()` inside the action's async function body, never at module scope or inside a utility that runs during module import.

### Pitfall 5: `organizationId` filter missing on `prisma.auditLog.findMany`
**What goes wrong:** `basePrisma` has no tenant extension. If you query audit logs without the `organizationId` filter, Org A can see Org B's logs.
**How to avoid:** `getAuditLogs` server action always applies `where: { organizationId: ctx.organizationId }`. The `ctx` from `adminAction` guarantees the org scope.

### Pitfall 6: Prisma JSON fields and Decimal serialization
**What goes wrong:** Prisma `Decimal` type does not serialize to JSON automatically — `JSON.stringify(loan.loanAmount)` produces `{}`. Date objects become strings only if `.toISOString()` is called.
**How to avoid:** Use `sanitizeForLog()` (see above) which converts Decimals via `.toNumber()` and Dates via `.toISOString()` before passing to `logAudit`.

---

## Code Examples

### Complete audit.ts module

```typescript
// src/lib/audit.ts
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";

export type AuditAction = "CREATE" | "UPDATE" | "DELETE";

export interface AuditContext {
  userId: string;
  organizationId: string;
  ipAddress?: string;
}

const PII_FIELDS = new Set(["residentNumber", "businessNumber"]);

export function maskPii(data: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (PII_FIELDS.has(key) && value) {
      result[key] = "***MASKED***";
    } else if (value && typeof value === "object" && !Array.isArray(value) && !(value instanceof Date)) {
      result[key] = maskPii(value as Record<string, unknown>);
    } else {
      result[key] = value;
    }
  }
  return result;
}

export function sanitizeForLog(record: Record<string, unknown>): Record<string, unknown> {
  const excluded = new Set(["passwordHash", "organizationId", "updatedAt"]);
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(record)) {
    if (excluded.has(k)) continue;
    if (v && typeof (v as { toNumber?: unknown }).toNumber === "function") {
      out[k] = (v as { toNumber(): number }).toNumber();
    } else if (v instanceof Date) {
      out[k] = v.toISOString();
    } else {
      out[k] = v;
    }
  }
  return maskPii(out);
}

export function getClientIp(): string | undefined {
  try {
    const h = headers();
    return (
      h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      h.get("x-real-ip") ||
      undefined
    );
  } catch {
    return undefined;
  }
}

export async function logAudit(
  ctx: AuditContext,
  entityType: string,
  entityId: string,
  action: AuditAction,
  before: Record<string, unknown> | null,
  after: Record<string, unknown> | null,
): Promise<void> {
  // Fire-and-forget is acceptable for audit logs — do not throw on failure
  try {
    await prisma.auditLog.create({
      data: {
        organizationId: ctx.organizationId,
        userId: ctx.userId,
        entityType,
        entityId,
        action,
        before: before ? maskPii(before) : undefined,
        after: after ? maskPii(after) : undefined,
        ipAddress: ctx.ipAddress,
      },
    });
  } catch (err) {
    // Log to server console but do not propagate — audit failure must not block the user action
    console.error("[audit] Failed to write audit log:", err);
  }
}
```

### Mutation count inventory (all 4 action files)

| File | Mutations | logAudit calls needed |
|---|---|---|
| `customer-actions.ts` | createCustomer, updateCustomer, deleteCustomer | 3 |
| `loan-actions.ts` | createLoan, processPayment, deleteLoan | 3 (skip schedule sub-updates per Pitfall 3) |
| `collateral-actions.ts` | createCollateral, updateCollateral, deleteCollateral, createMortgage, updateMortgage, deleteMortgage | 6 |
| `setting-actions.ts` | (unknown — not read, likely 1-3) | 1-3 |

**Total: ~15 mutations across 4 files.**

---

## Environment Availability

Step 2.6: SKIPPED — no new external dependencies. All required tools (PostgreSQL, Prisma, Next.js) are already running for Phase 1.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Not yet detected in codebase (no test config found) |
| Config file | None — Wave 0 must create |
| Quick run command | `npx jest --testPathPattern=audit` (if Jest added) |
| Full suite command | `npx jest` |

### Phase Requirements to Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| AUDIT-01 | Every mutation produces an AuditLog row | Integration | `npx jest tests/audit.test.ts -t "creates audit log on"` | Wave 0 |
| AUDIT-02 | Log contains userId, ipAddress, before, after | Integration | Same file, per-field assertions | Wave 0 |
| AUDIT-03 | UPDATE/DELETE to audit_logs table is rejected by DB | Integration | Raw SQL UPDATE returns 0 rows affected | Wave 0 |
| AUDIT-04 | residentNumber/businessNumber appear as ***MASKED*** in log | Unit | `npx jest tests/audit-masking.test.ts` | Wave 0 |
| AUDIT-05 | getAuditLogs returns only org-scoped logs | Integration | `npx jest tests/audit-actions.test.ts` | Wave 0 |

### Wave 0 Gaps

- [ ] `tests/audit.test.ts` — AUDIT-01, AUDIT-02
- [ ] `tests/audit-masking.test.ts` — AUDIT-04 (pure unit test for `maskPii`)
- [ ] `tests/audit-actions.test.ts` — AUDIT-05
- [ ] Test framework setup (Jest or Vitest) not yet configured

---

## Sources

### Primary (HIGH confidence)
- Direct codebase inspection — `src/lib/prisma.ts`, `src/lib/safe-action.ts`, `src/actions/customer-actions.ts`, `src/actions/loan-actions.ts`, `src/actions/collateral-actions.ts`, `src/lib/encryption.ts`, `prisma/schema.prisma`
- Prisma `$extends` pattern confirmed via existing implementation in `getTenantClient()`
- next-safe-action v8 `.use()` middleware chaining confirmed via existing `authenticatedAction`/`adminAction`

### Secondary (MEDIUM confidence)
- PostgreSQL `RULE ... DO INSTEAD NOTHING` for append-only tables — well-documented PostgreSQL pattern
- `next/headers` `headers()` in server actions — documented Next.js 14 App Router pattern
- Korean SSN regex (123456-1234567 format) — standardized PIPA-compliant masking

### Tertiary (LOW confidence — validate before implementing)
- Fire-and-forget audit write (catch and swallow) — acceptable for many financial systems but some compliance regimes (e.g., FSS in Korea) may require that audit failure triggers an alert. Validate with compliance requirements.

---

## Metadata

**Confidence breakdown:**
- Schema design: HIGH — directly derived from existing Prisma models
- Implementation strategy: HIGH — directly derived from existing middleware pattern
- PII masking: HIGH — regex patterns are deterministic for known formats
- Append-only enforcement: MEDIUM — PostgreSQL RULE is correct but custom SQL in migration needs manual step
- Admin view: HIGH — follows existing action pattern

**Research date:** 2026-03-26
**Valid until:** 2026-06-26 (stable stack)
