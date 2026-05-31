/**
 * 图层编辑器：美甲甲片图层数据类型与工具函数。
 * 每枚甲片作为独立图层，在 Canvas 画布上可自由拖拽、缩放、旋转。
 */

export type NailLayer = {
  id: string;
  /** 甲片图片 URL（带透明通道的 PNG data URL） */
  imageUrl: string;
  /** 画布上的 X 位置（中心点） */
  x: number;
  /** 画布上的 Y 位置（中心点） */
  y: number;
  /** 显示宽度（px） */
  width: number;
  /** 显示高度（px） */
  height: number;
  /** 旋转角度（度） */
  rotation: number;
  /** 图层顺序（越大越前） */
  zIndex: number;
  /** 是否被选中 */
  selected?: boolean;
};

/** 画布默认尺寸 */
export const CANVAS_WIDTH = 1024;
export const CANVAS_HEIGHT = 1024;

/** 默认甲片较长边的初始显示尺寸 */
const DEFAULT_NAIL_LONG_EDGE = 120;

export type NailCropResult = {
  imageUrl: string;
  nativeWidth: number;
  nativeHeight: number;
};

/** 按裁切图原始比例计算画布上的显示尺寸 */
export function layoutSizeFromCrop(
  cropW: number,
  cropH: number,
  targetLongEdge = DEFAULT_NAIL_LONG_EDGE,
): { width: number; height: number } {
  const long = Math.max(cropW, cropH, 1);
  const scale = targetLongEdge / long;
  return {
    width: Math.max(20, Math.round(cropW * scale)),
    height: Math.max(20, Math.round(cropH * scale)),
  };
}

/**
 * 从裁切结果初始化图层数据。
 * 将 N 枚甲片按 2×5 或最优排列放置在画布上，保留每枚的原始宽高比。
 */
export function initLayersFromNails(nails: NailCropResult[]): NailLayer[] {
  const count = nails.length;
  if (count === 0) return [];

  const cols = count <= 5 ? count : 5;
  const rows = Math.ceil(count / cols);

  const gapX = CANVAS_WIDTH / (cols + 1);
  const gapY = CANVAS_HEIGHT / (rows + 1);

  return packLayersByRows(
    nails.map((nail, i) => {
      const row = Math.floor(i / cols);
      const col = i % cols;
      const { width, height } = layoutSizeFromCrop(
        nail.nativeWidth,
        nail.nativeHeight,
      );
      return {
        id: `nail-${i}`,
        imageUrl: nail.imageUrl,
        x: gapX * (col + 1),
        y: gapY * (row + 1),
        width,
        height,
        rotation: 0,
        zIndex: i + 1,
      };
    }),
    20,
    40,
  );
}

/** 自动均匀排列所有图层（重置位置） */
export function autoArrangeLayers(layers: NailLayer[]): NailLayer[] {
  const count = layers.length;
  if (count === 0) return layers;

  const cols = count <= 5 ? count : 5;
  const rows = Math.ceil(count / cols);
  const gapX = CANVAS_WIDTH / (cols + 1);
  const gapY = CANVAS_HEIGHT / (rows + 1);

  return layers.map((layer, i) => {
    const row = Math.floor(i / cols);
    const col = i % cols;
    return {
      ...layer,
      x: gapX * (col + 1),
      y: gapY * (row + 1),
      rotation: 0,
    };
  });
}

/** 统一缩放所有图层 */
export function scaleAllLayers(layers: NailLayer[], factor: number): NailLayer[] {
  return layers.map((layer) => scaleLayer(layer, factor));
}

/** 缩放单个图层（保持中心） */
export function scaleLayer(layer: NailLayer, factor: number): NailLayer {
  return {
    ...layer,
    width: Math.max(MIN_LAYER_SIZE, Math.min(MAX_LAYER_SIZE, layer.width * factor)),
    height: Math.max(MIN_LAYER_SIZE, Math.min(MAX_LAYER_SIZE, layer.height * factor)),
  };
}

const MIN_LAYER_SIZE = 20;
const MAX_LAYER_SIZE = 800;

