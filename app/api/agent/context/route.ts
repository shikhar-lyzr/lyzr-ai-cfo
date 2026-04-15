import { NextResponse } from "next/server";
import { readdirSync, readFileSync, statSync } from "fs";
import { join } from "path";

const AGENT_DIR = process.cwd() + "/agent";

function listSkills(): string[] {
  const skillsDir = join(AGENT_DIR, "skills");
  try {
    return readdirSync(skillsDir).filter((name) => {
      try {
        return statSync(join(skillsDir, name)).isDirectory();
      } catch {
        return false;
      }
    });
  } catch {
    return [];
  }
}

function listKnowledgeFiles(): string[] {
  const knowledgeDir = join(AGENT_DIR, "knowledge");
  try {
    return readdirSync(knowledgeDir).filter((name) => {
      try {
        return !statSync(join(knowledgeDir, name)).isDirectory();
      } catch {
        return false;
      }
    });
  } catch {
    return [];
  }
}

function parseGuardrails(): string[] {
  const rulesPath = join(AGENT_DIR, "RULES.md");
  try {
    const content = readFileSync(rulesPath, "utf-8");
    const lines = content.split("\n");
    return lines
      .filter((line) => /^\d+\.\s\*\*/.test(line.trim()))
      .map((line) => {
        const match = line.match(/\*\*(.+?)\*\*/);
        return match ? match[1] : line.trim().replace(/^\d+\.\s*/, "");
      })
      .slice(0, 6);
  } catch {
    return [];
  }
}

export async function GET() {
  return NextResponse.json({
    skills: listSkills(),
    dataFiles: listKnowledgeFiles(),
    guardrails: parseGuardrails(),
  });
}
