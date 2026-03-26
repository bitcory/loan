import Link from "next/link";
import { getLoans } from "@/actions/loan-actions";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { formatDate, formatNumber, formatPercent } from "@/lib/formatters";
import { REPAYMENT_TYPE_LABELS } from "@/lib/constants";
import { Plus, FileSpreadsheet } from "lucide-react";
import { ClickableRow } from "@/components/shared/clickable-row";

const STATUS_CONFIG: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  ACTIVE: { label: "활성", variant: "default" },
  COMPLETED: { label: "완료", variant: "secondary" },
  OVERDUE: { label: "연체", variant: "destructive" },
  PENDING: { label: "대기", variant: "outline" },
};

const th = "h-10 px-3 text-center text-xs font-medium text-muted-foreground whitespace-nowrap border-r border-border";
const td = "px-3 py-2 text-sm whitespace-nowrap border-r border-border";

export default async function LoansPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; status?: string; page?: string }>;
}) {
  const params = await searchParams;
  const page = parseInt(params.page || "1", 10);
  const { loans, total, totalPages } = await getLoans({
    search: params.search,
    status: params.status,
    page,
  });

  return (
    <>
      <PageHeader title="대출관리" description={`총 ${total}건`}>
        <a href="/api/export?type=loans">
          <Button variant="outline" size="sm">
            <FileSpreadsheet className="h-4 w-4 mr-1" />
            엑셀
          </Button>
        </a>
        <Link href="/loans/new">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            대출 실행
          </Button>
        </Link>
      </PageHeader>

      <Card>
        <CardContent className="p-0">
          <div className="border-b px-4 py-3">
            <form className="flex flex-col gap-2 sm:flex-row">
              <Input
                name="search"
                placeholder="대출번호, 고객명으로 검색..."
                defaultValue={params.search}
                className="sm:max-w-sm"
              />
              <div className="flex gap-2">
                <select
                  name="status"
                  defaultValue={params.status || ""}
                  className="h-10 flex-1 rounded-md border border-input bg-background px-3 text-sm sm:flex-none"
                >
                  <option value="">전체 상태</option>
                  <option value="ACTIVE">활성</option>
                  <option value="COMPLETED">완료</option>
                  <option value="OVERDUE">연체</option>
                </select>
                <Button type="submit" variant="secondary">검색</Button>
              </div>
            </form>
          </div>

          <div className="scrollbar-always-visible" style={{ overflowX: "scroll", WebkitOverflowScrolling: "touch" }}>
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-muted/50 border-b border-border">
                  <th className={th}>대출번호</th>
                  <th className={th}>고객명</th>
                  <th className={th}>대출금액</th>
                  <th className={th}>잔액</th>
                  <th className={th}>이율</th>
                  <th className={th}>상환방식</th>
                  <th className={th}>상태</th>
                  <th className={`${th} border-r-0`}>실행일</th>
                </tr>
              </thead>
              <tbody>
                {loans.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center text-muted-foreground py-12 text-sm">
                      등록된 대출이 없습니다
                    </td>
                  </tr>
                ) : (
                  loans.map((loan) => {
                    const statusConfig = STATUS_CONFIG[loan.status] || STATUS_CONFIG.ACTIVE;
                    return (
                      <ClickableRow key={loan.id} href={`/loans/${loan.id}`} className="border-b border-border hover:bg-muted/50 transition-colors cursor-pointer">
                        <td className={`${td} font-mono font-semibold`}>{loan.loanNumber}</td>
                        <td className={`${td} font-medium`}>{loan.customer.name}</td>
                        <td className={`${td} text-right tabular-nums`}>{formatNumber(loan.loanAmount.toString())}</td>
                        <td className={`${td} text-right tabular-nums`}>{formatNumber(loan.balance.toString())}</td>
                        <td className={td}>{formatPercent(loan.interestRate.toString())}</td>
                        <td className={td}>{REPAYMENT_TYPE_LABELS[loan.repaymentType]}</td>
                        <td className={td}>
                          <Badge variant={statusConfig.variant} className="text-xs">{statusConfig.label}</Badge>
                        </td>
                        <td className={`${td} text-muted-foreground border-r-0`}>{formatDate(loan.startDate)}</td>
                      </ClickableRow>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex flex-col gap-2 border-t px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted-foreground">
                {total}건 중 {(page - 1) * 20 + 1}–{Math.min(page * 20, total)}건
              </p>
              <div className="flex gap-1 overflow-x-auto">
                {page > 1 && (
                  <Link href={`/loans?page=${page - 1}${params.search ? `&search=${params.search}` : ""}${params.status ? `&status=${params.status}` : ""}`}>
                    <Button variant="outline" size="sm">이전</Button>
                  </Link>
                )}
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                  <Link key={p} href={`/loans?page=${p}${params.search ? `&search=${params.search}` : ""}${params.status ? `&status=${params.status}` : ""}`}>
                    <Button variant={p === page ? "default" : "outline"} size="sm">{p}</Button>
                  </Link>
                ))}
                {page < totalPages && (
                  <Link href={`/loans?page=${page + 1}${params.search ? `&search=${params.search}` : ""}${params.status ? `&status=${params.status}` : ""}`}>
                    <Button variant="outline" size="sm">다음</Button>
                  </Link>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}
