import { describe, expect, it } from "vitest";
import {
  trendingFiltersForRowSort,
  trendingRowSortKey,
  isTrendingApiSortKey,
} from "@/lib/trending-row-sort";

describe("trending-row-sort", () => {
  it("maps API sortBy to row sort key", () => {
    expect(trendingRowSortKey({ sortBy: "aiScore" })).toBe("aiScore");
    expect(trendingRowSortKey({ sortBy: "return" })).toBe("return");
    expect(trendingRowSortKey({ sortBy: "appearances" })).toBeNull();
  });

  it("maps row sort key to API filter patch", () => {
    expect(trendingFiltersForRowSort("price")).toEqual({ sortBy: "price" });
    expect(trendingFiltersForRowSort("symbol")).toBeNull();
  });

  it("identifies API-backed sort columns", () => {
    expect(isTrendingApiSortKey("aiScore")).toBe(true);
    expect(isTrendingApiSortKey("symbol")).toBe(false);
  });
});
