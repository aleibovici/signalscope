import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

const { fetchSecInsiderSignals } = await import(
  "@/lib/harvester/sources/sec-insider"
);

// Minimal OpenInsider HTML with the real 17-column tinytable structure
function makeOpenInsiderHtml(rows: string[]): string {
  return `<html><body><table class="tinytable">
    <tr><th>X</th><th>Filing</th><th>Trade</th><th>Ticker</th><th>Company</th>
    <th>Name</th><th>Title</th><th>Type</th><th>Price</th><th>Qty</th>
    <th>Owned</th><th>ΔOwn</th><th>Value</th><th>1d</th><th>1w</th><th>1m</th><th>6m</th></tr>
    ${rows.join("\n")}
  </table></body></html>`;
}

function makeRow(opts: {
  ticker: string;
  name: string;
  title: string;
  tradeType: string;
  price: string;
  qty: string;
  value: string;
}): string {
  return `<tr>
    <td></td>
    <td>2026-03-15</td>
    <td>2026-03-14</td>
    <td><b><a href="/${opts.ticker}">${opts.ticker}</a></b></td>
    <td>Company Inc</td>
    <td>${opts.name}</td>
    <td>${opts.title}</td>
    <td>${opts.tradeType}</td>
    <td>${opts.price}</td>
    <td>${opts.qty}</td>
    <td>100,000</td>
    <td>5%</td>
    <td>${opts.value}</td>
    <td></td><td></td><td></td><td></td>
  </tr>`;
}

