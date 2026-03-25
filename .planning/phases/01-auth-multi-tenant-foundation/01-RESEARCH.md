# Phase 1: Auth + Multi-Tenant Foundation - Research

**Researched:** 2026-03-26
**Domain:** NextAuth.js v4, Prisma Client Extension, next-safe-action, Multi-Tenant RBAC
**Confidence:** HIGH

## Summary

Phase 1 adds Organization/User models to an existing Next.js 14 + Prisma + PostgreSQL codebase, migrates all 7 existing models to include `organizationId`, implements NextAuth.js v4.24.13 credential authentication, enforces tenant isolation via Prisma Client Extension, and applies role-based access control (ADMIN/STAFF) through next-safe-action middleware.

The core challenge is **safe migration of live data**: the 3-step nullable → backfill → NOT NULL migration must succeed without data loss. A secondary challenge is **tenant isolation completeness**: every query path (findMany, findFirst, count, create, update, delete) must be covered by the Prisma Extension — manual per-query filtering is not acceptable.

The locked stack is: next-auth@4.24.13, @auth/prisma-adapter, bcrypt, next-safe-action. All are confirmed current against npm registry (as of 2026-03-26).

**Primary recommendation:** Implement Prisma Client Extension as the single source of truth for tenant scoping. All Server Actions become `authenticatedAction` or `adminAction` via next-safe-action middleware, receiving `{ userId, organizationId, role }` from the safe-action context — never re-reading session inside action bodies.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- 중앙 카드형 로그인 폼 (표준 B2B 패턴)
- 비밀번호 최소 8자, 영문+숫자 조합
- 로그인 실패 시 "아이디 또는 비밀번호가 올바르지 않습니다" 통합 메시지 (보안)
- v1에서 비밀번호 찾기 기능 제외 (관리자가 리셋)
- 기존 데이터는 "기본 조직" (Default Organization)으로 마이그레이션
- 고객번호(C-NNNN)는 조직별 독립 채번 (각 조직 C-0001부터)
- Setting 테이블에 organizationId 추가하여 조직별 독립 설정
- v1에서 슈퍼 관리자(SUPER_ADMIN) 역할 불필요 — 조직 ADMIN이 최상위
- 관리자가 직접 계정 생성 (이름, 아이디, 임시 비밀번호 설정)
- 사용자 관리 페이지는 설정 > 사용자 관리 하위에 배치
- 사용자 본인이 설정에서 비밀번호 변경 가능
- 사용자 비활성화는 isActive 플래그 (소프트 비활성화, 데이터 보존)
- NextAuth.js v4.24.13 사용 (v5 beta 아님)
- next-safe-action으로 모든 Server Action 인증 래핑 (CVE-2025-29927 대응)
- Prisma Client Extension으로 자동 organizationId 필터링
- findUnique → findFirst 변환 필요 (Extension이 findUnique의 where에 조건 추가 불가)
- 비밀번호 해싱: bcrypt 사용

### Claude's Discretion
- Prisma Client Extension 구현 세부사항
- next-safe-action 미들웨어 계층 구조
- 3단계 마이그레이션 (nullable → backfill → NOT NULL) 상세 전략
- TypeScript 타입 확장 (next-auth.d.ts)

