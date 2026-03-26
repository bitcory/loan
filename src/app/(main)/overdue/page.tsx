import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getOverdueLoans } from "@/actions/loan-actions";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatNumber, formatPhoneNumber } from "@/lib/formatters";
import { OVERDUE_STAGE_LABELS } from "@/lib/constants";
import { BatchOverdueButton } from "@/components/loans/batch-overdue-button";
import { FileSpreadsheet } from "lucide-react";

function getStageBadgeVariant(stage: string) {
  switch (stage) {
    case "STAGE_1":
      return "secondary" as const;
    case "STAGE_2":
      return "default" as const;
    case "STAGE_3":
      return "destructive" as const;
    default:
      return "outline" as const;
  }
}

const th = "h-10 px-3 text-center text-xs font-medium text-muted-foreground whitespace-nowrap border-r border-border";
const td = "px-3 py-2 text-sm whitespace-nowrap border-r border-border";

export default async function OverduePage({
  searchParams,
}: {
  searchParams: Promise<{ stage?: string; page?: string }>;
}) {
  const params = await searchParams;
  const stage = params.stage || "ALL";
  const page = parseInt(params.page || "1", 10);
  const session = await getServerSession(authOptions);
  const isAdmin = session?.user?.role === "ADMIN";

  const { overdueLoans, total } = await getOverdueLoans({
    stage,
    page,
    pageSize: 20,
  });

  const stages = [
    { value: "ALL", label: "전체" },
    { value: "STAGE_1", label: "1단계 (1~30일)" },
    { value: "STAGE_2", label: "2단계 (31~90일)" },
    { value: "STAGE_3", label: "3단계 (91일+)" },
  ];

  return (
    <>
      <PageHeader
        title="연체관리"
        description={`총 ${total}건의 연체 대출`}
      >
        <a href="/api/export?type=overdue">
          <Button variant="outline" size="sm">
            <FileSpreadsheet className="h-4 w-4 mr-1" />
            엑셀
          </Button>
        </a>
        {isAdmin && <BatchOverdueButton />}
      </PageHeader>

      <Card>
        <CardContent className="p-0">
          <div className="border-b px-4 py-3">
            <div className="flex gap-2 overflow-x-auto">
              {stages.map((s) => (
                <Link key={s.value} href={`/overdue?stage=${s.value}`}>
                  <Button variant={stage === s.value ? "default" : "outline"} size="sm" className="whitespace-nowrap">
                    {s.label}
                  </Button>
                </Link>
              ))}
            </div>
          </div>

          <div className="scrollbar-always-visible" style={{ overflowX: "scroll", WebkitOverflowScrolling: "touch" }}>
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-muted/50 border-b border-border">
                  <th className={th}>대출번호</th>
                  <th className={th}>고객명</th>
                  <th className={th}>연락처</th>
                  <th className={th}>대출잔액</th>
                  <th className={th}>연체금액</th>
                  <th className={th}>연체일수</th>
                  <th className={th}>단계</th>
                  <th className={`${th} border-r-0`}></th>
                </tr>
              </thead>
              <tbody>
                {overdueLoans.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center text-muted-foreground py-12 text-sm">
                      연체 대출이 없습니다
                    </td>
                  </tr>
                ) : (
                  overdueLoans.map((item) => (
                    <tr key={item.loan.id} className="border-b border-border hover:bg-muted/50 transition-colors">
                      <td className={td}>
                        <Link href={`/loans/${item.loan.id}`} className="font-mono font-semibold hover:underline">
                          {item.loan.loanNumber}
                        </Link>
                      </td>
                      <td className={`${td} font-medium`}>{item.loan.customer.name}</td>
                      <td className={td}>{formatPhoneNumber(item.loan.customer.phone)}</td>
                      <td className={`${td} text-right tabular-nums`}>
                        {formatNumber(item.loan.balance.toString())}
                      </td>
                      <td className={`${td} text-right tabular-nums text-destructive font-medium`}>
                        {formatNumber(item.overdueAmount)}
                      </td>
                      <td className={`${td} text-center`}>{item.overdueDays}일</td>
                      <td className={td}>
                        <Badge variant={getStageBadgeVariant(item.overdueStage)} className="text-xs">
                          {OVERDUE_STAGE_LABELS[item.overdueStage]}
                        </Badge>
                      </td>
                      <td className={`${td} border-r-0`}>
                        <Link href={`/loans/${item.loan.id}`}>
                          <Button variant="ghost" size="sm">상세</Button>
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
