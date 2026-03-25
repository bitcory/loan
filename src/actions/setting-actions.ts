"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function getSettings() {
  return prisma.setting.findMany({ orderBy: { key: "asc" } });
}

export async function getSetting(key: string) {
  const setting = await prisma.setting.findFirst({ where: { key } });
  return setting?.value;
}

export async function updateSettings(data: FormData) {
  const entries = Array.from(data.entries());

  for (const [key, value] of entries) {
    if (key.startsWith("setting_")) {
      const settingKey = key.replace("setting_", "");
      const existing = await prisma.setting.findFirst({
        where: { key: settingKey, organizationId: null },
      });
      if (existing) {
        await prisma.setting.update({
          where: { id: existing.id },
          data: { value: value.toString() },
        });
      } else {
        await prisma.setting.create({
          data: {
            key: settingKey,
            value: value.toString(),
            label: settingKey,
          },
        });
      }
    }
  }

  revalidatePath("/settings");
  return { success: true };
}
