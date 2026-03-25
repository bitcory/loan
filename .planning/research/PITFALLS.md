# Pitfalls Research

**Domain:** 대출관리 SaaS — 단일 테넌트에서 멀티테넌트 고도화
**Researched:** 2026-03-26
**Confidence:** HIGH (코드베이스 직접 분석 + 공식 문서 검증)

---

## Critical Pitfalls

### Pitfall 1: Server Action이 인증/인가를 건너뛰는 공개 엔드포인트

**What goes wrong:**
Next.js Server Actions는 외부에서 직접 POST 요청으로 호출 가능한 공개 엔드포인트다. 미들웨어에서만 인증을 확인하면, 미들웨어를 우회해 Server Action을 직접 호출하면 어떤 데이터도 조작할 수 있다. 현재 코드베이스(`loan-actions.ts`, `customer-actions.ts`)에는 Server Action 내부에 세션 검증이 없다.

**Why it happens:**
개발자가 "미들웨어가 보호해 주겠지"라는 가정으로 Server Action 내부에 인증 검사를 넣지 않는다. 또한 2025년 3월 공개된 CVE-2025-29927(CVSS 9.1)은 `x-middleware-subrequest` 헤더 조작으로 Next.js 미들웨어 전체를 우회할 수 있음을 보여준다.

**How to avoid:**
모든 Server Action 상단에서 반드시 세션을 검증한다. `next-safe-action` 라이브러리를 사용해 인증/권한 검사를 선언적으로 강제한다:

```typescript
// 모든 server action에서 이 패턴 필수
export async function createLoan(data: FormData) {
  const session = await auth();
  if (!session?.user?.organizationId) {
    return { error: "인증이 필요합니다." };
  }
  // 이후 로직에서 session.user.organizationId 반드시 사용
}
```

**Warning signs:**
- Server Action 파일에 `auth()` 또는 `getServerSession()` 호출이 없는 경우
- 미들웨어에만 `authorized` 체크가 있는 경우
- `createLoan`, `processPayment` 등 금융 액션이 session 없이 실행 가능한 경우

**Phase to address:** 멀티테넌트/인증 구현 첫 번째 Phase

---

### Pitfall 2: organizationId 누락으로 인한 테넌트 간 데이터 노출

**What goes wrong:**
멀티테넌트 전환 시 `organizationId`를 모든 모델에 추가했더라도, 단 하나의 쿼리에서 `where: { organizationId }` 를 빠뜨리면 다른 조직의 데이터가 노출된다. 현재 `getLoans()`, `getLoan()`, `getOverdueLoans()` 등 모든 조회 함수가 tenant 필터 없이 전체 데이터를 반환한다.

**Why it happens:**
Prisma는 쿼리에서 `organizationId` 필터를 강제하는 메커니즘이 기본 제공되지 않는다. 기능 추가 시 새 쿼리를 작성하면서 필터를 빠뜨리는 인간 실수가 누적된다.

**How to avoid:**
두 겹의 방어 레이어를 모두 구현한다:

1. **Prisma Client Extension으로 자동 필터 적용:**
```typescript
// lib/prisma-tenant.ts
export function createTenantClient(organizationId: string) {
  return prisma.$extends({
    query: {
      $allModels: {
        async findMany({ args, query }) {
          args.where = { ...args.where, organizationId };
          return query(args);
        },
        // findUnique, update, delete 등 모든 operation에 적용
      },
    },
  });
}
```

2. **PostgreSQL Row-Level Security를 최후 방어선으로:**
RLS 정책이 있으면 앱 레이어 버그가 있어도 DB 레벨에서 차단된다.

**Warning signs:**
- `prisma.loan.findMany({})` 처럼 `where` 없이 호출하는 코드
- 테스트에서 조직 A의 토큰으로 조직 B의 loanId를 직접 조회했을 때 데이터가 반환되는 경우
- 대시보드 통계가 특정 조직이 아닌 전체 합계를 보여주는 경우

**Phase to address:** 멀티테넌트 데이터 격리 Phase (스키마 마이그레이션과 동시에)

---

