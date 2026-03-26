"use client";

import { useState, useTransition } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { createCustomerMemo, deleteCustomerMemo } from "@/actions/customer-memo-actions";
import { formatDistanceToNow } from "date-fns";
import { ko } from "date-fns/locale";
import { Trash2, MessageSquarePlus } from "lucide-react";
import { useSession } from "next-auth/react";

type Memo = {
  id: string;
  content: string;
  userId: string;
  createdAt: Date;
};

export function CustomerMemoSection({
  customerId,
  memos: initialMemos,
}: {
  customerId: string;
  memos: Memo[];
}) {
  const { data: session } = useSession();
  const [memos, setMemos] = useState(initialMemos);
  const [content, setContent] = useState("");
  const [, startTransition] = useTransition();
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim()) return;
    setSaving(true);
    const result = await createCustomerMemo({ customerId, content });
    setSaving(false);
    if (result?.data?.success) {
      setContent("");
      // 새 메모를 낙관적으로 추가 (서버 revalidatePath가 실제 데이터 새로고침)
      window.location.reload();
    }
  }

  function handleDelete(memoId: string) {
    startTransition(async () => {
      const result = await deleteCustomerMemo({ memoId, customerId });
      if (result?.data?.success) {
        setMemos((prev) => prev.filter((m) => m.id !== memoId));
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquarePlus className="h-5 w-5" />
          상담 메모 ({memos.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <form onSubmit={handleSubmit} className="space-y-2">
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="상담 내용이나 메모를 입력하세요..."
            rows={3}
            maxLength={1000}
          />
          <div className="flex justify-end">
            <Button type="submit" size="sm" disabled={saving || !content.trim()}>
              {saving ? "저장 중..." : "메모 추가"}
            </Button>
          </div>
        </form>

        {memos.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-4">
            등록된 메모가 없습니다
          </p>
        ) : (
          <div className="space-y-3">
            {memos.map((memo) => (
              <div key={memo.id} className="rounded-lg border p-3 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(memo.createdAt), {
                      addSuffix: true,
                      locale: ko,
                    })}
                  </span>
                  {session?.user?.userId === memo.userId && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-muted-foreground hover:text-destructive"
                      onClick={() => handleDelete(memo.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
                <p className="text-sm whitespace-pre-wrap">{memo.content}</p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
