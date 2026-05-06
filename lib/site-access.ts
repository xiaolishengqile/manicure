/** 站点访问口令：仅服务端使用；非空则启用 middleware 与 API 前的校验 */

export const SITE_ACCESS_COOKIE_NAME = "manicure_site_access";

const COOKIE_TTL_SEC = 60 * 60 * 24 * 14; // 14 天

export function isSiteAccessEnabled(): boolean {
  const p = process.env.APP_ACCESS_PASSWORD?.trim();
  return Boolean(p && p.length > 0);
}

function siteAccessPassword(): string {
  return process.env.APP_ACCESS_PASSWORD?.trim() ?? "";
}

async function importHmacKeyFromPassword(password: string): Promise<CryptoKey> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(`manicure|site-access|${password}`),
  );
  return crypto.subtle.importKey(
    "raw",
    digest,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

function bufferToHex(buf: ArrayBuffer): string {
  return [...new Uint8Array(buf)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function hexToBuffer(hex: string): Uint8Array | null {
  if (hex.length % 2 !== 0) return null;
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) {
    const byte = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
    if (Number.isNaN(byte)) return null;
    out[i] = byte;
  }
  return out;
}

/** 登录成功后写入 Cookie 的明文值 */
export async function signSiteAccessCookieValue(): Promise<string | null> {
  const password = siteAccessPassword();
  if (!password) return null;
  const exp = Math.floor(Date.now() / 1000) + COOKIE_TTL_SEC;
  const payload = String(exp);
  const key = await importHmacKeyFromPassword(password);
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(payload),
  );
  return `${payload}.${bufferToHex(sig)}`;
}

export async function verifySiteAccessCookieValue(
  cookieValue: string | undefined,
): Promise<boolean> {
  if (!cookieValue || !isSiteAccessEnabled()) return false;
  const password = siteAccessPassword();
  if (!password) return false;

  const dot = cookieValue.lastIndexOf(".");
  if (dot <= 0) return false;
  const expStr = cookieValue.slice(0, dot);
  const sigHex = cookieValue.slice(dot + 1);
  const exp = Number(expStr);
  if (!Number.isFinite(exp) || exp < Math.floor(Date.now() / 1000)) return false;

  const sigBuf = hexToBuffer(sigHex);
  if (!sigBuf) return false;
  const key = await importHmacKeyFromPassword(password);
  const sigCopy = new Uint8Array(sigBuf.byteLength);
  sigCopy.set(sigBuf);
  return crypto.subtle.verify(
    "HMAC",
    key,
    sigCopy,
    new TextEncoder().encode(expStr),
  );
}

export function siteAccessCookieMaxAge(): number {
  return COOKIE_TTL_SEC;
}

export function siteAccessCookieSecure(): boolean {
  return process.env.NODE_ENV === "production" || process.env.VERCEL === "1";
}