### Deferred Ideas (OUT OF SCOPE)
- 슈퍼 관리자(SUPER_ADMIN) 역할 — 현재 조직 ADMIN이면 충분
- 이메일 초대 링크 — 내부 시스템이므로 직접 계정 생성
- 비밀번호 찾기 기능 — v1에서는 관리자 리셋으로 대체
- 계정 잠금 기능 (N회 실패 후) — v2 고려
- PostgreSQL RLS — Prisma Extension이 1차 방어, RLS는 추후 defense-in-depth
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| TENANT-01 | 조직(Organization) 생성 및 관리 (이름, 슬러그, 설정) | Organization model schema + seed for Default Org |
| TENANT-02 | 모든 데이터가 조직별로 격리되어 다른 조직의 데이터에 접근 불가 | Prisma Extension query interceptor + authenticatedAction organizationId injection |
| TENANT-03 | Prisma Client Extension으로 자동 organizationId 필터링 | `$extends` with `query.{model}.findMany/findFirst/count/create/update/delete` interceptors |
| TENANT-04 | 기존 데이터를 기본 조직으로 마이그레이션 (3단계: nullable→backfill→NOT NULL) | 3-step migration pattern: migration 1 (nullable FK) → seed/backfill script → migration 2 (NOT NULL) |
| TENANT-05 | 조직별 시스템 설정 (최대 LTV, 기본금리, 법정최고금리, 연체가산금리 등) | Setting model gets organizationId; unique constraint on (key, organizationId) |
| AUTH-01 | 사용자가 아이디/비밀번호로 로그인할 수 있다 (NextAuth.js) | CredentialsProvider + bcrypt.compare |
| AUTH-02 | 사용자 세션에 userId, organizationId, role이 포함된다 | jwt() + session() callbacks in NextAuth config; next-auth.d.ts type extension |
| AUTH-03 | 관리자(ADMIN)는 모든 기능에 접근할 수 있다 | adminAction middleware: role === 'ADMIN' check |
| AUTH-04 | 직원(STAFF)은 조회/생성/수납만 가능하고 삭제/설정 변경은 불가하다 | staffAction middleware: role === 'STAFF' blocks delete/settings mutations |
| AUTH-05 | 관리자가 조직 내 사용자를 초대/관리할 수 있다 | Admin-only user management page under /settings/users |
| AUTH-06 | 모든 Server Action이 인증을 검증한다 (next-safe-action) | Replace raw "use server" functions with actionClient.use(authMiddleware) |
| AUTH-07 | 로그아웃 시 세션이 완전히 종료된다 | `signOut({ callbackUrl: '/login' })` + middleware redirect on missing session |
</phase_requirements>

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| next-auth | 4.24.13 | 세션 기반 인증, CredentialsProvider | Locked decision; v4 stable, Next.js 14 호환 |
| @auth/prisma-adapter | 2.11.1 | Prisma 세션/User/Account DB 연동 | v4 공식 어댑터; v2.x (not v1.x) |
| bcryptjs | 3.0.3 | 비밀번호 해싱/검증 | bcryptjs는 순수 JS로 native 빌드 불필요; bcrypt@6.0.0도 사용 가능하나 bcryptjs가 Vercel 환경에서 더 안정적 |
| next-safe-action | 8.1.8 | Server Action 인증 미들웨어 | CVE-2025-29927 대응; typesafe action with middleware chain |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @types/bcryptjs | latest | TypeScript 타입 | bcryptjs 사용 시 필수 |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| next-auth v4 | next-auth v5 | v5 beta; locked out by user decision |
| bcryptjs | bcrypt | bcrypt requires native build; bcryptjs is pure JS — safer for serverless |
| next-safe-action | manual session check | CVE-2025-29927: middleware.ts auth can be bypassed; safe-action prevents this |

**Installation:**
```bash
npm install next-auth@4.24.13 @auth/prisma-adapter@^2.11.1 bcryptjs next-safe-action
npm install -D @types/bcryptjs
```

**Version verification (confirmed 2026-03-26):**
- next-auth: 4.24.13 (npm view next-auth version)
- @auth/prisma-adapter: 2.11.1 (npm view @auth/prisma-adapter version)
- next-safe-action: 8.1.8 (npm view next-safe-action version)
- bcryptjs: 3.0.3 (npm view bcryptjs version)

---

## Architecture Patterns

### Recommended Project Structure
```
src/
├── app/
│   ├── (auth)/
│   │   └── login/
│   │       └── page.tsx          # 로그인 페이지 (중앙 카드형)
│   ├── (main)/
│   │   └── settings/
│   │       └── users/
│   │           ├── page.tsx      # 사용자 목록 (ADMIN only)
│   │           └── [id]/
│   │               └── page.tsx  # 사용자 상세/수정
│   └── api/
│       └── auth/
│           └── [...nextauth]/
│               └── route.ts      # NextAuth API route
├── lib/
│   ├── prisma.ts                 # Prisma singleton + tenant extension
│   ├── auth.ts                   # NextAuth config (authOptions)
│   └── safe-action.ts            # actionClient 정의 + middleware
├── actions/
│   ├── auth-actions.ts           # 기존 actions (migrate to safe-action)
│   ├── user-actions.ts           # 사용자 관리 (ADMIN only)
│   └── [기존 actions 래핑]
├── middleware.ts                 # Next.js route protection
└── types/
    └── next-auth.d.ts            # Session 타입 확장
```

