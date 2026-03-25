import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getUsers } from "@/actions/user-actions";
import UsersClient from "./users-client";

export default async function UsersPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/settings");

  const users = await getUsers(session.user.organizationId);

  return <UsersClient users={users} currentUserId={session.user.userId} />;
}
