import { Sidebar } from "@/components/layout/sidebar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen overflow-hidden bg-bg-primary">
      <Sidebar />
      <main className="flex-1 overflow-hidden">{children}</main>
    </div>
  );
}
