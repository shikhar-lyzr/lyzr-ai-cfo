import { readFileSync } from "fs";
import { join } from "path";
import { parseCSV } from "@/lib/csv/variance-parser";
import {
  ingestGl,
  ingestSubLedger,
  ingestFxRates,
  loadLedgerEntries,
  saveMatchRun,
  userHasBothLedgers,
} from "@/lib/reconciliation/persist";
import { DEFAULT_STRATEGY_CONFIG } from "@/lib/reconciliation/types";

export async function seedReconciliation(userId: string) {
  const samplesDir = join(process.cwd(), "public", "samples");

  const fx = parseCSV(readFileSync(join(samplesDir, "sample-fx-rates.csv"), "utf-8"));
  await ingestFxRates(fx.headers, fx.rows);

  const gl = parseCSV(readFileSync(join(samplesDir, "sample-gl.csv"), "utf-8"));
  await ingestGl(userId, "sample-gl.csv", gl.headers, gl.rows);

  const sub = parseCSV(readFileSync(join(samplesDir, "sample-sub-ledger.csv"), "utf-8"));
  await ingestSubLedger(userId, "sample-sub-ledger.csv", sub.headers, sub.rows);

  if (await userHasBothLedgers(userId)) {
    const { gl: glE, sub: subE } = await loadLedgerEntries(userId);
    await saveMatchRun(userId, glE, subE, DEFAULT_STRATEGY_CONFIG, "upload");
  }
}
