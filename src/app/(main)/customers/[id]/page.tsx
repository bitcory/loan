import Link from "next/link";
import { notFound } from "next/navigation";
import { getCustomer } from "@/actions/customer-actions";
import { getCustomerMemos } from "@/actions/customer-memo-actions";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency, formatDate, formatPhoneNumber, formatResidentNumber } from "@/lib/formatters";
import { CUSTOMER_TYPE_LABELS, COLLATERAL_TYPE_LABELS } from "@/lib/constants";
import { DeleteCustomerButton } from "@/components/customers/delete-customer-button";
import { EditCustomerDialog } from "@/components/customers/edit-customer-dialog";
import { CustomerMemoSection } from "@/components/customers/customer-memo-section";
import { Plus } from "lucide-react";

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [customer, memos] = await Promise.all([
    getCustomer(id),
    getCustomerMemos(id),
  ]);
  if (!customer) notFound();

  return (
    <>
      <PageHeader title={customer.name}>
        <EditCustomerDialog customer={{
          id: customer.id,
          name: customer.name,
          customerType: customer.customerType,
          residentNumber: customer.residentNumber,
          businessNumber: customer.businessNumber,
          phone: customer.phone,
          email: customer.email,
          address: customer.address,
          detailAddress: customer.detailAddress,
          memo: customer.memo,
        }} />
        <DeleteCustomerButton id={id} name={customer.name} />
      </PageHeader>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>기본 정보</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <InfoRow label="고객번호" value={customer.customerNumber} />
            <InfoRow label="유형" value={CUSTOMER_TYPE_LABELS[customer.customerType]} />
            {customer.residentNumber && (
              <InfoRow label="주민등록번호" value={formatResidentNumber(customer.residentNumber)} />
            )}
            {customer.businessNumber && (
              <InfoRow label="사업자등록번호" value={customer.businessNumber} />
            )}
            <InfoRow label="전화번호" value={formatPhoneNumber(customer.phone)} />
            <InfoRow label="이메일" value={customer.email || "-"} />
            <InfoRow label="주소" value={[customer.address, customer.detailAddress].filter(Boolean).join(" ") || "-"} />
            <InfoRow label="메모" value={customer.memo || "-"} />
            <InfoRow label="등록일" value={formatDate(customer.createdAt)} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>담보물건 ({customer.collaterals.length}건)</CardTitle>
            <Link href={`/collaterals/new?customerId=${id}`}>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-1" />
                담보 등록
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {customer.collaterals.length === 0 ? (
              <p className="text-sm text-muted-foreground">등록된 담보물건이 없습니다</p>
            ) : (
              <div className="space-y-3">
                {customer.collaterals.map((c) => (
                  <Link key={c.id} href={`/collaterals/${c.id}`} className="block">
                    <div className="rounded-lg border p-3 hover:bg-accent transition-colors">
                      <div className="flex items-center justify-between">
                        <Badge variant="outline">{COLLATERAL_TYPE_LABELS[c.collateralType]}</Badge>
                        <span className="text-sm font-medium">{formatCurrency(c.appraisalValue.toString())}</span>
                      </div>
                      <p className="text-sm mt-1">{c.address} {c.detailAddress || ""}</p>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>대출 이력 ({customer.loans.length}건)</CardTitle>
        </CardHeader>
        <CardContent>
          {customer.loans.length === 0 ? (
            <p className="text-sm text-muted-foreground">대출 이력이 없습니다</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>대출번호</TableHead>
                  <TableHead className="text-right">대출금액</TableHead>
                  <TableHead className="text-right">잔액</TableHead>
                  <TableHead>이율</TableHead>
                  <TableHead>상태</TableHead>
                  <TableHead>실행일</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {customer.loans.map((loan) => (
                  <TableRow key={loan.id}>
                    <TableCell className="font-mono">{loan.loanNumber}</TableCell>
                    <TableCell className="text-right">{formatCurrency(loan.loanAmount.toString())}</TableCell>
                    <TableCell className="text-right">{formatCurrency(loan.balance.toString())}</TableCell>
                    <TableCell>{Number(loan.interestRate)}%</TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          loan.status === "ACTIVE"
                            ? "default"
                            : loan.status === "COMPLETED"
                              ? "secondary"
                              : "destructive"
                        }
                      >
                        {loan.status === "ACTIVE" ? "활성" : loan.status === "COMPLETED" ? "완료" : "연체"}
                      </Badge>
                    </TableCell>
                    <TableCell>{formatDate(loan.startDate)}</TableCell>
                    <TableCell>
                      <Link href={`/loans/${loan.id}`}>
                        <Button variant="ghost" size="sm">상세</Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <CustomerMemoSection customerId={id} memos={memos} />
    </>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span>{value}</span>
    </div>
  );
}
