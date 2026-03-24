import { Sidebar } from "@/components/dashboard/sidebar";
import { GuestBannerWrapper } from "@/components/dashboard/guest-banner-wrapper";

export const dynamic = "force-dynamic";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const revision = process.env.K_REVISION ?? "local";

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50 dark:bg-[#0a0d12]">
      <Sidebar revision={revision} />
      <main id="main-scroll" className="flex-1 overflow-y-auto pt-14 md:pt-0">
        <div className="p-4 md:p-6">
          <GuestBannerWrapper />
          {children}
        </div>
      </main>
    </div>
  );
}
