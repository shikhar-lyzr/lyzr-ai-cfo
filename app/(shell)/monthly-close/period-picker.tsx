"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

type Period = { periodKey: string; source: "recon" | "records" | "both" };

export function PeriodPicker() {
  const router = useRouter();
  const params = useSearchParams();
  const active = params.get("period") ?? "";
  const [periods, setPeriods] = useState<Period[]>([]);

  useEffect(() => {
    fetch("/api/close/periods")
      .then((r) => r.json())
      .then((d) => setPeriods(d.periods ?? []))
      .catch(() => setPeriods([]));
  }, []);

  if (periods.length === 0) {
    return <span className="text-xs text-muted-foreground">no periods</span>;
  }

  return (
    <select
      value={active || periods[0].periodKey}
      onChange={(e) => {
        const next = new URLSearchParams(params);
        next.set("period", e.target.value);
        router.push(`?${next.toString()}`);
      }}
      className="text-xs bg-secondary border border-border rounded px-2 py-1"
    >
      {periods.map((p) => (
        <option key={p.periodKey} value={p.periodKey}>
          {p.periodKey}
        </option>
      ))}
    </select>
  );
}
