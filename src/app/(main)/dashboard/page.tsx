import { getDashboardStats, getMonthlyStats, getDashboardExtended } from "@/actions/loan-actions";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/formatters";
import { Banknote, TrendingUp, AlertTriangle, CalendarCheck } from "lucide-react";
import { DashboardChart } from "@/components/dashboard/dashboard-chart";
import { DashboardMaturityChart } from "@/components/dashboard/dashboard-maturity-chart";
import { DashboardLtvChart } from "@/components/dashboard/dashboard-ltv-chart";

export default async function DashboardPage() {
  const [stats, monthlyData, extended] = await Promise.all([
    getDashboardStats(),
    getMonthlyStats(),
    getDashboardExtended(),
  ]);

  const cards = [
    {
      title: "총 대출잔액",
      value: formatCurrency(stats.totalBalance),
      description: `활성 대출 ${stats.activeLoans}건`,
      icon: Banknote,
    },
    {
      title: "금일 실행",
      value: `${stats.todayLoans}건`,
      description: `전체 ${stats.totalLoans}건`,
      icon: TrendingUp,
    },
    {
      title: "연체 현황",
      value: `${stats.overdueLoans}건`,
      description: "연체 대출",
      icon: AlertTriangle,
    },
    {
      title: "금주 회수예정",
      value: `${stats.upcomingPayments}건`,
      description: "7일 이내",
      icon: CalendarCheck,
    },
  ];

  return (
    <>
      <PageHeader title="대시보드" description="대출 현황 요약" />

      <div className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4">
        {cards.map((card) => (
          <Card key={card.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {card.title}
              </CardTitle>
              <card.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-lg font-bold sm:text-2xl truncate">{card.value}</div>
              <p className="text-xs text-muted-foreground">
                {card.description}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>월별 대출 실행/회수 현황</CardTitle>
        </CardHeader>
        <CardContent>
          <DashboardChart data={monthlyData} />
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>만기 도래 현황 (90일 이내)</CardTitle>
          </CardHeader>
          <CardContent>
            <DashboardMaturityChart data={extended.maturity} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>LTV 분포</CardTitle>
          </CardHeader>
          <CardContent>
            <DashboardLtvChart data={extended.ltvDistribution} />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
