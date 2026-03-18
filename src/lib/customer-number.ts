import { prisma } from "./prisma";

/**
 * 고객번호 자동생성: C-NNNN (순차 증가)
 */
export async function generateCustomerNumber(): Promise<string> {
  const last = await prisma.customer.findFirst({
    orderBy: { customerNumber: "desc" },
    select: { customerNumber: true },
  });

  let seq = 1;
  if (last) {
    const num = parseInt(last.customerNumber.replace("C-", ""), 10);
    seq = num + 1;
  }

  return `C-${seq.toString().padStart(4, "0")}`;
}
