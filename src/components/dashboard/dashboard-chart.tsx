"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

interface MonthlyData {
  month: string;
  disbursed: number;
  collected: number;
}

function formatAxisValue(value: number) {
  if (value >= 100000000) return `${(value / 100000000).toFixed(0)}억`;
  if (value >= 10000) return `${(value / 10000).toFixed(0)}만`;
  return value.toString();
}

export function DashboardChart({ data }: { data: MonthlyData[] }) {
  if (data.length === 0) {
    return (
      <div className="flex h-[300px] items-center justify-center text-muted-foreground">
        데이터가 없습니다
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="month" />
        <YAxis tickFormatter={formatAxisValue} />
        <Tooltip
          formatter={(value) =>
            new Intl.NumberFormat("ko-KR", {
              style: "currency",
              currency: "KRW",
              maximumFractionDigits: 0,
            }).format(Number(value))
          }
        />
        <Legend />
        <Bar dataKey="disbursed" name="실행금액" fill="#3b82f6" />
        <Bar dataKey="collected" name="회수금액" fill="#22c55e" />
      </BarChart>
    </ResponsiveContainer>
  );
}
