export type GenerationMode =
  | "extract_ten_grid"
  | "complete_single_grid"
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
    value: "extract_ten_grid",
    label: "白底栅格 · 仅抠出已有甲片",
    description:
      "从一张图里识别并抠出已出现的甲片，摆成 2×5 白底；不发明新款式。不足 10 枚则空位留白。仅 EXIF 转正，不整图强制 180°。",
  },
  {
    value: "complete_single_grid",
    label: "白底栅格 · 单枚/少量补全至10枚",
    description:
      "适合单枚或少量甲片：服务端先整图转 180° 指尖朝下，由模型按同款补满 10 格。拇指最大、中指第二大、食名约等大、小指最小；甲根同线、间距紧凑。",
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
      "每枚上传后先转 180° 甲尖朝下再拼图（格间缝已压紧）。拇指最大、中指第二大、食名约等大、小指最小；甲根同线。拼参考图后送模型出白底栅格。",
  },
];

export function parseGenerationMode(raw: FormDataEntryValue | null): GenerationMode {
  const s = typeof raw === "string" ? raw.trim() : "";
  if (s === "complete_grid") return "complete_single_grid";
  if (
    s === "extract_ten_grid" ||
    s === "complete_single_grid" ||
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
  return "extract_ten_grid";
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

INPUT ORIENTATION — ten singles pipeline:
- Each cell image was **server-rotated** (EXIF + **180°**) so **tip points down, cuticle up** before collage. Keep **tips down** in the final packshot — never flip cells tips-up.

ANATOMICAL GRID MEANING (both rows; columns 1→5 = thumb → index → middle → ring → pinky):
- **Thumb (left):** largest. **Middle (center column):** second largest. **Index and ring:** **about equal** size (±5–8%), both smaller than middle, both larger than pinky. **Pinky (right):** smallest. Match real-hand proportions — **not** a simple linear shrink from column 1 to 5.
- Achieve sizing only by **uniform per-nail scaling** inside each cell — **never** swap which design sits in which column.
- Top row (slots 1–5) and bottom row (slots 6–10) share the **same** column semantics (slots 1 & 6 = thumb … slots 5 & 10 = pinky).

LAYOUT + LOOK:
- Pure white **#FFFFFF** background; strict modular **2×5**; **minimal gutters** — only the thinnest #FFFFFF gap between adjacent nails (and between the two rows) so they read as separate pieces but **do not** leave wide white bands; maximize nail area in the frame.
- The draft reference was **server-built** so that in **each horizontal row**, the **cuticle / top (proximal) edge** of every nail lies on the **same horizontal line** — **not** the bottom tips. Preserve that **top-edge** alignment in your output; **never** re-compose so tips share a line while cuticles staircase.
- Columns must align vertically across both rows (no staircase offset).
- Each nail: long axis vertical, **0°** yaw in the plane, **horizontally centered** in its column; crisp cutout edges; remove stray background, skin, props from the reference cells.
- Preserve all artwork, gloss, chrome, glitter, 3D charms with **high input fidelity** — no invented patterns.
- Soft even studio light; optional tiny uniform contact shadow only.

FINAL CHECK:
- No digit badges or label boxes remain in the output.
- Slot 1 art is still top-left; slot 10 still bottom-right.
- Each row still follows: thumb largest → middle second → index ≈ ring → pinky smallest; do not collapse index/ring to one tiny and one huge.

Return **ONE** square high-resolution product-ready image.`;

/** 从实拍/产品图只抠已出现的甲片，不补全、不发明 */
const EXTRACT_TEN_GRID_PROMPT = `Edit the provided reference photo of press-on / stick-on nails (display card, tray, flat-lay, hand-held set, noisy background, etc.).

GOAL — **Extraction only:** cut out every **clearly visible** artificial nail from the source and place them on a clean **2×5** white grid. This is **NOT** a “fill to 10 with invented nails” task.

IMAGE EDITING TASK:
1) Identify every **individual** nail tip that is **unambiguously** visible. Ignore skin, fingers, printed text, logos, packaging, and environment.
2) Cut out ONLY those pieces with crisp edges (no leftover card, skin, harsh cast shadows).
3) Composite onto pure **#FFFFFF** in a **2×5** modular grid. Preserve **left-to-right, top-to-bottom** reading order from the reference layout so each design lands in the correct slot — do not swap columns.

