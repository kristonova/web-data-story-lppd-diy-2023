/**
 * build_sw.mjs — bangun service worker dengan cache berversi.
 *
 * Setelah satu kali dibuka, halaman terbuka penuh tanpa jaringan.
 * Versi cache dihitung dari isi dist/, sehingga setiap build menghasilkan
 * cache baru dan versi lama dibuang sendiri.
 *
 * Folder dist/ juga dapat disalin ke USB dan dibuka langsung dari berkas; di
 * sana service worker tidak dipakai dan tidak dibutuhkan.
 */
import { createHash } from "node:crypto";
import { readdir, readFile, stat, writeFile } from "node:fs/promises";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const DIST = fileURLToPath(new URL("../dist/", import.meta.url));

async function walk(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await walk(full)));
    else out.push(full);
  }
  return out;
}

const berkas = (await walk(DIST)).filter((f) => !f.endsWith("sw.js"));
const hash = createHash("sha256");
let total = 0;

for (const f of berkas.sort()) {
  const isi = await readFile(f);
  hash.update(relative(DIST, f).split(sep).join("/"));
  hash.update(isi);
  total += (await stat(f)).size;
}

const versi = hash.digest("hex").slice(0, 12);
// Jalur disimpan relatif terhadap letak sw.js, lalu diselesaikan saat jalan.
// Dengan begitu situs bekerja baik di akar domain maupun di dalam subfolder.
const daftar = berkas.map((f) => relative(DIST, f).split(sep).join("/"));

const sw = `/* Dibangun otomatis oleh scripts/build_sw.mjs. Jangan diubah tangan. */
const VERSI = "lppd-diy-${versi}";
const ISI = ${JSON.stringify([...new Set(daftar)], null, 2)};
const URL_ISI = ISI.map((p) => new URL(p, self.location.href).href);
const AKAR = new URL("./", self.location.href).href;

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(VERSI).then((c) => c.addAll(URL_ISI)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((k) => Promise.all(k.filter((x) => x !== VERSI).map((x) => caches.delete(x))))
      .then(() => self.clients.claim()),
  );
});

/* Cache lebih dahulu: halaman ini adalah potret satu waktu, isinya tidak
   berubah di antara dua build. */
self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then((hit) => {
      if (hit) return hit;
      return fetch(e.request).catch(() =>
        caches.match(AKAR + "index.html").then((r) => r || Response.error()),
      );
    }),
  );
});
`;

await writeFile(join(DIST, "sw.js"), sw, "utf8");
console.log(
  `[sw] versi ${versi} · ${daftar.length} berkas · ${(total / 1024).toFixed(0)} KB total`,
);
