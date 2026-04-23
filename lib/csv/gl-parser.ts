import type { GLEntryInput, FXRateInput } from "@/lib/reconciliation/types";
import { convert } from "@/lib/reconciliation/fx";
import { findHeader, parseAmount, parseDate, detectDateFormat } from "./utils";

type ParsedGL = Omit<GLEntryInput, "id">;

export async function parseGlCsv(
  headers: string[],
  rows: string[][],
  rates: FXRateInput[]
): Promise<{ entries: ParsedGL[]; skipped: Array<{ row: number; reason: string }> }> {
  const iDate = findHeader(headers, "entry_date", ["date", "transaction_date"]);
  const iPost = findHeader(headers, "posting_date", ["post_date"]);
  const iAcc  = findHeader(headers, "account", ["gl_account", "acct"]);
  const iRef  = findHeader(headers, "reference", ["ref", "reference_number"]);
  const iMemo = findHeader(headers, "memo", ["description", "note"]);
  const iAmt  = findHeader(headers, "amount", ["amt", "value"]);
  const iCur  = findHeader(headers, "currency", ["ccy", "txn_currency"]);
  const iDC   = findHeader(headers, "debit_credit", ["dr_cr", "dr/cr"]);
  const iCp   = findHeader(headers, "counterparty", ["vendor", "payee"]);

  if (iDate < 0 || iAcc < 0 || iRef < 0 || iAmt < 0 || iCur < 0 || iDC < 0) {
    throw new Error("GL CSV missing required headers");
  }

  // Detect date format once per column so per-row parsing is consistent.
  const entryDateFormat = detectDateFormat(rows.map((r) => r[iDate]).filter(Boolean));
  const postingDateFormat = iPost >= 0
    ? detectDateFormat(rows.map((r) => r[iPost]).filter(Boolean))
    : entryDateFormat;

  const entries: ParsedGL[] = [];
  const skipped: Array<{ row: number; reason: string }> = [];

  rows.forEach((r, i) => {
    try {
      const entryDate = parseDate(r[iDate], entryDateFormat);
      if (!entryDate) throw new Error("bad entry_date");
      const postingDate = iPost >= 0 ? parseDate(r[iPost], postingDateFormat) ?? entryDate : entryDate;

      const amount = parseAmount(r[iAmt]);
      if (amount === null) throw new Error("non-numeric amount");

      const cur = (r[iCur] || "USD").toUpperCase();
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
