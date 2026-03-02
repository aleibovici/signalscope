"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect } from "react";

export function GoogleAnalyticsPageView() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    const url = pathname + (searchParams.toString() ? `?${searchParams.toString()}` : "");
    window.gtag?.("event", "page_view", {
      page_location: window.location.origin + url,
      page_path: url,
    });
  }, [pathname, searchParams]);

  return null;
}