/** 按 Y 坐标将甲片分组为行（上→下，行内左→右） */
export function groupLayersByRow(
  layers: NailLayer[],
  rowThreshold?: number,
): NailLayer[][] {
  if (layers.length === 0) return [];
  const sorted = [...layers].sort((a, b) => a.y - b.y);
  const avgH = sorted.reduce((s, l) => s + l.height, 0) / sorted.length;
  const threshold = rowThreshold ?? Math.max(36, avgH * 0.4);

  const rows: NailLayer[][] = [];
  for (const layer of sorted) {
    const lastRow = rows[rows.length - 1];
    const refY = lastRow ? lastRow.reduce((s, l) => s + l.y, 0) / lastRow.length : layer.y;
    if (!lastRow || Math.abs(layer.y - refY) > threshold) {
      rows.push([layer]);
    } else {
      lastRow.push(layer);
    }
  }
  for (const row of rows) {
    row.sort((a, b) => a.x - b.x);
  }
  return rows;
}

/** 测量当前布局的平均行内 / 行间间距 */
export function measureLayoutGaps(layers: NailLayer[]): {
  horizontalGap: number;
  verticalGap: number;
} {
  const rows = groupLayersByRow(layers);
  const hGaps: number[] = [];
  for (const row of rows) {
    for (let i = 0; i < row.length - 1; i++) {
      const a = row[i]!;
      const b = row[i + 1]!;
      hGaps.push(b.x - b.width / 2 - (a.x + a.width / 2));
    }
  }
  const vGaps: number[] = [];
  for (let i = 0; i < rows.length - 1; i++) {
    const topRow = rows[i]!;
    const bottomRow = rows[i + 1]!;
    const bottom = Math.max(...topRow.map((l) => l.y + l.height / 2));
    const top = Math.min(...bottomRow.map((l) => l.y - l.height / 2));
    vGaps.push(top - bottom);
  }
  return {
    horizontalGap: hGaps.length
      ? Math.max(0, Math.round(hGaps.reduce((a, b) => a + b, 0) / hGaps.length))
      : 32,
    verticalGap: vGaps.length
      ? Math.max(0, Math.round(vGaps.reduce((a, b) => a + b, 0) / vGaps.length))
      : 48,
  };
}

/**
 * 按指定行内 / 行间间距重新排版（保留尺寸与旋转，仅调整位置）。
 * 每行水平居中，整体垂直居中。
 */
export function packLayersByRows(
  layers: NailLayer[],
  horizontalGap: number,
  verticalGap: number,
): NailLayer[] {
  const rows = groupLayersByRow(layers);
  if (rows.length === 0) return layers;

  const hGap = Math.max(0, horizontalGap);
  const vGap = Math.max(0, verticalGap);

  const rowHeights = rows.map((row) => Math.max(...row.map((l) => l.height)));
  const totalH =
    rowHeights.reduce((s, h) => s + h, 0) + vGap * Math.max(0, rows.length - 1);
  let currentTop = (CANVAS_HEIGHT - totalH) / 2;

  const pos = new Map<string, { x: number; y: number }>();

  for (let ri = 0; ri < rows.length; ri++) {
    const row = rows[ri]!;
    const rowH = rowHeights[ri]!;
    const totalW =
      row.reduce((s, l) => s + l.width, 0) + hGap * Math.max(0, row.length - 1);
    let left = (CANVAS_WIDTH - totalW) / 2;
    const centerY = currentTop + rowH / 2;

    for (const layer of row) {
      pos.set(layer.id, {
        x: left + layer.width / 2,
        y: centerY,
      });
      left += layer.width + hGap;
    }
    currentTop += rowH + vGap;
  }

  return layers.map((l) => {
    const p = pos.get(l.id);
    return p ? { ...l, x: p.x, y: p.y } : l;
  });
}

/** 各行内 Y 对齐到该行平均高度线（便于微调重叠） */
export function alignRowsBaseline(layers: NailLayer[]): NailLayer[] {
  const rows = groupLayersByRow(layers);
  const yById = new Map<string, number>();
  for (const row of rows) {
    const avgY = row.reduce((s, l) => s + l.y, 0) / row.length;
    for (const l of row) {
      yById.set(l.id, avgY);
    }
  }
  return layers.map((l) => {
    const y = yById.get(l.id);
    return y != null ? { ...l, y } : l;
  });
}

