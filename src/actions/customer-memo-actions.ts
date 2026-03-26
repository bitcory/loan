"use server";

import { authenticatedAction } from "@/lib/safe-action";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export async function getCustomerMemos(customerId: string) {
  const session = await getServerSession(authOptions);
  if (!session) return [];

  return prisma.customerMemo.findMany({
    where: {
      organizationId: session.user.organizationId,
      customerId,
    },
    orderBy: { createdAt: "desc" },
    include: {
      customer: { select: { name: true } },
    },
  });
}

export const createCustomerMemo = authenticatedAction
  .schema(z.object({
    customerId: z.string(),
    content: z.string().min(1, "내용을 입력하세요").max(1000),
  }))
  .action(async ({ parsedInput, ctx }) => {
    await prisma.customerMemo.create({
      data: {
        organizationId: ctx.organizationId,
        customerId: parsedInput.customerId,
        userId: ctx.userId,
        content: parsedInput.content,
      },
    });
    revalidatePath(`/customers/${parsedInput.customerId}`);
    return { success: true };
  });

export const deleteCustomerMemo = authenticatedAction
  .schema(z.object({ memoId: z.string(), customerId: z.string() }))
  .action(async ({ parsedInput, ctx }) => {
    await prisma.customerMemo.deleteMany({
      where: {
        id: parsedInput.memoId,
        organizationId: ctx.organizationId,
        userId: ctx.userId, // 본인 메모만 삭제 가능
      },
    });
    revalidatePath(`/customers/${parsedInput.customerId}`);
    return { success: true };
  });
