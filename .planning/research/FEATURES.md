# Feature Research

**Domain:** Loan Management SaaS (대출관리 시스템 — multi-tenant, Korean private lending / 대부업 context)
**Researched:** 2026-03-26
**Confidence:** HIGH (multi-tenancy, RBAC, audit, PDF, early repayment) / MEDIUM (in-app notification specifics, backup patterns)

---

## Feature Landscape

### Table Stakes (Users Expect These)

Features operators assume exist. Missing these = product feels broken or untrustworthy.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Multi-tenant organization isolation | SaaS baseline — each lender company must see only its own data; a cross-tenant data leak is fatal | HIGH | PostgreSQL RLS + `organizationId` FK on every table; Prisma middleware for automatic scoping; three models exist (silo/bridge/pool) — pool + RLS is standard for this scale |
| Role-based access control (admin / staff) | Financial staff must not perform destructive actions (delete customer, change interest rate); admin is accountable | MEDIUM | Two roles sufficient for v1: `ADMIN` (full) and `STAFF` (read + payment entry, no settings/delete); NextAuth.js session carries role; middleware guards routes and Server Actions |
| Audit logging for all financial mutations | Legal / compliance baseline in Korean financial regulations (대부업법, 개인정보보호법); also required to investigate disputes | HIGH | Immutable append-only `AuditLog` table: `(id, orgId, userId, action, entity, entityId, before, after, ip, createdAt)`; write on every Server Action that mutates data; no UPDATE/DELETE on audit rows |
| PDF document generation — loan contract | Borrowers and lenders legally require a signed paper contract; "where's my contract?" is the first question | HIGH | Korean-language template; must include: borrower info (masked), loan amount, term, rate, repayment schedule summary, collateral description, legal rate notice (법정최고금리 20%) |
| PDF — repayment schedule table (상환스케줄표) | Borrowers want to see the full schedule; lenders review it; required for dispute resolution | MEDIUM | Full amortization table: date, principal, interest, overdue fee, balance per row; all three repayment types (만기일시/원금균등/원리금균등) |
| PDF — payment receipt (수납영수증) | Issued at each payment; legal record of what was received | MEDIUM | Per-payment: amount paid, principal/interest/overdue breakdown, remaining balance, date, cashier name |
| Batch overdue processing | Loans become overdue at midnight; manual status checking for 100s of loans is impossible | MEDIUM | Daily cron (or manual trigger for v1): find all loans where `dueDate < today AND status != OVERDUE AND remainingBalance > 0`; advance overdue stage (정상→1단계→2단계→3단계); record in audit log |
| Loan extension / renewal | Private lenders routinely roll over loans at maturity; without this, lenders must close and re-create the loan | HIGH | Preserve loan history; create new `LoanExtension` record with old/new terms; recalculate schedule from extension date; any accrued overdue interest must be settled or rolled; audit trail required |
| Early repayment — full (전액중도상환) | Borrowers pay off early; system must close the loan cleanly | MEDIUM | Calculate outstanding principal + accrued interest to payoff date + prepayment fee (if configured); close loan; generate settlement receipt; mark collateral as releasable |
| Early repayment — partial (일부중도상환) | Common; reduces balance but loan continues | MEDIUM | Apply payment to principal first (after any overdue/interest cleared); recalculate remaining schedule from payment date; emit audit event |
| Advanced search and filtering | Operators manage hundreds of loans; "find overdue loans above 50M KRW maturing this month" is daily work | MEDIUM | Date range, amount range, status multi-select, customer name/ID, overdue stage; server-side filtered queries (not client-side); TanStack Table already in stack |
| Excel export | Financial reporting, tax submission, internal review — Korean business culture requires Excel | LOW | `xlsx` or `exceljs` library; export columns match current table view; org-scoped; no PII without masking |
| Customer memo / history tracking | Loan officers record calls, promises, collateral visits; without this they use sticky notes | MEDIUM | `CustomerNote` table: `(id, orgId, customerId, authorId, content, createdAt)`; timeline view on customer detail page; soft-delete only |

---

### Differentiators (Competitive Advantage)

