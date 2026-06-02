import { describe, expect, it } from "vitest";
import sharp from "sharp";

import {
  DEFAULT_WHITE_MARGIN_EXPAND_PCT,
  parseWhiteMarginExpandPct,
} from "./white-margin-expand-config";
import { expandWhiteMarginSquare } from "./white-margin-expand";

describe("parseWhiteMarginExpandPct", () => {
  it("defaults to 50", () => {
    expect(parseWhiteMarginExpandPct(null)).toBe(
      DEFAULT_WHITE_MARGIN_EXPAND_PCT,
    );
    expect(parseWhiteMarginExpandPct("")).toBe(
      DEFAULT_WHITE_MARGIN_EXPAND_PCT,
    );
  });

  it("clamps to 1–200", () => {
    expect(parseWhiteMarginExpandPct("0")).toBe(1);
    expect(parseWhiteMarginExpandPct("999")).toBe(200);
    expect(parseWhiteMarginExpandPct("30")).toBe(30);
  });
});

describe("expandWhiteMarginSquare", () => {
  it("outputs square canvas expanded by percent", async () => {
    const input = await sharp({
      create: {
        width: 200,
        height: 100,
        channels: 3,
        background: { r: 255, g: 0, b: 0 },
      },
    })
      .png()
      .toBuffer();

    const out = await expandWhiteMarginSquare(input, 50);
    const meta = await sharp(out).metadata();
    expect(meta.width).toBe(meta.height);
    expect(meta.width).toBe(Math.round(200 * 1.5));
  });
});
