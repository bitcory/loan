"use server";

import { authenticatedAction } from "@/lib/safe-action";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "현재 비밀번호를 입력하세요"),
  newPassword: z
    .string()
    .min(8, "비밀번호는 최소 8자 이상이어야 합니다")
    .regex(/^(?=.*[a-zA-Z])(?=.*[0-9])/, "영문과 숫자를 조합하여 입력하세요"),
});

export const changePassword = authenticatedAction
  .schema(changePasswordSchema)
  .action(async ({ parsedInput, ctx }) => {
    const { currentPassword, newPassword } = parsedInput;
    const { userId } = ctx;

    // basePrisma로 현재 사용자 조회 (User는 Extension 제외)
    const { prisma } = await import("@/lib/prisma");
    const user = await prisma.user.findFirst({
      where: { id: userId },
      select: { passwordHash: true },
    });

    if (!user) throw new Error("사용자를 찾을 수 없습니다.");

    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) throw new Error("현재 비밀번호가 올바르지 않습니다.");

    const newHash = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash: newHash },
    });

    revalidatePath("/settings");
    return { success: true };
  });