Features that set this product apart. Not universally expected, but create retention.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| In-app notification system (bell icon, unread count) | Staff sees overdue alerts, upcoming maturity, recent payments without refreshing — reduces missed follow-ups | MEDIUM | `Notification` table: `(id, orgId, userId, type, message, entityId, read, createdAt)`; Server Action creates notification on trigger events; polling or SSE for real-time feel; notification types: OVERDUE_NEW, MATURITY_APPROACHING, PAYMENT_RECEIVED, EXTENSION_DONE |
| PDF — collateral appraisal sheet (담보평가서) | Differentiates from simple loan trackers; supports formal lending paperwork | MEDIUM | Property address, appraisal value, LTV %, mortgage rank, registration details; requires collateral and mortgage data already in DB |
| Prepayment fee configuration per loan | Some lenders charge, some don't; configurable > hardcoded | LOW | Add `prepaymentFeeRate` (nullable) to `Loan` or `Setting`; display fee estimate before confirming early repayment |
| Dashboard enhancement — overdue rate trend, LTV distribution, maturity calendar | Turns data into decisions; most competitors show static KPIs only | MEDIUM | Recharts already in stack; maturity calendar (loans due in next 30/60/90 days); overdue % trend over 12 months; LTV histogram |
| Overdue interest auto-calculation on repayment | Most simple systems just flag overdue; calculating the exact penalty interest owed at payment time is hard and error-prone manually | HIGH | Must compute: days overdue × daily overdue rate × remaining principal; Decimal.js already in stack for precision |
| Data backup / restore (tenant-level export) | Gives SaaS tenants confidence they can leave or recover; "can I export all my data?" is a trust question | MEDIUM | Admin-triggered full export of org data as JSON or CSV archive; restore from export for data migration; PostgreSQL `pg_dump` subset for infra-level backups |
| Dark mode | Modern UX expectation in Korean B2B apps; reduces eye strain for evening processing | LOW | Tailwind `dark:` variants; next-themes library; persist preference in localStorage or user profile |
| Mobile optimization | Loan officers visit collateral sites; mobile access for quick lookups | MEDIUM | Responsive Tailwind layouts; not a native app — responsive web is sufficient |

---

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Real-time push notifications (WebSocket / SSE for every event) | Feels modern; staff want instant alerts | Significant infrastructure complexity (connection management, pub/sub); for internal staff tool, 30-second polling on notification count is imperceptible | Polling endpoint `GET /api/notifications/count` every 30s; mark as read on bell open |
| SMS / email notification dispatch | "Just send a text to the borrower" | Requires KCP/NICE/Aligo API integration, sender registration, template approval, cost per message; out of scope per PROJECT.md; scope creep risk | In-app notification for staff; SMS integration is a defined future milestone |
| Customer self-service portal | Borrowers want to see their balance | Doubles the auth surface, requires borrower identity verification (본인인증), entirely different UX; explicitly out of scope | Staff-facing only per PROJECT.md; future product extension |
| Soft-delete everything with full undo | "What if I accidentally delete?" | Complicates all queries (must filter `deletedAt IS NULL` everywhere); audit log already provides the recovery record | Audit log + confirmation dialogs before destructive actions; no soft-delete on financial records, only on notes/memos |
| Per-column encryption for all fields | "Encrypt everything for compliance" | AES-256-GCM on RRN/BRN already covers legal requirements (개인정보보호법); encrypting all fields kills query performance and search | Keep encryption scoped to PII fields (주민번호, 사업자번호) only — existing approach is correct |
| AI credit scoring / risk decisioning | "Add AI to make lending decisions" | Requires training data, regulatory approval under Korean financial law, liability questions; far exceeds scope | Manual overdue-stage tracking and LTV-based risk indicators already in system |
| OAuth / social login | "Let staff log in with Google/Kakao" | Requires organization-scoped consent flows, complicates multi-tenant session binding; out of scope per PROJECT.md | Username + password via NextAuth.js Credentials provider is correct for internal B2B tool |

---

## Feature Dependencies

```
[Multi-tenant organization isolation]
    └──required by──> ALL other features
                       (every query, every action must be org-scoped)

[Authentication / RBAC]
    └──required by──> Audit Logging
    └──required by──> In-app Notifications (per-user read state)
    └──required by──> PDF generation (author name on docs)
    └──required by──> Customer Memo (author tracking)

[Loan (existing)]
    └──required by──> Batch Overdue Processing
    └──required by──> Loan Extension / Renewal
    └──required by──> Early Repayment (partial + full)
    └──required by──> PDF — Repayment Schedule
    └──required by──> PDF — Contract
    └──required by──> Advanced Search (loan filters)

[Payment (existing)]
    └──required by──> PDF — Receipt
    └──required by──> Early Repayment (applies payment, settles)
    └──required by──> In-app Notification (PAYMENT_RECEIVED trigger)

[Batch Overdue Processing]
    └──enhances──> In-app Notifications (OVERDUE_NEW trigger)
    └──enhances──> Dashboard — overdue trend data

[Loan Extension / Renewal]
    └──requires──> Audit Logging (term change must be traceable)
    └──enhances──> In-app Notifications (EXTENSION_DONE trigger)

[Early Repayment]
    └──requires──> Prepayment fee config (optional, but must handle null)
    └──produces──> PDF — Settlement Receipt (variant of payment receipt)

[Advanced Search / Filter]
    └──enhances──> Excel Export (filtered result exported)

[Customer Memo / History]
    └──requires──> Authentication (author = current user)
    └──enhances──> Customer detail page
```

