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
      "10 格逐张上传或一次选满 10 张；每格可单独替换/删除。服务端拼成 2×5 参考图后生成纯白底栅格。顺序与格子一致：每行左起拇指（最大）→ 右端小指（最小）。",
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

/** 单张「2×5 拼图参考图」→ 输出一张干净白底商品栅格（images.edit 单图） */
export const TEN_SINGLES_COLLAGE_REF_PROMPT = `You receive **ONE** reference image. It is a **draft 2×5 grid** (2 horizontal rows, 5 columns) on **white**, reading **left → right**, **top row first**: positions **1–5** are the **top** row (left = slot 1 … right = slot 5), then positions **6–10** are the **bottom** row (left = slot 6 … right = slot 10).

Each cell contains ONE press-on nail artwork. Small **digit badges (1–10)** may sit in a cell corner — the digit equals that cell’s **slot index**. Those badges are **layout metadata only**; your **final image must NOT** show these badge graphics anywhere (no digits, no white label boxes from the reference). Re-extract each nail’s art cleanly.

TASK — premium Amazon / Taobao **single-sheet** packshot from this collage reference:

CRITICAL (failure if violated):
- **Pixel slot fidelity:** the artwork that appears in reference **top-left** MUST end up in **output top-left** only; same for every slot through **bottom-right**. Never swap, mirror, or re-sort cells for aesthetics.

ANATOMICAL GRID MEANING — thumb largest left, pinky smallest right (both rows):
- Treat the 2×5 layout as **two hands** in standard product order: **left column = thumb**, **right column = pinky**, and **columns 2→3→4 = index → middle → ring** between them.
- **Within each row**, nail plate **width and overall footprint should decrease gently from column 1 to column 5** (thumb **slightly** largest, pinky **slightly** smallest — subtle SKU gradient, not extreme size jumps). Achieve this only by **uniform per-nail scaling** inside each cell — **never** swap which design sits in which column.
- Top row (slots 1–5) and bottom row (slots 6–10) share the **same left-to-right finger semantics** (slot 1 & 6 = thumbs at the **left**; slot 5 & 10 = pinkies at the **right**).

LAYOUT + LOOK:
- Pure white **#FFFFFF** background; strict modular **2×5**; **narrow fixed gutters** between neighbors (minimal white sliver, tight catalog look, not wide spacing).
- The draft reference was **server-built** so that in **each horizontal row**, the **proximal / cuticle (back) edge** of every nail lies on the **same horizontal line** (shared Y per row). This baseline is **mandatory**: preserve that **exact same row-wise horizontal alignment** in your output — do **not** vertically shift any nail to “even out” tips or for aesthetics; breaking the shared cuticle line is a failure.
- Columns must align vertically across both rows (no staircase offset).
- Each nail: long axis vertical, **0°** yaw in the plane, **horizontally centered** in its column; crisp cutout edges; remove stray background, skin, props from the reference cells.
- Preserve all artwork, gloss, chrome, glitter, 3D charms with **high input fidelity** — no invented patterns.
- Soft even studio light; optional tiny uniform contact shadow only.

FINAL CHECK:
- No digit badges or label boxes remain in the output.
- Slot 1 art is still top-left; slot 10 still bottom-right.
- Each row still reads thumb (slightly largest, left) → pinky (slightly smallest, right); keep the gentle size step-down without harsh jumps.

Return **ONE** square high-resolution product-ready image.`;

