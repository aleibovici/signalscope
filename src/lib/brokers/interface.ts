export interface BracketOrderParams {
  symbol: string;
  qty: number;
  entryLimit: number;
  stopPrice: number;
  targetPrice: number;
}

export interface BracketOrderResult {
  clientOrderId: string;
  brokerOrderId: string | null;
}

export interface BrokerOrderStatus {
  brokerOrderId: string;
  clientOrderId?: string;
  status: string;
  filledQty: number;
  avgFillPrice: number;
  side: string;
  symbol: string;
}

export interface BrokerPositionStatus {
  symbol: string;
  qty: number;
  avgEntryPrice: number;
  marketPrice: number;
  marketValue: number;
  unrealizedPnl: number;
  unrealizedPnlPct: number;
}

export interface BrokerAccount {
  equity: number;
  cash: number;
  currency: string;
  buyingPower: number;
  longMarketValue: number;
  lastEquity: number;
  dayTradeCount: number;
  tradingBlocked: boolean;
}

export interface BrokerPortfolioPoint {
  timestamp: number;
  equity: number;
}

export interface BrokerPortfolioHistory {
  points: BrokerPortfolioPoint[];
  baseValue: number;
}

export interface BrokerClient {
  readonly provider: string;

  placeBracketOrder(params: BracketOrderParams): Promise<BracketOrderResult>;
  listOpenOrders(): Promise<BrokerOrderStatus[]>;
  getOrder(brokerOrderId: string): Promise<BrokerOrderStatus | null>;
  cancelOrder(brokerOrderId: string): Promise<void>;
  listPositions(): Promise<BrokerPositionStatus[]>;
  placeMarketSell(symbol: string, qty: number): Promise<void>;
  getAccount(): Promise<BrokerAccount>;
}
