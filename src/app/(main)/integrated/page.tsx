import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  formatDate,
  formatNumber,
  formatPercent,
  formatPhoneNumber,
} from "@/lib/formatters";
import {
  CUSTOMER_TYPE_LABELS,
  COLLATERAL_TYPE_LABELS,
} from "@/lib/constants";

const STATUS_CONFIG: Record<
  string,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
  ACTIVE: { label: "활성", variant: "default" },
  COMPLETED: { label: "완료", variant: "secondary" },
  OVERDUE: { label: "연체", variant: "destructive" },
  PENDING: { label: "대기", variant: "outline" },
};

const PAGE_SIZE = 20;

async function getIntegratedData(params: {
  search?: string;
  status?: string;
  page?: number;
}) {
  const { search, status, page = 1 } = params;
  const where: Record<string, unknown> = {};

  if (search) {
    where.OR = [
      { loanNumber: { contains: search } },
      { customer: { name: { contains: search, mode: "insensitive" } } },
      { customer: { phone: { contains: search } } },
      { collateral: { address: { contains: search, mode: "insensitive" } } },
    ];
  }
  if (status) where.status = status;

  const [loans, total] = await Promise.all([
    prisma.loan.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            customerType: true,
            phone: true,
            createdAt: true,
          },
        },
        collateral: {
          select: {
            id: true,
            collateralType: true,
            address: true,
            appraisalValue: true,
          },
        },
      },
    }),
    prisma.loan.count({ where }),
  ]);

  return {
    loans,
    total,
    page,
    totalPages: Math.ceil(total / PAGE_SIZE),
  };
}

const th = "h-10 px-3 text-center text-xs font-medium text-muted-foreground whitespace-nowrap border-r border-border";
const td = "px-3 py-2 text-sm whitespace-nowrap border-r border-border";

export default async function IntegratedPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; status?: string; page?: string }>;
}) {
  const params = await searchParams;
  const page = parseInt(params.page || "1", 10);
  const { loans, total, totalPages } = await getIntegratedData({
    search: params.search,
    status: params.status,
    page,
  });

  return (
    <>
      <PageHeader
        title="통합관리"
        description={`고객 / 담보 / 대출 통합 조회 — 총 ${total}건`}
      />

      <Card>
        <CardContent className="p-0">
          {/* 검색바 */}
          <div className="border-b px-4 py-3">
            <form className="flex flex-col gap-2 sm:flex-row">
              <Input
                name="search"
                placeholder="이름, 전화번호, 대출번호, 주소로 검색..."
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
                <Button type="submit" variant="secondary">
                  검색
                </Button>
              </div>
            </form>
          </div>

          {/* 테이블 - 횡스크롤 */}
          <div
            style={{
              overflowX: "scroll",
              WebkitOverflowScrolling: "touch",
            }}
            className="scrollbar-always-visible"
          >
            <table className="w-full border-collapse" style={{ minWidth: 1500 }}>
              <thead>
                <tr className="bg-muted/50 border-b border-border">
                  <th className={`${th} sticky left-0 z-10 bg-muted/50 font-semibold`}>이름</th>
                  <th className={th}>유형</th>
                  <th className={th}>전화번호</th>
                  <th className={th}>등록일</th>
                  <th className={`${th} font-semibold`}>대출번호</th>
                  <th className={th}>대출금액</th>
                  <th className={th}>대출잔액</th>
                  <th className={th}>이율</th>
                  <th className={th}>상태</th>
                  <th className={th}>실행일</th>
                  <th className={th}>만기일</th>
                  <th className={`${th} font-semibold`}>담보유형</th>
                  <th className={th}>주소</th>
                  <th className={`${th} border-r-0`}>감정가</th>
                </tr>
              </thead>
              <tbody>
                {loans.length === 0 ? (
                  <tr>
                    <td colSpan={14} className="text-center text-muted-foreground py-12 text-sm">
                      등록된 데이터가 없습니다
                    </td>
                  </tr>
                ) : (
                  loans.map((loan) => {
                    const statusConfig = STATUS_CONFIG[loan.status] || STATUS_CONFIG.ACTIVE;
                    return (
                      <tr key={loan.id} className="border-b border-border hover:bg-muted/50 transition-colors">
                        <td className={`${td} sticky left-0 z-10 bg-card font-medium`}>
                          <Link href={`/customers/${loan.customer.id}`} className="font-semibold hover:underline">
                            {loan.customer.name}
                          </Link>
                        </td>
                        <td className={td}>
                          <Badge variant="outline" className="text-xs">
                            {CUSTOMER_TYPE_LABELS[loan.customer.customerType]}
                          </Badge>
                        </td>
                        <td className={td}>
                          {formatPhoneNumber(loan.customer.phone)}
                        </td>
                        <td className={`${td} text-muted-foreground`}>
                          {formatDate(loan.customer.createdAt)}
                        </td>
                        <td className={td}>
                          <Link href={`/loans/${loan.id}`} className="font-mono font-semibold hover:underline">
                            {loan.loanNumber}
                          </Link>
                        </td>
                        <td className={`${td} text-right tabular-nums`}>
                          {formatNumber(loan.loanAmount.toString())}
                        </td>
                        <td className={`${td} text-right tabular-nums`}>
                          {formatNumber(loan.balance.toString())}
                        </td>
                        <td className={td}>
                          {formatPercent(loan.interestRate.toString())}
                        </td>
                        <td className={td}>
                          <Badge variant={statusConfig.variant} className="text-xs">
                            {statusConfig.label}
                          </Badge>
                        </td>
                        <td className={`${td} text-muted-foreground`}>
                          {formatDate(loan.startDate)}
                        </td>
                        <td className={`${td} text-muted-foreground`}>
                          {formatDate(loan.endDate)}
                        </td>
                        <td className={td}>
                          {loan.collateral ? (
                            <Badge variant="outline" className="text-xs">
                              {COLLATERAL_TYPE_LABELS[loan.collateral.collateralType]}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground text-xs">—</span>
                          )}
                        </td>
                        <td className={td}>
                          {loan.collateral ? (
                            <Link href={`/collaterals/${loan.collateral.id}`} className="font-semibold hover:underline">
                              {loan.collateral.address}
                            </Link>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className={`${td} text-right tabular-nums border-r-0`}>
                          {loan.collateral
                            ? formatNumber(loan.collateral.appraisalValue.toString())
                            : <span className="text-muted-foreground">—</span>
                          }
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* 페이지네이션 */}
          {totalPages > 1 && (
            <div className="flex flex-col gap-2 border-t px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted-foreground">
                {total}건 중 {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)}건
              </p>
              <div className="flex gap-1 overflow-x-auto">
                {page > 1 && (
                  <Link
                    href={`/integrated?page=${page - 1}${params.search ? `&search=${params.search}` : ""}${params.status ? `&status=${params.status}` : ""}`}
                  >
                    <Button variant="outline" size="sm">이전</Button>
                  </Link>
                )}
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                  <Link
                    key={p}
                    href={`/integrated?page=${p}${params.search ? `&search=${params.search}` : ""}${params.status ? `&status=${params.status}` : ""}`}
                  >
                    <Button variant={p === page ? "default" : "outline"} size="sm">
                      {p}
                    </Button>
                  </Link>
                ))}
                {page < totalPages && (
                  <Link
                    href={`/integrated?page=${page + 1}${params.search ? `&search=${params.search}` : ""}${params.status ? `&status=${params.status}` : ""}`}
                  >
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
