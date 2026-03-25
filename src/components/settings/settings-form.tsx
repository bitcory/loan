"use client";

import { useState } from "react";
import { updateSettings } from "@/actions/setting-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface SettingItem {
  key: string;
  label: string;
  value: string;
}

export function SettingsForm({ settings }: { settings: SettingItem[] }) {
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setMessage("");

    const formData = new FormData(e.currentTarget);
    const settingsRecord: Record<string, string> = {};
    Array.from(formData.entries()).forEach(([key, value]) => {
      if (key.startsWith("setting_")) {
        const settingKey = key.replace("setting_", "");
        settingsRecord[settingKey] = String(value);
      }
    });

    const result = await updateSettings(settingsRecord);

    if (result?.data?.success) {
      setMessage("설정이 저장되었습니다.");
    }
    setSaving(false);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>기본 설정</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {settings.map((setting) => (
            <div key={setting.key} className="grid gap-2">
              <Label htmlFor={setting.key}>{setting.label}</Label>
              <Input
                id={setting.key}
                name={`setting_${setting.key}`}
                defaultValue={setting.value}
                className="max-w-sm"
              />
            </div>
          ))}
          <div className="flex items-center gap-4 pt-4">
            <Button type="submit" disabled={saving}>
              {saving ? "저장 중..." : "설정 저장"}
            </Button>
            {message && (
              <span className="text-sm text-green-600">{message}</span>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
