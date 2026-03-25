# Requirements: LoanManager SaaS

**Defined:** 2026-03-26
**Core Value:** 대출의 전체 라이프사이클을 정확하게 추적하고, 조직별로 안전하게 데이터를 격리하여 관리

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Multi-Tenancy (멀티테넌트)

- [ ] **TENANT-01**: 조직(Organization) 생성 및 관리 (이름, 슬러그, 설정)
- [ ] **TENANT-02**: 모든 데이터가 조직별로 격리되어 다른 조직의 데이터에 접근 불가
- [ ] **TENANT-03**: Prisma Client Extension으로 자동 organizationId 필터링
- [ ] **TENANT-04**: 기존 데이터를 기본 조직으로 마이그레이션 (3단계: nullable→backfill→NOT NULL)
- [ ] **TENANT-05**: 조직별 시스템 설정 (최대 LTV, 기본금리, 법정최고금리, 연체가산금리 등)

### Authentication / RBAC (인증/권한)

- [ ] **AUTH-01**: 사용자가 아이디/비밀번호로 로그인할 수 있다 (NextAuth.js)
- [ ] **AUTH-02**: 사용자 세션에 userId, organizationId, role이 포함된다
- [ ] **AUTH-03**: 관리자(ADMIN)는 모든 기능에 접근할 수 있다
- [ ] **AUTH-04**: 직원(STAFF)은 조회/생성/수납만 가능하고 삭제/설정 변경은 불가하다
- [ ] **AUTH-05**: 관리자가 조직 내 사용자를 초대/관리할 수 있다
- [ ] **AUTH-06**: 모든 Server Action이 인증을 검증한다 (next-safe-action)
- [ ] **AUTH-07**: 로그아웃 시 세션이 완전히 종료된다

### Audit Logging (감사 로그)

- [ ] **AUDIT-01**: 모든 금융 데이터 변경(생성/수정/삭제)이 자동으로 기록된다
- [ ] **AUDIT-02**: 감사 로그에 변경 전/후 값, 사용자, 시간, IP가 기록된다
- [ ] **AUDIT-03**: 감사 로그는 수정/삭제 불가 (append-only)
- [ ] **AUDIT-04**: 주민번호 등 민감정보는 감사 로그에서 마스킹된다
- [ ] **AUDIT-05**: 관리자가 감사 로그를 조회할 수 있다

### Loan Lifecycle (대출 라이프사이클)

- [ ] **LOAN-01**: 관리자가 대출 만기를 연장할 수 있다 (새 만기일, 금리 변경 가능)
- [ ] **LOAN-02**: 대출 연장 시 기존 연체이자가 정산되어야 한다
- [ ] **LOAN-03**: 대출 연장 시 상환스케줄이 연장일부터 재계산된다
- [ ] **LOAN-04**: 차주가 전액 중도상환 시 잔여원금+경과이자+수수료가 계산된다
- [ ] **LOAN-05**: 차주가 일부 중도상환 시 잔여 스케줄이 재계산된다
- [ ] **LOAN-06**: 중도상환수수료율이 대출별/조직별로 설정 가능하다
- [ ] **LOAN-07**: 중도상환 확인 전 수수료 예상액이 표시된다
- [ ] **LOAN-08**: 매일 자동으로 연체 상태가 업데이트된다 (일괄 연체 처리)
- [ ] **LOAN-09**: 관리자가 수동으로 연체 일괄 처리를 실행할 수 있다
- [ ] **LOAN-10**: 일괄 연체 처리가 트랜잭션 내에서 원자적으로 실행된다

### PDF Documents (문서 출력)

- [ ] **PDF-01**: 대출계약서 PDF를 생성할 수 있다 (차주정보, 대출조건, 담보정보, 법정금리 고지)
- [ ] **PDF-02**: 상환스케줄표 PDF를 생성할 수 있다 (전체 상환 테이블)
- [ ] **PDF-03**: 수납영수증 PDF를 생성할 수 있다 (수납일, 원금/이자/연체금 내역, 잔액)
- [ ] **PDF-04**: 담보평가서 PDF를 생성할 수 있다 (물건주소, 평가액, LTV, 근저당 정보)
- [ ] **PDF-05**: PDF에 한글이 정상적으로 렌더링된다 (TTF 폰트 번들링)

### Notifications (알림)

- [ ] **NOTIF-01**: 사용자가 헤더의 알림 벨 아이콘으로 미확인 알림 수를 볼 수 있다
- [ ] **NOTIF-02**: 새 연체 발생 시 알림이 생성된다
- [ ] **NOTIF-03**: 만기 도래(7일/30일 전) 시 알림이 생성된다
- [ ] **NOTIF-04**: 수납 완료 시 알림이 생성된다
- [ ] **NOTIF-05**: 사용자가 알림을 읽음 처리할 수 있다
- [ ] **NOTIF-06**: 알림 클릭 시 관련 엔티티로 이동한다

### Search & Export (검색/내보내기)

- [ ] **SRCH-01**: 날짜 범위로 대출/수납을 필터링할 수 있다
- [ ] **SRCH-02**: 금액 범위로 대출을 필터링할 수 있다
- [ ] **SRCH-03**: 복수 상태를 동시에 선택하여 필터링할 수 있다
- [ ] **SRCH-04**: 필터 상태가 URL에 동기화되어 공유 가능하다
- [ ] **SRCH-05**: 고객 목록을 엑셀로 내보낼 수 있다 (주민번호 마스킹)
- [ ] **SRCH-06**: 대출 목록을 엑셀로 내보낼 수 있다
- [ ] **SRCH-07**: 연체 목록을 엑셀로 내보낼 수 있다

