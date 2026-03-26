# Phase 3: Loan Lifecycle Extensions - Research

**Researched:** 2026-03-26
**Domain:** Loan lifecycle operations — extension, prepayment, batch overdue
**Confidence:** HIGH

## Summary

Phase 3 extends the existing loan management system with three major operational workflows: loan term extension (만기 연장), early repayment (중도상환), and batch overdue processing (일괄 연체 처리). The codebase already has solid financial calculation infrastructure in `src/lib/interest.ts` and `src/lib/schedule-generator.ts` using Decimal.js with day-count convention (actual/365). All new calculations must follow these exact conventions.

The existing `Setting` model uses a key-value store pattern (`key: String, value: String`). The `prepaymentFeeRate` for the org-level default will follow this same pattern — stored as a string under key `"prepayment_fee_rate"` — rather than adding a new Decimal column to the Setting model. The Loan model, however, needs a new `prepaymentFeeRate Decimal?` field for loan-level overrides.

The batch overdue action (`processBatchOverdue`) must use `ctx.db.$transaction([...])` for atomicity (LOAN-10). The cron route handler at `GET /api/batch/overdue` needs CRON_SECRET header auth since it has no session context — it calls raw `basePrisma` directly or a service function that accepts a db client.

**Primary recommendation:** Build calculator functions in `src/lib/loan-calculator.ts` as pure functions (no DB calls), then compose them in server actions. This keeps logic testable and separates concerns cleanly.

## Standard Stack

### Core (already installed)
| Library | Version | Purpose | Note |
|---------|---------|---------|------|
| decimal.js | ^10.6.0 | All financial arithmetic | Already used in schedule-generator.ts |
| date-fns | ^4.1.0 | Date arithmetic (addMonths, differenceInDays) | Already used |
| next-safe-action | ^8.1.8 | authenticatedAction / adminAction wrappers | Already in src/lib/safe-action.ts |
| zod | ^4.3.6 | Input schema validation | Already used in validators.ts |
| prisma | ^7.5.0 | DB access via getTenantClient | Already established pattern |

No new npm installs required for this phase.

## Architecture Patterns

### Existing Patterns to Follow

**1. Schedule generation signature (schedule-generator.ts):**
```typescript
// startDate = the "from" date, termMonths = number of months
generateSchedule(principal, annualRate, repaymentType, startDate, termMonths): ScheduleItem[]
```
`recalculateSchedule` in loan-calculator.ts must accept the same shape for consistency.

**2. Interest calculation (interest.ts):**
```typescript
// All interest is actual/365 day-count
calculateInterestForDays(principal, annualRate, days): Decimal
calculateMonthlyInterest(principal, annualRate, fromDate, toDate): Decimal
```
Overdue interest uses annualRate + overdue_rate_addition (from Setting key `"overdue_rate_addition"`, default "3").

**3. Server action pattern (safe-action.ts):**
```typescript
export const myAction = adminAction
  .schema(z.object({ ... }))
  .action(async ({ parsedInput, ctx }) => {
    // ctx.db = getTenantClient(organizationId)
    // ctx.userId, ctx.organizationId, ctx.role
  });
```

**4. Audit logging pattern:**
```typescript
await logAudit(
  { userId: ctx.userId, organizationId: ctx.organizationId, ipAddress: getClientIp() },
  "Loan", loan.id, "UPDATE",
  sanitizeForLog(before), sanitizeForLog(after)
);
```

**5. Setting read pattern:**
```typescript
const setting = await ctx.db.setting.findFirst({ where: { key: "overdue_rate_addition" } });
const overdueRateAddition = new Decimal(setting?.value ?? "3");
```

**6. Dialog component pattern (payment-dialog.tsx):**
- "use client" at top
- useState for open/saving/form fields
- Call server action directly (not via form submit for complex flows)
- `router.refresh()` after success
- `result?.data?.success` to check result

**7. Tenant isolation:**
- `getTenantClient` auto-injects `organizationId` on all create/update/findMany/findFirst
- `deleteMany` on loanSchedule must include `{ loanId, organizationId }` explicitly since deleteMany is not in the extension

**8. $transaction pattern for atomicity:**
```typescript
await ctx.db.$transaction(async (tx) => {
  // All operations inside are atomic
  await tx.loan.update(...)
  await tx.loanSchedule.deleteMany(...)
  await tx.loanSchedule.createMany(...)
});
```
Note: `ctx.db` is an extended client. `ctx.db.$transaction` accepts an async function (interactive transaction), which is the correct pattern here.

### Recommended Project Structure Additions
```
src/lib/
  loan-calculator.ts    # NEW: pure financial calculation functions
src/actions/
  loan-lifecycle-actions.ts  # NEW: extendLoan, calculatePrepayment, processPrepayment, processBatchOverdue
src/app/api/batch/
  overdue/
    route.ts           # NEW: GET handler for cron job
src/components/loans/
  extend-loan-dialog.tsx      # NEW
  prepayment-dialog.tsx       # NEW
  batch-overdue-button.tsx    # NEW (admin only)
```

