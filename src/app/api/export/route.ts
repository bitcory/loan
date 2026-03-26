import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getTenantClient } from "@/lib/prisma";
import ExcelJS from "exceljs";

// GET /api/export?type=customers|loans|overdue
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return new Response("Unauthorized", { status: 401 });

  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type") || "loans";

  const db = getTenantClient(session.user.organizationId);
  const workbook = new ExcelJS.Workbook();

  if (type === "customers") {
    const customers = await db.customer.findMany({
      orderBy: { customerNumber: "asc" },
    });

    const sheet = workbook.addWorksheet("고객목록");
    sheet.columns = [
      { header: "고객번호", key: "customerNumber", width: 14 },
      { header: "고객명", key: "name", width: 16 },
      { header: "고객유형", key: "customerType", width: 12 },
      { header: "주민번호", key: "residentNumber", width: 18 },
      { header: "연락처", key: "phone", width: 16 },
      { header: "이메일", key: "email", width: 24 },
      { header: "주소", key: "address", width: 32 },
    ];

    sheet.getRow(1).font = { bold: true };

    customers.forEach((c) => {
      sheet.addRow({
        customerNumber: c.customerNumber,
        name: c.name,
        customerType: c.customerType === "INDIVIDUAL" ? "개인" : "법인",
        residentNumber: c.residentNumber ? "***-***-*******" : "",
        phone: c.phone,
        email: c.email || "",
        address: c.address || "",
      });
    });

    const buf = await workbook.xlsx.writeBuffer();
    return new Response(buf, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": "attachment; filename*=UTF-8''customers.xlsx",
      },
    });
  }

  if (type === "overdue") {
    const loans = await db.loan.findMany({
      where: { status: "OVERDUE" },
      include: { customer: true },
      orderBy: { overdueDays: "desc" },
    });

    const sheet = workbook.addWorksheet("연체목록");
    sheet.columns = [
      { header: "대출번호", key: "loanNumber", width: 18 },
      { header: "고객명", key: "customerName", width: 16 },
      { header: "연락처", key: "phone", width: 16 },
      { header: "대출금액", key: "loanAmount", width: 16 },
      { header: "잔액", key: "balance", width: 16 },
      { header: "연체일수", key: "overdueDays", width: 12 },
      { header: "연체단계", key: "overdueStage", width: 12 },
      { header: "만기일", key: "endDate", width: 14 },
    ];

    sheet.getRow(1).font = { bold: true };

    loans.forEach((l) => {
      sheet.addRow({
        loanNumber: l.loanNumber,
        customerName: l.customer.name,
        phone: l.customer.phone,
        loanAmount: Number(l.loanAmount.toString()),
        balance: Number(l.balance.toString()),
        overdueDays: l.overdueDays,
        overdueStage: l.overdueStage,
        endDate: l.endDate.toISOString().slice(0, 10),
      });
    });

    const buf = await workbook.xlsx.writeBuffer();
    return new Response(buf, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": "attachment; filename*=UTF-8''overdue.xlsx",
      },
    });
  }

  // default: loans
  const loans = await db.loan.findMany({
    include: { customer: true },
    orderBy: { createdAt: "desc" },
  });

  const sheet = workbook.addWorksheet("대출목록");
  sheet.columns = [
    { header: "대출번호", key: "loanNumber", width: 18 },
    { header: "고객명", key: "customerName", width: 16 },
    { header: "대출금액", key: "loanAmount", width: 16 },
    { header: "잔액", key: "balance", width: 16 },
    { header: "연이율(%)", key: "interestRate", width: 12 },
    { header: "상환방식", key: "repaymentType", width: 14 },
    { header: "대출일", key: "startDate", width: 14 },
    { header: "만기일", key: "endDate", width: 14 },
    { header: "상태", key: "status", width: 10 },
  ];

  sheet.getRow(1).font = { bold: true };

  const statusLabel: Record<string, string> = {
    ACTIVE: "활성", COMPLETED: "완료", OVERDUE: "연체", PENDING: "대기"
  };
  const repaymentLabel: Record<string, string> = {
    BULLET: "만기일시", EQUAL_PRINCIPAL: "원금균등", EQUAL_PAYMENT: "원리금균등"
  };

  loans.forEach((l) => {
    sheet.addRow({
      loanNumber: l.loanNumber,
      customerName: l.customer.name,
      loanAmount: Number(l.loanAmount.toString()),
      balance: Number(l.balance.toString()),
      interestRate: Number(l.interestRate.toString()),
      repaymentType: repaymentLabel[l.repaymentType] || l.repaymentType,
      startDate: l.startDate.toISOString().slice(0, 10),
      endDate: l.endDate.toISOString().slice(0, 10),
      status: statusLabel[l.status] || l.status,
    });
  });

  const buf = await workbook.xlsx.writeBuffer();
  return new Response(buf, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": "attachment; filename*=UTF-8''loans.xlsx",
    },
  });
}
