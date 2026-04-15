import { Zap } from "lucide-react";

export function AgentStatusBar() {
  return (
    <div className="px-4 py-3 border-t border-border">
      <div className="flex items-center gap-2 text-sm">
        <Zap size={14} className="text-warning" />
        <span className="font-medium text-foreground">Agent Active</span>
      </div>
      <div className="text-xs text-muted-foreground mt-0.5">Claude Sonnet 4.6</div>
      <div className="text-[10px] text-muted-foreground mt-0.5">Powered by Lyzr AgenticOS</div>
    </div>
  );
}
