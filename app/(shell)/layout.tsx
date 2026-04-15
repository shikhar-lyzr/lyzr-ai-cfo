import { Sidebar } from "@/components/shell/sidebar";

export default function ShellLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto px-8 pt-8 pb-4">
        {children}
      </main>
    </div>
  );
}
