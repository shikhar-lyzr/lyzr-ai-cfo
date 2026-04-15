import type { LucideIcon } from "lucide-react";

interface SectionHeaderProps {
  icon?: LucideIcon;
  title: string;
  count?: number;
}

export function SectionHeader({ icon: Icon, title, count }: SectionHeaderProps) {
  return (
    <div className="flex items-center gap-2">
      {Icon && <Icon size={16} className="text-muted-foreground" />}
      <span className="text-[11px] uppercase tracking-[0.05em] font-medium text-muted-foreground">
        {title}
      </span>
      {count !== undefined && (
        <span className="inline-flex items-center justify-center min-w-[20px] h-5 rounded-full bg-primary/10 text-primary text-[10px] font-semibold px-1.5">
          {count}
        </span>
      )}
    </div>
  );
}
