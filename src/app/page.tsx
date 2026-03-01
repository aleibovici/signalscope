import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

export const metadata: Metadata = {
  alternates: {
    canonical: "http://localhost:3000",
  },
};

export default async function Home() {
  const session = await auth();
  redirect(session ? "/dashboard" : "/login");
}
