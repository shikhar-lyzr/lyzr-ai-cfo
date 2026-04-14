import type { LucideIcon } from "lucide-react";

interface MetricCardProps {
  value: string | number;
  label: string;
  sublabel?: string;
  sublabelColor?: string;
  icon?: LucideIcon;
}

export function MetricCard({ value, label, sublabel, sublabelColor, icon: Icon }: MetricCardProps) {
  return (
    <div className="bg-card border border-border rounded-[var(--radius)] p-4 text-center">
      {Icon && <Icon size={20} className="mx-auto mb-1 text-muted-foreground" />}
      <div className="font-[var(--font-serif)] text-3xl font-semibold tracking-tight" style={{ fontFamily: "var(--font-playfair)" }}>
        {value}
      </div>
      <div className="text-[11px] uppercase tracking-[0.05em] font-medium text-muted-foreground mt-1">
        {label}
      </div>
      {sublabel && (
        <div className={`text-xs mt-0.5 ${sublabelColor ?? "text-muted-foreground"}`}>
          {sublabel}
        </div>
      )}
    </div>
  );
}
