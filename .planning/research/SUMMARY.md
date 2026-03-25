# Project Research Summary

**Project:** 대출관리 SaaS 시스템 고도화 (LoanManager)
**Domain:** Multi-tenant SaaS Loan Management (Korean Private Lending / 대부업)
**Researched:** 2026-03-26
**Confidence:** HIGH

## Executive Summary

This is a B2B SaaS enhancement project: an existing Next.js 14 + Prisma + PostgreSQL loan management system (currently single-tenant) needs to be evolved into a secure multi-tenant SaaS platform suitable for Korean private lending operators (대부업체). The core challenge is not building features from scratch — the domain logic for loan scheduling, interest calculation, LTV, and payment processing already exists — but rather adding the multi-tenancy foundation, authentication/RBAC, audit logging, and a set of critical financial workflows (loan extension, early repayment, batch overdue processing, PDF document generation) that make the system production-ready for multiple organizations simultaneously.

The recommended approach follows a strict dependency-driven phase structure: multi-tenancy and authentication must be completed before any other feature, because every subsequent database query, Server Action, and UI component depends on `organizationId` and session context. The architecture uses a Tenant-Scoped Prisma Client Extension to automatically inject `organizationId` into all queries (preventing human error), `next-safe-action` to enforce authentication on every Server Action (preventing CVE-2025-29927-class middleware bypass attacks), and Prisma `$transaction` blocks to atomically pair financial mutations with audit log entries. These three patterns are not optional enhancements — they are structural safety requirements for a financial SaaS.

The key risks are: (1) a cross-tenant data leak if `organizationId` filtering is implemented manually per-query rather than via Prisma Extension, (2) missing audit log atomicity (financial transaction commits without the corresponding audit record), and (3) Korean regulatory compliance gaps — specifically the 2025 early repayment fee law change (금융소비자보호법) and the legal maximum interest rate (20%, 대부업법). Both regulatory items require correct formula implementation, not just feature flags. Stack choices are conservative and deliberate: next-auth v4 stable over v5 beta, exceljs over SheetJS (npm security), and `@react-pdf/renderer` with bundled TTF fonts over Puppeteer (Vercel serverless compatibility).

## Key Findings

### Recommended Stack

The existing stack (Next.js 14, Prisma, PostgreSQL, TanStack Table, Recharts, Decimal.js, shadcn/ui) is a solid foundation and requires no replacement. The new libraries are additive and scoped to specific capabilities. The most important decision is using **next-auth v4.24.13** (not v5 beta) for authentication — v5 carries `beta` npm dist-tag and API instability risk unacceptable for a financial system. PDF generation uses `@react-pdf/renderer 4.3.2` with a mandatory bundled Korean TTF font (NanumGothic or Noto Sans KR) — the default Roboto font renders Korean as blank boxes.

**Core new technologies:**
- `next-auth@4.24.13` + `@auth/prisma-adapter`: Session-based auth with JWT carrying `organizationId` and `role` — stable, Next.js 14 compatible, multi-tenant JWT callback pattern well-documented
- `@react-pdf/renderer@4.3.2`: Server-side Korean PDF generation — React component-based, `renderToStream()` in Route Handlers, requires explicit `Font.register()` with TTF
- `exceljs@4.4.0`: Excel export — Apache-2.0 license, npm-stable, full styling support; SheetJS avoided due to npm security issues post-v18.5
- `sonner@2.0.7`: Toast notifications — shadcn/ui official, replaces deprecated Radix toast
- `next-themes@0.4.6`: Dark mode — Tailwind `darkMode: 'class'` integration, SSR flicker-safe
- `nuqs@2.8.9`: URL search state — TanStack Table filter/sort/pagination sync to URL for shareable views
- Vercel Cron Jobs (via `vercel.json`): Daily batch overdue processing — no extra infrastructure; `node-cron` only for self-hosted VPS/Docker deployments
- Audit logging and in-app notifications: Self-implemented via Prisma models — no external library needed or appropriate

**What NOT to use:** SheetJS/xlsx (npm security), next-auth v5 beta (instability), Puppeteer on Vercel (50MB+ Chromium bundle), node-cron on Vercel (no persistent process), react-hot-toast (deprecated in favor of sonner).

### Expected Features