const COMPLETE_GRID_PROMPT = `Edit the provided reference photo of press-on / stick-on nails (they may sit on a display card, be held by a hand, or appear on a noisy background).

GOAL — output must read like a machine-placed Amazon/Taobao SKU packshot: orthographic front view, not a casual re-photo of the messy layout.

IMAGE EDITING TASK:
1) Identify every individual artificial nail tip in the photo. Ignore human skin, fingers, display card, printed text, logos, packaging, and environment.
2) Cut out ONLY the nail pieces with crisp, clean edges (no leftover card, skin, harsh cast shadows, or background texture).
3) Composite them onto a new canvas with a pure solid white background (#FFFFFF only).

LOCKED READING ORDER (do not permute designs):
- If the source shows a 2×5 card or tray, map nails to the output grid in the SAME left-to-right, top-to-bottom order as they appear on that card: top-row slot 1 = leftmost nail of the top row in the reference, etc. A distinctive design on “reference column 2” MUST land in output column 2 of that row — never shift it to column 3 or 4.
- If nails are scattered or one hand holds the set, order them consistently (e.g. by the reference’s implied product layout); do NOT re-sort columns in a way that swaps which artwork sits where.

RECTIFY GEOMETRY — DO NOT COPY CASUAL TILT FROM THE SOURCE:
- Even if nails in the reference photo are tilted, overlapping, or unevenly spaced, the OUTPUT must IGNORE that geometry. Re-pose each extracted nail as if placed on a drafting table: long axis parallel to the canvas vertical, yaw = 0° in the image plane (no diagonal lean, no “dynamic” tilt, no Dutch angle).
- **Fingertips down:** the free edge (distal tip) of every nail must point toward the **bottom** of the frame; the cuticle / proximal (back) edge toward the **top** — never flip tips upward.（须保证指尖朝下，甲根/后缘朝上。）
- Do NOT preserve the reference’s random rotations “for realism” — commercial grids require rectified, upright nails only.

UNIFORM MODULAR GRID + COLUMN ALIGNMENT:
- EXACTLY 10 tips in 2 rows × 5 columns. Imagine five invisible vertical columns spanning BOTH rows: the center of column k in the top row MUST align with the center of column k in the bottom row (same x-position per column). The two rows share one rigid column grid — no horizontal drift or “staircase” offset between rows.
- Identical horizontal gutter between every adjacent pair within a row; identical vertical gutter between row 1 and row 2; symmetric equal margins left/right/top/bottom around the whole 2×5 block — mechanically even, like Figma auto-layout or Excel merged cells, NOT organic hand-scattered spacing.

CELL PLACEMENT:
- Center each nail inside its cell. Equal perceived cell width per column (allow only uniform scale per nail to vary footprint). No nail may protrude into a neighbor’s gutter in a way that breaks even spacing.

ANATOMICAL SIZE RULE (thumb → pinky per row):
- Within EACH row, left to right, nail plate WIDTH and LENGTH decrease monotonically (thumb largest, pinky smallest). Column 4 must not appear wider than column 3; keep the step-down smooth.
- Achieve sizing ONLY by uniform per-nail scale inside the cell — never swap which cutout occupies which column.

5) If fewer than 10 nails are clearly visible, invent additional matching press-ons for empty slots only; invented nails respect the size gradient and column order logic above.
6) E-commerce studio look: soft even light; no props, no watermark, no busy shadows; optional minimal uniform contact shadow acceptable if identical under every nail.
7) Finish & sparkle fidelity: If the reference nails include chrome, foil, glitter, glass shine, iridescence, or other “jewelry-like” brilliance, carry that same sparkling / reflective quality into the final grid — specular accents and micro-glints should still read as lively and true to the originals; avoid accidental dull-down of intentional shine.

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
- LOCK order: preserve the same left-to-right, top-to-bottom sequence of designs as on the reference card/tray — do not permute columns so distinctive patterns jump to wrong slots.
- UNIFORM spacing: equal horizontal gutters between all neighbors in a row, equal vertical gutter between rows, even margins (modular grid).
- NO tilt: every nail axis-aligned vertical (0° rotation), centered in cell.
- Each row: thumb→pinky monotonic width decrease left to right; use per-nail scale only, never swap slots.

Preserve each nail’s artwork, colors, and 3D/metallic details with high fidelity (input_fidelity intent).

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
- Camera looking straight down; nails in a strict 2×5 modular grid if a 10-piece set is implied.
- LOCK the sequence of designs to match the reference layout (no column swaps). Equal gutters everywhere; each nail perfectly vertical (no rotation). Thumb→pinky monotonic size per row using scale only.
- Macro clarity on textures.

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
