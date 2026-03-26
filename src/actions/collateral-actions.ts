"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getTenantClient } from "@/lib/prisma";
import { authenticatedAction, adminAction } from "@/lib/safe-action";
import { collateralSchema, mortgageSchema } from "@/lib/validators";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { logAudit, sanitizeForLog, getClientIp } from "@/lib/audit";

// ---- READ functions (called from Server Components) ----

export async function getCollaterals(params?: {
  search?: string;
  customerId?: string;
  type?: string;
  page?: number;
  pageSize?: number;
}) {
  const session = await getServerSession(authOptions);
  if (!session) throw new Error("인증이 필요합니다.");
  const db = getTenantClient(session.user.organizationId);

  const { search, customerId, type, page = 1, pageSize = 20 } = params || {};
  const where: Record<string, unknown> = {};

  if (search) {
    where.OR = [
      { address: { contains: search, mode: "insensitive" } },
      { customer: { name: { contains: search, mode: "insensitive" } } },
    ];
  }
  if (customerId) where.customerId = customerId;
  if (type) where.collateralType = type;

  const [collaterals, total] = await Promise.all([
    db.collateral.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        customer: { select: { id: true, name: true } },
        mortgages: { orderBy: { rank: "asc" } },
        _count: { select: { loans: true } },
      },
    }),
    db.collateral.count({ where }),
  ]);

  return { collaterals, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
}

export async function getCollateral(id: string) {
  const session = await getServerSession(authOptions);
  if (!session) throw new Error("인증이 필요합니다.");
  const db = getTenantClient(session.user.organizationId);

  return db.collateral.findFirst({
    where: { id },
    include: {
      customer: true,
      mortgages: { orderBy: { rank: "asc" } },
      loans: {
        include: { customer: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
      },
    },
  });
}

export async function getCustomerCollaterals(customerId: string) {
  const session = await getServerSession(authOptions);
  if (!session) throw new Error("인증이 필요합니다.");
  const db = getTenantClient(session.user.organizationId);

  return db.collateral.findMany({
    where: { customerId },
    include: {
      mortgages: { orderBy: { rank: "asc" } },
    },
    orderBy: { createdAt: "desc" },
  });
}

// ---- MUTATIONS (safe-action wrapped) ----

export const createCollateral = authenticatedAction
  .schema(collateralSchema)
  .action(async ({ parsedInput, ctx }) => {
    const collateral = await ctx.db.collateral.create({
      data: { ...parsedInput, organizationId: ctx.organizationId },
    });

    await logAudit(
      { userId: ctx.userId, organizationId: ctx.organizationId, ipAddress: getClientIp() },
      "Collateral",
      collateral.id,
      "CREATE",
      null,
      sanitizeForLog(parsedInput as unknown as Record<string, unknown>),
    );

    revalidatePath("/collaterals");
    return { success: true, id: collateral.id };
  });

export const updateCollateral = authenticatedAction
  .schema(z.object({ id: z.string(), data: collateralSchema }))
  .action(async ({ parsedInput, ctx }) => {
    const existing = await ctx.db.collateral.findFirst({ where: { id: parsedInput.id } });

    await ctx.db.collateral.update({
      where: { id: parsedInput.id },
      data: parsedInput.data,
    });

    await logAudit(
      { userId: ctx.userId, organizationId: ctx.organizationId, ipAddress: getClientIp() },
      "Collateral",
      parsedInput.id,
      "UPDATE",
      existing ? sanitizeForLog(existing as unknown as Record<string, unknown>) : null,
      sanitizeForLog(parsedInput.data as unknown as Record<string, unknown>),
    );

    revalidatePath("/collaterals");
    revalidatePath(`/collaterals/${parsedInput.id}`);
    return { success: true };
  });

export const deleteCollateral = adminAction
  .schema(z.object({ id: z.string() }))
  .action(async ({ parsedInput, ctx }) => {
    const loans = await ctx.db.loan.count({
      where: { collateralId: parsedInput.id, status: { in: ["ACTIVE", "OVERDUE"] } },
    });

    if (loans > 0) {
      throw new Error("활성 대출이 연결된 담보물건은 삭제할 수 없습니다.");
    }

    const existing = await ctx.db.collateral.findFirst({ where: { id: parsedInput.id } });

    await ctx.db.collateral.delete({ where: { id: parsedInput.id } });

    await logAudit(
      { userId: ctx.userId, organizationId: ctx.organizationId, ipAddress: getClientIp() },
      "Collateral",
      parsedInput.id,
      "DELETE",
      existing ? sanitizeForLog(existing as unknown as Record<string, unknown>) : null,
      null,
    );

    revalidatePath("/collaterals");
    return { success: true };
  });

// 근저당 관리

export const createMortgage = authenticatedAction
  .schema(mortgageSchema)
  .action(async ({ parsedInput, ctx }) => {
    const mortgage = await ctx.db.mortgage.create({ data: { ...parsedInput, organizationId: ctx.organizationId } });

    await logAudit(
      { userId: ctx.userId, organizationId: ctx.organizationId, ipAddress: getClientIp() },
      "Mortgage",
      mortgage.id,
      "CREATE",
      null,
      sanitizeForLog(parsedInput as unknown as Record<string, unknown>),
    );

    revalidatePath("/collaterals");
    return { success: true };
  });

export const updateMortgage = authenticatedAction
  .schema(z.object({ id: z.string(), data: mortgageSchema }))
  .action(async ({ parsedInput, ctx }) => {
    const existing = await ctx.db.mortgage.findFirst({ where: { id: parsedInput.id } });

    await ctx.db.mortgage.update({ where: { id: parsedInput.id }, data: parsedInput.data });

    await logAudit(
      { userId: ctx.userId, organizationId: ctx.organizationId, ipAddress: getClientIp() },
      "Mortgage",
      parsedInput.id,
      "UPDATE",
      existing ? sanitizeForLog(existing as unknown as Record<string, unknown>) : null,
      sanitizeForLog(parsedInput.data as unknown as Record<string, unknown>),
    );

    revalidatePath("/collaterals");
    return { success: true };
  });

export const deleteMortgage = adminAction
  .schema(z.object({ id: z.string() }))
  .action(async ({ parsedInput, ctx }) => {
    const existing = await ctx.db.mortgage.findFirst({ where: { id: parsedInput.id } });

    await ctx.db.mortgage.delete({ where: { id: parsedInput.id } });

    await logAudit(
      { userId: ctx.userId, organizationId: ctx.organizationId, ipAddress: getClientIp() },
      "Mortgage",
      parsedInput.id,
      "DELETE",
      existing ? sanitizeForLog(existing as unknown as Record<string, unknown>) : null,
      null,
    );

    revalidatePath("/collaterals");
    return { success: true };
  });
