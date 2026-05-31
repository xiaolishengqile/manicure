# 美甲图层编辑器模式 — 实现计划

## 目标
新增一个「图层编辑器」模式，用户可以：
1. 从上传的美甲图片中**自动抠出单枚甲片**（复用现有 AI 抠图能力）
2. 在**画布上自由拖拽、缩放、旋转**每枚甲片（类似 PS 图层）
3. 精确控制每枚甲片之间的**间距和大小**
4. 导出最终合成图

## 核心思路

**两步流程：**
- **Step 1 — AI 抠图**：用户上传一张美甲产品图，调用 OpenAI 模型逐枚抠出 10 张独立甲片（复用 `extract_ten_grid` 的 prompt 逻辑，但输出为 10 张独立图片而非拼好的栅格）
- **Step 2 — 图层编辑器**：将抠出的甲片加载到 Canvas 画布上，用户可拖拽/缩放/旋转每枚，最终合成导出

## 需要新增/修改的文件

### 1. `lib/generation-modes.ts` — 新增模式定义
- 新增 `layer_editor` 到 `GenerationMode` 联合类型
- 在 `GENERATION_MODE_OPTIONS` 添加选项（短标签：「图层编辑器 · 自由排版」）
- 在 `GENERATION_MODE_GROUPS` 的 `white_grid` 组中添加
- 新增 `parseGenerationMode` 分支
- 新增 `modeIsLayerEditor()` 辅助函数

### 2. `lib/nail-layer-editor.ts` — 图层编辑器核心数据类型
```ts
export type NailLayer = {
  id: string;          // 唯一 ID
  imageUrl: string;    // 甲片图片 URL（带透明通道的 PNG）
  x: number;           // 画布上的 X 位置
  y: number;           // 画布上的 Y 位置
  width: number;       // 显示宽度
  height: number;      // 显示高度
  rotation: number;    // 旋转角度（度）
  zIndex: number;      // 图层顺序
};
```

### 3. `components/nail-layer-canvas.tsx` — Canvas 图层编辑器组件
- 基于 HTML5 Canvas 实现
- 每枚甲片作为一个可交互图层
- 支持操作：
  - **拖拽移动**（mousedown + mousemove）
  - **缩放**（拖拽角部控制点，可选锁定宽高比）
  - **旋转**（拖拽旋转控制点）
  - **选中/取消选中**（点击）
  - **删除图层**
- 工具栏：重置布局、自动均匀排列、锁定/解锁宽高比
- 画布背景：白色或透明棋盘格

### 4. `app/api/extract-nails/route.ts` — 新增 `layer_editor` 模式的 API 处理
- 接收上传图片
- 调用 AI 模型抠出 10 枚独立甲片（使用 `extract_ten_grid` 的 prompt）
- 将每枚甲片单独返回为 base64 PNG（带透明通道）
- 返回 `{ nails: [{ index, imageUrl }] }` 给前端

### 5. `app/page.tsx` — 前端集成
- 新增 `layerEditorNails` state 存储抠出的甲片
- 当模式为 `layer_editor` 时：
  - 上传区域显示「选择含多枚甲片的照片」
  - 点击生成后先调用 API 抠图
  - 抠图完成后切换到图层编辑器视图
  - 编辑器内可继续调整，有「导出最终图」按钮
- 导出时：将 Canvas 转为 PNG 并下载

## 技术选型

- **Canvas 方案**：使用原生 HTML5 Canvas + React state 管理图层数据，不引入额外依赖（项目已是轻量级）
- **甲片抠图**：复用现有 OpenAI `images.edit` 接口，prompt 参考 `EXTRACT_TEN_GRID_PROMPT`，要求模型输出带透明背景的单枚甲片
- **导出合成**：前端 Canvas `toBlob()` 直接导出，无需服务端参与

## 交互流程

```
用户选择「图层编辑器」模式
    ↓
上传一张含多枚甲片的产品图
    ↓
点击「开始抠图」
    ↓
API 返回 10 枚独立甲片（带透明通道）
    ↓
进入图层编辑器画布
    ↓
用户自由拖拽/缩放/旋转每枚甲片
    ↓
点击「导出图片」
    ↓
Canvas 合成 → 下载 PNG
```

## 实现步骤

1. **模式定义**：在 `generation-modes.ts` 添加 `layer_editor` 模式
2. **API 抠图**：在 `route.ts` 添加 `layer_editor` 分支，逐枚抠图返回
3. **图层数据类型**：新建 `nail-layer-editor.ts`
4. **Canvas 编辑器组件**：新建 `nail-layer-canvas.tsx`（核心工作量）
5. **页面集成**：在 `page.tsx` 添加编辑器视图切换逻辑
6. **样式调优**：确保编辑器交互流畅
