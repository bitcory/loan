import { PageHeader } from "@/components/shared/page-header";
import { CollateralForm } from "@/components/collaterals/collateral-form";
import { getAllCustomers } from "@/actions/customer-actions";

export default async function NewCollateralPage({
  searchParams,
}: {
  searchParams: Promise<{ customerId?: string }>;
}) {
  const params = await searchParams;
  const customers = await getAllCustomers();

  return (
    <>
      <PageHeader title="담보물건 등록" />
      <CollateralForm customers={customers} defaultCustomerId={params.customerId} />
    </>
  );
}
