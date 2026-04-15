"use client";

import { useRouter } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { motion } from "framer-motion";
import type { NavItem } from "@/lib/config/journeys";

interface JourneyCardProps {
  journey: NavItem;
  tooltip?: string;
}

export function JourneyCard({ journey, tooltip }: JourneyCardProps) {
  const router = useRouter();
  const Icon = journey.icon;

  return (
    <div className="relative">
      {tooltip && (
        <div className="absolute -left-2 top-1/2 -translate-y-1/2 -translate-x-full bg-primary text-primary-foreground text-xs px-3 py-2 rounded-lg max-w-[180px] z-10 hidden lg:block">
          {tooltip}
          <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1 w-2 h-2 bg-primary rotate-45" />
        </div>
      )}
      <motion.button
        onClick={() => router.push(journey.path)}
        whileHover={{ scale: 1.01 }}
        transition={{ duration: 0.15 }}
        className="w-full flex items-start gap-4 p-5 rounded-[var(--radius)] bg-card border border-border text-left hover:border-primary/20 transition-colors"
      >
        <Icon size={24} className="text-muted-foreground mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0">
          <h3 className="text-base font-medium" style={{ fontFamily: "var(--font-playfair)" }}>
            {journey.label}
          </h3>
          <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
            {journey.description}
          </p>
        </div>
        <ChevronRight size={18} className="text-muted-foreground mt-1 shrink-0" />
      </motion.button>
    </div>
  );
}
