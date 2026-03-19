import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/formatters";
import { REPAYMENT_TYPE_LABELS } from "@/lib/constants";
import { StatisticsCharts } from "@/components/statistics/statistics-charts";

async function getStatistics() {
  const [
    totalCustomers,
    totalCollaterals,
    loansByStatus,
    loansByType,
    totalDisbursed,
    totalCollected,
  ] = await Promise.all([
    prisma.customer.count(),
    prisma.collateral.count(),
    prisma.loan.groupBy({
      by: ["status"],
      _count: true,
      _sum: { balance: true },
    }),
    prisma.loan.groupBy({
      by: ["repaymentType"],
      _count: true,
      _sum: { loanAmount: true },
    }),
    prisma.loan.aggregate({ _sum: { loanAmount: true } }),
    prisma.payment.aggregate({ _sum: { totalAmount: true } }),
  ]);

  return {
    totalCustomers,
    totalCollaterals,
    loansByStatus,
    loansByType,
    totalDisbursed: totalDisbursed._sum.loanAmount?.toString() || "0",
    totalCollected: totalCollected._sum.totalAmount?.toString() || "0",
  };
}

export default async function StatisticsPage() {
  const stats = await getStatistics();

  const statusData = stats.loansByStatus.map((item) => ({
    name:
      item.status === "ACTIVE"
        ? "활성"
        : item.status === "COMPLETED"
          ? "완료"
          : item.status === "OVERDUE"
            ? "연체"
            : item.status,
    value: item._count,
    amount: Number(item._sum.balance || 0),
  }));

  const typeData = stats.loansByType.map((item) => ({
    name: REPAYMENT_TYPE_LABELS[item.repaymentType] || item.repaymentType,
    value: item._count,
    amount: Number(item._sum.loanAmount || 0),
  }));

  return (
    <>
      <PageHeader title="통계" description="대출 현황 통계 리포트" />

      <div className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">총 고객수</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold sm:text-2xl">{stats.totalCustomers}명</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">총 담보물건</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold sm:text-2xl">{stats.totalCollaterals}건</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">총 실행금액</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold sm:text-2xl truncate">
              {formatCurrency(stats.totalDisbursed)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">총 회수금액</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold sm:text-2xl truncate">
              {formatCurrency(stats.totalCollected)}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>대출 상태별 현황</CardTitle>
          </CardHeader>
          <CardContent>
            <StatisticsCharts data={statusData} type="status" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>상환방식별 현황</CardTitle>
          </CardHeader>
          <CardContent>
            <StatisticsCharts data={typeData} type="type" />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
