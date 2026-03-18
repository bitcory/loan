import { format } from "date-fns";
import { prisma } from "./prisma";

/**
 * 대출번호 자동생성: YYYYMMDD-NNNN
 */
export async function generateLoanNumber(date?: Date): Promise<string> {
  const d = date || new Date();
  const prefix = format(d, "yyyyMMdd");

  const lastLoan = await prisma.loan.findFirst({
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