### Anti-Patterns to Avoid
- **Never call `generateSchedule` from loan-calculator.ts** — import and reuse it instead
- **Never use `ctx.db.loanSchedule.deleteMany` without organizationId** — the extension does not cover deleteMany
- **Never store Decimal as JS number in intermediate calculations** — keep Decimal until the final `.toNumber()` at DB write
- **Never throw inside logAudit** — follow established fire-and-forget pattern
- **Never authenticate the cron route with session** — it has no browser context; use CRON_SECRET header

## Key Business Logic

### Overdue Interest Settlement (settleOverdueInterest)
Before extending a loan, all accrued overdue interest must be settled (LOAN-02).

```
overdueRate = loan.interestRate + overdue_rate_addition (from settings)
For each OVERDUE/PARTIAL schedule where dueDate < settleDate:
  overdueDays = differenceInDays(settleDate, schedule.dueDate)
  overdueInterest = calculateInterestForDays(schedule.remainingBalance, overdueRate, overdueDays)
totalOverdueInterest = sum of all overdueInterest amounts
```

This does NOT automatically create a Payment record — `extendLoan` action creates the Payment record for the overdue settlement amount, then calls `settleOverdueInterest` to mark schedules.

### Prepayment Fee Calculation (LOAN-06, LOAN-07)
Fee rate priority: `loan.prepaymentFeeRate` → org setting `"prepayment_fee_rate"` → 0%

```typescript
// Full prepayment
prepaymentFee = loan.balance * feeRate / 100
totalDue = loan.balance + accruedInterest + prepaymentFee

// Partial prepayment
prepaymentFee = prepaymentAmount * feeRate / 100
// After partial: recalculate remaining schedule from today
```

Accrued interest = interest from last schedule's dueDate (or loan startDate) to prepaymentDate, on current balance.

### Schedule Recalculation (recalculateSchedule)
After extension or partial prepayment:
1. Delete all SCHEDULED (unpaid) future schedules
2. Regenerate from `fromDate` with new `endDate` (or `newRate` if changed)
3. New `termMonths = differenceInMonths(newEndDate, fromDate)` rounded up
4. Starting installmentNumber = max(existing paid installments) + 1

Uses existing `generateSchedule` function from schedule-generator.ts.

### Batch Overdue Processing (processBatchOverdue)
```
For each org's loans with status ACTIVE or OVERDUE:
  For each loan's SCHEDULED/PARTIAL schedules with dueDate < today:
    Mark schedule.status = OVERDUE
    Calculate overdueDays from earliest overdue schedule's dueDate
    Determine overdueStage: STAGE_1 (1-30d), STAGE_2 (31-90d), STAGE_3 (91d+)
    Update loan: status=OVERDUE, overdueDays, overdueStage
All in a single $transaction
```

### Cron Route Authentication
```typescript
// GET /api/batch/overdue
const secret = request.headers.get("x-cron-secret");
if (secret !== process.env.CRON_SECRET) {
  return Response.json({ error: "Unauthorized" }, { status: 401 });
}
```

## Don't Hand-Roll

| Problem | Don't Build | Use Instead |
|---------|-------------|-------------|
| Schedule generation | Custom amortization math | `generateSchedule()` from schedule-generator.ts |
| Day-count interest | Custom formula | `calculateInterestForDays()` from interest.ts |
| Monthly interest | Custom formula | `calculateMonthlyInterest()` from interest.ts |
| Decimal arithmetic | JS number math | `Decimal.js` — already installed and configured |
| Input validation | Manual type checks | Zod schemas, extend validators.ts |
| Auth check in actions | Manual session check | `authenticatedAction` / `adminAction` |

## Schema Changes Required

### Loan model — add one field:
```prisma
prepaymentFeeRate  Decimal?  @db.Decimal(5, 2)  // 대출별 중도상환수수료율 (%)
```

### Setting model — NO schema change needed
The org-level default prepayment fee rate is stored as a key-value pair under key `"prepayment_fee_rate"`. This follows the existing pattern for `"overdue_rate_addition"`, `"default_interest_rate"`, etc.

### Migration:
```bash
npx prisma migrate dev --name add_loan_prepayment_fee_rate
```

## Common Pitfalls

### Pitfall 1: getTenantClient extension does not cover deleteMany
**What goes wrong:** `ctx.db.loanSchedule.deleteMany({ where: { loanId } })` silently deletes across ALL orgs
**Why it happens:** The extension only intercepts `findMany`, `findFirst`, `count`, `create`, `update`, `delete` — not `deleteMany`
**How to avoid:** Always include `organizationId: ctx.organizationId` explicitly in deleteMany where clause
**Warning sign:** Missing organizationId in deleteMany call

### Pitfall 2: Interactive transaction with extended client
**What goes wrong:** `ctx.db.$transaction([promise1, promise2])` (array form) may not work correctly with extended client
**Why it happens:** The array form doesn't support the extended Prisma methods properly
**How to avoid:** Always use interactive transaction form: `ctx.db.$transaction(async (tx) => { ... })`
**Warning sign:** Using array syntax `$transaction([...])`