### Pitfall 3: 기존 데이터 마이그레이션 없이 organizationId 컬럼 추가

**What goes wrong:**
`organizationId NOT NULL` 컬럼을 기존 테이블에 추가하면 기존 레코드 때문에 마이그레이션이 실패한다. `NULL 허용`으로 추가하면 이후 코드에서 null 처리 버그가 발생한다. 현재 7개 모델(Customer, Collateral, Mortgage, Loan, LoanSchedule, Payment, Setting) 전체에 organizationId를 추가해야 한다.

**Why it happens:**
마이그레이션 순서를 미리 계획하지 않고, "컬럼만 추가하면 되지"라고 과소평가한다.

**How to avoid:**
3단계 마이그레이션 전략을 사용한다:

```sql
-- 1단계: NULL 허용으로 컬럼 추가 (기존 데이터 보존)
ALTER TABLE loans ADD COLUMN organization_id TEXT;

-- 2단계: 기존 데이터를 기본 조직에 할당
UPDATE loans SET organization_id = 'org_default' WHERE organization_id IS NULL;

-- 3단계: NOT NULL 제약 추가
ALTER TABLE loans ALTER COLUMN organization_id SET NOT NULL;
```

Prisma 마이그레이션으로 위 3단계를 별도 파일로 분리해 실행한다. 복합 인덱스도 반드시 추가한다: `@@index([organizationId, status])`, `@@index([organizationId, customerId])`.

**Warning signs:**
- 단일 Prisma 마이그레이션에서 `NOT NULL` 컬럼을 기존 테이블에 추가하려는 경우
- `Organization` 모델 생성 전에 다른 모델에 `organizationId` 외래키를 추가하려는 경우
- 시드/테스트 데이터가 없어 마이그레이션이 성공해도 실제 데이터로 검증이 안 된 경우

**Phase to address:** 멀티테넌트 스키마 마이그레이션 Phase

---

### Pitfall 4: 감사 로그가 금융 거래와 같은 트랜잭션에 묶이지 않음

**What goes wrong:**
`processPayment` 같은 금융 트랜잭션 완료 후 별도로 감사 로그를 기록하면, 트랜잭션은 커밋됐는데 로그 기록이 실패하는 경우가 생긴다. 반대로 로그 기록 실패가 트랜잭션을 롤백시킬 수 있다. 어느 쪽이든 데이터 정합성이 깨진다.

**Why it happens:**
감사 로그를 "사후에 기록하는 부가 기능"으로 취급해 트랜잭션 밖에서 처리한다.

**How to avoid:**
감사 로그를 금융 트랜잭션과 같은 Prisma `$transaction` 블록에 포함한다:

```typescript
await prisma.$transaction(async (tx) => {
  // 1. 실제 금융 처리
  await tx.payment.create({ ... });
  await tx.loan.update({ ... });

  // 2. 감사 로그 — 같은 트랜잭션, 원자적 처리
  await tx.auditLog.create({
    data: {
      action: "PAYMENT_PROCESSED",
      entityType: "Payment",
      entityId: payment.id,
      userId: session.user.id,
      organizationId: session.user.organizationId,
      before: JSON.stringify(previousState),
      after: JSON.stringify(newState),
    }
  });
});
```

감사 로그 테이블에는 DELETE와 UPDATE 권한을 애플리케이션 DB 사용자에서 제거해 불변성을 보장한다.

**Warning signs:**
- `$transaction` 블록 외부에서 `auditLog.create()` 를 호출하는 코드
- 감사 로그 생성 실패 시 에러를 무시하는 try/catch
- 감사 로그 테이블에 `updatedAt` 컬럼이 있는 경우 (수정 가능하다는 신호)

**Phase to address:** 인증/감사 로그 Phase

---

### Pitfall 5: 중도상환수수료 계산 기준 오해

**What goes wrong:**
금융소비자보호법 개정(2025년 1월 13일 이후 신규계약 적용)에 따라 중도상환수수료는 "실비용" 기준으로만 부과 가능하며, 주택담보대출 기준 최대 0.6~0.7%로 낮아졌다. 법 개정 전 방식(1.4%)으로 계산하면 법 위반이다. 또한 계산식을 단순 `상환금액 × 수수료율`로 구현하면 잔여 기간 비례 계산이 누락된다.

