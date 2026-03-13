import { NextResponse } from "next/server";
import { sendPortfolioAlerts } from "@/lib/email";

export async function POST() {
  const { usersNotified, tickersMatched } = await sendPortfolioAlerts();

  return NextResponse.json({
    status: usersNotified > 0 ? "sent" : "skip",
    usersNotified,
    tickersMatched,
  });
}
