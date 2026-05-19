import { readFile } from "node:fs/promises";
import path from "node:path";

/** 内置方案 A 斜拍排版参考（与用户提供的标准成片一致） */
export const EXTRACT_ANGLE_SCATTERED_PLAN_A_LAYOUT_REF_BASENAME =
  "extract-angle-scattered-plan-a-layout.jpg";

const LAYOUT_REF_ABS = path.join(
  process.cwd(),
  "public",
  "references",
  EXTRACT_ANGLE_SCATTERED_PLAN_A_LAYOUT_REF_BASENAME,
);

let cachedLayoutRef: { buffer: Buffer; mime: string } | null = null;

export async function loadExtractAngleScatteredPlanALayoutRef(): Promise<{
  buffer: Buffer;
  mime: string;
}> {
  if (cachedLayoutRef) return cachedLayoutRef;
  const buffer = await readFile(LAYOUT_REF_ABS);
  cachedLayoutRef = { buffer, mime: "image/jpeg" };
  return cachedLayoutRef;
}
