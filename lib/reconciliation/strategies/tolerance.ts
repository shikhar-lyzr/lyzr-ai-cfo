import type {
  GLEntryInput,
  SubLedgerEntryInput,
  MatchLinkResult,
  StrategyConfig,
} from "../types";

const DAY_MS = 86_400_000;

export function toleranceMatch(
  gl: GLEntryInput[],
  sub: SubLedgerEntryInput[],
  cfg: StrategyConfig["tolerance"]
): {
  links: MatchLinkResult[];
  residualGL: GLEntryInput[];
  residualSub: SubLedgerEntryInput[];
} {
  if (!cfg.enabled) {
    return { links: [], residualGL: gl, residualSub: sub };
  }

  const links: MatchLinkResult[] = [];
  const usedSub = new Set<string>();
  const residualGL: GLEntryInput[] = [];

  for (const g of gl) {
    let best: { s: SubLedgerEntryInput; amountDelta: number; dateDelta: number } | null = null;

    for (const s of sub) {
      if (usedSub.has(s.id)) continue;
      if ((g.counterparty ?? "") !== (s.counterparty ?? "")) continue;

      const amountDelta = s.baseAmount - g.baseAmount;
      if (Math.abs(amountDelta) > cfg.amount) continue;

      const dateDelta = Math.floor(
        (s.entryDate.getTime() - g.entryDate.getTime()) / DAY_MS
      );
      if (dateDelta > cfg.daysPlus || dateDelta < -cfg.daysMinus) continue;

      if (
        !best ||
        Math.abs(amountDelta) + Math.abs(dateDelta) <
          Math.abs(best.amountDelta) + Math.abs(best.dateDelta)
      ) {
        best = { s, amountDelta, dateDelta };
      }
    }

    if (best) {
      usedSub.add(best.s.id);
      const maxDays = Math.max(cfg.daysPlus, cfg.daysMinus, 1);
      const confidence =
        1 -
        (Math.abs(best.amountDelta) / Math.max(cfg.amount, 0.0001) +
          Math.abs(best.dateDelta) / maxDays) /
          2;
      links.push({
        glId: g.id,
        subId: best.s.id,
        strategy: "tolerance",
        confidence: Math.max(0, Math.min(1, confidence)),
        amountDelta: best.amountDelta,
        dateDelta: best.dateDelta,
        partial: Math.abs(best.amountDelta) > 0.0001,
      });
    } else {
      residualGL.push(g);
    }
  }

  const residualSub = sub.filter((s) => !usedSub.has(s.id));
  return { links, residualGL, residualSub };
}
