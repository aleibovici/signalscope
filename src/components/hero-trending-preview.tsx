import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { stageLabel } from "@/lib/stage-labels";

interface PreviewTicker {
  symbol: string;
  stage: string;
  aiScore: number;
  opportunityScore: number | null;
  price: number | null;
}

async function fetchPreview(): Promise<PreviewTicker[]> {
  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const rows = await prisma.validatedTicker.findMany({
      where: {
        createdAt: { gte: thirtyDaysAgo },
        stage: { in: ["EARLY", "FORMING", "CONFIRMED"] },
        pndFlagged: false,
      },
      orderBy: [{ opportunityScore: "desc" }, { aiScore: "desc" }],
      select: {
        symbol: true,
        stage: true,
        aiScore: true,
        opportunityScore: true,
        price: true,
      },
      distinct: ["symbol"],
      take: 3,
    });
    return rows.map((r) => ({
      symbol: r.symbol,
      stage: r.stage,
      aiScore: r.aiScore,
      opportunityScore: r.opportunityScore,
      price: r.price,
    }));
  } catch {
    return [];
  }
}

const STAGE_STYLES: Record<string, string> = {
  EARLY: "border-emerald-500/30 bg-emerald-500/15 text-emerald-300",
  FORMING: "border-sky-500/30 bg-sky-500/15 text-sky-300",
  CONFIRMED: "border-violet-500/30 bg-violet-500/15 text-violet-300",
};

export async function HeroTrendingPreview() {
  const tickers = await fetchPreview();
  if (tickers.length === 0) return null;

  return (
    <div className="mx-auto w-full max-w-sm lg:mx-0 lg:shrink-0">
      <div className="rounded-2xl border border-white/15 bg-zinc-900/55 p-5 shadow-[0_0_48px_-12px_rgba(56,189,248,0.2)] backdrop-blur-xl ring-1 ring-white/10 sm:p-6">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-300">
              Live breakouts
            </span>
          </div>
          <Link
            href="/trending"
            className="text-xs font-medium text-sky-400 hover:text-sky-300"
          >
            View all →
          </Link>
        </div>

        <ul className="divide-y divide-white/5">
          {tickers.map((t) => (
            <li key={t.symbol}>
              <Link
                href={`/ticker/${t.symbol}`}
                className="flex items-center justify-between gap-3 py-2.5 transition-colors hover:bg-white/5"
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  <span className="font-mono text-sm font-bold text-white">
                    ${t.symbol}
                  </span>
                  <span
                    className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${
                      STAGE_STYLES[t.stage] ??
                      "border-zinc-500/30 bg-zinc-500/15 text-zinc-300"
                    }`}
                  >
                    {stageLabel(t.stage)}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-xs tabular-nums text-zinc-400">
                  {t.price != null && (
                    <span className="text-zinc-300">
                      ${t.price.toFixed(2)}
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1">
                    <span className="text-[10px] uppercase tracking-wider text-zinc-500">
                      AI
                    </span>
                    <span className="font-semibold text-white">
                      {t.aiScore.toFixed(0)}
                    </span>
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>

        <Link
          href="/dashboard"
          className="mt-4 block w-full rounded-xl bg-linear-to-br from-sky-500 to-blue-600 px-4 py-2.5 text-center text-sm font-semibold text-white shadow-md hover:from-sky-400 hover:to-blue-500 transition-colors"
        >
          See full dashboard (free)
        </Link>
        <p className="mt-2 text-center text-[11px] text-zinc-500">
          Updated every scan · no account required
        </p>
      </div>
    </div>
  );
}
