# Stack Research

**Domain:** Multi-tenant SaaS Loan Management (Next.js 14 + Prisma + PostgreSQL 고도화)
**Researched:** 2026-03-26
**Confidence:** MEDIUM-HIGH (npm registry verified for versions; multi-tenant JWT patterns from community sources)

---

## Recommended Stack

### Authentication (멀티테넌트 인증)

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| next-auth | 4.24.13 (latest stable) | 세션 기반 인증, 역할 관리 | v5(beta.30)는 아직 beta 태그 유지 중. v4는 stable, Next.js 14와 완전 호환. 멀티테넌트 JWT 콜백 패턴이 v4에서 더 안정적으로 문서화됨 |
| @auth/prisma-adapter | ^2.8.0 | Prisma 세션/계정 DB 연동 | v4 공식 어댑터. User/Session/Account 스키마 자동 생성 |

**근거:** next-auth v5(beta)는 npm dist-tag가 여전히 `beta`이고 `latest`가 4.24.13. 프로덕션 금융 시스템에 beta를 쓰는 것은 위험. v4로 멀티테넌트 구현 후 v5 GA 시 마이그레이션하는 것이 안전.

**멀티테넌트 구현 패턴:** JWT 콜백에서 `organizationId`를 토큰에 임베드하고, 모든 Server Action에서 `getServerSession()`으로 조직 컨텍스트를 주입. DB 쿼리에 `where: { organizationId: session.user.organizationId }`를 반드시 포함.

### PDF 생성 (한국어 문서 출력)

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| @react-pdf/renderer | 4.3.2 | 대출계약서, 상환스케줄표, 수납영수증 PDF 생성 | React 컴포넌트 기반 PDF 작성. Node.js 서버사이드 렌더링 지원으로 Server Action에서 직접 호출 가능. 한국어 폰트를 `Font.register()`로 등록하면 CJK 완전 지원 |

**한국어 폰트 설정 필수 사항:** `@react-pdf/renderer`의 기본 폰트는 CJK 미지원. 나눔고딕(NanumGothic) 또는 Noto Sans KR `.ttf` 파일을 `/public/fonts/`에 배치하고 아래와 같이 등록해야 함:

```typescript
import { Font } from '@react-pdf/renderer';
Font.register({
  family: 'NanumGothic',
  src: '/fonts/NanumGothic.ttf',
});
```

Server Action에서 사용 시 `renderToBuffer()`를 사용하고 Next.js Route Handler에서 `Content-Type: application/pdf`로 반환.

**클라이언트 사이드 사용 시:** `dynamic(() => import('./PDFDocument'), { ssr: false })`로 동적 임포트 필수.

### Excel 내보내기

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| exceljs | 4.4.0 | 고객/대출/연체 목록 .xlsx 내보내기 | 서버사이드 동작, 스타일링(셀 색상, 열 너비, 헤더 볼드) 지원, 한국어 텍스트 완전 지원. npm 공개 레지스트리 정상 배포. SheetJS(xlsx)의 대안으로 라이선스·보안 이슈 없음 |

**SheetJS(xlsx)를 쓰지 않는 이유:** SheetJS는 v18.5부터 npm 공개 레지스트리 배포를 중단했고, 공개 레지스트리의 구버전은 고위험 취약점 포함. exceljs는 Apache-2.0 라이선스, npm 정상 배포, 서버사이드 Buffer 반환 지원.

**Server Action에서 사용 패턴:**
```typescript
// app/api/export/loans/route.ts
import ExcelJS from 'exceljs';
const workbook = new ExcelJS.Workbook();
const sheet = workbook.addWorksheet('대출목록');
// ... 데이터 추가
const buffer = await workbook.xlsx.writeBuffer();
return new Response(buffer, {
  headers: { 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }
});
```

### 알림/토스트 UI

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| sonner | 2.0.7 | 작업 성공/실패 토스트 알림 | shadcn/ui 공식 채택 라이선스. 기존 Radix UI 토스트 컴포넌트보다 API가 단순. 다크모드 자동 지원. Promise 기반 로딩 상태 처리 내장 |

**인앱 알림 Inbox 패턴 (벨 아이콘):** 외부 서비스 불필요. Prisma `Notification` 모델을 직접 구현하고 Radix UI `Popover`로 벨 아이콘 드롭다운 구성. 연체/만기 알림은 배치 처리에서 DB에 레코드 삽입, UI에서 폴링 또는 Server Component revalidation으로 표시.

```prisma
model Notification {
  id             String   @id @default(cuid())
  organizationId String
  userId         String?
  type           String   // OVERDUE | DUE_SOON | PAYMENT_RECEIVED
  title          String
  body           String
  isRead         Boolean  @default(false)
  createdAt      DateTime @default(now())
}
```

