# Phase 1: Auth + Multi-Tenant Foundation - Context

**Gathered:** 2026-03-26
**Status:** Ready for planning

<domain>
## Phase Boundary

멀티테넌트 데이터 격리 및 인증/RBAC 기반 구축. 모든 후속 Phase의 전제조건으로, Organization/User 모델 추가, 기존 7개 모델에 organizationId FK 추가, NextAuth.js 인증, next-safe-action 인증 미들웨어, 관리자/직원 역할 기반 접근 제어를 구현한다.

</domain>

<decisions>
## Implementation Decisions

### 로그인 & 사용자 경험
- 중앙 카드형 로그인 폼 (표준 B2B 패턴)
- 비밀번호 최소 8자, 영문+숫자 조합
- 로그인 실패 시 "아이디 또는 비밀번호가 올바르지 않습니다" 통합 메시지 (보안)
- v1에서 비밀번호 찾기 기능 제외 (관리자가 리셋)

### 멀티테넌트 마이그레이션
- 기존 데이터는 "기본 조직" (Default Organization)으로 마이그레이션
- 고객번호(C-NNNN)는 조직별 독립 채번 (각 조직 C-0001부터)
- Setting 테이블에 organizationId 추가하여 조직별 독립 설정
- v1에서 슈퍼 관리자(SUPER_ADMIN) 역할 불필요 — 조직 ADMIN이 최상위

### 사용자 관리 UI
- 관리자가 직접 계정 생성 (이름, 아이디, 임시 비밀번호 설정)
- 사용자 관리 페이지는 설정 > 사용자 관리 하위에 배치
- 사용자 본인이 설정에서 비밀번호 변경 가능
- 사용자 비활성화는 isActive 플래그 (소프트 비활성화, 데이터 보존)

### Claude's Discretion
- Prisma Client Extension 구현 세부사항
- next-safe-action 미들웨어 계층 구조
- 3단계 마이그레이션 (nullable → backfill → NOT NULL) 상세 전략
- TypeScript 타입 확장 (next-auth.d.ts)

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/lib/prisma.ts` — Prisma singleton (tenant client extension 추가 대상)
- `src/components/shared/sidebar.tsx` — 사이드바 네비게이션 (사용자 관리 메뉴 추가 위치)
- `src/app/(main)/settings/` — 설정 페이지 (사용자 관리 하위 페이지 추가 위치)
- `src/lib/encryption.ts` — AES-256-GCM 암호화 (비밀번호 해시와 별개)
- `src/lib/validators.ts` — Zod 스키마 (인증 스키마 추가)
- `src/components/ui/` — Radix UI 컴포넌트 라이브러리

### Established Patterns
- Server Actions for all mutations (`src/actions/`)
- Zod validation on all inputs
- `revalidatePath()` for cache invalidation
- SSR pages with async data fetching
- Korean language UI throughout

### Integration Points
- 모든 Server Action에 인증 검증 추가 필요
- `prisma.ts`에 tenant-scoped client extension 적용
- `middleware.ts` 생성 (인증 라우트 보호)
- `src/app/(auth)/` 라우트 그룹 생성 (로그인 페이지)
- `prisma/schema.prisma`에 Organization, User, 기존 모델 organizationId 추가

</code_context>

<specifics>
## Specific Ideas

- NextAuth.js v4.24.13 사용 (v5 beta 아님) — 리서치 결정사항
- next-safe-action으로 모든 Server Action 인증 래핑 — CVE-2025-29927 대응
- Prisma Client Extension으로 자동 organizationId 필터링 — 수동 필터링 누락 방지
- findUnique → findFirst 변환 필요 (Extension이 findUnique의 where에 조건 추가 불가)
- 비밀번호 해싱: bcrypt 사용

</specifics>

<deferred>
## Deferred Ideas

- 슈퍼 관리자(SUPER_ADMIN) 역할 — 현재 조직 ADMIN이면 충분
- 이메일 초대 링크 — 내부 시스템이므로 직접 계정 생성
- 비밀번호 찾기 기능 — v1에서는 관리자 리셋으로 대체
- 계정 잠금 기능 (N회 실패 후) — v2 고려
- PostgreSQL RLS — Prisma Extension이 1차 방어, RLS는 추후 defense-in-depth

</deferred>
