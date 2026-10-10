import { createHash, createHmac, timingSafeEqual } from "node:crypto";

const COOKIE = "gal_s";
const DAYS = 30;

declare const Netlify: { env: { get(k: string): string | undefined } } | undefined;

export function env(key: string): string | undefined {
  try {
    if (typeof Netlify !== "undefined" && Netlify?.env) {
      const v = Netlify.env.get(key);
      if (v !== undefined) return v;
    }
  } catch {}
  return process.env[key];
}

function password(): string {
  return (env("ADMIN_PASSWORD") || "").trim();
}

export function isConfigured(): boolean {
  return password().length > 0;
}

function signingKey(): Buffer {
  return createHash("sha256").update("galerie-session:" + password()).digest();
}

export function passwordMatches(candidate: unknown): boolean {
  const p = password();
  if (!p) return false;
  const a = createHash("sha256").update(String(candidate ?? "")).digest();
  const b = createHash("sha256").update(p).digest();
  return timingSafeEqual(a, b);
}

export function sessionCookie(): string {
  const exp = String(Date.now() + DAYS * 86400e3);
  const sig = createHmac("sha256", signingKey()).update(exp).digest("base64url");
  return `${COOKIE}=${exp}.${sig}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${DAYS * 86400}`;
}

export function clearCookie(): string {
  return `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;
}

export function isAuthed(req: Request): boolean {
  if (!isConfigured()) return false;
  const m = (req.headers.get("cookie") || "").match(/(?:^|;\s*)gal_s=([^;]+)/);
  if (!m) return false;
  const [exp, sig] = m[1].split(".");
  if (!exp || !sig || !/^\d+$/.test(exp) || Number(exp) < Date.now()) return false;
  const good = createHmac("sha256", signingKey()).update(exp).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(good);
  return a.length === b.length && timingSafeEqual(a, b);
}
