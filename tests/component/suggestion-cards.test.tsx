import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SuggestionCards } from "@/components/journey/suggestion-cards";

describe("SuggestionCards", () => {
  it("renders one card per nudge", () => {
    render(<SuggestionCards nudges={["First", "Second", "Third"]} onSelect={() => {}} />);
    expect(screen.getByRole("button", { name: "First" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Second" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Third" })).toBeDefined();
  });

  it("renders nothing when nudges is empty", () => {
    const { container } = render(<SuggestionCards nudges={[]} onSelect={() => {}} />);
    expect(container.querySelectorAll("button").length).toBe(0);
  });

  it("clicking a card calls onSelect with the nudge string", () => {
    const onSelect = vi.fn();
    render(<SuggestionCards nudges={["Why is this happening?"]} onSelect={onSelect} />);
    fireEvent.click(screen.getByRole("button", { name: "Why is this happening?" }));
    expect(onSelect).toHaveBeenCalledWith("Why is this happening?");
  });
});
