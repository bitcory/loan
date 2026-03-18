import { PageHeader } from "@/components/shared/page-header";
import { LoanWizard } from "@/components/loans/loan-wizard";

export default function NewLoanPage() {
  return (
    <>
      <PageHeader title="대출 실행" description="단계별로 대출을 실행합니다" />
      <LoanWizard />
    </>
  );
}
