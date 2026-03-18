import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { addMonths, subMonths } from "date-fns";
import Decimal from "decimal.js";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Seeding database...");

  // 설정
  const settings = [
    { key: "max_ltv", value: "70", label: "최대 LTV (%)" },
    { key: "default_interest_rate", value: "15", label: "기본 이율 (%)" },
    { key: "max_interest_rate", value: "20", label: "법정 최고이율 (%)" },
    { key: "overdue_rate_addition", value: "3", label: "연체가산이율 (%)" },
    { key: "company_name", value: "대부전산", label: "회사명" },
  ];

  for (const setting of settings) {
    await prisma.setting.upsert({
      where: { key: setting.key },
      update: { value: setting.value },
      create: setting,
    });
  }

  // 고객
  const customers = await Promise.all([
    prisma.customer.create({
      data: {
        customerNumber: "C-0001",
        name: "김철수",
        customerType: "INDIVIDUAL",
        phone: "010-1234-5678",
        email: "kim@example.com",
        address: "서울특별시 강남구 테헤란로 123",
        memo: "VIP 고객",
      },
    }),
    prisma.customer.create({
      data: {
        customerNumber: "C-0002",
        name: "이영희",
        customerType: "INDIVIDUAL",
        phone: "010-9876-5432",
        email: "lee@example.com",
        address: "서울특별시 서초구 서초대로 456",
      },
    }),
    prisma.customer.create({
      data: {
        customerNumber: "C-0003",
        name: "박민수",
        customerType: "INDIVIDUAL",
        phone: "010-5555-7777",
        address: "경기도 성남시 분당구 판교역로 789",
      },
    }),
    prisma.customer.create({
      data: {
        customerNumber: "C-0004",
        name: "(주)한국건설",
        customerType: "CORPORATE",
        businessNumber: "123-45-67890",
        phone: "02-1234-5678",
        email: "info@hankook.co.kr",
        address: "서울특별시 종로구 세종대로 100",
      },
    }),
    prisma.customer.create({
      data: {
        customerNumber: "C-0005",
        name: "정수진",
        customerType: "INDIVIDUAL",
        phone: "010-3333-4444",
        address: "인천광역시 연수구 센트럴로 200",
      },
    }),
  ]);

  // 담보물건
  const collaterals = await Promise.all([
    prisma.collateral.create({
      data: {
        customerId: customers[0].id,
        collateralType: "APARTMENT",
        address: "서울특별시 강남구 테헤란로 123",
        detailAddress: "101동 1501호",
        area: 84.95,
        appraisalValue: 1200000000, // 12억
      },
    }),
    prisma.collateral.create({
      data: {
        customerId: customers[1].id,
        collateralType: "APARTMENT",
        address: "서울특별시 서초구 서초대로 456",
        detailAddress: "202동 801호",
        area: 59.96,
        appraisalValue: 800000000, // 8억
      },
    }),
    prisma.collateral.create({
      data: {
        customerId: customers[2].id,
        collateralType: "HOUSE",
        address: "경기도 성남시 분당구 판교역로 789",
        area: 132.23,
        appraisalValue: 500000000, // 5억
      },
    }),
    prisma.collateral.create({
      data: {
        customerId: customers[3].id,
        collateralType: "BUILDING",
        address: "서울특별시 종로구 세종대로 100",
        area: 330.58,
        appraisalValue: 3000000000, // 30억
      },
    }),
  ]);

  // 근저당
  await Promise.all([
    prisma.mortgage.create({
      data: {
        collateralId: collaterals[0].id,
        rank: 1,
        mortgageType: "SENIOR",
        creditor: "국민은행",
        maxClaimAmount: 480000000, // 4.8억
        loanAmount: 400000000, // 4억
      },
    }),
    prisma.mortgage.create({
      data: {
        collateralId: collaterals[1].id,
        rank: 1,
        mortgageType: "SENIOR",
        creditor: "신한은행",
        maxClaimAmount: 360000000, // 3.6억
        loanAmount: 300000000, // 3억
      },
    }),
    prisma.mortgage.create({
      data: {
        collateralId: collaterals[2].id,
        rank: 1,
        mortgageType: "SENIOR",
        creditor: "하나은행",
        maxClaimAmount: 180000000,
        loanAmount: 150000000,
      },
    }),
    prisma.mortgage.create({
      data: {
        collateralId: collaterals[3].id,
        rank: 1,
        mortgageType: "SENIOR",
        creditor: "우리은행",
        maxClaimAmount: 1200000000,
        loanAmount: 1000000000,
      },
    }),
  ]);

  // 대출 (스케줄 포함)
  const now = new Date();
  const threeMonthsAgo = subMonths(now, 3);

  // 대출 1: 김철수 - 만기일시상환 1억, 연 18%, 12개월
  const loan1Start = threeMonthsAgo;
  const loan1 = await prisma.loan.create({
    data: {
      loanNumber: `${threeMonthsAgo.getFullYear()}${String(threeMonthsAgo.getMonth() + 1).padStart(2, "0")}${String(threeMonthsAgo.getDate()).padStart(2, "0")}-0001`,
      customerId: customers[0].id,
      collateralId: collaterals[0].id,
      loanAmount: 100000000,
      balance: 100000000,
      interestRate: 18,
      repaymentType: "BULLET",
      loanTermMonths: 12,
      startDate: loan1Start,
      endDate: addMonths(loan1Start, 12),
      status: "ACTIVE",
    },
  });

  // 만기일시상환 스케줄
  for (let i = 1; i <= 12; i++) {
    const dueDate = addMonths(loan1Start, i);
    const prevDate = addMonths(loan1Start, i - 1);
    const days = Math.round((dueDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24));
    const interest = Math.round(100000000 * 0.18 * days / 365);
    const principal = i === 12 ? 100000000 : 0;

    await prisma.loanSchedule.create({
      data: {
        loanId: loan1.id,
        installmentNumber: i,
        dueDate,
        principalAmount: principal,
        interestAmount: interest,
        totalAmount: principal + interest,
        remainingBalance: i === 12 ? 0 : 100000000,
        status: i <= 2 ? "PAID" : i === 3 ? "OVERDUE" : "SCHEDULED",
        paidAmount: i <= 2 ? principal + interest : 0,
        paidDate: i <= 2 ? addMonths(loan1Start, i) : null,
      },
    });
  }

  // 납부 기록
  for (let i = 1; i <= 2; i++) {
    const payDate = addMonths(loan1Start, i);
    const prevDate = addMonths(loan1Start, i - 1);
    const days = Math.round((payDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24));
    const interest = Math.round(100000000 * 0.18 * days / 365);

    await prisma.payment.create({
      data: {
        loanId: loan1.id,
        paymentDate: payDate,
        principalAmount: 0,
        interestAmount: interest,
        totalAmount: interest,
        memo: `${i}회차 이자 납부`,
      },
    });
  }

  // 대출 2: 이영희 - 원금균등 5천만, 연 15%, 6개월
  const loan2Start = subMonths(now, 2);
  const loan2 = await prisma.loan.create({
    data: {
      loanNumber: `${loan2Start.getFullYear()}${String(loan2Start.getMonth() + 1).padStart(2, "0")}${String(loan2Start.getDate()).padStart(2, "0")}-0001`,
      customerId: customers[1].id,
      collateralId: collaterals[1].id,
      loanAmount: 50000000,
      balance: 33333334,
      interestRate: 15,
      repaymentType: "EQUAL_PRINCIPAL",
      loanTermMonths: 6,
      startDate: loan2Start,
      endDate: addMonths(loan2Start, 6),
      status: "ACTIVE",
    },
  });

  const monthlyPrincipal2 = Math.round(50000000 / 6);
  let balance2 = 50000000;
  for (let i = 1; i <= 6; i++) {
    const dueDate = addMonths(loan2Start, i);
    const prevDate = addMonths(loan2Start, i - 1);
    const days = Math.round((dueDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24));
    const interest = Math.round(balance2 * 0.15 * days / 365);
    const principal = i === 6 ? balance2 : monthlyPrincipal2;
    balance2 -= principal;

    await prisma.loanSchedule.create({
      data: {
        loanId: loan2.id,
        installmentNumber: i,
        dueDate,
        principalAmount: principal,
        interestAmount: interest,
        totalAmount: principal + interest,
        remainingBalance: Math.max(balance2, 0),
        status: i <= 2 ? "PAID" : "SCHEDULED",
        paidAmount: i <= 2 ? principal + interest : 0,
        paidDate: i <= 2 ? dueDate : null,
      },
    });
  }

  // 대출 3: 박민수 - 원리금균등 3천만, 연 20%, 12개월
  const loan3Start = subMonths(now, 1);
  await prisma.loan.create({
    data: {
      loanNumber: `${loan3Start.getFullYear()}${String(loan3Start.getMonth() + 1).padStart(2, "0")}${String(loan3Start.getDate()).padStart(2, "0")}-0001`,
      customerId: customers[2].id,
      collateralId: collaterals[2].id,
      loanAmount: 30000000,
      balance: 30000000,
      interestRate: 20,
      repaymentType: "EQUAL_PAYMENT",
      loanTermMonths: 12,
      startDate: loan3Start,
      endDate: addMonths(loan3Start, 12),
      status: "ACTIVE",
    },
  });

  console.log("Seed completed successfully!");
  console.log(`Created ${customers.length} customers`);
  console.log(`Created ${collaterals.length} collaterals`);
  console.log("Created 3 loans with schedules and payments");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