### Dependency Notes

- **Multi-tenancy is the critical path blocker**: it must be implemented before any other feature goes to production. An `organizationId` column must be on every new table, and Prisma middleware must enforce org scoping globally. Building any feature before this is done means retrofitting.
- **Authentication / RBAC unlocks parallel development**: once session carries `userId`, `orgId`, and `role`, all other features can be built in parallel without dependency conflicts.
- **Audit logging is a cross-cutting concern**: it should be implemented as a shared utility (e.g., `createAuditLog(ctx, action, entity, id, before, after)`) called from every Server Action, not built per-feature.
- **Batch overdue processing and in-app notifications are loosely coupled**: overdue batch can run without notifications, but notifications significantly increase the value of batch processing.
- **Loan extension conflicts with creating a new loan**: the UI must make it explicit that an extension preserves loan history vs. closure-and-new-origination.

---

## MVP Definition (for this milestone)

This is a subsequent milestone on an existing working system. "MVP" here means the minimum set to make the system production-usable for multiple tenant organizations.

### Launch With (v1 — this milestone)

- [x] Multi-tenant organization isolation — without this, nothing else is shippable
- [x] Authentication (NextAuth.js) + RBAC (admin/staff roles) — required for all other features
- [x] Audit logging — financial systems without audit trails are non-compliant
- [x] PDF: loan contract + repayment schedule + payment receipt — operators need documents on day one
- [x] Batch overdue processing — daily overdue state must be accurate
- [x] Loan extension / renewal — critical operational workflow
- [x] Early repayment (partial + full) with fee calculation — required for loan lifecycle completeness
- [x] Advanced search + filtering — necessary for any portfolio above 20 loans
- [x] Excel export — non-negotiable for Korean B2B operators
- [x] Customer memo / history — basic CRM capability expected

### Add After Validation (v1.x)

- [ ] In-app notification system — improves UX significantly; polling approach is viable for v1.x without WebSocket complexity
- [ ] PDF: collateral appraisal sheet — useful but operators can use existing contract for now
- [ ] Dashboard enhancement (overdue trend, LTV distribution, maturity calendar) — enhances the existing dashboard
- [ ] Data backup / restore (tenant export) — trust feature; add once tenants exist
- [ ] Dark mode — low complexity; add when core is stable

### Future Consideration (v2+)

- [ ] Mobile optimization — full responsive audit; defer until core features are stable
- [ ] SMS notification dispatch — defined future milestone in PROJECT.md; requires telco API registration
- [ ] AI-assisted risk indicators — post-PMF feature

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Multi-tenant isolation | HIGH | HIGH | P1 |
| Authentication + RBAC | HIGH | MEDIUM | P1 |
| Audit logging | HIGH | MEDIUM | P1 |
| PDF contract + schedule + receipt | HIGH | HIGH | P1 |
| Batch overdue processing | HIGH | MEDIUM | P1 |
| Loan extension / renewal | HIGH | HIGH | P1 |
| Early repayment (partial + full) | HIGH | MEDIUM | P1 |
| Advanced search + filtering | HIGH | MEDIUM | P1 |
| Excel export | HIGH | LOW | P1 |
| Customer memo / history | MEDIUM | LOW | P1 |
| In-app notification system | MEDIUM | MEDIUM | P2 |
| PDF collateral appraisal sheet | MEDIUM | MEDIUM | P2 |
| Dashboard enhancement | MEDIUM | MEDIUM | P2 |
| Data backup / restore | MEDIUM | MEDIUM | P2 |
| Dark mode | LOW | LOW | P2 |
| Mobile optimization | MEDIUM | HIGH | P3 |

**Priority key:**
- P1: Must have for launch (this milestone)
- P2: Should have, add when possible (v1.x)
- P3: Nice to have, future consideration (v2+)

---

## Feature-Specific Implementation Notes

### Multi-tenant Organization Isolation

