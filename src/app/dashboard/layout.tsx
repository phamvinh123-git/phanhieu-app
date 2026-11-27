import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { MeProvider } from "@/components/MeProvider";
import { AppShell } from "@/components/layout/AppShell";

export default async function DashboardLayout({ children }: LayoutProps<"/dashboard">) {
  const session = await getSession();
  if (!session) redirect("/login");

  return (
    <MeProvider>
      <AppShell>{children}</AppShell>
    </MeProvider>
  );
}
