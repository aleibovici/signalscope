import { Card, CardContent } from "@/components/ui/card";
import { InfoTip } from "@/components/ui/tooltip";

export function KpiTile({
  label,
  value,
  sub,
  subHint,
  tip,
  valueColor,
}: {
  label: string;
  value: string;
  sub: string;
  subHint?: string;
  tip?: string;
  valueColor?: "green" | "red";
}) {
  const colorClass =
    valueColor === "green"
      ? "text-green-600 dark:text-green-400"
      : valueColor === "red"
        ? "text-red-600 dark:text-red-400"
        : "text-primary";

  return (
    <Card
      className="min-w-0 h-full border-border-default/90 shadow-card transition-[box-shadow,border-color] duration-base hover:border-blue-200/70 hover:shadow-card-hover dark:hover:border-border-strong"
      title={subHint}
    >
      <CardContent className="flex h-full min-h-25 flex-col items-center justify-between gap-1 px-2! py-3.5 text-center sm:px-3! lg:px-2! lg:py-3">
        <p className="type-overline text-muted flex items-center justify-center gap-0">
          <span>{label}</span>
          {tip && <InfoTip text={tip} />}
        </p>
        <p className={`num min-h-8 text-xl font-bold tracking-tight sm:min-h-9 sm:text-2xl ${colorClass}`}>
          {value}
        </p>
        <p
          className="line-clamp-2 min-h-8 w-full text-[10px] leading-snug text-muted sm:text-[11px]"
          title={subHint ? undefined : sub.length > 24 ? sub : undefined}
        >
          {sub}
        </p>
      </CardContent>
    </Card>
  );
}
