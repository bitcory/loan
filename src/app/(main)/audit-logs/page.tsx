import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

interface PageProps {
  searchParams: {
    entityType?: string;
    dateFrom?: string;
    dateTo?: string;
    page?: string;
  };
}

const ENTITY_TYPES = [
  { value: "", label: "전체" },
  { value: "Customer", label: "고객" },
  { value: "Loan", label: "대출" },
  { value: "Collateral", label: "담보물건" },
  { value: "Mortgage", label: "근저당" },
  { value: "Payment", label: "수납" },
  { value: "Setting", label: "설정" },
];

const ACTION_COLORS: Record<string, string> = {
  CREATE: "bg-green-100 text-green-800",
  UPDATE: "bg-blue-100 text-blue-800",
  DELETE: "bg-red-100 text-red-800",
};

export default async function AuditLogsPage({ searchParams }: PageProps) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/dashboard");

  const page = Number(searchParams.page) || 1;
  const pageSize = 50;
  const { entityType, dateFrom, dateTo } = searchParams;

  // basePrisma 직접 사용 — organizationId 필터 필수
  const where: Record<string, unknown> = {
    organizationId: session.user.organizationId,
  };
  if (entityType) where.entityType = entityType;
  if (dateFrom || dateTo) {
    where.createdAt = {
      ...(dateFrom && { gte: new Date(dateFrom) }),
      ...(dateTo && { lte: new Date(dateTo + "T23:59:59.999Z") }),
    };
  }

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.auditLog.count({ where }),
  ]);

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="container mx-auto py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">감사 로그</h1>
        <p className="text-sm text-muted-foreground mt-1">
          모든 데이터 변경 이력을 조회합니다. 로그는 수정하거나 삭제할 수 없습니다.
        </p>
      </div>

      {/* 필터 폼 */}
      <form method="get" className="flex gap-3 mb-6 flex-wrap">
        <select
          name="entityType"
          defaultValue={entityType ?? ""}
          className="border rounded-md px-3 py-2 text-sm"
        >
          {ENTITY_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>

        <input
          type="date"
          name="dateFrom"
          defaultValue={dateFrom ?? ""}
          className="border rounded-md px-3 py-2 text-sm"
        />
        <input
          type="date"
          name="dateTo"
          defaultValue={dateTo ?? ""}
          className="border rounded-md px-3 py-2 text-sm"
        />

        <button
          type="submit"
          className="bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm"
        >
          조회
        </button>
        <a
          href="/audit-logs"
          className="border px-4 py-2 rounded-md text-sm flex items-center"
        >
          초기화
        </a>
      </form>

      <p className="text-sm text-muted-foreground mb-3">
        총 {total.toLocaleString()}건 (페이지 {page}/{totalPages || 1})
      </p>

      {/* 감사 로그 테이블 */}
      <div className="border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted">
            <tr>
              <th className="text-left px-4 py-3 font-medium">일시</th>
              <th className="text-left px-4 py-3 font-medium">구분</th>
              <th className="text-left px-4 py-3 font-medium">액션</th>
              <th className="text-left px-4 py-3 font-medium">엔티티 ID</th>
              <th className="text-left px-4 py-3 font-medium">사용자 ID</th>
              <th className="text-left px-4 py-3 font-medium">IP 주소</th>
            </tr>
          </thead>
          <tbody>
            {logs.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-12 text-muted-foreground">
                  조회된 감사 로그가 없습니다.
                </td>
              </tr>
            ) : (
              logs.map((log) => (
                <tr key={log.id} className="border-t hover:bg-muted/50">
                  <td className="px-4 py-3 whitespace-nowrap">
                    {log.createdAt.toLocaleString("ko-KR", {
                      year: "numeric",
                      month: "2-digit",
                      day: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit",
                    })}
                  </td>
                  <td className="px-4 py-3">{log.entityType}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                        ACTION_COLORS[log.action] ?? "bg-gray-100 text-gray-800"
                      }`}
                    >
                      {log.action}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs max-w-[200px] truncate">
                    {log.entityId}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs max-w-[200px] truncate">
                    {log.userId}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {log.ipAddress ?? "-"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* 페이지네이션 */}
      {totalPages > 1 && (
        <div className="flex gap-2 mt-4 justify-center">
          {page > 1 && (
            <a
              href={`/audit-logs?${new URLSearchParams({ ...(entityType ? { entityType } : {}), ...(dateFrom ? { dateFrom } : {}), ...(dateTo ? { dateTo } : {}), page: String(page - 1) })}`}
              className="border px-3 py-1 rounded text-sm"
            >
              이전
            </a>
          )}
          <span className="px-3 py-1 text-sm">
            {page} / {totalPages}
          </span>
          {page < totalPages && (
            <a
              href={`/audit-logs?${new URLSearchParams({ ...(entityType ? { entityType } : {}), ...(dateFrom ? { dateFrom } : {}), ...(dateTo ? { dateTo } : {}), page: String(page + 1) })}`}
              className="border px-3 py-1 rounded text-sm"
            >
              다음
            </a>
          )}
        </div>
      )}
    </div>
  );
}