NO INVENTION (hard rule):
- If fewer than **10** nails are clearly visible: leave every **empty** cell as **solid #FFFFFF** only — no guessed nail art, no duplicates “for symmetry,” no watermark. **Never** fabricate missing nails.
- If more than 10 nails are visible, output **exactly 10** by following the dominant product layout (prefer the primary tray rows in reading order) and omit extras.

INPUT — extract_ten_grid pipeline:
- The server applied **EXIF upright only** (no automatic global **180°** on the whole upload). Still rectify **each placed nail** so **free edge points down** and **cuticle up** inside its cell.

RECTIFY GEOMETRY — DO NOT COPY CASUAL TILT FROM THE SOURCE:
- Re-pose each extracted nail upright in the grid: long axis vertical, yaw = 0° in the plane.
- **Fingertips down** per nail in each cell.（须保证指尖朝下，甲根/后缘朝上。）

UNIFORM MODULAR GRID + COLUMN ALIGNMENT:
- **2 rows × 5 columns**; columns align across rows; **minimal** gutters and slim outer margins (tight SKU look).

CELL PLACEMENT:
- Center each nail in its cell; empty cells remain blank white.

ANATOMICAL SIZE & FINGER ORDER (for filled slots; columns 1→5 = thumb → index → middle → ring → pinky when the source implies a full-hand retail layout):
- **Thumb:** largest; **middle:** second largest; **index ≈ ring** (±5–8%); **pinky:** smallest. Use uniform per-nail scale only; never swap which extracted artwork sits in which column.

ROW-WISE PROXIMAL BASELINE (mandatory — do NOT invert):
- In each row, **cuticle / TOP** edges of all **occupied** nails in that row share one horizontal line. **Do not** align bottom tips to a line.

E-commerce studio light; optional minimal uniform contact shadow; preserve sparkle/chrome fidelity from the originals.

Return a single square product-ready image.`;

/** 单枚或少量甲片，补满 10 格（可发明同款空位） */
const COMPLETE_SINGLE_GRID_PROMPT = `Edit the provided reference photo of press-on / stick-on nails (they may sit on a display card, be held by a hand, or appear on a noisy background).

GOAL — output must read like a machine-placed Amazon/Taobao SKU packshot: orthographic front view, not a casual re-photo of the messy layout.

