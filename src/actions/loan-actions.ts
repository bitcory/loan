"use server";

import { prisma } from "@/lib/prisma";
import { loanSchema, paymentSchema } from "@/lib/validators";
import { generateLoanNumber } from "@/lib/loan-number";
import { generateSchedule } from "@/lib/schedule-generator";
import { revalidatePath } from "next/cache";
import { Decimal } from "decimal.js";
import { addMonths, parseISO } from "date-fns";

export async function getLoans(params?: {
  search?: string;
  status?: string;
  customerId?: string;
  page?: number;
  pageSize?: number;
}) {
  const { search, status, customerId, page = 1, pageSize = 20 } = params || {};
  const where: Record<string, unknown> = {};

  if (search) {
    where.OR = [
      { loanNumber: { contains: search } },
      { customer: { name: { contains: search, mode: "insensitive" } } },
    ];
  }
  if (status) where.status = status;
  if (customerId) where.customerId = customerId;

  const [loans, total] = await Promise.all([
    prisma.loan.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        customer: { select: { id: true, name: true, phone: true } },
        collateral: { select: { id: true, address: true, collateralType: true } },
      },
    }),
    prisma.loan.count({ where }),
  ]);

  return { loans, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
}

export async function getLoan(id: string) {
  return prisma.loan.findUnique({
    where: { id },
    include: {
      customer: true,
      collateral: {
        include: { mortgages: { orderBy: { rank: "asc" } } },
      },
      schedules: { orderBy: { installmentNumber: "asc" } },
      payments: { orderBy: { paymentDate: "desc" } },
    },
  });
}

export async function createLoan(data: FormData) {
  const raw = Object.fromEntries(data.entries());
  const parsed = loanSchema.safeParse(raw);

  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors };
  }

  const { customerId, collateralId, loanAmount, interestRate, repaymentType, loanTermMonths, startDate, memo } = parsed.data;
  const start = parseISO(startDate);
  const endDate = addMonths(start, loanTermMonths);
  const loanNumber = await generateLoanNumber(start);

  // 스케줄 생성
  const scheduleItems = generateSchedule(
    loanAmount,
    interestRate,
    repaymentType,
    start,
    loanTermMonths
  );

  const loan = await prisma.loan.create({
    data: {
      loanNumber,
      customerId,
      collateralId: collateralId || null,
      loanAmount,
      balance: loanAmount,
      interestRate,
      repaymentType,
      loanTermMonths,
      startDate: start,
      endDate,
      status: "ACTIVE",
      memo: memo || null,
      schedules: {
        create: scheduleItems.map((s) => ({
          installmentNumber: s.installmentNumber,
          dueDate: s.dueDate,
          principalAmount: s.principalAmount.toNumber(),
          interestAmount: s.interestAmount.toNumber(),
          totalAmount: s.totalAmount.toNumber(),
          remainingBalance: s.remainingBalance.toNumber(),
        })),
      },
    },
  });

  revalidatePath("/loans");
  revalidatePath("/dashboard");
  return { success: true, id: loan.id, loanNumber };
}

export async function processPayment(data: FormData) {
  const raw = Object.fromEntries(data.entries());
  const parsed = paymentSchema.safeParse(raw);

  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors };
  }

  const { loanId, scheduleId, paymentDate, principalAmount, interestAmount, overdueAmount, memo } = parsed.data;
  const totalAmount = principalAmount + interestAmount + (overdueAmount || 0);

  // 대출 잔액 업데이트
  const loan = await prisma.loan.findUnique({ where: { id: loanId } });
  if (!loan) return { error: "대출을 찾을 수 없습니다." };

  const newBalance = new Decimal(loan.balance.toString()).minus(principalAmount);

  await prisma.$transaction(async (tx) => {
    // 수납 기록 생성
    await tx.payment.create({
      data: {
        loanId,
        paymentDate: parseISO(paymentDate),
        principalAmount,
        interestAmount,
        overdueAmount: overdueAmount || 0,
        totalAmount,
        memo: memo || null,
      },
    });

    // 대출 잔액 업데이트
    const updateData: Record<string, unknown> = {
      balance: newBalance.toNumber(),
    };
    if (newBalance.isZero() || newBalance.lessThanOrEqualTo(0)) {
      updateData.status = "COMPLETED";
    }
    await tx.loan.update({ where: { id: loanId }, data: updateData });

    // 스케줄 상태 업데이트
    if (scheduleId) {
      const schedule = await tx.loanSchedule.findUnique({ where: { id: scheduleId } });
      if (schedule) {
        const newPaid = new Decimal(schedule.paidAmount.toString()).plus(totalAmount);
        const scheduleTotal = new Decimal(schedule.totalAmount.toString());
        const status = newPaid.greaterThanOrEqualTo(scheduleTotal) ? "PAID" : "PARTIAL";

        await tx.loanSchedule.update({
          where: { id: scheduleId },
          data: {
            paidAmount: newPaid.toNumber(),
            paidDate: parseISO(paymentDate),
            status,
          },
        });
      }
    }
  });

  revalidatePath("/loans");
  revalidatePath(`/loans/${loanId}`);
  revalidatePath("/dashboard");
  return { success: true };
}

