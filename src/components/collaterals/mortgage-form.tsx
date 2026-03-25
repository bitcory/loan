"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createMortgage } from "@/actions/collateral-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CurrencyInput } from "@/components/shared/currency-input";

export function MortgageForm({
  collateralId,
  onSuccess,
}: {
  collateralId: string;
  onSuccess?: () => void;
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [rank, setRank] = useState(1);
  const [mortgageType, setMortgageType] = useState("SENIOR");
  const [creditor, setCreditor] = useState("");
  const [maxClaimAmount, setMaxClaimAmount] = useState(0);
  const [loanAmount, setLoanAmount] = useState(0);
  const [memo, setMemo] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    const result = await createMortgage({
      collateralId,
      rank,
      mortgageType: mortgageType as "SENIOR" | "JUNIOR",
      creditor,
      maxClaimAmount,
      loanAmount: loanAmount || undefined,
      memo: memo || undefined,
    });
    setSaving(false);

    if (result?.data?.success) {
      router.refresh();
      onSuccess?.();
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-2">
        <Label>순위 *</Label>
        <Input type="number" min={1} value={rank} onChange={(e) => setRank(Number(e.target.value))} />
      </div>

      <div className="grid gap-2">
        <Label>유형 *</Label>
        <select
          value={mortgageType}
          onChange={(e) => setMortgageType(e.target.value)}
          className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="SENIOR">선순위(갑구)</option>
          <option value="JUNIOR">후순위(을구)</option>
        </select>
      </div>

      <div className="grid gap-2">
        <Label>채권자 *</Label>
        <Input value={creditor} onChange={(e) => setCreditor(e.target.value)} placeholder="채권자명" />
      </div>

      <div className="grid gap-2">
        <Label>채권최고액 *</Label>
        <CurrencyInput value={maxClaimAmount} onChange={setMaxClaimAmount} />
      </div>

      <div className="grid gap-2">
        <Label>실 대출금</Label>
        <CurrencyInput value={loanAmount} onChange={setLoanAmount} />
      </div>

      <div className="grid gap-2">
        <Label>메모</Label>
        <Textarea value={memo} onChange={(e) => setMemo(e.target.value)} />
      </div>

      <Button type="submit" disabled={saving} className="w-full">
        {saving ? "저장 중..." : "근저당 추가"}
      </Button>
    </form>
  );
}
