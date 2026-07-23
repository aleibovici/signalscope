import { describe, expect, it } from "vitest";
import { sortButtonAriaLabel } from "@/lib/signal-row-sort-labels";

describe("signal-row-sort-labels", () => {
  it("describes inactive sort buttons", () => {
    expect(sortButtonAriaLabel("aiScore", false, "desc")).toBe("Sort by AI score");
  });

  it("describes active ascending sort", () => {
    expect(sortButtonAriaLabel("symbol", true, "asc")).toBe(
      "Sort by ticker symbol, currently sorted ascending",
    );
  });
});
