"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { createUser, setUserActive, resetUserPassword } from "@/actions/user-actions";
import { useRouter } from "next/navigation";

type User = {
  id: string;
  name: string;
  username: string;
  role: string;
  isActive: boolean;
  createdAt: Date;
};

export default function UsersClient({
  users,
  currentUserId,
}: {
  users: User[];
  currentUserId: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState({
    name: "",
    username: "",
    password: "",
    role: "STAFF" as "ADMIN" | "STAFF",
  });
  const [createError, setCreateError] = useState("");

  const [resetOpen, setResetOpen] = useState(false);
  const [resetTargetId, setResetTargetId] = useState("");
  const [resetPassword, setResetPassword] = useState("");
  const [resetError, setResetError] = useState("");

  async function handleCreateUser(e: React.FormEvent) {
    e.preventDefault();
    setCreateError("");
    const result = await createUser(createForm);
    if (result?.serverError) {
      setCreateError(result.serverError);
      return;
    }
    setCreateOpen(false);
    setCreateForm({ name: "", username: "", password: "", role: "STAFF" });
    startTransition(() => router.refresh());
  }

  async function handleToggleActive(id: string, currentActive: boolean) {
    if (id === currentUserId) {
      alert("자신의 계정은 비활성화할 수 없습니다.");
      return;
    }
    const result = await setUserActive({ id, isActive: !currentActive });
    if (result?.serverError) {
      alert(result.serverError);
      return;
    }
    startTransition(() => router.refresh());
  }

  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault();
    setResetError("");
    const result = await resetUserPassword({ id: resetTargetId, newPassword: resetPassword });
    if (result?.serverError) {
      setResetError(result.serverError);
      return;
    }
    setResetOpen(false);
    setResetPassword("");
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">사용자 관리</h1>

        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button>새 사용자 추가</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>새 사용자 추가</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreateUser} className="space-y-4">
              <div className="space-y-1">
                <Label htmlFor="new-name">이름</Label>
                <Input
                  id="new-name"
                  value={createForm.name}
                  onChange={(e) => setCreateForm((f) => ({ ...f, name: e.target.value }))}
                  required
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="new-username">아이디</Label>
                <Input
                  id="new-username"
                  value={createForm.username}
                  onChange={(e) => setCreateForm((f) => ({ ...f, username: e.target.value }))}
                  required
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="new-password">임시 비밀번호</Label>
                <Input
                  id="new-password"
                  type="password"
                  value={createForm.password}
                  onChange={(e) => setCreateForm((f) => ({ ...f, password: e.target.value }))}
                  required
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="new-role">역할</Label>
                <select
                  id="new-role"
                  className="w-full rounded-md border border-input px-3 py-2 text-sm"
                  value={createForm.role}
                  onChange={(e) =>
                    setCreateForm((f) => ({ ...f, role: e.target.value as "ADMIN" | "STAFF" }))
                  }
                >
                  <option value="STAFF">직원</option>
                  <option value="ADMIN">관리자</option>
                </select>
              </div>
              {createError && <p className="text-sm text-red-600">{createError}</p>}
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
                  취소
                </Button>
                <Button type="submit" disabled={isPending}>
                  추가
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="rounded-md border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-gray-50">
              <th className="px-4 py-3 text-left">이름</th>
              <th className="px-4 py-3 text-left">아이디</th>
              <th className="px-4 py-3 text-left">역할</th>
              <th className="px-4 py-3 text-left">상태</th>
              <th className="px-4 py-3 text-left">생성일</th>
              <th className="px-4 py-3 text-left">관리</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} className="border-b hover:bg-gray-50">
                <td className="px-4 py-3">{user.name}</td>
                <td className="px-4 py-3">{user.username}</td>
                <td className="px-4 py-3">{user.role === "ADMIN" ? "관리자" : "직원"}</td>
                <td className="px-4 py-3">{user.isActive ? "활성" : "비활성"}</td>
                <td className="px-4 py-3">
                  {new Date(user.createdAt).toLocaleDateString("ko-KR")}
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant={user.isActive ? "destructive" : "outline"}
                      onClick={() => handleToggleActive(user.id, user.isActive)}
                      disabled={user.id === currentUserId}
                    >
                      {user.isActive ? "비활성화" : "활성화"}
                    </Button>

                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setResetTargetId(user.id);
                        setResetOpen(true);
                      }}
                    >
                      비밀번호 리셋
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={resetOpen} onOpenChange={setResetOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>비밀번호 리셋</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleResetPassword} className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="reset-password">새 비밀번호</Label>
              <Input
                id="reset-password"
                type="password"
                value={resetPassword}
                onChange={(e) => setResetPassword(e.target.value)}
                placeholder="8자 이상, 영문+숫자 조합"
                required
              />
            </div>
            {resetError && <p className="text-sm text-red-600">{resetError}</p>}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setResetOpen(false)}>
                취소
              </Button>
              <Button type="submit" disabled={isPending}>
                리셋
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
