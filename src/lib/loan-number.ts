import { format } from "date-fns";
import { getTenantClient } from "@/lib/prisma";

type TenantDb = ReturnType<typeof getTenantClient>;

/**
 * 대출번호 자동생성: YYYYMMDD-NNNN
 * TenantDb 를 주입받아 테넌트 격리 쿼리 실행
 */
export async function generateLoanNumber(db: TenantDb, date?: Date): Promise<string> {
  const d = date || new Date();
  const prefix = format(d, "yyyyMMdd");

  const lastLoan = await db.loan.findFirst({
    where: {
      loanNumber: { startsWith: prefix },
    },
    orderBy: { loanNumber: "desc" },
  });

  let seq = 1;
  if (lastLoan) {
    const parts = lastLoan.loanNumber.split("-");
    seq = parseInt(parts[1], 10) + 1;
  }

  return `${prefix}-${seq.toString().padStart(4, "0")}`;
}
