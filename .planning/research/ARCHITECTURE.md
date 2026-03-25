# Architecture Research

**Domain:** Multi-tenant SaaS 대출관리 시스템 (Loan Management SaaS)
**Researched:** 2026-03-26
**Confidence:** HIGH (based on existing codebase inspection + verified external sources)

## Standard Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Browser (Client)                             │
│  ┌────────────┐  ┌───────────────┐  ┌────────────┐  ┌───────────┐   │
│  │ Server     │  │ Client        │  │ PDF Viewer │  │ Notif.    │   │
│  │ Components │  │ Components    │  │ (iframe)   │  │ Popover   │   │
│  │ (RSC)      │  │ (React state) │  │            │  │           │   │
│  └─────┬──────┘  └──────┬────────┘  └─────┬──────┘  └─────┬─────┘   │
└────────┼────────────────┼────────────────┼────────────────┼─────────┘
         │                │   Server Actions (calls)         │
┌────────▼────────────────▼────────────────▼────────────────▼─────────┐
│                    Next.js App Router (Server)                        │
│                                                                       │
│  ┌──────────────────────────────────────────────────────────────┐    │
│  │   middleware.ts  — Auth check + orgId header injection        │    │
│  └──────────────────────────────────────────────────────────────┘    │
│                                                                       │
│  ┌─────────────────┐  ┌──────────────────────────────────────────┐   │
│  │  Route Handlers  │  │  Server Actions (src/actions/)           │   │
│  │  /api/pdf/[id]   │  │  loan-actions.ts   customer-actions.ts  │   │
│  │  /api/export/    │  │  collateral-actions.ts  audit-actions.ts │   │
│  │  /api/cron/      │  │  notification-actions.ts                 │   │
│  └────────┬─────────┘  └──────────────┬───────────────────────────┘  │
│           │                           │                               │
│  ┌────────▼───────────────────────────▼───────────────────────────┐  │
│  │                  Service Layer (src/lib/)                        │  │
│  │  schedule-generator.ts  interest.ts  ltv.ts  encryption.ts      │  │
│  │  [NEW] overdue-calculator.ts  early-repayment.ts  pdf-renderer.ts│ │
│  │  [NEW] excel-exporter.ts  notification-service.ts               │  │
│  └────────────────────────────┬────────────────────────────────────┘  │
│                               │                                        │
│  ┌────────────────────────────▼────────────────────────────────────┐  │
│  │                  Prisma ORM (src/lib/prisma.ts)                   │  │
│  │   Middleware: tenantScope + auditLog (Prisma extensions)         │  │
│  └────────────────────────────┬────────────────────────────────────┘  │
└───────────────────────────────┼────────────────────────────────────────┘
                                │
┌───────────────────────────────▼────────────────────────────────────────┐
│                         PostgreSQL                                       │
│  Organization  User  AuditLog  Notification  [existing 7 tables]        │
│  + organizationId FK on all tenant-scoped models                        │
└────────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Implementation |
|-----------|----------------|----------------|
| `middleware.ts` | 인증 세션 검증, organizationId를 request header에 주입, 미인증 요청 redirect | NextAuth.js v5 `auth()` + `headers()` |
| `src/app/(auth)/` | 로그인/로그아웃 페이지 | NextAuth.js credentials provider |
| `src/app/(main)/` | 기존 업무 화면들 (layout에서 session 접근) | RSC + Server Actions |
| `src/actions/` | 모든 DB 변경 로직 (Server Actions) | `next-safe-action` authenticated client |
| `src/lib/prisma.ts` | Prisma client + tenant scope + audit middleware | Prisma Client Extensions |
| `src/lib/` (service) | 순수 계산 로직 (스케줄, 연체, 조기상환) | TypeScript pure functions |
| Route Handler `/api/pdf/` | PDF 스트림 응답 | `@react-pdf/renderer` server-side |
| Route Handler `/api/export/` | Excel 파일 다운로드 | `exceljs` WorkbookWriter stream |
| Route Handler `/api/cron/` | 배치 작업 진입점 (외부 cron에서 호출) | Protected by `CRON_SECRET` header |

## Recommended Project Structure

