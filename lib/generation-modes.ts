export type GenerationMode = "complete_grid" | "multi_angle" | "packaging_mockup";

export const GENERATION_MODE_OPTIONS: {
  value: GenerationMode;
  label: string;
  description: string;
}[] = [
  {
    value: "complete_grid",
    label: "白底栅格 · 自动补全至10枚",
    description:
      "从实拍抠出甲片，纯白底 2×5 固定排版；若图中不足10枚，会按同一套风格自动补全到10枚。",
  },
  {
    value: "multi_angle",
    label: "多角度产品图（固定3张）",
    description:
      "基于同一张投喂图，依次生成正视主图、约45°斜视、俯视平铺三张电商白底产品照。",
  },
  {
    value: "packaging_mockup",
    label: "包装盒 + 手握实拍",
    description:
      "生成带透明开窗的白盒包装示意，盒内陈列甲片；同时生成手戴同款美甲并握持包装盒的画面（2张、不同构图）。",
  },
];

export function parseGenerationMode(raw: FormDataEntryValue | null): GenerationMode {
  const s = typeof raw === "string" ? raw.trim() : "";
  if (s === "multi_angle" || s === "packaging_mockup") return s;
  return "complete_grid";
}

const COMPLETE_GRID_PROMPT = `Edit the provided reference photo of press-on / stick-on nails (they may sit on a display card, be held by a hand, or appear on a noisy background).

IMAGE EDITING TASK:
1) Identify every individual artificial nail tip in the photo. Ignore human skin, fingers, display card, printed text, logos, packaging, and environment.
2) Cut out ONLY the nail pieces with crisp, clean edges (no leftover card, skin, harsh cast shadows, or background texture).
3) Composite them onto a new canvas with a pure solid white background (#FFFFFF only).
4) Arrange EXACTLY 10 nail tips in a perfectly regular grid of 2 rows × 5 columns (two rows, five columns), equal spacing, centered in the frame. Each nail upright/natural orientation. Preserve original colors, finishes, and nail-art details for every nail that exists in the source.
5) If fewer than 10 nails are clearly visible in the source, you MUST invent additional matching press-on nails to reach exactly 10: keep the same collection aesthetic (palette, motifs, chrome/3D accents, illustration style) so the added nails look like they belong to the same product set. Do not leave empty slots.
6) E-commerce studio look: no props, no watermark, no busy shadows.

Return a single square product-ready image.`;

const ANGLE_PROMPTS: { prompt: string; label: string }[] = [
  {
    label: "图1 · 正视主图",
    prompt: `Using ONLY the nail designs from the reference image, create a premium e-commerce HERO product photograph.

Requirements:
- Isolate the press-on nail set on a pure solid white background (#FFFFFF).
- Soft, even studio lighting; minimal gentle contact shadow acceptable.
- Straight-on front / camera-facing symmetrical view suitable for a product listing main image.
- If the reference implies a full set, show up to 10 nails in a clean 2 rows × 5 columns grid; otherwise show every distinct nail from the reference in a tidy layout.
- Preserve each nail’s artwork, colors, and 3D/metallic details with high fidelity (input_fidelity intent).

Single square frame, catalog-ready.`,
  },
  {
    label: "图2 · 约45°斜视",
    prompt: `Using ONLY the nail designs from the reference image, create a second PRODUCT SHOT from a different angle.

Requirements:
- Same pure white seamless background (#FFFFFF).
- Approximately 45° three-quarter perspective so depth and edge curvature read clearly—like Fig.2 style catalog angles.
- Same nail art fidelity as the reference; coherent lighting; professional catalog look.
- Layout: still product-focused (not worn on a person). Arrange nails so all remain readable.

Single square frame.`,
  },
  {
    label: "图3 · 俯视平铺",
    prompt: `Using ONLY the nail designs from the reference image, create a TOP-DOWN flat lay product photograph.

Requirements:
- Pure white background (#FFFFFF); optional very soft, tight drop shadow for separation only.
- Camera looking straight down; nails arranged neatly (2×5 grid if a 10-piece set is implied).
- Even spacing, centered composition, macro clarity on textures.

Single square frame.`,
  },
];

const PACKAGING_PROMPTS: { prompt: string; label: string }[] = [
  {
    label: "图4 · 开窗盒 + 手戴同款握持",
    prompt: `Create a high-end commercial mockup inspired by boutique press-on retail packaging.

Use the EXACT nail art from the reference image for both (a) nails displayed inside the packaging window and (b) nails worn on the model hand.

Scene:
- A fair-skinned hand holds a tall white rectangular box with a large clear plastic window.
- Inside the window, show the press-on nails mounted on a subtle pearlescent / iridescent backing card, arranged in 2 vertical columns × 5 rows (10 nails total) when applicable.
- Top of box: small black sans-serif caps text band reading: × HANDMADE PRESS-ON NAILS ×
- Bottom area: bold stacked placeholder title text "YOUR COLLECTION" plus a tiny playful line-art cat mascot silhouette (generic, not copying any trademark) optional.
- The same hand wears the matching press-on nails on visible fingers; thumb prominent near lower-right of window, other fingers wrap the left side—cohesive with reference art.
- Pure white studio background; bright, even lighting; crisp packaging print.

Single photorealistic square image.`,
  },
  {
    label: "图5 · 另一构图包装手握",
    prompt: `Alternate packaging hero shot using the SAME nail designs as the reference.

Requirements:
- White press-on nail box with clear window, same nail art inside arranged neatly (2×5 if full set).
- Different hand pose / camera crop / slight angle change from a typical first packaging shot—still professional catalog quality.
- Hand wears identical nail art to the set in the box.
- Clean white #FFFFFF backdrop; bright even lighting; premium retail vibe.

Single photorealistic square image.`,
  },
];

export function promptsForMode(mode: GenerationMode): { prompt: string; label: string }[] {
  switch (mode) {
    case "complete_grid":
      return [{ prompt: COMPLETE_GRID_PROMPT, label: GENERATION_MODE_OPTIONS[0].label }];
    case "multi_angle":
      return ANGLE_PROMPTS;
    case "packaging_mockup":
      return PACKAGING_PROMPTS;
  }
}