### Pattern 1: Prisma Client Extension for Tenant Scoping

**What:** `$extends` query interceptor가 모든 모델 작업에 자동으로 `organizationId` 필터를 주입한다. 런타임에 `organizationId`를 바인딩하여 per-request scoped client를 생성한다.

**When to use:** 모든 인증된 Server Action / Server Component 데이터 접근 시

**Key constraint:** `findUnique`는 Extension이 `where` 조건을 추가할 수 없으므로 모두 `findFirst`로 대체해야 한다. (confirmed in STATE.md blockers)

```typescript
// src/lib/prisma.ts
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
  return new PrismaClient({ adapter });
}

const basePrisma = globalForPrisma.prisma ?? createPrismaClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = basePrisma;

// Tenant-scoped client factory — call per request with session.organizationId
export function getTenantClient(organizationId: string) {
  return basePrisma.$extends({
    query: {
      $allModels: {
        async findMany({ args, query }) {
          args.where = { ...args.where, organizationId };
          return query(args);
        },
        async findFirst({ args, query }) {
          args.where = { ...args.where, organizationId };
          return query(args);
        },
        async count({ args, query }) {
          args.where = { ...args.where, organizationId };
          return query(args);
        },
        async create({ args, query }) {
          args.data = { ...args.data, organizationId };
          return query(args);
        },
        async update({ args, query }) {
          args.where = { ...args.where, organizationId };
          return query(args);
        },
        async delete({ args, query }) {
          args.where = { ...args.where, organizationId };
          return query(args);
        },
      },
    },
  });
}

export { basePrisma as prisma };
```

### Pattern 2: NextAuth.js v4 CredentialsProvider + Session Typing

```typescript
// src/lib/auth.ts
import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        username: { label: "아이디", type: "text" },
        password: { label: "비밀번호", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password) return null;

        const user = await prisma.user.findFirst({
          where: { username: credentials.username, isActive: true },
          include: { organization: true },
        });

        if (!user) return null;

        const valid = await bcrypt.compare(credentials.password, user.passwordHash);
        if (!valid) return null;

        return {
          id: user.id,
          name: user.name,
          organizationId: user.organizationId,
          role: user.role,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.userId = user.id;
        token.organizationId = (user as any).organizationId;
        token.role = (user as any).role;
      }
      return token;
    },
    async session({ session, token }) {
      session.user.userId = token.userId as string;
      session.user.organizationId = token.organizationId as string;
      session.user.role = token.role as string;
      return session;
    },
  },
};
```

```typescript
// src/types/next-auth.d.ts
import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    user: {
      userId: string;
      organizationId: string;
      role: "ADMIN" | "STAFF";
      name?: string | null;
    };
  }
  interface User {
    organizationId: string;
    role: "ADMIN" | "STAFF";
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    userId: string;
    organizationId: string;
    role: "ADMIN" | "STAFF";
  }
}
```

### Pattern 3: next-safe-action Middleware Chain

```typescript
// src/lib/safe-action.ts
import { createSafeActionClient } from "next-safe-action";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getTenantClient } from "@/lib/prisma";
import { z } from "zod";

// Base client — unauthenticated (for login only)
export const actionClient = createSafeActionClient();

// Authenticated client — all users
export const authenticatedAction = createSafeActionClient()
  .use(async ({ next }) => {
    const session = await getServerSession(authOptions);
    if (!session?.user?.userId) {
      throw new Error("인증이 필요합니다.");
    }
    const db = getTenantClient(session.user.organizationId);
    return next({
      ctx: {
        userId: session.user.userId,
        organizationId: session.user.organizationId,
        role: session.user.role,
        db,
      },
    });
  });

// Admin-only client
export const adminAction = createSafeActionClient()
  .use(async ({ next }) => {
    const session = await getServerSession(authOptions);
    if (!session?.user?.userId) {
      throw new Error("인증이 필요합니다.");
    }
    if (session.user.role !== "ADMIN") {
      throw new Error("관리자 권한이 필요합니다.");
    }
    const db = getTenantClient(session.user.organizationId);
    return next({
      ctx: {
        userId: session.user.userId,
        organizationId: session.user.organizationId,
        role: "ADMIN" as const,
        db,
      },
    });
  });
```

