# Roadmap: LoanManager SaaS

## Overview

기존 단일 업체용 대출관리 시스템을 다중 대출업체가 사용하는 SaaS 플랫폼으로 고도화한다. Phase 1에서 멀티테넌트 격리와 인증/권한 기반을 구축하고, Phase 2에서 감사 로그 인프라를 추가한 뒤, Phase 3-6에서 대출 라이프사이클 확장, 알림 시스템, PDF 문서 출력, 검색/내보내기/대시보드 개선을 순차 완성한다. Phase 1은 모든 후속 작업의 하드 블로커다.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Auth + Multi-Tenant Foundation** - 멀티테넌트 데이터 격리 및 인증/RBAC 기반 구축 (모든 후속 작업의 전제조건)
- [ ] **Phase 2: Audit Logging** - 모든 금융 데이터 변경에 대한 불변 감사 로그 인프라 구축
- [ ] **Phase 3: Loan Lifecycle Extensions** - 대출 연장, 중도상환, 일괄 연체 처리 등 핵심 운영 기능 추가
- [ ] **Phase 4: In-App Notifications** - 연체/만기/수납 이벤트 기반 인앱 알림 시스템 구축
- [ ] **Phase 5: PDF Document Generation** - 대출계약서/상환스케줄표/수납영수증/담보평가서 PDF 출력
- [ ] **Phase 6: Search, Export & Dashboard** - 고급 검색/필터, 엑셀 내보내기, 대시보드 고도화, 고객 메모, 백업, 다크모드

## Phase Details

### Phase 1: Auth + Multi-Tenant Foundation
**Goal**: 모든 직원이 조직별로 격리된 환경에서 안전하게 로그인하여 권한에 맞는 기능만 사용할 수 있다
**Depends on**: Nothing (first phase)
**Requirements**: TENANT-01, TENANT-02, TENANT-03, TENANT-04, TENANT-05, AUTH-01, AUTH-02, AUTH-03, AUTH-04, AUTH-05, AUTH-06, AUTH-07
**Success Criteria** (what must be TRUE):
  1. 사용자가 아이디/비밀번호로 로그인하고 로그아웃할 수 있으며, 로그아웃 후 세션이 완전히 종료된다
  2. 로그인한 사용자의 세션에 userId, organizationId, role이 포함되어 모든 Server Action이 이를 검증한다
  3. 관리자(ADMIN)는 모든 기능에 접근할 수 있고, 직원(STAFF)은 삭제/설정 변경을 시도하면 거부된다
  4. 서로 다른 조직의 사용자가 로그인했을 때 각자 자신의 조직 데이터만 조회된다 (타 조직 데이터 접근 불가)
  5. 관리자가 조직 내 사용자를 초대하고 관리할 수 있다
**Plans**: 5 plans
**UI hint**: yes

Plans:
- [x] 01-01-PLAN.md — Prisma 스키마: Organization/User 모델 + nullable organizationId FK (Migration 1) + 세션 타입
- [x] 01-02-PLAN.md — 기본 조직 seed + backfill + NOT NULL 강제 (Migration 2 완료)
- [x] 01-03-PLAN.md — Prisma Extension (getTenantClient) + NextAuth authOptions + safe-action 미들웨어 + middleware.ts
- [ ] 01-04-PLAN.md — 로그인 UI + 사용자 관리 페이지 + user-actions + 사이드바 메뉴
- [ ] 01-05-PLAN.md — 기존 4개 action 파일 safe-action 마이그레이션 (findUnique→findFirst, ctx.db 교체)

### Phase 2: Audit Logging
**Goal**: 모든 금융 데이터 변경이 수정/삭제 불가능한 감사 로그로 자동 기록되어 관리자가 조회할 수 있다
**Depends on**: Phase 1
**Requirements**: AUDIT-01, AUDIT-02, AUDIT-03, AUDIT-04, AUDIT-05
**Success Criteria** (what must be TRUE):
  1. 대출 생성/수정/삭제 등 모든 금융 데이터 변경이 변경 전/후 값, 사용자, 시간, IP와 함께 자동 기록된다
  2. 기록된 감사 로그는 어떤 사용자도 수정하거나 삭제할 수 없다
  3. 감사 로그에서 주민번호 등 민감정보는 마스킹 처리되어 표시된다
  4. 관리자가 감사 로그 목록을 조회하는 페이지에 접근할 수 있다
**Plans**: TBD

