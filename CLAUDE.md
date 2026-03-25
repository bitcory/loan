<!-- GSD:project-start source:PROJECT.md -->
## Project

**LoanManager SaaS - 대출관리 시스템 고도화**

다중 대출업체가 사용하는 SaaS형 대출관리 전산 시스템. 고객 관리, 담보물건 관리, 대출 실행/상환/연체 관리, 통계 및 문서 출력 기능을 제공한다. 기존에 단일 업체용으로 구축된 시스템을 멀티테넌트 SaaS로 고도화하고, 인증/감사/문서출력/알림 등 프로덕션 레벨 기능을 추가한다.

**Core Value:** 대출의 전체 라이프사이클(실행→상환→연체→완료)을 정확하게 추적하고, 조직별로 안전하게 데이터를 격리하여 관리할 수 있어야 한다.

### Constraints

- **Tech Stack**: Next.js 14 + Prisma + PostgreSQL 유지 — 기존 코드베이스 활용
- **인증**: NextAuth.js 사용 — 사용자 요구사항
- **금리 제한**: 법정최고금리 20% 준수 — 법적 요구사항
- **암호화**: 주민번호/사업자번호 AES-256-GCM 유지 — 개인정보보호법
- **언어**: 한국어 UI 유지 — 국내 사용자 대상
<!-- GSD:project-end -->

<!-- GSD:stack-start source:research/STACK.md -->
## Technology Stack