```typescript
// Example: migrated customer action
// src/actions/customer-actions.ts
import { authenticatedAction, adminAction } from "@/lib/safe-action";
import { z } from "zod";

export const deleteCustomer = adminAction
  .schema(z.object({ id: z.string() }))
  .action(async ({ parsedInput: { id }, ctx: { db } }) => {
    const loans = await db.loan.count({
      where: { customerId: id, status: { in: ["ACTIVE", "OVERDUE"] } },
    });
    if (loans > 0) {
      throw new Error("활성 대출이 있는 고객은 삭제할 수 없습니다.");
    }
    await db.customer.delete({ where: { id } });
    revalidatePath("/customers");
    return { success: true };
  });
```

### Pattern 4: 3-Step Migration Strategy (TENANT-04)

```
Migration 1: Add organizationId as nullable FK
  ALTER TABLE customers ADD COLUMN "organizationId" TEXT REFERENCES organizations(id);
  (same for collaterals, mortgages, loans, loan_schedules, payments, settings)

Backfill script (run in application code, not migration):
  UPDATE customers SET "organizationId" = '<default-org-id>' WHERE "organizationId" IS NULL;
  (repeat for all 7 tables)

Migration 2: Set NOT NULL constraint
  ALTER TABLE customers ALTER COLUMN "organizationId" SET NOT NULL;
  (repeat for all 7 tables)
```

**Prisma approach:** Use two separate `prisma migrate dev` invocations with a seed/backfill script in between. Never combine nullable add + NOT NULL in a single migration when live data exists.

### Pattern 5: Prisma Schema — New Models

```prisma
model Organization {
  id        String   @id @default(cuid())
  name      String
  slug      String   @unique
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  users     User[]
  customers Customer[]
  // ... all other models get organizationId relation

  @@map("organizations")
}

model User {
  id             String       @id @default(cuid())
  organizationId String
  organization   Organization @relation(fields: [organizationId], references: [id])
  username       String       @unique
  passwordHash   String
  name           String
  role           String       @default("STAFF") // ADMIN, STAFF
  isActive       Boolean      @default(true)
  createdAt      DateTime     @default(now())
  updatedAt      DateTime     @updatedAt

  @@map("users")
}
```

**Customer model modification:**
```prisma
model Customer {
  id             String       @id @default(cuid())
  organizationId String
  organization   Organization @relation(fields: [organizationId], references: [id])
  // ... existing fields unchanged
  customerNumber String       // Remove @unique — becomes unique per org, not globally
  // ...
  @@unique([organizationId, customerNumber])  // org-scoped uniqueness
  @@map("customers")
}
```

**Setting model modification:**
```prisma
model Setting {
  id             String       @id @default(cuid())
  organizationId String
  organization   Organization @relation(fields: [organizationId], references: [id])
  key            String
  value          String
  label          String?
  @@unique([organizationId, key])  // was: @unique on key alone
  @@map("settings")
}
```

### Anti-Patterns to Avoid

- **Global unique on customerNumber:** The existing `@unique` on `Customer.customerNumber` must be replaced with `@@unique([organizationId, customerNumber])` — otherwise org-1's C-0001 conflicts with org-2's C-0001.
- **findUnique in Prisma Extension context:** Extension cannot add `where` conditions to `findUnique`. Every `findUnique` call must become `findFirst` after adding organizationId to schema.
- **Re-reading session inside action body:** Always get `organizationId` from `ctx` provided by safe-action middleware. Never call `getServerSession()` inside action implementations.
- **`$allModels` extension covering User model:** The User model should NOT be filtered by organizationId at Extension level — admin user lookup during auth needs cross-org access. Exclude `User` from extension or use a bypass mechanism.
- **JWT strategy with database adapter:** When using CredentialsProvider, must use `session: { strategy: "jwt" }`. The default database session strategy does not work with CredentialsProvider.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| 비밀번호 해싱 | 자체 해시 함수 | bcryptjs | Salt rounds, timing attacks, rainbow table 방어 |
| Server Action 인증 검사 | 각 action에 수동 session check | next-safe-action middleware | CVE-2025-29927: `x-middleware-subrequest` 헤더로 middleware 우회 가능 |
| Tenant isolation | 각 쿼리에 수동 `organizationId` 추가 | Prisma Client Extension | 인간 실수로 누락 시 data leak 발생 |
| 세션 관리/쿠키 | 자체 JWT/세션 | NextAuth.js | CSRF, secure cookie, token rotation 처리 |
| DB 세션 스키마 | 자체 Session 테이블 | @auth/prisma-adapter | User/Account/Session/VerificationToken 자동 생성 |

