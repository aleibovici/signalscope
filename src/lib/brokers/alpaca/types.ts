export interface AlpacaOrder {
  id: string;
  client_order_id: string;
  symbol: string;
  side: "buy" | "sell";
  type: "market" | "limit" | "stop" | "stop_limit";
  order_class: "simple" | "bracket" | "oco" | "oto";
  status: string;
  filled_qty: string;
  filled_avg_price: string | null;
  qty: string;
  limit_price: string | null;
  stop_price: string | null;
  time_in_force: string;
  legs?: AlpacaOrder[];
}

export interface AlpacaPosition {
  symbol: string;
  qty: string;
  avg_entry_price: string;
  current_price: string;
  market_value: string;
  unrealized_pl: string;
  unrealized_plpc: string;
}

export interface AlpacaAccount {
  equity: string;
  cash: string;
  currency: string;
  buying_power: string;
  long_market_value: string;
  last_equity: string;
  daytrade_count: number;
  trading_blocked: boolean;
}

export interface AlpacaPortfolioHistory {
  timestamp: number[];
  equity: (number | null)[];
  base_value: number;
  timeframe: string;
}
