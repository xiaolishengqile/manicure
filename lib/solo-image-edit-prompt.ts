/** 仅自定义图像编辑：有内容时不拼长系统 prompt，只拼极短底线 + 用户框内文 + 图片 */

const MAX_SOLO_IMAGE_EDIT_PROMPT_CHARS = 4000;

/** 自动加在用户输入前，防止白底商业气质被完全稀释 */
export const SOLO_IMAGE_EDIT_BASE_LINES = [
  "背景：整幅背景为均匀平面的纯白 #FFFFFF；",
  "用途：电商主图 / 白底 packshot 气质，（除非你框里明确要求）。",
].join("\n");

export function parseSoloImageEditPrompt(
  entry: FormDataEntryValue | null,
): string | null {
  if (entry == null) return null;
  const raw = typeof entry === "string" ? entry : "";
  const t = raw.trim().replace(/\0/g, "").slice(0, MAX_SOLO_IMAGE_EDIT_PROMPT_CHARS);
  return t.length ? t : null;
}

/** 完整发给 images.edit 的 prompt（两句底线 + 用户正文） */
export function buildFullSoloImageEditPrompt(userBody: string): string {
  return `${SOLO_IMAGE_EDIT_BASE_LINES}\n\n${userBody.trim()}`;
}
