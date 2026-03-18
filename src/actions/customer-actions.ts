"use server";

import { prisma } from "@/lib/prisma";
import { customerSchema } from "@/lib/validators";
import { encrypt, decrypt } from "@/lib/encryption";
import { generateCustomerNumber } from "@/lib/customer-number";
import { revalidatePath } from "next/cache";

export async function getCustomers(params?: {
  search?: string;
  type?: string;
  page?: number;
  pageSize?: number;
}) {
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
    prisma.customer.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        _count: { select: { loans: true, collaterals: true } },
      },
    }),
    prisma.customer.count({ where }),
  ]);

  return { customers, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
}

export async function getCustomer(id: string) {
  const customer = await prisma.customer.findUnique({
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

export async function createCustomer(data: FormData) {
  const raw = Object.fromEntries(data.entries());
  const parsed = customerSchema.safeParse(raw);

  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors };
  }

  const { residentNumber, ...rest } = parsed.data;
  const encrypted = residentNumber ? encrypt(residentNumber.replace(/-/g, "")) : null;
  const customerNumber = await generateCustomerNumber();

  const customer = await prisma.customer.create({
    data: {
      ...rest,
      customerNumber,
      residentNumber: encrypted,
    },
  });

  revalidatePath("/customers");
  return { success: true, id: customer.id };
}

export async function updateCustomer(id: string, data: FormData) {
  const raw = Object.fromEntries(data.entries());
  const parsed = customerSchema.safeParse(raw);

  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors };
  }

  const { residentNumber, ...rest } = parsed.data;
  const encrypted = residentNumber ? encrypt(residentNumber.replace(/-/g, "")) : undefined;

  await prisma.customer.update({
    where: { id },
    data: {
      ...rest,
      ...(encrypted !== undefined && { residentNumber: encrypted }),
    },
  });

  revalidatePath("/customers");
  revalidatePath(`/customers/${id}`);
  return { success: true };
}

export async function deleteCustomer(id: string) {
  const loans = await prisma.loan.count({
    where: { customerId: id, status: { in: ["ACTIVE", "OVERDUE"] } },
  });

  if (loans > 0) {
    return { error: "활성 대출이 있는 고객은 삭제할 수 없습니다." };
  }

  await prisma.customer.delete({ where: { id } });
  revalidatePath("/customers");
  return { success: true };
}

export async function getAllCustomers() {
  return prisma.customer.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, phone: true, customerType: true },
  });
}
