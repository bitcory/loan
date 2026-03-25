import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
  return new PrismaClient({ adapter });
}

const basePrisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = basePrisma;

// 테넌트 격리된 클라이언트 팩토리 — 인증된 요청마다 호출
// 중요: User 모델은 인터셉터에서 제외 (auth 시점에 organizationId 컨텍스트 없음)
export function getTenantClient(organizationId: string) {
  return basePrisma.$extends({
    query: {
      customer: {
        async findMany({ args, query }) {
          args.where = { ...args.where, organizationId };
          return query(args);
        },
        async findFirst({ args, query }) {
          args.where = { ...args.where, organizationId };
          return query(args);
        },
        async count({ args, query }) {
          args.where = { ...args.where, organizationId };
          return query(args);
        },
        async create({ args, query }) {
          (args.data as Record<string, unknown>).organizationId = organizationId;
          return query(args);
        },
        async update({ args, query }) {
          args.where = { ...args.where, organizationId };
          return query(args);
        },
        async delete({ args, query }) {
          args.where = { ...args.where, organizationId };
          return query(args);
        },
      },
      collateral: {
        async findMany({ args, query }) { args.where = { ...args.where, organizationId }; return query(args); },
        async findFirst({ args, query }) { args.where = { ...args.where, organizationId }; return query(args); },
        async count({ args, query }) { args.where = { ...args.where, organizationId }; return query(args); },
        async create({ args, query }) { (args.data as Record<string, unknown>).organizationId = organizationId; return query(args); },
        async update({ args, query }) { args.where = { ...args.where, organizationId }; return query(args); },
        async delete({ args, query }) { args.where = { ...args.where, organizationId }; return query(args); },
      },
      mortgage: {
        async findMany({ args, query }) { args.where = { ...args.where, organizationId }; return query(args); },
        async findFirst({ args, query }) { args.where = { ...args.where, organizationId }; return query(args); },
        async count({ args, query }) { args.where = { ...args.where, organizationId }; return query(args); },
        async create({ args, query }) { (args.data as Record<string, unknown>).organizationId = organizationId; return query(args); },
        async update({ args, query }) { args.where = { ...args.where, organizationId }; return query(args); },
        async delete({ args, query }) { args.where = { ...args.where, organizationId }; return query(args); },
      },
      loan: {
        async findMany({ args, query }) { args.where = { ...args.where, organizationId }; return query(args); },
        async findFirst({ args, query }) { args.where = { ...args.where, organizationId }; return query(args); },
        async count({ args, query }) { args.where = { ...args.where, organizationId }; return query(args); },
        async create({ args, query }) { (args.data as Record<string, unknown>).organizationId = organizationId; return query(args); },
        async update({ args, query }) { args.where = { ...args.where, organizationId }; return query(args); },
        async delete({ args, query }) { args.where = { ...args.where, organizationId }; return query(args); },
      },
      loanSchedule: {
        async findMany({ args, query }) { args.where = { ...args.where, organizationId }; return query(args); },
        async findFirst({ args, query }) { args.where = { ...args.where, organizationId }; return query(args); },
        async count({ args, query }) { args.where = { ...args.where, organizationId }; return query(args); },
        async create({ args, query }) { (args.data as Record<string, unknown>).organizationId = organizationId; return query(args); },
        async update({ args, query }) { args.where = { ...args.where, organizationId }; return query(args); },
        async delete({ args, query }) { args.where = { ...args.where, organizationId }; return query(args); },
      },
      payment: {
        async findMany({ args, query }) { args.where = { ...args.where, organizationId }; return query(args); },
        async findFirst({ args, query }) { args.where = { ...args.where, organizationId }; return query(args); },
        async count({ args, query }) { args.where = { ...args.where, organizationId }; return query(args); },
        async create({ args, query }) { (args.data as Record<string, unknown>).organizationId = organizationId; return query(args); },
        async update({ args, query }) { args.where = { ...args.where, organizationId }; return query(args); },
        async delete({ args, query }) { args.where = { ...args.where, organizationId }; return query(args); },
      },
      setting: {
        async findMany({ args, query }) { args.where = { ...args.where, organizationId }; return query(args); },
        async findFirst({ args, query }) { args.where = { ...args.where, organizationId }; return query(args); },
        async count({ args, query }) { args.where = { ...args.where, organizationId }; return query(args); },
        async create({ args, query }) { (args.data as Record<string, unknown>).organizationId = organizationId; return query(args); },
        async update({ args, query }) { args.where = { ...args.where, organizationId }; return query(args); },
        async delete({ args, query }) { args.where = { ...args.where, organizationId }; return query(args); },
      },
    },
  });
}

// basePrisma: User 모델 등 auth 조회용 (테넌트 필터 없음)
export { basePrisma as prisma };
