"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { processPayment } from "@/actions/loan-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { CurrencyInput } from "@/components/shared/currency-input";
import { formatCurrency, formatDate } from "@/lib/formatters";

interface Schedule {
  id: string;
  installmentNumber: number;
  dueDate: Date | string;
  principalAmount: { toString(): string };
  interestAmount: { toString(): string };
  totalAmount: { toString(): string };
  paidAmount: { toString(): string };
  status: string;
}

export function PaymentDialog({
  loanId,
  schedules,
}: {
  loanId: string;
  schedules?: Schedule[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedScheduleId, setSelectedScheduleId] = useState("");
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split("T")[0]);
  const [principalAmount, setPrincipalAmount] = useState(0);
  const [interestAmount, setInterestAmount] = useState(0);
  const [overdueAmount, setOverdueAmount] = useState(0);
  const [memo, setMemo] = useState("");

  const unpaidSchedules = schedules?.filter((s) => s.status !== "PAID") || [];

  function handleScheduleSelect(scheduleId: string) {
    setSelectedScheduleId(scheduleId);

    if (!scheduleId) {
      setPrincipalAmount(0);
      setInterestAmount(0);
      setOverdueAmount(0);
      return;
    }

    const schedule = unpaidSchedules.find((s) => s.id === scheduleId);
    if (!schedule) return;

    const paid = Number(schedule.paidAmount.toString());
    const schedulePrincipal = Number(schedule.principalAmount.toString());
    const scheduleInterest = Number(schedule.interestAmount.toString());

    if (schedule.status === "PARTIAL") {
      // 부분납부된 경우: 남은 금액 계산
      const total = schedulePrincipal + scheduleInterest;
      const remaining = total - paid;
      // 이자 먼저 차감, 나머지가 원금
      const remainInterest = Math.max(scheduleInterest - Math.max(paid - schedulePrincipal, 0), 0);
      const remainPrincipal = remaining - remainInterest;
      setPrincipalAmount(Math.max(remainPrincipal, 0));
      setInterestAmount(Math.max(remainInterest, 0));
    } else {
      setPrincipalAmount(schedulePrincipal);
      setInterestAmount(scheduleInterest);
    }

    // 연체일수 계산하여 연체이자 여부 표시
    const dueDate = new Date(schedule.dueDate);
    const today = new Date();
    if (today > dueDate) {
      const overdueDays = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
      if (overdueDays > 0) {
        setMemo(`연체 ${overdueDays}일`);
      }
    } else {
      setMemo("");
    }

    setOverdueAmount(0);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    const formData = new FormData();
    formData.append("loanId", loanId);
    if (selectedScheduleId) formData.append("scheduleId", selectedScheduleId);
    formData.append("paymentDate", paymentDate);
    formData.append("principalAmount", String(principalAmount));
    formData.append("interestAmount", String(interestAmount));
    formData.append("overdueAmount", String(overdueAmount));
    formData.append("memo", memo);

    const result = await processPayment(formData);
    setSaving(false);

    if ("success" in result) {
      setOpen(false);
      // 초기화
      setSelectedScheduleId("");
      setPrincipalAmount(0);
      setInterestAmount(0);
      setOverdueAmount(0);
      setMemo("");
      router.refresh();
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>수납 처리</Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>수납 처리</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {unpaidSchedules.length > 0 && (
            <div className="grid gap-2">
              <Label>스케줄 선택</Label>
              <select
                value={selectedScheduleId}
                onChange={(e) => handleScheduleSelect(e.target.value)}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">선택 안함</option>
                {unpaidSchedules.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.installmentNumber}회차 - {formatDate(s.dueDate)} ({formatCurrency(s.totalAmount.toString())})
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="grid gap-2">
            <Label>납부일 *</Label>
            <Input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} />
          </div>

          <div className="grid gap-2">
            <Label>원금</Label>
            <CurrencyInput value={principalAmount} onChange={setPrincipalAmount} />
          </div>

          <div className="grid gap-2">
            <Label>이자</Label>
            <CurrencyInput value={interestAmount} onChange={setInterestAmount} />
          </div>

          <div className="grid gap-2">
            <Label>연체이자</Label>
            <CurrencyInput value={overdueAmount} onChange={setOverdueAmount} />
          </div>

          <div className="grid gap-2">
            <Label>메모</Label>
            <Textarea value={memo} onChange={(e) => setMemo(e.target.value)} />
          </div>

          <div className="flex justify-between items-center pt-2 border-t">
            <p className="text-base font-semibold">
              합계: {formatCurrency(principalAmount + interestAmount + overdueAmount)}
            </p>
            <Button type="submit" disabled={saving || (principalAmount + interestAmount + overdueAmount === 0)}>
              {saving ? "처리 중..." : "수납 확인"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
