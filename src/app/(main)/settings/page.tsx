import { getSettings } from "@/actions/setting-actions";
import { PageHeader } from "@/components/shared/page-header";
import { SettingsForm } from "@/components/settings/settings-form";

const DEFAULT_SETTINGS = [
  { key: "max_ltv", label: "최대 LTV (%)", defaultValue: "70" },
  { key: "default_interest_rate", label: "기본 이율 (%)", defaultValue: "15" },
  { key: "max_interest_rate", label: "법정 최고이율 (%)", defaultValue: "20" },
  { key: "overdue_rate_addition", label: "연체가산이율 (%)", defaultValue: "3" },
  { key: "company_name", label: "회사명", defaultValue: "대부전산" },
];

export default async function SettingsPage() {
  const settings = await getSettings();
  const settingsMap = new Map(settings.map((s) => [s.key, s.value]));

  const formData = DEFAULT_SETTINGS.map((ds) => ({
    ...ds,
    value: settingsMap.get(ds.key) || ds.defaultValue,
  }));

  return (
    <>
      <PageHeader title="설정" description="시스템 기본 설정" />
      <SettingsForm settings={formData} />
    </>
  );
}