**Standard pattern (MEDIUM confidence — multiple authoritative sources):**
Pool model (shared DB, shared schema) + PostgreSQL Row Level Security (RLS) is the standard approach at this scale. Prisma does not natively propagate RLS session variables, so the practical pattern for Next.js + Prisma is:
1. Add `organizationId` to every table
2. Prisma middleware that injects `WHERE organizationId = currentOrgId` on all queries
3. RLS as a defense-in-depth layer (protects against middleware bugs)
4. New tables: `Organization`, `OrganizationMember`, updated `User` to belong to an org

Do not use schema-per-tenant (bridge model) — Prisma migration tooling does not handle per-schema migrations well at runtime.

### Authentication / RBAC

**Standard pattern (HIGH confidence):**
NextAuth.js Credentials provider (already decided in PROJECT.md). Session must carry `{ userId, orgId, role }`. Two roles sufficient for v1: `ADMIN` and `STAFF`. Route middleware (Next.js `middleware.ts`) enforces auth; Server Action wrappers enforce role.

RBAC matrix for v1:

| Action | ADMIN | STAFF |
|--------|-------|-------|
| View customers, loans, payments | Yes | Yes |
| Create/edit customer, loan | Yes | Yes |
| Record payment | Yes | Yes |
| Delete customer/loan | Yes | No |
| Manage system settings | Yes | No |
| View audit logs | Yes | No |
| Manage users / invite staff | Yes | No |
| Export data | Yes | Yes |

### Audit Logging

**Requirements (HIGH confidence — financial compliance standard):**
- Append-only table — no UPDATE or DELETE permissions on `AuditLog` at application level
- Fields: `id`, `organizationId`, `userId`, `action` (CREATE/UPDATE/DELETE/LOGIN/EXPORT), `entityType`, `entityId`, `valueBefore` (JSON), `valueAfter` (JSON), `ipAddress`, `createdAt`
- Log every Server Action that mutates financial data
- Sensitive fields (주민번호) must be masked in `valueBefore`/`valueAfter` — log the encrypted form only
- Retention: 5+ years recommended for Korean financial record-keeping

### PDF Document Generation

**Implementation approach (MEDIUM confidence — based on Next.js ecosystem):**
- `@react-pdf/renderer` (React-PDF) is the dominant choice for Next.js — renders React components to PDF server-side
- Alternative: Puppeteer/headless Chrome rendering an HTML template — higher fidelity for complex layouts but heavier dependency
- Recommendation: `@react-pdf/renderer` for straightforward tabular documents (schedule, receipt); consider Puppeteer only if layout requirements become complex
- Korean font: must bundle a Korean TTF (NanumGothic or Noto Sans KR) — `@react-pdf/renderer` requires explicit font registration
- Documents generated server-side (Server Action or API route), streamed as `application/pdf` response

### Batch Overdue Processing

**Pattern (HIGH confidence):**
- For v1: manual "Run overdue check" button for admin + daily cron via Vercel Cron Jobs or `node-cron` if self-hosted
- Logic: `SELECT loans WHERE nextDueDate < NOW() AND status IN ('ACTIVE', 'OVERDUE_STAGE_1', 'OVERDUE_STAGE_2') AND paidToDate < totalDue`
- Advance overdue stage per configured rules (existing 4-stage system)
- Create `AuditLog` entry per affected loan
- Create `Notification` entries for assigned staff (if notification system is live)
- Run inside a DB transaction — partial batch failure must not leave inconsistent state

### Loan Extension / Renewal

**Standard behavior (HIGH confidence):**
1. Record current loan state in audit log
2. Settle or roll any accrued overdue interest (must not disappear)
3. Create `LoanExtension` record: `{ loanId, previousMaturityDate, newMaturityDate, previousRate, newRate, extensionFee, createdBy, createdAt }`
4. Recalculate `LoanSchedule` from extension date with new terms
5. Loan status resets to ACTIVE if was OVERDUE (overdue interest must be settled first)
6. Generate new PDF contract reflecting extended terms (optional but recommended)

### Early Repayment Fee Calculation

**Standard formula (HIGH confidence):**
```
prepaymentFee = remainingPrincipal × prepaymentFeeRate × (remainingDays / 365)
```
OR flat percentage: `remainingPrincipal × feeRate`

Korean 대부업법 context: prepayment fee is legally permissible but must be disclosed in the contract. Fee rate is configurable per loan or globally in settings. The system must show the calculated fee to the operator before confirming.

For full early repayment:
```
totalPayoff = remainingPrincipal + accruedInterest(toPayoffDate) + overdueInterest(ifAny) + prepaymentFee
```

### In-App Notification System