Research confirms the feature scope is well-defined. Multi-tenancy is the zero-day blocker — no other feature is shippable without it. The feature dependency graph is clear: organization isolation unlocks authentication, which unlocks audit logging, which unlocks all business logic features in parallel.

**Must have (P1 — launch blockers):**
- Multi-tenant organization isolation — without this, nothing else is shippable; cross-tenant data leak is catastrophic
- Authentication (NextAuth.js) + RBAC (ADMIN/STAFF, 2 roles) — session must carry `userId`, `orgId`, `role`
- Audit logging (append-only, atomic with financial transactions) — Korean financial compliance baseline (대부업법, 개인정보보호법)
- PDF generation: loan contract (대출계약서), repayment schedule (상환스케줄표), payment receipt (수납영수증) — required on day one by operators
- Batch overdue processing (daily cron + manual trigger) — loan portfolio accuracy
- Loan extension / renewal — critical operational workflow with `LoanExtension` record and schedule recalculation
- Early repayment: partial + full, with legally-compliant fee calculation — loan lifecycle completeness
- Advanced search and filtering — essential for portfolios above 20 loans
- Excel export — non-negotiable for Korean B2B operators (tax submission, internal review)
- Customer memo / history (`CustomerNote` timeline) — basic CRM capability expected

**Should have (P2 — add after v1 validation):**
- In-app notification system (bell icon, polling every 30s — no WebSocket needed for v1)
- PDF collateral appraisal sheet (담보평가서)
- Dashboard enhancements: overdue rate trend, LTV distribution, maturity calendar
- Data backup / restore (admin-triggered tenant JSON export)
- Dark mode (low complexity, add when core is stable)

**Defer to v2+:**
- Mobile optimization (full responsive audit)
- SMS notification dispatch (requires telco API registration — defined future milestone)
- AI credit scoring (out of scope, regulatory issues)
- Customer self-service portal (doubles auth surface, requires 본인인증)

**Anti-features to reject:** WebSocket/SSE notifications (polling is sufficient), OAuth/social login (complicates multi-tenant session binding), soft-delete on financial records (use audit log instead), per-column encryption beyond PII fields (kills query performance).

### Architecture Approach

The architecture is a Next.js App Router monolith with a strict layering discipline: `middleware.ts` handles auth gating, Server Components (RSC) handle data fetching via tenant-scoped Prisma, Server Actions (wrapped with `next-safe-action`) handle all mutations, and Route Handlers handle file streaming (PDF, Excel) and batch cron endpoints. The separation between Server Actions and Route Handlers is non-negotiable: Server Actions cannot return `Response` or `ReadableStream` objects, so all file downloads must go through Route Handlers called via `window.open()` or `<a href>` links.

**Major components:**
1. `middleware.ts` — Auth check + org context injection; must not be the sole auth layer (CVE-2025-29927)
2. `src/lib/prisma.ts` + `createTenantPrismaClient()` — Prisma Client Extension auto-injecting `organizationId` into all queries; the central tenant isolation mechanism
3. `src/lib/safe-action.ts` — Layered `next-safe-action` clients: `authenticatedActionClient` and `adminActionClient`; all mutations go through these
4. `src/actions/` — Server Actions using safe-action clients; wrapped in `$transaction` blocks pairing domain mutations with audit log entries
5. `src/app/api/pdf/[type]/[id]/` — Route Handlers streaming `application/pdf` via `@react-pdf/renderer renderToStream()`
6. `src/app/api/export/[type]/` — Route Handlers streaming `.xlsx` via `exceljs WorkbookWriter`
7. `src/app/api/cron/` — Route Handlers for batch jobs, protected by `CRON_SECRET` header
8. `src/lib/` service layer — Pure functions: `overdue-calculator.ts`, `early-repayment.ts`, `schedule-generator.ts`, `interest.ts`

**Schema additions required:** `Organization`, `User` (new models); `organizationId` FK added to all 7 existing models; `AuditLog`, `Notification`, `LoanExtension` (new models); composite indexes `@@index([organizationId, status])` and `@@index([organizationId, createdAt])` on all tenant-scoped models.

### Critical Pitfalls

1. **Server Actions are public endpoints, not protected by middleware alone** — CVE-2025-29927 (CVSS 9.1) allows middleware bypass via header manipulation. Every Server Action must call `auth()` internally and verify session. Use `next-safe-action` `authenticatedActionClient` to enforce this structurally. The current codebase has no per-action auth checks — this must be addressed in Phase 1.

