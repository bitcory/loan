"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getTenantClient } from "@/lib/prisma";
import { adminAction } from "@/lib/safe-action";
import { revalidatePath } from "next/cache";
import { z } from "zod";

// ---- READ functions (called from Server Components) ----

export async function getSettings() {
  const session = await getServerSession(authOptions);
  if (!session) throw new Error("인증이 필요합니다.");
  const db = getTenantClient(session.user.organizationId);

  return db.setting.findMany({
    orderBy: { key: "asc" },
  });
}

export async function getSetting(key: string) {
  const session = await getServerSession(authOptions);
  if (!session) throw new Error("인증이 필요합니다.");
  const db = getTenantClient(session.user.organizationId);

  const setting = await db.setting.findFirst({
    where: { key },
  });
  return setting?.value;
}

// ---- MUTATIONS (safe-action wrapped, ADMIN only) ----

export const updateSettings = adminAction
  .schema(z.record(z.string(), z.string()))
  .action(async ({ parsedInput, ctx }) => {
    for (const [settingKey, value] of Object.entries(parsedInput)) {
      const existing = await ctx.db.setting.findFirst({
        where: { key: settingKey },
      });
      if (existing) {
        await ctx.db.setting.update({
          where: {
            organizationId_key: {
              organizationId: ctx.organizationId,
              key: settingKey,
            },
          },
          data: { value },
        });
      } else {
        await ctx.db.setting.create({
          data: {
            organizationId: ctx.organizationId,
            key: settingKey,
            value,
            label: settingKey,
          },
        });
      }
    }

    revalidatePath("/settings");
    return { success: true };
  });

export const updateSetting = adminAction
  .schema(z.object({ key: z.string(), value: z.string() }))
  .action(async ({ parsedInput, ctx }) => {
    const existing = await ctx.db.setting.findFirst({
      where: { key: parsedInput.key },
    });
    if (existing) {
      await ctx.db.setting.update({
        where: {
          organizationId_key: {
            organizationId: ctx.organizationId,
            key: parsedInput.key,
          },
        },
        data: { value: parsedInput.value },
      });
    } else {
      await ctx.db.setting.create({
        data: {
          organizationId: ctx.organizationId,
          key: parsedInput.key,
          value: parsedInput.value,
          label: parsedInput.key,
        },
      });
    }

    revalidatePath("/settings");
    return { success: true };
  });
