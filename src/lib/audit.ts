import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";

export type AuditAction = "CREATE" | "UPDATE" | "DELETE";

export interface AuditContext {
  userId: string;
  organizationId: string;
  ipAddress?: string;
}

// PII 마스킹 대상 필드명 whitelist
const PII_FIELDS = new Set(["residentNumber", "businessNumber"]);

// 민감정보 필드를 재귀적으로 마스킹한다.
// Date 객체는 재귀 대상에서 제외한다 (typeof "object"이지만 entries()가 없음).
export function maskPii(data: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (PII_FIELDS.has(key) && value) {
      result[key] = "***MASKED***";
    } else if (
      value !== null &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      !(value instanceof Date)
    ) {
      result[key] = maskPii(value as Record<string, unknown>);
    } else {
      result[key] = value;
    }
  }
  return result;
}

// DB 레코드를 감사 로그 스냅샷으로 변환한다.
// - passwordHash, organizationId, updatedAt 제거
// - Prisma Decimal → number 변환 (JSON.stringify 대응)
// - Date → ISO 문자열 변환
// - PII 마스킹 적용
export function sanitizeForLog(record: Record<string, unknown>): Record<string, unknown> {
  const EXCLUDED = new Set(["passwordHash", "organizationId", "updatedAt"]);
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(record)) {
    if (EXCLUDED.has(k)) continue;
    if (v !== null && typeof (v as { toNumber?: unknown }).toNumber === "function") {
      out[k] = (v as { toNumber(): number }).toNumber();
    } else if (v instanceof Date) {
      out[k] = v.toISOString();
    } else {
      out[k] = v;
    }
  }
  return maskPii(out);
}

// 요청 헤더에서 클라이언트 IP를 추출한다.
// x-forwarded-for는 프록시 체인을 거치면 콤마 구분 목록이 될 수 있으므로 첫 번째만 사용.
// 서버 액션 컨텍스트 외부에서 호출되면 undefined를 반환한다 (에러 전파 안 함).
export function getClientIp(): string | undefined {
  try {
    const h = headers();
    return (
      h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      h.get("x-real-ip") ||
      undefined
    );
  } catch {
    return undefined;
  }
}

// 감사 로그를 audit_logs 테이블에 기록한다.
// 중요: basePrisma(prisma)를 사용한다 — 테넌트 extension(ctx.db)은 AuditLog를 포함하지 않는다.
// 중요: 내부 에러는 console.error로 출력하되 절대 throw하지 않는다.
//        감사 로그 실패가 비즈니스 로직을 중단해서는 안 된다.
// 중요: logAudit은 뮤테이션 DB write가 성공한 후 호출되어야 한다.
//        뮤테이션 트랜잭션 내부에서 호출하지 말 것 (롤백 시 로그도 사라짐).
export async function logAudit(
  ctx: AuditContext,
  entityType: string,
  entityId: string,
  action: AuditAction,
  before: Record<string, unknown> | null,
  after: Record<string, unknown> | null,
): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        organizationId: ctx.organizationId,
        userId: ctx.userId,
        entityType,
        entityId,
        action,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        before: before ? (maskPii(before) as any) : undefined,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        after: after ? (maskPii(after) as any) : undefined,
        ipAddress: ctx.ipAddress,
      },
    });
  } catch (err) {
    // 감사 로그 실패는 콘솔에만 기록 — 호출 측에 예외를 전파하지 않는다
    console.error("[audit] 감사 로그 기록 실패:", err);
  }
}
