import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { MeProvider } from "@/components/MeProvider";
import { Sidebar } from "@/components/Sidebar";

export default async function DashboardLayout({ children }: LayoutProps<"/dashboard">) {
  const session = await getSession();
  if (!session) redirect("/login");

  return (
    <MeProvider>
      <div className="flex min-h-screen flex-col md:flex-row">
        <Sidebar />
        <main className="app-shell-bg min-w-0 flex-1 overflow-y-auto">
          <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">{children}</div>
        </main>
      </div>
    </MeProvider>
  );
}
