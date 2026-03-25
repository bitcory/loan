"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

// TODO(01-03): Replace with session-derived organizationId
const DEFAULT_ORG_ID = "default-org-001";

export async function getSettings() {
  return prisma.setting.findMany({
    where: { organizationId: DEFAULT_ORG_ID },
    orderBy: { key: "asc" },
  });
}

export async function getSetting(key: string) {
  const setting = await prisma.setting.findFirst({
    where: { key, organizationId: DEFAULT_ORG_ID },
  });
  return setting?.value;
}

export async function updateSettings(data: FormData) {
  const entries = Array.from(data.entries());

  for (const [key, value] of entries) {
    if (key.startsWith("setting_")) {
      const settingKey = key.replace("setting_", "");
      const existing = await prisma.setting.findFirst({
        where: { key: settingKey, organizationId: DEFAULT_ORG_ID },
      });
      if (existing) {
        await prisma.setting.update({
          where: { id: existing.id },
          data: { value: value.toString() },
        });
      } else {
        await prisma.setting.create({
          data: {
            organizationId: DEFAULT_ORG_ID,
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