```
src/
├── app/
│   ├── (auth)/                   # 인증 그룹 라우트 [NEW]
│   │   ├── login/page.tsx
│   │   └── layout.tsx
│   ├── (main)/                   # 기존 업무 화면 (auth 보호)
│   │   ├── layout.tsx            # session 주입 + Sidebar
│   │   ├── dashboard/
│   │   ├── customers/
│   │   ├── collaterals/
│   │   ├── loans/
│   │   │   └── [id]/
│   │   │       └── page.tsx      # 대출연장/중도상환 탭 추가
│   │   ├── overdue/              # 일괄 연체 처리 UI
│   │   ├── notifications/        # [NEW] 알림 목록 페이지
│   │   ├── statistics/
│   │   └── settings/
│   ├── api/
│   │   ├── auth/[...nextauth]/   # [NEW] NextAuth.js handler
│   │   ├── pdf/[type]/[id]/      # [NEW] PDF 스트림
│   │   ├── export/[type]/        # [NEW] Excel 다운로드
│   │   └── cron/
│   │       ├── overdue/          # [NEW] 연체 일괄처리
│   │       └── notifications/    # [NEW] 알림 배치
│   └── layout.tsx
│
├── actions/                      # Server Actions
│   ├── auth-actions.ts           # [NEW]
│   ├── customer-actions.ts       # orgId 스코프 추가
│   ├── collateral-actions.ts     # orgId 스코프 추가
│   ├── loan-actions.ts           # orgId 스코프 + 연장/조기상환
│   ├── setting-actions.ts        # orgId 스코프 추가
│   ├── audit-actions.ts          # [NEW]
│   ├── notification-actions.ts   # [NEW]
│   └── batch-actions.ts          # [NEW] 연체 일괄처리
│
├── lib/
│   ├── prisma.ts                 # Prisma client (tenant middleware 추가)
│   ├── auth.ts                   # [NEW] NextAuth.js config
│   ├── safe-action.ts            # [NEW] next-safe-action 클라이언트
│   ├── schedule-generator.ts     # 기존 유지
│   ├── interest.ts               # 기존 유지
│   ├── ltv.ts                    # 기존 유지
│   ├── encryption.ts             # 기존 유지
│   ├── overdue-calculator.ts     # [NEW] 연체일수/금액 계산
│   ├── early-repayment.ts        # [NEW] 중도상환 수수료 계산
│   ├── pdf/
│   │   ├── loan-contract.tsx     # [NEW] 대출계약서 PDF 컴포넌트
│   │   ├── schedule-table.tsx    # [NEW] 상환스케줄표 PDF 컴포넌트
│   │   ├── payment-receipt.tsx   # [NEW] 수납영수증 PDF 컴포넌트
│   │   └── collateral-report.tsx # [NEW] 담보평가서 PDF 컴포넌트
│   ├── excel/
│   │   └── exporters.ts          # [NEW] ExcelJS 내보내기 함수들
│   ├── validators.ts             # Zod 스키마 (확장)
│   ├── formatters.ts             # 기존 유지
│   ├── constants.ts              # 기존 유지
│   └── utils.ts                  # 기존 유지
│
└── components/
    ├── shared/
    │   ├── sidebar.tsx           # 알림 뱃지 추가, org 표시 추가
    │   ├── notification-bell.tsx # [NEW] 알림 아이콘 + popover
    │   └── ...                   # 기존 shared 컴포넌트
    ├── loans/
    │   ├── loan-wizard.tsx       # 기존 유지
    │   ├── payment-dialog.tsx    # 기존 유지
    │   ├── extension-dialog.tsx  # [NEW] 대출 연장 다이얼로그
    │   └── early-repayment-dialog.tsx  # [NEW] 중도상환 다이얼로그
    ├── notifications/
    │   └── notification-list.tsx # [NEW]
    └── ui/                       # 기존 shadcn/ui 컴포넌트
```

### Structure Rationale

