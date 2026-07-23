"use client";

import { useSession } from "next-auth/react";
import { SignUpBanner } from "@/components/dashboard/sign-up-banner";

export function GuestBannerWrapper() {
  const { data: session, status } = useSession();

  if (status === "loading" || session?.user) return null;

  return <SignUpBanner />;
}
