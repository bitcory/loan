import { prisma } from "@/lib/prisma";

type NotificationType = "OVERDUE" | "MATURITY_7D" | "MATURITY_30D" | "PAYMENT";

interface NotificationPayload {
  organizationId: string;
  type: NotificationType;
  title: string;
  message: string;
  entityType: string;
  entityId: string;
}

// 조직 내 모든 사용자에게 알림 생성 (fire-and-forget)
export async function createNotificationsForOrg(payload: NotificationPayload): Promise<void> {
  try {
    const users = await prisma.user.findMany({
      where: { organizationId: payload.organizationId },
      select: { id: true },
    });

    if (users.length === 0) return;

    await prisma.notification.createMany({
      data: users.map((user) => ({
        organizationId: payload.organizationId,
        userId: user.id,
        type: payload.type,
        title: payload.title,
        message: payload.message,
        entityType: payload.entityType,
        entityId: payload.entityId,
      })),
    });
  } catch (err) {
    // fire-and-forget: 알림 생성 실패가 메인 트랜잭션에 영향 없음
    console.error("[notifications] 알림 생성 실패:", err);
  }
}