export async function getLoanSchedules(loanId: string) {
  return prisma.loanSchedule.findMany({
    where: { loanId },
    orderBy: { installmentNumber: "asc" },
  });
}

export async function getDashboardStats() {
  const [
    totalLoans,
    activeLoans,
    totalBalance,
    todayLoans,
    overdueLoans,
    upcomingPayments,
  ] = await Promise.all([
    prisma.loan.count(),
    prisma.loan.count({ where: { status: "ACTIVE" } }),
    prisma.loan.aggregate({
      where: { status: { in: ["ACTIVE", "OVERDUE"] } },
      _sum: { balance: true },
    }),
    prisma.loan.count({
      where: {
        createdAt: {
          gte: new Date(new Date().setHours(0, 0, 0, 0)),
        },
      },
    }),
    prisma.loan.count({
      where: { status: "OVERDUE" },
    }),
    prisma.loanSchedule.count({
      where: {
        status: "SCHEDULED",
        dueDate: {
          gte: new Date(),
          lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      },
    }),
  ]);

  return {
    totalLoans,
    activeLoans,
    totalBalance: totalBalance._sum.balance?.toString() || "0",
    todayLoans,
    overdueLoans,
    upcomingPayments,
  };
}

export async function getOverdueLoans(params?: {
  stage?: string;
  page?: number;
  pageSize?: number;
}) {
  const { stage, page = 1, pageSize = 20 } = params || {};

  // 연체 스케줄이 있는 대출을 찾기
  const today = new Date();
  const overdueSchedules = await prisma.loanSchedule.findMany({
    where: {
      status: { in: ["SCHEDULED", "PARTIAL"] },
      dueDate: { lt: today },
    },
    include: {
      loan: {
        include: {
          customer: { select: { id: true, name: true, phone: true } },
        },
      },
    },
    orderBy: { dueDate: "asc" },
  });

  // 대출별로 그룹핑하고 연체일수 계산
  const loanMap = new Map<string, {
    loan: typeof overdueSchedules[0]["loan"];
    overdueDays: number;
    overdueAmount: number;
    overdueStage: string;
  }>();

  for (const schedule of overdueSchedules) {
    const days = Math.floor((today.getTime() - schedule.dueDate.getTime()) / (1000 * 60 * 60 * 24));
    const remaining = new Decimal(schedule.totalAmount.toString()).minus(schedule.paidAmount.toString()).toNumber();

    if (!loanMap.has(schedule.loanId)) {
      let overdueStage = "NORMAL";
      if (days >= 91) overdueStage = "STAGE_3";
      else if (days >= 31) overdueStage = "STAGE_2";
      else if (days >= 1) overdueStage = "STAGE_1";

      loanMap.set(schedule.loanId, {
        loan: schedule.loan,
        overdueDays: days,
        overdueAmount: remaining,
        overdueStage,
      });
    } else {
      const existing = loanMap.get(schedule.loanId)!;
      existing.overdueAmount += remaining;
      if (days > existing.overdueDays) {
        existing.overdueDays = days;
        if (days >= 91) existing.overdueStage = "STAGE_3";
        else if (days >= 31) existing.overdueStage = "STAGE_2";
        else existing.overdueStage = "STAGE_1";
      }
    }
  }

  let results = Array.from(loanMap.values());
  if (stage && stage !== "ALL") {
    results = results.filter((r) => r.overdueStage === stage);
  }

  const total = results.length;
  const paged = results.slice((page - 1) * pageSize, page * pageSize);

  return {
    overdueLoans: paged,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

export async function getMonthlyStats() {
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
  sixMonthsAgo.setDate(1);
  sixMonthsAgo.setHours(0, 0, 0, 0);

  const loans = await prisma.loan.findMany({
    where: { createdAt: { gte: sixMonthsAgo } },
    select: { createdAt: true, loanAmount: true },
  });

  const payments = await prisma.payment.findMany({
    where: { createdAt: { gte: sixMonthsAgo } },
    select: { createdAt: true, totalAmount: true },
  });

  const monthlyData: Record<string, { month: string; disbursed: number; collected: number }> = {};

  for (let i = 0; i < 6; i++) {
    const d = new Date();
    d.setMonth(d.getMonth() - (5 - i));
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    monthlyData[key] = { month: key, disbursed: 0, collected: 0 };
  }

  for (const loan of loans) {
    const key = `${loan.createdAt.getFullYear()}-${String(loan.createdAt.getMonth() + 1).padStart(2, "0")}`;
    if (monthlyData[key]) {
      monthlyData[key].disbursed += Number(loan.loanAmount);
    }
  }

  for (const payment of payments) {
    const key = `${payment.createdAt.getFullYear()}-${String(payment.createdAt.getMonth() + 1).padStart(2, "0")}`;
    if (monthlyData[key]) {
      monthlyData[key].collected += Number(payment.totalAmount);
    }
  }

  return Object.values(monthlyData);
}
