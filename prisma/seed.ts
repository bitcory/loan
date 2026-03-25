import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const DEFAULT_ORG_ID = "default-org-001";
const DEFAULT_ORG_SLUG = "default";

async function main() {
  // 1. 기본 조직 upsert
  const org = await prisma.organization.upsert({
    where: { slug: DEFAULT_ORG_SLUG },
    update: {},
    create: {
      id: DEFAULT_ORG_ID,
      name: "기본 조직",
      slug: DEFAULT_ORG_SLUG,
    },
  });
  console.log(`조직 생성/확인: ${org.name} (${org.id})`);

  // 2. ADMIN 계정 upsert (username: admin, 초기 비밀번호: Admin1234)
  const passwordHash = await bcrypt.hash("Admin1234", 12);
  const admin = await prisma.user.upsert({
    where: { username: "admin" },
    update: {},
    create: {
      organizationId: DEFAULT_ORG_ID,
      username: "admin",
      passwordHash,
      name: "관리자",
      role: "ADMIN",
      isActive: true,
    },
  });
  console.log(`관리자 계정 생성/확인: ${admin.username} (role: ${admin.role})`);

  // 3. 기본 Setting rows (TENANT-05: 조직별 기본 설정값 seed)
  const defaultSettings = [
    { key: "maxLtvRate", value: "70" },
    { key: "defaultInterestRate", value: "5.5" },
    { key: "legalMaxRate", value: "20" },
    { key: "overdueRate", value: "15" },
  ];

  for (const setting of defaultSettings) {
    await prisma.setting.upsert({
      where: {
        organizationId_key: {
          organizationId: DEFAULT_ORG_ID,
          key: setting.key,
        },
      },
      update: {},
      create: {
        organizationId: DEFAULT_ORG_ID,
        key: setting.key,
        value: setting.value,
      },
    });
    console.log(`설정 생성/확인: ${setting.key} = ${setting.value}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
