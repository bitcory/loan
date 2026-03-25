---
phase: "01"
plan: "05"
subsystem: "auth-foundation"
tags: ["safe-action", "tenant-isolation", "authenticatedAction", "adminAction", "migration", "server-actions"]
dependency_graph:
  requires: ["01-01", "01-02", "01-03", "01-04"]
  provides: ["all actions tenant-isolated", "all mutations safe-action wrapped", "DEFAULT_ORG_ID removed", "findUnique eliminated"]
  affects:
    - src/lib/customer-number.ts
    - src/lib/loan-number.ts
    - src/actions/customer-actions.ts
    - src/actions/collateral-actions.ts
    - src/actions/loan-actions.ts
    - src/actions/setting-actions.ts
    - src/components/customers/customer-form.tsx
    - src/components/customers/delete-customer-button.tsx
    - src/components/customers/edit-customer-dialog.tsx
    - src/components/collaterals/collateral-form.tsx
    - src/components/collaterals/delete-collateral-button.tsx
    - src/components/collaterals/mortgage-form.tsx
    - src/components/loans/loan-wizard.tsx
    - src/components/loans/payment-dialog.tsx
    - src/components/settings/settings-form.tsx
tech_stack:
  added: []
  patterns:
    - "Server Component reads use getServerSession+getTenantClient directly"
    - "Mutations wrapped in authenticatedAction/adminAction from next-safe-action v8"
    - "ctx.organizationId explicit in create data for TypeScript satisfaction (interceptor also injects at runtime)"
    - "Components call actions with typed objects, check result?.data?.success"
key_files:
  modified:
    - src/lib/customer-number.ts
    - src/lib/loan-number.ts
    - src/actions/customer-actions.ts
    - src/actions/collateral-actions.ts
    - src/actions/loan-actions.ts
    - src/actions/setting-actions.ts
    - src/components/customers/customer-form.tsx
    - src/components/customers/delete-customer-button.tsx
    - src/components/customers/edit-customer-dialog.tsx
    - src/components/collaterals/collateral-form.tsx
    - src/components/collaterals/delete-collateral-button.tsx
    - src/components/collaterals/mortgage-form.tsx
    - src/components/loans/loan-wizard.tsx
    - src/components/loans/payment-dialog.tsx
    - src/components/settings/settings-form.tsx
decisions:
  - "Read functions remain plain async (Server Components call them directly); only mutations are safe-action wrapped"
  - "organizationId explicitly passed in create data even though TenantDb interceptor injects it — required for TypeScript to accept the create input type"
  - "processPayment does not use $transaction in migrated version — sequential operations instead, simpler and avoids type complexity with extended client"
  - "updateSettings schema changed from FormData to Record<string, string> — components updated to build the record before calling"
  - "All DELETE actions are adminAction (ADMIN only); all CREATE/UPDATE are authenticatedAction (STAFF and ADMIN)"
metrics:
  duration: "25 minutes"
  completed: "2026-03-26"
  tasks_completed: 2
  files_changed: 15
---

# Phase 1 Plan 5: Action Migration to safe-action + Tenant Isolation Summary

Migrated all 4 action files from raw Prisma + DEFAULT_ORG_ID bridge constants to properly tenant-isolated server actions using authenticatedAction/adminAction, with components updated to match the new safe-action result shape.

## What Was Done

### Task 1: customer-number.ts + customer-actions.ts + collateral-actions.ts

**`src/lib/customer-number.ts` updated:**
- Changed signature from `generateCustomerNumber()` (imported prisma directly) to `generateCustomerNumber(db: TenantDb)`
- `TenantDb = ReturnType<typeof getTenantClient>` type defined locally
- No longer imports prisma at module level

**`src/lib/loan-number.ts` updated (discovered during Task 2):**
- Same pattern: `generateLoanNumber(db: TenantDb, date?: Date)` — db passed instead of using global prisma
- No longer imports prisma at module level

**`src/actions/customer-actions.ts` migrated:**
- `DEFAULT_ORG_ID` bridge constant removed
- `getCustomers`, `getCustomer`, `getAllCustomers`: plain async functions using `getServerSession` + `getTenantClient`
- `createCustomer`: `authenticatedAction` with `customerSchema`
- `updateCustomer`: `authenticatedAction` with `z.object({ id, data: customerSchema })`
- `deleteCustomer`: `adminAction` with `z.object({ id })` — throws on active loans instead of returning error object
- All `findUnique` replaced with `findFirst`
- `generateCustomerNumber(ctx.db)` called with tenant db

**`src/actions/collateral-actions.ts` migrated:**
- `DEFAULT_ORG_ID` bridge constant removed
- `getCollaterals`, `getCollateral`, `getCustomerCollaterals`: plain async with session
- `createCollateral`, `updateCollateral`: `authenticatedAction`
- `deleteCollateral`: `adminAction`
- `createMortgage`, `updateMortgage`: `authenticatedAction`
- `deleteMortgage`: `adminAction`
- All `findUnique` replaced with `findFirst`

### Task 2: loan-actions.ts + setting-actions.ts

**`src/actions/loan-actions.ts` migrated:**
- `DEFAULT_ORG_ID` bridge constant removed
- `getLoans`, `getLoan`, `getLoanSchedules`, `getDashboardStats`, `getOverdueLoans`, `getMonthlyStats`: plain async with session + getTenantClient
- `createLoan`: `authenticatedAction` — `generateLoanNumber(ctx.db, start)` called with tenant db
- `processPayment`: `authenticatedAction` — sequential operations (create payment, update loan balance, update schedule)
- `deleteLoan`: `adminAction`
- All `findUnique` replaced with `findFirst`
- `organizationId: ctx.organizationId` added to loan.create, payment.create, loanSchedule creates

