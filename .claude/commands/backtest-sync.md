# Backtest Research Sync

Weekly workflow: read the latest ML backtest research outputs and update P&D filtering, AI scoring prompts, methodology descriptions, and badge classifications to match.

## Research Inputs

Read both files from the autoresearch harness:

1. **`/Users/andre/Downloads/autoresearch-macos/findings.json`** — Current best model state: performance metrics, feature importance rankings, P&D flag analysis (per-flag avg returns, direction, effectiveness), thresholds, actionable recommendations, and model architecture details.

2. **`/Users/andre/Downloads/autoresearch-macos/results.tsv`** — Full experiment log: every model run with commit, mean IC, per-horizon ICs, feature counts, top features, source rankings, key thresholds, P&D findings, and keep/discard status. The last `keep` row is the current production model.

## Files to Update

Compare research numbers against these files and update where values have drifted:

### 1. `src/lib/harvester/pnd-filter.ts`
- **INFORMATIONAL_FLAGS comments**: Update avg 7d return numbers for each informational flag (penny_price, otc_listing, twitter_coordinated_pump, coordinated_posts, single_source).
- **Flag logic**: If any flag's direction has flipped (e.g., a previously bearish flag is now bullish), move it to/from INFORMATIONAL_FLAGS. If a new flag type appears in findings, consider adding it.
- **PND_THRESHOLD**: Validate against `pnd_flag_count` thresholds in findings.json — the threshold should be the count where avg returns turn meaningfully negative.

### 2. `src/lib/harvester/scoring.ts`
- **Feature importance rankings**: Update the "#N most predictive ML feature" references in the scoring system prompt to match the current `feature_importance` array in findings.json. Include importance values.
- **Return numbers**: Update any avg return numbers cited (e.g., sourceCount thresholds, micro_cap_no_catalyst penalty).
- **New features**: If findings.json shows a new top-5 feature not mentioned in the prompt, add guidance for it.
- **Removed features**: If a previously top feature has dropped out of the top-10, downgrade its description (remove "#N" ranking, keep the guidance).

### 3. `src/lib/methodology-data.ts`
- **pndFlags array**: Update the `desc` strings with current avg 7d return numbers from `pnd_flag_analysis.per_flag` in findings.json.
- **methodologyDescription**: If the model type has changed (e.g., XGBoost to RidgeCV), update the description.
- **backtestDescription**: Update model architecture details (feature count, model type, ensemble method) from `model_architecture` in findings.json.
- **backtestPipeline**: Update pipeline step names if the architecture has changed.

### 4. `src/components/dashboard/signal-card.tsx` (badge colors)
- If a flag has changed direction (bearish to bullish or vice versa), update the badge color classification in the ticker detail page `src/app/(dashboard)/ticker/[symbol]/page.tsx`:
  - Red (rose): strong bearish flags (micro_cap_no_catalyst, sudden_spike)
  - Amber: moderate bearish flags (no_news_catalyst, only_penny_subs)
  - Green (emerald): informational/bullish flags (penny_price, otc_listing, twitter_coordinated_pump)
  - Gray: neutral flags (coordinated_posts, single_source)

## Process

1. Read both research files
2. Read the 4 target files
3. Diff research numbers vs code — list every discrepancy found
4. Show the user a summary table of changes before editing
5. Apply edits
6. Run `npm test -- src/__tests__/pnd-filter.test.ts src/__tests__/scoring.test.ts` to verify
7. Run `npm run lint` to verify
8. Summarize what changed and what stayed the same
