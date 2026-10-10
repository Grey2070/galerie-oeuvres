import { getImage, ID_RE } from "../../lib/store.mts";

// Serves the photos. The version in the file name changes whenever a photo is
// replaced, so each URL can be cached for a year.
export default async (req: Request, context: { params: Record<string, string> }) => {
  const { id, file } = context.params;
  const m = /^([a-z0-9]+)(-s)?\.jpg$/.exec(file || "");
  if (!ID_RE.test(id || "") || !m) return new Response("Not found", { status: 404 });
  let data = await getImage(m[2] ? id + "-s" : id);
  if (!data && m[2]) data = await getImage(id);
  if (!data) return new Response("Not found", { status: 404 });
  return new Response(data, {
    headers: {
      "content-type": "image/jpeg",
      "cache-control": "public, max-age=31536000, immutable",
      "netlify-cdn-cache-control": "public, durable, max-age=31536000, immutable",
      "netlify-cache-tag": "img-" + id,
    },
  });
};

export const config = { path: "/img/:id/:file", method: ["GET", "HEAD"] };
