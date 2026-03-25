import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

export default async function UserDetailPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/settings");

  const user = await prisma.user.findFirst({
    where: { id: params.id, organizationId: session.user.organizationId },
    select: { id: true, name: true, username: true, role: true, isActive: true },
  });

  if (!user) redirect("/settings/users");

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">사용자 상세</h1>
      <dl className="space-y-2">
        <div><dt className="font-medium">이름</dt><dd>{user.name}</dd></div>
        <div><dt className="font-medium">아이디</dt><dd>{user.username}</dd></div>
        <div><dt className="font-medium">역할</dt><dd>{user.role === "ADMIN" ? "관리자" : "직원"}</dd></div>
        <div><dt className="font-medium">상태</dt><dd>{user.isActive ? "활성" : "비활성"}</dd></div>
      </dl>
    </div>
  );
}
