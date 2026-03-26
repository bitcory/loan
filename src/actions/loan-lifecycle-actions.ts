"use server";

import { authenticatedAction, adminAction } from "@/lib/safe-action";
import { extendLoanSchema, prepaymentSchema } from "@/lib/validators";
import {
  calculatePrepaymentFee,
  recalculateSchedule,
  settleOverdueInterest,
} from "@/lib/loan-calculator";
import { logAudit, sanitizeForLog, getClientIp } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import { parseISO } from "date-fns";
import { Decimal } from "decimal.js";
import { z } from "zod";

// ────────────────────────────────────────────────────────────────────────────
// extendLoan — 대출 만기 연장 (LOAN-01, LOAN-02, LOAN-03)
// ────────────────────────────────────────────────────────────────────────────
export const extendLoan = adminAction
  .schema(extendLoanSchema)
  .action(async ({ parsedInput, ctx }) => {
    const { loanId, newEndDate, newInterestRate, settleOverdueNow, memo } = parsedInput;

    const loan = await ctx.db.loan.findFirst({
      where: { id: loanId },
      include: { schedules: { orderBy: { installmentNumber: "asc" } } },
    });
    if (!loan) throw new Error("대출을 찾을 수 없습니다.");
    if (loan.status === "COMPLETED") throw new Error("완료된 대출은 연장할 수 없습니다.");

    const extensionDate = new Date(); // 연장 실행일 = 오늘
    const newEnd = parseISO(newEndDate);
    const newRate = newInterestRate
      ? new Decimal(newInterestRate)
      : new Decimal(loan.interestRate.toString());

    // 연체이자 정산 금액 계산 (LOAN-02)
    let overdueInterestAmount = new Decimal(0);
    if (settleOverdueNow) {
      const overdueRateSetting = await ctx.db.setting.findFirst({
        where: { key: "overdue_rate_addition" },
      });
      const addRate = new Decimal(overdueRateSetting?.value ?? "3");
      const overdueRate = new Decimal(loan.interestRate.toString()).plus(addRate);

      const settlementResult = settleOverdueInterest(
        loan.schedules.map((s) => ({ ...s, id: s.id })),
        overdueRate,
        extensionDate
      );
      overdueInterestAmount = settlementResult.totalOverdueInterest;
    }

    // 새 스케줄 계산 (LOAN-03)
    const newScheduleItems = recalculateSchedule(
      loan,
      extensionDate,
      newEnd,
      newRate
    );

    const beforeSnapshot = sanitizeForLog(loan as unknown as Record<string, unknown>);

    // 트랜잭션: 연체이자 Payment 생성 → Loan 업데이트 → 스케줄 교체 (LOAN-01, LOAN-03)
    await ctx.db.$transaction(async (tx) => {
      // 연체이자가 있으면 Payment 레코드 생성
      if (overdueInterestAmount.greaterThan(0)) {
        await tx.payment.create({
          data: {
            organizationId: ctx.organizationId,
            loanId: loan.id,
            paymentDate: extensionDate,
            principalAmount: 0,
            interestAmount: 0,
            overdueAmount: overdueInterestAmount.toNumber(),
            totalAmount: overdueInterestAmount.toNumber(),
            memo: `만기 연장 시 연체이자 정산`,
          },
        });
      }

      // 연체 스케줄 상태 업데이트
      if (settleOverdueNow) {
        await tx.loanSchedule.updateMany({
          where: {
            loanId: loan.id,
            organizationId: ctx.organizationId,
            dueDate: { lt: extensionDate },
            status: { in: ["OVERDUE", "PARTIAL", "SCHEDULED"] },
          },
          data: { status: "PAID", paidDate: extensionDate },
        });
      }

      // 기존 미납 스케줄 삭제 — organizationId 필수 (extension이 deleteMany 미지원)
      await tx.loanSchedule.deleteMany({
        where: {
          loanId: loan.id,
          organizationId: ctx.organizationId,
          status: "SCHEDULED",
          dueDate: { gte: extensionDate },
        },
      });

      // Loan 업데이트
      const newTermMonths = Math.ceil(
        (newEnd.getTime() - loan.startDate.getTime()) / (1000 * 60 * 60 * 24 * 30.44)
      );
      await tx.loan.update({
        where: { id: loan.id },
        data: {
          endDate: newEnd,
          interestRate: newRate.toNumber(),
          loanTermMonths: newTermMonths,
          status: "ACTIVE",
          overdueStage: "NORMAL",
          overdueDays: 0,
          memo: memo || loan.memo,
        },
      });

      // 새 스케줄 생성
      await tx.loanSchedule.createMany({
        data: newScheduleItems.map((s) => ({
          organizationId: ctx.organizationId,
          loanId: loan.id,
          installmentNumber: s.installmentNumber,
          dueDate: s.dueDate,
          principalAmount: s.principalAmount.toNumber(),
          interestAmount: s.interestAmount.toNumber(),
          totalAmount: s.totalAmount.toNumber(),
          remainingBalance: s.remainingBalance.toNumber(),
        })),
      });
    });

    await logAudit(
      { userId: ctx.userId, organizationId: ctx.organizationId, ipAddress: getClientIp() },
      "Loan", loanId, "UPDATE",
      beforeSnapshot,
      sanitizeForLog({ endDate: newEnd.toISOString(), interestRate: newRate.toNumber(), action: "EXTEND" }),
    );

    revalidatePath(`/loans/${loanId}`);
    revalidatePath("/loans");
    revalidatePath("/dashboard");
    return { success: true };
  });