**Why it happens:**
한국 금융 규제를 충분히 검토하지 않고 인터넷 자료에서 오래된 수수료율을 그대로 사용한다.

**How to avoid:**
법정 계산식을 정확히 구현한다:

```typescript
// 중도상환수수료 = 상환금액 × 수수료율 × (잔여일수 / 대출기간 일수)
// 2025년 1월 13일 이후 신규계약: 최대 0.6~0.7% (주담대)
function calculateEarlyRepaymentFee(
  repaymentAmount: Decimal,
  feeRate: Decimal,     // 조직 설정에서 관리 (법적 상한 준수)
  remainingDays: number,
  totalLoanDays: number
): Decimal {
  return repaymentAmount
    .mul(feeRate.div(100))
    .mul(new Decimal(remainingDays).div(totalLoanDays))
    .toDecimalPlaces(0, Decimal.ROUND_HALF_UP);
}
```

수수료율은 하드코딩하지 않고 조직별 Setting에서 관리하되, 법적 상한선 검증 로직을 추가한다.

**Warning signs:**
- 수수료율이 소스 코드에 하드코딩된 경우
- 잔여 기간 비례 계산이 없는 경우 (`amount × rate` 만 계산)
- 3년 초과 대출에 수수료를 부과하는 경우 (금소법상 3년 초과 시 면제)

**Phase to address:** 중도상환 기능 구현 Phase

---

### Pitfall 6: 대출 연장 시 기존 스케줄과 미납금 처리 누락

**What goes wrong:**
대출 연장 시 새 스케줄을 생성하면서 기존 PARTIAL/OVERDUE 상태의 스케줄을 어떻게 처리할지 결정하지 않으면 연체금과 이자 계산이 이중으로 발생한다. `endDate`만 변경하고 `loanTermMonths`를 업데이트하지 않으면 연체 계산 로직이 오작동한다.

**Why it happens:**
기존 스케줄 삭제 → 새 스케줄 생성을 단순히 반복한다고 생각하지만, 일부 납부된 회차(PARTIAL)가 있으면 잔액 계산의 기준점이 불명확해진다.

**How to avoid:**
대출 연장을 별도 이벤트로 모델링한다:

```typescript
// 연장 시 처리 순서:
// 1. 기존 SCHEDULED 스케줄 모두 CANCELLED로 변경 (삭제 불가 — 감사 로그)
// 2. 현재 실제 잔액(balance)을 기준으로 새 스케줄 생성
// 3. LoanExtension 기록 생성 (원래 조건, 새 조건, 연장 사유)
// 4. Loan의 endDate, loanTermMonths 업데이트
// 5. 연체 상태(overdueStage) 재평가
```

스케줄은 절대 삭제하지 않고 상태를 `CANCELLED`로 변경해 이력을 보존한다.

**Warning signs:**
- `prisma.loanSchedule.deleteMany({ where: { loanId } })` 호출
- 연장 전후 잔액이 기존 `balance` 필드와 일치하지 않는 경우
- 연장 이력이 없어서 "언제 어떤 조건으로 연장됐는지" 추적 불가

