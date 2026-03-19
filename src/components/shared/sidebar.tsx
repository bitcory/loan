"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Users,
  Building2,
  Banknote,
  AlertTriangle,
  BarChart3,
  Settings,
  Columns3,
  Menu,
  X,
} from "lucide-react";

const navItems = [
  { href: "/dashboard", label: "대시보드", icon: LayoutDashboard },
  { href: "/integrated", label: "통합관리", icon: Columns3 },
  { href: "/customers", label: "고객관리", icon: Users },
  { href: "/collaterals", label: "담보관리", icon: Building2 },
  { href: "/loans", label: "대출관리", icon: Banknote },
  { href: "/overdue", label: "연체관리", icon: AlertTriangle },
  { href: "/statistics", label: "통계", icon: BarChart3 },
  { href: "/settings", label: "설정", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // 경로 변경 시 모바일 메뉴 닫기
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // 모바일 메뉴 열려있을 때 스크롤 방지
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      {/* 모바일 헤더 바 */}
      <div className="fixed top-0 left-0 right-0 z-40 flex h-14 items-center border-b bg-card px-4 md:hidden">
        <button
          onClick={() => setOpen(true)}
          className="rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
          aria-label="메뉴 열기"
        >
          <Menu className="h-5 w-5" />
        </button>
        <Link href="/dashboard" className="ml-2 flex items-center gap-2">
          <Banknote className="h-5 w-5 text-primary" />
          <span className="text-base font-bold">대출전산</span>
        </Link>
      </div>

      {/* 모바일 오버레이 */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* 사이드바 */}
      <aside
        className={cn(
          // 데스크탑
          "hidden md:flex h-screen w-64 flex-col border-r bg-card",
          // 모바일 (open일 때만 보임)
          open && "fixed inset-y-0 left-0 z-50 flex w-64 md:relative"
        )}
      >
        <div className="flex h-16 items-center justify-between border-b px-6">
          <Link href="/dashboard" className="flex items-center gap-2">
            <Banknote className="h-6 w-6 text-primary" />
            <span className="text-lg font-bold">대출전산</span>
          </Link>
          <button
            onClick={() => setOpen(false)}
            className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-accent-foreground md:hidden"
            aria-label="메뉴 닫기"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <nav className="flex-1 space-y-1 p-4">
          {navItems.map((item) => {
            const isActive =
              pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>
    </>
  );
}