**Key insight:** Tenant isolation at application layer is the highest-risk area. A single missed `organizationId` filter is a data breach. The Prisma Extension removes human error from this equation entirely.

---

## Runtime State Inventory

> Included because this phase involves schema migration and data backfill of existing records.

| Category | Items Found | Action Required |
|----------|-------------|-----------------|
| Stored data | `customers`, `collaterals`, `mortgages`, `loans`, `loan_schedules`, `payments`, `settings` — 7 tables with no organizationId | Data migration: backfill all rows with default organization's ID after Migration 1 |
| Live service config | None identified (local dev system, no external SaaS config) | None |
| OS-registered state | None identified | None |
| Secrets/env vars | `DATABASE_URL` (existing), `NEXTAUTH_SECRET` (new — required), `NEXTAUTH_URL` (new — required) | Add NEXTAUTH_SECRET and NEXTAUTH_URL to .env |
| Build artifacts | `prisma/schema.prisma` will be restructured; `@prisma/client` must be regenerated after each migration step | Run `prisma generate` after each migration |

**Nothing found in category:** OS-registered state and live service config — verified by inspecting project root (no docker-compose, no systemd, no vercel.json crons yet).

---

## Common Pitfalls

### Pitfall 1: customerNumber Global Unique Constraint Breaks Multi-Tenancy
**What goes wrong:** The existing `customerNumber String @unique` on Customer becomes a cross-org conflict when two organizations each try to create C-0001.
**Why it happens:** Database-level unique constraint is global, not scoped per org.
**How to avoid:** Remove `@unique` from `customerNumber`, add `@@unique([organizationId, customerNumber])` composite index. The `generateCustomerNumber()` function in `src/lib/customer-number.ts` must be updated to scope its MAX query by organizationId.
**Warning signs:** `Unique constraint failed on the fields: (customerNumber)` error when second org creates first customer.

### Pitfall 2: @auth/prisma-adapter Version Mismatch
**What goes wrong:** Using @auth/prisma-adapter v1.x with next-auth v4 causes schema incompatibility (User model field names differ).
**Why it happens:** v2.x changed field names to align with next-auth v5 expectations.
**How to avoid:** Use `@auth/prisma-adapter@^2.11.1` as confirmed current. Never mix v1.x adapter with v4.x next-auth.
**Warning signs:** `Cannot read properties of undefined` during signIn, or `Invalid prisma` adapter error.

### Pitfall 3: CredentialsProvider + Database Session Strategy
**What goes wrong:** NextAuth's default session strategy is "database" but CredentialsProvider requires "jwt".
**Why it happens:** Database sessions require OAuth flow; credentials don't create Account records.
**How to avoid:** Always set `session: { strategy: "jwt" }` in authOptions when using CredentialsProvider.
**Warning signs:** `[next-auth][error][JWT_SESSION_ERROR]` after successful login.

### Pitfall 4: Prisma Extension Covering User Model
**What goes wrong:** If the `$allModels` extension intercepts `User.findFirst`, the `authorize()` callback in NextAuth (which looks up users by username) will also have organizationId injected — but at auth time there is no organizationId in context yet.
**Why it happens:** `$allModels` is literally all models including User.
**How to avoid:** Either use a `basePrisma` (without extension) for auth lookups, or exclude User model from the extension by using model-specific interceptors only for the 7 business models.
**Warning signs:** Login fails with `User not found` even when the user exists.

### Pitfall 5: Missing NEXTAUTH_SECRET in Production
**What goes wrong:** NextAuth silently generates a random secret in development, but crashes or has insecure behavior without `NEXTAUTH_SECRET` set in production.
**Why it happens:** Environment variable not added to .env or deployment config.
**How to avoid:** Add `NEXTAUTH_SECRET` (openssl rand -base64 32) and `NEXTAUTH_URL` to .env and document in .env.example.
**Warning signs:** `[next-auth][error][NO_SECRET]` warning in logs; sessions invalid across restarts.

