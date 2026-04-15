import { Suspense } from "react";
import { AgentConsoleClient } from "./agent-console-client";

export default function AgentConsolePage() {
  return (
    <Suspense fallback={null}>
      <AgentConsoleClient />
    </Suspense>
  );
}
