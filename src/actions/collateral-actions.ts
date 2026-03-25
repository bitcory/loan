"use server";

import { prisma } from "@/lib/prisma";
import { collateralSchema, mortgageSchema } from "@/lib/validators";
import { revalidatePath } from "next/cache";

// TODO(01-03): Replace with session-derived organizationId
const DEFAULT_ORG_ID = "default-org-001";

export async function getCollaterals(params?: {
  search?: string;
  customerId?: string;
  type?: string;
  page?: number;
  pageSize?: number;
}) {
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
    prisma.collateral.findMany({
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
    prisma.collateral.count({ where }),
  ]);

  return { collaterals, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
}

export async function getCollateral(id: string) {
  return prisma.collateral.findUnique({
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

export async function createCollateral(data: FormData) {
  const raw = Object.fromEntries(data.entries());
  const parsed = collateralSchema.safeParse(raw);

  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors };
  }

  const collateral = await prisma.collateral.create({
    data: { ...parsed.data, organizationId: DEFAULT_ORG_ID },
  });

  revalidatePath("/collaterals");
  return { success: true, id: collateral.id };
}

export async function updateCollateral(id: string, data: FormData) {
  const raw = Object.fromEntries(data.entries());
  const parsed = collateralSchema.safeParse(raw);

  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors };
  }

  await prisma.collateral.update({
    where: { id },
    data: parsed.data,
  });

  revalidatePath("/collaterals");
  revalidatePath(`/collaterals/${id}`);
  return { success: true };
}

export async function deleteCollateral(id: string) {
  const loans = await prisma.loan.count({
    where: { collateralId: id, status: { in: ["ACTIVE", "OVERDUE"] } },
  });

  if (loans > 0) {
    return { error: "활성 대출이 연결된 담보물건은 삭제할 수 없습니다." };
  }

  await prisma.collateral.delete({ where: { id } });
  revalidatePath("/collaterals");
  return { success: true };
}

export async function getCustomerCollaterals(customerId: string) {
  return prisma.collateral.findMany({
    where: { customerId },
    include: {
      mortgages: { orderBy: { rank: "asc" } },
    },
    orderBy: { createdAt: "desc" },
  });
}

// 근저당 관리
export async function createMortgage(data: FormData) {
  const raw = Object.fromEntries(data.entries());
  const parsed = mortgageSchema.safeParse(raw);

  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors };
  }

  await prisma.mortgage.create({ data: { ...parsed.data, organizationId: DEFAULT_ORG_ID } });
  revalidatePath("/collaterals");
  return { success: true };
}

export async function updateMortgage(id: string, data: FormData) {
  const raw = Object.fromEntries(data.entries());
  const parsed = mortgageSchema.safeParse(raw);

  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors };
  }

  await prisma.mortgage.update({ where: { id }, data: parsed.data });
  revalidatePath("/collaterals");
  return { success: true };
}

export async function deleteMortgage(id: string) {
  await prisma.mortgage.delete({ where: { id } });
  revalidatePath("/collaterals");
  return { success: true };
}