### Pitfall 6: Setting Table unique Constraint After Migration
**What goes wrong:** Existing settings rows have `key` as globally unique. After adding organizationId, the old `@unique` on `key` must be removed and replaced with `@@unique([organizationId, key])`, or existing seeds that insert by key will break.
**Why it happens:** The backfill adds organizationId to existing rows, but if the old unique constraint on `key` remains, duplicates across orgs are blocked at DB level.
**How to avoid:** Migration 1 must also drop the old unique index on `settings.key` and create the composite index.

---

## Code Examples

### NextAuth API Route
```typescript
// src/app/api/auth/[...nextauth]/route.ts
import NextAuth from "next-auth";
import { authOptions } from "@/lib/auth";

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
```

### middleware.ts — Route Protection
```typescript
// src/middleware.ts
export { default } from "next-auth/middleware";

export const config = {
  matcher: [
    "/((?!api/auth|login|_next/static|_next/image|favicon.ico).*)",
  ],
};
```

### generateCustomerNumber — Scoped by Organization
```typescript
// src/lib/customer-number.ts (updated)
export async function generateCustomerNumber(
  db: ReturnType<typeof getTenantClient> // tenant-scoped prisma
): Promise<string> {
  const last = await db.customer.findFirst({
    orderBy: { customerNumber: "desc" },
    select: { customerNumber: true },
  });
  const next = last
    ? parseInt(last.customerNumber.replace("C-", ""), 10) + 1
    : 1;
  return `C-${String(next).padStart(4, "0")}`;
}
```

### Login Page (Next.js App Router)
```typescript
// src/app/(auth)/login/page.tsx
// - No layout.tsx wrapping (separate route group from (main))
// - Uses signIn("credentials", { username, password, redirect: false })
// - Displays 통합 오류 메시지: "아이디 또는 비밀번호가 올바르지 않습니다"
// - Redirects to "/" on success
```

