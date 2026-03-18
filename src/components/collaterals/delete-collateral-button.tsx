"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { deleteCollateral } from "@/actions/collateral-actions";
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

export function DeleteCollateralButton({ id, address }: { id: string; address: string }) {
  const router = useRouter();
  const [error, setError] = useState("");

  async function handleDelete() {
    const result = await deleteCollateral(id);
    if ("error" in result) {
      setError(result.error as string);
      return;
    }
    router.push("/collaterals");
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
          <AlertDialogTitle>담보물건 삭제</AlertDialogTitle>
          <AlertDialogDescription>
            {`"${address}" 담보물건을 정말 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.`}
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
