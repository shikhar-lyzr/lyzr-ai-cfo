import { describe, expect, it } from "vitest";
import { buildAllowedTools } from "@/lib/agent/allowed-tools";

type FakeTool = { name: string };

const REQUIRED_BUILTINS = ["read", "memory", "task_tracker", "skill_learner"];
const EXCLUDED_BUILTINS = ["cli", "write"];

describe("buildAllowedTools", () => {
  it("always includes all required gitclaw builtins", () => {
    const tools: FakeTool[] = [
      { name: "search_records" },
      { name: "analyze_financial_data" },
    ];

    const allowed = buildAllowedTools(tools);

    for (const builtin of REQUIRED_BUILTINS) {
      expect(allowed).toContain(builtin);
    }
  });

  it("does not include dangerous builtins (cli, write)", () => {
    const tools: FakeTool[] = [{ name: "search_records" }];

    const allowed = buildAllowedTools(tools);

    for (const excluded of EXCLUDED_BUILTINS) {
      expect(allowed).not.toContain(excluded);
    }
  });

  it("includes every provided tool name", () => {
    const tools: FakeTool[] = [
      { name: "foo" },
      { name: "bar" },
      { name: "baz" },
    ];

    const allowed = buildAllowedTools(tools);

    expect(allowed).toEqual(expect.arrayContaining(["foo", "bar", "baz"]));
  });

  it("does not duplicate builtins if already provided", () => {
    const tools: FakeTool[] = [{ name: "read" }, { name: "memory" }, { name: "other" }];

    const allowed = buildAllowedTools(tools);

    expect(allowed.filter((n) => n === "read")).toHaveLength(1);
    expect(allowed.filter((n) => n === "memory")).toHaveLength(1);
    expect(allowed).toContain("other");
  });
});
