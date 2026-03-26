"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { calculatePrepayment, processPrepayment } from "@/actions/loan-lifecycle-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { formatCurrency } from "@/lib/formatters";
import { CurrencyInput } from "@/components/shared/currency-input";

interface PrepaymentPreview {
  balance: string;
  accruedInterest: string;
  prepaymentFee: string;
  totalDue: string;
  feeRate: string;
  prepaymentType: string;
  prepaymentAmount: string;
}

interface PrepaymentDialogProps {
  loanId: string;
  currentBalance: { toString(): string };
}

export function PrepaymentDialog({ loanId, currentBalance }: PrepaymentDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"form" | "preview">("form");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState<PrepaymentPreview | null>(null);

  const [prepaymentType, setPrepaymentType] = useState<"FULL" | "PARTIAL">("FULL");
  const [prepaymentDate, setPrepaymentDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [prepaymentAmount, setPrepaymentAmount] = useState(0);
  const [memo, setMemo] = useState("");

  function handleClose() {
    setOpen(false);
    setStep("form");
    setPreview(null);
    setError("");
  }

  async function handlePreview(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");

    const result = await calculatePrepayment({
      loanId,
      prepaymentDate,
      prepaymentType,
      prepaymentAmount: prepaymentType === "PARTIAL" ? prepaymentAmount : undefined,
    });

    setSaving(false);

    if (result?.data) {
      setPreview(result.data);
      setStep("preview");
    } else {
      setError(result?.serverError ?? "예상액 계산에 실패했습니다.");
    }
  }

  async function handleConfirm() {
    setSaving(true);
    setError("");

    const result = await processPrepayment({
      loanId,
      prepaymentDate,
      prepaymentType,
      prepaymentAmount: prepaymentType === "PARTIAL" ? prepaymentAmount : undefined,
      memo: memo || undefined,
    });

    setSaving(false);

    if (result?.data?.success) {
      handleClose();
      router.refresh();
    } else {
      setError(result?.serverError ?? "중도상환 처리에 실패했습니다.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); else setOpen(true); }}>
      <DialogTrigger asChild>
        <Button variant="outline">중도상환</Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>중도상환</DialogTitle>
        </DialogHeader>

        {step === "form" && (
          <form onSubmit={handlePreview} className="space-y-4">
            <div className="grid gap-2">
              <Label>상환 유형 *</Label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="prepaymentType"
                    value="FULL"
                    checked={prepaymentType === "FULL"}
                    onChange={() => setPrepaymentType("FULL")}
                  />
                  전액 중도상환
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="prepaymentType"
                    value="PARTIAL"
                    checked={prepaymentType === "PARTIAL"}
                    onChange={() => setPrepaymentType("PARTIAL")}
                  />
                  일부 중도상환
                </label>
              </div>
            </div>

            <div className="grid gap-2">
              <Label>중도상환일 *</Label>
              <Input
                type="date"
                value={prepaymentDate}
                onChange={(e) => setPrepaymentDate(e.target.value)}
                required
              />
            </div>

            {prepaymentType === "PARTIAL" && (
              <div className="grid gap-2">
                <Label>상환 원금 *</Label>
                <CurrencyInput
                  value={prepaymentAmount}
                  onChange={setPrepaymentAmount}
                />
                <p className="text-xs text-muted-foreground">
                  현재 잔액: {formatCurrency(currentBalance.toString())}
                </p>
              </div>
            )}

            <div className="grid gap-2">
              <Label>메모</Label>
              <Input
                value={memo}
                onChange={(e) => setMemo(e.target.value)}
                placeholder="중도상환 사유"
              />
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <div className="flex justify-end gap-2 pt-2 border-t">
              <Button type="button" variant="outline" onClick={handleClose}>
                취소
              </Button>
              <Button
                type="submit"
                disabled={saving || (prepaymentType === "PARTIAL" && prepaymentAmount <= 0)}
              >
                {saving ? "계산 중..." : "예상액 확인"}
              </Button>
            </div>
          </form>
        )}

        {step === "preview" && preview && (
          <div className="space-y-4">
            <div className="rounded-md border p-4 space-y-2 text-sm">
              <p className="font-semibold mb-3">
                {preview.prepaymentType === "FULL" ? "전액" : "일부"} 중도상환 예상액
              </p>
              {preview.prepaymentType === "PARTIAL" && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">상환 원금</span>
                  <span>{formatCurrency(preview.prepaymentAmount)}</span>
                </div>
              )}
              {preview.prepaymentType === "FULL" && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">잔여 원금</span>
                  <span>{formatCurrency(preview.balance)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">경과 이자</span>
                <span>{formatCurrency(preview.accruedInterest)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  중도상환수수료 ({preview.feeRate}%)
                </span>
                <span>{formatCurrency(preview.prepaymentFee)}</span>
              </div>
              <div className="flex justify-between font-semibold border-t pt-2 mt-2">
                <span>총 납부액</span>
                <span className="text-lg">{formatCurrency(preview.totalDue)}</span>
              </div>
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <div className="flex justify-between gap-2 pt-2 border-t">
              <Button variant="outline" onClick={() => setStep("form")}>
                수정
              </Button>
              <Button onClick={handleConfirm} disabled={saving}>
                {saving ? "처리 중..." : "중도상환 확인"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
