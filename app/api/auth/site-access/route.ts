import { cookies } from "next/headers";
import { timingSafeEqual, createHash } from "node:crypto";
import { NextResponse } from "next/server";

import {
  SITE_ACCESS_COOKIE_NAME,
  isSiteAccessEnabled,
  signSiteAccessCookieValue,
  siteAccessCookieMaxAge,
  siteAccessCookieSecure,
  verifySiteAccessCookieValue,
} from "@/lib/site-access";

export const runtime = "nodejs";

function verifyPasswordConstantTime(input: string, expected: string): boolean {
  if (expected.length === 0) return false;
  const a = createHash("sha256").update(input, "utf8").digest();
  const b = createHash("sha256").update(expected, "utf8").digest();
  return timingSafeEqual(a, b);
}

/** 是否已开启口令、以及当前请求是否带有效 Cookie（给前端决定是否显示「退出」） */
export async function GET() {
  if (!isSiteAccessEnabled()) {
    return NextResponse.json({ gateEnabled: false, ok: true });
  }
  const jar = await cookies();
  const raw = jar.get(SITE_ACCESS_COOKIE_NAME)?.value;
  const ok = await verifySiteAccessCookieValue(raw);
  return NextResponse.json({ gateEnabled: true, ok });
}

export async function POST(req: Request) {
  if (!isSiteAccessEnabled()) {
    return NextResponse.json({ error: "未启用访问口令" }, { status: 400 });
  }
  const expected = process.env.APP_ACCESS_PASSWORD?.trim() ?? "";
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "请求体无效" }, { status: 400 });
  }
  const password =
    typeof body === "object" &&
    body !== null &&
    "password" in body &&
    typeof (body as { password: unknown }).password === "string"
      ? (body as { password: string }).password
      : "";

  if (!verifyPasswordConstantTime(password, expected)) {
    return NextResponse.json({ error: "口令错误" }, { status: 401 });
  }

  const value = await signSiteAccessCookieValue();
  if (!value) {
    return NextResponse.json({ error: "服务器配置异常" }, { status: 500 });
  }

  const jar = await cookies();
  jar.set(SITE_ACCESS_COOKIE_NAME, value, {
    httpOnly: true,
    secure: siteAccessCookieSecure(),
    sameSite: "lax",
    path: "/",
    maxAge: siteAccessCookieMaxAge(),
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE() {
  const jar = await cookies();
  jar.delete(SITE_ACCESS_COOKIE_NAME);
  return NextResponse.json({ ok: true });
}
