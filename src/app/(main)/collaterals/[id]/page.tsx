import Link from "next/link";
import { notFound } from "next/navigation";
import { getCollateral } from "@/actions/collateral-actions";
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
import { formatCurrency, formatNumber, formatDate } from "@/lib/formatters";
import { COLLATERAL_TYPE_LABELS } from "@/lib/constants";
import { calculateLTV } from "@/lib/ltv";
import { Pencil } from "lucide-react";
import { AddMortgageButton } from "@/components/collaterals/add-mortgage-button";
import { DeleteCollateralButton } from "@/components/collaterals/delete-collateral-button";

export default async function CollateralDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const collateral = await getCollateral(id);
  if (!collateral) notFound();

  const totalMortgage = collateral.mortgages.reduce(
    (sum, m) => sum + Number(m.maxClaimAmount),
    0
  );
  const ltv = calculateLTV({
    appraisalValue: collateral.appraisalValue.toString(),
    existingMortgages: totalMortgage,
    newLoanAmount: 0,
  });

  return (
    <>
      <PageHeader title={`${COLLATERAL_TYPE_LABELS[collateral.collateralType]} - ${collateral.address}`}>
        <Link href={`/collaterals/${id}/edit`}>
          <Button variant="outline">
            <Pencil className="h-4 w-4 mr-2" />
            수정
          </Button>
        </Link>
        <DeleteCollateralButton id={id} address={collateral.address} />
      </PageHeader>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>물건 정보</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <InfoRow label="소유자" value={collateral.customer.name} />
            <InfoRow label="유형" value={COLLATERAL_TYPE_LABELS[collateral.collateralType]} />
            <InfoRow label="주소" value={`${collateral.address} ${collateral.detailAddress || ""}`} />
            <InfoRow label="면적" value={`${formatNumber(collateral.area.toString())}m²`} />
            <InfoRow label="감정가" value={formatCurrency(collateral.appraisalValue.toString())} />
            <InfoRow label="등록일" value={formatDate(collateral.createdAt)} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>LTV 현황</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <InfoRow label="감정가" value={formatCurrency(collateral.appraisalValue.toString())} />
            <InfoRow label="근저당 합계" value={formatCurrency(totalMortgage)} />
            <InfoRow label="현재 LTV" value={`${ltv.toString()}%`} />
            <div className="mt-4">
              <div className="h-3 w-full bg-secondary rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${Number(ltv) > 70 ? "bg-destructive" : "bg-primary"}`}
                  style={{ width: `${Math.min(Number(ltv), 100)}%` }}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>근저당권 ({collateral.mortgages.length}건)</CardTitle>
          <AddMortgageButton collateralId={id} />
        </CardHeader>
        <CardContent>
          {collateral.mortgages.length === 0 ? (
            <p className="text-sm text-muted-foreground">등록된 근저당이 없습니다</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>순위</TableHead>
                  <TableHead>유형</TableHead>
                  <TableHead>채권자</TableHead>
                  <TableHead className="text-right">채권최고액</TableHead>
                  <TableHead className="text-right">실 대출금</TableHead>
                  <TableHead>메모</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {collateral.mortgages.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell>{m.rank}순위</TableCell>
                    <TableCell>
                      <Badge variant={m.mortgageType === "SENIOR" ? "default" : "secondary"}>
                        {m.mortgageType === "SENIOR" ? "선순위(갑구)" : "후순위(을구)"}
                      </Badge>
                    </TableCell>
                    <TableCell>{m.creditor}</TableCell>
                    <TableCell className="text-right">{formatCurrency(m.maxClaimAmount.toString())}</TableCell>
                    <TableCell className="text-right">{m.loanAmount ? formatCurrency(m.loanAmount.toString()) : "-"}</TableCell>
                    <TableCell>{m.memo || "-"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {collateral.loans.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>연계 대출 ({collateral.loans.length}건)</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>대출번호</TableHead>
                  <TableHead>고객</TableHead>
                  <TableHead className="text-right">대출금액</TableHead>
                  <TableHead className="text-right">잔액</TableHead>
                  <TableHead>상태</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {collateral.loans.map((loan) => (
                  <TableRow key={loan.id}>
                    <TableCell className="font-mono">{loan.loanNumber}</TableCell>
                    <TableCell>{loan.customer?.name}</TableCell>
                    <TableCell className="text-right">{formatCurrency(loan.loanAmount.toString())}</TableCell>
                    <TableCell className="text-right">{formatCurrency(loan.balance.toString())}</TableCell>
                    <TableCell>
                      <Badge variant={loan.status === "ACTIVE" ? "default" : loan.status === "COMPLETED" ? "secondary" : "destructive"}>
                        {loan.status === "ACTIVE" ? "활성" : loan.status === "COMPLETED" ? "완료" : "연체"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Link href={`/loans/${loan.id}`}>
                        <Button variant="ghost" size="sm">상세</Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
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
