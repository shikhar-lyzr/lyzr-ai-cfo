"use client";

import { useState, useEffect } from "react";
import {
  Wrench,
  Sparkles,
  FileText,
  Shield,
  X,
} from "lucide-react";
import { SampleDataBadge } from "@/components/shared/sample-data-badge";
import { StatusBadge } from "@/components/shared/status-badge";

interface Skill {
  name: string;
  description: string;
  lastUsed: string;
  model: string;
  isSample?: boolean;
}

const SAMPLE_SKILLS: Skill[] = [
  {
    name: "monthly-financial-close",
    description: "Orchestrates the 5-step monthly close process",
    lastUsed: "3 hours ago",
    model: "Claude Sonnet 4.6",
    isSample: true,
  },
  {
    name: "financial-recon",
    description: "GL vs sub-ledger matching and break analysis",
    lastUsed: "Yesterday",
    model: "Claude Sonnet 4.6",
    isSample: true,
  },
  {
    name: "regulatory-capital-computation",
    description: "CET1, Tier 1, total capital ratio computation",
    lastUsed: "2 days ago",
    model: "Claude Sonnet 4.6",
    isSample: true,
  },
  {
    name: "variance-review",
    description: "Budget vs actuals variance with commentary",
    lastUsed: "5 hours ago",
    model: "Claude Sonnet 4.6",
    isSample: true,
  },
  {
    name: "ar-followup",
    description: "Aged AR dunning and collections follow-up",
    lastUsed: "Never",
    model: "Claude Haiku 4.5",
    isSample: true,
  },
  {
    name: "invoice-processing",
    description: "Invoice intake, duplicate detection, PO match",
    lastUsed: "12 min ago",
    model: "Claude Haiku 4.5",
    isSample: true,
  },
];

// Map skill names to category icons
const SKILL_ICONS: Record<string, typeof Wrench> = {
  "monthly-financial-close": Wrench,
  "financial-recon": FileText,
  "regulatory-capital-computation": Shield,
  "variance-review": Sparkles,
  "ar-followup": Wrench,
  "invoice-processing": FileText,
};

function getCategoryIcon(skillName: string): typeof Wrench {
  return SKILL_ICONS[skillName] || Wrench;
}

interface SkillModalProps {
  skill: Skill;
  onClose: () => void;
}

function SkillModal({ skill, onClose }: SkillModalProps) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-card border border-border rounded-[var(--radius)] max-w-md w-full mx-4 shadow-lg">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-lg font-semibold text-foreground capitalize">
            {skill.name.replace(/-/g, " ")}
          </h2>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-foreground mb-2">
              Overview
            </h3>
            <p className="text-sm text-muted-foreground">
              {skill.description}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4 text-xs">
            <div>
              <div className="text-muted-foreground font-medium">Model</div>
              <div className="text-foreground mt-1">{skill.model}</div>
            </div>
            <div>
              <div className="text-muted-foreground font-medium">Last Used</div>
              <div className="text-foreground mt-1">{skill.lastUsed}</div>
            </div>
          </div>

          <div className="pt-2 border-t border-border">
            <p className="text-xs text-muted-foreground">
              This skill is ready to use in your agent workflows.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

interface SkillCardProps {
  skill: Skill;
  onClick: () => void;
}

function SkillCard({ skill, onClick }: SkillCardProps) {
  const IconComponent = getCategoryIcon(skill.name);
  const status = skill.isSample ? "available" : "active";

  return (
    <button
      onClick={onClick}
      className="bg-card border border-border rounded-[var(--radius)] p-4 text-left hover:border-foreground/50 transition-colors cursor-pointer"
    >
      <div className="flex items-start justify-between mb-3">
        <IconComponent
          size={20}
          className="text-muted-foreground flex-shrink-0"
        />
        <StatusBadge status={status} />
      </div>

      <h3 className="font-medium text-foreground text-sm capitalize mb-1">
        {skill.name.replace(/-/g, "-")}
      </h3>
      <p className="text-xs text-muted-foreground mb-3 line-clamp-2">
        {skill.description}
      </p>

      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{skill.lastUsed}</span>
        <span className="text-muted-foreground">{skill.model}</span>
      </div>
    </button>
  );
}

export default function SkillsManagerPage() {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSkill, setSelectedSkill] = useState<Skill | null>(null);

  useEffect(() => {
    fetch("/api/agent/context")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.skills && Array.isArray(data.skills)) {
          // Convert skill names from the API to skill objects
          const diskSkills: Skill[] = data.skills
            .filter((skillName: string) =>
              SAMPLE_SKILLS.some((s) => s.name === skillName)
            )
            .map((skillName: string) => {
              const sample = SAMPLE_SKILLS.find((s) => s.name === skillName);
              return {
                name: skillName,
                description: sample?.description || "No description",
                lastUsed: sample?.lastUsed || "Never",
                model: sample?.model || "Claude Sonnet 4.6",
                isSample: false,
              };
            });

          // Merge with samples (samples not on disk have isSample: true)
          const sampleOnlySkills = SAMPLE_SKILLS.filter(
            (s) => !diskSkills.some((ds) => ds.name === s.name)
          );

          setSkills([...diskSkills, ...sampleOnlySkills]);
        } else {
          setSkills(SAMPLE_SKILLS);
        }
      })
      .catch(() => setSkills(SAMPLE_SKILLS))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-8 h-8 border-2 border-accent-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1
              className="text-[28px] font-semibold text-foreground"
              style={{ fontFamily: "var(--font-playfair)" }}
            >
              Skills Manager
            </h1>
            <SampleDataBadge />
          </div>
          <p className="text-sm text-muted-foreground mt-2">
            Reusable agent capabilities, versioned and composable
          </p>
        </div>

        <button
          disabled
          className="px-4 py-2 text-sm font-medium rounded-[var(--radius)] border border-border bg-card text-muted-foreground cursor-not-allowed opacity-50"
        >
          + Create Skill
        </button>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {skills.map((skill) => (
          <SkillCard
            key={skill.name}
            skill={skill}
            onClick={() => setSelectedSkill(skill)}
          />
        ))}
      </div>

      {/* Modal */}
      {selectedSkill && (
        <SkillModal
          skill={selectedSkill}
          onClose={() => setSelectedSkill(null)}
        />
      )}
    </div>
  );
}
