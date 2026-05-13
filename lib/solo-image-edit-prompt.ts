/** 仅自定义图像编辑提示：有内容时服务端不拼接系统默认 prompt，只发本段 + 图片 */

const MAX_SOLO_IMAGE_EDIT_PROMPT_CHARS = 4000;

export function parseSoloImageEditPrompt(
  entry: FormDataEntryValue | null,
): string | null {
  if (entry == null) return null;
  const raw = typeof entry === "string" ? entry : "";
  const t = raw.trim().replace(/\0/g, "").slice(0, MAX_SOLO_IMAGE_EDIT_PROMPT_CHARS);
  return t.length ? t : null;
}
