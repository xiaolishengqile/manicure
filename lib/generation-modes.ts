export type GenerationMode =
  | "complete_grid"
  | "multi_angle"
  | "packaging_mockup"
  | "flat_to_3d_packaging"
  | "model_tryon"
  | "accessory_tryon";

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
  {
    value: "flat_to_3d_packaging",
    label: "2D 文稿 → 稳定 3D 包装效果图",
    description:
      "上传一张平面包装稿（正面/背面展开、刀版图或屏显效果图）。依次生成 3D 纸盒、独立小袋/铝箔包、另一视角与场景陈列图，尽量保持字体、色值、Logo 与稿面一致。",
  },
  {
    value: "model_tryon",
    label: "指甲 × 模特 · 精准试戴",
    description:
      "需同时上传「美甲产品图」与「模特图」。将产品上的甲片款式精准合成到模特指甲上，尽量保持模特姿态、肤色、光线与背景不变。",
  },
  {
    value: "accessory_tryon",
    label: "指甲 × 饰品 · 场景试戴（无模特）",
    description:
      "需同时上传「美甲产品图」与「饰品场景图」。不出现人物模特；将甲片款式与首饰、摆件、陈列台等饰品场景自然结合，形成精准的商品场景试戴效果。",
  },
];

export function parseGenerationMode(raw: FormDataEntryValue | null): GenerationMode {
  const s = typeof raw === "string" ? raw.trim() : "";
  if (
    s === "multi_angle" ||
    s === "packaging_mockup" ||
    s === "flat_to_3d_packaging" ||
    s === "model_tryon" ||
    s === "accessory_tryon" ||
    s === "food_tryon"
  ) {
    if (s === "food_tryon") return "accessory_tryon";
    return s;
  }
  return "complete_grid";
}

/** 需要第二张图时的语义：决定表单字段名与 UI 文案 */
export function getDualUploadKind(
  mode: GenerationMode,
): null | "model" | "accessory" {
  if (mode === "model_tryon") return "model";
  if (mode === "accessory_tryon") return "accessory";
  return null;
}

export const MODEL_TRYON_PROMPT = `You receive TWO input images in this order:
1) FIRST image: the MODEL photograph — a person (hands visible) with natural nails, in a specific pose, lighting, skin tone, clothing, and background.
2) SECOND image: the NAIL PRODUCT reference — press-on / stick-on nails shown flat, on a card, or as a product shot, displaying the exact nail art (colors, patterns, 3D chrome, decals, shape) to apply.

TASK — photorealistic virtual try-on (image editing):
- Replace ONLY the model’s fingernails (and visible thumbnail nails) with artificial nail tips that faithfully reproduce the artwork from the SECOND reference. Match each finger’s nail shape, length, and perspective; align cuticle lines believably.
- Preserve the model’s identity, face, body, skin texture, pose, jewelry, clothing, environment, and global lighting. Do NOT restyle the whole photo into a different scene.
- If multiple nail designs exist in the product reference, map them to fingers in a coherent order (e.g. thumb→pinky) consistent with the product layout.
- Edges must look naturally attached: no floating nails, no harsh paste lines, no duplicated hands.

Output a single full-frame photorealistic image with the same composition and crop as the FIRST (model) image.`;

export const ACCESSORY_TRYON_PROMPT = `You receive TWO input images in this order:
1) FIRST image: an ACCESSORY / jewelry / props still-life photograph — e.g. rings, bracelets, earrings on a velvet pad, marble tray, display bust, vanity desk, or boutique shelf scene. There must be NO human model, NO face, and NO hands in the output unless the first image already clearly contains hands as part of the original styling (in that case, do not add new people).
2) SECOND image: the NAIL PRODUCT reference — press-on / stick-on nails (flat lay, card, or product shot) showing the exact nail art to feature.

TASK — photorealistic “try-on” still life (no model):
- Integrate the press-on nail set from the SECOND reference into the ACCESSORY scene from the FIRST image as a premium lifestyle / campaign shot. The nails should read as a co-star product: clearly visible, sharp, with faithful colors, patterns, chrome/3D effects, and shapes from the nail reference.
- Plausible placements: nails on a jewelry dish beside rings, on a velvet block next to bracelets, on a mirrored tray, on risers among props, or a tasteful floating composition that respects the scene’s lighting direction and material palette.
- Match perspective, shadows, reflections, and color temperature to the accessory photograph so the composite feels shot in-camera, not pasted.
- Do NOT introduce a person, hands, or body to “wear” the nails. This mode is accessories + nails only — not food, not cuisine.

Output a single full-frame photorealistic square image.`;

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

/** 单张 2D 包装平面稿 → 多张稳定 3D 产品渲染（依次调用） */
const FLAT_TO_3D_PACKAGING_PROMPTS: { prompt: string; label: string }[] = [
  {
    label: "① 3D 纸盒主视图",
    prompt: `The input image is a FLAT 2D packaging artwork / print proof (may show front, back, or unfolded panels).

TASK — photorealistic 3D product visualization:
- Reconstruct a PHYSICAL folding carton / retail box in accurate 3D perspective (slight three-quarter hero angle).
- Map ALL visible graphics from the 2D reference onto the box faces with correct UV-style alignment: logos, product name, legal copy, icons, barcodes if present, and EXACT brand colors (match hex perception from the flat art). Typography must stay legible and proportionally consistent—no invented alternate fonts.
- Realistic cardboard thickness, clean die-cut edges, subtle print texture, soft studio lighting on a pure white or very light neutral seamless background.
- Do not add unrelated branding; do not distort the artwork into unreadable warps.

Single square catalog-quality render.`,
  },
  {
    label: "② 3D 独立小袋 / 箔袋",
    prompt: `Using the SAME flat 2D packaging reference as the only art source, generate a photorealistic 3D render of the PRIMARY small flexible pouch / foil sachet / single-use packet implied by that design language.

Requirements:
- If the flat art clearly describes a pouch shape, follow it; otherwise infer a plausible pouch consistent with the colors and typography on the 2D sheet.
- Front face artwork must match the reference (logo, titles, color blocks) with correct perspective and specular highlights on foil or matte film.
- Floating or standing product shot on clean white #FFFFFF backdrop; crisp edges; stable, repeatable look.

Single square image.`,
  },
  {
    label: "③ 3D 另一视角 / 组合",
    prompt: `From the same flat 2D packaging manuscript reference, produce a SECOND stable 3D packaging view that feels like a sibling shot to a hero pack render.

Choose ONE coherent variant:
- alternate camera angle (lower three-quarter OR top-down), OR
- two identical units slightly staggered showing depth, OR
- box + pouch together in one frame if both appear in the flat layout.

Keep fonts, Pantone-like colors, and logo lockups faithful to the 2D source. White seamless studio background; professional packshot lighting.

Single square image.`,
  },
  {
    label: "④ 场景陈列 · 多包装",
    prompt: `Using the SAME 2D packaging artwork as brand reference, create a premium LIFESTYLE packshot: several finished 3D units (pouches and/or small boxes) naturally scattered on a bright white reflective surface—like an Amazon-ready group product photo.

Rules:
- Every visible 3D item must carry the SAME graphics/color system as the flat reference (no random redesign).
- Natural overlaps and soft shadows; high clarity; no human model.
- Cohesive “stable series” look suitable next to the other renders from this batch.

Single square photorealistic image.`,
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
    case "flat_to_3d_packaging":
      return FLAT_TO_3D_PACKAGING_PROMPTS;
    case "model_tryon":
    case "accessory_tryon":
      return [];
  }
}
