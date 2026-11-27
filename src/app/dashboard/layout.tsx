import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { MeProvider } from "@/components/MeProvider";
import { AppHeader, AppFooter, Watermark } from "@/components/AppHeader";

export default async function DashboardLayout({ children }: LayoutProps<"/dashboard">) {
  const session = await getSession();
  if (!session) redirect("/login");

  return (
    <MeProvider>
      <div className="flex min-h-screen flex-col bg-neutral-50">
        <Watermark />
        <AppHeader />
        <main className="gb-main relative z-[1] mx-auto w-full max-w-6xl min-w-0 flex-1 px-4 py-6">{children}</main>
        <AppFooter />
      </div>
    </MeProvider>
  );
}
