# LoanManager SaaS - 대출관리 시스템 고도화

## What This Is

다중 대출업체가 사용하는 SaaS형 대출관리 전산 시스템. 고객 관리, 담보물건 관리, 대출 실행/상환/연체 관리, 통계 및 문서 출력 기능을 제공한다. 기존에 단일 업체용으로 구축된 시스템을 멀티테넌트 SaaS로 고도화하고, 인증/감사/문서출력/알림 등 프로덕션 레벨 기능을 추가한다.

## Core Value

대출의 전체 라이프사이클(실행→상환→연체→완료)을 정확하게 추적하고, 조직별로 안전하게 데이터를 격리하여 관리할 수 있어야 한다.

## Requirements

### Validated

- ✓ 고객 CRUD (개인/법인, 암호화된 주민번호/사업자번호) — existing
- ✓ 담보물건 관리 (등록, 근저당 관리, LTV 계산) — existing
- ✓ 대출 관리 (만기일시/원금균등/원리금균등 3가지 상환방식) — existing
- ✓ 상환스케줄 자동생성 (Decimal.js 정밀 계산) — existing
- ✓ 수납처리 (원금/이자/연체금 분리 기록) — existing
- ✓ 연체관리 (4단계: 정상→1단계→2단계→3단계) — existing
- ✓ 대시보드 (KPI, 월별 실행/회수 추이) — existing
- ✓ 통합관리 뷰 (고객+담보+대출 통합 검색) — existing
- ✓ 시스템 설정 (최대 LTV, 기본금리, 법정최고금리 등) — existing
- ✓ 민감정보 AES-256-GCM 암호화 — existing

### Active

- [ ] 멀티테넌트 (조직 개념, 데이터 격리, 조직별 설정)
- [ ] 인증/권한 시스템 (NextAuth.js, 관리자/직원 역할)
- [ ] 감사 로그 (변경 이력 추적)
- [ ] PDF 문서 출력 (대출계약서, 상환스케줄표, 수납영수증, 담보평가서)
- [ ] 알림 시스템 (인앱 알림 UI, 연체/상환일 알림)
- [ ] 일괄 연체 처리 (자동 연체 상태 업데이트)
- [ ] 대출 연장/갱신 (만기 연장, 금리/조건 변경)
- [ ] 중도상환 처리 (일부/전액 조기상환, 수수료 계산)
- [ ] 고급 검색/필터 (날짜 범위, 금액 범위, 다중 조건)
- [ ] 엑셀 내보내기 (고객/대출/연체 목록)
- [ ] 대시보드 고도화 (연체율 추이, LTV 분포, 만기 도래 현황)
- [ ] 고객 메모/히스토리 (상담 기록, 이력 관리)
- [ ] 데이터 백업/복원
- [ ] 다크모드
- [ ] 모바일 최적화

### Out of Scope

- 외부 SMS/이메일 발송 — 현재는 인앱 알림 UI만 구현, 추후 SMS API 연동
- 고객 셀프서비스 포털 — 내부 직원 전용 시스템
- 결제/정산 시스템 — 대출 관리에 집중
- OAuth/소셜 로그인 — 아이디/비밀번호 인증으로 충분
- 실시간 채팅 — 불필요

## Context

- **기존 스택:** Next.js 14.2.35, TypeScript, Prisma 7.5.0, PostgreSQL, Tailwind CSS 3.4.1, Radix UI
- **차트:** Recharts 3.8.0, **테이블:** TanStack React Table 8.21.3
- **폼:** React Hook Form 7.71.2 + Zod 4.3.6
- **금융 계산:** Decimal.js 정밀도 사용 중
- **날짜:** date-fns (한국어 로케일)
- **아키텍처:** Next.js Server Actions (REST API 없음), SSR 기반
- **DB 모델:** Customer, Collateral, Mortgage, Loan, LoanSchedule, Payment, Setting (7개)
- **기존 코드 품질:** 타입 안전, Zod 유효성 검사, 암호화 적용 완료

## Constraints

- **Tech Stack**: Next.js 14 + Prisma + PostgreSQL 유지 — 기존 코드베이스 활용
- **인증**: NextAuth.js 사용 — 사용자 요구사항
- **금리 제한**: 법정최고금리 20% 준수 — 법적 요구사항
- **암호화**: 주민번호/사업자번호 AES-256-GCM 유지 — 개인정보보호법
- **언어**: 한국어 UI 유지 — 국내 사용자 대상

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| NextAuth.js 인증 | Next.js 생태계 통합, 세션 관리 용이 | — Pending |
| 멀티테넌트 (조직 기반 격리) | 다중 업체 SaaS 요구사항 | — Pending |
| 인앱 알림 UI (SMS 제외) | 초기 버전 복잡도 관리, 추후 SMS 연동 가능 | — Pending |
| PDF 전체 문서 출력 | 대출계약서, 상환표, 영수증, 담보평가서 필요 | — Pending |
| Server Actions 유지 | 기존 아키텍처 일관성, REST API 전환 불필요 | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd:transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-03-26 after initialization*
