import Link from "next/link";
import { getCollaterals } from "@/actions/collateral-actions";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { formatDate, formatNumber } from "@/lib/formatters";
import { COLLATERAL_TYPE_LABELS } from "@/lib/constants";
import { Plus } from "lucide-react";
import { ClickableRow } from "@/components/shared/clickable-row";

const th = "h-10 px-3 text-center text-xs font-medium text-muted-foreground whitespace-nowrap border-r border-border";
const td = "px-3 py-2 text-sm whitespace-nowrap border-r border-border";

export default async function CollateralsPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; type?: string; page?: string }>;
}) {
  const params = await searchParams;
  const page = parseInt(params.page || "1", 10);
  const { collaterals, total, totalPages } = await getCollaterals({
    search: params.search,
    type: params.type,
    page,
  });

  return (
    <>
      <PageHeader title="담보관리" description={`총 ${total}건`}>
        <Link href="/collaterals/new">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            담보 등록
          </Button>
        </Link>
      </PageHeader>

      <Card>
        <CardContent className="p-0">
          <div className="border-b px-4 py-3">
            <form className="flex flex-col gap-2 sm:flex-row">
              <Input
                name="search"
                placeholder="주소, 소유자로 검색..."
                defaultValue={params.search}
                className="sm:max-w-sm"
              />
              <div className="flex gap-2">
                <select
                  name="type"
                  defaultValue={params.type || ""}
                  className="h-10 flex-1 rounded-md border border-input bg-background px-3 text-sm sm:flex-none"
                >
                  <option value="">전체 유형</option>
                  {Object.entries(COLLATERAL_TYPE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
                <Button type="submit" variant="secondary">검색</Button>
              </div>
            </form>
          </div>

          <div className="scrollbar-always-visible" style={{ overflowX: "scroll", WebkitOverflowScrolling: "touch" }}>
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-muted/50 border-b border-border">
                  <th className={th}>소유자</th>
                  <th className={th}>유형</th>
                  <th className={th}>주소</th>
                  <th className={th}>면적(m²)</th>
                  <th className={th}>감정가</th>
                  <th className={th}>근저당</th>
                  <th className={th}>대출</th>
                  <th className={`${th} border-r-0`}>등록일</th>
                </tr>
              </thead>
              <tbody>
                {collaterals.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center text-muted-foreground py-12 text-sm">
                      등록된 담보물건이 없습니다
                    </td>
                  </tr>
                ) : (
                  collaterals.map((c) => (
                    <ClickableRow key={c.id} href={`/collaterals/${c.id}`} className="border-b border-border hover:bg-muted/50 transition-colors cursor-pointer">
                      <td className={`${td} font-medium`}>{c.customer.name}</td>
                      <td className={td}>
                        <Badge variant="outline" className="text-xs">{COLLATERAL_TYPE_LABELS[c.collateralType]}</Badge>
                      </td>
                      <td className={`${td} font-semibold`}>{c.address}</td>
                      <td className={`${td} text-right tabular-nums`}>{formatNumber(c.area.toString())}</td>
                      <td className={`${td} text-right tabular-nums`}>{formatNumber(c.appraisalValue.toString())}</td>
                      <td className={`${td} text-center`}>{c.mortgages.length}</td>
                      <td className={`${td} text-center`}>{c._count.loans}</td>
                      <td className={`${td} text-muted-foreground border-r-0`}>{formatDate(c.createdAt)}</td>
                    </ClickableRow>
                  ))
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
                  <Link href={`/collaterals?page=${page - 1}${params.search ? `&search=${params.search}` : ""}${params.type ? `&type=${params.type}` : ""}`}>
                    <Button variant="outline" size="sm">이전</Button>
                  </Link>
                )}
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                  <Link key={p} href={`/collaterals?page=${p}${params.search ? `&search=${params.search}` : ""}${params.type ? `&type=${params.type}` : ""}`}>
                    <Button variant={p === page ? "default" : "outline"} size="sm">{p}</Button>
                  </Link>
                ))}
                {page < totalPages && (
                  <Link href={`/collaterals?page=${page + 1}${params.search ? `&search=${params.search}` : ""}${params.type ? `&type=${params.type}` : ""}`}>
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
