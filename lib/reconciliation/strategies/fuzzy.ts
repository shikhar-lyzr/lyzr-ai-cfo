import type {
  GLEntryInput,
  SubLedgerEntryInput,
  MatchLinkResult,
  StrategyConfig,
} from "../types";

export function jaroWinkler(s1: string, s2: string): number {
  const a = (s1 || "").toLowerCase();
  const b = (s2 || "").toLowerCase();
  if (a === b) return a.length === 0 ? 0 : 1;
  if (a.length === 0 || b.length === 0) return 0;

  const matchDistance = Math.max(0, Math.floor(Math.max(a.length, b.length) / 2) - 1);
  const aMatches = new Array<boolean>(a.length).fill(false);
  const bMatches = new Array<boolean>(b.length).fill(false);

  let matches = 0;
  for (let i = 0; i < a.length; i++) {
    const start = Math.max(0, i - matchDistance);
    const end = Math.min(i + matchDistance + 1, b.length);
    for (let j = start; j < end; j++) {
      if (bMatches[j]) continue;
      if (a[i] !== b[j]) continue;
      aMatches[i] = true;
      bMatches[j] = true;
      matches++;
      break;
    }
  }
  if (matches === 0) return 0;

  let k = 0;
  let transpositions = 0;
  for (let i = 0; i < a.length; i++) {
    if (!aMatches[i]) continue;
    while (!bMatches[k]) k++;
    if (a[i] !== b[k]) transpositions++;
    k++;
  }
  transpositions = transpositions / 2;

  const jaro =
    (matches / a.length + matches / b.length + (matches - transpositions) / matches) / 3;

  let prefix = 0;
  const maxPrefix = Math.min(4, Math.min(a.length, b.length));
  for (let i = 0; i < maxPrefix; i++) {
    if (a[i] === b[i]) prefix++;
    else break;
  }

  return jaro + prefix * 0.1 * (1 - jaro);
}

const DAY_MS = 86_400_000;

export function fuzzyMatch(
  gl: GLEntryInput[],
  sub: SubLedgerEntryInput[],
  cfg: StrategyConfig["fuzzy"]
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
    let best: {
      s: SubLedgerEntryInput;
      memoSim: number;
      amountProx: number;
      confidence: number;
    } | null = null;

    for (const s of sub) {
      if (usedSub.has(s.id)) continue;
      const biggest = Math.max(Math.abs(g.baseAmount), Math.abs(s.baseAmount));
      if (biggest === 0) continue;
      const amountProx = 1 - Math.abs(s.baseAmount - g.baseAmount) / biggest;
      if (amountProx < 0.95) continue;

      const memoSim = jaroWinkler(g.memo ?? "", s.memo ?? "");
      if (memoSim < cfg.threshold) continue;

      const confidence = memoSim * 0.7 + amountProx * 0.3;
      if (!best || confidence > best.confidence) {
        best = { s, memoSim, amountProx, confidence };
      }
    }

    if (best) {
      usedSub.add(best.s.id);
      links.push({
        glId: g.id,
        subId: best.s.id,
        strategy: "fuzzy",
        confidence: best.confidence,
        amountDelta: best.s.baseAmount - g.baseAmount,
        dateDelta: Math.floor(
          (best.s.entryDate.getTime() - g.entryDate.getTime()) / DAY_MS
        ),
        partial: Math.abs(best.s.baseAmount - g.baseAmount) > 0.0001,
      });
    } else {
      residualGL.push(g);
    }
  }

  const residualSub = sub.filter((s) => !usedSub.has(s.id));
  return { links, residualGL, residualSub };
}
