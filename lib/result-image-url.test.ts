import { describe, it, expect } from "vitest";
import { extFromDataUrl, extFromContentType } from "./result-image-url";

describe("extFromDataUrl", () => {
  it("returns png for png data url", () => {
    expect(extFromDataUrl("data:image/png;base64,abc")).toBe("png");
  });

  it("returns jpg for jpeg data url", () => {
    expect(extFromDataUrl("data:image/jpeg;base64,abc")).toBe("jpg");
  });

  it("returns webp for webp data url", () => {
    expect(extFromDataUrl("data:image/webp;base64,abc")).toBe("webp");
  });

  it("returns png as default for unknown", () => {
    expect(extFromDataUrl("data:text/plain,abc")).toBe("png");
    expect(extFromDataUrl("not-a-data-url")).toBe("png");
  });
});

describe("extFromContentType", () => {
  it("returns webp for webp content type", () => {
    expect(extFromContentType("image/webp")).toBe("webp");
  });

  it("returns jpg for jpeg content type", () => {
    expect(extFromContentType("image/jpeg")).toBe("jpg");
  });

  it("returns png for png content type", () => {
    expect(extFromContentType("image/png")).toBe("png");
  });

  it("returns gif for gif content type", () => {
    expect(extFromContentType("image/gif")).toBe("gif");
  });

  it("returns png as default for null or unknown", () => {
    expect(extFromContentType(null)).toBe("png");
    expect(extFromContentType("application/json")).toBe("png");
  });
});