- **`(auth)/` route group:** 인증 페이지들을 main layout의 Sidebar/세션 의존성에서 분리. 로그인 페이지는 `(main)` layout의 session guard를 거치지 않아야 한다.
- **`api/` route handlers:** Server Actions는 스트리밍 HTTP 응답을 반환할 수 없다. PDF와 Excel 다운로드는 `Response` 객체를 직접 반환하는 Route Handler가 필수.
- **`api/cron/`:** Next.js에는 내장 cron이 없다. 외부 cron(Vercel Cron, OS cron, GitHub Actions)이 이 엔드포인트를 호출한다. `CRON_SECRET` 헤더로 보호.
- **`lib/pdf/`:** `@react-pdf/renderer` 컴포넌트는 React 컴포넌트이지만 서버에서 렌더링한다. `lib/` 하위에 두어 Route Handler에서 직접 import한다.
- **`lib/safe-action.ts`:** `next-safe-action` 클라이언트를 한 곳에서 정의. `authenticatedActionClient`와 `adminActionClient`를 여기서 export하여 모든 Server Actions가 일관되게 auth middleware를 통과하게 한다.

## Architectural Patterns

### Pattern 1: Tenant-Scoped Prisma Client (organizationId 자동 주입)

**What:** 모든 DB 쿼리에 `organizationId` 필터를 자동으로 추가하는 Prisma Client Extension. 개발자가 개별 쿼리에서 tenant 필터를 잊는 것을 방지한다.

**When to use:** 멀티테넌트 데이터 격리가 필요한 모든 쿼리에 적용. 기존의 `prisma.ts`를 교체한다.

**Trade-offs:** Prisma Middleware는 deprecated 방향이므로 Prisma Client Extensions의 `$extends`와 `query` 방식을 사용한다. 관리자용 bypass client가 별도로 필요하다.

**Example:**
```typescript
// src/lib/prisma.ts
import { PrismaClient } from "@prisma/client";

const TENANT_MODELS = ["customer", "collateral", "loan", "payment", "loanSchedule", "mortgage", "notification", "auditLog"];

export function createTenantPrismaClient(organizationId: string) {
  return prismaBase.$extends({
    query: {
      $allModels: {
        async findMany({ args, query, model }) {
          if (TENANT_MODELS.includes(model.toLowerCase())) {
            args.where = { ...args.where, organizationId };
          }
          return query(args);
        },
        async findUnique({ args, query, model }) {
          // findUnique는 where에 organizationId 추가 후 findFirst로 위임
          if (TENANT_MODELS.includes(model.toLowerCase())) {
            const result = await prismaBase[model as keyof typeof prismaBase].findFirst({
              ...args,
              where: { ...args.where, organizationId },
            } as never);
            return result;
          }
          return query(args);
        },
        async create({ args, query, model }) {
          if (TENANT_MODELS.includes(model.toLowerCase())) {
            args.data = { ...args.data, organizationId };
          }
          return query(args);
        },
        // update, delete는 where에 organizationId 추가
      },
    },
  });
}
```

### Pattern 2: next-safe-action으로 계층화된 Action 클라이언트

**What:** 모든 Server Actions를 `next-safe-action`으로 래핑하여 인증, 입력 검증, 에러 처리를 계층적으로 적용한다. 기존 raw Server Actions를 이 패턴으로 교체한다.

**When to use:** 인증이 필요한 모든 Server Actions. 현재 프로젝트의 모든 actions가 해당된다.

**Trade-offs:** 기존 `FormData` 기반 Server Actions를 type-safe 객체 기반으로 마이그레이션해야 한다. 약간의 리팩토링 비용이 있지만, 인증 누락 버그를 구조적으로 방지한다.

**Example:**
```typescript
// src/lib/safe-action.ts
import { createSafeActionClient } from "next-safe-action";
import { auth } from "@/lib/auth";

// 기본 클라이언트 (비인증)
export const actionClient = createSafeActionClient();

// 인증 필요 클라이언트
export const authenticatedActionClient = actionClient.use(async ({ next }) => {
  const session = await auth();
  if (!session?.user) throw new Error("인증이 필요합니다.");
  return next({
    ctx: {
      userId: session.user.id,
      organizationId: session.user.organizationId,
      role: session.user.role,
    },
  });
});

// 관리자 전용 클라이언트
export const adminActionClient = authenticatedActionClient.use(
  async ({ next, ctx }) => {
    if (ctx.role !== "ADMIN") throw new Error("관리자 권한이 필요합니다.");
    return next({ ctx });
  }
);

// 사용 예시 (loan-actions.ts)
export const createLoan = authenticatedActionClient
  .schema(loanSchema)
  .action(async ({ parsedInput, ctx }) => {
    const db = createTenantPrismaClient(ctx.organizationId);
    // ... 기존 로직
  });
```

