/** Simple accumulator for AI costs within a scan. Not thread-safe — one scan at a time. */
let totalCost = 0;

export function resetCostTracker(): void {
  totalCost = 0;
}

export function addCost(cost: number): void {
  totalCost += cost;
}

export function getTotalCost(): number {
  return totalCost;
}
