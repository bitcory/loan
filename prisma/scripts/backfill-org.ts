import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });
const DEFAULT_ORG_ID = "default-org-001";

async function backfill() {
  const models = [
    "customer",
    "collateral",
    "mortgage",
    "loan",
    "loanSchedule",
    "payment",
    "setting",
  ] as const;

  for (const model of models) {
    const result = await (prisma as any)[model].updateMany({
      where: { organizationId: null },
      data: { organizationId: DEFAULT_ORG_ID },
    });
    console.log(`${model}: ${result.count}개 업데이트`);
  }

  // 검증: null이 남아있는지 확인
  for (const model of models) {
    const nullCount = await (prisma as any)[model].count({
      where: { organizationId: null },
    });
    if (nullCount > 0) {
      throw new Error(`${model}에 organizationId가 null인 행이 ${nullCount}개 남아있습니다`);
    }
  }
  console.log("Backfill 완료: 모든 테이블에 organizationId 설정됨");
}

backfill()
  .catch((e) => {
    console.error("Backfill 실패:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
