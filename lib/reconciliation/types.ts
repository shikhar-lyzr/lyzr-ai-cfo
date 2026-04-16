export type Strategy = "exact" | "tolerance" | "fuzzy";

export type Side = "gl_only" | "sub_only";

export type AgeBucket = "0-30" | "31-60" | "60+";

export type Severity = "low" | "medium" | "high";

export type StrategyConfig = {
  exact: boolean;
  tolerance: {
    enabled: boolean;
    amount: number;
    daysPlus: number;
    daysMinus: number;
  };
  fuzzy: {
    enabled: boolean;
    threshold: number;
  };
};

export const DEFAULT_STRATEGY_CONFIG: StrategyConfig = {
  exact: true,
  tolerance: { enabled: true, amount: 1.0, daysPlus: 2, daysMinus: 2 },
  fuzzy: { enabled: true, threshold: 0.85 },
};

export type GLEntryInput = {
  id: string;
  entryDate: Date;
  postingDate: Date;
  account: string;
  reference: string;
  memo?: string;
  amount: number;
  txnCurrency: string;
  baseAmount: number;
  debitCredit: "DR" | "CR";
  counterparty?: string;
};

export type SubLedgerEntryInput = {
  id: string;
  sourceModule: "AP" | "AR" | "FA";
  entryDate: Date;
  account: string;
  reference: string;
  memo?: string;
  amount: number;
  txnCurrency: string;
  baseAmount: number;
  counterparty?: string;
};

export type MatchLinkResult = {
  glId: string;
  subId: string;
  strategy: Strategy;
  confidence: number;
  amountDelta: number;
  dateDelta: number;
  partial: boolean;
};

export type BreakResult = {
  side: Side;
  entryId: string;
};

export type MatchStats = {
  totalGL: number;
  totalSub: number;
  matched: number;
  partial: number;
  unmatched: number;
};

export type MatchResult = {
  links: MatchLinkResult[];
  breaks: BreakResult[];
  stats: MatchStats;
};

export type FXRateInput = {
  fromCurrency: string;
  toCurrency: string;
  rate: number;
  asOf: Date;
};
