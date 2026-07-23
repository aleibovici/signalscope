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
      className="h-full min-w-0 border-border-default/90 shadow-card transition-[box-shadow,border-color] duration-base hover:border-blue-200/70 hover:shadow-card-hover max-md:rounded-none max-md:border-0 max-md:shadow-none dark:hover:border-border-strong"
      title={subHint}
    >
      <CardContent className="flex h-full min-h-0 flex-row items-center justify-between gap-2 px-2.5! py-2! text-left sm:px-3! md:min-h-25 md:flex-col md:items-center md:justify-between md:gap-1 md:px-2! md:py-3.5 md:text-center lg:px-2! lg:py-3">
        <div className="min-w-0 flex-1 md:contents">
          <p className="order-1 flex items-center gap-0 text-[10px] font-medium leading-tight text-muted md:justify-center md:type-overline">
            <span className="line-clamp-2 md:line-clamp-none">{label}</span>
            {tip && <InfoTip text={tip} />}
          </p>
          <p
            className="order-3 mt-0.5 line-clamp-1 text-[10px] leading-snug text-muted md:mt-0 md:line-clamp-2 md:min-h-8 md:w-full sm:text-[11px]"
            title={subHint ? undefined : sub.length > 24 ? sub : undefined}
          >
            {sub}
          </p>
        </div>
        <p
          className={`order-2 num shrink-0 text-sm font-semibold leading-tight tabular-nums md:min-h-8 md:text-xl md:font-bold md:tracking-tight sm:min-h-9 sm:text-2xl ${colorClass}`}
        >
          {value}
        </p>
      </CardContent>
    </Card>
  );
}
