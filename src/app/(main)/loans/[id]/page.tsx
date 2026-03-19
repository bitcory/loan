import { notFound } from "next/navigation";
import { getLoan } from "@/actions/loan-actions";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency, formatDate, formatPercent } from "@/lib/formatters";
import { REPAYMENT_TYPE_LABELS } from "@/lib/constants";
import { PaymentDialog } from "@/components/loans/payment-dialog";

const STATUS_CONFIG: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  ACTIVE: { label: "활성", variant: "default" },
  COMPLETED: { label: "완료", variant: "secondary" },
  OVERDUE: { label: "연체", variant: "destructive" },
  PENDING: { label: "대기", variant: "outline" },
};

const SCHEDULE_STATUS: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  SCHEDULED: { label: "예정", variant: "outline" },
  PAID: { label: "완료", variant: "secondary" },
  OVERDUE: { label: "연체", variant: "destructive" },
  PARTIAL: { label: "부분납부", variant: "default" },
};

export default async function LoanDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const loan = await getLoan(id);
  if (!loan) notFound();

  const statusConfig = STATUS_CONFIG[loan.status] || STATUS_CONFIG.ACTIVE;

  return (
    <>
      <PageHeader title={`대출 ${loan.loanNumber}`}>
        <PaymentDialog
          loanId={loan.id}
          schedules={loan.schedules.map((s) => ({
            id: s.id,
            installmentNumber: s.installmentNumber,
            dueDate: s.dueDate,
            principalAmount: s.principalAmount,
            interestAmount: s.interestAmount,
            totalAmount: s.totalAmount,
            paidAmount: s.paidAmount,
            status: s.status,
          }))}
        />
      </PageHeader>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>대출 정보</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <InfoRow label="대출번호" value={loan.loanNumber} />
            <InfoRow label="고객" value={loan.customer.name} />
            <InfoRow label="대출금액" value={formatCurrency(loan.loanAmount.toString())} />
            <InfoRow label="잔액" value={formatCurrency(loan.balance.toString())} />
            <InfoRow label="이율" value={formatPercent(loan.interestRate.toString())} />
            <InfoRow label="상환방식" value={REPAYMENT_TYPE_LABELS[loan.repaymentType]} />
            <InfoRow label="기간" value={`${loan.loanTermMonths}개월`} />
            <InfoRow label="실행일" value={formatDate(loan.startDate)} />
            <InfoRow label="만기일" value={formatDate(loan.endDate)} />
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">상태</span>
              <Badge variant={statusConfig.variant}>{statusConfig.label}</Badge>
            </div>
          </CardContent>
        </Card>

        {loan.collateral && (
          <Card>
            <CardHeader>
              <CardTitle>담보 정보</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <InfoRow label="주소" value={loan.collateral.address} />
              <InfoRow label="감정가" value={formatCurrency(loan.collateral.appraisalValue.toString())} />
              {loan.collateral.mortgages.length > 0 && (
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">근저당</p>
                  {loan.collateral.mortgages.map((m) => (
                    <p key={m.id} className="text-sm">
                      {m.rank}순위 {m.creditor} - {formatCurrency(m.maxClaimAmount.toString())}
                    </p>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      <Tabs defaultValue="schedule">
        <TabsList>
          <TabsTrigger value="schedule">상환 스케줄 ({loan.schedules.length})</TabsTrigger>
          <TabsTrigger value="payments">납부 이력 ({loan.payments.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="schedule">
          <Card>
            <CardContent className="pt-6 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>회차</TableHead>
                    <TableHead>납부일</TableHead>
                    <TableHead className="text-right">원금</TableHead>
                    <TableHead className="text-right">이자</TableHead>
                    <TableHead className="text-right">합계</TableHead>
                    <TableHead className="text-right">잔액</TableHead>
                    <TableHead>상태</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loan.schedules.map((s) => {
                    const scheduleStatus = SCHEDULE_STATUS[s.status] || SCHEDULE_STATUS.SCHEDULED;
                    return (
                      <TableRow key={s.id}>
                        <TableCell>{s.installmentNumber}</TableCell>
                        <TableCell>{formatDate(s.dueDate)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(s.principalAmount.toString())}</TableCell>
                        <TableCell className="text-right">{formatCurrency(s.interestAmount.toString())}</TableCell>
                        <TableCell className="text-right font-medium">{formatCurrency(s.totalAmount.toString())}</TableCell>
                        <TableCell className="text-right">{formatCurrency(s.remainingBalance.toString())}</TableCell>
                        <TableCell>
                          <Badge variant={scheduleStatus.variant}>{scheduleStatus.label}</Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="payments">
          <Card>
            <CardContent className="pt-6">
              {loan.payments.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">납부 이력이 없습니다</p>
              ) : (
                <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>납부일</TableHead>
                      <TableHead className="text-right">원금</TableHead>
                      <TableHead className="text-right">이자</TableHead>
                      <TableHead className="text-right">연체이자</TableHead>
                      <TableHead className="text-right">합계</TableHead>
                      <TableHead>메모</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loan.payments.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell>{formatDate(p.paymentDate)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(p.principalAmount.toString())}</TableCell>
                        <TableCell className="text-right">{formatCurrency(p.interestAmount.toString())}</TableCell>
                        <TableCell className="text-right">{formatCurrency(p.overdueAmount.toString())}</TableCell>
                        <TableCell className="text-right font-medium">{formatCurrency(p.totalAmount.toString())}</TableCell>
                        <TableCell>{p.memo || "-"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
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
