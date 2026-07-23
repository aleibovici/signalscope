import { Sidebar } from "@/components/dashboard/sidebar";
import { MobileTabBar } from "@/components/dashboard/mobile-tab-bar";
import { GuestBannerWrapper } from "@/components/dashboard/guest-banner-wrapper";
import { Tour } from "@/components/dashboard/tour";
import { getAppRevision } from "@/lib/revision";

export const dynamic = "force-dynamic";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const revision = getAppRevision();

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50 dark:bg-zinc-950">
      <Sidebar revision={revision} />
      <main id="main-scroll" className="min-w-0 flex-1 overflow-x-hidden overflow-y-auto pt-14 pb-16 md:pt-0 md:pb-0">
        <div className="min-w-0 p-4 md:p-6">
          <GuestBannerWrapper />
          {children}
        </div>
      </main>
      <MobileTabBar />
      <Tour />
    </div>
  );
}
