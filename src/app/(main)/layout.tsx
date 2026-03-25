import { Sidebar } from "@/components/shared/sidebar";
import { NextAuthSessionProvider } from "@/components/shared/session-provider";

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <NextAuthSessionProvider>
      <div className="flex h-screen">
        <Sidebar />
        <main className="flex-1 overflow-auto pt-14 md:pt-0">
          <div className="px-4 py-4 space-y-4 md:px-6 md:py-6 md:space-y-6">{children}</div>
        </main>
      </div>
    </NextAuthSessionProvider>
  );
}
