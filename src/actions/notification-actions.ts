"use server";

import { authenticatedAction } from "@/lib/safe-action";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// 미확인 알림 수 조회
export async function getUnreadNotificationCount(): Promise<number> {
  const session = await getServerSession(authOptions);
  if (!session) return 0;

  const count = await prisma.notification.count({
    where: {
      organizationId: session.user.organizationId,
      userId: session.user.userId,
      isRead: false,
    },
  });

  return count;
}

// 알림 목록 조회 (최근 30개)
export async function getNotifications() {
  const session = await getServerSession(authOptions);
  if (!session) return [];

  return prisma.notification.findMany({
    where: {
      organizationId: session.user.organizationId,
      userId: session.user.userId,
    },
    orderBy: { createdAt: "desc" },
    take: 30,
  });
}

// 알림 읽음 처리
export const markNotificationRead = authenticatedAction
  .schema(z.object({ notificationId: z.string() }))
  .action(async ({ parsedInput, ctx }) => {
    await prisma.notification.updateMany({
      where: {
        id: parsedInput.notificationId,
        organizationId: ctx.organizationId,
      },
      data: { isRead: true },
    });
    return { success: true };
  });

// 전체 읽음 처리
export const markAllNotificationsRead = authenticatedAction
  .schema(z.object({}))
  .action(async ({ ctx }) => {
    await prisma.notification.updateMany({
      where: {
        organizationId: ctx.organizationId,
        userId: ctx.userId,
        isRead: false,
      },
      data: { isRead: true },
    });
    return { success: true };
  });