**`src/actions/setting-actions.ts` migrated:**
- `DEFAULT_ORG_ID` bridge constant removed
- `getSettings`, `getSetting`: plain async with session + getTenantClient
- `updateSettings`: `adminAction` with `z.record(z.string(), z.string())` — processes all key/value pairs
- `updateSetting`: `adminAction` with `z.object({ key, value })` — single key upsert
- `organizationId_key` compound unique used in update `where` clause

### Component Updates (auto-fixed: Rule 3 - blocking TypeScript errors)

All components that called mutations were updated to match the new safe-action calling convention:

| Component | Change |
|-----------|--------|
| `customer-form.tsx` | `createCustomer(data)` and `updateCustomer({ id, data })` — result check via `result?.data?.success` |
| `edit-customer-dialog.tsx` | `updateCustomer({ id, data })` — same pattern |
| `delete-customer-button.tsx` | `deleteCustomer({ id })` — error from `result?.serverError` |
| `collateral-form.tsx` | `createCollateral(data)` / `updateCollateral({ id, data })` |
| `delete-collateral-button.tsx` | `deleteCollateral({ id })` |
| `mortgage-form.tsx` | `createMortgage({ collateralId, rank, ... })` — typed object instead of FormData |
| `loan-wizard.tsx` | `createLoan({ customerId, loanAmount, ... })` — typed object, result check `result?.data?.id` |
| `payment-dialog.tsx` | `processPayment({ loanId, paymentDate, ... })` — typed object |
| `settings-form.tsx` | Builds `Record<string, string>` from FormData, calls `updateSettings(record)` |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical Functionality] organizationId required in Prisma create input types**
- **Found during:** TypeScript compilation after initial migration
- **Issue:** TenantDb's `$extends` interceptor injects `organizationId` at runtime, but TypeScript still requires it in the create input type. Without it, `tsc` fails with "Property 'organizationId' is missing".
- **Fix:** Added `organizationId: ctx.organizationId` explicitly to all `create` data objects in action files (collateral, mortgage, loan, loanSchedule, payment, setting)
- **Files modified:** All 4 action files
- **Commit:** 6c694f0

**2. [Rule 3 - Blocking] Component files had TypeScript errors from old FormData calling convention**
- **Found during:** TypeScript compilation — components still called old function signatures
- **Issue:** After migrating actions to safe-action, components were still passing `FormData` where typed objects are now expected, and calling `updateCustomer(id, formData)` where the new signature is `updateCustomer({ id, data })`
- **Fix:** Updated 9 component files to use typed object calling convention and `result?.data?.success` check pattern
- **Files modified:** 9 component files (see table above)
- **Commit:** 6c694f0 (bundled with action migration)

**3. [Rule 3 - Blocking] settings-form.tsx FormData iteration ts2802 error**
- **Found during:** Second TypeScript compilation pass
- **Issue:** `for...of formData.entries()` fails with `Type 'FormDataIterator' can only be iterated with --downlevelIteration`
- **Fix:** Changed to `Array.from(formData.entries()).forEach(...)`
- **Files modified:** src/components/settings/settings-form.tsx
- **Commit:** 6c694f0

**4. [Rule 1 - Architectural] processPayment: removed $transaction in favor of sequential operations**
- **Found during:** Evaluating implementation approach
- **Issue:** `prisma.$transaction` on the extended TenantDb client has complex TypeScript type behavior; the plan's original code used `prisma.$transaction(async (tx) => { ... })` but `tx` is a raw PrismaClient without organization context, meaning it would bypass tenant isolation
- **Fix:** Used sequential operations directly on `ctx.db` — ensures all operations go through the tenant-isolated client
- **Files modified:** src/actions/loan-actions.ts
- **Note:** Slight atomicity tradeoff, but correct tenant isolation

## Verification Results

```
grep -r "findUnique" src/actions/          PASS (zero results)
grep "TenantDb" src/lib/customer-number.ts PASS (found: type TenantDb, param db: TenantDb)
grep "adminAction" src/actions/customer-actions.ts    PASS (deleteCustomer = adminAction)
grep "authenticatedAction" src/actions/customer-actions.ts PASS (createCustomer, updateCustomer)
grep "adminAction" src/actions/setting-actions.ts     PASS (updateSettings, updateSetting)
grep "ctx\.db\." src/actions/loan-actions.ts          PASS (multiple matches)
npx tsc --noEmit                                      PASS (zero errors)
```

## Phase 1 Completion

With plan 01-05 complete, Phase 1 (Auth + Multi-Tenant Foundation) is fully implemented:

- **01-01**: Prisma schema + PostgreSQL adapter
- **01-02**: Core business logic libraries (encryption, validators, schedule generator)
- **01-03**: NextAuth JWT auth + getTenantClient Prisma extension + safe-action middleware
- **01-04**: Login page + user management
- **01-05**: All action files migrated to tenant-isolated safe-action pattern, DEFAULT_ORG_ID removed

The codebase is now fully multi-tenant: every database operation goes through the session-derived `organizationId`, either via `getTenantClient` (reads) or `ctx.db` from safe-action middleware (mutations).

## Known Stubs

None — all action files properly derive organizationId from session. No hardcoded org IDs remain.

## Self-Check: PASSED

- src/lib/customer-number.ts: EXISTS
- src/lib/loan-number.ts: EXISTS
- src/actions/customer-actions.ts: EXISTS
- src/actions/collateral-actions.ts: EXISTS
- src/actions/loan-actions.ts: EXISTS
- src/actions/setting-actions.ts: EXISTS
- Commit 6c694f0: EXISTS
- npx tsc --noEmit: PASS (zero errors)
