"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getTenantClient } from "@/lib/prisma";
import { authenticatedAction, adminAction } from "@/lib/safe-action";
import { customerSchema } from "@/lib/validators";
import { encrypt, decrypt } from "@/lib/encryption";
import { generateCustomerNumber } from "@/lib/customer-number";
import { revalidatePath } from "next/cache";
import { z } from "zod";

// ---- READ functions (called from Server Components) ----

export async function getCustomers(params?: {
  search?: string;
  type?: string;
  page?: number;
  pageSize?: number;
}) {
  const session = await getServerSession(authOptions);
  if (!session) throw new Error("인증이 필요합니다.");
  const db = getTenantClient(session.user.organizationId);

  const { search, type, page = 1, pageSize = 20 } = params || {};
  const where: Record<string, unknown> = {};

  if (search) {
    where.OR = [
      { customerNumber: { contains: search, mode: "insensitive" } },
      { name: { contains: search, mode: "insensitive" } },
      { phone: { contains: search } },
      { email: { contains: search, mode: "insensitive" } },
    ];
  }
  if (type) {
    where.customerType = type;
  }

  const [customers, total] = await Promise.all([
    db.customer.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        _count: { select: { loans: true, collaterals: true } },
      },
    }),
    db.customer.count({ where }),
  ]);

  return { customers, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
}

export async function getCustomer(id: string) {
  const session = await getServerSession(authOptions);
  if (!session) throw new Error("인증이 필요합니다.");
  const db = getTenantClient(session.user.organizationId);

  const customer = await db.customer.findFirst({
    where: { id },
    include: {
      collaterals: {
        include: { mortgages: true },
      },
      loans: {
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (customer && customer.residentNumber) {
    try {
      customer.residentNumber = decrypt(customer.residentNumber);
    } catch {
      // 이미 복호화된 데이터이거나 오류인 경우
    }
  }

  return customer;
}

export async function getAllCustomers() {
  const session = await getServerSession(authOptions);
  if (!session) throw new Error("인증이 필요합니다.");
  const db = getTenantClient(session.user.organizationId);

  return db.customer.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, phone: true, customerType: true },
  });
}

// ---- MUTATIONS (safe-action wrapped) ----

export const createCustomer = authenticatedAction
  .schema(customerSchema)
  .action(async ({ parsedInput, ctx }) => {
    const { residentNumber, ...rest } = parsedInput;
    const encrypted = residentNumber ? encrypt(residentNumber.replace(/-/g, "")) : null;
    const customerNumber = await generateCustomerNumber(ctx.db);

    const customer = await ctx.db.customer.create({
      data: {
        ...rest,
        organizationId: ctx.organizationId,
        customerNumber,
        residentNumber: encrypted,
      },
    });

    revalidatePath("/customers");
    return { success: true, id: customer.id };
  });

export const updateCustomer = authenticatedAction
  .schema(z.object({ id: z.string(), data: customerSchema }))
  .action(async ({ parsedInput, ctx }) => {
    const { residentNumber, ...rest } = parsedInput.data;
    const encrypted = residentNumber ? encrypt(residentNumber.replace(/-/g, "")) : undefined;

    await ctx.db.customer.update({
      where: { id: parsedInput.id },
      data: {
        ...rest,
        ...(encrypted !== undefined && { residentNumber: encrypted }),
      },
    });

    revalidatePath("/customers");
    revalidatePath(`/customers/${parsedInput.id}`);
    return { success: true };
  });

export const deleteCustomer = adminAction
  .schema(z.object({ id: z.string() }))
  .action(async ({ parsedInput, ctx }) => {
    const loans = await ctx.db.loan.count({
      where: { customerId: parsedInput.id, status: { in: ["ACTIVE", "OVERDUE"] } },
    });

    if (loans > 0) {
      throw new Error("활성 대출이 있는 고객은 삭제할 수 없습니다.");
    }

    await ctx.db.customer.delete({ where: { id: parsedInput.id } });
    revalidatePath("/customers");
    return { success: true };
  });