**Phase to address:** 대출 연장/갱신 기능 Phase

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| organizationId를 세션에서만 읽고 DB RLS 미적용 | 구현 빠름 | 앱 버그 시 데이터 노출, 감사 불통과 | Never — 금융 SaaS |
| 감사 로그를 async fire-and-forget으로 기록 | 메인 요청 속도 유지 | 로그 누락 시 금융 감사 실패 | Never — 금융 데이터 |
| 수수료율 하드코딩 | 빠른 MVP | 규제 변경 시 코드 수정 필요, 조직별 설정 불가 | MVP 단계까지만 |
| PDF를 클라이언트에서 생성 | 서버 자원 절약 | 한글 폰트 누락, 인쇄 품질 불일치, 보안 위험 | Never — 공식 문서 |
| 일괄 연체 처리를 API 라우트 직접 호출로 구현 | 구현 간단 | 타임아웃, 재시도 불가, 실패 감지 어려움 | 데이터 100건 미만 임시용 |
| Server Action에서 세션 검증 없이 role 체크 | 코드 간결 | CVE-2025-29927로 우회 가능 | Never |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| NextAuth.js v5 + organizationId | session 타입 확장 없이 `session.user.organizationId` 접근 → TypeScript 에러 | `types/next-auth.d.ts`에서 Session 인터페이스 확장, JWT/session 콜백 모두에서 organizationId 전달 |
| @react-pdf/renderer + 한글 | Variable weight 폰트(Noto Sans KR OTF) 사용 → PDF에 한글 글자 누락 | TTF 형식 Noto Sans KR 다운로드, `Font.register()`로 명시적 등록, 모든 weight별 별도 파일 필요 |
| Puppeteer + 한글 PDF | 폰트 로드 전 PDF 생성 → 한글 깨짐 | `await page.evaluateHandle('document.fonts.ready')` 후 PDF 생성, `--font-render-hinting=none` 플래그 사용 |
| Prisma `$transaction` + 감사 로그 | 트랜잭션 외부에서 로그 기록 → 원자성 깨짐 | 반드시 같은 `$transaction` 블록 내 `tx.auditLog.create()` |
| Prisma Client Extensions + 테넌트 필터 | `findUnique`에 필터가 적용 안 됨 (id로만 조회) | `findUnique` → `findFirst`로 변경 후 `organizationId` 조건 추가 |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| 감사 로그 동기 기록 — 모든 금융 액션마다 추가 INSERT | API 응답시간 증가, 특히 결제 처리 | 감사 로그를 별도 테이블로 분리, 인덱스 최적화(`organizationId + createdAt`) | 조직당 월 10,000건 이상 |
| 일괄 연체 처리 중 전체 스케줄 로드 | 타임아웃, 메모리 과부하 | `SKIP LOCKED` + 배치 단위(100건) 처리, Prisma `cursor` 페이지네이션 | 대출 1,000건 이상 |
| PDF 생성 시 폰트 파일 매번 디스크에서 로드 | 첫 PDF 생성 느림, 연속 생성 시 누적 지연 | 폰트를 모듈 레벨에서 한 번만 `Font.register()` | 동시 요청 10건 이상 |
| 대출 연장 시 기존 스케줄 전체 삭제 후 재생성 | 트랜잭션 시간 길어짐, 잠금 충돌 | CANCELLED 상태로 소프트 삭제, 신규 스케줄만 INSERT | 회차 24개월 이상 대출 |
| `getDashboardStats`에서 organizationId 없이 전체 집계 | 모든 조직 데이터 합산 반환, 조직별 수치 틀림 | 모든 집계 쿼리에 `where: { organizationId }` 추가 | 조직 2개 이상 등록 시 즉시 |