IMAGE EDITING TASK:
1) Identify every individual artificial nail tip in the photo. Ignore human skin, fingers, display card, printed text, logos, packaging, and environment.
2) Cut out ONLY the nail pieces with crisp, clean edges (no leftover card, skin, harsh cast shadows, or background texture).
3) Composite them onto a new canvas with a pure solid white background (#FFFFFF only).

LOCKED READING ORDER (do not permute designs):
- If the source shows a 2×5 card or tray, map nails to the output grid in the SAME left-to-right, top-to-bottom order as they appear on that card: top-row slot 1 = leftmost nail of the top row in the reference, etc. A distinctive design on “reference column 2” MUST land in output column 2 of that row — never shift it to column 3 or 4.
- If nails are scattered or one hand holds the set, order them consistently (e.g. by the reference’s implied product layout); do NOT re-sort columns in a way that swaps which artwork sits where.

INPUT ORIENTATION — complete_single_grid pipeline:
- The uploaded image has already been **server-normalized**: EXIF upright, then **180°** so **free edge (tip) points toward the BOTTOM** of the frame and **cuticle / proximal edge toward the TOP**. Your output must **keep** this tip-down convention — **never** flip the whole composition back to tips-up.

RECTIFY GEOMETRY — DO NOT COPY CASUAL TILT FROM THE SOURCE:
- Even if nails in the reference photo are tilted, overlapping, or unevenly spaced, the OUTPUT must IGNORE that geometry. Re-pose each extracted nail as if placed on a drafting table: long axis parallel to the canvas vertical, yaw = 0° in the image plane (no diagonal lean, no “dynamic” tilt, no Dutch angle).
- **Fingertips down:** the free edge (distal tip) of every nail must point toward the **bottom** of the frame; the cuticle / proximal (back) edge toward the **top**.（须保证指尖朝下，甲根/后缘朝上。）
- Do NOT preserve the reference’s random rotations “for realism” — commercial grids require rectified, upright nails only.

UNIFORM MODULAR GRID + COLUMN ALIGNMENT:
- EXACTLY 10 tips in 2 rows × 5 columns. Imagine five invisible vertical columns spanning BOTH rows: the center of column k in the top row MUST align with the center of column k in the bottom row (same x-position per column). The two rows share one rigid column grid — no horizontal drift or “staircase” offset between rows.
- **Tight spacing (priority):** horizontal gap between each adjacent nail in a row and vertical gap between the two rows must be **as small as possible** — hairline-to–few-pixels white only, **never** generous “catalog air” gutters. Outer margins around the whole 2×5 block should also be **slim** so the set fills the canvas. Still mechanically even (same tiny gutter everywhere).

CELL PLACEMENT:
- Center each nail inside its cell. Equal perceived cell width per column (allow only uniform scale per nail to vary footprint). Nails may sit **close** to neighbors as long as edges do not visually merge; do not pad with extra white just for “breathing room.”

ANATOMICAL SIZE & FINGER ORDER (both rows — realistic hand; columns 1→5 = thumb → index → middle → ring → pinky):
- **Thumb (column 1):** largest width and length in the row.
- **Middle finger (column 3):** **second largest** — clearly smaller than thumb, clearly larger than index, ring, and pinky.
- **Index (column 2) and ring (column 4):** **approximately equal** overall footprint (within ~5–8%); both smaller than middle; both larger than pinky. Do NOT make one dramatically larger than the other unless the source artwork alone forces it.
- **Pinky (column 5):** smallest in the row.
- Achieve sizing ONLY by uniform per-nail scale inside each cell — never swap which cutout occupies which column.

ROW-WISE PROXIMAL BASELINE (mandatory — do NOT invert):
- In **each** horizontal row, the **TOP** of every nail plate — the **cuticle / proximal / rounded root edge** (opposite the pointed free tip when tips point **down**) — must lie on **one shared horizontal line** across the five nails.
- **FORBIDDEN:** aligning the **bottom pointed tips** to a straight line (that creates a “staircase” cuticle line and is wrong). The **free tips may end at different heights**; only the **upper / cuticle** row must be ruler-straight.

5) If fewer than 10 nails are clearly visible, invent additional matching press-ons for empty slots only; invented nails must follow the **same** finger column order and size rules above.
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
- **Tight modular grid:** equal **minimal** horizontal gutters (as small as still readable), equal **minimal** vertical gutter between rows, slim outer margins — ten nails should feel **packed** on white, not floating in lots of empty space.
- NO tilt: every nail axis-aligned vertical (0° rotation), centered in cell.
- If a 2×5 grid: columns = thumb, index, middle, ring, pinky — **thumb largest, middle second largest, index ≈ ring (equal within ~8%), pinky smallest**; same per row. Per-nail scale only; never swap slots.

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
- LOCK the sequence of designs to match the reference layout (no column swaps). **Minimal** gutters between nails and rows; each nail perfectly vertical (no rotation). Per row: thumb largest, middle second, index ≈ ring, pinky smallest; align **cuticle / TOP** edges on one horizontal line per row — **not** the bottom tips.
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
    case "extract_ten_grid":
      return [
        {
          prompt: EXTRACT_TEN_GRID_PROMPT,
          label: GENERATION_MODE_OPTIONS.find((o) => o.value === "extract_ten_grid")!.label,
        },
      ];
    case "complete_single_grid":
      return [
        {
          prompt: COMPLETE_SINGLE_GRID_PROMPT,
          label: GENERATION_MODE_OPTIONS.find((o) => o.value === "complete_single_grid")!.label,
        },
      ];
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
