/** 模特试戴：常用甲型轮廓（与产品图花色独立，用于约束上手后的外轮廓） */

export type NailShapeProfileId =
  | "follow_product"
  | "almond"
  | "short_almond"
  | "short_oval"
  | "medium_oval"
  | "new_short_square"
  | "medium_square";

export const DEFAULT_NAIL_SHAPE_PROFILE: NailShapeProfileId = "follow_product";

export const NAIL_SHAPE_PROFILE_OPTIONS: {
  id: NailShapeProfileId;
  label: string;
  shortLabel: string;
  description: string;
  /** public/references/nail-shapes/ 下图示（follow_product 无图） */
  referenceImagePath?: string;
}[] = [
  {
    id: "follow_product",
    label: "与产品图一致",
    shortLabel: "跟随产品",
    description: "不额外改轮廓，以第二张美甲产品图的甲型与长短为准。",
  },
  {
    id: "almond",
    label: "杏仁款",
    shortLabel: "杏仁",
    description: "经典杏仁：根部较宽、两侧内收、指尖圆润尖；整体偏长。",
    referenceImagePath: "/references/nail-shapes/almond.png",
  },
  {
    id: "short_almond",
    label: "短杏仁",
    shortLabel: "短杏仁",
    description: "杏仁 taper + 圆尖，但长度偏短，更接近日常自然甲长。",
    referenceImagePath: "/references/nail-shapes/short-almond.png",
  },
  {
    id: "short_oval",
    label: "短椭圆",
    shortLabel: "短椭圆",
    description: "椭圆弧游离缘、侧边柔和，整体短而圆润。",
    referenceImagePath: "/references/nail-shapes/short-oval.png",
  },
  {
    id: "medium_oval",
    label: "中椭圆",
    shortLabel: "中椭圆",
    description: "椭圆轮廓，长度介于短椭圆与长杏仁之间。",
    referenceImagePath: "/references/nail-shapes/medium-oval.png",
  },
  {
    id: "new_short_square",
    label: "新短方",
    shortLabel: "新短方",
    description: "短方甲：侧壁较直、甲尖偏平，角略圆；整体短。",
    referenceImagePath: "/references/nail-shapes/new-short-square.png",
  },
  {
    id: "medium_square",
    label: "中方",
    shortLabel: "中方",
    description: "中方甲：平直游离缘、方角感明显，长度中等。",
    referenceImagePath: "/references/nail-shapes/medium-square.png",
  },
];

export function nailShapeProfileOption(id: NailShapeProfileId) {
  const opt = NAIL_SHAPE_PROFILE_OPTIONS.find((o) => o.id === id);
  if (!opt) throw new Error(`Unknown nail shape profile: ${id}`);
  return opt;
}

export function parseNailShapeProfile(
  raw: FormDataEntryValue | null,
): NailShapeProfileId {
  const s = typeof raw === "string" ? raw.trim() : "";
  const ids = new Set(NAIL_SHAPE_PROFILE_OPTIONS.map((o) => o.id));
  if (ids.has(s as NailShapeProfileId)) return s as NailShapeProfileId;
  return DEFAULT_NAIL_SHAPE_PROFILE;
}

const SHAPE_SILHOUETTE_EN: Record<
  Exclude<NailShapeProfileId, "follow_product">,
  string
