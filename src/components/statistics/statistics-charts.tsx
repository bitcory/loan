"use client";

import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

interface ChartData {
  name: string;
  value: number;
  amount: number;
}

const STATUS_COLORS = ["#3b82f6", "#22c55e", "#ef4444", "#eab308"];
const TYPE_COLORS = ["#6366f1", "#ec4899", "#14b8a6", "#f97316"];

export function StatisticsCharts({
  data,
  type,
}: {
  data: ChartData[];
  type: "status" | "type";
}) {
  const colors = type === "status" ? STATUS_COLORS : TYPE_COLORS;

  if (data.length === 0) {
    return (
      <div className="flex h-[250px] items-center justify-center text-muted-foreground">
        데이터가 없습니다
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={250}>
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          cx="50%"
          cy="50%"
          outerRadius={80}
          label={({ name, value }) => `${name} (${value})`}
        >
          {data.map((_, index) => (
            <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
          ))}
        </Pie>
        <Tooltip
          formatter={(value) => [`${value}건`]}
        />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  );
}