---

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Server Action에서 `loanId`를 입력받아 organizationId 검증 없이 처리 | 다른 조직의 대출 데이터 수정/열람 | 조회 후 `loan.organizationId !== session.user.organizationId`면 즉시 거부 |
| 감사 로그 테이블에 애플리케이션 계정이 UPDATE/DELETE 권한 보유 | 로그 위변조로 금융 분쟁 증거 훼손 | DB 레벨에서 INSERT 전용 역할 분리, 로그 테이블 RLS 정책 |
| 주민번호/사업자번호 감사 로그에 평문 기록 | 개인정보보호법 위반, 감사 로그 자체가 개인정보 유출 통로 | `before`/`after` 필드에 민감 정보 마스킹 또는 필드명만 기록 (`"residentNumber": "***"`) |
| JWT에 role만 저장하고 organizationId 미저장 | 로그인한 사용자가 URL 조작으로 타 조직 접근 | JWT와 session 모두에 `organizationId` 포함, 모든 DB 쿼리에서 session의 organizationId 사용 |
| `ENCRYPTION_KEY` 환경 변수에 기본값 하드코딩 (현재 코드 상태) | 개발 키가 프로덕션에서 사용될 경우 전체 암호화 무력화 | 환경 변수 없으면 서버 시작 자체를 거부하는 검증 로직 추가 |
| Next.js 14.2.35 — CVE-2025-29927 취약 버전 | 미들웨어 인증 우회 (CVSS 9.1) | Next.js 14.2.25 이상으로 업그레이드 (패치 버전) + Server Action 내 인증 이중 검증 |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| 중도상환 처리 후 스케줄 재계산 없이 기존 스케줄 유지 | 직원이 이후 스케줄 금액을 신뢰할 수 없음 | 중도상환 직후 잔여 스케줄 자동 재계산 및 표시 |
| PDF 출력 시 한글 폰트 없는 서버에서 생성 | 계약서에 글자가 깨지거나 빈 박스 표시 | 폰트 파일을 프로젝트에 번들링, 시스템 폰트 의존 금지 |
| 일괄 연체 처리 중 에러 발생 시 부분 성공 상태 | 일부 대출은 업데이트됐고 일부는 안 된 상태 혼재 | 배치 단위로 트랜잭션 처리, 실패 시 해당 배치만 롤백하고 실패 목록 반환 |
| 대출 연장 시 조직별 커스텀 수수료율 무시 | 본사와 지점의 수수료가 동일하게 적용 | 조직 설정(Setting)에서 수수료율을 관리하고 연장 화면에서 실시간 계산 표시 |
| 역할이 없는 사용자의 접근 에러 메시지가 "서버 오류"로 표시 | 직원이 문제를 IT팀에 문의해야만 해결 가능 | 권한 부족 시 명확한 "이 기능은 관리자만 사용할 수 있습니다" 메시지 |

---

## "Looks Done But Isn't" Checklist

- [ ] **멀티테넌트 격리:** 조직 A의 토큰으로 조직 B의 `/loans/[id]` 직접 접근 시 403 반환되는지 확인 — Server Action 내 organizationId 검증 포함
- [ ] **중도상환수수료:** 3년 초과 대출에 수수료 0원이 계산되는지 확인 — 금소법 3년 초과 면제 조항 구현
- [ ] **대출 연장 후 스케줄:** `loanTermMonths`가 실제 연장된 기간으로 업데이트됐는지, 기존 PARTIAL 스케줄이 유지됐는지 확인
- [ ] **감사 로그 불변성:** 감사 로그 레코드를 DB에서 UPDATE/DELETE 시도 시 거부되는지 확인
- [ ] **PDF 한글:** 한글 폰트가 없는 CI 서버에서 PDF 생성 시도 — 폰트 파일이 번들에 포함됐는지 확인
- [ ] **일괄 연체 처리 멱등성:** 같은 날 두 번 실행해도 연체일수가 중복 증가하지 않는지 확인
- [ ] **ENCRYPTION_KEY:** 프로덕션에서 환경 변수 없으면 서버가 시작 거부하는지 확인
- [ ] **세션 만료 중 금융 액션:** 세션 만료 상태에서 Server Action 호출 시 데이터 변경 없이 인증 에러 반환하는지 확인

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| 테넌트 간 데이터 노출 발생 | HIGH | 즉시 서비스 중단 → 감사 로그로 노출 범위 확인 → 영향 조직에 통보 → 개인정보 유출 신고(개보법 72시간 내) |
| 잘못된 중도상환수수료 계산 (다수 건) | HIGH | 영향받은 대출 목록 추출 → 올바른 금액 재계산 → 차액 환급/추가징수 처리 → 감사 로그에 정정 기록 |
| 마이그레이션 실패로 기존 데이터 orphan 발생 | MEDIUM | 백업에서 복구 → 3단계 마이그레이션 전략으로 재실행 → organizationId 없는 레코드 기본 조직 재배정 |
| PDF 한글 깨짐 (이미 발행된 계약서) | MEDIUM | 폰트 수정 후 재생성 → 영향받은 기간의 PDF 재발행 목록 작성 → 고객사에 재발송 |
| 감사 로그 누락 기간 발생 | MEDIUM | 로그 누락 기간 특정 → 같은 기간 Payment/Loan 레코드에서 변경 이력 역추적 → 별도 보정 로그 생성 |
| 일괄 연체 처리 부분 실패 | LOW | 실패한 loanId 목록 확인 → 해당 건만 수동 재실행 → 멱등성 보장돼 있으면 전체 재실행도 안전 |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Server Action 인증 우회 | Phase 1: 인증 시스템 구현 | 모든 Server Action에서 `auth()` 호출 코드 리뷰, 미인증 요청 테스트 |
| 테넌트 간 데이터 노출 | Phase 1: 멀티테넌트 스키마 + Prisma Extension | 크로스 테넌트 접근 테스트 시나리오, RLS 정책 검증 |
| organizationId 마이그레이션 실패 | Phase 1: 멀티테넌트 스키마 마이그레이션 | 스테이징 DB에서 실제 데이터로 마이그레이션 리허설 |
| 감사 로그 원자성 누락 | Phase 2: 감사 로그 구현 | 트랜잭션 롤백 시나리오에서 로그도 함께 롤백되는지 확인 |
| 개인정보 감사 로그 노출 | Phase 2: 감사 로그 구현 | 로그 레코드에서 주민번호/사업자번호 평문 검색 |
| 중도상환수수료 법규 위반 | Phase 3: 중도상환 기능 | 3년 초과 대출 수수료 = 0, 잔여기간 비례 계산 검증 |
| 대출 연장 스케줄 정합성 | Phase 3: 대출 연장 기능 | 연장 전후 잔액 일치, PARTIAL 스케줄 보존 확인 |
| PDF 한글 폰트 누락 | Phase 4: PDF 문서 출력 | CI 환경(폰트 미설치)에서 PDF 생성 테스트 |
| 일괄 처리 멱등성 | Phase 5: 일괄 연체 처리 | 동일 날짜로 2회 실행 후 데이터 상태 확인 |
| ENCRYPTION_KEY 기본값 | Phase 1 (첫 번째) | 환경 변수 없이 서버 기동 시 명시적 에러 발생 확인 |

