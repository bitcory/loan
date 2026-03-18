"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { collateralSchema, type CollateralFormData } from "@/lib/validators";
import { createCollateral, updateCollateral } from "@/actions/collateral-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CurrencyInput } from "@/components/shared/currency-input";
import { AddressSearch } from "@/components/shared/address-search";
import { COLLATERAL_TYPE_LABELS } from "@/lib/constants";

interface CollateralFormProps {
  customers: Array<{ id: string; name: string }>;
  defaultCustomerId?: string;
  collateral?: {
    id: string;
    customerId: string;
    collateralType: string;
    address: string;
    detailAddress?: string | null;
    area: unknown;
    appraisalValue: unknown;
    memo?: string | null;
  };
}

export function CollateralForm({ customers, defaultCustomerId, collateral }: CollateralFormProps) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const isEdit = !!collateral;

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<CollateralFormData>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(collateralSchema) as any,
    defaultValues: {
      customerId: collateral?.customerId || defaultCustomerId || "",
      collateralType: (collateral?.collateralType as CollateralFormData["collateralType"]) || "APARTMENT",
      address: collateral?.address || "",
      detailAddress: collateral?.detailAddress || "",
      area: collateral ? Number(collateral.area) : 0,
      appraisalValue: collateral ? Number(collateral.appraisalValue) : 0,
      memo: collateral?.memo || "",
    },
  });

  async function onSubmit(data: CollateralFormData) {
    setSaving(true);
    const formData = new FormData();
    Object.entries(data).forEach(([key, value]) => {
      if (value !== undefined && value !== null) formData.append(key, String(value));
    });

    const result = isEdit
      ? await updateCollateral(collateral!.id, formData)
      : await createCollateral(formData);

    if ("error" in result) {
      setSaving(false);
      return;
    }

    if (isEdit) {
      router.push(`/collaterals/${collateral!.id}`);
    } else if (defaultCustomerId) {
      router.push(`/customers/${defaultCustomerId}`);
    } else {
      router.push("/collaterals");
    }
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{isEdit ? "담보물건 수정" : "담보물건 등록"}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 max-w-lg">
          <div className="grid gap-2">
            <Label>고객 선택 *</Label>
            <select
              {...register("customerId")}
              disabled={!!defaultCustomerId}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm disabled:opacity-70"
            >
              <option value="">고객을 선택하세요</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            {errors.customerId && <p className="text-sm text-destructive">{errors.customerId.message}</p>}
          </div>

          <div className="grid gap-2">
            <Label>담보 유형 *</Label>
            <select
              {...register("collateralType")}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              {Object.entries(COLLATERAL_TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>

          <div className="grid gap-2">
            <Label>주소 *</Label>
            <AddressSearch
              value={watch("address") || ""}
              onChange={(v) => setValue("address", v, { shouldValidate: true })}
              required
            />
            {errors.address && <p className="text-sm text-destructive">{errors.address.message}</p>}
          </div>

          <div className="grid gap-2">
            <Label>상세주소</Label>
            <Input {...register("detailAddress")} placeholder="동/호수" />
          </div>

          <div className="grid gap-2">
            <Label>면적 (m²) *</Label>
            <Input type="number" step="0.01" {...register("area")} placeholder="84.95" />
            {errors.area && <p className="text-sm text-destructive">{errors.area.message}</p>}
          </div>

          <div className="grid gap-2">
            <Label>감정가 *</Label>
            <CurrencyInput
              value={watch("appraisalValue")}
              onChange={(v) => setValue("appraisalValue", v, { shouldValidate: true })}
            />
            {errors.appraisalValue && <p className="text-sm text-destructive">{errors.appraisalValue.message}</p>}
          </div>

          <div className="grid gap-2">
            <Label>메모</Label>
            <Textarea {...register("memo")} placeholder="메모" />
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
