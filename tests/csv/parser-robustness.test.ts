import { describe, it, expect } from "vitest";
import {
  SHAPES,
  BASELINES,
  ALL_VARIANTS,
  runShapeOnce,
  runMatrix,
  type RunResult,
  type Outcome,
  type Shape,
} from "@/lib/csv/__fixtures__/audit-fixtures";

describe("CSV parser robustness matrix", { timeout: 30_000 }, () => {
  it("achieves >= 54/56 PASS across 5 parsers × 12 variants", async () => {
    // Warm-up: establish baseline outcomes the mutations will be measured against.
    const baselineResults: Record<Shape, RunResult> = {} as Record<Shape, RunResult>;
    for (const shape of SHAPES) {
      baselineResults[shape] = await runShapeOnce(shape, BASELINES[shape]);
      expect(baselineResults[shape].outcome).toBe("PASS"); // baselines must be clean
    }

    // Run the full 5×12 matrix.
    const cells = await runMatrix(baselineResults);

    const tally: Record<Outcome, number> = { PASS: 0, PARTIAL: 0, FAIL_DETECT: 0, FAIL_PARSE: 0, "N/A": 0 };
    for (const c of cells) tally[c.outcome] += 1;

    expect(cells).toHaveLength(SHAPES.length * ALL_VARIANTS.length); // 5 × 12 = 60

    // The goals of the robustness-fixes pass:
    expect(tally.PASS).toBeGreaterThanOrEqual(54);
    expect(tally.FAIL_DETECT).toBe(0);
    expect(tally.FAIL_PARSE).toBe(0);
  });
});