### Dashboard (대시보드)

- [ ] **DASH-01**: 연체율 추이 그래프를 볼 수 있다 (최근 12개월)
- [ ] **DASH-02**: LTV 분포 히스토그램을 볼 수 있다
- [ ] **DASH-03**: 만기 도래 현황을 볼 수 있다 (30일/60일/90일)
- [ ] **DASH-04**: 고객 메모 타임라인을 볼 수 있다

### Customer Management (고객관리)

- [ ] **CUST-01**: 직원이 고객별 메모를 작성할 수 있다 (상담 기록)
- [ ] **CUST-02**: 고객 상세에서 메모 타임라인을 볼 수 있다
- [ ] **CUST-03**: 메모에 작성자와 작성일이 표시된다

### Backup (백업/복원)

- [ ] **BACK-01**: 관리자가 조직 전체 데이터를 JSON으로 내보낼 수 있다
- [ ] **BACK-02**: 내보낸 데이터에서 조직 데이터를 복원할 수 있다

### UI Enhancement (UI 개선)

- [ ] **UI-01**: 다크모드를 활성화/비활성화할 수 있다
- [ ] **UI-02**: 다크모드 설정이 브라우저에 저장된다

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Mobile Optimization

- **MOB-01**: 모든 페이지가 모바일 화면에서 사용 가능하다
- **MOB-02**: 모바일 전용 네비게이션이 제공된다

### SMS Notifications

- **SMS-01**: 연체 알림을 SMS로 발송할 수 있다
- **SMS-02**: 상환일 리마인더를 SMS로 발송할 수 있다

## Out of Scope

| Feature | Reason |
|---------|--------|
| 외부 SMS/이메일 발송 | 현재는 인앱 알림 UI만, 추후 SMS API 연동 |
| 고객 셀프서비스 포털 | 내부 직원 전용 시스템 |
| OAuth/소셜 로그인 | 아이디/비밀번호 인증으로 충분 |
| WebSocket/SSE 실시간 알림 | 30초 폴링으로 충분 |
| AI 신용평가 | 규제 문제, 범위 초과 |
| 소프트 삭제 | 감사 로그가 복구 기록 역할 |
| 전체 필드 암호화 | PII(주민번호/사업자번호)만 암호화로 충분 |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| TENANT-01 | Phase 1 | Pending |
| TENANT-02 | Phase 1 | Pending |
| TENANT-03 | Phase 1 | Pending |
| TENANT-04 | Phase 1 | Pending |
| TENANT-05 | Phase 1 | Pending |
| AUTH-01 | Phase 1 | Pending |
| AUTH-02 | Phase 1 | Pending |
| AUTH-03 | Phase 1 | Pending |
| AUTH-04 | Phase 1 | Pending |
| AUTH-05 | Phase 1 | Pending |
| AUTH-06 | Phase 1 | Pending |
| AUTH-07 | Phase 1 | Pending |
| AUDIT-01 | Phase 2 | Pending |
| AUDIT-02 | Phase 2 | Pending |
| AUDIT-03 | Phase 2 | Pending |
| AUDIT-04 | Phase 2 | Pending |
| AUDIT-05 | Phase 2 | Pending |
| LOAN-01 | Phase 3 | Pending |
| LOAN-02 | Phase 3 | Pending |
| LOAN-03 | Phase 3 | Pending |
| LOAN-04 | Phase 3 | Pending |
| LOAN-05 | Phase 3 | Pending |
| LOAN-06 | Phase 3 | Pending |
| LOAN-07 | Phase 3 | Pending |
| LOAN-08 | Phase 3 | Pending |
| LOAN-09 | Phase 3 | Pending |
| LOAN-10 | Phase 3 | Pending |
| NOTIF-01 | Phase 4 | Pending |
| NOTIF-02 | Phase 4 | Pending |
| NOTIF-03 | Phase 4 | Pending |
| NOTIF-04 | Phase 4 | Pending |
| NOTIF-05 | Phase 4 | Pending |
| NOTIF-06 | Phase 4 | Pending |
| PDF-01 | Phase 5 | Pending |
| PDF-02 | Phase 5 | Pending |
| PDF-03 | Phase 5 | Pending |
| PDF-04 | Phase 5 | Pending |
| PDF-05 | Phase 5 | Pending |
| SRCH-01 | Phase 6 | Pending |
| SRCH-02 | Phase 6 | Pending |
| SRCH-03 | Phase 6 | Pending |
| SRCH-04 | Phase 6 | Pending |
| SRCH-05 | Phase 6 | Pending |
| SRCH-06 | Phase 6 | Pending |
| SRCH-07 | Phase 6 | Pending |
| DASH-01 | Phase 6 | Pending |
| DASH-02 | Phase 6 | Pending |
| DASH-03 | Phase 6 | Pending |
| DASH-04 | Phase 6 | Pending |
| CUST-01 | Phase 6 | Pending |
| CUST-02 | Phase 6 | Pending |
| CUST-03 | Phase 6 | Pending |
| BACK-01 | Phase 6 | Pending |
| BACK-02 | Phase 6 | Pending |
| UI-01 | Phase 6 | Pending |
| UI-02 | Phase 6 | Pending |

**Coverage:**
- v1 requirements: 54 total
- Mapped to phases: 54
- Unmapped: 0 ✓

---
*Requirements defined: 2026-03-26*
*Last updated: 2026-03-26 after initial definition*