## Recommended Stack
### Authentication (멀티테넌트 인증)
| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| next-auth | 4.24.13 (latest stable) | 세션 기반 인증, 역할 관리 | v5(beta.30)는 아직 beta 태그 유지 중. v4는 stable, Next.js 14와 완전 호환. 멀티테넌트 JWT 콜백 패턴이 v4에서 더 안정적으로 문서화됨 |
| @auth/prisma-adapter | ^2.8.0 | Prisma 세션/계정 DB 연동 | v4 공식 어댑터. User/Session/Account 스키마 자동 생성 |
### PDF 생성 (한국어 문서 출력)
| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| @react-pdf/renderer | 4.3.2 | 대출계약서, 상환스케줄표, 수납영수증 PDF 생성 | React 컴포넌트 기반 PDF 작성. Node.js 서버사이드 렌더링 지원으로 Server Action에서 직접 호출 가능. 한국어 폰트를 `Font.register()`로 등록하면 CJK 완전 지원 |
### Excel 내보내기
| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| exceljs | 4.4.0 | 고객/대출/연체 목록 .xlsx 내보내기 | 서버사이드 동작, 스타일링(셀 색상, 열 너비, 헤더 볼드) 지원, 한국어 텍스트 완전 지원. npm 공개 레지스트리 정상 배포. SheetJS(xlsx)의 대안으로 라이선스·보안 이슈 없음 |
### 알림/토스트 UI
| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| sonner | 2.0.7 | 작업 성공/실패 토스트 알림 | shadcn/ui 공식 채택 라이선스. 기존 Radix UI 토스트 컴포넌트보다 API가 단순. 다크모드 자동 지원. Promise 기반 로딩 상태 처리 내장 |
### 배치 처리 / 크론 (연체 상태 자동 업데이트)
| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Vercel Cron Jobs (vercel.json) | — | 연체 상태 일괄 업데이트, 만기 알림 생성 | 추가 인프라 없음. Next.js Route Handler를 GET으로 노출하고 `CRON_SECRET` 헤더로 보안. Vercel 무료 플랜은 1개, 유료 플랜은 다수 크론 지원 |
### 다크모드
| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| next-themes | 0.4.6 | 다크/라이트/시스템 테마 전환 | Tailwind `darkMode: 'class'`와 표준 연동 조합. SSR flicker 방지, localStorage 영구 저장, 시스템 설정 자동 감지. shadcn/ui 공식 권장 방식 |
### 고급 검색/URL 상태 관리
| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| nuqs | 2.8.9 | 검색 필터 조건 URL 파라미터 동기화 | TanStack Table(이미 사용 중)과 표준 연동 패턴. React 18 concurrent-safe. Vercel/Sentry/Supabase 등 프로덕션에서 사용. 필터 조건을 URL에 유지해 새로고침 후에도 검색 상태 보존 |
### 감사 로그 (Audit Log)
## Installation
# Authentication
# PDF Generation (한국어 폰트 .ttf 파일 별도 획득 필요)
# Excel Export
# Toast Notifications
# Dark Mode
# URL State Management (advanced search)
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
## What NOT to Use
| Avoid | Why | Use Instead |
|-------|-----|-------------|
| xlsx (SheetJS npm 공개판) | v18.5부터 npm 공개 레지스트리 배포 중단. 남은 구버전은 고위험 취약점(GHSA 등록) | exceljs |
| next-auth v5 beta | npm dist-tag `latest`가 아님. beta.30까지 릴리즈되었으나 API 변경 지속 중. 금융 시스템에 beta 의존은 위험 | next-auth 4.24.13 |
| Puppeteer (Vercel 배포 시) | Vercel serverless에서 Chromium 번들이 50MB+ → Lambda 크기 제한 초과. `@sparticuz/chromium` 회피책 있으나 복잡 | @react-pdf/renderer |
| react-hot-toast | sonner가 shadcn/ui 공식 채택 후 사실상 대체됨. 기존 Radix UI 토스트도 shadcn/ui에서 deprecated 표시 | sonner |
| 기본 Roboto 폰트 (@react-pdf 기본값) | CJK 문자 렌더링 불가 → 한국어가 공백으로 표시됨 | NanumGothic.ttf 또는 NotoSansKR 등록 |
| node-cron (Vercel 배포 시) | Vercel serverless는 persistent process 없음 → node-cron 스케줄러가 동작하지 않음 | Vercel Cron Jobs (vercel.json) |
## Stack Patterns by Variant
- Cron: `vercel.json` crons 설정 + Route Handler
- PDF: `@react-pdf/renderer` `renderToBuffer()` in Route Handler
- 프로세스 메모리 제한: exceljs `writeBuffer()` (스트림 아닌 버퍼) 사용
- Cron: `node-cron` 4.2.1 in custom Next.js server
- PDF: 동일 (`@react-pdf/renderer` 서버사이드)
- Puppeteer 옵션 추가로 가능해짐
- 모든 Prisma 모델에 `organizationId String` 필드 추가
- Row-level security 대신 Application-level filtering (Prisma where절)
- `getServerSession()` → `session.user.organizationId` → 모든 쿼리에 주입
- Prisma `$extends`에서 organizationId 없는 쓰기 작업 차단 (방어적 미들웨어)
## Version Compatibility
| Package | Compatible With | Notes |
|---------|-----------------|-------|
| next-auth@4.24.13 | next@14.2.35, @prisma/client@7.5.0 | @auth/prisma-adapter v2.x 사용. v1.x 어댑터와 혼용 금지 |
| @react-pdf/renderer@4.3.2 | react@18, Node.js 18+ | 클라이언트에서 사용 시 `ssr: false` 동적 임포트 필수. React 19와는 미확인 |
| exceljs@4.4.0 | Node.js 18+, Next.js 14 | Route Handler에서 사용. Server Action에서 직접 파일 다운로드 불가 → Route Handler 경유 필요 |
| sonner@2.0.7 | react@18, next@14, tailwindcss@3.4.x | shadcn/ui `npx shadcn@latest add sonner`로 설치 권장 (래퍼 컴포넌트 자동 생성) |
| next-themes@0.4.6 | next@14, tailwindcss@3.4.x | tailwind.config.ts에 `darkMode: 'class'` 필수 |
| nuqs@2.8.9 | next@14 App Router | Pages Router 미지원. `NuqsAdapter`를 layout.tsx에 등록 필요 |
## Sources
- npm registry (직접 조회) — next-auth@4.24.13, @react-pdf/renderer@4.3.2, exceljs@4.4.0, sonner@2.0.7, next-themes@0.4.6, nuqs@2.8.9, node-cron@4.2.1, inngest@4.1.0 (HIGH confidence)
- https://github.com/nextauthjs/next-auth/discussions/13382 — v5 beta 상태 확인 (MEDIUM confidence, community source)
- https://github.com/diegomura/react-pdf/issues/806 — Korean font issues (MEDIUM confidence, issue tracker)
- https://react-pdf.org/fonts — Font.register() 공식 문서 (HIGH confidence)
- https://ui.shadcn.com/docs/components/radix/sonner — sonner shadcn/ui 채택 공식 문서 (HIGH confidence)
- https://nuqs.dev — nuqs 공식 사이트 (HIGH confidence)
- https://vercel.com/docs/cron-jobs — Vercel Cron Jobs 공식 문서 (HIGH confidence)
- WebSearch — exceljs SheetJS 취약점, next-auth beta 상태, dark mode 구현 패턴 (MEDIUM confidence)
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

Conventions not yet established. Will populate as patterns emerge during development.
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

Architecture not yet mapped. Follow existing patterns found in the codebase.
<!-- GSD:architecture-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd:quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd:debug` for investigation and bug fixing
- `/gsd:execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->



<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd:profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
