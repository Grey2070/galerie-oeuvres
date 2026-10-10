import type { Work } from "./store.mts";
import { env } from "./auth.mts";

export const FONTS =
  "https://fonts.googleapis.com/css2?family=EB+Garamond:ital,wght@0,400;0,500;1,400&family=Pinyon+Script&display=swap";

export function esc(s: unknown): string {
  return String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string,
  );
}

export const siteTitle = () => (env("SITE_TITLE") || "Galerie d’art").trim();
const siteDescription = () =>
  (env("SITE_DESCRIPTION") ||
    "Les œuvres actuellement exposées : photographie, description et prix de chaque œuvre.").trim();

/** Public origin: the site's primary URL (custom domain once set), else the request's own. */
export function origin(req: Request): string {
  const u = (env("URL") || "").trim().replace(/\/+$/, "");
  return /^https?:\/\//.test(u) ? u : new URL(req.url).origin;
}

export function slugify(s: string): string {
  return String(s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/œ/gi, "oe")
    .replace(/æ/gi, "ae")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 70)
    .replace(/-+$/, "");
}

export const workPath = (w: Work) => {
  const s = slugify(w.title);
  return "/oeuvre/" + (s ? s + "-" : "") + w.id;
};
export const imgPath = (w: Work, small = false) => `/img/${w.id}/${w.v}${small ? "-s" : ""}.jpg`;
const pad = (n: number) => (n < 10 ? "0" + n : String(n));

function clip(s: string, max: number): string {
  const t = String(s || "").replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max - 1);
  return cut.slice(0, Math.max(cut.lastIndexOf(" "), max * 0.6)).trim() + "…";
}

function workSummary(w: Work): string {
  const head = [w.title, w.artist, w.year].filter(Boolean).join(", ");
  const tail = [w.technique, w.dims].filter(Boolean).join(", ");
  return [head, tail].filter(Boolean).join(". ") + ".";
}

type Layout = {
  title: string;
  description: string;
  canonical?: string;
  image?: { url: string; w: number; h: number; alt: string };
  jsonld?: unknown;
  body: string;
  robots?: string;
  ogType?: string;
  status?: number;
};

/** Shared CDN cache for public pages: served without re-running the function, purged on every change. */
export const CDN_CACHE: Record<string, string> = {
  "netlify-cdn-cache-control": "public, durable, s-maxage=86400, stale-while-revalidate=604800",
  "netlify-cache-tag": "pages",
  "netlify-vary": "query=v",
};

export function page(o: Layout): Response {
  const img = o.image;
  const html = `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>${esc(o.title)}</title>
<meta name="description" content="${esc(o.description)}">
<meta name="robots" content="${o.robots || "index,follow,max-image-preview:large"}">
${o.canonical ? `<link rel="canonical" href="${esc(o.canonical)}">\n<meta property="og:url" content="${esc(o.canonical)}">` : ""}
<meta property="og:type" content="${o.ogType || "website"}">
<meta property="og:locale" content="fr_FR">
<meta property="og:site_name" content="${esc(siteTitle())}">
<meta property="og:title" content="${esc(o.title)}">
<meta property="og:description" content="${esc(o.description)}">
${img ? `<meta property="og:image" content="${esc(img.url)}">
<meta property="og:image:width" content="${img.w}">
<meta property="og:image:height" content="${img.h}">
<meta property="og:image:alt" content="${esc(img.alt)}">
<meta name="twitter:card" content="summary_large_image">` : `<meta name="twitter:card" content="summary">`}
<meta name="theme-color" content="#ffffff">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="${FONTS}">
<link rel="stylesheet" href="/assets/style.css">
${o.jsonld ? `<script type="application/ld+json">${JSON.stringify(o.jsonld).replace(/</g, "\\u003c")}</script>` : ""}
</head>
<body>
${o.body}
<script src="/assets/site.js" defer></script>
</body>
</html>`;
  return new Response(html, {
    status: o.status || 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "public, max-age=0, must-revalidate",
      ...(o.status && o.status !== 200 ? {} : CDN_CACHE),
    },
  });
}

function header(current: boolean): string {
  return `<header class="top"><nav class="top-in" aria-label="Navigation"><span class="orn" aria-hidden="true"></span><a class="tab" href="/"${current ? ' aria-current="page"' : ""}>Galerie</a><span class="orn" aria-hidden="true"></span></nav></header>`;
}

function who(w: Work): string {
  if (!w.artist && !w.year) return "";
  return `<p class="who">${w.artist ? `<em>${esc(w.artist)}</em>` : ""}${w.artist && w.year ? ", " : ""}${w.year ? esc(w.year) : ""}</p>`;
}
function tech(w: Work): string {
  const p = [w.technique, w.dims].filter(Boolean).map(esc);
  return p.length ? `<p class="tech">${p.join(" · ")}</p>` : "";
}
function price(w: Work): string {
  const val = w.sold
    ? '<span class="dot" aria-hidden="true"></span>Vendue'
    : w.price
      ? esc(w.price)
      : "<em>Sur demande</em>";
  return `<p class="price"><span class="lbl">Prix</span><span class="lead" aria-hidden="true"></span><span class="val">${val}</span></p>`;
}
const alt = (w: Work) => w.title + (w.artist ? ", " + w.artist : "");

