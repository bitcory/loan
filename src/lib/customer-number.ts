import { getTenantClient } from "@/lib/prisma";

type TenantDb = ReturnType<typeof getTenantClient>;

/**
 * 고객번호 자동생성: C-NNNN (순차 증가)
 * TenantDb 를 주입받아 테넌트 격리 쿼리 실행
 */
export async function generateCustomerNumber(db: TenantDb): Promise<string> {
  const last = await db.customer.findFirst({
    orderBy: { customerNumber: "desc" },
    select: { customerNumber: true },
  });
  const next = last
    ? parseInt(last.customerNumber.replace("C-", ""), 10) + 1
    : 1;
  return `C-${String(next).padStart(4, "0")}`;
}
