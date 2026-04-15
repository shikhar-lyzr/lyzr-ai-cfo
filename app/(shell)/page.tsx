"use client";

import { Sparkles } from "lucide-react";
import { SearchBar } from "@/components/command-center/search-bar";
import { JourneyCard } from "@/components/command-center/journey-card";
import { AgentInsights } from "@/components/command-center/agent-insights";
import { ActionsRequired } from "@/components/command-center/actions-required";
import { SectionHeader } from "@/components/shared/section-header";
import { JOURNEYS } from "@/lib/config/journeys";

export default function CommandCenter() {
  return (
    <div className="flex flex-col items-center max-w-5xl mx-auto">
      {/* Hero */}
      <img
        src="https://cdn2.futurepedia.io/2026-02-26T19-07-25.498Z-q6ZO1hg4Romi6JbT7L06v7dv3Sy2zIBis.png?w=256"
        alt="Lyzr"
        className="w-16 h-16 rounded-lg mb-4"
      />
      <h1
        className="text-3xl font-semibold tracking-tight text-center"
        style={{ fontFamily: "var(--font-playfair)" }}
      >
        Welcome, Vidur
      </h1>
      <p className="text-sm text-muted-foreground mt-1 text-center">
        CFO&apos;s Office AgenticOS — Autonomous financial intelligence
      </p>

      {/* Search bar */}
      <div className="mt-8 w-full flex justify-center">
        <SearchBar />
      </div>

      {/* Agent Journeys */}
      <section className="w-full mt-10">
        <SectionHeader icon={Sparkles} title="Agent Journeys" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          {JOURNEYS.map((journey, i) => (
            <JourneyCard
              key={journey.id}
              journey={journey}
              tooltip={i === 0 ? "Start here — validate trial balances & generate your close readiness checklist" : undefined}
            />
          ))}
        </div>
      </section>

      {/* Insights + Actions */}
      <div className="w-full grid grid-cols-1 lg:grid-cols-2 gap-8 mt-10 pb-8">
        <AgentInsights />
        <ActionsRequired />
      </div>
    </div>
  );
}
