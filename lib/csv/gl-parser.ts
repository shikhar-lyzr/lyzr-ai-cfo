import type { GLEntryInput, FXRateInput } from "@/lib/reconciliation/types";
import { convert } from "@/lib/reconciliation/fx";

type ParsedGL = Omit<GLEntryInput, "id">;

export async function parseGlCsv(
  headers: string[],
  rows: string[][],
  rates: FXRateInput[]
): Promise<{ entries: ParsedGL[]; skipped: Array<{ row: number; reason: string }> }> {
  const idx = (name: string) => headers.findIndex((h) => h.toLowerCase().trim() === name);
  const iDate = idx("entry_date");
  const iPost = idx("posting_date");
  const iAcc = idx("account");
  const iRef = idx("reference");
  const iMemo = idx("memo");
  const iAmt = idx("amount");
  const iCur = idx("currency");
  const iDC = idx("debit_credit");
  const iCp = idx("counterparty");

  if (iDate < 0 || iAcc < 0 || iRef < 0 || iAmt < 0 || iCur < 0 || iDC < 0) {
    throw new Error("GL CSV missing required headers");
  }

  const entries: ParsedGL[] = [];
  const skipped: Array<{ row: number; reason: string }> = [];

  rows.forEach((r, i) => {
    try {
      const entryDate = new Date(r[iDate]);
      const postingDate = iPost >= 0 ? new Date(r[iPost]) : entryDate;
      const amount = Number(r[iAmt]);
      const cur = (r[iCur] || "USD").toUpperCase();
      if (!Number.isFinite(amount)) throw new Error(`non-numeric amount`);
      if (isNaN(entryDate.getTime())) throw new Error(`bad entry_date`);

      const baseAmount = convert(amount, cur, "USD", postingDate, rates);
      entries.push({
        entryDate, postingDate,
        account: r[iAcc], reference: r[iRef],
        memo: iMemo >= 0 ? r[iMemo] : undefined,
        amount, txnCurrency: cur, baseAmount,
        debitCredit: (r[iDC]?.toUpperCase() === "CR" ? "CR" : "DR"),
        counterparty: iCp >= 0 ? r[iCp] || undefined : undefined,
      });
    } catch (err) {
      skipped.push({ row: i + 2, reason: err instanceof Error ? err.message : "unknown" });
    }
  });

  return { entries, skipped };
}
