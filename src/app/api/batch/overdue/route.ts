import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";

// GET /api/batch/overdue
// cron 서비스(Vercel Cron, GitHub Actions, etc.)에서 호출 (LOAN-08)
// 인증: x-cron-secret 헤더 = process.env.CRON_SECRET
export async function GET(request: NextRequest) {
  const secret = request.headers.get("x-cron-secret");
  if (!secret || secret !== process.env.CRON_SECRET) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  try {
    // 모든 org의 활성/연체 대출 처리 (basePrisma 직접 사용 — 세션 없음)
    const loans = await prisma.loan.findMany({
      where: { status: { in: ["ACTIVE", "OVERDUE"] } },
      include: {
        schedules: {
          where: {
            status: { in: ["SCHEDULED", "PARTIAL"] },
            dueDate: { lt: today },
          },
          orderBy: { dueDate: "asc" },
        },
      },
    });

    let totalAffected = 0;

    // org별로 그룹화하여 트랜잭션 처리
    const orgMap = new Map<string, typeof loans>();
    for (const loan of loans) {
      if (loan.schedules.length === 0) continue;
      const existing = orgMap.get(loan.organizationId) ?? [];
      existing.push(loan);
      orgMap.set(loan.organizationId, existing);
    }

    for (const [organizationId, orgLoans] of Array.from(orgMap)) {
      await prisma.$transaction(async (tx) => {
        for (const loan of orgLoans) {
          const earliest = loan.schedules[0].dueDate;
          const overdueDays = Math.floor(
            (today.getTime() - earliest.getTime()) / (1000 * 60 * 60 * 24)
          );
          let overdueStage = "STAGE_1";
          if (overdueDays >= 91) overdueStage = "STAGE_3";
          else if (overdueDays >= 31) overdueStage = "STAGE_2";

          await tx.loanSchedule.updateMany({
            where: {
              loanId: loan.id,
              organizationId,
              status: { in: ["SCHEDULED", "PARTIAL"] },
              dueDate: { lt: today },
            },
            data: { status: "OVERDUE" },
          });

          await tx.loan.update({
            where: { id: loan.id },
            data: { status: "OVERDUE", overdueDays, overdueStage },
          });

          totalAffected++;
        }
      });

      await logAudit(
        { userId: "cron", organizationId },
        "Loan", organizationId, "UPDATE",
        null,
        { action: "SCHEDULED_BATCH_OVERDUE", affectedLoans: orgLoans.length, date: today.toISOString() },
      );
    }

    return Response.json({
      success: true,
      affectedLoans: totalAffected,
      processedAt: today.toISOString(),
    });
  } catch (error) {
    console.error("[cron/batch-overdue] 실행 실패:", error);
    return Response.json(
      { error: "Internal server error", detail: String(error) },
      { status: 500 }
    );
  }
}