### Backfill Migration Script
```typescript
// prisma/migrations/backfill-org/run.ts
// Run after Migration 1 (nullable organizationId added)
// Run before Migration 2 (NOT NULL enforced)
import { prisma } from "@/lib/prisma";

const DEFAULT_ORG_ID = process.env.DEFAULT_ORG_ID!;
const TABLES = ["customer", "collateral", "mortgage", "loan", "loanSchedule", "payment", "setting"];

for (const model of TABLES) {
  await (prisma as any)[model].updateMany({
    where: { organizationId: null },
    data: { organizationId: DEFAULT_ORG_ID },
  });
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual organizationId in every query | Prisma Client Extension `$extends` | Prisma v4.7+ | Removes human error; single point of enforcement |
| next-auth middleware.ts only | next-safe-action + middleware.ts | 2025 (CVE-2025-29927) | Defense-in-depth; middleware can be bypassed via header manipulation |
| `@auth/prisma-adapter` v1.x | `@auth/prisma-adapter` v2.x | 2024 | v2 aligns with new Auth.js field conventions |
| bcrypt (native) | bcryptjs (pure JS) | — | Better serverless compatibility; no native build step |

**Deprecated/outdated:**
- `next-auth/middleware` alone: CVE-2025-29927 means Server Actions must independently verify auth — middleware is first line, not only line.
- `@auth/prisma-adapter` v1.x: Do not use. Current project uses v2.11.1.

---

## Open Questions

1. **@auth/prisma-adapter schema vs custom User model**
   - What we know: `@auth/prisma-adapter` expects specific fields on User (email, emailVerified, image). Our User model uses `username` not `email`.
   - What's unclear: Whether adapter can be used with a custom User model that has `username` instead of `email`, or if adapter's User schema must be extended.
   - Recommendation: Use adapter for session/account management but define User model to satisfy both adapter requirements (add optional `email` field) AND business requirements (`username`, `passwordHash`, `role`, `isActive`). Alternatively, skip adapter entirely and manage sessions via JWT-only (no DB sessions) — viable since we use CredentialsProvider + JWT strategy which doesn't need DB sessions.

2. **Prisma v7 + $extends compatibility**
   - What we know: Project uses `@prisma/client@^7.5.0` — this is a very recent version. Prisma Extension API (`$extends`) was introduced in v4.7 and is stable.
   - What's unclear: Whether `PrismaPg` adapter (currently used) is fully compatible with `$extends` in v7.
   - Recommendation: Verify with a simple extension test during Wave 0. The `$extends` API on the client object should work independently of the database adapter.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| PostgreSQL | Prisma migrations | Assumed ✓ | — | — |
| next-auth | AUTH-01 to AUTH-07 | Install required | 4.24.13 (npm) | — |
| @auth/prisma-adapter | Session DB | Install required | 2.11.1 (npm) | — |
| bcryptjs | Password hashing | Install required | 3.0.3 (npm) | — |
| next-safe-action | AUTH-06 | Install required | 8.1.8 (npm) | — |

**Missing dependencies with no fallback:**
- `NEXTAUTH_SECRET` env var — must be generated before any auth functionality works
- `NEXTAUTH_URL` env var — must be set to `http://localhost:3000` in development

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | None detected in project |
| Config file | None — see Wave 0 gaps |
| Quick run command | N/A until Wave 0 complete |
| Full suite command | N/A until Wave 0 complete |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| AUTH-01 | 로그인 성공/실패 | unit | `npx jest src/__tests__/auth.test.ts -t "login"` | Wave 0 |
| AUTH-02 | 세션에 userId/organizationId/role 포함 | unit | `npx jest src/__tests__/auth.test.ts -t "session"` | Wave 0 |
| AUTH-03/04 | ADMIN/STAFF 권한 분기 | unit | `npx jest src/__tests__/safe-action.test.ts` | Wave 0 |
| TENANT-02 | 조직 데이터 격리 | integration | `npx jest src/__tests__/tenant-isolation.test.ts` | Wave 0 |
| TENANT-03 | Prisma Extension 자동 필터 | unit | `npx jest src/__tests__/prisma-extension.test.ts` | Wave 0 |
| TENANT-04 | 마이그레이션 후 데이터 무결성 | manual | DB row count check before/after backfill | Manual only |
| AUTH-07 | 로그아웃 후 세션 종료 | manual | 브라우저 로그아웃 후 /customers 직접 접근 시도 | Manual |

### Sampling Rate
- **Per task commit:** TypeScript build check (`npx tsc --noEmit`)
- **Per wave merge:** Full test suite (once Wave 0 establishes test infrastructure)
- **Phase gate:** TypeScript clean + manual auth flow verification before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] Test framework selection and install (`npx jest` or `vitest`) — project has no test framework
- [ ] `src/__tests__/auth.test.ts` — covers AUTH-01, AUTH-02
- [ ] `src/__tests__/safe-action.test.ts` — covers AUTH-03, AUTH-04, AUTH-06
- [ ] `src/__tests__/prisma-extension.test.ts` — covers TENANT-02, TENANT-03

---

## Sources

### Primary (HIGH confidence)
- npm registry direct query — next-auth@4.24.13, @auth/prisma-adapter@2.11.1, next-safe-action@8.1.8, bcryptjs@3.0.3 (2026-03-26)
- Project CLAUDE.md STACK section — version compatibility table
- Project STATE.md — confirmed decisions and blockers
- Project schema.prisma — existing 7 models confirmed
- Project src/lib/prisma.ts — existing Prisma singleton pattern

### Secondary (MEDIUM confidence)
- CONTEXT.md specifics section — findUnique limitation with Prisma Extensions
- CVE-2025-29927 referenced in STATE.md — next-safe-action rationale

### Tertiary (LOW confidence)
- @auth/prisma-adapter v1 vs v2 schema differences — inferred from version notes; verify against adapter README during implementation

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — npm versions verified 2026-03-26
- Architecture: HIGH — patterns derived from locked decisions in CONTEXT.md + STATE.md
- Pitfalls: HIGH — most derived from documented project blockers in STATE.md
- Migration strategy: MEDIUM — 3-step pattern is standard; exact SQL in Prisma migrations needs implementation-time verification
- Test framework: LOW — no test framework detected; Wave 0 must establish one

**Research date:** 2026-03-26
**Valid until:** 2026-04-25 (stable libraries; next-auth v4 is in maintenance mode, unlikely to change)
