export type GenerationMode =
  | "extract_ten_grid"
  | "extract_angle_scattered"
  | "white_grid_rectify"
  | "complete_single_grid"
  | "multi_angle"
  | "packaging_mockup"
  | "flat_to_3d_packaging"
  | "nails_in_box"
  | "model_tryon"
  | "accessory_tryon"
  | "ten_singles_grid";

export type GenerationModeGroupId = "white_grid" | "tryon" | "packaging";

export const GENERATION_MODE_OPTIONS: {
  value: GenerationMode;
  label: string;
  /** 卡片 / 列表主标题（短） */
  shortLabel: string;
  description: string;
  /** 一句话：适合什么图 */
  whenToUse: string;
}[] = [
  {
    value: "extract_ten_grid",
    label: "白底栅格 · 仅抠出已有甲片",
    shortLabel: "规整实拍 · 抠图排版",
    whenToUse: "背卡、托盘、较正的 2×5 或平铺，甲片大致对齐",
    description:
      "从实拍/背卡识别并抠出已出现的甲片，摆成 2×5 白底；不补款。优先**保持每枚甲片的甲型与长短大小**与源图一致，仅做竖直摆正（yaw=0°）与栅格留白；可选完整「白底栅格排版」（含五列相对宽）写入提示词。每次并行生成 **2 张**供择优。仅 EXIF 转正，不整图强制 180°。",
  },
  {
    value: "extract_angle_scattered",
    label: "白底栅格 · 斜拍散落抠图",
    shortLabel: "斜拍 / 散落 · 抠图排版",
    whenToUse: "对角两排、多枚散落、各枚倾斜角度不一的实拍",
    description:
      "专为 **angle shot / loose shot**：对角排布或多枚散落、各枚平面内倾斜不一。逐枚拆层抠出 → 刚性旋转至竖直 → 排成 2×5 白底；**不补款**、不改甲型。弱化整图扶正，避免漏枚与列错位。每次并行 **2 张**择优。",
  },
  {
    value: "white_grid_rectify",
    label: "白底栅格 · 几何矫正（二次）",
    shortLabel: "已有 2×5 · 二次矫正",
    whenToUse: "已是白底 2×5，只需摆正、调缝，不再从实拍抠",
    description:
      "专用于已生成的 **2×5 白底图**：把 10 格当作**独立图层拆掉整版重排**（非整图扶正），**不改变**各格甲型与长短，仅**刚性旋转至竖直（yaw=0°）**+ 平移，并用**外留白、列缝、行间缝**控距（附录不含列宽缩放）。每次并行 **2 张**择优；可与「转为投喂图片」衔接。",
  },
  {
    value: "complete_single_grid",
    label: "白底栅格 · 单甲补齐10支",
    shortLabel: "单枚款式 · 复制 10 格",
    whenToUse: "一张图里 mainly 一枚代表款，要补满 10 格同款",
    description:
      "约定上传**甲尖朝下**的单枚（或含一枚主款）照片；服务端仅 **EXIF 转正**（不整图 180°）后送模型高清抠出一枚，再由服务端按五列**相对宽度**复制成 2×5 白底栅格以体现拇→小的尺码差。**可选**：「白底栅格排版」调节五列宽、外留白与列/行缝。",
  },
  {
    value: "ten_singles_grid",
    label: "十枚单甲 → 一张白底合集",
    shortLabel: "10 个文件 · 拼合集",
    whenToUse: "已备好 10 张单枚文件，每格一枚",
    description:
      "每枚仅 **EXIF 转正**（不整图 180°）后拼成一张 2×5 参考图送模型出白底栅格；朝向与上传一致。**可选**：「白底栅格排版」调节五列宽、外留白、列缝/行缝；服务端会归一列宽并甲根对齐，缝过大时整行自动缩小以适配画布。提示词强调**保持各格甲型与长短**，竖直摆正与留白为主。",
  },
  {
    value: "multi_angle",
    label: "多角度上手图（固定4张）",
    shortLabel: "上手图 · 固定 4 张",
    whenToUse: "已有款式图，要生成 4 种棚拍上手角度",
    description:
      "固定 **4 张**、同一只手、同一棚拍。① **整手正视主图**（甲面可读）。② **指尖朝镜 cup-forward 特写**（指尖与立体厚度）。③ **侧沿指列 traverse macro**（沿尺侧或桡侧扫过指列，看 C-curve 与叠压透视）。④ **斜俯视半侧上手**（高机位约 ¾，强调指节弧与纵深，禁止与①同轴微调）。白底、光影、肤色、款式一致；小花等点缀严格按背卡列位。禁止双掌、反关节、蜡皮假肤。",
  },
  {
    value: "packaging_mockup",
    label: "包装盒 + 手握实拍",
    shortLabel: "手握包装盒",
    whenToUse: "产品图 + 握姿参考，生成手握盒装图",
    description:
      "需双图：① 产品图；② 握姿参考。开窗内背卡可与参考一致（含甲尖朝下排版）。**仅手上穿戴**：每枚须在立体上与**解剖游离缘**对齐（法式/豹纹在真指尖），勿把背卡像素的上下直接贴到皮肤；拇指仅用第1列款。",
  },
  {
    value: "flat_to_3d_packaging",
    label: "2D 文稿 → 3D 开窗盒装主视图",
    shortLabel: "2D 稿 → 3D 盒装",
    whenToUse: "平面稿 + 摄影参考，出立体开窗盒主图",
    description:
      "双图：① 2D 包装平面稿（盒面印刷、色值、Logo、窗内甲片示意**均以稿为准**）；② 摄影/3D **氛围参考**（取景、光影、白底投影）。**只输出 1 张**立体开窗盒；窗内甲片与外盒图文须来自①，勿照搬②上的竞品品牌与甲片款式（服务端将②先于①送模型以抑制「抄成参考图」）。",
  },
  {
    value: "nails_in_box",
    label: "开窗盒装 · 甲片入盒效果图",
    shortLabel: "款式 + 盒型 · 入盒",
    whenToUse: "款式图 + 包装盒参考，窗内替换为你的甲片",
    description:
      "双图：① 美甲款式/甲片产品图（窗内**只**用这一套；**甲型与图案逐枚保真**）；② 包装盒参考（**盒比例、Logo 与盒面文字须与②一致**，勿改样式）。窗内**同一行左右紧挨**、**上下两排之间也无空隙**（勿把参考里两排之间的字标当成留白）；若参考开窗里已是别的甲片，**成品整窗替换为①**。可选**竖向双列**或**横向 2×5**。**每次提交并行 2 路**（方案 A/B）；两路皆成则 **2 张**备选，仅一路成则返回 **1 张**。",
  },
  {
    value: "model_tryon",
    label: "指甲 × 模特 · 精准试戴",
    shortLabel: "模特试戴",
    whenToUse: "产品图 + 模特图，换指甲款式",
    description:
      "需同时上传「美甲产品图」与「模特图」。**美甲产品图约定：**每枚甲片**甲尖朝下**、每行**从左到右 = 大拇指 → 小指**；合成到模特手上时须**逐格还原**款式（色、纹、法式线、饰品与甲型），勿左右对调或整片戴反。尽量保持模特姿态、肤色、光线与背景不变。",
  },
  {
    value: "accessory_tryon",
    label: "指甲 × 饰品 · 手模试戴广告图",
    shortLabel: "饰品 + 手模广告",
    whenToUse: "产品图 + 戒指等饰品参考",
    description:
      "上传美甲产品图与饰品参考图（如戒指）。**美甲产品图约定：**甲尖朝下、每行从左到右大拇指至小指；成片手模上的指甲须与产品图**严格一致**（花色、渐变、法式、立体装饰逐指对齐），甲根朝指根、指尖朝游离缘。生成广告级手模+饰品+甲片主图，适合社媒/电商。",
  },
];

export const GENERATION_MODE_GROUPS: {
  id: GenerationModeGroupId;
  title: string;
  subtitle: string;
  modes: GenerationMode[];
}[] = [
  {
    id: "white_grid",
    title: "白底商品图",
    subtitle: "抠图、排版、十枚合集",
    modes: [
      "extract_ten_grid",
      "extract_angle_scattered",
      "white_grid_rectify",
      "complete_single_grid",
      "ten_singles_grid",
    ],
  },
  {
    id: "tryon",
    title: "上手 / 试戴",
    subtitle: "模特、饰品、多角度棚拍",
    modes: ["multi_angle", "model_tryon", "accessory_tryon"],
  },
  {
    id: "packaging",
    title: "包装 / 盒装",
    subtitle: "手握、2D 转 3D、开窗入盒",
    modes: ["packaging_mockup", "flat_to_3d_packaging", "nails_in_box"],
  },
];

export function generationModeOption(value: GenerationMode) {
  const opt = GENERATION_MODE_OPTIONS.find((o) => o.value === value);
  if (!opt) throw new Error(`Unknown generation mode: ${value}`);
  return opt;
}

/** 提交时可带白底栅格列宽 / 留白 / 列缝参数 */
export function modeUsesWhiteGridFormFields(mode: GenerationMode): boolean {
  return (
    mode === "complete_single_grid" ||
    mode === "extract_ten_grid" ||
    mode === "extract_angle_scattered" ||
    mode === "white_grid_rectify"
  );
}

/** 页面展示「白底栅格排版」面板 */
export function modeShowsWhiteGridLayoutPanel(mode: GenerationMode): boolean {
  return (
    mode === "ten_singles_grid" ||
    mode === "complete_single_grid" ||
    mode === "extract_ten_grid" ||
    mode === "extract_angle_scattered" ||
    mode === "white_grid_rectify"
  );
}

/** 并行 2 路抠图 / 矫正，结果区 2 列展示 */
export function modeUsesParallelDualVariants(mode: GenerationMode): boolean {
  return (
    mode === "extract_ten_grid" ||
    mode === "extract_angle_scattered" ||
    mode === "white_grid_rectify"
  );
}

/** 从一张实拍抠多枚并排 2×5 */
export function modeIsPhotoExtractToGrid(mode: GenerationMode): boolean {
  return mode === "extract_ten_grid" || mode === "extract_angle_scattered";
}