describe("fetchSecInsiderSignals", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uses HTTP (not HTTPS) for OpenInsider", async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 500 });

    await fetchSecInsiderSignals();

    // First call is OpenInsider, second is EDGAR RSS
    const openInsiderUrl = mockFetch.mock.calls[0][0];
    expect(openInsiderUrl).toMatch(/^http:\/\/openinsider\.com/);
    expect(openInsiderUrl).not.toMatch(/^https:\/\/openinsider\.com/);
  });

  it("parses C-suite purchase signals from OpenInsider HTML", async () => {
    const html = makeOpenInsiderHtml([
      makeRow({
        ticker: "AAPL",
        name: "Tim Cook",
        title: "CEO",
        tradeType: "P - Purchase",
        price: "$150.00",
        qty: "10,000",
        value: "$1,500,000",
      }),
    ]);

    // OpenInsider returns valid HTML
    mockFetch.mockImplementation(async (url: string) => {
      if (url.includes("openinsider.com")) {
        return { ok: true, text: async () => html };
      }
      // EDGAR RSS — empty
      return { ok: true, text: async () => "<feed></feed>" };
    });

    const signals = await fetchSecInsiderSignals();

    expect(signals.length).toBeGreaterThanOrEqual(1);
    const insider = signals.find((s) => s.source === "SEC_INSIDER");
    expect(insider).toBeDefined();
    expect(insider!.symbol).toBe("AAPL");
    expect(insider!.purchaseValue).toBe(1_500_000);
    expect(insider!.insiderTitle).toBe("CEO");
  });

  it("filters out sales (non-purchase trades)", async () => {
    const html = makeOpenInsiderHtml([
      makeRow({
        ticker: "MSFT",
        name: "Satya Nadella",
        title: "CEO",
        tradeType: "S - Sale",
        price: "$400.00",
        qty: "-5,000",
        value: "$2,000,000",
      }),
    ]);

    mockFetch.mockImplementation(async (url: string) => {
      if (url.includes("openinsider.com"))
        return { ok: true, text: async () => html };
      return { ok: true, text: async () => "<feed></feed>" };
    });

    const signals = await fetchSecInsiderSignals();
    const insider = signals.find((s) => s.source === "SEC_INSIDER");

    expect(insider).toBeUndefined();
  });

  it("filters out non-C-suite purchases", async () => {
    const html = makeOpenInsiderHtml([
      makeRow({
        ticker: "XYZ",
        name: "John Doe",
        title: "Software Engineer",
        tradeType: "P - Purchase",
        price: "$50.00",
        qty: "2,000",
        value: "$100,000",
      }),
    ]);

    mockFetch.mockImplementation(async (url: string) => {
      if (url.includes("openinsider.com"))
        return { ok: true, text: async () => html };
      return { ok: true, text: async () => "<feed></feed>" };
    });

    const signals = await fetchSecInsiderSignals();
    const insider = signals.find((s) => s.source === "SEC_INSIDER");

    expect(insider).toBeUndefined();
  });

  it("filters out purchases below $50K", async () => {
    const html = makeOpenInsiderHtml([
      makeRow({
        ticker: "TINY",
        name: "Jane CEO",
        title: "CEO",
        tradeType: "P - Purchase",
        price: "$10.00",
        qty: "100",
        value: "$1,000",
      }),
    ]);

    mockFetch.mockImplementation(async (url: string) => {
      if (url.includes("openinsider.com"))
        return { ok: true, text: async () => html };
      return { ok: true, text: async () => "<feed></feed>" };
    });

    const signals = await fetchSecInsiderSignals();
    const insider = signals.find((s) => s.source === "SEC_INSIDER");

    expect(insider).toBeUndefined();
  });

  it("returns empty array when OpenInsider connection fails (regression: HTTPS broke it)", async () => {
    mockFetch.mockImplementation(async (url: string) => {
      if (url.includes("openinsider.com"))
        throw new Error("Connection refused");
      return { ok: true, text: async () => "<feed></feed>" };
    });

    const signals = await fetchSecInsiderSignals();
    const insider = signals.filter((s) => s.source === "SEC_INSIDER");

    expect(insider).toHaveLength(0);
  });

  it("handles OpenInsider returning non-200 gracefully", async () => {
    mockFetch.mockImplementation(async (url: string) => {
      if (url.includes("openinsider.com"))
        return { ok: false, status: 403 };
      return { ok: true, text: async () => "<feed></feed>" };
    });

    const signals = await fetchSecInsiderSignals();
    const insider = signals.filter((s) => s.source === "SEC_INSIDER");

    expect(insider).toHaveLength(0);
  });

  it("handles multiple C-suite purchases", async () => {
    const html = makeOpenInsiderHtml([
      makeRow({
        ticker: "FOO",
        name: "Alice",
        title: "CFO",
        tradeType: "P - Purchase",
        price: "$20.00",
        qty: "5,000",
        value: "$100,000",
      }),
      makeRow({
        ticker: "BAR",
        name: "Bob",
        title: "Director",
        tradeType: "P - Purchase",
        price: "$50.00",
        qty: "2,000",
        value: "$100,000",
      }),
    ]);

    mockFetch.mockImplementation(async (url: string) => {
      if (url.includes("openinsider.com"))
        return { ok: true, text: async () => html };
      return { ok: true, text: async () => "<feed></feed>" };
    });

    const signals = await fetchSecInsiderSignals();
    const insiders = signals.filter((s) => s.source === "SEC_INSIDER");

    expect(insiders).toHaveLength(2);
    expect(insiders.map((s) => s.symbol).sort()).toEqual(["BAR", "FOO"]);
  });

  it("extracts ticker from HTML with tooltip junk", async () => {
    const row = `<tr>
      <td></td><td>2026-03-15</td><td>2026-03-14</td>
      <td><b> <a href="/IFF" onmouseover="Tip('<img src=\\'chart.png\\'', DELAY, 1)" onmouseout="UnTip()">IFF</a></b></td>
      <td>IFF Inc</td><td>John Smith</td><td>CEO</td>
      <td>P - Purchase</td><td>$80.00</td><td>1,000</td>
      <td>50,000</td><td>2%</td><td>$80,000</td>
      <td></td><td></td><td></td><td></td>
    </tr>`;
    const html = makeOpenInsiderHtml([row]);

    mockFetch.mockImplementation(async (url: string) => {
      if (url.includes("openinsider.com"))
        return { ok: true, text: async () => html };
      return { ok: true, text: async () => "<feed></feed>" };
    });

    const signals = await fetchSecInsiderSignals();
    const insider = signals.find((s) => s.source === "SEC_INSIDER");

    expect(insider).toBeDefined();
    expect(insider!.symbol).toBe("IFF");
  });
});
