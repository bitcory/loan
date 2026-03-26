"use server";

import { adminAction } from "@/lib/safe-action";
import { prisma } from "@/lib/prisma"; // basePrisma — User는 Extension 제외
import { z } from "zod";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";

const createUserSchema = z.object({
  name: z.string().min(1, "이름을 입력하세요"),
  username: z
    .string()
    .min(3, "아이디는 최소 3자 이상이어야 합니다")
    .max(20, "아이디는 최대 20자입니다")
    .regex(/^[a-zA-Z0-9_]+$/, "아이디는 영문, 숫자, 밑줄만 사용 가능합니다"),
  password: z
    .string()
    .min(8, "비밀번호는 최소 8자 이상이어야 합니다")
    .regex(/^(?=.*[a-zA-Z])(?=.*[0-9])/, "영문과 숫자를 조합하여 입력하세요"),
  role: z.enum(["ADMIN", "STAFF"]).default("STAFF"),
});

export const createUser = adminAction
  .schema(createUserSchema)
  .action(async ({ parsedInput, ctx }) => {
    const { name, username, password, role } = parsedInput;
    const { organizationId } = ctx;

    const existing = await prisma.user.findFirst({ where: { username } });
    if (existing) throw new Error("이미 사용 중인 아이디입니다.");

    const passwordHash = await bcrypt.hash(password, 12);
    await prisma.user.create({
      data: { organizationId, username, passwordHash, name, role, isActive: true },
    });

    revalidatePath("/settings/users");
    return { success: true };
  });

const updateUserSchema = z.object({
  id: z.string(),
  name: z.string().min(1).optional(),
  role: z.enum(["ADMIN", "STAFF"]).optional(),
});

export const updateUser = adminAction
  .schema(updateUserSchema)
  .action(async ({ parsedInput, ctx }) => {
    const { id, name, role } = parsedInput;
    const { organizationId } = ctx;

    const user = await prisma.user.findFirst({ where: { id, organizationId } });
    if (!user) throw new Error("사용자를 찾을 수 없습니다.");

    await prisma.user.update({
      where: { id },
      data: { ...(name && { name }), ...(role && { role }) },
    });

    revalidatePath("/settings/users");
    return { success: true };
  });

const setUserActiveSchema = z.object({
  id: z.string(),
  isActive: z.boolean(),
});

export const setUserActive = adminAction
  .schema(setUserActiveSchema)
  .action(async ({ parsedInput, ctx }) => {
    const { id, isActive } = parsedInput;
    const { organizationId, userId } = ctx;

    if (id === userId) throw new Error("자신의 계정은 비활성화할 수 없습니다.");

    const user = await prisma.user.findFirst({ where: { id, organizationId } });
    if (!user) throw new Error("사용자를 찾을 수 없습니다.");

    await prisma.user.update({ where: { id }, data: { isActive } });
    revalidatePath("/settings/users");
    return { success: true };
  });

export async function getUsers(organizationId: string) {
  return prisma.user.findMany({
    where: { organizationId },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, username: true, role: true, isActive: true, createdAt: true },
  });
}

const resetPasswordSchema = z.object({
  id: z.string(),
  newPassword: z
    .string()
    .min(8, "비밀번호는 최소 8자 이상이어야 합니다")
    .regex(/^(?=.*[a-zA-Z])(?=.*[0-9])/, "영문과 숫자를 조합하여 입력하세요"),
});

export const resetUserPassword = adminAction
  .schema(resetPasswordSchema)
  .action(async ({ parsedInput, ctx }) => {
    const { id, newPassword } = parsedInput;
    const { organizationId } = ctx;

    const user = await prisma.user.findFirst({ where: { id, organizationId } });
    if (!user) throw new Error("사용자를 찾을 수 없습니다.");

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({ where: { id }, data: { passwordHash } });
    revalidatePath("/settings/users");
    return { success: true };
  });
