import { notFound } from "next/navigation";
import { getCollateral } from "@/actions/collateral-actions";
import { getAllCustomers } from "@/actions/customer-actions";
import { PageHeader } from "@/components/shared/page-header";
import { CollateralForm } from "@/components/collaterals/collateral-form";

export default async function EditCollateralPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [collateral, customers] = await Promise.all([
    getCollateral(id),
    getAllCustomers(),
  ]);
  if (!collateral) notFound();

  return (
    <>
      <PageHeader title="담보물건 수정" />
      <CollateralForm customers={customers} collateral={collateral} />
    </>
  );
}
