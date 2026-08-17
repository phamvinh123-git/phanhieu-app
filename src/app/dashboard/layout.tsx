import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { MeProvider } from "@/components/MeProvider";
import { Sidebar } from "@/components/Sidebar";

export default async function DashboardLayout({ children }: LayoutProps<"/dashboard">) {
  const session = await getSession();
  if (!session) redirect("/login");

  return (
    <MeProvider>
      <div className="flex min-h-screen">
        <Sidebar />
        <main className="flex-1 overflow-y-auto bg-slate-50">
          <div className="mx-auto max-w-6xl px-6 py-6">{children}</div>
        </main>
      </div>
    </MeProvider>
  );
}