### 배치 처리 / 크론 (연체 상태 자동 업데이트)

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Vercel Cron Jobs (vercel.json) | — | 연체 상태 일괄 업데이트, 만기 알림 생성 | 추가 인프라 없음. Next.js Route Handler를 GET으로 노출하고 `CRON_SECRET` 헤더로 보안. Vercel 무료 플랜은 1개, 유료 플랜은 다수 크론 지원 |

**자체 호스팅 환경용 대안:** node-cron 4.2.1 — Next.js custom server(`server.ts`)에서 실행. 단, Vercel serverless와 호환 안 됨. 자체 서버(VPS, Docker) 배포 시에만 사용.

**vercel.json 설정:**
```json
{
  "crons": [
    {
      "path": "/api/cron/overdue-check",
      "schedule": "0 1 * * *"
    }
  ]
}
```

**Route Handler 보안:**
```typescript
// app/api/cron/overdue-check/route.ts
export async function GET(req: Request) {
  if (req.headers.get('Authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }
  // 연체 일괄 처리 로직
}
```

### 다크모드

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| next-themes | 0.4.6 | 다크/라이트/시스템 테마 전환 | Tailwind `darkMode: 'class'`와 표준 연동 조합. SSR flicker 방지, localStorage 영구 저장, 시스템 설정 자동 감지. shadcn/ui 공식 권장 방식 |

**설정:**
```typescript
// tailwind.config.ts
export default {
  darkMode: 'class',
  // ...
}

// app/layout.tsx
import { ThemeProvider } from 'next-themes';
<ThemeProvider attribute="class" defaultTheme="system" enableSystem>
  {children}
</ThemeProvider>
```

HTML 태그에 `suppressHydrationWarning` 필수 (next-themes가 서버/클라이언트 불일치 경고 발생).

### 고급 검색/URL 상태 관리

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| nuqs | 2.8.9 | 검색 필터 조건 URL 파라미터 동기화 | TanStack Table(이미 사용 중)과 표준 연동 패턴. React 18 concurrent-safe. Vercel/Sentry/Supabase 등 프로덕션에서 사용. 필터 조건을 URL에 유지해 새로고침 후에도 검색 상태 보존 |

**이미 TanStack React Table 8.21.3을 사용 중이므로** `useQueryState`로 columnFilters, sorting, pagination을 URL에 바인딩하면 북마크/공유 가능한 검색 뷰 구현.

### 감사 로그 (Audit Log)

추가 라이브러리 없음 — Prisma `$extends`로 자체 구현이 최적.

**이유:** 외부 감사 라이브러리들은 Prisma v7과의 호환성 검증이 어렵고, 금융 도메인 특화 필드(organizationId, 암호화 여부)를 직접 제어하는 것이 안전. Prisma Extensions가 GA되어 stable API.

```prisma
model AuditLog {
  id             String   @id @default(cuid())
  organizationId String
  userId         String
  action         String   // CREATE | UPDATE | DELETE
  model          String   // Customer | Loan | Payment 등
  recordId       String
  before         Json?
  after          Json?
  createdAt      DateTime @default(now())
  @@index([organizationId, createdAt])
}
```

---

## Installation

```bash
# Authentication
npm install next-auth @auth/prisma-adapter

# PDF Generation (한국어 폰트 .ttf 파일 별도 획득 필요)
npm install @react-pdf/renderer

# Excel Export
npm install exceljs

# Toast Notifications
npm install sonner

# Dark Mode
npm install next-themes

# URL State Management (advanced search)
npm install nuqs
```

