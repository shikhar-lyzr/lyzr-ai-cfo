import { exactMatch } from "./strategies/exact";
import { toleranceMatch } from "./strategies/tolerance";
import { fuzzyMatch } from "./strategies/fuzzy";
import type {
  GLEntryInput,
  SubLedgerEntryInput,
  StrategyConfig,
  MatchResult,
  MatchLinkResult,
  BreakResult,
} from "./types";

export function runMatchRun(
  gl: GLEntryInput[],
  sub: SubLedgerEntryInput[],
  config: StrategyConfig
): MatchResult {
  const totalGL = gl.length;
  const totalSub = sub.length;

  let residualGL = gl;
  let residualSub = sub;
  const links: MatchLinkResult[] = [];

  if (config.exact) {
    const r = exactMatch(residualGL, residualSub);
    links.push(...r.links);
    residualGL = r.residualGL;
    residualSub = r.residualSub;
  }

  if (config.tolerance.enabled) {
    const r = toleranceMatch(residualGL, residualSub, config.tolerance);
    links.push(...r.links);
    residualGL = r.residualGL;
    residualSub = r.residualSub;
  }

  if (config.fuzzy.enabled) {
    const r = fuzzyMatch(residualGL, residualSub, config.fuzzy);
    links.push(...r.links);
    residualGL = r.residualGL;
    residualSub = r.residualSub;
  }

  const breaks: BreakResult[] = [
    ...residualGL.map((e) => ({ side: "gl_only" as const, entryId: e.id })),
    ...residualSub.map((e) => ({ side: "sub_only" as const, entryId: e.id })),
  ];

  const matched = links.filter((l) => !l.partial).length;
  const partial = links.filter((l) => l.partial).length;

  return {
    links,
    breaks,
    stats: {
      totalGL,
      totalSub,
      matched,
      partial,
      unmatched: breaks.length,
    },
  };
}
