import type { SubLedgerEntryInput, FXRateInput } from "@/lib/reconciliation/types";
import { convert } from "@/lib/reconciliation/fx";
import { findHeader, parseAmount, parseDate, detectDateFormat } from "./utils";

type ParsedSub = Omit<SubLedgerEntryInput, "id">;

export async function parseSubLedgerCsv(
  headers: string[],
  rows: string[][],
  rates: FXRateInput[]
): Promise<{ entries: ParsedSub[]; skipped: Array<{ row: number; reason: string }> }> {
  const iDate = findHeader(headers, "entry_date", ["date", "transaction_date"]);
  const iAcc  = findHeader(headers, "account", ["gl_account", "acct"]);
  const iMod  = findHeader(headers, "source_module", ["module"]);
  const iRef  = findHeader(headers, "reference", ["ref", "reference_number"]);
  const iMemo = findHeader(headers, "memo", ["description", "note"]);
  const iAmt  = findHeader(headers, "amount", ["amt", "value"]);
  const iCur  = findHeader(headers, "currency", ["ccy", "txn_currency"]);
  const iCp   = findHeader(headers, "counterparty", ["vendor", "payee"]);

  if (iDate < 0 || iAcc < 0 || iRef < 0 || iAmt < 0 || iCur < 0 || iMod < 0) {
    throw new Error("Sub-ledger CSV missing required headers");
  }

  const dateFormat = detectDateFormat(rows.map((r) => r[iDate]).filter(Boolean));

  const entries: ParsedSub[] = [];
  const skipped: Array<{ row: number; reason: string }> = [];

  rows.forEach((r, i) => {
    try {
      const entryDate = parseDate(r[iDate], dateFormat);
      if (!entryDate) throw new Error("bad entry_date");

      const amount = parseAmount(r[iAmt]);
      if (amount === null) throw new Error("non-numeric amount");

      const cur = (r[iCur] || "USD").toUpperCase();
      const baseAmount = convert(amount, cur, "USD", entryDate, rates);
      const mod = (r[iMod] || "AP").toUpperCase();
      const sourceModule = mod === "AR" || mod === "FA" ? mod : "AP";

      entries.push({
        entryDate, sourceModule,
        account: r[iAcc], reference: r[iRef],
        memo: iMemo >= 0 ? r[iMemo] : undefined,
        amount, txnCurrency: cur, baseAmount,
        counterparty: iCp >= 0 ? r[iCp] || undefined : undefined,
      });
    } catch (err) {
      skipped.push({ row: i + 2, reason: err instanceof Error ? err.message : "unknown" });
    }
  });

  return { entries, skipped };
}