> = {
  almond: `**ALMOND (杏仁款) — silhouette authority:**
- **Length class:** medium–long press-on; thumb/index noticeably longer than pinky (retail ladder), but **not** stiletto-thin.
- **Free edge:** soft pointed almond apex — **narrower than the root**, sides taper smoothly inward; **forbidden:** flat square tip, blunt squoval, or generic medium-oval dome.
- **Sidewalls:** gentle C-curve taper toward tip; corner radius small at apex only.
- **Typical plate length (M size, mm, for scale):** thumb ~25, index ~22, middle ~24, ring ~22, pinky ~19 — preserve **relative** steps, not exact mm if perspective differs.`,

  short_almond: `**SHORT ALMOND (短杏仁) — silhouette authority:**
- **Length class:** short–medium; clearly **shorter** than classic almond but **same taper family** (sides pinch toward a soft point).
- **Free edge:** rounded almond point, **not** a flat square; **forbidden:** lengthening into long almond or blunting into short round ball.
- **Sidewalls:** visible taper vs width at root; avoid “pill” oval where width equals tip.
- **Typical plate length (M size, mm):** thumb ~20, index ~18, middle ~19, ring ~18, pinky ~16.`,

  short_oval: `**SHORT OVAL (短椭圆) — silhouette authority:**
- **Length class:** short; natural everyday length.
- **Free edge:** smooth **symmetric elliptical arc** — width stays fairly even from sidewall to sidewall; **forbidden:** sharp almond apex, flat square edge, or coffin taper.
- **Sidewalls:** softly curved; tip is a **dome arc**, not a corner.
- **Typical plate length (M size, mm):** thumb ~19.5, index ~17, middle ~17.5, ring ~17, pinky ~16.`,

  medium_oval: `**MEDIUM OVAL (中椭圆) — silhouette authority:**
- **Length class:** medium; longer than short oval, **shorter** than long almond.
- **Free edge:** full **oval/ellipse** curve — balanced width at tip vs root; **forbidden:** squaring the tip or sharpening into stiletto/almond.
- **Sidewalls:** continuous curve; no straight vertical side walls.
- **Typical plate length (M size, mm):** thumb ~24, index ~21, middle ~22, ring ~21, pinky ~20.`,

  new_short_square: `**NEW SHORT SQUARE (新短方) — silhouette authority:**
- **Length class:** short; compact plate.
- **Free edge:** **predominantly flat** across the tip with **slightly softened corners** (modern short square / squoval-short) — **forbidden:** oval dome tip, almond point, or extreme coffin taper.
- **Sidewalls:** relatively straight vertical segments before the flat top; C-curve moderate.
- **Typical plate length (M size, mm):** thumb ~17.5, index ~17, middle ~17.5, ring ~17, pinky ~14.`,

  medium_square: `**MEDIUM SQUARE (中方) — silhouette authority:**
- **Length class:** medium-short; **not** long coffin.
- **Free edge:** **flat, squared-off** with **true corners** (medium square profile) — **forbidden:** rounding into oval/almond or extreme stiletto.
- **Sidewalls:** straight side walls meeting the free edge at near-right angles; corner radius minimal.
- **Typical plate length (M size, mm):** thumb ~20.2, index ~17.5, middle ~19, ring ~17.5, pinky ~15.`,
};

/** 拼入 MODEL_TRYON 提示词；follow_product 返回空串 */
export function buildTryonNailShapePromptBlock(
  profileId: NailShapeProfileId,
): string {
  if (profileId === "follow_product") return "";

  const opt = nailShapeProfileOption(profileId);
  const silhouette = SHAPE_SILHOUETTE_EN[profileId];

  return `USER-SELECTED NAIL SHAPE PROFILE — **${opt.label}** (mandatory for worn press-ons; failure if violated):
- Apply **only** to the **outer silhouette / length class / free-edge family** on the model’s hand. **Nail art** (color, pattern, French, charms, glitter) must still come **only** from the SECOND (product) image per finger slot — **do not** replace motifs with the shape reference photo.
- **Shape vs art:** you may **perspective-warp** art onto the selected shape, but the **2D motif layout** per slot must stay recognizable from the product reference. **Forbidden:** keeping product art but leaving a **wrong** tip family (e.g. square product worn as long almond, or oval worn as flat square).
- **Finger ladder:** keep subtle thumb→pinky size steps like a real retail set; do **not** make all five identical width/length unless the product sheet shows one SKU size.
- **Do not** “beautify” into a generic medium oval — match **${opt.label}** geometry.

${silhouette}

（中文：用户选定甲型为「${opt.label}」；上手轮廓须符合该甲型；花色图案仍严格来自产品图对应格位。）`;
}
