"use client";

import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from "recharts";

type LtvData = { label: string; count: number };

const COLORS = ["hsl(217, 91%, 60%)", "hsl(142, 76%, 45%)", "hsl(38, 92%, 50%)", "hsl(0, 84%, 60%)"];

export function DashboardLtvChart({ data }: { data: LtvData[] }) {
  const total = data.reduce((s, d) => s + d.count, 0);

  if (total === 0) {
    return (
      <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
        담보 데이터 없음
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={200}>
      <PieChart>
        <Pie
          data={data}
          dataKey="count"
          nameKey="label"
          cx="50%"
          cy="50%"
          outerRadius={70}
          label={(props) => {
            const percent = props.percent as number | undefined;
            const name = props.name as string | undefined;
            if (!percent || percent < 0.05) return "";
            return `${name ?? ""} ${(percent * 100).toFixed(0)}%`;
          }}
          labelLine={false}
          fontSize={11}
        >
          {data.map((_, i) => (
            <Cell key={i} fill={COLORS[i % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip formatter={(v) => [`${v}건`, "건수"]} />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  );
}