2. **Cross-tenant data exposure from manual `organizationId` filtering** — A single missing `where: { organizationId }` leaks another organization's financial data. Use `createTenantPrismaClient(organizationId)` Prisma Extension to make filtering automatic and impossible to forget. Add PostgreSQL RLS as a defense-in-depth layer. For the `findUnique` operation specifically: Prisma Extensions cannot add `where` clauses to `findUnique` — must be replaced with `findFirst` with `organizationId` condition.

3. **`organizationId` migration on existing data requires 3-step approach** — Adding a `NOT NULL` column to tables with existing data will fail. Use: (1) add column nullable, (2) backfill existing rows to a default organization, (3) add NOT NULL constraint. Do this as three separate Prisma migrations. Rehearse on staging before production.

4. **Audit log atomicity** — Recording audit logs outside the Prisma `$transaction` block means a committed financial transaction can exist without its audit record, or a failed log write can rollback a valid transaction. All audit log writes must be inside the same `$transaction` as the financial mutation. The audit log table must have INSERT-only permissions at the DB level — no UPDATE/DELETE for the application DB user.

5. **Korean regulatory compliance in early repayment fee calculation** — The 금융소비자보호법 revision (effective 2025-01-13) caps prepayment fees at actual cost (0.6–0.7% for mortgage loans); 3+ year loans are exempt entirely. Formula: `상환금액 × 수수료율 × (잔여일수 / 대출기간 일수)`. Fee rates must be stored in organization Settings (not hardcoded), with legal ceiling validation. The legal maximum interest rate is 20% (대부업법).

## Implications for Roadmap

Based on research, the dependency graph is unambiguous and directly maps to a 6-phase structure. Phase 1 is a hard blocker for everything else. Phases 3-6 can proceed in parallel after Phase 2 completes.

### Phase 1: Authentication + Multi-Tenant Foundation
**Rationale:** Every subsequent feature requires `organizationId` on every DB row and `{ userId, orgId, role }` in every session. This cannot be retrofitted — it must be complete before any feature work. Also fixes the existing CVE-2025-29927 vulnerability.
**Delivers:** Secure login/logout, session with org context, tenant-isolated Prisma client, `next-safe-action` middleware, existing actions migrated to authenticated clients, `Organization` + `User` models, all 7 existing models with `organizationId` migration
**Addresses features:** Multi-tenant isolation, Authentication/RBAC
**Avoids:** Pitfalls 1 (Server Action auth bypass), 2 (cross-tenant leak), 3 (migration failure)
**Research flag:** Standard patterns — NextAuth.js v4 + Prisma migration pattern is well-documented. No additional research needed.

### Phase 2: Audit Logging Infrastructure
**Rationale:** Audit logging is a cross-cutting concern. Implementing it before any business logic features means all subsequent mutations are automatically logged from day one. Building it after means retrofitting dozens of actions.
**Delivers:** `AuditLog` model, Prisma Extension auto-logging all mutations, `$transaction` pairing with financial operations, INSERT-only DB permissions, PII masking in log fields
**Addresses features:** Audit logging (compliance baseline)
**Avoids:** Pitfall 4 (audit log atomicity), security mistake (PII in audit logs)
**Research flag:** Standard patterns — immutable audit log in financial systems is well-established.

### Phase 3: Loan Lifecycle Extensions
**Rationale:** These are the core new business capabilities. They depend on Phase 1 (auth context) and Phase 2 (audit logging). They are independent of each other and can be built in parallel within the phase.
**Delivers:** Loan extension/renewal (`LoanExtension` model, `ExtensionDialog`, schedule recalculation from extension date, CANCELLED state for old schedules), Early repayment: partial + full (`EarlyRepaymentDialog`, legally-compliant fee calculation, payoff settlement), Batch overdue processing (`/api/cron/overdue`, `batch-actions.ts`, Vercel Cron config, manual admin trigger)
**Uses stack:** `exceljs` is not needed yet; Decimal.js (existing) for precise fee math; Vercel Cron Jobs
**Avoids:** Pitfall 5 (early repayment fee law), Pitfall 6 (loan extension schedule integrity)
**Research flag:** Early repayment fee calculation needs careful regulatory review during implementation — the 금소법 3-year exemption and residual-days formula must be unit-tested against real Korean lending scenarios.

