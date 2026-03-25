"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { deleteCustomer } from "@/actions/customer-actions";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Trash2 } from "lucide-react";

export function DeleteCustomerButton({ id, name }: { id: string; name: string }) {
  const router = useRouter();
  const [error, setError] = useState("");

  async function handleDelete() {
    const result = await deleteCustomer({ id });
    if (!result?.data?.success) {
      setError(result?.serverError || "삭제에 실패했습니다.");
      return;
    }
    router.push("/customers");
    router.refresh();
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="destructive">
          <Trash2 className="h-4 w-4 mr-2" />
          삭제
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>고객 삭제</AlertDialogTitle>
          <AlertDialogDescription>
            {`"${name}" 고객을 정말 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.`}
          </AlertDialogDescription>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>취소</AlertDialogCancel>
          <AlertDialogAction onClick={handleDelete}>삭제</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
