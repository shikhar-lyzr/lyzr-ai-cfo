"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

type Period = {
  periodKey: string;
  hasGl: boolean;
  hasSub: boolean;
  matchRate: number | null;
};

export function PeriodPicker() {
  const router = useRouter();
  const params = useSearchParams();
  const active = params.get("period");
  const [periods, setPeriods] = useState<Period[]>([]);

  useEffect(() => {
    fetch(`/api/reconciliation/periods`)
      .then((r) => r.json())
      .then((data: Period[]) => setPeriods(Array.isArray(data) ? data : []))
      .catch(() => setPeriods([]));
  }, []);

  if (periods.length === 0) return null;

  return (
    <select
      value={active ?? periods[0].periodKey}
      onChange={(e) => {
        const sp = new URLSearchParams(params);
        sp.set("period", e.target.value);
        router.push(`?${sp.toString()}`);
      }}
      className="border rounded px-2 py-1 text-sm"
    >
      {periods.map((p) => (
        <option key={p.periodKey} value={p.periodKey}>
          {p.periodKey}
          {p.matchRate != null ? ` — ${(p.matchRate * 100).toFixed(0)}%` : ""}
          {!p.hasGl && p.hasSub ? " (no GL)" : ""}
          {p.hasGl && !p.hasSub ? " (no sub)" : ""}
        </option>
      ))}
    </select>
  );
}
