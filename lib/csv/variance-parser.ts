export interface ParsedVarianceRow {
  account: string;
  period: string;
  actual: number;
  budget: number;
  category: string;
}

export function parseCSV(text: string): { headers: string[]; rows: string[][] } {
  const lines = text.trim().split(/\r?\n/);
  const parseLine = (line: string): string[] => {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') { current += '"'; i++; } // escaped quote
        else inQuotes = !inQuotes;
      } else if (ch === "," && !inQuotes) {
        result.push(current.trim());
        current = "";
      } else {
        current += ch;
      }
    }
    result.push(current.trim());
    return result;
  };
  const headers = parseLine(lines[0]).map((h) => h.toLowerCase());
  const rows = lines.slice(1).filter((l) => l.trim()).map(parseLine);
  return { headers, rows };
}

export function autoDetectColumns(headers: string[]): Record<string, number> {
  const mapping: Record<string, number> = {};
  for (let i = 0; i < headers.length; i++) {
    const h = headers[i];
    if (/account|name|description|line.?item|gl/i.test(h)) mapping.account = i;
    else if (/period|month|date|quarter/i.test(h)) mapping.period = i;
    else if (/actual|spent|real/i.test(h)) mapping.actual = i;
    else if (/budget|plan|forecast|target/i.test(h)) mapping.budget = i;
    else if (/category|type|class|dept|department/i.test(h)) mapping.category = i;
  }
  return mapping;
}

export function parseRows(
  rows: string[][],
  mapping: Record<string, number>
): ParsedVarianceRow[] {
  return rows
    .filter((row) => row.length > Math.max(...Object.values(mapping)))
    .map((row) => ({
      account: row[mapping.account] ?? "Unknown",
      period: row[mapping.period] ?? "Unknown",
      actual: parseFloat(row[mapping.actual]) || 0,
      budget: parseFloat(row[mapping.budget]) || 0,
      category: row[mapping.category] ?? "General",
    }))
    .filter((r) => r.account !== "Unknown" && (r.actual > 0 || r.budget > 0));
}