### Pitfall 3: Decimal precision loss at DB boundary
**What goes wrong:** `schedule.principalAmount` from DB is Prisma Decimal, not Decimal.js Decimal
**Why it happens:** Prisma returns its own Decimal type; must convert via `.toString()` before passing to Decimal.js
**How to avoid:** Always `new Decimal(prismaValue.toString())` when reading from DB
**Warning sign:** Direct arithmetic on Prisma Decimal objects

### Pitfall 4: Month difference for schedule recalculation
**What goes wrong:** Using `differenceInMonths` from date-fns gives floor, not ceiling for partial months
**Why it happens:** e.g., March 15 to June 10 = 2 months by floor, but needs 3 schedule slots
**How to avoid:** Use `Math.ceil` or compute via `differenceInCalendarMonths` and adjust
**Warning sign:** Last schedule has wrong or missing payment

### Pitfall 5: Cron route runs without organizationId context
**What goes wrong:** Using `getTenantClient` in cron route (no session available)
**Why it happens:** No authenticated session in cron context
**How to avoid:** Use `basePrisma` directly in the cron route, or pass organizationId explicitly from a query of all orgs
**Warning sign:** Calling `getServerSession` in route.ts for the cron endpoint

## Code Examples

### Atomic transaction for schedule replacement:
```typescript
// Source: established pattern from processPayment in loan-actions.ts
await ctx.db.$transaction(async (tx) => {
  // 1. Delete future unpaid schedules
  await tx.loanSchedule.deleteMany({
    where: {
      loanId: loan.id,
      organizationId: ctx.organizationId,  // REQUIRED — not in extension
      status: { in: ["SCHEDULED"] },
    },
  });

  // 2. Update loan
  await tx.loan.update({
    where: { id: loan.id },
    data: { endDate: newEndDate, interestRate: newRate, loanTermMonths: newTermMonths },
  });

  // 3. Create new schedules
  await tx.loanSchedule.createMany({
    data: newScheduleItems.map((s) => ({
      organizationId: ctx.organizationId,
      loanId: loan.id,
      installmentNumber: s.installmentNumber,
      dueDate: s.dueDate,
      principalAmount: s.principalAmount.toNumber(),
      interestAmount: s.interestAmount.toNumber(),
      totalAmount: s.totalAmount.toNumber(),
      remainingBalance: s.remainingBalance.toNumber(),
    })),
  });
});
```

### Two-step prepayment dialog (preview then confirm):
```typescript
// Step 1: call calculatePrepayment (read-only) → show preview
// Step 2: user clicks confirm → call processPrepayment
const [step, setStep] = useState<"form" | "preview">("form");
const [preview, setPreview] = useState<PrepaymentPreview | null>(null);

async function handlePreview() {
  const result = await calculatePrepayment({ loanId, amount, date, type });
  if (result?.data) {
    setPreview(result.data);
    setStep("preview");
  }
}
```

## Environment Availability

Step 2.6: SKIPPED — no new external dependencies. All tools (Node, Prisma, PostgreSQL) established in prior phases.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | None detected — no test config files found |
| Config file | none |
| Quick run command | `npx tsc --noEmit` |
| Full suite command | `npx tsc --noEmit && npx next build` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command |
|--------|----------|-----------|-------------------|
| LOAN-01 | extendLoan updates endDate, interestRate | manual | test via UI or psql |
| LOAN-02 | Overdue interest settled before extension | manual | check Payment record created |
| LOAN-03 | Schedule regenerated from extension date | manual | check loanSchedule rows |
| LOAN-04 | Full prepayment calculates balance+interest+fee | unit-like | `npx tsc --noEmit` |
| LOAN-05 | Partial prepayment recalculates schedule | manual | check new schedules |
| LOAN-06 | Fee rate configurable per-loan and per-org | manual | settings page + loan detail |
| LOAN-07 | Fee preview shown before confirmation | manual | UI dialog step 1 |
| LOAN-08 | Daily auto overdue update | manual | cron route call |
| LOAN-09 | Manual batch overdue trigger | manual | admin button |
| LOAN-10 | Batch overdue is atomic | manual | DB check |

### Wave 0 Gaps
- No test framework installed. TypeScript compile (`npx tsc --noEmit`) is the primary automated check.

## Sources

### Primary (HIGH confidence)
- Direct codebase reading: `src/lib/schedule-generator.ts`, `src/lib/interest.ts`, `src/lib/safe-action.ts`, `src/lib/prisma.ts`
- Direct codebase reading: `src/actions/loan-actions.ts`, `src/actions/setting-actions.ts`
- Direct codebase reading: `prisma/schema.prisma`, `src/components/loans/payment-dialog.tsx`

### Secondary (MEDIUM confidence)
- Prisma interactive transaction docs: $transaction(async fn) is the recommended pattern for extended clients
- next-safe-action v8: `.schema().action()` chaining pattern confirmed from existing usage

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries confirmed in package.json and in active use
- Architecture: HIGH — patterns read directly from codebase
- Pitfalls: HIGH — derived from direct reading of prisma.ts extension scope

**Research date:** 2026-03-26
**Valid until:** 2026-06-26 (stable stack)
