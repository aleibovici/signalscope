-- Macro options-flow regime filter (research-driven, see src/lib/harvester/regime-filter.ts).
-- Populated every scan for observability. `regimeSkipped` only set true when REGIME_SKIP_ENABLED env flag is on.
ALTER TABLE "Scan"
  ADD COLUMN "scanOfHighConv"  INTEGER,
  ADD COLUMN "scanOfConvDelta" DOUBLE PRECISION,
  ADD COLUMN "regimeSkipped"   BOOLEAN NOT NULL DEFAULT false;
