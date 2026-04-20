import type { LucideIcon } from "lucide-react";
import { JourneyChatPanel } from "./journey-chat-panel";

interface JourneyPageProps {
  id: string;
  title: string;
  description: string;
  icon: LucideIcon;
  nudges: string[];
  children: React.ReactNode;
  periodKey?: string;
}

export function JourneyPage({ id, title, description, icon: Icon, nudges, children, periodKey }: JourneyPageProps) {
  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] -mx-8 -mt-8 -mb-4">
      <div className="px-8 py-6 border-b border-border">
        <div className="flex items-center gap-3">
          <Icon size={28} className="text-muted-foreground" />
          <div>
            <h1 className="text-2xl font-semibold tracking-tight" style={{ fontFamily: "var(--font-playfair)" }}>
              {title}
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">{description}</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-8 py-6">
        {children}
      </div>

      <JourneyChatPanel journeyId={id} nudges={nudges} periodKey={periodKey} />
    </div>
  );
}