### Pattern 3: Prisma Client Extensions로 감사 로그 자동화

**What:** Prisma의 `$extends`를 사용하여 모든 `create`, `update`, `delete` 작업에 자동으로 AuditLog를 기록한다. 개별 Action에서 감사 로그 코드를 반복하지 않는다.

**When to use:** Customer, Loan, Collateral, Payment 모델의 변경 추적에 적용.

**Trade-offs:** 감사 로그를 위한 `userId`와 `organizationId` 컨텍스트를 Prisma client에 전달해야 한다. `createTenantPrismaClient(organizationId, userId)`로 서명을 확장한다.

**Example:**
```typescript
// AuditLog 모델 (schema.prisma에 추가)
// model AuditLog {
//   id             String   @id @default(cuid())
//   organizationId String
//   userId         String
//   action         String   // CREATE, UPDATE, DELETE
//   model          String   // Customer, Loan, etc.
//   recordId       String
//   before         Json?
//   after          Json?
//   createdAt      DateTime @default(now())
// }

// 확장 시 $allModels query 후처리에서 AuditLog.create 호출
```

### Pattern 4: PDF는 Route Handler, Excel은 Route Handler (Server Action 금지)

**What:** 파일 다운로드(PDF, Excel)는 절대 Server Action으로 구현하지 않는다. Server Actions는 HTTP Response를 반환할 수 없기 때문이다. Route Handler(`/api/pdf/[type]/[id]`)를 사용하고 클라이언트에서 `window.open()` 또는 `<a href>` 링크로 호출한다.

**When to use:** 모든 파일 다운로드 기능.

**Trade-offs:** 인증 검사를 Route Handler 내부에서도 `auth()` 호출로 반복해야 한다.

**Example:**
```typescript
// src/app/api/pdf/loan-contract/[id]/route.ts
import { renderToStream } from "@react-pdf/renderer";
import { auth } from "@/lib/auth";
import { LoanContractDocument } from "@/lib/pdf/loan-contract";

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session) return new Response("Unauthorized", { status: 401 });

  const db = createTenantPrismaClient(session.user.organizationId);
  const loan = await db.loan.findFirst({ where: { id: params.id }, include: { ... } });
  if (!loan) return new Response("Not Found", { status: 404 });

  const stream = await renderToStream(<LoanContractDocument loan={loan} />);
  return new Response(stream as unknown as ReadableStream, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="loan-${loan.loanNumber}.pdf"`,
    },
  });
}
```

### Pattern 5: Cron 배치는 외부 트리거 + 내부 Route Handler

**What:** Next.js에는 내장 cron 스케줄러가 없다. 배치 작업(연체 상태 일괄 업데이트, 알림 생성)은 외부 cron이 `POST /api/cron/overdue`를 호출하는 방식으로 구현한다.

**When to use:** 연체 일괄처리(매일 자정), 만기 도래 알림(매일 오전).

**Trade-offs:** 외부 cron 의존성이 생긴다. Vercel 배포라면 `vercel.json`의 crons 설정으로 해결. 자체 서버라면 OS cron + curl.

**Example:**
```typescript
// src/app/api/cron/overdue/route.ts
export async function POST(req: Request) {
  const secret = req.headers.get("x-cron-secret");
  if (secret !== process.env.CRON_SECRET) {
    return new Response("Unauthorized", { status: 401 });
  }
  // 모든 organization에 대해 연체 상태 업데이트
  await runOverdueBatchForAllOrganizations();
  return Response.json({ ok: true });
}

// vercel.json
// { "crons": [{ "path": "/api/cron/overdue", "schedule": "0 0 * * *" }] }
```

## Data Flow

### 인증 요청 흐름

```
사용자 요청 (browser)
    ↓
middleware.ts
  → auth() 로 세션 확인
  → 미인증 → /login redirect
  → 인증됨 → organizationId를 request context에 보관
    ↓
Server Component (RSC)
  → auth() 로 session 접근
  → createTenantPrismaClient(session.user.organizationId) 생성
  → DB 쿼리 (organizationId 자동 필터)
    ↓