**Recommended pattern (MEDIUM confidence):**
Simple polling is sufficient — financial staff tool, not a chat app.
- `Notification` table: `{ id, organizationId, userId, type, title, message, entityType, entityId, read, createdAt }`
- Bell icon in nav: polls `GET /api/notifications/unread-count` every 30 seconds
- Bell dropdown: loads last 20 notifications on open
- Mark-as-read on click (navigates to entity)
- Notification types: `OVERDUE_NEW`, `MATURITY_APPROACHING_7D`, `MATURITY_APPROACHING_30D`, `PAYMENT_RECEIVED`, `LOAN_EXTENDED`, `EARLY_REPAYMENT`

Do not build WebSocket/SSE for v1 — polling is sufficient and avoids connection management complexity.

### Excel Export

**Library (HIGH confidence):**
`xlsx` (SheetJS) is the de-facto standard for Node.js Excel generation. `exceljs` is the alternative with more styling control. For simple tabular exports, `xlsx` is sufficient and has zero native dependencies.

Export scope: filtered result of current view (not full org dump unless admin explicitly requests). Include column headers in Korean. Mask 주민번호 to last 7 digits obscured (e.g., `880101-*******`).

### Data Backup / Restore

**Pattern for v1 (MEDIUM confidence):**
- Admin-triggered JSON export of all org data (full tenant export)
- Server-side: query all org tables, serialize to JSON, zip, download
- Infrastructure backup: `pg_dump` scheduled daily — responsibility of deployment environment (Vercel Postgres, Railway, Supabase all provide this automatically)
- Restore: import JSON archive to a fresh org — useful for migration or disaster recovery
- Do not build a full point-in-time recovery UI for v1; that is the infrastructure provider's responsibility

---

## Competitor Feature Analysis

| Feature | LendFoundry | Margill Loan Manager | Our Approach |
|---------|-------------|---------------------|--------------|
| Multi-tenancy | Native SaaS (full isolation) | Desktop app (single tenant) | Pool model + Prisma middleware + RLS |
| RBAC | Configurable roles | Role-based | Admin / Staff (2 roles for v1) |
| Audit logging | Yes (compliance grade) | Yes | Append-only DB table, all mutations |
| PDF generation | Yes (template-based) | Yes (report-based) | `@react-pdf/renderer` with Korean fonts |
| Notifications | Email + SMS + in-app | Email alerts | In-app polling (SMS in future milestone) |
| Batch overdue | Automated (scheduled) | Manual + scheduled | Cron + manual trigger for v1 |
| Loan extension | Configurable modifications | Yes | `LoanExtension` record + recalculate schedule |
| Early repayment | Yes with fee calculation | Yes | Configurable fee rate + full payoff calculation |
| Excel export | Yes | Yes | `xlsx` library, filtered exports |
| Customer notes | CRM-style | Notes field | `CustomerNote` timeline view |
| Data backup | Cloud-managed | Manual export | Admin JSON export + infra-level pg_dump |

---

## Sources

- LendFoundry Loan Servicing Software — https://lendfoundry.com/solutions/loan-servicing-software/ (MEDIUM confidence)
- LendFoundry Loan Modifications Guide — https://lendfoundry.com/solutions/loan-servicing-software/loan-modifications/ (MEDIUM confidence)
- HES Fintech Best Loan Management Software 2026 — https://hesfintech.com/blog/best-loan-management-software-overview/ (MEDIUM confidence)
- AWS Blog: Multi-tenant data isolation with PostgreSQL RLS — https://aws.amazon.com/blogs/database/multi-tenant-data-isolation-with-postgresql-row-level-security/ (HIGH confidence)
- Permit.io: Postgres RLS Implementation Guide — https://www.permit.io/blog/postgres-rls-implementation-guide (MEDIUM confidence)
- Bankrate: Prepayment Penalty — https://www.bankrate.com/mortgages/prepayment-penalty/ (HIGH confidence)
- HubiFi: Immutable Audit Log Guide — https://www.hubifi.com/blog/immutable-audit-log-guide (HIGH confidence)
- Chambers and Partners: Financial Services Regulation 2025 South Korea — https://practiceguides.chambers.com/practice-guides/financial-services-regulation-2025/south-korea (MEDIUM confidence)
- Bryt Software: Loan Management Workflows — https://www.brytsoftware.com/a-comprehensive-guide-to-loan-management-system-workflows/ (MEDIUM confidence)
- AblePlatform: Top Loan Management Software 2026 — https://ableplatform.io/top-loan-management-software-providers/ (MEDIUM confidence)
- Korean Lending Business Act (대부업법) — maximum interest rate 20% as of 2025 (verified via PROJECT.md constraint)

---

*Feature research for: 대출관리 SaaS 시스템 고도화*
*Researched: 2026-03-26*
