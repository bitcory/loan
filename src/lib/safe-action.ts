import { createSafeActionClient } from "next-safe-action";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getTenantClient } from "@/lib/prisma";

// 비인증 클라이언트 (로그인 액션 전용)
export const actionClient = createSafeActionClient();

// 인증된 클라이언트 — 모든 일반 사용자
export const authenticatedAction = createSafeActionClient().use(
  async ({ next }) => {
    const session = await getServerSession(authOptions);
    if (!session?.user?.userId) {
      throw new Error("인증이 필요합니다.");
    }
    const db = getTenantClient(session.user.organizationId);
    return next({
      ctx: {
        userId: session.user.userId,
        organizationId: session.user.organizationId,
        role: session.user.role,
        db,
      },
    });
  }
);

// 관리자 전용 클라이언트
export const adminAction = createSafeActionClient().use(
  async ({ next }) => {
    const session = await getServerSession(authOptions);
    if (!session?.user?.userId) {
      throw new Error("인증이 필요합니다.");
    }
    if (session.user.role !== "ADMIN") {
      throw new Error("관리자 권한이 필요합니다.");
    }
    const db = getTenantClient(session.user.organizationId);
    return next({
      ctx: {
        userId: session.user.userId,
        organizationId: session.user.organizationId,
        role: "ADMIN" as const,
        db,
      },
    });
  }
);