HTML 응답 → 브라우저
```

### Server Action 변경 흐름 (with audit)

```
사용자 폼 제출 (클라이언트 컴포넌트)
    ↓
next-safe-action 호출
    ↓
authenticatedActionClient middleware
  → auth() 세션 검증
  → ctx = { userId, organizationId, role }
    ↓
Zod 스키마 파싱 (parsedInput)
    ↓
Action 함수 실행
  → createTenantPrismaClient(organizationId, userId)
  → Prisma transaction
     ├─ 도메인 데이터 변경 (Loan, Payment 등)
     └─ AuditLog.create (변경 전/후 스냅샷)
    ↓
revalidatePath() → Next.js 캐시 무효화
    ↓
{ data } 응답 → 클라이언트 컴포넌트 상태 업데이트
```

### PDF 다운로드 흐름

```
사용자 "PDF 출력" 버튼 클릭
    ↓
<a href="/api/pdf/loan-contract/[id]" target="_blank"> 또는
window.open("/api/pdf/loan-contract/[id]")
    ↓
Route Handler: GET /api/pdf/loan-contract/[id]
  → auth() 세션 검증
  → createTenantPrismaClient 로 대출 데이터 조회
  → @react-pdf/renderer renderToStream()
    ↓
ReadableStream Response (Content-Type: application/pdf)
    ↓
브라우저 PDF 뷰어 or 파일 다운로드
```

### 연체 배치 흐름

```
외부 Cron (Vercel Cron / OS cron, 매일 자정)
    ↓
POST /api/cron/overdue (x-cron-secret 헤더)
    ↓
Route Handler
  → CRON_SECRET 검증
  → 모든 Organization 순회
     → 미납 LoanSchedule 조회 (dueDate < today, status: SCHEDULED/PARTIAL)
     → 연체일수 계산 → overdueStage 결정
     → Loan.overdueStage, overdueDays 업데이트
     → Notification 생성 (연체 알림)
    ↓
Response 200 { processed: N }
```

### Key Data Flows

1. **멀티테넌트 격리:** 모든 DB 쿼리는 `createTenantPrismaClient(organizationId)`를 통과 → organizationId 자동 주입 → 타 조직 데이터 접근 불가

2. **알림 생성:** 배치(cron) 또는 도메인 이벤트(대출 연체 전환, 만기 7일 전)가 `Notification` 레코드 생성 → Sidebar의 `NotificationBell`이 unread count를 서버에서 read하여 표시

3. **감사 로그:** Prisma Extension이 변경 전/후 JSON 스냅샷을 `AuditLog` 테이블에 자동 저장 → 별도 `AuditLog` 뷰어 페이지에서 조회 가능

## Multi-Tenancy: 기존 DB 모델에 미치는 영향

### 스키마 변경 방향

```
[NEW] Organization 모델 추가
  id, name, slug, settings(JSON), createdAt

[NEW] User 모델 추가
  id, organizationId (FK), email, passwordHash, role(ADMIN/STAFF), name, createdAt

[기존 7개 모델 모두] organizationId String 필드 추가
  Customer, Collateral, Mortgage, Loan, LoanSchedule, Payment, Setting
  → 각 모델에 @@index([organizationId]) 추가 (성능)

[NEW] AuditLog 모델
  id, organizationId, userId, action, model, recordId, before(Json?), after(Json?), createdAt

[NEW] Notification 모델
  id, organizationId, userId?, type, title, body, loanId?, isRead, createdAt
```

### 기존 쿼리 마이그레이션

기존 `src/actions/` 파일들은 raw `prisma.*` 호출을 사용한다. 이를 모두 `createTenantPrismaClient(organizationId)`로 교체해야 한다. `next-safe-action`으로 래핑하면 `ctx.organizationId`를 통해 일관되게 전달된다.

기존 `customerNumber` 생성 로직 (`generateCustomerNumber`)은 조직 범위 내에서 유니크해야 하므로 `C-NNNN` → 조직별 시퀀스로 재설계가 필요하다.

## Suggested Build Order (의존성 기반)

```
Phase 1: 인증 + 멀티테넌트 기반 (모든 후속 기능의 전제조건)
  ├─ Organization / User Prisma 모델 추가
  ├─ 기존 7개 모델에 organizationId 추가 (마이그레이션 스크립트)
  ├─ NextAuth.js v5 credentials provider 설정
  ├─ middleware.ts 인증 게이트
  ├─ createTenantPrismaClient (Prisma Extension)
  ├─ next-safe-action 클라이언트 (safe-action.ts)
  └─ 기존 actions → authenticatedActionClient 마이그레이션