// ────────────────────────────────────────────────────────────────────────────
// calculatePrepayment — 중도상환 예상액 조회 (LOAN-07, read-only)
// ────────────────────────────────────────────────────────────────────────────
export const calculatePrepayment = authenticatedAction
  .schema(prepaymentSchema)
  .action(async ({ parsedInput, ctx }) => {
    const { loanId, prepaymentDate, prepaymentType, prepaymentAmount } = parsedInput;

    const loan = await ctx.db.loan.findFirst({
      where: { id: loanId },
      include: { schedules: { orderBy: { installmentNumber: "asc" } } },
    });
    if (!loan) throw new Error("대출을 찾을 수 없습니다.");

    const isFull = prepaymentType === "FULL";
    const payAmount = isFull
      ? new Decimal(loan.balance.toString())
      : new Decimal(prepaymentAmount?.toString() ?? "0");

    const feeRateSetting = await ctx.db.setting.findFirst({
      where: { key: "prepayment_fee_rate" },
    });
    const orgFeeRate = feeRateSetting ? feeRateSetting.value : null;

    const result = calculatePrepaymentFee(
      loan,
      payAmount,
      parseISO(prepaymentDate),
      orgFeeRate,
      isFull
    );

    return {
      balance: loan.balance.toString(),
      accruedInterest: result.accruedInterest.toFixed(0),
      prepaymentFee: result.prepaymentFee.toFixed(0),
      totalDue: result.totalDue.toFixed(0),
      feeRate: result.feeRate.toFixed(2),
      prepaymentType,
      prepaymentAmount: payAmount.toFixed(0),
    };
  });

// ────────────────────────────────────────────────────────────────────────────
// processPrepayment — 중도상환 실행 (LOAN-04, LOAN-05)
// ────────────────────────────────────────────────────────────────────────────
export const processPrepayment = authenticatedAction
  .schema(prepaymentSchema)
  .action(async ({ parsedInput, ctx }) => {
    const { loanId, prepaymentDate, prepaymentType, prepaymentAmount, memo } = parsedInput;

    const loan = await ctx.db.loan.findFirst({
      where: { id: loanId },
      include: { schedules: { orderBy: { installmentNumber: "asc" } } },
    });
    if (!loan) throw new Error("대출을 찾을 수 없습니다.");
    if (loan.status === "COMPLETED") throw new Error("이미 완료된 대출입니다.");

    const isFull = prepaymentType === "FULL";
    const payAmount = isFull
      ? new Decimal(loan.balance.toString())
      : new Decimal(prepaymentAmount?.toString() ?? "0");
    const processDate = parseISO(prepaymentDate);

    const feeRateSetting = await ctx.db.setting.findFirst({
      where: { key: "prepayment_fee_rate" },
    });
    const orgFeeRate = feeRateSetting ? feeRateSetting.value : null;

    const calcResult = calculatePrepaymentFee(loan, payAmount, processDate, orgFeeRate, isFull);
    const beforeSnapshot = sanitizeForLog(loan as unknown as Record<string, unknown>);

    await ctx.db.$transaction(async (tx) => {
      // Payment 기록
      await tx.payment.create({
        data: {
          organizationId: ctx.organizationId,
          loanId: loan.id,
          paymentDate: processDate,
          principalAmount: payAmount.toNumber(),
          interestAmount: calcResult.accruedInterest.toNumber(),
          overdueAmount: 0,
          totalAmount: calcResult.totalDue.toNumber(),
          memo: memo || `${isFull ? "전액" : "일부"} 중도상환 (수수료 ${calcResult.prepaymentFee.toFixed(0)}원 포함)`,
        },
      });

      if (isFull) {
        // 전액: 모든 스케줄 PAID 처리, 대출 완료
        await tx.loanSchedule.updateMany({
          where: {
            loanId: loan.id,
            organizationId: ctx.organizationId,
            status: { in: ["SCHEDULED", "OVERDUE", "PARTIAL"] },
          },
          data: { status: "PAID", paidDate: processDate },
        });
        await tx.loan.update({
          where: { id: loan.id },
          data: { balance: 0, status: "COMPLETED" },
        });
      } else {
        // 일부: 잔액 감소 후 스케줄 재계산
        const newBalance = new Decimal(loan.balance.toString()).minus(payAmount);

        // 기존 미납 스케줄 삭제 (organizationId 필수)
        await tx.loanSchedule.deleteMany({
          where: {
            loanId: loan.id,
            organizationId: ctx.organizationId,
            status: "SCHEDULED",
          },
        });

        // 새 스케줄 생성
        const newScheduleItems = recalculateSchedule(
          loan,
          processDate,
          undefined,
          undefined,
          newBalance
        );
        await tx.loanSchedule.createMany({
          data: newScheduleItems.map((s) => ({
            organizationId: ctx.organizationId,
            loanId: loan.id,
            installmentNumber: s.installmentNumber,
            dueDate: s.dueDate,
            principalAmount: s.principalAmount.toNumber(),
            interestAmount: s.interestAmount.toNumber(),
            totalAmount: s.totalAmount.toNumber(),
            remainingBalance: s.remainingBalance.toNumber(),
          })),
        });

        await tx.loan.update({
          where: { id: loan.id },
          data: { balance: newBalance.toNumber() },
        });
      }
    });

    await logAudit(
      { userId: ctx.userId, organizationId: ctx.organizationId, ipAddress: getClientIp() },
      "Loan", loanId, "UPDATE",
      beforeSnapshot,
      sanitizeForLog({ action: isFull ? "FULL_PREPAYMENT" : "PARTIAL_PREPAYMENT", amount: payAmount.toNumber(), fee: calcResult.prepaymentFee.toNumber() }),
    );

    revalidatePath(`/loans/${loanId}`);
    revalidatePath("/loans");
    revalidatePath("/dashboard");
    return { success: true, isFull };
  });

