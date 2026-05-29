import { describe, it, expect } from "vitest";
import {
  isImageGatewayProviderId,
  baseUrlForGatewayProvider,
} from "./image-gateway-providers";

describe("isImageGatewayProviderId", () => {
  it("returns true for valid ids", () => {
    expect(isImageGatewayProviderId("t8star")).toBe(true);
    expect(isImageGatewayProviderId("llmgateway")).toBe(true);
  });

  it("returns false for invalid ids", () => {
    expect(isImageGatewayProviderId(null)).toBe(false);
    expect(isImageGatewayProviderId(undefined)).toBe(false);
    expect(isImageGatewayProviderId("other")).toBe(false);
  });
});

describe("baseUrlForGatewayProvider", () => {
  it("returns correct base url for t8star", () => {
    expect(baseUrlForGatewayProvider("t8star")).toBe("https://ai.t8star.org/v1");
  });

  it("returns correct base url for llmgateway", () => {
    expect(baseUrlForGatewayProvider("llmgateway")).toBe("https://www.llmgateway.cn/v1");
  });

  it("returns default for unknown id", () => {
    expect(baseUrlForGatewayProvider("unknown")).toBe("https://ai.t8star.org/v1");
    expect(baseUrlForGatewayProvider(null)).toBe("https://ai.t8star.org/v1");
  });
});