export function galleryPage(works: Work[], base: string): Response {
  const title = `Œuvres exposées · ${siteTitle()}`;
  const sold = works.filter((w) => w.sold).length;
  let body: string;
  if (!works.length) {
    body = `${header(true)}<main class="page"><section class="empty enter"><p class="eyebrow">Catalogue de l’exposition</p><h1 class="script">L’accrochage se prépare</h1><p>Les œuvres apparaîtront ici dès leur mise en exposition.</p></section></main>`;
  } else {
    const items = works
      .map((w, i) => {
        const href = workPath(w);
        return `<li class="card enter" style="--i:${Math.min(i + 1, 9)}">
<a class="mat" href="${href}" aria-label="${esc(alt(w))}"><img src="${imgPath(w, true)}" width="${w.w}" height="${w.h}" alt="${esc(alt(w))}" ${i < 3 ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async"></a>
<div class="cartel-s"><p class="no">N° ${pad(w.n)}${w.sold ? ' <span class="dot" title="Vendue"></span>' : ""}</p>
<h2 class="script t"><a href="${href}">${esc(w.title)}</a></h2>${who(w)}${tech(w)}${w.desc ? `<p class="desc clamp">${esc(w.desc)}</p>` : ""}${price(w)}</div></li>`;
      })
      .join("\n");
    body = `${header(true)}<main class="page"><section class="intro enter"><div><p class="eyebrow">Catalogue de l’exposition</p><h1 class="script">Les œuvres exposées</h1></div><p class="count">${works.length} œuvre${works.length > 1 ? "s" : ""}${sold ? ` · ${sold} vendue${sold > 1 ? "s" : ""}` : ""}</p></section>
<ol class="catalogue">
${items}
</ol></main>`;
  }
  const first = works[0];
  return page({
    title,
    description: siteDescription(),
    canonical: base + "/",
    image: first ? { url: base + imgPath(first), w: first.w, h: first.h, alt: alt(first) } : undefined,
    jsonld: {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      name: "Œuvres exposées",
      description: siteDescription(),
      url: base + "/",
      inLanguage: "fr",
      mainEntity: {
        "@type": "ItemList",
        numberOfItems: works.length,
        itemListElement: works.map((w, i) => ({ "@type": "ListItem", position: i + 1, url: base + workPath(w), name: w.title })),
      },
    },
    body,
  });
}

export function workPage(w: Work, base: string): Response {
  const url = base + workPath(w);
  const body = `<main class="page"><article class="work">
<figure class="work-photo enter"><a class="zoom" href="${imgPath(w)}" aria-label="Agrandir la photo"><img src="${imgPath(w)}" width="${w.w}" height="${w.h}" alt="${esc(alt(w))}" fetchpriority="high"></a></figure>
<div class="cartel enter" style="--i:2"><p class="no">N° ${pad(w.n)}</p><h1 class="script t">${esc(w.title)}</h1>${who(w)}${tech(w)}
<div class="rule" aria-hidden="true"><span></span></div>${w.desc ? `<p class="desc">${esc(w.desc)}</p>` : ""}${price(w)}</div>
<p class="back enter" style="--i:4"><a href="/">Voir toutes les œuvres</a></p>
</article></main>`;
  const jsonld: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "VisualArtwork",
    name: w.title,
    url,
    image: base + imgPath(w),
    description: w.desc || workSummary(w),
    inLanguage: "fr",
  };
  if (w.artist) jsonld.creator = { "@type": "Person", name: w.artist };
  if (w.year) jsonld.dateCreated = w.year;
  if (w.technique) jsonld.artMedium = w.technique;
  return page({
    title: `${w.title}${w.artist ? " — " + w.artist : ""} · ${siteTitle()}`,
    description: clip(w.desc ? workSummary(w) + " " + w.desc : workSummary(w), 158),
    canonical: url,
    image: { url: base + imgPath(w), w: w.w, h: w.h, alt: alt(w) },
    ogType: "article",
    jsonld,
    body,
  });
}

export function notFoundPage(): Response {
  return page({
    title: `Œuvre introuvable · ${siteTitle()}`,
    description: "Cette œuvre n’est plus exposée.",
    robots: "noindex,follow",
    status: 404,
    body: `${header(false)}<main class="page"><section class="empty enter"><h1 class="script">Œuvre introuvable</h1><p>Cette œuvre n’est plus exposée.</p><a class="btn ghost" href="/">Voir les œuvres exposées</a></section></main>`,
  });
}

export function sitemap(works: Work[], base: string): Response {
  const x = (s: string) => esc(s);
  const latest = works.reduce((m, w) => Math.max(m, w.updated || w.added || 0), 0);
  const urls = [
    `<url><loc>${x(base + "/")}</loc>${latest ? `<lastmod>${new Date(latest).toISOString()}</lastmod>` : ""}</url>`,
    ...works.map(
      (w) =>
        `<url><loc>${x(base + workPath(w))}</loc><lastmod>${new Date(w.updated || w.added).toISOString()}</lastmod><image:image><image:loc>${x(base + imgPath(w))}</image:loc></image:image></url>`,
    ),
  ];
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${urls.join("\n")}
</urlset>`;
  return new Response(xml, { headers: { "content-type": "application/xml; charset=utf-8", "cache-control": "public, max-age=0, must-revalidate", ...CDN_CACHE } });
}

export function robots(base: string): Response {
  return new Response(`User-agent: *\nAllow: /\nDisallow: /admin/\nDisallow: /api/\n\nSitemap: ${base}/sitemap.xml\n`, {
    headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "public, max-age=3600", ...CDN_CACHE },
  });
}
