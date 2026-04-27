export type GenerationMode =
  | "complete_grid"
  | "multi_angle"
  | "packaging_mockup"
  | "flat_to_3d_packaging"
  | "model_tryon"
  | "accessory_tryon"
  | "ten_singles_grid";

export const GENERATION_MODE_OPTIONS: {
  value: GenerationMode;
  label: string;
  description: string;
}[] = [
  {
    value: "complete_grid",
    label: "白底栅格 · 自动补全至10枚",
    description:
      "从实拍抠出甲片，纯白底 2×5；不足10枚时补全。每行五枚须符合真实指位：左起拇指最大、右端小指最小，中间三指递减。",
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
    label: "指甲 × 饰品 · 手模试戴广告图",
    description:
      "上传美甲产品图与饰品参考图（如戒指）。生成一张广告级成片：由模型生成自然的手部，甲片与饰品同时戴在这只手上，适合社媒/电商主图。",
  },
  {
    value: "ten_singles_grid",
    label: "十枚单甲 → 一张白底合集",
    description:
      "一次上传 10 张「单枚甲片」照片，合成一张纯白底 2×5 产品栅格图；每行五枚遵循拇指最大、小指最小的真实比例感。",
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
    s === "ten_singles_grid" ||
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

/** 需一次上传 10 张单枚甲片（表单字段名 `nail`，可重复 append） */
export function requiresTenSingleNails(mode: GenerationMode): boolean {
  return mode === "ten_singles_grid";
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
1) FIRST image: ACCESSORY / jewelry PRODUCT references — typically rings (or bracelets) shown on a finger, on white, or as clean packshot crops. One image may contain MULTIPLE distinct pieces (e.g. two different gold rings on different fingers).
2) SECOND image: the NAIL PRODUCT reference — press-on / stick-on nails in a sheet, card, or grid, showing EXACT nail art (colors, French tips, tiny 3D fruit charms, decals, shapes).

TASK — premium social / e-commerce “matching ad” (virtual try-on with a GENERATED hand model):
- Create ONE new photorealistic photograph of a single elegant adult HAND and forearm only (crop: no face, no torso). The hand may be fully AI-generated — it does NOT need to match any real person from the inputs.
- FINGERNAILS: apply press-on tips that faithfully reproduce EVERY nail design from the SECOND reference, in a coherent finger order (thumb → pinky) matching the product layout. Preserve all micro-details: gradients, patterns, 3D charms, gloss, and nail shape.
- JEWELRY: the hand must WEAR the exact rings/jewelry seen in the FIRST reference — same metal color, band profile, thickness, and style. If two different rings appear in the first image, place them on believable fingers (e.g. index + ring finger) like a professional styling, not floating beside the hand.
- HERO FRAMING: this is NOT a flat-lay of loose nails in a tray. The hero is a believable manicured hand wearing BOTH the nails and the jewelry together, suitable for Instagram / Taobao / Xiaohongshu hero creative.
- Lighting & set: soft beauty / commercial studio light; clean neutral or pale backdrop; optional subtle sleeve cuff (cream knit, etc.) is fine; avoid busy clutter.
- Skin must look natural; no duplicated ghost fingers; no extra random jewelry not present in the first reference.

Output a single square high-resolution photograph.`;

/** 十张单甲各一图 → 合成一张 2×5 白底栅格（多图 edit 一次） */
export const TEN_SINGLES_GRID_PROMPT = `You receive EXACTLY TEN separate input images, in fixed order from the FIRST image (index 1) through the TENTH image (index 10). Each input should depict ONE artificial press-on nail tip (or one nail plate crop), possibly on a neutral background, finger, or tool.

TASK — single composite product sheet:
1) From EACH input, isolate ONLY that one nail tip with clean, crisp edges. Remove skin, tweezers, card stock, text, and busy backgrounds.
2) Composite all TEN isolated nails onto ONE new canvas with a pure solid white background (#FFFFFF) only — no gradients, no props, no watermark, no typography.
3) Layout: exactly 2 rows × 5 columns, even spacing, centered in the frame, catalog symmetry. Placement by upload order:
   - TOP row, left to right = nails from inputs 1, 2, 3, 4, 5 in that order.
   - BOTTOM row, left to right = nails from inputs 6, 7, 8, 9, 10 in that order.
4) ANATOMICAL SIZE GRADIENT (each row = one hand, thumb → pinky left to right): Within EACH row of five, the leftmost nail must read as THUMB (largest width/length), the rightmost as PINKY (smallest), with the three middle nails stepping down smoothly. You MAY uniformly scale and slightly rotate each placed nail within its cell so this graduation looks natural EVEN IF the source photos were similar sizes. Do not swap which source image goes into which column — keep the 1→5 and 6→10 mapping; only adjust scale/position/rotation inside the cell for believable proportions.
5) Preserve every nail’s artwork, colors, gloss, chrome, tiny 3D charms, and French edges with high fidelity to its source image (input_fidelity intent). Do not invent a different design for any slot.
6) E-commerce studio lighting: soft, even; optional very subtle contact shadow only.

Return ONE single square high-resolution product-ready image.`;

const COMPLETE_GRID_PROMPT = `Edit the provided reference photo of press-on / stick-on nails (they may sit on a display card, be held by a hand, or appear on a noisy background).

IMAGE EDITING TASK:
1) Identify every individual artificial nail tip in the photo. Ignore human skin, fingers, display card, printed text, logos, packaging, and environment.
2) Cut out ONLY the nail pieces with crisp, clean edges (no leftover card, skin, harsh cast shadows, or background texture).
3) Composite them onto a new canvas with a pure solid white background (#FFFFFF only).
4) Arrange EXACTLY 10 nail tips in a perfectly regular grid of 2 rows × 5 columns (two rows, five columns), equal spacing, centered in the frame. Each nail upright/natural orientation. Preserve original colors, finishes, and nail-art details for every nail that exists in the source.
   ANATOMICAL SIZE RULE (each row = one hand, thumb → pinky left to right): Within EACH row of five, reading left to right, nail plate WIDTH and LENGTH must decrease monotonically — the leftmost nail is the THUMB (largest and widest), the rightmost is the PINKY (smallest and narrowest). The three middle nails step down realistically between them. Apply this rule to BOTH rows (one hand per row). When you invent missing nails, assign sizes and shapes so the finished grid obeys this real-world press-on sizing convention, not five equal-sized copies.
5) If fewer than 10 nails are clearly visible in the source, you MUST invent additional matching press-on nails to reach exactly 10: keep the same collection aesthetic (palette, motifs, chrome/3D accents, illustration style) so the added nails look like they belong to the same product set. Do not leave empty slots. Invented nails MUST respect the thumb→pinky size gradient above in whichever columns you place them.
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
- If the reference implies a full set, show up to 10 nails in a clean 2 rows × 5 columns grid; otherwise show every distinct nail from the reference in a tidy layout. When using two rows of five, each row must follow real sizing: leftmost = thumb (largest/widest), rightmost = pinky (smallest/narrowest), with a smooth decrease across the middle three fingers.
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
- Camera looking straight down; nails arranged neatly (2×5 grid if a 10-piece set is implied). In each row of five, enforce thumb-to-pinky size graduation left to right (thumb largest, pinky smallest).
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
    case "ten_singles_grid":
      return [];
  }
}
