import type { GLEntryInput, SubLedgerEntryInput, MatchLinkResult } from "../types";

export function exactMatch(
  gl: GLEntryInput[],
  sub: SubLedgerEntryInput[]
): {
  links: MatchLinkResult[];
  residualGL: GLEntryInput[];
  residualSub: SubLedgerEntryInput[];
} {
  const subByRef = new Map<string, SubLedgerEntryInput[]>();
  for (const s of sub) {
    const arr = subByRef.get(s.reference) ?? [];
    arr.push(s);
    subByRef.set(s.reference, arr);
  }

  const links: MatchLinkResult[] = [];
  const matchedSubIds = new Set<string>();
  const residualGL: GLEntryInput[] = [];

  for (const g of gl) {
    const candidates = subByRef.get(g.reference);
    const pick = candidates?.find((s) => !matchedSubIds.has(s.id));
    if (pick) {
      matchedSubIds.add(pick.id);
      links.push({
        glId: g.id,
        subId: pick.id,
        strategy: "exact",
        confidence: 1,
        amountDelta: pick.baseAmount - g.baseAmount,
        dateDelta: Math.floor(
          (pick.entryDate.getTime() - g.entryDate.getTime()) / 86_400_000
        ),
        partial: false,
      });
    } else {
      residualGL.push(g);
    }
  }

  const residualSub = sub.filter((s) => !matchedSubIds.has(s.id));
  return { links, residualGL, residualSub };
}
