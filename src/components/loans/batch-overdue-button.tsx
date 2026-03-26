"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { processBatchOverdue } from "@/actions/loan-lifecycle-actions";
import { Button } from "@/components/ui/button";

export function BatchOverdueButton() {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function handleRun() {
    if (!confirm("연체 일괄 처리를 실행하시겠습니까?\n연체 조건에 해당하는 모든 대출의 상태가 업데이트됩니다.")) {
      return;
    }

    setRunning(true);
    setResult(null);

    const res = await processBatchOverdue({ dryRun: false });

    setRunning(false);

    if (res?.data?.success) {
      setResult(`완료: ${res.data.affectedLoans}건 처리됨`);
      router.refresh();
    } else {
      setResult(res?.serverError ?? "처리 실패");
    }
  }

  return (
    <div className="flex items-center gap-3">
      <Button
        variant="destructive"
        size="sm"
        onClick={handleRun}
        disabled={running}
      >
        {running ? "처리 중..." : "연체 일괄 처리"}
      </Button>
      {result && (
        <span className="text-sm text-muted-foreground">{result}</span>
      )}
    </div>
  );
}
