"use client";

interface NudgeChipsProps {
  nudges: string[];
  onSelect: (nudge: string) => void;
}

export function NudgeChips({ nudges, onSelect }: NudgeChipsProps) {
  return (
    <div className="flex flex-wrap gap-2 px-4 py-2">
      {nudges.map((nudge) => (
        <button
          key={nudge}
          onClick={() => onSelect(nudge)}
          className="text-xs px-3 py-1.5 rounded-full border border-border bg-card text-muted-foreground hover:text-foreground hover:border-primary/30 transition-colors"
        >
          {nudge}
        </button>
      ))}
    </div>
  );
}