/** 各行内按当前顺序均匀分布（保持行内总宽度，调整间距） */
export function distributeRowsEvenly(layers: NailLayer[]): NailLayer[] {
  const rows = groupLayersByRow(layers);
  const pos = new Map<string, { x: number; y: number }>();

  for (const row of rows) {
    if (row.length <= 1) continue;
    const leftEdge = Math.min(...row.map((l) => l.x - l.width / 2));
    const rightEdge = Math.max(...row.map((l) => l.x + l.width / 2));
    const totalW = row.reduce((s, l) => s + l.width, 0);
    const span = rightEdge - leftEdge;
    const gap = Math.max(0, (span - totalW) / (row.length - 1));
    let x = leftEdge;
    const avgY = row.reduce((s, l) => s + l.y, 0) / row.length;
    for (const layer of row) {
      pos.set(layer.id, { x: x + layer.width / 2, y: avgY });
      x += layer.width + gap;
    }
  }

  return layers.map((l) => {
    const p = pos.get(l.id);
    return p ? { ...l, ...p } : l;
  });
}

/** 对齐辅助线 */
export type SnapGuide = {
  orientation: "h" | "v";
  position: number;
};

const SNAP_THRESHOLD = 6;

/**
 * 移动图层时吸附到其他图层 / 画布的中线与边缘，并返回应对齐辅助线。
 */
export function snapLayerPosition(
  layer: NailLayer,
  x: number,
  y: number,
  peers: NailLayer[],
  threshold = SNAP_THRESHOLD,
): { x: number; y: number; guides: SnapGuide[] } {
  const halfW = layer.width / 2;
  const halfH = layer.height / 2;
  const guides: SnapGuide[] = [];

  type SnapCandidate = { delta: number; guide: SnapGuide };

  const xCandidates: SnapCandidate[] = [];
  const yCandidates: SnapCandidate[] = [];

  const tryX = (moving: number, target: number) => {
    const delta = target - moving;
    if (Math.abs(delta) <= threshold) {
      xCandidates.push({ delta, guide: { orientation: "v", position: target } });
    }
  };
  const tryY = (moving: number, target: number) => {
    const delta = target - moving;
    if (Math.abs(delta) <= threshold) {
      yCandidates.push({ delta, guide: { orientation: "h", position: target } });
    }
  };

  const cx = x;
  const cy = y;
  const left = x - halfW;
  const right = x + halfW;
  const top = y - halfH;
  const bottom = y + halfH;

  const xTargets = [CANVAS_WIDTH / 2];
  const yTargets = [CANVAS_HEIGHT / 2];

  for (const p of peers) {
    if (p.id === layer.id) continue;
    const phw = p.width / 2;
    const phh = p.height / 2;
    const pLeft = p.x - phw;
    const pRight = p.x + phw;
    const pTop = p.y - phh;
    const pBottom = p.y + phh;
    xTargets.push(p.x, pLeft, pRight);
    yTargets.push(p.y, pTop, pBottom);
    // 边缘贴边吸附（调重叠时更有用）
    tryX(left, pRight);
    tryX(right, pLeft);
    tryY(top, pBottom);
    tryY(bottom, pTop);
  }

  for (const tx of xTargets) {
    tryX(cx, tx);
    tryX(left, tx);
    tryX(right, tx);
  }
  for (const ty of yTargets) {
    tryY(cy, ty);
    tryY(top, ty);
    tryY(bottom, ty);
  }

  let sx = x;
  let sy = y;

  if (xCandidates.length > 0) {
    const best = xCandidates.reduce((a, b) =>
      Math.abs(a.delta) < Math.abs(b.delta) ? a : b,
    );
    sx += best.delta;
    guides.push(best.guide);
  }
  if (yCandidates.length > 0) {
    const best = yCandidates.reduce((a, b) =>
      Math.abs(a.delta) < Math.abs(b.delta) ? a : b,
    );
    sy += best.delta;
    guides.push(best.guide);
  }

  return { x: sx, y: sy, guides };
}

/** 将图层中心对齐到画布中心 */
export function centerLayerOnCanvas(layer: NailLayer): NailLayer {
  return {
    ...layer,
    x: CANVAS_WIDTH / 2,
    y: CANVAS_HEIGHT / 2,
  };
}