Phase 2: 감사 로그 (Phase 1 완료 후, 비즈니스 로직 변경 전)
  ├─ AuditLog 모델
  └─ Prisma Extension에 audit hook 추가
  (이 단계 이후에 추가되는 모든 기능의 변경이 자동으로 기록됨)

Phase 3: 대출 생명주기 확장 (독립적 비즈니스 로직)
  ├─ 중도상환 (early-repayment.ts 계산 + EarlyRepaymentDialog)
  ├─ 대출 연장/갱신 (ExtensionDialog + schema 업데이트)
  └─ 일괄 연체 처리 (/api/cron/overdue + batch-actions.ts)

Phase 4: 알림 시스템 (Phase 3의 연체 배치에 의존)
  ├─ Notification 모델
  ├─ notification-actions.ts
  ├─ NotificationBell 컴포넌트 (Sidebar에 통합)
  └─ 알림 목록 페이지

Phase 5: 문서 출력 (Phase 1 인증 + 기존 데이터 모델에 의존)
  ├─ @react-pdf/renderer 설치 + 기본 설정
  ├─ 대출계약서, 상환스케줄표, 수납영수증, 담보평가서 PDF 컴포넌트
  └─ /api/pdf/ Route Handlers

Phase 6: 검색/내보내기/고급 기능 (독립적, 마지막 단계)
  ├─ 고급 검색/필터 (기존 actions에 파라미터 확장)
  ├─ 엑셀 내보내기 (/api/export/ + exceljs)
  └─ 대시보드 고도화 (통계 쿼리 추가)
