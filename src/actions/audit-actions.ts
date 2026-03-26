"use server";

import { adminAction } from "@/lib/safe-action";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

export const getAuditLogs = adminAction
  .schema(
    z.object({
      entityType: z.string().optional(),
      userId: z.string().optional(),
      dateFrom: z.string().optional(), // ISO 날짜 문자열 "YYYY-MM-DD"
      dateTo: z.string().optional(),
      page: z.number().default(1),
      pageSize: z.number().default(50),
    })
  )
  .action(async ({ parsedInput, ctx }) => {
    const { entityType, userId, dateFrom, dateTo, page, pageSize } = parsedInput;

    // 중요: basePrisma(prisma)는 테넌트 extension이 없으므로 organizationId를 반드시 명시
    const where: Record<string, unknown> = {
      organizationId: ctx.organizationId,
    };

    if (entityType) where.entityType = entityType;
    if (userId) where.userId = userId;
    if (dateFrom || dateTo) {
      where.createdAt = {
        ...(dateFrom && { gte: new Date(dateFrom) }),
        ...(dateTo && { lte: new Date(dateTo + "T23:59:59.999Z") }),
      };
    }

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.auditLog.count({ where }),
    ]);

    return {
      logs,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  });