// ────────────────────────────────────────────────────────────────────────────
// processBatchOverdue — 일괄 연체 처리 (LOAN-09, LOAN-10)
// ────────────────────────────────────────────────────────────────────────────
export const processBatchOverdue = adminAction
  .schema(z.object({ dryRun: z.boolean().default(false) }))
  .action(async ({ parsedInput, ctx }) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // 이 org의 활성/연체 대출 조회
    const loans = await ctx.db.loan.findMany({
      where: { status: { in: ["ACTIVE", "OVERDUE"] } },
      include: {
        schedules: {
          where: { status: { in: ["SCHEDULED", "PARTIAL"] } },
          orderBy: { dueDate: "asc" },
        },
      },
    });

    type LoanUpdate = {
      loanId: string;
      overdueDays: number;
      overdueStage: string;
      scheduleIds: string[];
    };

    const updates: LoanUpdate[] = [];

    for (const loan of loans) {
      const overdueSchedules = loan.schedules.filter((s) => s.dueDate < today);
      if (overdueSchedules.length === 0) continue;

      // 가장 오래된 연체 스케줄 기준 연체일수
      const earliestDueDate = overdueSchedules[0].dueDate;
      const overdueDays = Math.floor(
        (today.getTime() - earliestDueDate.getTime()) / (1000 * 60 * 60 * 24)
      );

      let overdueStage = "STAGE_1";
      if (overdueDays >= 91) overdueStage = "STAGE_3";
      else if (overdueDays >= 31) overdueStage = "STAGE_2";

      updates.push({
        loanId: loan.id,
        overdueDays,
        overdueStage,
        scheduleIds: overdueSchedules.map((s) => s.id),
      });
    }

    if (parsedInput.dryRun) {
      return { success: true, dryRun: true, affectedLoans: updates.length };
    }

    // 단일 트랜잭션에서 원자적 실행 (LOAN-10)
    await ctx.db.$transaction(async (tx) => {
      for (const update of updates) {
        // 연체 스케줄 상태 업데이트
        await tx.loanSchedule.updateMany({
          where: {
            id: { in: update.scheduleIds },
            organizationId: ctx.organizationId,
          },
          data: { status: "OVERDUE" },
        });

        // 대출 연체 상태 업데이트
        await tx.loan.update({
          where: { id: update.loanId },
          data: {
            status: "OVERDUE",
            overdueDays: update.overdueDays,
            overdueStage: update.overdueStage,
          },
        });
      }
    });

    await logAudit(
      { userId: ctx.userId, organizationId: ctx.organizationId, ipAddress: getClientIp() },
      "Loan", ctx.organizationId, "UPDATE",
      null,
      sanitizeForLog({ action: "BATCH_OVERDUE", affectedLoans: updates.length, date: today.toISOString() }),
    );

    revalidatePath("/loans");
    revalidatePath("/overdue");
    revalidatePath("/dashboard");
    return { success: true, dryRun: false, affectedLoans: updates.length };
  });
