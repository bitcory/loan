"use client";

import { useRouter } from "next/navigation";

export function ClickableRow({
  href,
  children,
  className,
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
}) {
  const router = useRouter();
  return (
    <tr
      className={className}
      onClick={() => router.push(href)}
    >
      {children}
    </tr>
  );
}
