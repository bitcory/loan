import Link from "next/link";
import { getCustomers } from "@/actions/customer-actions";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { formatDate, formatPhoneNumber } from "@/lib/formatters";
import { CUSTOMER_TYPE_LABELS } from "@/lib/constants";
import { Plus } from "lucide-react";
import { ClickableRow } from "@/components/shared/clickable-row";

const th = "h-10 px-3 text-center text-xs font-medium text-muted-foreground whitespace-nowrap border-r border-border";
const td = "px-3 py-2 text-sm whitespace-nowrap border-r border-border";

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; type?: string; page?: string }>;
}) {
  const params = await searchParams;
  const page = parseInt(params.page || "1", 10);
  const { customers, total, totalPages } = await getCustomers({
    search: params.search,
    type: params.type,
    page,
  });

  return (
    <>
      <PageHeader title="고객관리" description={`총 ${total}명`}>
        <Link href="/customers/new">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            고객 등록
          </Button>
        </Link>
      </PageHeader>

      <Card>
        <CardContent className="p-0">
          <div className="border-b px-4 py-3">
            <form className="flex gap-2">
              <Input
                name="search"
                placeholder="이름, 전화번호로 검색..."
                defaultValue={params.search}
                className="max-w-sm"
              />
              <select
                name="type"
                defaultValue={params.type || ""}
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">전체 유형</option>
                <option value="INDIVIDUAL">개인</option>
                <option value="CORPORATE">법인</option>
              </select>
              <Button type="submit" variant="secondary">검색</Button>
            </form>
          </div>

          <div className="scrollbar-always-visible" style={{ overflowX: "scroll", WebkitOverflowScrolling: "touch" }}>
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-muted/50 border-b border-border">
                  <th className={th}>고객번호</th>
                  <th className={th}>이름</th>
                  <th className={th}>유형</th>
                  <th className={th}>전화번호</th>
                  <th className={th}>이메일</th>
                  <th className={th}>주소</th>
                  <th className={th}>대출</th>
                  <th className={`${th} border-r-0`}>등록일</th>
                </tr>
              </thead>
              <tbody>
                {customers.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center text-muted-foreground py-12 text-sm">
                      등록된 고객이 없습니다
                    </td>
                  </tr>
                ) : (
                  customers.map((c) => (
                    <ClickableRow key={c.id} href={`/customers/${c.id}`} className="border-b border-border hover:bg-muted/50 transition-colors cursor-pointer">
                      <td className={`${td} font-mono text-muted-foreground`}>{c.customerNumber}</td>
                      <td className={`${td} font-medium`}>
                        <span className="font-semibold">{c.name}</span>
                      </td>
                      <td className={td}>
                        <Badge variant="outline" className="text-xs">
                          {CUSTOMER_TYPE_LABELS[c.customerType]}
                        </Badge>
                      </td>
                      <td className={td}>{formatPhoneNumber(c.phone)}</td>
                      <td className={td}>{c.email || "—"}</td>
                      <td className={td}>{c.address ? `${c.address}${c.detailAddress ? ` ${c.detailAddress}` : ""}` : "—"}</td>
                      <td className={`${td} text-center`}>{c._count.loans}건</td>
                      <td className={`${td} text-muted-foreground border-r-0`}>{formatDate(c.createdAt)}</td>
                    </ClickableRow>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t px-4 py-3">
              <p className="text-sm text-muted-foreground">
                {total}건 중 {(page - 1) * 20 + 1}–{Math.min(page * 20, total)}건
              </p>
              <div className="flex gap-1">
                {page > 1 && (
                  <Link href={`/customers?page=${page - 1}${params.search ? `&search=${params.search}` : ""}${params.type ? `&type=${params.type}` : ""}`}>
                    <Button variant="outline" size="sm">이전</Button>
                  </Link>
                )}
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                  <Link key={p} href={`/customers?page=${p}${params.search ? `&search=${params.search}` : ""}${params.type ? `&type=${params.type}` : ""}`}>
                    <Button variant={p === page ? "default" : "outline"} size="sm">{p}</Button>
                  </Link>
                ))}
                {page < totalPages && (
                  <Link href={`/customers?page=${page + 1}${params.search ? `&search=${params.search}` : ""}${params.type ? `&type=${params.type}` : ""}`}>
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