---

## Sources

- [Auth.js Role Based Access Control](https://authjs.dev/guides/role-based-access-control)
- [CVE-2025-29927 — Next.js Authorization Bypass (CVSS 9.1)](https://jfrog.com/blog/cve-2025-29927-next-js-authorization-bypass/)
- [Secure Next.js Server Actions — 5 Vulnerabilities](https://makerkit.dev/blog/tutorials/secure-nextjs-server-actions)
- [Postgres RLS Implementation Guide — Common Pitfalls](https://www.permit.io/blog/postgres-rls-implementation-guide)
- [Multi-tenant data isolation with PostgreSQL RLS (AWS)](https://aws.amazon.com/blogs/database/multi-tenant-data-isolation-with-postgresql-row-level-security/)
- [Prisma Multi-Tenancy — Making where Required](https://medium.com/@kz-d/multi-tenancy-with-prisma-a-new-approach-to-making-where-required-1e93a3783d9d)
- [React-PDF Korean Font Issue #806](https://github.com/diegomura/react-pdf/issues/806)
- [React-PDF Font Registration](https://react-pdf.org/fonts)
- [Puppeteer Non-Latin Font Support](https://medium.com/@surasith_aof/generate-pdf-support-non-latin-fonts-with-puppeteer-d6ca6c982f1c)
- [금융소비자보호 감독규정 개정 — 중도상환수수료](https://www.fsc.go.kr/po010105/82646)
- [중도상환수수료 2025년 인하 — 한국경제](https://www.hankyung.com/article/2024111021901)
- [Immutable Audit Trails — Best Practices](https://www.hubifi.com/blog/immutable-audit-log-basics)
- [PostgreSQL Explicit Locking — SKIP LOCKED](https://www.postgresql.org/docs/current/explicit-locking.html)
- [Designing Postgres Database for Multi-tenancy (Crunchy Data)](https://www.crunchydata.com/blog/designing-your-postgres-database-for-multi-tenancy)

---
*Pitfalls research for: 대출관리 SaaS 고도화 (Next.js 14 + Prisma + PostgreSQL)*
*Researched: 2026-03-26*
