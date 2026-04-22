import { describe, it, expect } from "vitest";
import { getInitialSelection } from "../initial-selection";

describe("getInitialSelection", () => {
  it("returns the id when ?select=<cuid> is present", () => {
    const sp = new URLSearchParams("select=cmo9lvn4e0001l804rgai7wju");
    expect(getInitialSelection(sp)).toBe("cmo9lvn4e0001l804rgai7wju");
  });

  it("returns null when no select param is present", () => {
    const sp = new URLSearchParams("tab=variance");
    expect(getInitialSelection(sp)).toBeNull();
  });

  it("returns null when select is an empty string", () => {
    const sp = new URLSearchParams("select=");
    expect(getInitialSelection(sp)).toBeNull();
  });

  it("trims whitespace around the id", () => {
    const sp = new URLSearchParams("select=%20abc%20");
    expect(getInitialSelection(sp)).toBe("abc");
  });

  it("rejects ids longer than 40 chars (cuid is 25)", () => {
    const sp = new URLSearchParams("select=" + "x".repeat(100));
    expect(getInitialSelection(sp)).toBeNull();
  });

  it("rejects ids with non-alphanumeric characters (defensive)", () => {
    const sp = new URLSearchParams("select=../../etc/passwd");
    expect(getInitialSelection(sp)).toBeNull();
  });
});