### Phase 4: In-App Notification System
**Rationale:** Depends on Phase 3's batch overdue processing (primary notification trigger). The `Notification` model and `NotificationBell` component are low-complexity once the triggering events exist.
**Delivers:** `Notification` model, `notification-actions.ts`, `NotificationBell` component with 30-second polling (no WebSocket), notification types: `OVERDUE_NEW`, `MATURITY_APPROACHING_7D`, `PAYMENT_RECEIVED`, `LOAN_EXTENDED`, `EARLY_REPAYMENT`
**Uses stack:** Radix UI `Popover` (existing shadcn/ui), polling via `setInterval`
**Avoids:** Over-engineering with WebSocket/SSE (rejected anti-feature)
**Research flag:** Standard patterns — polling notification inbox is well-established.

### Phase 5: PDF Document Generation
**Rationale:** Depends on Phase 1 (auth for Route Handlers) and existing loan data models. PDF generation is self-contained and can be tackled as a distinct deliverable. Korean font setup is a known friction point requiring careful setup.
**Delivers:** Korean TTF font bundled in `/public/fonts/`, `@react-pdf/renderer` setup, loan contract PDF (`대출계약서`), repayment schedule PDF (`상환스케줄표`), payment receipt PDF (`수납영수증`), collateral appraisal sheet (`담보평가서`), Route Handlers `/api/pdf/[type]/[id]/`
**Uses stack:** `@react-pdf/renderer@4.3.2`, NanumGothic or Noto Sans KR TTF
**Avoids:** Pitfall: Korean font rendering failure (must bundle TTF, not rely on system fonts); Puppeteer on Vercel (rejected)
**Research flag:** Font integration needs validation — OTF format does not work, must be TTF. Variable-weight font files need separate registration per weight.

### Phase 6: Search, Export, and Dashboard Enhancements
**Rationale:** Independent of Phases 3-5 in terms of data dependencies, but logically deferred to last because it enhances existing functionality rather than adding new capabilities. All underlying data exists by this phase.
**Delivers:** Advanced search with URL-synced filters (`nuqs` + TanStack Table), Excel export for customers/loans/overdue via `/api/export/[type]/` (`exceljs`), dashboard enhancements (overdue rate trend, LTV distribution, maturity calendar using existing Recharts), dark mode (`next-themes`)
**Uses stack:** `nuqs@2.8.9`, `exceljs@4.4.0`, `next-themes@0.4.6`
**Avoids:** SheetJS/xlsx security issue (use exceljs instead)
**Research flag:** Standard patterns — all well-documented.

### Phase Ordering Rationale

- **Phase 1 is an absolute dependency**: `organizationId` must exist in the DB and session before any query can be tenant-scoped. The existing codebase has no auth at the action level — this is the highest-priority security fix.
- **Phase 2 before business logic**: Cross-cutting concerns (audit) should be infrastructure before features use it, not retrofitted after.
- **Phases 3-6 are loosely ordered**: Phase 3 must precede Phase 4 (notifications need overdue triggers), but Phase 5 (PDF) and Phase 6 (search/export) are fully independent and could be parallelized with Phase 4 if team capacity allows.
- **Research confirms no "shortcut" phases**: Multi-tenancy cannot be added incrementally — all 7 existing models need `organizationId` at once, with migration rehearsal on staging before production.

### Research Flags

Phases needing deeper research during planning:
- **Phase 3 (early repayment):** Korean regulatory formula requires legal review and test cases against real data — 3-year exemption, residual-days proportional calculation, and org-level fee rate ceiling validation
- **Phase 3 (loan extension):** Edge cases around PARTIAL-paid schedules during extension need explicit test scenarios — how is "current balance" determined when some installments are partially paid?

