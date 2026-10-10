import { randomBytes } from "node:crypto";
import { purgeCache } from "@netlify/functions";
import { clearCookie, isAuthed, isConfigured, passwordMatches, sessionCookie } from "../../lib/auth.mts";
import { deleteWork, getWork, listWorks, saveImage, saveWork, type Work } from "../../lib/store.mts";
import { workPath } from "../../lib/render.mts";

const json = (data: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...headers },
  });
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Public pages are cached on Netlify's CDN; clear them so a change shows up at once.
async function refresh(extraTags: string[] = []) {
  try {
    await purgeCache({ tags: ["pages", ...extraTags] });
  } catch (e) {
    console.error("Cache purge failed:", e);
  }
}

const LIMITS: Record<string, number> = { title: 200, artist: 160, year: 40, technique: 200, dims: 120, desc: 6000, price: 80 };
const MAX_IMAGE = 4_000_000;

function newId(): string {
  return randomBytes(8).toString("hex").replace(/[^a-z0-9]/g, "").slice(0, 8) || String(Date.now());
}
const version = () => Date.now().toString(36);

async function imageFrom(form: FormData, name: string): Promise<ArrayBuffer | null | "invalid"> {
  const f = form.get(name);
  if (!f || typeof f === "string") return null;
  const file = f as File;
  if (!/^image\/jpeg$/.test(file.type) || file.size === 0 || file.size > MAX_IMAGE) return "invalid";
  const buf = await file.arrayBuffer();
  const b = new Uint8Array(buf);
  if (b[0] !== 0xff || b[1] !== 0xd8) return "invalid";
  return buf;
}

function applyFields(form: FormData, w: Partial<Work>) {
  for (const key of Object.keys(LIMITS)) {
    const v = form.get(key);
    if (typeof v === "string") (w as Record<string, unknown>)[key] = v.trim().slice(0, LIMITS[key]);
  }
  const sold = form.get("sold");
  if (typeof sold === "string") w.sold = sold === "1" || sold === "true";
  for (const k of ["w", "h"] as const) {
    const v = Number(form.get(k));
    if (Number.isFinite(v) && v > 0 && v < 20000) w[k] = Math.round(v);
  }
}

const publicWork = (w: Work) => ({ ...w, path: workPath(w) });

export default async (req: Request) => {
  const url = new URL(req.url);
  const path = url.pathname.replace(/\/+$/, "");
  const method = req.method.toUpperCase();

  // Reject cross-site writes.
  if (method !== "GET" && method !== "HEAD") {
    const o = req.headers.get("origin");
    if (o && o !== url.origin) return json({ error: "Origine refusée." }, 403);
  }

  if (path === "/api/session" && method === "GET") {
    return json({ configured: isConfigured(), authed: isAuthed(req) });
  }

  if (path === "/api/login" && method === "POST") {
    if (!isConfigured()) return json({ error: "not_configured" }, 503);
    let pw = "";
    try {
      pw = String(((await req.json()) as { password?: string }).password || "");
    } catch {}
    if (!passwordMatches(pw)) {
      await sleep(900);
      return json({ error: "Mot de passe incorrect." }, 401);
    }
    return json({ ok: true }, 200, { "set-cookie": sessionCookie() });
  }

  if (path === "/api/logout" && method === "POST") {
    return json({ ok: true }, 200, { "set-cookie": clearCookie() });
  }

  if (!isAuthed(req)) return json({ error: "Session expirée. Reconnectez-vous." }, 401);

  if (path === "/api/works" && method === "GET") {
    return json({ works: (await listWorks()).map(publicWork) });
  }

  if (path === "/api/works" && method === "POST") {
    const form = await req.formData();
    const image = await imageFrom(form, "image");
    const thumb = await imageFrom(form, "thumb");
    if (!image || image === "invalid") return json({ error: "La photo est manquante ou illisible." }, 400);
    const all = await listWorks();
    let id = newId();
    while (all.some((x) => x.id === id)) id = newId();
    const now = Date.now();
    const w: Work = {
      id, n: all.reduce((m, x) => Math.max(m, x.n || 0), 0) + 1,
      title: "", artist: "", year: "", technique: "", dims: "", desc: "", price: "", sold: false,
      w: 1200, h: 1500, v: version(), added: now, updated: now,
    };
    applyFields(form, w);
    if (!w.title) return json({ error: "Indiquez le titre de l’œuvre." }, 400);
    await saveImage(id, image);
    await saveImage(id + "-s", thumb && thumb !== "invalid" ? thumb : image);
    await saveWork(w);
    await refresh();
    return json({ work: publicWork(w) }, 201);
  }

  const m = /^\/api\/works\/([a-z0-9]+)$/.exec(path);
  if (m) {
    const w = await getWork(m[1]);
    if (!w) return json({ error: "Cette œuvre n’existe plus." }, 404);

    if (method === "DELETE") {
      await deleteWork(w.id);
      await refresh(["img-" + w.id]);
      return json({ ok: true });
    }

    if (method === "POST") {
      const form = await req.formData();
      const image = await imageFrom(form, "image");
      const thumb = await imageFrom(form, "thumb");
      if (image === "invalid") return json({ error: "La nouvelle photo est illisible." }, 400);
      applyFields(form, w);
      if (!w.title) return json({ error: "Indiquez le titre de l’œuvre." }, 400);
      if (image) {
        await saveImage(w.id, image);
        await saveImage(w.id + "-s", thumb && thumb !== "invalid" ? thumb : image);
        w.v = version();
      }
      w.updated = Date.now();
      await saveWork(w);
      await refresh();
      return json({ work: publicWork(w) });
    }
  }

  return json({ error: "Introuvable." }, 404);
};

export const config = { path: ["/api/session", "/api/login", "/api/logout", "/api/works", "/api/works/*"] };
