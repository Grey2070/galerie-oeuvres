import { getWork, listWorks } from "../../lib/store.mts";
import { galleryPage, notFoundPage, origin, robots, sitemap, workPage, workPath } from "../../lib/render.mts";

// Public pages, server-rendered so search engines read every word and image.
export default async (req: Request) => {
  const url = new URL(req.url);
  const path = url.pathname.replace(/\/+$/, "") || "/";
  const base = origin(req);

  if (path === "/robots.txt") return robots(base);
  if (path === "/sitemap.xml") return sitemap(await listWorks(), base);
  if (path === "/galerie") return Response.redirect(base + "/", 301);

  // Short link printed in the QR codes: /o/<id>
  if (path.startsWith("/o/")) {
    const w = await getWork(path.slice(3));
    if (!w) return notFoundPage();
    return new Response(null, { status: 302, headers: { location: base + workPath(w), "cache-control": "no-store" } });
  }

  if (path.startsWith("/oeuvre/")) {
    const id = path.slice(8).split("-").pop() || "";
    const w = await getWork(id);
    if (!w) return notFoundPage();
    const canonical = workPath(w);
    if (path !== canonical) return Response.redirect(base + canonical, 301);
    return workPage(w, base);
  }

  if (path === "/") return galleryPage(await listWorks(), base);
  return notFoundPage();
};

export const config = {
  path: ["/", "/galerie", "/oeuvre/*", "/o/*", "/sitemap.xml", "/robots.txt"],
  method: ["GET", "HEAD"],
};