Phases with standard patterns (skip research-phase):
- **Phase 1:** NextAuth.js v4 + Prisma multi-tenant pattern is extensively documented and battle-tested
- **Phase 2:** Immutable audit log pattern in financial systems is a solved problem
- **Phase 4:** Polling notification inbox is straightforward
- **Phase 5:** `@react-pdf/renderer` server-side + Korean TTF is documented (font registration gotcha is known)
- **Phase 6:** nuqs + TanStack Table, exceljs, next-themes all have clear official docs

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | npm registry versions verified directly; official docs consulted for all major libraries; SheetJS security issue confirmed via GHSA; CVE-2025-29927 CVSS score verified |
| Features | HIGH | Multi-tenancy, RBAC, audit, PDF, early repayment confirmed from multiple authoritative sources; in-app notification specifics MEDIUM (polling pattern is well-established but exact polling interval is a design choice) |
| Architecture | HIGH | Based on direct codebase inspection + official Next.js, Prisma, and next-safe-action docs; Prisma Extension tenant scope pattern verified |
| Pitfalls | HIGH | CVE-2025-29927 confirmed with official CVSS rating; Korean regulatory changes (금소법) confirmed via FSC announcement; Prisma findUnique Extension limitation confirmed |

**Overall confidence:** HIGH

### Gaps to Address

- **`findUnique` in Prisma Extensions**: Prisma Client Extensions cannot intercept `findUnique` with additional `where` conditions in the same way as `findMany`. All tenant-scoped `findUnique` calls must be replaced with `findFirst` + `organizationId` condition. Identify all existing `findUnique` usages during Phase 1 migration.
- **Vercel vs self-hosted deployment decision**: Stack research covers both paths (Vercel Cron vs node-cron), but the final deployment target affects cron implementation. Confirm before Phase 3.
- **Korean font license**: NanumGothic is OFL (bundling OK), Noto Sans KR is Apache-2.0 (bundling OK). Confirm chosen font is TTF format specifically — not OTF. This is a known silent failure in `@react-pdf/renderer`.
- **next-auth v4 session type augmentation**: TypeScript `types/next-auth.d.ts` must be extended to add `organizationId` and `role` to `Session` and `JWT` types before any action uses them — otherwise TypeScript will complain at compile time. This is a Phase 1 setup task with no complex decisions, but it's easy to miss.
- **Existing data default organization**: The 3-step migration requires a "default organization" to backfill existing records. Decide on naming and slug for this org before running Phase 1 migrations.

## Sources

### Primary (HIGH confidence)
- npm registry (직접 조회) — next-auth@4.24.13, @react-pdf/renderer@4.3.2, exceljs@4.4.0, sonner@2.0.7, next-themes@0.4.6, nuqs@2.8.9, node-cron@4.2.1
- https://react-pdf.org/fonts — Font.register() official docs
- https://ui.shadcn.com/docs/components/radix/sonner — sonner shadcn/ui adoption
- https://nuqs.dev — nuqs official
- https://vercel.com/docs/cron-jobs — Vercel Cron official docs
- https://authjs.dev/guides/role-based-access-control — NextAuth.js v5 RBAC guide
- https://next-safe-action.dev/docs/define-actions/middleware — next-safe-action middleware
- https://www.prisma.io/blog/client-extensions-preview-8t3w27xkrxxn — Prisma Extensions
- https://aws.amazon.com/blogs/database/multi-tenant-data-isolation-with-postgresql-row-level-security/ — PostgreSQL RLS
- https://www.hubifi.com/blog/immutable-audit-log-guide — Immutable audit log patterns
- https://www.fsc.go.kr/po010105/82646 — 금융소비자보호 감독규정 개정 (중도상환수수료)

### Secondary (MEDIUM confidence)
- https://github.com/nextauthjs/next-auth/discussions/13382 — next-auth v5 beta status
- https://github.com/diegomura/react-pdf/issues/806 — Korean font issues in react-pdf
- https://jfrog.com/blog/cve-2025-29927-next-js-authorization-bypass/ — CVE-2025-29927 details
- https://www.permit.io/blog/postgres-rls-implementation-guide — PostgreSQL RLS common pitfalls
- https://medium.com/@kz-d/multi-tenancy-with-prisma-a-new-approach-to-making-where-required-1e93a3783d9d — Prisma findUnique extension limitation
- https://lendfoundry.com/solutions/loan-servicing-software/ — Competitor feature analysis
- https://hesfintech.com/blog/best-loan-management-software-overview/ — Loan management software landscape
- https://www.bankrate.com/mortgages/prepayment-penalty/ — Early repayment fee formula

### Tertiary (for context only)
- https://practiceguides.chambers.com/practice-guides/financial-services-regulation-2025/south-korea — Korean financial regulation context
- https://www.hankyung.com/article/2024111021901 — 중도상환수수료 2025 인하 news coverage

---
*Research completed: 2026-03-26*
*Ready for roadmap: yes*