---

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| next-auth v4.24 | next-auth v5 beta | v5 GA(정식 릴리즈) 이후 마이그레이션. 현재는 beta 태그로 API 변경 위험 있음 |
| next-auth | Clerk | 외부 인증 SaaS가 허용되는 경우. 멀티테넌트 UI가 내장되어 있어 빠름. 단 민감 금융 데이터 시스템에서 외부 SaaS 의존은 리스크 |
| next-auth | Better Auth | next-auth를 대체하는 오픈소스 신흥 라이브러리 (2025년 등장). Prisma adapter, multi-tenant 내장. 하지만 생태계 검증 부족 |
| @react-pdf/renderer | Puppeteer | HTML을 그대로 PDF로 변환해야 할 때. 단 Vercel serverless에서 Chromium 실행이 어렵고 `@sparticuz/chromium` 별도 설치 필요. 복잡도 높음 |
| @react-pdf/renderer | pdfmake | JSON 선언형 API 선호 시. React 컴포넌트 재사용 불가, 한국어 폰트 지원 방식이 유사 |
| exceljs | SheetJS Pro | 더 넓은 포맷 지원이 필요한 경우. 단 상용 라이선스 필요 |
| Vercel Cron | Inngest | 복잡한 이벤트 기반 워크플로우, 재시도 로직, 팬아웃 패턴이 필요한 경우. 현 요구사항(일배치 연체 처리)에는 과함 |
| nuqs | React state only | URL 공유/북마크가 불필요하고 단순 필터링만 필요한 경우 |

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| xlsx (SheetJS npm 공개판) | v18.5부터 npm 공개 레지스트리 배포 중단. 남은 구버전은 고위험 취약점(GHSA 등록) | exceljs |
| next-auth v5 beta | npm dist-tag `latest`가 아님. beta.30까지 릴리즈되었으나 API 변경 지속 중. 금융 시스템에 beta 의존은 위험 | next-auth 4.24.13 |
| Puppeteer (Vercel 배포 시) | Vercel serverless에서 Chromium 번들이 50MB+ → Lambda 크기 제한 초과. `@sparticuz/chromium` 회피책 있으나 복잡 | @react-pdf/renderer |
| react-hot-toast | sonner가 shadcn/ui 공식 채택 후 사실상 대체됨. 기존 Radix UI 토스트도 shadcn/ui에서 deprecated 표시 | sonner |
| 기본 Roboto 폰트 (@react-pdf 기본값) | CJK 문자 렌더링 불가 → 한국어가 공백으로 표시됨 | NanumGothic.ttf 또는 NotoSansKR 등록 |
| node-cron (Vercel 배포 시) | Vercel serverless는 persistent process 없음 → node-cron 스케줄러가 동작하지 않음 | Vercel Cron Jobs (vercel.json) |

---

## Stack Patterns by Variant

**Vercel 배포 시:**
- Cron: `vercel.json` crons 설정 + Route Handler
- PDF: `@react-pdf/renderer` `renderToBuffer()` in Route Handler
- 프로세스 메모리 제한: exceljs `writeBuffer()` (스트림 아닌 버퍼) 사용

**자체 서버(VPS/Docker) 배포 시:**
- Cron: `node-cron` 4.2.1 in custom Next.js server
- PDF: 동일 (`@react-pdf/renderer` 서버사이드)
- Puppeteer 옵션 추가로 가능해짐

**멀티테넌트 데이터 격리 패턴:**
- 모든 Prisma 모델에 `organizationId String` 필드 추가
- Row-level security 대신 Application-level filtering (Prisma where절)
- `getServerSession()` → `session.user.organizationId` → 모든 쿼리에 주입
- Prisma `$extends`에서 organizationId 없는 쓰기 작업 차단 (방어적 미들웨어)

---

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| next-auth@4.24.13 | next@14.2.35, @prisma/client@7.5.0 | @auth/prisma-adapter v2.x 사용. v1.x 어댑터와 혼용 금지 |
| @react-pdf/renderer@4.3.2 | react@18, Node.js 18+ | 클라이언트에서 사용 시 `ssr: false` 동적 임포트 필수. React 19와는 미확인 |
| exceljs@4.4.0 | Node.js 18+, Next.js 14 | Route Handler에서 사용. Server Action에서 직접 파일 다운로드 불가 → Route Handler 경유 필요 |
| sonner@2.0.7 | react@18, next@14, tailwindcss@3.4.x | shadcn/ui `npx shadcn@latest add sonner`로 설치 권장 (래퍼 컴포넌트 자동 생성) |
| next-themes@0.4.6 | next@14, tailwindcss@3.4.x | tailwind.config.ts에 `darkMode: 'class'` 필수 |
| nuqs@2.8.9 | next@14 App Router | Pages Router 미지원. `NuqsAdapter`를 layout.tsx에 등록 필요 |

---

## Sources

- npm registry (직접 조회) — next-auth@4.24.13, @react-pdf/renderer@4.3.2, exceljs@4.4.0, sonner@2.0.7, next-themes@0.4.6, nuqs@2.8.9, node-cron@4.2.1, inngest@4.1.0 (HIGH confidence)
- https://github.com/nextauthjs/next-auth/discussions/13382 — v5 beta 상태 확인 (MEDIUM confidence, community source)
- https://github.com/diegomura/react-pdf/issues/806 — Korean font issues (MEDIUM confidence, issue tracker)
- https://react-pdf.org/fonts — Font.register() 공식 문서 (HIGH confidence)
- https://ui.shadcn.com/docs/components/radix/sonner — sonner shadcn/ui 채택 공식 문서 (HIGH confidence)
- https://nuqs.dev — nuqs 공식 사이트 (HIGH confidence)
- https://vercel.com/docs/cron-jobs — Vercel Cron Jobs 공식 문서 (HIGH confidence)
- WebSearch — exceljs SheetJS 취약점, next-auth beta 상태, dark mode 구현 패턴 (MEDIUM confidence)

---

*Stack research for: 대출관리 SaaS 시스템 고도화 (Next.js 14 + Prisma + PostgreSQL)*
*Researched: 2026-03-26*
