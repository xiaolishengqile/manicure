/** 首次访问时写入 localStorage 的默认「常用提示词」 */

export const DEFAULT_USER_PROMPT_PRESETS: string[] = [
  "指尖法式/深色尖必须落在解剖学真指尖，不要戴反",
  "要求每一行的每个美甲之间保持5px的空白间隙。而且不要改变甲型。",

];

/** 「仅自定义图像提示」常用词条的首次默认（与补充说明列表分存） */
export const DEFAULT_SOLO_IMAGE_PROMPT_PRESETS: string[] = [
  "把背景统一成纯白 #FFFFFF；去掉边缘杂色",
  "轻微校正色温；电商 packshot 气质，阴影干净",
];
