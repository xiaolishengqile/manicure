import { describe, it, expect } from "vitest";
import {
  formatDownloadBatchStamp,
  sanitizeFilenameSegment,
  buildResultDownloadFilename,
} from "./download-filename";

describe("formatDownloadBatchStamp", () => {
  it("formats a date as YYYYMMDD-HHMMSS", () => {
    const d = new Date(2026, 0, 15, 9, 5, 3); // 2026-01-15 09:05:03
    expect(formatDownloadBatchStamp(d)).toBe("20260115-090503");
  });

  it("pads single-digit values", () => {
    const d = new Date(2026, 11, 1, 0, 0, 0);
    expect(formatDownloadBatchStamp(d)).toBe("20261201-000000");
  });
});

describe("sanitizeFilenameSegment", () => {
  it("replaces invalid chars with underscore", () => {
    expect(sanitizeFilenameSegment('a/b:c*d"e')).toBe("a_b_c_d_e");
  });

  it("collapses whitespace and underscores", () => {
    expect(sanitizeFilenameSegment("hello   world__test")).toBe("hello_world_test");
  });

  it("strips leading dots", () => {
    expect(sanitizeFilenameSegment(".hidden")).toBe("hidden");
  });

  it("strips trailing underscores", () => {
    expect(sanitizeFilenameSegment("test_")).toBe("test");
  });

  it("respects maxLen", () => {
    const result = sanitizeFilenameSegment("abcdefghijklmnop", 5);
    expect(result).toBe("abcde");
  });

  it("returns fallback for empty result", () => {
    expect(sanitizeFilenameSegment("___")).toBe("图");
    expect(sanitizeFilenameSegment("")).toBe("图");
  });
});

describe("buildResultDownloadFilename", () => {
  it("builds filename with default prefix", () => {
    const result = buildResultDownloadFilename({
      batchStamp: "20260115-090503",
      label: "方案 A",
      index: 0,
      ext: "png",
    });
    expect(result).toBe("美甲生成_20260115-090503_方案_A_01.png");
  });

  it("uses custom prefix", () => {
    const result = buildResultDownloadFilename({
      batchStamp: "20260115-090503",
      index: 2,
      ext: "jpg",
      prefix: "test",
    });
    expect(result).toBe("test_20260115-090503_图3_03.jpg");
  });

  it("strips leading dot from ext", () => {
    const result = buildResultDownloadFilename({
      batchStamp: "20260115-090503",
      index: 0,
      ext: ".webp",
    });
    expect(result).toContain(".webp");
  });
});
