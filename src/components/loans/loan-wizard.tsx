"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CurrencyInput } from "@/components/shared/currency-input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getAllCustomers } from "@/actions/customer-actions";
import { getCustomerCollaterals } from "@/actions/collateral-actions";
import { createLoan } from "@/actions/loan-actions";
import { generateSchedule, type ScheduleItem } from "@/lib/schedule-generator";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { REPAYMENT_TYPE_LABELS, COLLATERAL_TYPE_LABELS } from "@/lib/constants";

type Customer = { id: string; name: string; phone: string; customerType: string };
type Collateral = {
  id: string;
  collateralType: string;
  address: string;
  appraisalValue: unknown;
  mortgages: Array<{ maxClaimAmount: unknown }>;
};

const STEPS = ["고객 선택", "담보 설정", "대출 조건", "스케줄 확인", "최종 승인"];

export function LoanWizard() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);

  // Data
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [collaterals, setCollaterals] = useState<Collateral[]>([]);
  const [schedule, setSchedule] = useState<ScheduleItem[]>([]);

  // Form state
  const [customerId, setCustomerId] = useState("");
  const [collateralId, setCollateralId] = useState("");
  const [loanAmount, setLoanAmount] = useState(0);
  const [interestRate, setInterestRate] = useState(15);
  const [repaymentType, setRepaymentType] = useState("BULLET");
  const [loanTermMonths, setLoanTermMonths] = useState(12);
  const [startDate, setStartDate] = useState(
    new Date().toISOString().split("T")[0]
  );

  const selectedCustomer = customers.find((c) => c.id === customerId);
  const selectedCollateral = collaterals.find((c) => c.id === collateralId);

  useEffect(() => {
    getAllCustomers().then(setCustomers);
  }, []);

  useEffect(() => {
    if (customerId) {
      getCustomerCollaterals(customerId).then(setCollaterals);
    }
  }, [customerId]);

  // Generate schedule when moving to step 3
  useEffect(() => {
    if (step === 3 && loanAmount > 0 && interestRate > 0) {
      const items = generateSchedule(
        loanAmount,
        interestRate,
        repaymentType,
        new Date(startDate),
        loanTermMonths
      );
      setSchedule(items);
    }
  }, [step, loanAmount, interestRate, repaymentType, startDate, loanTermMonths]);

  async function handleSubmit() {
    setSaving(true);
    const formData = new FormData();
    formData.append("customerId", customerId);
    if (collateralId) formData.append("collateralId", collateralId);
    formData.append("loanAmount", String(loanAmount));
    formData.append("interestRate", String(interestRate));
    formData.append("repaymentType", repaymentType);
    formData.append("loanTermMonths", String(loanTermMonths));
    formData.append("startDate", startDate);

    const result = await createLoan(formData);
    setSaving(false);

    if ("success" in result) {
      router.push(`/loans/${result.id}`);
    }
  }

  function canNext() {
    switch (step) {
      case 0: return !!customerId;
      case 1: return true; // collateral is optional
      case 2: return loanAmount > 0 && interestRate > 0 && interestRate <= 20;
      case 3: return schedule.length > 0;
      default: return false;
    }
  }

  return (
    <div className="space-y-6">
      {/* Step indicator */}
      <div className="flex items-center justify-between overflow-x-auto pb-2">
        {STEPS.map((label, i) => (
          <div key={i} className="flex items-center shrink-0">
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium ${
                i <= step
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {i + 1}
            </div>
            <span className={`ml-2 text-sm hidden sm:inline ${i <= step ? "font-medium" : "text-muted-foreground"}`}>
              {label}
            </span>
            {i < STEPS.length - 1 && (
              <div className={`mx-2 sm:mx-4 h-px w-4 sm:w-8 ${i < step ? "bg-primary" : "bg-muted"}`} />
            )}
          </div>
        ))}
      </div>

      {/* Step 1: 고객 선택 */}
      {step === 0 && (
        <Card>
          <CardHeader><CardTitle>고객 선택</CardTitle></CardHeader>
          <CardContent>
            <div className="grid gap-2 max-w-md">
              <Label>고객</Label>
              <select
                value={customerId}
                onChange={(e) => setCustomerId(e.target.value)}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">고객을 선택하세요</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.phone})
                  </option>
                ))}
              </select>
            </div>
            {selectedCustomer && (
              <div className="mt-4 rounded-lg border p-4">
                <p className="font-medium">{selectedCustomer.name}</p>
                <p className="text-sm text-muted-foreground">{selectedCustomer.phone}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Step 2: 담보 설정 */}
      {step === 1 && (
        <Card>
          <CardHeader><CardTitle>담보 설정</CardTitle></CardHeader>
          <CardContent>
            <div className="grid gap-2 max-w-md">
              <Label>담보물건 (선택사항)</Label>
              <select
                value={collateralId}
                onChange={(e) => setCollateralId(e.target.value)}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">담보 없음</option>
                {collaterals.map((c) => (
                  <option key={c.id} value={c.id}>
                    {COLLATERAL_TYPE_LABELS[c.collateralType]} - {c.address} (감정가: {formatCurrency(String(c.appraisalValue))})
                  </option>
                ))}
              </select>
            </div>
            {selectedCollateral && (
              <div className="mt-4 rounded-lg border p-4">
                <p className="font-medium">{selectedCollateral.address}</p>
                <p className="text-sm">감정가: {formatCurrency(String(selectedCollateral.appraisalValue))}</p>
                <p className="text-sm text-muted-foreground">
                  근저당: {selectedCollateral.mortgages.length}건
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Step 3: 대출 조건 */}
      {step === 2 && (
        <Card>
          <CardHeader><CardTitle>대출 조건</CardTitle></CardHeader>
          <CardContent className="space-y-4 max-w-md">
            <div className="grid gap-2">
              <Label>대출금액 *</Label>
              <CurrencyInput value={loanAmount} onChange={setLoanAmount} />
            </div>
            <div className="grid gap-2">
              <Label>연이율 (%) *</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                max="20"
                value={interestRate}
                onChange={(e) => setInterestRate(Number(e.target.value))}
              />
              {interestRate > 20 && (
                <p className="text-sm text-destructive">법정 최고이율(20%)을 초과할 수 없습니다</p>
              )}
            </div>
            <div className="grid gap-2">
              <Label>상환방식 *</Label>
              <select
                value={repaymentType}
                onChange={(e) => setRepaymentType(e.target.value)}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                {Object.entries(REPAYMENT_TYPE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
            <div className="grid gap-2">
              <Label>대출기간 (개월) *</Label>
              <Input
                type="number"
                min="1"
                value={loanTermMonths}
                onChange={(e) => setLoanTermMonths(Number(e.target.value))}
              />
            </div>
            <div className="grid gap-2">
              <Label>실행일 *</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 4: 스케줄 확인 */}
      {step === 3 && (
        <Card>
          <CardHeader><CardTitle>상환 스케줄 (미리보기)</CardTitle></CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>회차</TableHead>
                  <TableHead>납부일</TableHead>
                  <TableHead className="text-right">원금</TableHead>
                  <TableHead className="text-right">이자</TableHead>
                  <TableHead className="text-right">합계</TableHead>
                  <TableHead className="text-right">잔액</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {schedule.map((s) => (
                  <TableRow key={s.installmentNumber}>
                    <TableCell>{s.installmentNumber}</TableCell>
                    <TableCell>{formatDate(s.dueDate)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(s.principalAmount.toString())}</TableCell>
                    <TableCell className="text-right">{formatCurrency(s.interestAmount.toString())}</TableCell>
                    <TableCell className="text-right font-medium">{formatCurrency(s.totalAmount.toString())}</TableCell>
                    <TableCell className="text-right">{formatCurrency(s.remainingBalance.toString())}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Step 5: 최종 승인 */}
      {step === 4 && (
        <Card>
          <CardHeader><CardTitle>최종 확인</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <h3 className="font-medium">고객 정보</h3>
                <p className="text-sm">{selectedCustomer?.name} ({selectedCustomer?.phone})</p>
              </div>
              <div className="space-y-2">
                <h3 className="font-medium">담보 정보</h3>
                <p className="text-sm">{selectedCollateral ? selectedCollateral.address : "담보 없음"}</p>
              </div>
              <div className="space-y-2">
                <h3 className="font-medium">대출 조건</h3>
                <p className="text-sm">금액: {formatCurrency(loanAmount)}</p>
                <p className="text-sm">이율: {interestRate}%</p>
                <p className="text-sm">상환: {REPAYMENT_TYPE_LABELS[repaymentType]}</p>
                <p className="text-sm">기간: {loanTermMonths}개월</p>
                <p className="text-sm">실행일: {startDate}</p>
              </div>
              <div className="space-y-2">
                <h3 className="font-medium">총 이자</h3>
                <p className="text-sm">
                  {formatCurrency(
                    schedule
                      .reduce((sum, s) => sum + Number(s.interestAmount.toString()), 0)
                      .toString()
                  )}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Navigation */}
      <div className="flex justify-between">
        <Button
          variant="outline"
          onClick={() => setStep((s) => s - 1)}
          disabled={step === 0}
        >
          이전
        </Button>
        {step < 4 ? (
          <Button onClick={() => setStep((s) => s + 1)} disabled={!canNext()}>
            다음
          </Button>
        ) : (
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? "처리 중..." : "대출 실행"}
          </Button>
        )}
      </div>
    </div>
  );
}
