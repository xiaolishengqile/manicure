import { describe, it, expect } from "vitest";
import {
  parseSoloImageEditPrompt,
  buildFullSoloImageEditPrompt,
  SOLO_IMAGE_EDIT_BASE_LINES,
} from "./solo-image-edit-prompt";

describe("parseSoloImageEditPrompt", () => {
  it("returns null for null entry", () => {
    expect(parseSoloImageEditPrompt(null)).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(parseSoloImageEditPrompt("")).toBeNull();
    expect(parseSoloImageEditPrompt("   ")).toBeNull();
  });

  it("trims and returns valid content", () => {
    expect(parseSoloImageEditPrompt("  hello  ")).toBe("hello");
  });

  it("strips null bytes", () => {
    expect(parseSoloImageEditPrompt("hello\0world")).toBe("helloworld");
  });
});

describe("buildFullSoloImageEditPrompt", () => {
  it("prepends base lines to user body", () => {
    const result = buildFullSoloImageEditPrompt("user input");
    expect(result).toContain(SOLO_IMAGE_EDIT_BASE_LINES);
    expect(result).toContain("user input");
  });

  it("trims user body", () => {
    const result = buildFullSoloImageEditPrompt("  trimmed  ");
    expect(result).toContain("trimmed");
  });
});
