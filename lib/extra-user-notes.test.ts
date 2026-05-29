import { describe, it, expect } from "vitest";
import {
  parseUserExtraNotes,
  appendUserRefinementToPrompt,
} from "./extra-user-notes";

describe("parseUserExtraNotes", () => {
  it("returns null for null entry", () => {
    expect(parseUserExtraNotes(null)).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(parseUserExtraNotes("")).toBeNull();
    expect(parseUserExtraNotes("   ")).toBeNull();
  });

  it("trims and returns valid content", () => {
    expect(parseUserExtraNotes("  hello  ")).toBe("hello");
  });

  it("strips null bytes", () => {
    expect(parseUserExtraNotes("hello\0world")).toBe("helloworld");
  });

  it("truncates to max length", () => {
    const long = "a".repeat(3000);
    const result = parseUserExtraNotes(long);
    expect(result?.length).toBe(2500);
  });
});

describe("appendUserRefinementToPrompt", () => {
  it("returns base prompt when notes is null", () => {
    expect(appendUserRefinementToPrompt("base", null)).toBe("base");
  });

  it("appends notes with separator", () => {
    const result = appendUserRefinementToPrompt("base", "extra");
    expect(result).toContain("base");
    expect(result).toContain("USER REFINEMENT");
    expect(result).toContain("extra");
  });
});
