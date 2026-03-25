"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { customerSchema, type CustomerFormData } from "@/lib/validators";
import { updateCustomer } from "@/actions/customer-actions";
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
import { PhoneInput } from "@/components/shared/phone-input";
import { AddressSearch } from "@/components/shared/address-search";
import { Pencil } from "lucide-react";

interface EditCustomerDialogProps {
  customer: {
    id: string;
    name: string;
    customerType: string;
    residentNumber?: string | null;
    businessNumber?: string | null;
    phone: string;
    email?: string | null;
    address?: string | null;
    detailAddress?: string | null;
    memo?: string | null;
  };
}

export function EditCustomerDialog({ customer }: EditCustomerDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<CustomerFormData>({
    resolver: zodResolver(customerSchema),
    defaultValues: {
      name: customer.name,
      customerType: (customer.customerType as "INDIVIDUAL" | "CORPORATE"),
      residentNumber: customer.residentNumber || "",
      businessNumber: customer.businessNumber || "",
      phone: customer.phone,
      email: customer.email || "",
      address: customer.address || "",
      detailAddress: customer.detailAddress || "",
      memo: customer.memo || "",
    },
  });

  const customerType = watch("customerType");

  async function onSubmit(data: CustomerFormData) {
    setSaving(true);
    const result = await updateCustomer({ id: customer.id, data });
    setSaving(false);

    if (!result?.data?.success) return;

    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Pencil className="h-4 w-4 mr-2" />
          수정
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>고객 정보 수정</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid gap-2">
            <Label>이름 *</Label>
            <Input {...register("name")} placeholder="고객명" />
            {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
          </div>

          <div className="grid gap-2">
            <Label>고객 유형 *</Label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2">
                <input type="radio" value="INDIVIDUAL" {...register("customerType")} />
                개인
              </label>
              <label className="flex items-center gap-2">
                <input type="radio" value="CORPORATE" {...register("customerType")} />
                법인
              </label>
            </div>
          </div>

          {customerType === "INDIVIDUAL" && (
            <div className="grid gap-2">
              <Label>주민등록번호</Label>
              <Input {...register("residentNumber")} placeholder="000000-0000000" />
              {errors.residentNumber && (
                <p className="text-sm text-destructive">{errors.residentNumber.message}</p>
              )}
            </div>
          )}

          {customerType === "CORPORATE" && (
            <div className="grid gap-2">
              <Label>사업자등록번호</Label>
              <Input {...register("businessNumber")} placeholder="000-00-00000" />
              {errors.businessNumber && (
                <p className="text-sm text-destructive">{errors.businessNumber.message}</p>
              )}
            </div>
          )}

          <div className="grid gap-2">
            <Label>전화번호 *</Label>
            <PhoneInput
              value={watch("phone")}
              onChange={(v) => setValue("phone", v, { shouldValidate: true })}
            />
            {errors.phone && <p className="text-sm text-destructive">{errors.phone.message}</p>}
          </div>

          <div className="grid gap-2">
            <Label>이메일</Label>
            <Input type="email" {...register("email")} placeholder="email@example.com" />
            {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
          </div>

          <div className="grid gap-2">
            <Label>주소</Label>
            <AddressSearch
              value={watch("address") || ""}
              onChange={(v) => setValue("address", v, { shouldValidate: true })}
            />
            <Input {...register("detailAddress")} placeholder="상세주소 (동/호수)" />
          </div>

          <div className="grid gap-2">
            <Label>메모</Label>
            <Textarea {...register("memo")} placeholder="메모" />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              취소
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "저장 중..." : "수정"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
