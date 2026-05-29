import { describe, it, expect } from "vitest";
import {
  normalizePanelColorHex,
  parsePanelColorSource,
  swatchFromHex,
} from "./panel-color";

describe("normalizePanelColorHex", () => {
  it("normalizes valid hex", () => {
    expect(normalizePanelColorHex("#abcdef")).toBe("#ABCDEF");
    expect(normalizePanelColorHex("abcdef")).toBe("#ABCDEF");
    expect(normalizePanelColorHex("  #ABCDEF  ")).toBe("#ABCDEF");
  });

  it("returns null for invalid hex", () => {
    expect(normalizePanelColorHex("")).toBeNull();
    expect(normalizePanelColorHex("xyz")).toBeNull();
    expect(normalizePanelColorHex("#12345")).toBeNull();
    expect(normalizePanelColorHex("#1234567")).toBeNull();
  });
});

describe("parsePanelColorSource", () => {
  it("returns manual for 'manual'", () => {
    expect(parsePanelColorSource("manual")).toBe("manual");
    expect(parsePanelColorSource(" Manual ")).toBe("manual");
  });

  it("returns auto for anything else", () => {
    expect(parsePanelColorSource(null)).toBe("auto");
    expect(parsePanelColorSource("")).toBe("auto");
    expect(parsePanelColorSource("other")).toBe("auto");
  });
});

describe("swatchFromHex", () => {
  it("creates swatch from valid hex", () => {
    const swatch = swatchFromHex("#FF8040");
    expect(swatch).toEqual({
      hex: "#FF8040",
      rgb: { r: 255, g: 128, b: 64 },
      sharePct: 100,
    });
  });

  it("uses custom sharePct", () => {
    const swatch = swatchFromHex("#000000", 50);
    expect(swatch?.sharePct).toBe(50);
  });

  it("returns null for invalid hex", () => {
    expect(swatchFromHex("invalid")).toBeNull();
  });
});
