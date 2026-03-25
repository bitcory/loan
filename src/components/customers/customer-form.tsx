"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { customerSchema, type CustomerFormData } from "@/lib/validators";
import { createCustomer, updateCustomer } from "@/actions/customer-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PhoneInput } from "@/components/shared/phone-input";
import { AddressSearch } from "@/components/shared/address-search";

interface CustomerFormProps {
  customer?: {
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

export function CustomerForm({ customer }: CustomerFormProps) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const isEdit = !!customer;

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<CustomerFormData>({
    resolver: zodResolver(customerSchema),
    defaultValues: {
      name: customer?.name || "",
      customerType: (customer?.customerType as "INDIVIDUAL" | "CORPORATE") || "INDIVIDUAL",
      residentNumber: customer?.residentNumber || "",
      businessNumber: customer?.businessNumber || "",
      phone: customer?.phone || "",
      email: customer?.email || "",
      address: customer?.address || "",
      detailAddress: customer?.detailAddress || "",
      memo: customer?.memo || "",
    },
  });

  const customerType = watch("customerType");

  async function onSubmit(data: CustomerFormData) {
    setSaving(true);

    const result = isEdit
      ? await updateCustomer({ id: customer!.id, data })
      : await createCustomer(data);

    if (!result?.data?.success) {
      setSaving(false);
      return;
    }

    router.push(isEdit ? `/customers/${customer!.id}` : "/customers");
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{isEdit ? "고객 정보 수정" : "고객 등록"}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 max-w-lg">
          <div className="grid gap-2">
            <Label htmlFor="name">이름 *</Label>
            <Input id="name" {...register("name")} placeholder="고객명" />
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
              <Label htmlFor="residentNumber">주민등록번호</Label>
              <Input
                id="residentNumber"
                {...register("residentNumber")}
                placeholder="000000-0000000"
              />
              {errors.residentNumber && (
                <p className="text-sm text-destructive">{errors.residentNumber.message}</p>
              )}
            </div>
          )}

          {customerType === "CORPORATE" && (
            <div className="grid gap-2">
              <Label htmlFor="businessNumber">사업자등록번호</Label>
              <Input
                id="businessNumber"
                {...register("businessNumber")}
                placeholder="000-00-00000"
              />
              {errors.businessNumber && (
                <p className="text-sm text-destructive">{errors.businessNumber.message}</p>
              )}
            </div>
          )}

          <div className="grid gap-2">
            <Label htmlFor="phone">전화번호 *</Label>
            <PhoneInput
              value={watch("phone")}
              onChange={(v) => setValue("phone", v, { shouldValidate: true })}
            />
            {errors.phone && <p className="text-sm text-destructive">{errors.phone.message}</p>}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="email">이메일</Label>
            <Input id="email" type="email" {...register("email")} placeholder="email@example.com" />
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
            <Label htmlFor="memo">메모</Label>
            <Textarea id="memo" {...register("memo")} placeholder="메모" />
          </div>

          <div className="flex gap-2 pt-4">
            <Button type="submit" disabled={saving}>
              {saving ? "저장 중..." : isEdit ? "수정" : "등록"}
            </Button>
            <Button type="button" variant="outline" onClick={() => router.back()}>
              취소
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
