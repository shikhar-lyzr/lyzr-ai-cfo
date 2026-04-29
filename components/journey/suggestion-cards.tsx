"use client";

interface SuggestionCardsProps {
  nudges: string[];
  onSelect: (nudge: string) => void;
}

export function SuggestionCards({ nudges, onSelect }: SuggestionCardsProps) {
  if (nudges.length === 0) return null;
  return (
    <div className="space-y-2">
      {nudges.map((nudge) => (
        <button
          key={nudge}
          onClick={() => onSelect(nudge)}
          className="w-full text-left px-3 py-2.5 rounded-md border border-border bg-card hover:bg-secondary/50 hover:border-primary/30 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          {nudge}
        </button>
      ))}
    </div>
  );
}
