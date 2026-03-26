"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { extendLoan } from "@/actions/loan-lifecycle-actions";
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

interface ExtendLoanDialogProps {
  loanId: string;
  currentEndDate: Date | string;
  currentInterestRate: { toString(): string };
}

export function ExtendLoanDialog({
  loanId,
  currentEndDate,
  currentInterestRate,
}: ExtendLoanDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const currentEnd = new Date(currentEndDate);
  const defaultNewEnd = new Date(currentEnd);
  defaultNewEnd.setMonth(defaultNewEnd.getMonth() + 12);

  const [newEndDate, setNewEndDate] = useState(
    defaultNewEnd.toISOString().split("T")[0]
  );
  const [newInterestRate, setNewInterestRate] = useState(
    currentInterestRate.toString()
  );
  const [settleOverdueNow, setSettleOverdueNow] = useState(true);
  const [memo, setMemo] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");

    const result = await extendLoan({
      loanId,
      newEndDate,
      newInterestRate: newInterestRate ? Number(newInterestRate) : undefined,
      settleOverdueNow,
      memo: memo || undefined,
    });

    setSaving(false);

    if (result?.data?.success) {
      setOpen(false);
      router.refresh();
    } else {
      setError(result?.serverError ?? "만기 연장에 실패했습니다.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">만기 연장</Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>만기 연장</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-2">
            <Label>새 만기일 *</Label>
            <Input
              type="date"
              value={newEndDate}
              onChange={(e) => setNewEndDate(e.target.value)}
              required
            />
          </div>

          <div className="grid gap-2">
            <Label>새 이율 (%) — 미입력 시 기존 이율 유지</Label>
            <Input
              type="number"
              step="0.01"
              min="0.01"
              max="20"
              value={newInterestRate}
              onChange={(e) => setNewInterestRate(e.target.value)}
              placeholder={currentInterestRate.toString()}
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="settleOverdue"
              checked={settleOverdueNow}
              onChange={(e) => setSettleOverdueNow(e.target.checked)}
              className="h-4 w-4"
            />
            <Label htmlFor="settleOverdue" className="cursor-pointer">
              연체이자 즉시 정산
            </Label>
          </div>

          <div className="grid gap-2">
            <Label>메모</Label>
            <Textarea
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              placeholder="연장 사유"
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              취소
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "처리 중..." : "연장 확인"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