export function parseGenerationMode(raw: FormDataEntryValue | null): GenerationMode {
  const s = typeof raw === "string" ? raw.trim() : "";
  if (s === "complete_grid") return "complete_single_grid";
  if (
    s === "extract_ten_grid" ||
    s === "extract_angle_scattered" ||
    s === "white_grid_rectify" ||
    s === "complete_single_grid" ||
    s === "multi_angle" ||
    s === "packaging_mockup" ||
    s === "flat_to_3d_packaging" ||
    s === "nails_in_box" ||
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
export type DualUploadKind =
  | "model"
  | "accessory"
  | "packaging_pose"
  | "packaging_3d_ref"
  | "nails_box";

export function getDualUploadKind(
  mode: GenerationMode,
): DualUploadKind | null {
  if (mode === "model_tryon") return "model";
  if (mode === "accessory_tryon") return "accessory";
  if (mode === "packaging_mockup") return "packaging_pose";
  if (mode === "flat_to_3d_packaging") return "packaging_3d_ref";
  if (mode === "nails_in_box") return "nails_box";
  return null;
}

/** 开窗盒内甲片排列：竖向双列（橱窗式）或横向 2×5 栅格 */
export type NailsInBoxArrangement = "vertical" | "horizontal";

export function parseNailsInBoxArrangement(
  raw: FormDataEntryValue | null,
): NailsInBoxArrangement {
  const s = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  if (s === "horizontal" || s === "h" || s === "rows") return "horizontal";
  return "vertical";
}

/** 需一次上传 10 张单枚甲片（表单字段名 `nail`，可重复 append） */
export function requiresTenSingleNails(mode: GenerationMode): boolean {
  return mode === "ten_singles_grid";
}

/**
 * 凡「白底上的 2×5 / 单行五列」商品甲片栅格，提示词统一强调：
 * 左拇最大 → 中指第二大 → 食指与无名指约等大 → 右小指最小；每行甲根顶线一条水平线。
 * （与十枚单甲服务端拼图、抠图、补全等流程对齐，仅靠提示约束模型。）
 */
export const WHITE_BG_NAIL_GRID_FINGER_LADDER = `FINGER-SIZE LADDER (mandatory for any press-on nails shown in a **left-to-right retail row or 2×5 white grid**; columns 1→5 = thumb → index → middle → ring → pinky):
- **Subtle real-hand band (critical):** differences between **adjacent** columns must stay **gentle** — like one cohesive **retail SKU sheet**, not a cartoon or toy scale-up. Thumb may be only modestly larger than pinky (think **≤~12–18%** total width spread across all five, **not** 2× or 3× jumps). Neighboring fingers should never look unrelated in size.
- **Column 1 (left) = thumb:** **Largest** — slightly wider footprint than middle, not a giant plate.
- **Column 3 (center) = middle finger:** **Second largest** — close to thumb, clearly above index/ring, clearly above pinky.
- **Columns 2 and 4 = index and ring:** **About equal** (within a few %); both between middle and pinky.
- **Column 5 (right) = pinky:** **Smallest** — still a normal adult nail, not a sliver.
Achieve this with **uniform per-nail scaling inside each cell only**; **never** swap which artwork sits in which column.
- **Source-faithful footprints:** column-to-column width steps must **match what the source image shows** for each nail where visible — **forbidden:** independently scaling one nail (or stretching it) **solely** to force ladder fit if that diverges from the reference silhouette for that slot.
（从左到右：大拇指最大、中指第二大、食指与无名指差不多大、小指最小；但相邻指之间级差要**柔和自然**，像同一套成品甲片，不要悬殊过大。）`;

export const WHITE_BG_NAIL_GRID_TOP_BASELINE = `ROW-WISE TOP BASELINE (mandatory whenever nails form one or two **horizontal product rows** on white):
- In **each** row, the **cuticle / root / proximal TOP edge** of **every** nail in that row lies on **one shared horizontal straight line** — as if a ruler rests on top of all five nails — **not** a staircase along the tops.
- **Forbidden:** aligning the **bottom free edges (tips)** to one line while the **tops** step up/down like stairs. Tips may end at different heights; only the **top / root** line must be shared.
（每一行：所有美甲的甲根/上缘必须在同一条水平线上；禁止只对齐指尖、甲根呈阶梯。）`;

/** 白底栅格抠图 / 单甲：保真、允许修图、背景（extract + complete 共用；OUTPUT 单独常量见下） */
const PACKSHOT_FIDELITY_CLEANUP_BG_EN = `DESIGN & SHAPE FIDELITY (hard — failure if violated):
- Do **not** change nail **shape, length, C-curve, thickness, or proportions** vs each corresponding source nail.
- Do **not** alter **colour, gradients, opacity, gloss level, matte finish, or surface texture** beyond the neutral cleanup below.
- Do **not** add, remove, or modify **patterns, decals, lines, chrome, glitter distribution, or gemstones**; **no** beauty filters, **no** stylised “hero” reinterpretation.

SILHOUETTE & FREE-EDGE GEOMETRY (critical — the outline defines the sold SKU):
- Treat each nail’s **2D outer contour** (sidewalls + free edge + corner radii) as **CAD-like fidelity**: preserve **straight segments, corner angles, and tip curvature** exactly as in the source for that nail.
- **Square / squoval / “short square / new short square / medium square” family:** keep **flat or near-flat free edges** and **true corners** — **forbidden:** rounding the tip into an oval, “pill” ends, or a generic soft dome when the source shows a square profile.
- **Oval / ellipse family:** keep a **smooth symmetric elliptical arc** at the free edge — **forbidden:** sharpening into almond/stiletto or squaring off when the source is curved.
- **Almond / short almond / long almond:** preserve **side taper and pointed/soft apex** — **forbidden:** blunting into short round, medium oval, or a “balanced” generic tip.
- **Length class:** short vs medium vs long **overall extension** must match the source nail — **forbidden:** shortening or lengthening the plate to “fit” the cell or look tidier.
- **Forbidden global drift:** do **not** converge every nail toward a **single generic “pretty” nail shape** (e.g. medium oval). Each nail may look different; **match that nail’s source silhouette**, not a catalogue average.

ALLOWED IMAGE CLEANUP ONLY (subtle; no synthetic “pop”):
- Remove **dust, lint, fingerprints, glue residue, and background noise**; clean edges **without** changing nail silhouettes.
- **White balance:** neutralize casts to **true-to-life** colour — **no** creative recolour or saturation boost.
- **Clarity:** slight sharpen / dehaze only — **no halos, no painted edges, no over-sharpening**.
- **Exposure:** gentle, even correction only — **no** heavy HDR or theatrical contrast.
- Reduce **uneven lighting or colour spill** from poor photography; keep speculars and chrome **faithful** to the source (do not repaint highlights).

BACKGROUND (flat packshot):
- **#FFFFFF** or very light flat **#F7F7F7** only — **uniform**, **no** gradients, paper texture, props, or decorative backdrop shadows. If any shadow: **one minimal uniform contact shadow** under the nail pieces only — never a vignette or graded studio wash on the backdrop.`;

const PACKSHOT_OUTPUT_COMPLIANCE_EN = `OUTPUT:
- **Exactly one** photorealistic square image; **no** text, watermarks, logos, or UI. **Commercially accurate**; **avoid visible generative artefacts** (waxy plastic, double edges, pasted collage look).`;

const PACKSHOT_FAILSAFE_GRID_EN = `CONFLICT PRIORITY:
- **Rigid vertical is non-negotiable:** applying **only** rigid in-plane rotation so **every occupied nail has yaw = 0°** (long axis parallel to the frame vertical) is **mandatory** and **does not** count as “reshaping” or violating silhouette fidelity — **never** skip rotation to preserve a source slant.
- If strict grid / ladder / stagger rules would require **stretching, non-uniform scaling, shearing, or non-rigid warping** of any nail vs the source, **preserve that nail’s exact art and silhouette** and relax **only** non-destructive micro-adjustments (e.g. a few pixels of horizontal nudge) — **still** keep that nail **perfectly vertical**.
- **Never “relax” these (not optional):** (1) **yaw = 0°** for every occupied nail; (2) **shared root baseline** per row where the row has five occupied nails; (3) **mandatory tip stagger** for a full row of five — **forbidden** using this fail-safe to flatten all free edges onto one line or to drop retail stair-step tips “for neatness.”`;

const PACKSHOT_FAILSAFE_SINGLE_EN = `CONFLICT PRIORITY:
- If cleanup would **erase micro-detail** or **change the silhouette** vs the chosen source nail, **preserve fidelity** over “prettier” reconstruction — output must remain the **same SKU nail**, not an invented variant.`;

/** 2×5：拆成 10 层后整版重排（extract + rectify；禁止「整图扶正」式偷懒） */
const PACKSHOT_GRID_DECOMPOSE_RELAYOUT_EN = `FULL 2×5 RE-LAYOUT — **decompose, then re-compose** (mandatory; not optional polish):
- Treat the job as **ten independent nail layers** (slots **1–10**) on flat white — **not** one grouped product photo to nudge or globally deskew.
- **Discard** the input sheet’s **collective tilt**, uneven column gaps, and per-nail **slant** for layout purposes. **Re-place every occupied slot** on a **fresh** modular **2 rows × 5 columns** grid using **only** per-nail **rigid rotation** (→ **yaw = 0°**) + **rigid translation** + backdrop white.
- **Forbidden:** rotating, shearing, or perspective-correcting the **entire canvas** as one block; **forbidden** keeping any nail’s source **lean** because re-rotation would require more translation.
- **Vertical ruler test (every occupied slot):** the nail plate’s **long axis** must be **parallel to the frame vertical** within **≤1°** visible lean — if you can draw a diagonal through the plate’s length, **fail** and rotate again. Side walls should read as **vertical** strips, not parallelograms.
- **Column rails:** for each column **k = 1…5**, top slot **k** and bottom slot **k+5** (when both occupied) share one **vertical centerline** — both nails **0°** on that same axis.
（中文：把输入当成 **10 枚独立甲片图层** 全部 **拆掉重摆** 到 2×5 白底；禁止整图旋转扶正；每枚必须 **真正竖直**（长轴与画框竖边平行，肉眼不可歪）。）`;

/** 2×5 白底：每枚必须竖直（extract + ten_singles 共用；不可妥协） */
const PACKSHOT_GRID_VERTICAL_QA_EN = `CANVAS-VERTICAL — **ABSOLUTE REQUIREMENT (zero exceptions for occupied cells):**
- **Every occupied cell** without exception: the nail plate’s **long axis MUST be parallel to the image vertical** (**yaw = 0°** in the plane, tips-down / roots-up already satisfied). Treat **any visible tilt** (clockwise or counter-clockwise) as **QA failure** — **correct it** with rigid rotation before finishing. **There is no** “acceptable small lean.”
- **Row parity:** within **each** horizontal row, **all occupied** nails are **perfectly vertical** in the **same** direction — **forbidden:** one nail even **slightly** canted while others are straight (e.g. **only column 2 or only column 5** crooked).
- **Column pair parity:** for **2×5** pairs (**1↔6, 2↔7, 3↔8, 4↔9, 5↔10**), when both cells show product art, **top and bottom nails in that column share the same yaw** (both **0°**) — **forbidden:** vertical bottom + tilted top (or the reverse).
- **Rigid rotation only:** remove **all** source sheet / camera slant using **only** rigid in-plane rotation; **never** preserve partial tilt to “match” the photo.
- **Priority:** **yaw = 0° first** for every occupied nail. After rotation, you may apply **small rigid translations** (horizontal or vertical) to satisfy **shared root baseline** and **mandatory tip stagger** below — **never** keep non-zero yaw or source slant to “fit” those layout goals.
- **Final self-check (mandatory):** before output, scan **slots 1→10 in order** — for **each** occupied slot, imagine a **vertical line** through the plate center: the left and right sidewalls must be **mirror-symmetric** about that line; **any** clockwise/counter-clockwise lean = **re-rotate that slot only**, then re-translate. **Do not** ship until **all ten** occupied nails pass.
- **Does not cancel tip stagger:** verticality is **rotation-only**. The **mandatory free-edge stair-step** (see FREE-EDGE STAGGER block below) must **still** appear for each full row of five — achieve it by **translating each nail rigidly up/down** along the vertical (different tip Y), **never** by tilting nails or aligning all tips to one horizontal ruler line for a “clean” grid.`;

/** 2×5 白底每行五枚：甲根一条线 + 指尖阶梯（与 extract / ten_singles 对齐） */
const PACKSHOT_TIP_STAGGER_ROW_EN = `FREE-EDGE STAGGER (mandatory for each **full horizontal row of five** occupied nails on the 2×5 grid):
- **Shared root line:** all five **cuticle / proximal TOPs** on **one** ruler-straight horizontal baseline in that row.
- **Staggered tips:** **at least two clearly different** free-edge Y positions — longer plates extend **lower**, shorter end **higher** (natural retail sheet). **Unequal visible lengths are the default.** **Forbidden:** all five **tips** collinear on **one** ruler-straight horizontal line (“flat tabletop” / synthetic grid).
- **With yaw = 0°:** achieve stagger **only** by **vertical translation** of each upright nail — **never** by canted rotation, **never** by dropping stagger for neatness.`;

const NAILS_IN_BOX_VERTICAL_LAYOUT_EN = `**ARRANGEMENT — VERTICAL two-column window (user-selected; mandatory inside the clear window):**
- Show **exactly two vertical columns × five nail positions** (10 slots when the FIRST reference implies a full set). **No** third column, radial fan, or staggered “galaxy” layout.
- **Slot fill (when FIRST is a standard 2×5 sheet, left→right top row then bottom row):** **Left column** top→bottom = nails from **columns 1–5 of the top row** (thumb→pinky of that row). **Right column** top→bottom = **columns 1–5 of the bottom row**. **Do not** swap art between any two slots.
- **Per-nail pose in window:** each nail’s **long axis roughly horizontal** across the box width. **Left column:** free edge / tip toward the **left** inner edge of the window, cuticle/root toward the **vertical midline** (or support strip). **Right column:** tips toward the **right** edge, roots toward midline — symmetric boutique “butterfly” display.
- **Optional retail strips:** subtle **vertical** clear or metallic hanger strips; nails face the camera with **readable** art (printed face outward).
- **Size rhythm:** within each column use a **gentle** width increase **top→bottom** (narrower toward the top of the window, slightly wider toward the bottom) — one cohesive SKU family, not toy scaling.`;

const NAILS_IN_BOX_HORIZONTAL_LAYOUT_EN = `**ARRANGEMENT — HORIZONTAL 2×5 grid inside window (user-selected; mandatory):**
- Inside the window show **two horizontal rows × five columns** (classic press-on sheet). **Top row:** left→right = thumb→pinky; **bottom row:** left→right = same column semantics for the second row of the FIRST reference. **Never** mirror the row or shuffle columns.
- **Row-to-row (critical):** the **bottom** of the **top row’s nail plates** and the **top** of the **bottom row’s nail plates** form **one contiguous vertical stack** — **zero** wide horizontal **backing strip**, **zero** “logo / wordmark ribbon”, and **zero** empty **row gutter** **between** the two rows inside the aperture. If the SECOND reference shows a brand line **between** the two nail rows, **relocate** it to **above** the top row, **below** the bottom row, or onto the **opaque frame / sleeve outside** the nail cluster — **do not** preserve it as a spacer lane that separates the rows.
- On the backing card inside the window, nails follow **tips generally toward the bottom** of each cell; **cuticle/root tops** share a **straight horizontal baseline per row**.
${WHITE_BG_NAIL_GRID_FINGER_LADDER}

${WHITE_BG_NAIL_GRID_TOP_BASELINE}
- **Column alignment:** slots line up vertically through both rows; **pixel-faithful** art from the FIRST image per cell.`;

/** 开窗盒装·甲片入盒：盒体比例与盒面印刷（含 Logo/字）锁定参考图；窗内甲片紧排且款式保真 */
const NAILS_IN_BOX_BOX_GEOMETRY_AND_PRINT_LOCK_EN = `**BOX GEOMETRY + OUTER PRINT — LOCK TO SECOND (mandatory; failure if violated):**
- **Proportions & shell:** match the **SECOND** reference’s **overall carton aspect ratio**, **panel / lid / base proportions**, **edge breaks**, and **clear window shape + size + placement** on the face — only believable **3D perspective + lighting** vs the photo. **Forbidden:** fattening/squashing the whole box vs the reference, swapping a tall sleeve for a short cube, or noticeably rescaling the window relative to the printed face beyond mild lens correction.
- **Print fidelity:** carry over **every** visible exterior graphic from the **SECOND** image **verbatim** — **logos, logotype geometry, wordmarks, legal/micro copy, barcodes, icons, color bands** — same spelling and lockup; **forbidden** re-typesetting, inventing substitute slogans, replacing real marks with generic filler, or “cleaning up” the reference layout. **Forbidden:** stealing **unrelated** third-party trademarks from outside the user’s SECOND image.
（中文：**盒子长宽比与轮廓、开窗形状与位置**须与第二张一致，**不得改比例**；**盒面 Logo 与所有文字**须原样保留，禁止改写或换成占位内容。）`;

const NAILS_IN_BOX_WINDOW_TIGHT_AND_NAIL_FIDELITY_EN = `**WINDOW INTERIOR — NO GAPS BETWEEN NAILS (within rows AND between rows) + SKU FIDELITY (mandatory):**
- **Horizontal 2×5 — within each row:** the five plates **abut left-to-right** — **no** intentional **white/pink card gutters**, thick spacer strips, or empty bands **between** adjacent nails in that row (micro shadows / anti-alias only).
- **Horizontal 2×5 — between the two rows:** treat the **10 nails as one tight sheet**: **no** vertical **empty lane** between the upper and lower row — **forbidden** a centered logo block, slogan band, or pale backing **gap** that visually splits the two rows (even when the SECOND reference did this). **Priority:** rows **touch or nearly touch** as a single retail sheet; relocate any inner-window branding so it does **not** act as row spacing.
- **Vertical two-column:** in **each** column, the five stacked nails **abut top-to-bottom** — **no** stacked spacer blocks between neighbors; keep the two columns **tight** to the reference tray unless the **SECOND** image clearly shows a wide median strip.
- **Art + silhouette from FIRST only:** for every mapped slot, keep the **same nail outline** (length class, tip family, sidewalls, C-curve read) and **same surface art** as that slot in the **FIRST** image. **Forbidden:** non-uniform stretch/squash/shear, trimming tips to “fit,” beauty-filter redraw, or swapping motifs between slots. **Allowed:** **uniform** per-nail scale plus **small rigid** rotation/translation for natural perspective on the tray — never warp that changes pattern or shape identity.
（中文：**同一行**左右甲片紧挨；**上下两排之间也不得留空带**（不要把参考图里两排之间的 Logo 带当成留白分隔）；**美甲图案与甲型**与第一张**逐枚一致**。）`;

/**
 * 双图「款式图 + 盒样式」→ 甲片陈列于开窗盒内（竖向双列或横向 2×5）。与 API 传入顺序一致：FIRST=美甲款式，SECOND=包装盒参考。
 */
export function buildNailsInBoxPackagingPrompt(
  arrangement: NailsInBoxArrangement,
): string {
  const arrangementBlock =
    arrangement === "vertical"
      ? NAILS_IN_BOX_VERTICAL_LAYOUT_EN
      : NAILS_IN_BOX_HORIZONTAL_LAYOUT_EN;

  return `You receive TWO input images in this fixed editor order:
1) **FIRST — NAIL ART / PRODUCT SOURCE OF TRUTH:** press-on nails on a card, tray, flat-lay, or white grid — the **exact** artwork (colors, patterns, 3D chrome drips, charms, French edges, silhouettes) that must appear on every nail **visible inside the carton window**. **Zero** creative reinterpretation per nail.
2) **SECOND — PACKAGING / BOX STYLE REFERENCE:** retail box, sleeve, mockup, or photo of a windowed carton — authoritative for **box proportions**, **window geometry**, **outer print** (logos, typography, color blocks), **inner backing** texture, and **overall style**. Re-light in 3D as needed, but **do not** change the reference’s intended proportions or replace its printed copy (see lock block below).

**CRITICAL — WINDOW NAILS vs BOX SHELL (failure if violated):**
- The **SECOND** image may already show **different** press-on art inside its window (demo stock, cartoon nails, another SKU). That nail art is **NOT** the user’s target. **You must completely REPLACE** every nail **visible through the window** with the **FIRST** image’s nail designs only — mapped per the arrangement rules below. **Forbidden:** keeping, retouching, color-matching, or “merging” the nail graphics that were inside the SECOND image’s window; **forbidden:** outputting the SECOND reference’s nails as the hero product.
- Treat the **SECOND** image as supplying **cardboard / plastic window / outer print / backdrop texture / optional hand pose** only; the **interior nail pixels** are **always** sourced from the **FIRST** image.
（中文：**盒型、开窗、外盒印刷、背板质感**学第二张；**开窗里每一枚甲片的款式**必须**全部换成第一张图**里的对应甲片，禁止沿用第二张开窗里原有的美甲图案。）

${NAILS_IN_BOX_BOX_GEOMETRY_AND_PRINT_LOCK_EN}

${NAILS_IN_BOX_WINDOW_TIGHT_AND_NAIL_FIDELITY_EN}

${arrangementBlock}

TASK — one photorealistic **windowed press-on retail pack** hero (finished “nails in box” like a polished e-commerce main image):
- Output **one** new **3D-correct** slim rectangular carton whose **design language matches the SECOND reference** (re-light and re-render; do not simply flatten-image paste unless the reference is already a perfect neutral mockup).
- **Window interior:** every nail must **match the FIRST reference** for its mapped slot — same motifs, micro-detail, gloss. **Perspective** and soft shadows on curved nails are allowed; **2D motif layout** must stay recognizable per slot.
- For **horizontal 2×5**, the **two rows inside the window** must read as **one gapless sheet** — **no** horizontal **empty band or logo strip between rows** that separates them.
- **Scene:** seamless **#FFFFFF** or very light neutral studio; soft commercial lighting; crisp edges; believable cardboard thickness; optional faint ground shadow.
- **No human hands** unless the SECOND reference explicitly demands a holding crop — default **product-only**.
- If the FIRST image has **fewer than 10** distinct nails, show only those in a **compact tight layout** without invented nails — **still** no fake filler plates and **no** wide decorative gaps between the real ones.

Return **one** square high-resolution photograph only.`;
}

/**
 * 有法/深色指尖（法式、豹纹尖等）时：深色必须在解剖学**指尖**（游离缘），拇指最易反贴。
 * 与包装手握、试戴、多角度上手共用。
 */
export const DISTAL_PATTERN_AT_ANATOMICAL_FINGERTIP_EN = `DISTAL TIP DIRECTION — “DARK AT THE REAL FINGERTIP” (whenever a real hand wears press-ons; failure if violated):
- If the product art shows a **darker distal zone** (black / deep brown French band, leopard **tip**, ombré **darkening toward free edge**, chrome cap at tip, etc.), that **dark / patterned distal band must cap the anatomical free edge** — the margin of the nail plate **toward the fingertip and away from the knuckle** — on **every** visible finger **and thumb**.
- The **lighter / nude proximal zone** stays toward the **cuticle and finger base**. **Forbidden:** wearing the nail **180° flipped** so the dark band sits against the **proximal nail fold** while nude points out to the fingertip (reads as “black at the knuckle”).
- **Thumb (highest error rate):** even when the thumb is horizontal, sideways, or presses the box edge, **column-1** art must still place **distal dark art on the true thumb free margin** (the working edge toward air / opposite the palm), **not** mirrored so “tip” art hugs the thenar web.
（中文：有深色指尖时**指尖应是深色**、甲根偏浅；禁止整片戴反。拇指常错，须单独自检。）`;

/**
 * 高频错法对照 + 单遍输出前的自审锚点；接在 DISTAL 后，随 NAIL_ON_HAND 进入试戴 / 包装 / 多角度。
 */
const HAND_NAIL_ANTIPATTERNS_AND_VERIFY_EN = `COMMON FAILURE MODES vs TARGET (do not reproduce the WRONG column):
- WRONG: Thumb wears index / column-2 floral or a “prettier” hero motif. CORRECT: Thumb = **column-1** product slot only.
- WRONG: Dark leopard / French tip hugging **cuticle / knuckle** side. CORRECT: Dark distal band at **free edge toward fingertip / air** on **every** finger including thumb.
- WRONG: Flowers on thumb/middle/pinky when those reference columns are plain. CORRECT: Accents **only** on columns that have them in the sheet (e.g. index+ring if only cols 2+4 show flowers).
- WRONG: All fingers share one decorative motif. CORRECT: **Per-slot** fidelity — columns **1→5 = thumb→pinky**, no swapping or “balancing” art across columns.

MENTAL PRE-FLIGHT (single pass — internalize, then render correctly):
1. **Thumb:** distal dark/pattern on the **true free margin** (fingertip side), not the thenar/palm side.
2. **Accents:** flowers/icons only where the **reference column** has them for that finger.
3. **Orientation:** cuticle→tip on each nail matches that slot’s reference nail (no 180° wear).
4. **Map:** thumb=col1, index=2, middle=3, ring=4, pinky=5 for the active row.

（中文：对照忌拇指偷花、忌深色贴指根；花朵严守列位；四步心里过一遍再出图。）`;

/**
 * 上手戴甲：产品图左→右 = 大拇指→小指；甲根朝指根、指尖朝游离缘（款式「顶部」朝上）；严禁整片戴反或整行左右对调。
 * 用于模特试戴、饰品试戴、多角度上手、包装手握等英文提示。
 */
export const NAIL_ON_HAND_SHEET_TO_FINGER_ORDER_EN = `PRODUCT SHEET → REAL HAND — ORDER + “TOP UP” (mandatory; treat violation as failure):
- **Sheet orientation (default for user uploads in this app):** each nail is shown with the **free edge / distal tip toward the BOTTOM of the image** (甲尖朝下) and the **cuticle / proximal root toward the TOP**. When transferring to a finger, keep that same proximal→distal relationship: **root toward knuckle, tip toward anatomical fingertip** — **never** interpret the sheet as globally flipped 180° vs this layout.
- **Left → right = thumb → pinky:** on each **horizontal row** of the product reference, the **leftmost** nail maps to the **thumb**, then **index, middle, ring, pinky** toward the **right** (standard retail sheet). **Never** mirror the whole row onto the hand (e.g. do **not** assign the leftmost design to the pinky or reverse column order).
- **Two rows (10 nails):** keep **top row then bottom row** exactly as printed — **same slot → same finger role** as your pipeline’s 2×5 convention (columns 1–5 = thumb…pinky per row); **no** shuffling designs between fingers or between rows.
- **Wear orientation — nail “top” toward the knuckle:** each press-on is mounted so the **cuticle / root / proximal edge (甲根, the visual “top” of the nail art)** points toward the **finger base / knuckle**, and the **free edge (指尖)** points toward the **fingertip** — matching how that nail sits on the **reference sheet** (tips-down / roots-up on the sheet must become **roots toward hand base, tips toward finger end** on the real finger). **Forbidden:** **180°** mounting that flips the whole art upside-down vs the reference, or swapping which end is “up” on the finger.
- **Strictly follow the reference image** for every slot: the art on each real finger must be **only** the art from that **same sheet cell** — no substitutions, no “cleaner” redesign, no merging motifs across columns. **Pixel-faithful nail art** (colors, French curves, gradients, decals, 3D charms, glitter, chrome, nail silhouette) per finger.
（中文小结：产品图甲尖朝下、每行从左到右依次大拇指→小指；两行顺序与背卡一致不乱序；戴甲时甲根/款式上缘朝指根、指尖朝游离缘，勿正反颠倒；每指款式须与对应格**严格一致**、禁止偷换或简化。）

${DISTAL_PATTERN_AT_ANATOMICAL_FINGERTIP_EN}

${HAND_NAIL_ANTIPATTERNS_AND_VERIFY_EN}`;

/** 模特试戴、手模饰品试戴共用：第二张美甲产品图的版式与还原度（与 UI / NAIL_ON_HAND 一致）。 */
export const TRYON_SECOND_NAIL_PRODUCT_LAYOUT_EN = `**SECOND-image layout (mandatory — nail + model OR nail + accessory try-on):**
- **Tips down (甲尖朝下):** in this product photo, each nail’s **free edge points toward the BOTTOM** of the image and the **cuticle/root toward the TOP**. On the output hand(s), **root → knuckle**, **tip → anatomical fingertip** — same as the sheet; **forbidden:** wearing any nail **flipped 180°** vs how it appears on the sheet.
- **Left → right = thumb → pinky (大拇指 → 小指)** on every horizontal row; two-row sheets: **top row then bottom row**, columns 1–5 = thumb…pinky per row — **no** whole-row mirroring, **no** shuffling designs for “balance.”
- **Strict nail-art fidelity:** every visible fingernail in the output must **match the SECOND image for its mapped slot** — identical motifs, micro-patterns, charm placement, edge shapes, gloss — **not** a loose reinterpretation.`;

export const MODEL_TRYON_PROMPT = `You receive TWO input images in this order:
1) FIRST image: the MODEL photograph — a person (hands visible) with natural nails, in a specific pose, lighting, skin tone, clothing, and background.
2) SECOND image: the NAIL PRODUCT reference — press-on / stick-on nails shown flat, on a card, or as a product shot, displaying the exact nail art (colors, patterns, 3D chrome, decals, shape) to apply.

${TRYON_SECOND_NAIL_PRODUCT_LAYOUT_EN}

TASK — photorealistic virtual try-on (image editing):
- Replace ONLY the model’s fingernails (and visible thumbnail nails) with artificial nail tips that faithfully reproduce the artwork from the SECOND reference. Match each finger’s nail shape, length, and perspective; align cuticle lines believably.
- Preserve the model’s identity, face, body, skin texture, pose, jewelry, clothing, environment, and global lighting. Do NOT restyle the whole photo into a different scene.
- If multiple nail designs exist in the product reference, map them to fingers in a coherent order (e.g. thumb→pinky) consistent with the product layout.
- Edges must look naturally attached: no floating nails, no harsh paste lines, no duplicated hands.

${NAIL_ON_HAND_SHEET_TO_FINGER_ORDER_EN}

Output a single full-frame photorealistic image with the same composition and crop as the FIRST (model) image.`;

export const ACCESSORY_TRYON_PROMPT = `You receive TWO input images in this order:
1) FIRST image: ACCESSORY / jewelry PRODUCT references — typically rings (or bracelets) shown on a finger, on white, or as clean packshot crops. One image may contain MULTIPLE distinct pieces (e.g. two different gold rings on different fingers). It may also show a **hand holding packaging, a card, or a retail box** — treat that as valid context, not something to discard.
2) SECOND image: the NAIL PRODUCT reference — press-on / stick-on nails in a sheet, card, or grid, showing EXACT nail art (colors, French tips, tiny 3D fruit charms, decals, shapes).

${TRYON_SECOND_NAIL_PRODUCT_LAYOUT_EN}

TASK — premium social / e-commerce “matching ad” (nails + jewelry try-on):
- **Scene continuity (critical):** If the FIRST image already shows a **real hand** (with or without packaging, box, sleeve, or props), **preserve that pose, crop, interaction, and environment** as much as possible. Only replace/enhance fingernails and place the referenced jewelry believably on that hand. Do **not** jump to a totally new generic studio disembodied hand or a different crop **solely** to satisfy per-finger nail-art notes — map nail designs to the **correct anatomical fingers** within the **existing** composition instead.
- If the FIRST image has **no usable hand** (only loose jewelry on white / packshot with no finger to wear it), then synthesize ONE photorealistic photograph of a single elegant adult HAND and forearm only (crop: no face, no torso). The hand may be fully AI-generated.
- FINGERNAILS: apply press-on tips that faithfully reproduce the nail art from the SECOND reference, in a coherent finger order (thumb → pinky) matching the product layout, **unless** USER REFINEMENT specifies particular fingers for particular designs — then obey that mapping on the visible fingers. Preserve micro-details: gradients, patterns, 3D charms, gloss, and nail shape.
- JEWELRY: the hand must WEAR the exact rings/jewelry seen in the FIRST reference — same metal color, band profile, thickness, and style. If two different rings appear in the first image, place them on believable fingers (e.g. index + ring finger) like a professional styling, not floating beside the hand.
- **Hero vs packaging:** Prefer a believable manicured hand wearing BOTH the nails and the jewelry; this is NOT a flat-lay of loose nails only. If the reference already includes product packaging in frame, **keeping that retail/packaging context is allowed** and should not be stripped when the user only asks which finger gets which nail design.
- Lighting & set: match the FIRST image’s lighting when preserving its scene; otherwise soft beauty / commercial studio light; clean neutral or pale backdrop; optional subtle sleeve cuff is fine; avoid busy clutter unless already in the reference.
- Skin must look natural; no duplicated ghost fingers; no extra random jewelry not present in the first reference.

${NAIL_ON_HAND_SHEET_TO_FINGER_ORDER_EN}

Output a single square high-resolution photograph.`;

/** 单张「2×5 拼图参考图」→ 输出一张干净白底商品栅格（images.edit 单图） */
export const TEN_SINGLES_COLLAGE_REF_PROMPT = `You receive **ONE** reference image. It is a **draft 2×5 grid** (2 horizontal rows, 5 columns) on **white**, reading **left → right**, **top row first**: positions **1–5** are the **top** row (left = slot 1 … right = slot 5), then positions **6–10** are the **bottom** row (left = slot 6 … right = slot 10).

Each cell contains ONE press-on nail artwork. Small **digit badges (1–10)** may sit in a cell corner — the digit equals that cell’s **slot index**. Those badges are **layout metadata only**; your **final image must NOT** show these badge graphics anywhere (no digits, no white label boxes from the reference). Re-extract each nail’s art cleanly.

TASK — premium Amazon / Taobao **single-sheet** packshot from this collage reference:

CRITICAL (failure if violated):
- **Pixel slot fidelity:** the artwork that appears in reference **top-left** MUST end up in **output top-left** only; same for every slot through **bottom-right**. Never swap, mirror, or re-sort cells for aesthetics.

WHITE-GRID PRODUCT RULES (failure if violated — same constraints as extract / complete / multi-angle white packshots):
${WHITE_BG_NAIL_GRID_FINGER_LADDER}

${WHITE_BG_NAIL_GRID_TOP_BASELINE}
- Top row (slots 1–5) and bottom row (slots 6–10) share the **same** column semantics (slots 1 & 6 = thumb … slots 5 & 10 = pinky).

${PACKSHOT_TIP_STAGGER_ROW_EN}

INPUT ORIENTATION — ten singles pipeline:
- Each cell image was **EXIF-upright only** on the server (**no** automatic per-cell **180°**). Preserve each slot’s **tip vs cuticle** orientation as in the collage reference; do **not** globally flip cells **180°** vs the reference unless fixing a clearly wrong wear.

LAYOUT + LOOK:
- Flat **#FFFFFF** or very light **#F7F7F7** background; strict modular **2×5**; **thin, even gutters** between adjacent nails and between the two rows (same neutral as the backdrop) — visually consistent spacing, **no** wide white bands; maximize nail area in the frame.
- The draft reference was **server-built** with **top-edge (cuticle) row alignment**; preserve that in your output — **never** re-compose so tips share a line while cuticles staircase.
- Columns must align vertically across both rows (no staircase offset).
- Each nail: long axis vertical, **0°** yaw in the plane, **horizontally centered** in its column; crisp cutout edges; remove stray background, skin, props from the reference cells.
${PACKSHOT_GRID_VERTICAL_QA_EN}
- Preserve all artwork, gloss, chrome, glitter, 3D charms with **high input fidelity** — no invented patterns; **no** beauty filters or stylised reinterpretation.
- Soft even e-commerce studio light; optional tiny uniform contact shadow only; **no halos** or over-sharpening.

FINAL CHECK:
- No digit badges or label boxes remain in the output.
- Slot 1 art is still top-left; slot 10 still bottom-right.
- **Every occupied slot: nail perfectly vertical (yaw = 0°)** — re-read CANVAS-VERTICAL; **forbidden** any visible tilt in any row or column pair.
- **Each full row of five:** FREE-EDGE STAGGER where it matches **source** nail lengths (staggered tips, **not** flat tabletop); use **vertical translation** only, **yaw = 0°** preserved — **never** shorten or lengthen a nail to force a template.
- Finger ladder + per-row top baseline satisfied with **subtle** size steps (one SKU family); do not collapse index/ring to one tiny and one huge; **do not** exaggerate thumb vs pinky beyond the reference’s gentle spread.

Return **ONE** square high-resolution product-ready image.`;

/** 抠图专用：先钉死「不拉长、不改比例」，再展开长段保真说明，减轻被后面「阶梯指尖」等词带偏 */
const EXTRACT_TEN_GRID_PRIORITY_LEDE_EN = `EXECUTION ORDER (read first — wins over any later “retail / stagger / ladder” wording):
1) **Cut out** each visible press-on as a **rigid layer** — **same** length, width, and **2D silhouette** as that nail in the photo (CAD-like), **same aspect ratio** within a few percent — **forbidden:** vertical-only stretch, “slenderizing,” or redrawing a longer almond/stiletto to “fit” the cell.
2) **Rigid in-plane rotation** to **yaw = 0°** (tips down / roots up), then **rigid translation** into the **2×5** cells and gutters — **no** warp, shear, liquify, or non-uniform scale for layout.
3) Only then apply the **neutral cleanup** rules in the long **DESIGN & SHAPE FIDELITY** block below — cleanup must **never** change outlines or nail length class.

`;

/** 从实拍/产品图只抠已出现的甲片，不补全、不发明 */
const EXTRACT_TEN_GRID_PROMPT = `You act as a **professional e-commerce product retoucher**.

TASK — **extraction and layout normalization only** (not creative nail design, not a new SKU). Do **not** redesign, re-style, or reinterpret the visible set.

${EXTRACT_TEN_GRID_PRIORITY_LEDE_EN}
${PACKSHOT_FIDELITY_CLEANUP_BG_EN}

Edit the provided reference photo of press-on / stick-on nails (display card, tray, flat-lay, hand-held set, noisy background, etc.).

GOAL — **Extraction only:** cut out every **clearly visible** artificial nail from the source and place them on a clean **2×5** white grid. This is **NOT** a “fill to 10 with invented nails” task and **NOT** a design refresh.

FIDELITY FIRST (hard — overrides decorative layout goals):
- Each placed nail must keep the **same** **silhouette, length, width, and nail-art** as that nail in the source — **no** shortening, lengthening, or reshaping to “fit” the grid. **Aspect-ratio lock:** the placed nail’s **height:width** in the cell must match the **source** cutout within a few percent — **forbidden:** stretching taller to look “e-commerce long.” **Allowed:** **rigid in-plane rotation** to **yaw = 0°** and **rigid translation** for gutters / row alignment; **forbidden:** stretch, squish, uniform or non-uniform rescale, or liquify that changes the sold SKU.

IMAGE EDITING TASK:
1) Identify every **individual** nail tip that is **unambiguously** visible. Ignore skin, fingers, printed text, logos, packaging, and environment.
2) Cut out ONLY those pieces with crisp edges (no leftover card, skin, harsh cast shadows).
3) Composite onto flat **#FFFFFF** or very light **#F7F7F7** in a **2×5** modular grid. Preserve **left-to-right, top-to-bottom** reading order from the reference layout so each design lands in the correct slot — do not swap columns.

NO INVENTION (hard rule):
- If fewer than **10** nails are clearly visible: leave every **empty** cell as **solid flat backdrop only** (**#FFFFFF** or **#F7F7F7**, same as the chosen canvas) — no guessed nail art, no duplicates “for symmetry,” no watermark. **Never** fabricate missing nails.
- If more than 10 nails are visible, output **exactly 10** by following the dominant product layout (prefer the primary tray rows in reading order) and omit extras.

INPUT — extract_ten_grid pipeline:
- The server applied **EXIF upright only** (no automatic global **180°** on the whole upload). Still rectify **each placed nail** so **free edge points down** and **cuticle up** inside its cell.

RECTIFY GEOMETRY — DO NOT COPY CASUAL TILT FROM THE SOURCE:
- **ABSOLUTE — every occupied nail must be perfectly vertical:** source photo tilt is **noise to remove**, not a look to keep. After placement, **each** occupied nail’s long axis must coincide with the frame vertical (**yaw = 0°**); see CANVAS-VERTICAL block — **no** “almost vertical.”
- Re-pose each extracted nail upright in the grid: long axis vertical, yaw = 0° in the plane.
- **Fingertips down** per nail in each cell.（须保证指尖朝下，甲根/后缘朝上。）
- **No warp for layout:** do **not** scale, stretch, shear, or non-uniformly warp any individual nail to satisfy the grid; **in-plane rotation only** as needed for tips-down / straight upright.

${PACKSHOT_GRID_DECOMPOSE_RELAYOUT_EN}

${PACKSHOT_GRID_VERTICAL_QA_EN}

UNIFORM MODULAR GRID + COLUMN ALIGNMENT:
- **2 rows × 5 columns**; columns align across rows; **minimal** gutters and slim outer margins (tight SKU look).

CELL PLACEMENT — **verticality + gutters + natural tips:**
- **yaw = 0°** for every occupied nail (see CANVAS-VERTICAL). Prefer **FREE-EDGE STAGGER** via **vertical translation** only when it **does not** require changing any nail’s **length or silhouette** vs the source; if a stagger template would conflict with fidelity, **preserve** the source nail and **white spacing** from the appended grid block carries the layout.

${PACKSHOT_TIP_STAGGER_ROW_EN}
- **Do NOT** vertically **re-pack** nails in a way that **changes** their **visible length** vs the input just to align roots or tips; use **translation** and **backdrop gutters** first.

- **Horizontal:** center each nail in its column slot unless the source clearly used a deliberate offset; keep **gutter widths visually even** across columns — **forbidden** one column gap obviously wider than its neighbours.
- **Empty cells:** solid flat backdrop **only**, matching the canvas colour (**#FFFFFF** or **#F7F7F7** — same as the chosen background above).

WHITE-GRID PRODUCT RULES (apply to **every occupied** nail when the output is a retail-style **2×5** on white; columns 1→5 = thumb → index → middle → ring → pinky):
${WHITE_BG_NAIL_GRID_FINGER_LADDER}

${WHITE_BG_NAIL_GRID_TOP_BASELINE}

${PACKSHOT_FAILSAFE_GRID_EN}

LIGHTING — packshot finish:
- Soft even **e-commerce studio** light on the nail pieces; preserve sparkle/chrome fidelity from the originals; **no** heavy contrast pushes or global colour re-grade beyond neutral cleanup above.

FINAL QA SWEEP (internal — before output):
- Every **occupied** slot: **yaw = 0°** (CANVAS-VERTICAL); **aspect ratio** vs source cutout within a few percent — **no** vertical elongation. Each **full row of five** occupied nails: tips **not** all on one flat line when source lengths differ; **never** sacrifice source **length or silhouette** for stagger. **Defringe** on white: no obvious light halos along cutout edges.

${PACKSHOT_OUTPUT_COMPLIANCE_EN}

Return a single square product-ready image.`;

/** 斜拍 / 散落实拍：强调逐枚拆层，禁止整图扶正 */
const EXTRACT_ANGLE_SCATTERED_SCENE_EN = `ANGLE / SCATTERED / DIAGONAL-ROW SOURCE (this mode — read before generic grid rules):
- Typical inputs: nails on white at **different in-plane rotations**; **two diagonal rows**; or **loose scatter** with gaps — **not** a clean straight 2×5 card photo.
- **Camera perspective** may foreshorten nails (look shorter/wider). That is **not** permission to **stretch, squash, or shear** — only **per-nail rigid rotation + translation** after cutout.
- **Soft contact shadows** under each nail: remove with the nail layer; **do not** leave gray blobs as separate objects.
- **3D charms / flowers / beads:** include them as part of that nail’s cutout silhouette; **do not** drop or redraw them.

DECOMPOSE FIRST — **never** “fix” the group as one photo:
- **Forbidden:** rotating, deskewing, or perspective-correcting the **entire canvas** because the **group** is diagonal.
- **Mandatory:** find **each individual** press-on → separate layer → **its own** rotation to **yaw = 0°** → place on fresh 2×5.

SLOT ORDER when layout is messy:
1) If two **diagonal rows** are obvious: map **upper row** slots **1–5** left→right, then **lower row** **6–10** left→right (columns = thumb→pinky).
2) If **scattered**: sort by **visual center Y** (higher on image = earlier row), then **X** left→right within a row band; assign slots **1→10** without swapping art between nails.
3) If **ambiguous**, prefer **reading order** that preserves **distinct designs** — **never** duplicate one nail to fill empty cells.

`;

/** 斜拍 / 散落实拍 → 2×5 白底（专用 prompt） */
const EXTRACT_ANGLE_SCATTERED_PROMPT = `You act as a **professional e-commerce product retoucher** specializing in **messy flat-lay and angle-shot** press-on photography.

TASK — **extraction and layout normalization only** from **tilted / scattered** sources. **Not** creative redesign. **Not** filling missing SKUs.

${EXTRACT_ANGLE_SCATTERED_SCENE_EN}
${EXTRACT_TEN_GRID_PRIORITY_LEDE_EN}
${PACKSHOT_FIDELITY_CLEANUP_BG_EN}

GOAL — cut out **every clearly visible** artificial nail and composite onto **2×5** white. **No invention.**

FIDELITY FIRST (hard):
- Each nail keeps **same silhouette, length, width, nail-art** as in the source cutout — **aspect-ratio lock** within a few percent.
- **Allowed:** rigid in-plane rotation → **yaw = 0°** + translation.
- **Forbidden:** stretch, squish, liquify, or non-uniform scale to “correct” perspective or fit gutters.

IMAGE EDITING STEPS:
1) Segment **each** nail (including 3D decor) from white / pale backdrop; ignore gaps between nails.
2) **Crisp edges** — no halos, no leftover shadow patches **between** nails.
3) Place on **#FFFFFF** / **#F7F7F7** in **2×5** per SLOT ORDER rules above.

NO INVENTION:
- Fewer than 10 visible → **empty cells = flat backdrop only**.
- More than 10 → output **exactly 10** from the dominant set in reading / sort order; drop extras.

${PACKSHOT_GRID_DECOMPOSE_RELAYOUT_EN}
${PACKSHOT_GRID_VERTICAL_QA_EN}

UNIFORM MODULAR GRID:
- **2 rows × 5 columns**; column alignment across rows; minimal gutters.

${PACKSHOT_TIP_STAGGER_ROW_EN}

WHITE-GRID PRODUCT RULES:
${WHITE_BG_NAIL_GRID_FINGER_LADDER}
${WHITE_BG_NAIL_GRID_TOP_BASELINE}
${PACKSHOT_FAILSAFE_GRID_EN}

FINAL QA (angle/scatter):
- **Every** occupied slot **yaw = 0°**; no nail still at source slant.
- No **group-level** diagonal — only **per-nail** upright pieces.
- Defringe on white; 3D decor still attached to the correct nail.

${PACKSHOT_OUTPUT_COMPLIANCE_EN}

Return a single square product-ready image.`;

/** 几何矫正专用输出：勿用「commercially accurate」等诱发整图重绘的措辞 */
const WHITE_GRID_RECTIFY_OUTPUT_EN = `OUTPUT:
- **Exactly one** square image; **no** text, watermarks, or UI.
- Must read as the **same photographed sheet** as the input — **only** rigidly moved/rotated nails on white, **not** a newly generated catalogue render.`;

/** 发往 API 时拼在几何矫正 prompt 最前（提高首尾权重） */
export const WHITE_GRID_RECTIFY_API_PREFIX = `VERTICAL RE-LAYOUT LOCK: **Decompose all 10 slots** → **re-compose** a fresh 2×5; **every** occupied nail **yaw = 0°** (≤1° lean). Per slot **N**, copy **only** input slot **N** art/silhouette; **only** rigid rotate + translate. **Do not** deskew the whole image or regenerate equal-length nails.\n\n`;

/** 二次：整版拆层重排 + 强制竖直 + 白底间距；逐格锁死甲型/长短与指尖阶梯 */
const WHITE_GRID_RECTIFY_PROMPT = `PER-SLOT STAMP — **#1 HARD RULE** (any violation = failure):
For **each occupied slot N (1–10)**, output slot **N** must be the **same physical nail** as input slot **N** — **same** outer contour, **same** plate **height** and **width** (within **~3%**), **same** tip shape and taper, **same** art pixels and photo texture. **Forbidden:** redrawing, “beautifying,” copying another slot’s silhouette, or making **all ten** nails **one** ideal length/shape.

**NOT regeneration** — **only** rigid **rotate + translate** per nail layer + white backdrop. If layout conflicts with silhouette, **keep silhouette**; adjust **only** rotation, translation, or **more white**.

INPUT: square **2×5** on **flat white**. Slots **1–5** top L→R, **6–10** bottom.

${PACKSHOT_GRID_DECOMPOSE_RELAYOUT_EN}

DO (mandatory three-step pipeline — **all ten slots**, occupied or empty backdrop only):
0) **DECOMPOSE:** mentally isolate **each** occupied slot as its own layer; **ignore** how the input group is tilted or unevenly spaced.
1) **PARALLEL:** per layer, rigid rotation → **yaw = 0°** (tips down, cuticle up). **≤1°** visible lean max. Row **0°** parity; pairs **1↔6 … 5↔10** share **0°** when both filled. **Never** ship a sheet where **any one** of ten nails still leans.
2) **RE-LAYOUT + SPACING:** on a **fresh** 2×5, rigid translation + white per appended **USER-SUPPLIED GRID SPACING** (margins, **equal** column gutters, row gutter). Slot **k** and **k+5** share one **vertical centerline**. **Never** resize plates to fit gutters. **Do not** preserve input’s old slant or uneven gaps — **re-place** every nail.

STEPPED BOTTOM (mandatory — match input):
- Each full row of five: **keep input’s stair-step** — **different** free-edge **Y** (middle longer, sides shorter, etc.). **≥2** clearly different tip heights per row.
- **Forbidden:** flat tabletop (all tips on one horizontal line); equalizing every nail to **same** length/width to look “neat.”

COMMON FAILURES — **forbidden** (what users reject):
- Ten nails **same length** / **same width** when input had thumb vs pinky differences.
- Tips **wider / rounder** than input (squoval drift); **longer / sharper** than input (stiletto drift).
- Wax-plastic CGI polish; lost sparkle/grain from the photo.

FORBIDDEN besides the two moves: rescale, stretch, squish, liquify, warp, recolour, relight, sharpen, redraw, homogenize, swap slots.

${PACKSHOT_GRID_VERTICAL_QA_EN}

SELF-CHECK (scan **1→10** in order before output):
(1) **Vertical pass:** each occupied slot — long axis **parallel to frame vertical**, sidewalls vertical, **no** diagonal lean.
(2) **Re-layout pass:** sheet reads as **newly composed** 2×5, not a slightly rotated copy of the input group.
(3) gutters per appendix; (4) **stepped tips** like input; (5) slot **N** still **same H×W** outline as input **N**.

${WHITE_GRID_RECTIFY_OUTPUT_EN}

Return **one** square image.`;

/** 单枚高清化：仅 EXIF 转正；用户约定甲尖朝下；模型只出一枚抠图单甲，2×5 由服务端复制列缩放拼接。 */
const COMPLETE_SINGLE_GRID_PROMPT = `You act as a **professional e-commerce product retoucher**.

TASK — **single-nail catalog isolation only**: one cleaned, centred cutout from the source — **not** a redesigned “hero” nail, **not** a multi-nail grid.

${PACKSHOT_FIDELITY_CLEANUP_BG_EN}

${PACKSHOT_FAILSAFE_SINGLE_EN}

Edit the provided reference image of press-on / stick-on nails (single nail, a few nails, card, or noisy background).

PIPELINE / ORIENTATION (must match server — failure if violated):
- The server applied **EXIF orientation correction only** — **no** automatic whole-image **180°** rotation on upload.
- **User upload convention:** the frame is already **tip-down / root-up** (**free edge toward the bottom**, **cuticle toward the top**). **Do not** apply a global **180°** flip to “fix” orientation — you would **invert** correctly oriented files.
- **Allowed:** if the chosen nail is only **slightly canted** in-plane, apply **rigid rotation** so that nail ends at **yaw = 0°**, still **tips down / roots up**. **Forbidden:** remodelling the plate to “look more vertical” by changing C-curve, length, or tip geometry.

RETAIL LADDER IS SERVER-SIDE (do not simulate in one image):
- A later **server** step duplicates your **single** cutout into a **2×5** sheet using **per-column width scaling** to suggest **thumb → pinky** sizes. **Your** job is **one** faithful cutout only — **forbidden:** painting five different nail widths, five different lengths, or a mini 5-up “preview grid” inside one output.
- **One SKU = one silhouette:** keep the **exact** nail-plate outline, **length class**, and **tip family** (square / squoval / oval / almond / stiletto / etc.) of the source nail you isolate — **forbidden:** converging toward a generic “pretty” medium-oval catalogue default.

PRIMARY OUTPUT GOAL — single realistic source nail only:
- Output **exactly ONE** press-on nail, centered on a pure **#FFFFFF** background.
- Do **NOT** output a grid, sheet, pair, set, duplicate, label, number, ruler, hand, finger, card, packaging, or any extra nail.
- The single nail must be upright with **cuticle/root at the top** and **free edge/tip pointing down**.

IMAGE EDITING STEPS:
1) Identify visible nail tips; ignore skin, card text, logos, packaging clutter.
2) If several nails are visible, choose the clearest / most representative nail art from the reference and render that design as ONE standalone nail.
3) Reconstruct it as a realistic high-resolution catalog product cutout: long axis vertical, yaw 0°, **tips down / roots up**.（指尖朝下，甲根朝上。）
- **No warp for hero framing:** do **not** stretch, squish, or non-uniformly scale the nail to fill the frame; preserve **true** proportions vs the source nail you chose.

LIGHTING & FIDELITY:
- Photorealistic material, natural curved press-on shape, believable thickness and highlights — **match** the source finish (glossy, matte, etc.), do **not** invent a different material system.
- Preserve the source nail art faithfully: color, gradient, chrome, glitter, gloss, decals, 3D charms, and micro-detail.
- Soft even **e-commerce studio** light; optional tiny uniform contact shadow only; **no** heavy HDR.

FINAL CHECK:
- Exactly ONE nail is visible.
- No 2×5 layout, no ten-nail set, no duplicated copies.
- Pure **#FFFFFF** (or flat **#F7F7F7** if you must match a pale-neutral SKU look) background; single centered nail; tip down; root up.

${PACKSHOT_OUTPUT_COMPLIANCE_EN}

Return **one** square, catalog-ready image.`;

/** 多角度上手：无握姿参考图，由模型生成手；每张必须单手、解剖与光影符合现实。 */
const MULTI_ANGLE_HAND_ON_BODY_RULES = `${NAIL_ON_HAND_SHEET_TO_FINGER_ORDER_EN}

COMPOSITION — **EXACTLY ONE HAND PER OUTPUT IMAGE** (hard rule):
- The square contains **one** adult human hand only — **either** left **or** right, internally consistent. **Forbidden:** two hands, mirrored twin hands, overlapping second palms, “helping” second person, or any read as **two wearers**.
- Forearm/wrist may appear only as a **natural continuation** of **that same** hand; **no** extra wrist that implies another body.
- Use **plain white** for negative space — **never** fill the frame with a duplicate hand for symmetry.

PHOTOREAL — **must read as a retouched DSLR / mirrorless catalog still**, not CG illustration or beauty-filter plastic:
- Natural skin: subsurface warmth, visible fine creases at knuckles, **no** wax-doll smoothing, **no** poreless airbrush.
- Nails: believable press-on thickness, sharp gel/chrome speculars, accurate C-curve in perspective; **no** sticker-flat paste, **no** neon oversaturation beyond the product reference.

HAND + WEAR (mandatory for **both** shots in this mode):
- The nails must be **worn on that single real human hand** — **never** output a loose tray, backing card, or nails floating on white without skin.
- **Exactly five digits** on that hand (one thumb + four fingers); **no** sixth finger, no duplicated thumb, no fused or “branching” digits. Natural knuckle hierarchy; thumb opposes the other four in a **physically possible** way.
- **Pose & joints:** only **biologically plausible** joint ranges — **no** impossible twists, **no** thumb sprouting from the wrong edge of the palm, **no** fingers bent backward beyond comfort. If the crop hides a digit, **keep it hidden** — **do not** invent partial fingers in gaps.
- **Lighting:** one coherent studio key direction on skin and nails (same hand, same session); **avoid** contradictory shadows that imply two light sources on two different bodies.
- Map press-on art from the product reference onto fingers in **thumb → index → middle → ring → pinky** order consistent with how the reference sheet/card orders designs **left to right** in each row (same mapping discipline as white-grid packshots — do not swap distinctive patterns to wrong fingers):
${WHITE_BG_NAIL_GRID_FINGER_LADDER}
- Nails sit on nail beds with believable glue-line / cuticle transition; **no** floating plates.
- Skin: photoreal micro-texture (pores, fine creases); **avoid** waxy plastic skin.
- Backdrop: pure **#FFFFFF** seamless studio; soft even beauty light; optional subtle contact shadow only.`;

const MULTI_ANGLE_ARTWORK_AND_ORIENTATION_BLOCK = `ART FIDELITY + ORIENTATION (every shot — failure if violated):
- **Per-slot copy only:** each visible fingernail must show **exactly** the artwork from the **matching slot** on the product reference — **never** borrow another slot’s motif, merge patterns, or add “prettier” flowers/decals that are **not** on that reference nail.
- **Accent placement by column (e.g. flowers):** copy **exactly** which columns carry an extra motif on the **product sheet** — if flowers appear **only** on **columns 2 and 4** (index + ring) in each row, then **thumb (1), middle (3), and pinky (5) must have zero flowers** — only leopard/base as on those reference nails. **Forbidden:** flowers on thumb, middle, or pinky; **forbidden:** duplicating the flowered design onto the wrong column.
- **Do not change how the art looks:** same colors, shapes, micro-lines, and accent placement as the reference nail for that finger — **zero** creative redesign; only natural **lighting + perspective wrap** on the curved nail.
- **Printed front face outward:** the **designed top surface** faces outward on the nail plate the camera sees; **never** use the **matte inner / underside** as the visible art side.
- **Cuticle → free edge (甲根→指尖) — anatomy wins over flat-card bitmap:** map art so **proximal/root** of the motif sits toward the **nail fold / finger base** and **distal French / tip pattern** sits toward the **physical free edge at the fingertip** — same logic as on the reference nail plate. **No 180°** “paste” that clusters tip art near the cuticle. **If the reference has a dark / black tip, that dark must face the real fingertip**, not the knuckle.
- **Palm-up / 手心朝上 / palmar-facing camera:** when the **palm faces upward** or toward the lens, **do not** keep the flat product-card orientation blindly — **re-express** the design on each nail so the **distal decorative band (French, leopard tip)** still lies at the **anatomical fingertip**, **not** flipped so the “tip” reads next to the knuckle. The nail plate is a **curved surface**; rotate the art **in 3D** as needed so **tip art = fingertip side, root art = cuticle side** regardless of palm vs dorsal view.
- **No wrong mirroring:** asymmetric prints must keep **correct chirality** vs the reference after 3D wrap — **forbidden:** accidental **horizontal mirror** unless physically required (prefer fidelity).`;

const ANGLE_PROMPTS: { prompt: string; label: string }[] = [
  {
    label: "图1 · 正视上手主图",
    prompt: `Using ONLY the nail artwork from the reference image (tray, card, or product photo), create shot **1 of 4**: a **photoreal** premium e-commerce **on-hand** hero — must look like a real photo, not rendered illustration.

${MULTI_ANGLE_HAND_ON_BODY_RULES}

${MULTI_ANGLE_ARTWORK_AND_ORIENTATION_BLOCK}

SHOT 1 — **front hero — dorsal OR palm-up (正视可手背或手心朝上):**
- **Single** elegant adult **hand** with the **full set** on that hand visible. Camera may be **straight-on to the dorsal nail side** **OR** a **palm-up / palm-toward** beauty pose (common for “正视” catalog). **If palm faces up or toward camera:** follow **PALM-UP** rule in the block above — **tip/French art must sit at the real fingertip**, never inverted toward the cuticle.
- **Shot 1 grammar:** **broadside / catalog hero** — the **main nail plate plane** (dorsal or palmar) should face the camera within roughly **0–25°** of frontal; show **most or all five nails** in one readable sheet-like composition. **Avoid** fingertip-only dominance, extreme side-on traverse, or “tips rushing the lens” here — reserve those grammars for shots **2–4**.
- Every visible nail must reproduce the reference art with **high fidelity** (color, gradients, chrome, glitter, 3D blobs/charms) with **correct per-column accents** (flowers only where the sheet has them — typically **index + ring only** if columns 2 & 4 only).
- Pose must stay **anatomically plausible**. This frame must read as a **different camera relationship** than shots 2–4 (more frontal / hero), not a mild crop of the same angle.

Single square frame, catalog-ready.`,
  },
  {
    label: "图2 · 指尖朝镜 cup-forward 特写",
    prompt: `Using ONLY the nail artwork from the reference image, create shot **2 of 4**: a **photoreal** **tip-forward / cup-forward macro** of the same hand and same press-ons as shot 1. This shot has **one fixed lens grammar** — do **not** improvise into a “three-quarter dorsal” or “45° catalog” version.

${MULTI_ANGLE_HAND_ON_BODY_RULES}

${MULTI_ANGLE_ARTWORK_AND_ORIENTATION_BLOCK}

SHOT 2 — **TIP-FORWARD / CUP-FORWARD MACRO (mandatory; treat any other framing as failure):**
- **Pose:** the **same single hand** from shot 1, fingers **gently curled / cupped toward the camera** as in a salon “tip check” — **distal free edges face the lens**, knuckles and back of the hand **recede into the frame**. Wrist may exit frame at the bottom or side.
- **Hero read:** the picture is **about the fingertips** — French bands, ombré tips, leopard tip, chrome tip caps, 3D charms or florals **at the distal end**, and the **C-curve thickness / underside glint** of each press-on must be the **dominant subject**.
- **Crop:** tight macro on **3–5 fingertips of the SAME hand** (thumb may be in or out of frame). **Forbidden:** a wide whole-hand catalog frame, a flat-on dorsal billboard, or a side-traverse profile — those are shot 1 territory or other modes.
- **Camera axis:** roughly **head-on into the fingertips**, with the **nail plates tilted back ~30–60°** away from the lens because of the natural cup. **Forbidden:** keeping the dorsal nail plane parallel to the sensor (that becomes shot 1 again).
- **Depth & light:** shallow DOF welcome (front fingertips crisp, knuckles softer); soft beauty key + subtle rim light that **catches gloss / chrome / glitter on the free edge**; pure **#FFFFFF** seamless backdrop, same studio session as shot 1.
- **Same hand, same skin, same set:** identical skin tone, ring/no-ring choice, and nail art as shot 1 — this must read as **the next click in the same shoot**, not a different model.
- **Anatomy still holds:** exactly five digits on one hand even when some are occluded by the cup; **never** invent partial finger stubs to fill empty white.

ART FIDELITY (hard, same as shot 1):
- Each visible fingernail = **only** the artwork from the matching slot on the product reference (thumb=col1 … pinky=col5). **Per-column accent rule still applies** (e.g. flowers only on cols 2 & 4 → only index + ring carry florals; thumb/middle/pinky stay clean).
- **Distal art at the real fingertip:** because the lens looks straight at the free edges, dark/French/leopard tips, chrome caps, and any “tip” motif **must read at the front-of-frame edge of each nail**, never flipped toward the cuticle.

Single square frame, photoreal macro — **must be visibly a different shot type from shot 1**, not a yaw variant.`,
  },
  {
    label: "图3 · 侧沿指列 traverse 特写",
    prompt: `Using ONLY the nail artwork from the reference image, create shot **3 of 4**: a **photoreal** **side-on traverse macro** along the **finger row** of the **same single hand** and press-ons as the prior shots — same skin tone, same studio session, **#FFFFFF** seamless backdrop.

${MULTI_ANGLE_HAND_ON_BODY_RULES}

${MULTI_ANGLE_ARTWORK_AND_ORIENTATION_BLOCK}

SHOT 3 — **RADIAL OR ULNAR TRAVERSE MACRO (mandatory lens grammar):**
- **Camera:** place the camera **along the side of the hand** (pick **ulnar OR radial** edge — pinky-side OR thumb-side row) so the viewer **travels down the arc of 3–4 adjacent fingers** with **strong parallax** between nails — **side walls, free-edge silhouette, C-curve thickness, and length class** must read clearly.
- **Hero read:** **depth stacking** and **sculpted rim / short-side light** on nail edges — **not** a flat dorsal billboard parallel to the sensor (that is shot 1), **not** fingertips rushing straight at the lens (that is shot 2), **not** a mild ~15–35° yaw tweak of shot 1.
- **Pose:** fingers may be **slightly fanned or relaxed** so side planes open to the lens; **one hand only**, **five digits** anatomically correct; occluded digits stay hidden — **never** invent stubs.
- **Crop:** macro on **3–4 fingers** of the same hand; wrist optional at frame edge.

ART FIDELITY (hard):
- Per-slot nail art + accent columns exactly as the product reference; **distal dark / French / leopard tips at anatomical free edges** on every visible nail including thumb if shown.

Single square frame — must be **instantly distinguishable** from shots 1 and 2.`,
  },
  {
    label: "图4 · 斜俯视半侧上手",
    prompt: `Using ONLY the nail artwork from the reference image, create shot **4 of 4**: a **photoreal** **oblique high-angle three-quarter** view of the **same single hand** wearing the same press-ons — same skin tone, same session, **#FFFFFF** seamless backdrop. This is **neither** the frontal hero of shot 1 **nor** the tip-forward cup of shot 2 **nor** the side traverse of shot 3.

${MULTI_ANGLE_HAND_ON_BODY_RULES}

${MULTI_ANGLE_ARTWORK_AND_ORIENTATION_BLOCK}

SHOT 4 — **HIGH-OBLIQUE / BIRD’S-THREE-QUARTER ON-HAND (mandatory contrast):**
- **Camera:** **noticeably above** the hand (high angle) and **off-axis** (~**35–55°** combined pitch+yaw vs a straight-down or straight-on dorsal pass) so **knuckle relief, finger spacing, and foreshortening** sell **3D volume** while **most nail plates remain readable** for color/pattern QA.
- **Pose:** hand may **rest or hover** over white with a **gentle wrist pronation/supination twist** that feels like a **second catalog angle** in the same shoot — **full set** or **4–5 nails** clearly visible; **forbidden:** duplicating shot 1’s near-orthogonal broadside (keep principal axis **clearly** different).
- **Forbidden:** reverting to cup-forward (shot 2) or side-row traverse (shot 3); **forbidden:** another mild dorsal yaw clone of shot 1.

ART FIDELITY (hard):
- Per-slot nail art + accent columns exactly as the product reference; **distal tips** correct on every visible nail.

Single square frame — **clear fourth angle** in the same premium on-hand series.`,
  },
];

/**
 * 包装手握图里模型常画错手（六指、拇指错位、手指从盒缘「长出来」、蜡皮）。
 * 两队 PACKAGING 提示词共用，强调可数解剖与宁可少露手指不可瞎补。
 */
const PACKAGING_HAND_ANATOMY_BLOCK = `HAND & GRIP — ANATOMICAL REALISM (hard rule; treat like QA before ship):
- Show **exactly ONE** adult human hand (**either** left **or** right, pick one coherent view) with **exactly five (5) digits total**: **one thumb + four fingers**. **No sixth finger**, no mirrored duplicate thumb, no fused or split digits, no “finger” that is only a floating tip with no palm attachment.
- **Single continuous palm + wrist**: every visible digit must **join** believably from that palm at natural knuckle angles for **retail grip on a slim rectangular carton** (fingers along one narrow side or corner bundle; thumb stabilizes the **opposite** face or forward edge — physically possible opposition).
- **Occlusion beats invention:** if the box, crop, or perspective hides part of the hand, keep it **hidden** — **never** paint guessed finger stubs in white gaps between box and backdrop.
- Press-on nails on the **live hand** must sit on real nail beds; **no** floating nail plates beside fingers.
- Skin: believable micro-detail (pores, faint creases, subtle subsurface warmth); **avoid** waxy, porcelain, or airbrushed-doll plastic skin.
- If a pose risks ambiguous anatomy, **simplify**: fewer fingers in frame, slightly looser grip, or a modestly wider crop — **never** add anatomy to “fill” the composition.`;

/** 双图包装：FIRST=握姿锚点，SECOND=款式产品图。与 API `editDualSceneNails` 传入顺序一致。 */
const PACKAGING_DUAL_INPUT_PREAMBLE = `You receive TWO images supplied to the editor in this order:
1) **FIRST — POSE / ANATOMY ANCHOR:** A real photograph of a hand holding a retail box (or similar grip). **Treat this frame as authoritative for:** hand identity (left vs right), **exact digit count and skeleton**, finger lengths, joint angles, thumb opposition, wrist entry, **scale and 3D contact** between fingers and cardboard, camera viewpoint, crop, and **skin lighting direction**. Existing nail polish and/or box print in this photo may be **wrong or placeholder** — you will replace them.
2) **SECOND — NAIL PRODUCT SOURCE OF TRUTH:** Press-on nails on a card, tray, flat-lay, or white-grid product shot showing the **exact** artwork (colors, patterns, chrome, decals, tiny charms) that must appear **both** on the live hand’s nails **and** on the nails visible through the packaging window.

HARD RULE — **in-place restyle, not a new hand:**
- **Preserve the FIRST image’s hand geometry and pose**; do **not** redraw a different hand, do **not** change finger count, do **not** “improve” the grip into a new pose.
- Replace only: (a) nail art on visible fingernails → faithful copies from the SECOND reference; (b) box faces / window contents / backing card nails → premium white **windowed** press-on carton with art from the SECOND reference inside the window.
- If the FIRST box shape differs from an ideal retail box, you may **cosmetically** retexture to a tall white windowed carton **while keeping the same 3D pose, occlusions, and finger–box contact lines**.`;

/** 防止模型「美化」或替换花朵/法式边等微纹样 — 与产品图逐枚对齐 */
const PACKAGING_ARTWORK_LOCK_BLOCK = `ARTWORK LOCK — SECOND IMAGE ONLY (non-negotiable; treat mismatch as failure):
- The **SECOND** image is **not inspiration** — it is the **sole graphic truth** for **every** nail’s printed design (base color, gradients, animal/French tips, **flowers**, leaves, logos, dots, lines, foil layout). **Zero** creative reinterpretation.
- **Inside the window** and **on the live hand**, each nail’s art must match the **same slot** in thumb→pinky reading order as on the product reference — **do not** swap which pattern sits on which finger.
- **Forbidden:** redrawing flowers or decals into a “nicer” variant; changing petal **shape or count** (e.g. soft rounded white petals → sharp / spiky / splatter petals); shifting hue or saturation to “pop” more; substituting stock floral graphics; simplifying small icons; inventing details not on the reference.
- **Allowed:** only **perspective warp** and **lighting highlights** that naturally follow the curved nail surface — the **2D motif layout** (shapes, edges, negative space, micro-lines) must remain **recognizably identical** to that nail in the SECOND image.
- 3D gel / chrome blobs: keep **the same silhouette and placement** as on the reference nails — do **not** replace with a different drip pattern.
- **Hand vs window — one source:** art on **each visible live fingernail** must match the **same-slot** nail in the **window** and the **SECOND** reference — **identical** motif, not a looser “hand version.” **Forbidden:** detailed miniatures in the window but simplified or wrong flowers on the fingers.`;

const PACKAGING_WINDOW_AND_SLOT_RULES = `WINDOW BACKING — GRID + PER-SLOT DECOR (failure if violated):
- If the **SECOND** reference shows **ten** retail nails, the backing card **inside the window** must show **exactly two horizontal rows × five columns (2×5)** — same topology as a standard sheet: **five nails per row**, **two rows**, aligned columns. **Forbidden:** inventing a **third row**, 4+4+3 stagger, diagonal collage, curved fan layout, or any count/layout that is **not** a clean 2×5 when the source is a full set.
- Preserve **left-to-right, then top-to-bottom** design order **exactly** as on the SECOND reference (no column swaps, no shuffling art between slots).

ACCENTS (flowers, charms, icons) — **COPY REFERENCE COLUMNS ONLY:**
- Any small accent must appear **only** on the **same column index (1–5 = thumb→pinky)** as on the SECOND reference for that row. Example: if flowers appear **only on columns 2 and 4** in the reference rows, then **columns 1, 3, and 5 have zero flowers** — **thumb (column 1) must not gain a flower** if the reference thumb nail has none. **Forbidden:** “balancing” flowers on thumb/middle/pinky, adding motifs to empty columns, or duplicating a flowered design onto the wrong finger.
- The **live hand** must use the **same slot→finger mapping** as the window (thumb wears column-1 art from the reference, index column 2, etc.) — **no** extra decorations on fingers that are plain in the reference.`;

const PACKAGING_ORIENT_AND_NO_MIX_BLOCK = `FINGERS — STRICT SLOT + ORIENTATION (failure if violated):
- **No pattern mixing:** each visible fingernail may show **only** the artwork from the **same numbered slot** on the SECOND reference (same as the matching window cell). **Forbidden:** borrowing another finger’s motif, blending two slots’ designs, or inventing a hand-only graphic that does not exist on that reference nail.
- **Wear side / front vs back:** the **printed front face** of every press-on faces **outward** toward the viewer on the back-of-hand view; **never** treat the **matte inner / underside** as the display face. Do **not** paste a nail so the **design plane is reversed** vs how it appears on the product sheet for that slot.
- **Proximal–distal on LIVE SKIN ONLY (甲根→指尖):** on **each visible fingernail**, **cuticle / root zone** of the art sits toward the **finger base** and **French / leopard / distal band** toward the **anatomical free edge** — **regardless of** whether that slot is drawn **tips-down inside the window on paper**. The window may match the flat sheet; **worn nails must not** copy the bitmap’s vertical axis onto skin (that causes **180° inverted** wear). **Forbidden:** treating the cell’s “bottom” in the product image as the finger’s “bottom” toward the knuckle.
- **Visual check — “black at the fingertip”:** if the reference has **black or dark brown at the nail tip** (e.g. leopard French), the viewer must see that **dark on the fingertip side of the real hand and inside the window**, never clustered at the knuckle / cuticle on the live fingers.
- **Left–right readability:** asymmetric motifs (flowers, animal streaks, tiny text) must keep the **same chirality** as the reference for that slot after natural 3D wrap — **no** accidental **horizontal mirror** that reverses lettering or asymmetric blooms unless the camera angle physically requires it (prefer preserving motif direction over “pretty” symmetry).`;

const PACKAGING_GRIP_FINGER_SLOT_BLOCK = `VISIBLE GRIP / HOLDING FINGERS — SAME SLOT DISCIPLINE (critical):
- Fingers that **grip the carton** (often a **large, close-up thumb**) still follow **strict column mapping:** the **anatomical thumb** wears **only** the **column-1 (thumb)** nail from the product reference — **never** column-2 or column-4 **floral** art just because the thumb is prominent, nearest the camera, or “needs decoration.”
- **If the reference thumb (column 1) has no flower**, the **live thumb must have no flower** — same for middle/pinky vs columns 3 & 5.
- **Forbidden:** “hero” treatment that copies the prettiest design from another column onto the thumb; **forbidden:** confusing which sheet column maps to the thumb because of pose.
（中文：握盒的拇指再大、再抢镜，也只能用背卡**第 1 列（大拇指）**那一枚的图案；禁止把食指/无名指带花款贴到拇指上。）`;

const PACKAGING_THUMB_AND_TIPS_DOWN_SHEET_BLOCK = `TIPS-DOWN ON CARD → 3D ON HAND — FIX INVERTED **WORN** NAILS ONLY (failure if violated):
- **Scope:** The **nails inside the window** may stay **tips-down on the backing card** exactly like the SECOND reference — that is **correct** and **not** what to “fix.” The failure mode is **only** the **live hand:** worn press-ons must **not** inherit the flat cell’s vertical axis.
- The SECOND reference usually shows each cell with **free edge / French–leopard band toward the BOTTOM of the cell** (paper layout). On **skin**, **re-orient each press-on in 3D** so the **same distal band** caps the **anatomical free edge** — **never** paste so the “tip” graphic sits at the **proximal fold** while nude points to the fingertip (**180° inverted** wear).
- **Thumb (highest risk):** even when the thumb points **up or sideways**, **column-1** art must place **distal tip design on the true thumb free margin** (away from palm / toward air or carton), **not** flipped toward the thenar web. **Do not** rotate window nails to “match” the hand — correct **hand mapping only**.
- **User-facing sanity check:** for leopard / dark French sets, **the black or dark tip must read at the fingertip** on the gripping thumb and every other visible nail — same as the window display and the SECOND reference’s intent.
（中文：开窗里背卡可与参考一致（含甲尖朝下）；**只纠正手上穿戴**：立体对齐解剖游离缘，拇指最易整片反贴；**指尖应是深色**（若有深色尖款）。勿为迁就手而去改窗内排版。）`;

const PACKAGING_PROMPTS: { prompt: string; label: string }[] = [
  {
    label: "包装手握图",
    prompt: `${PACKAGING_DUAL_INPUT_PREAMBLE}

${NAIL_ON_HAND_SHEET_TO_FINGER_ORDER_EN}

${PACKAGING_ARTWORK_LOCK_BLOCK}

${PACKAGING_WINDOW_AND_SLOT_RULES}

${PACKAGING_ORIENT_AND_NO_MIX_BLOCK}

${PACKAGING_GRIP_FINGER_SLOT_BLOCK}

${PACKAGING_THUMB_AND_TIPS_DOWN_SHEET_BLOCK}

TASK — single premium packaging hero:
- Output matches the **FIRST** image’s composition and crop; **pure white #FFFFFF** seamless studio backdrop (replace busy backgrounds from the pose photo if needed, without changing hand or box silhouette).
- **Window display:** press-ons on a subtle pearlescent / iridescent backing card inside the clear window; **strict 2×5** when the SECOND reference is a full ten-nail sheet (see rules above). Wherever nails read as **thumb→pinky** left-to-right within each **horizontal** row on the card:
${WHITE_BG_NAIL_GRID_FINGER_LADDER}

${WHITE_BG_NAIL_GRID_TOP_BASELINE}
- **Box top:** small black sans-serif caps band: × HANDMADE PRESS-ON NAILS ×
- **Box bottom:** bold stacked placeholder title "YOUR COLLECTION" plus optional tiny generic line-art cat mascot (not any real trademark).
- The **same preserved hand** wears the matching press-ons from the SECOND reference on every visible nail bed.

${PACKAGING_HAND_ANATOMY_BLOCK}

Return **one** photorealistic square image only.`,
  },
];

/**
 * 双图 → **单张**开窗盒装主视图。
 * **API 传入顺序（与 `editDualSceneNails` 一致）：FIRST = 摄影/3D 氛围参考图，SECOND = 2D 平面稿。**
 * 先传实拍易锚定光影；**禁止**把 FIRST 当最终画面像素级复刻，所有印刷与窗内甲片须来自 SECOND。
 */
const FLAT_TO_3D_DUAL_PREFIX = `You receive TWO input images supplied to the editor in this **fixed** order:
1) **FIRST — SCENE / LIGHTING ANCHOR ONLY (not final artwork):** A finished photograph or render of a retail box on white (often a competitor or mood packshot with window + nails). **You may use ONLY:** camera viewpoint, lens feel, **key vs fill light direction**, **cast-shadow shape and softness on the sweep**, backdrop brightness, overall exposure, and “premium shelf” depth cues. **You must NOT treat this as the product to duplicate.** **Forbidden (failure):** keeping the **same printed brand name / logotype / colorway / bottom legal strip** as in this FIRST photo when they differ from the SECOND flat; **forbidden:** keeping the **same nail art inside the window** (e.g. same metallic + gem layout) if the SECOND flat shows **different** nails (e.g. plain peach gloss). The FIRST image is a **lighting template**, not the SKU.
2) **SECOND — FLAT 2D SOURCE OF TRUTH (graphics + window nails):** Packaging flat, die-line, or screen mock. **Every** exterior graphic on the final 3D box — panel colors, logos, placeholder text like “YOUR LOGO”, bow icons, barcodes, micro-copy — and the **visual design of press-ons shown in the window area on this flat** (color, simplicity, French shape, etc.) must be **faithfully realized in photoreal 3D**. If the flat is schematic, infer a believable 3D window layout that **honors** that schematic — **do not** import unrelated hero nails from the FIRST photo.

`;

const FLAT_TO_3D_ANTI_LITERAL_COPY_EN = `ANTI–“COPY THE PHOTO” (critical QA gate):
- If your result would still be **instantly recognizable as the same branded pack** as the **FIRST** input (same unrelated trademark wordmark, same nail jewelry motif), you **failed** — **re-skin** the entire box print and **re-place** window nails from the **SECOND** flat only.
- **Self-check before finalize:** (a) Does the box text / logo match the **SECOND** image, not the first? (b) Do the nails in the window match the **SECOND** image’s nail look, not the first photo’s nails?

`;

const FLAT_TO_3D_WINDOWED_BOX_PROMPT = `${FLAT_TO_3D_DUAL_PREFIX}${FLAT_TO_3D_ANTI_LITERAL_COPY_EN}TASK — output **exactly ONE** photorealistic 3D hero photograph: **one** retail press-on carton with a **real clear window**, **re-lit** like the FIRST reference’s scene, but **built from the SECOND flat’s identity**.

HARD STRUCTURE (failure if violated):
- **Single subject:** one folding carton, slight three-quarter or hero angle; **product-only** on white / very light seamless sweep; **natural cast shadow** (derive from FIRST lighting template).
- **Transparent window:** large central **PET / clear plastic** with gloss and refraction; interior **readable** through glass.
- **Window interior nails:** **must** match the **SECOND** flat’s implied or drawn nail set (color, finish, shape). **Never** default to the FIRST photo’s nail styling when it conflicts with the SECOND.
- **Exterior print:** **only** from the **SECOND** flat, correctly warped in 3D perspective onto cardboard.

Return **exactly ONE** square high-resolution image.`;

const FLAT_TO_3D_PACKAGING_PROMPTS: { prompt: string; label: string }[] = [
  {
    label: "3D 开窗盒装主视图",
    prompt: FLAT_TO_3D_WINDOWED_BOX_PROMPT,
  },
];

/** 白底栅格「仅抠图 / 几何矫正」并行出图张数（同 prompt 多次，供用户择优） */
export const WHITE_GRID_DUAL_VARIANT_COUNT = 2;

function buildWhiteGridDualVariantJobs(
  baseLabel: string,
  prompt: string,
): { prompt: string; label: string }[] {
  return Array.from({ length: WHITE_GRID_DUAL_VARIANT_COUNT }, (_, i) => ({
    prompt,
    label: `${baseLabel} · 方案 ${String.fromCharCode(65 + i)}`,
  }));
}

/** 并行多方案、至少成功 1 张即可返回的模式 */
export function modeAllowsPartialDualVariants(mode: GenerationMode): boolean {
  return modeUsesParallelDualVariants(mode);
}

export function promptsForMode(mode: GenerationMode): { prompt: string; label: string }[] {
  switch (mode) {
    case "extract_ten_grid": {
      const baseLabel = generationModeOption("extract_ten_grid").label;
      return buildWhiteGridDualVariantJobs(baseLabel, EXTRACT_TEN_GRID_PROMPT);
    }
    case "extract_angle_scattered": {
      const baseLabel = generationModeOption("extract_angle_scattered").label;
      return buildWhiteGridDualVariantJobs(
        baseLabel,
        EXTRACT_ANGLE_SCATTERED_PROMPT,
      );
    }
    case "white_grid_rectify": {
      const baseLabel = generationModeOption("white_grid_rectify").label;
      return buildWhiteGridDualVariantJobs(baseLabel, WHITE_GRID_RECTIFY_PROMPT);
    }
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
    case "nails_in_box":
      return [];
    case "model_tryon":
    case "accessory_tryon":
    case "ten_singles_grid":
      return [];
  }
}
