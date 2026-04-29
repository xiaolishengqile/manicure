/** 用户补充说明：解析 FormData 并拼进图像编辑 prompt（服务端） */

const MAX_USER_EXTRA_NOTES_CHARS = 2500;

export function parseUserExtraNotes(
  entry: FormDataEntryValue | null,
): string | null {
  if (entry == null) return null;
  const raw = typeof entry === "string" ? entry : "";
  const t = raw.trim().replace(/\0/g, "").slice(0, MAX_USER_EXTRA_NOTES_CHARS);
  return t.length ? t : null;
}

/** 将用户意见接在系统提示末尾；无内容则原样返回 */
export function appendUserRefinementToPrompt(
  basePrompt: string,
  notes: string | null,
): string {
  if (!notes) return basePrompt;
  return `${basePrompt}\n\n---\nUSER REFINEMENT (highest priority for this edit; still obey hard layout / slot / safety rules above):\n${notes}\n`;
}
