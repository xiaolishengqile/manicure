import sharp from "sharp";

/** 白底参考拼图边长；与常见 image edit 上限兼容，单格仍有足够细节 */
const COLLAGE_SIDE = 1600;

function cellSlotBadgeSvg(slot1Based: number, box: number): Buffer {
  const fs = Math.max(12, Math.floor(box * 0.45));
  const svg = `<svg width="${box}" height="${box}" xmlns="http://www.w3.org/2000/svg">
  <rect x="1" y="1" width="${box - 2}" height="${box - 2}" rx="4" fill="#ffffff" stroke="#222" stroke-width="1.5"/>
  <text x="50%" y="50%" dominant-baseline="central" text-anchor="middle"
    font-size="${fs}" fill="#111" font-family="system-ui,sans-serif" font-weight="700">${slot1Based}</text>
</svg>`;
  return Buffer.from(svg, "utf8");
}

/**
 * 将已归一化的 10 枚 PNG（顺序 = 用户第 1–10 格）拼成一张 2×5 白底参考图，左上起第 1–5 为上排。
 */
export async function buildTenSinglesCollageReference(
  cellPngBuffers: Buffer[],
): Promise<Buffer> {
  if (cellPngBuffers.length !== 10) {
    throw new Error("buildTenSinglesCollageReference requires exactly 10 buffers");
  }
  const W = COLLAGE_SIDE;
  const H = COLLAGE_SIDE;
  const margin = Math.round(W * 0.032);
  const gutter = Math.max(6, Math.round(W * 0.006));
  const cols = 5;
  const rows = 2;
  const innerW = W - 2 * margin;
  const innerH = H - 2 * margin;
  const cellW = (innerW - (cols - 1) * gutter) / cols;
  const cellH = (innerH - (rows - 1) * gutter) / rows;

  const composites: sharp.OverlayOptions[] = [];

  for (let i = 0; i < 10; i++) {
    const r = Math.floor(i / 5);
    const c = i % 5;
    const left = Math.round(margin + c * (cellW + gutter));
    const top = Math.round(margin + r * (cellH + gutter));
    const cw = Math.round(cellW);
    const ch = Math.round(cellH);

    // 单枚已归一为「指尖朝下」→ 甲根/后缘在图像上方；格内上对齐 (north) 使同一行后缘落在同一水平线（与用户示意一致）
    const fitted = await sharp(cellPngBuffers[i])
      .resize({
        width: cw,
        height: ch,
        fit: "contain",
        position: "north",
        background: { r: 255, g: 255, b: 255, alpha: 1 },
      })
      .png()
      .toBuffer();

    composites.push({ input: fitted, left, top });

    const badge = Math.min(36, Math.round(Math.min(cw, ch) * 0.14));
    composites.push({
      input: cellSlotBadgeSvg(i + 1, badge),
      left: left + 4,
      top: top + ch - badge - 4,
    });
  }

  return sharp({
    create: {
      width: W,
      height: H,
      channels: 3,
      background: { r: 255, g: 255, b: 255 },
    },
  })
    .composite(composites)
    .png({ compressionLevel: 6 })
    .toBuffer();
}
