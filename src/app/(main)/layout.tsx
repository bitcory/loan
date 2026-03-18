import { Sidebar } from "@/components/shared/sidebar";

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <div className="px-6 py-6 space-y-6">{children}</div>
      </main>
    </div>
  );
}
