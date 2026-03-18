import { notFound } from "next/navigation";
import { getCustomer } from "@/actions/customer-actions";
import { PageHeader } from "@/components/shared/page-header";
import { CustomerForm } from "@/components/customers/customer-form";

export default async function EditCustomerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const customer = await getCustomer(id);
  if (!customer) notFound();

  return (
    <>
      <PageHeader title="고객 정보 수정" />
      <CustomerForm customer={customer} />
    </>
  );
}