```

**Phase 1이 블로킹 의존성이다.** organizationId가 모든 모델에 없으면 Phase 2 이후 어떤 기능도 올바르게 동작하지 않는다. 기존 단일 테넌트 데이터가 있다면 마이그레이션 스크립트로 기본 Organization을 만들고 기존 레코드에 organizationId를 채워야 한다.

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 0-10개 업체, ~1K 사용자 | 현재 구조 그대로. 단일 PostgreSQL 인스턴스, Next.js monolith |
| 10-100개 업체, ~10K 사용자 | organizationId 인덱스 점검, connection pooling (PgBouncer), Redis for notification unread count cache |
| 100개+ 업체 | PostgreSQL Read Replica for 통계/대시보드 쿼리 분리, PDF 생성은 별도 worker 서비스로 분리 고려 |

### Scaling Priorities

1. **첫 번째 병목:** 통계/대시보드 쿼리 (집계 쿼리가 대용량에서 느려짐). `@@index([organizationId, createdAt])` 복합 인덱스와 materialized view로 해결.
2. **두 번째 병목:** 배치 연체 처리 (조직 수 × 대출 수 비례). 조직별 병렬 처리 또는 Prisma `$queryRaw`로 단일 집계 UPDATE SQL로 전환.

## Anti-Patterns

### Anti-Pattern 1: Server Action에서 직접 파일 Response 반환 시도

**What people do:** `export async function downloadPdf() { return new Response(...) }` 형태로 Server Action에서 PDF를 반환하려 한다.

**Why it's wrong:** Server Actions의 반환값은 직렬화 가능한 JSON이어야 한다. `Response` 객체나 `ReadableStream`은 직렬화되지 않아 런타임 에러가 발생한다.

**Do this instead:** Route Handler (`/api/pdf/...`)에서 `Response`를 반환하고, 클라이언트에서 링크 또는 `window.open()`으로 호출한다.

### Anti-Pattern 2: 개별 Action마다 수동으로 organizationId 필터 추가

**What people do:** 각 `prisma.loan.findMany({ where: { organizationId: session.user.organizationId, ... } })`처럼 모든 쿼리에 직접 필터를 추가한다.

**Why it's wrong:** 하나라도 빠뜨리면 다른 조직의 데이터가 노출된다. 코드 리뷰로 100% 보장할 수 없다.

**Do this instead:** `createTenantPrismaClient(organizationId)` Prisma Extension을 사용하여 자동으로 모든 쿼리에 organizationId를 주입한다.

### Anti-Pattern 3: Server Action에서 세션 없이 직접 prisma 호출

**What people do:** `"use server"` 함수 안에서 세션 검증 없이 바로 `prisma.loan.create()` 호출.

**Why it's wrong:** Server Actions는 클라이언트에서 직접 호출 가능한 HTTP 엔드포인트로 동작한다. 세션 검증이 없으면 미인증 요청도 DB를 변경할 수 있다.

**Do this instead:** 모든 변경 Action을 `authenticatedActionClient`로 래핑한다. `next-safe-action`의 middleware가 세션을 강제한다.

### Anti-Pattern 4: cron secret 없이 배치 엔드포인트 노출

**What people do:** `/api/cron/overdue`를 인증 없이 열어둔다.

**Why it's wrong:** 누구나 무한히 배치 작업을 트리거하여 DB 과부하 및 알림 폭발을 일으킬 수 있다.

**Do this instead:** `x-cron-secret` 헤더와 환경변수 `CRON_SECRET` 비교 검증. Vercel Cron은 자체 OIDC 토큰도 지원한다.

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| NextAuth.js v5 credentials | `src/lib/auth.ts` 설정, `api/auth/[...nextauth]/route.ts` 핸들러 | bcrypt로 비밀번호 해시, session에 `organizationId` / `role` 추가 필수 |
| @react-pdf/renderer | Server-side `renderToStream()` in Route Handler | Next.js 14.1.1+ 필요 (버그 수정됨). Canvas 없는 서버 환경에서 동작 확인 필수 |
| ExcelJS | `WorkbookWriter` with passthrough stream in Route Handler | Server Action 불가. `exceljs` v4.x 기준 |
| Vercel Cron / OS cron | `vercel.json` 설정 또는 외부 curl 호출 | `CRON_SECRET` 환경변수로 보호 |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| RSC ↔ Server Actions | Direct import + call (같은 프로세스) | `revalidatePath`로 캐시 무효화 |
| Server Actions ↔ Route Handlers | 별도 경계. 공유 lib 함수만 import | Actions는 Route Handler를 호출하지 않고 반대도 마찬가지 |
| Server Actions ↔ Prisma | `createTenantPrismaClient(orgId)` 경유 필수 | raw `prisma` import 금지 (lint rule 권장) |
| Cron Route Handler ↔ Domain Logic | `src/lib/` 의 순수 함수 및 `batch-actions.ts` 호출 | Prisma 직접 접근은 batch-actions.ts가 담당 |
| PDF Route Handler ↔ PDF Components | `src/lib/pdf/*.tsx` import | PDF 컴포넌트는 서버 전용. 클라이언트 번들에 포함 안 됨 |

## Sources

- [Next.js Multi-tenant Guide](https://nextjs.org/docs/app/guides/multi-tenant) — Next.js 공식 멀티테넌트 가이드
- [Auth.js Role Based Access Control](https://authjs.dev/guides/role-based-access-control) — NextAuth.js v5 RBAC 공식 가이드
- [next-safe-action Middleware](https://next-safe-action.dev/docs/define-actions/middleware) — 계층화된 Action 클라이언트 공식 문서
- [Prisma Client Extensions](https://www.prisma.io/blog/client-extensions-preview-8t3w27xkrxxn) — Prisma Extension으로 tenant scope 구현
- [Implementing Multi-Tenancy in Next.js with Prisma](https://qaffaf.medium.com/implementing-multi-tenancy-in-a-next-js-4f2608633a38) — App Router + Actions 가이드
- [Prisma Audit Trail Guide](https://medium.com/@arjunlall/prisma-audit-trail-guide-for-postgres-5b09aaa9f75a) — Prisma 감사 로그 패턴
- [NextJS 14 and react-pdf integration](https://benhur-martins.medium.com/nextjs-14-and-react-pdf-integration-ccd38b1fd515) — react-pdf 서버사이드 렌더링

---
*Architecture research for: LoanManager SaaS 대출관리 시스템 고도화*
*Researched: 2026-03-26*
