import crypto from "crypto";
import type { BrokerClient, BracketOrderParams, BracketOrderResult, BrokerOrderStatus, BrokerPositionStatus, BrokerAccount, BrokerPortfolioHistory } from "@/lib/brokers/interface";
import type { AlpacaOrder, AlpacaPosition, AlpacaAccount, AlpacaPortfolioHistory } from "./types";
import { TTLCache } from "@/lib/cache";

const portfolioHistoryCache = new TTLCache<BrokerPortfolioHistory>(8 * 60 * 1000, 1); // 8 min TTL, 1 entry

export interface AlpacaCredentials {
  apiKey: string;
  apiSecret: string;
  paper: boolean;
}

function getDefaultCredentials(): AlpacaCredentials {
  const apiKey = process.env.ALPACA_API_KEY;
  const apiSecret = process.env.ALPACA_SECRET_KEY;
  if (!apiKey || !apiSecret) throw new Error("ALPACA_API_KEY and ALPACA_SECRET_KEY must be set");
  return { apiKey, apiSecret, paper: process.env.ALPACA_PAPER !== "false" };
}

export class AlpacaClient implements BrokerClient {
  readonly provider = "alpaca";

  private readonly baseUrl: string;
  private readonly headers: Record<string, string>;

  constructor(credentials?: AlpacaCredentials) {
    const creds = credentials ?? getDefaultCredentials();
    this.baseUrl = creds.paper
      ? "https://paper-api.alpaca.markets"
      : "https://api.alpaca.markets";
    this.headers = {
      "APCA-API-KEY-ID": creds.apiKey,
      "APCA-API-SECRET-KEY": creds.apiSecret,
      "Content-Type": "application/json",
    };
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: this.headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    if (res.status === 204) return undefined as T;
    const text = await res.text();
    if (!res.ok) throw new Error(`Alpaca ${method} ${path} failed ${res.status}: ${text}`);
    return JSON.parse(text) as T;
  }

  async placeBracketOrder(params: BracketOrderParams): Promise<BracketOrderResult> {
    const clientOrderId = crypto.randomUUID();

    // Alpaca bracket: parent is a limit buy; legs are stop-loss and take-profit
    const order = await this.request<AlpacaOrder>("POST", "/v2/orders", {
      symbol: params.symbol,
      qty: String(params.qty),
      side: "buy",
      type: "limit",
      time_in_force: "gtc",
      limit_price: params.entryLimit.toFixed(2),
      order_class: "bracket",
      take_profit: {
        limit_price: params.targetPrice.toFixed(2),
      },
      stop_loss: {
        stop_price: params.stopPrice.toFixed(2),
        // limit_price slightly below stop to avoid getting hung — 0.5% slippage allowance
        limit_price: (params.stopPrice * 0.995).toFixed(2),
      },
      client_order_id: clientOrderId,
    });

    return { clientOrderId, brokerOrderId: order.id };
  }

  async listOpenOrders(): Promise<BrokerOrderStatus[]> {
    const orders = await this.request<AlpacaOrder[]>("GET", "/v2/orders?status=open&limit=500");
    return orders.map(mapOrder);
  }

  async getOrder(brokerOrderId: string): Promise<BrokerOrderStatus | null> {
    try {
      const order = await this.request<AlpacaOrder>("GET", `/v2/orders/${brokerOrderId}`);
      return mapOrder(order);
    } catch {
      return null;
    }
  }

  async cancelOrder(brokerOrderId: string): Promise<void> {
    await this.request<void>("DELETE", `/v2/orders/${brokerOrderId}`);
  }

  async listPositions(): Promise<BrokerPositionStatus[]> {
    const positions = await this.request<AlpacaPosition[]>("GET", "/v2/positions");
    return positions.map(mapPosition);
  }

  async placeMarketSell(symbol: string, qty: number): Promise<void> {
    await this.request("POST", "/v2/orders", {
      symbol,
      qty: String(qty),
      side: "sell",
      type: "market",
      time_in_force: "day",
      client_order_id: crypto.randomUUID(),
    });
  }

  async getAccount(): Promise<BrokerAccount> {
    const acct = await this.request<AlpacaAccount>("GET", "/v2/account");
    return {
      equity: parseFloat(acct.equity),
      cash: parseFloat(acct.cash),
      currency: acct.currency,
      buyingPower: parseFloat(acct.buying_power),
      longMarketValue: parseFloat(acct.long_market_value),
      lastEquity: parseFloat(acct.last_equity),
      dayTradeCount: acct.daytrade_count,
      tradingBlocked: acct.trading_blocked,
    };
  }

  async getPortfolioHistory(period = "1M"): Promise<BrokerPortfolioHistory> {
    const cached = portfolioHistoryCache.get(period);
    if (cached) return cached;

    const raw = await this.request<AlpacaPortfolioHistory>(
      "GET",
      `/v2/account/portfolio/history?period=${period}&timeframe=1D`,
    );

    const points = raw.timestamp
      .map((ts, i) => ({ timestamp: ts, equity: raw.equity[i] }))
      .filter((p): p is { timestamp: number; equity: number } => p.equity != null && p.equity > 0);

    const result: BrokerPortfolioHistory = { points, baseValue: raw.base_value };
    portfolioHistoryCache.set(period, result);
    return result;
  }
}

function mapOrder(o: AlpacaOrder): BrokerOrderStatus {
  return {
    brokerOrderId: o.id,
    clientOrderId: o.client_order_id,
    status: o.status,
    filledQty: parseFloat(o.filled_qty || "0"),
    avgFillPrice: parseFloat(o.filled_avg_price ?? "0"),
    side: o.side,
    symbol: o.symbol,
  };
}

function mapPosition(p: AlpacaPosition): BrokerPositionStatus {
  return {
    symbol: p.symbol,
    qty: parseFloat(p.qty),
    avgEntryPrice: parseFloat(p.avg_entry_price),
    marketPrice: parseFloat(p.current_price),
    marketValue: parseFloat(p.market_value),
    unrealizedPnl: parseFloat(p.unrealized_pl),
    unrealizedPnlPct: parseFloat(p.unrealized_plpc),
  };
}