### Phase 3: Loan Lifecycle Extensions
**Goal**: 관리자와 직원이 대출 만기 연장, 중도상환, 일괄 연체 처리 등 전체 대출 운영 워크플로우를 수행할 수 있다
**Depends on**: Phase 2
**Requirements**: LOAN-01, LOAN-02, LOAN-03, LOAN-04, LOAN-05, LOAN-06, LOAN-07, LOAN-08, LOAN-09, LOAN-10
**Success Criteria** (what must be TRUE):
  1. 관리자가 대출 만기를 연장할 수 있으며, 연장 시 기존 연체이자가 정산되고 상환스케줄이 연장일부터 재계산된다
  2. 차주가 전액 또는 일부 중도상환 요청 시 잔여원금+경과이자+수수료 예상액을 확인한 뒤 처리할 수 있다
  3. 중도상환수수료율이 대출별/조직별로 설정 가능하며 법정 상한이 적용된다
  4. 매일 자동으로 연체 상태가 업데이트되고, 관리자가 수동으로 일괄 연체 처리를 실행할 수 있다
  5. 일괄 연체 처리가 원자적으로 실행되어 부분 실패가 발생하지 않는다
**Plans**: TBD

### Phase 4: In-App Notifications
**Goal**: 사용자가 헤더의 알림 벨 아이콘으로 연체/만기/수납 이벤트를 실시간으로 인지하고 관련 항목으로 이동할 수 있다
**Depends on**: Phase 3
**Requirements**: NOTIF-01, NOTIF-02, NOTIF-03, NOTIF-04, NOTIF-05, NOTIF-06
**Success Criteria** (what must be TRUE):
  1. 헤더의 알림 벨 아이콘에 미확인 알림 수가 표시되고 30초마다 자동 갱신된다
  2. 새 연체 발생, 만기 도래(7일/30일 전), 수납 완료 시 알림이 자동 생성된다
  3. 사용자가 알림을 클릭하면 읽음 처리되고 관련 대출/고객 페이지로 이동한다
**Plans**: TBD
**UI hint**: yes

### Phase 5: PDF Document Generation
**Goal**: 사용자가 대출계약서, 상환스케줄표, 수납영수증, 담보평가서를 한글이 정상 렌더링된 PDF로 출력할 수 있다
**Depends on**: Phase 1
**Requirements**: PDF-01, PDF-02, PDF-03, PDF-04, PDF-05
**Success Criteria** (what must be TRUE):
  1. 대출 상세 페이지에서 대출계약서 PDF를 생성하면 차주정보, 대출조건, 담보정보, 법정금리 고지가 포함된 문서가 다운로드된다
  2. 상환스케줄표 PDF를 생성하면 전체 상환 테이블이 포함된 문서가 다운로드된다
  3. 수납 완료 후 수납영수증 PDF를 생성하면 수납일, 원금/이자/연체금 내역, 잔액이 포함된 문서가 다운로드된다
  4. 담보평가서 PDF를 생성하면 물건주소, 평가액, LTV, 근저당 정보가 포함된 문서가 다운로드된다
  5. 모든 PDF에서 한글이 깨지지 않고 정상적으로 렌더링된다
**Plans**: TBD

### Phase 6: Search, Export & Dashboard
**Goal**: 사용자가 고급 검색/필터로 데이터를 빠르게 찾고, 엑셀로 내보내고, 강화된 대시보드와 고객 메모로 포트폴리오를 관리하며, 관리자가 데이터를 백업/복원할 수 있다
**Depends on**: Phase 3
**Requirements**: SRCH-01, SRCH-02, SRCH-03, SRCH-04, SRCH-05, SRCH-06, SRCH-07, DASH-01, DASH-02, DASH-03, DASH-04, CUST-01, CUST-02, CUST-03, BACK-01, BACK-02, UI-01, UI-02
**Success Criteria** (what must be TRUE):
  1. 날짜 범위, 금액 범위, 복수 상태를 동시에 선택하여 대출/수납을 필터링할 수 있으며 필터 상태가 URL에 저장되어 공유 가능하다
  2. 고객/대출/연체 목록을 엑셀 파일로 내보낼 수 있다 (고객 목록은 주민번호 마스킹 적용)
  3. 대시보드에서 연체율 추이(12개월), LTV 분포, 만기 도래 현황(30/60/90일)을 시각적으로 확인할 수 있다
  4. 직원이 고객별 메모(상담 기록)를 작성하고 타임라인으로 조회할 수 있으며, 메모에 작성자와 작성일이 표시된다
  5. 관리자가 조직 전체 데이터를 JSON으로 내보내고 복원할 수 있다
  6. 다크모드를 활성화/비활성화할 수 있으며 설정이 브라우저에 저장된다
**Plans**: TBD
**UI hint**: yes

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6

Note: Phase 5 depends only on Phase 1 and can be executed after Phase 1 if needed, but is sequenced here after Phase 4 to maintain focus.

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Auth + Multi-Tenant Foundation | 3/5 | In Progress|  |
| 2. Audit Logging | 0/TBD | Not started | - |
| 3. Loan Lifecycle Extensions | 0/TBD | Not started | - |
| 4. In-App Notifications | 0/TBD | Not started | - |
| 5. PDF Document Generation | 0/TBD | Not started | - |
| 6. Search, Export & Dashboard | 0/TBD | Not started | - |
