import { readFile } from "node:fs/promises";
import path from "node:path";

/** 正视上手 · 真实棚拍感 — 固定上手 pose 参考（每次生成均使用） */
export const MULTI_ANGLE_FRONT_HAND_REF_BASENAME = "multi-angle-front-hand.jpg";

const HAND_REF_ABS = path.join(
  process.cwd(),
  "public",
  "references",
  MULTI_ANGLE_FRONT_HAND_REF_BASENAME,
);

let cachedHandRef: { buffer: Buffer; mime: string } | null = null;

export async function loadMultiAngleFrontHandRef(): Promise<{
  buffer: Buffer;
  mime: string;
}> {
  if (cachedHandRef) return cachedHandRef;
  const buffer = await readFile(HAND_REF_ABS);
  cachedHandRef = { buffer, mime: "image/jpeg" };
  return cachedHandRef;
}
