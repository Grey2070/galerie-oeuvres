import { getStore } from "@netlify/blobs";

export type Work = {
  id: string;
  n: number;
  title: string;
  artist: string;
  year: string;
  technique: string;
  dims: string;
  desc: string;
  price: string;
  sold: boolean;
  w: number;
  h: number;
  v: string;
  added: number;
  updated: number;
};

const works = () => getStore({ name: "oeuvres", consistency: "strong" });
const images = () => getStore({ name: "images", consistency: "strong" });

export const ID_RE = /^[a-z0-9]{4,16}$/;

export async function listWorks(): Promise<Work[]> {
  const store = works();
  const { blobs } = await store.list({ prefix: "w/" });
  const all = await Promise.all(blobs.map((b) => store.get(b.key, { type: "json" })));
  return (all.filter(Boolean) as Work[]).sort((a, b) => a.n - b.n);
}

export async function getWork(id: string): Promise<Work | null> {
  if (!ID_RE.test(id)) return null;
  return ((await works().get("w/" + id, { type: "json" })) as Work) || null;
}

export async function saveWork(w: Work): Promise<void> {
  await works().setJSON("w/" + w.id, w);
}

export async function deleteWork(id: string): Promise<void> {
  await Promise.all([works().delete("w/" + id), images().delete(id), images().delete(id + "-s")]);
}

export async function saveImage(key: string, data: ArrayBuffer): Promise<void> {
  await images().set(key, data);
}

export async function getImage(key: string): Promise<ArrayBuffer | null> {
  return (await images().get(key, { type: "arrayBuffer" })) as ArrayBuffer | null;
}
