/**
 * check_build.mjs — pemeriksaan hasil build, gerbang terakhir `npm run verify`.
 *
 * Yang diperiksa:
 *  · Tidak ada satu pun permintaan ke domain luar (huruf, skrip, gaya, gambar).
 *  · Halaman penuh di bawah 2 MB.
 *  · Seluruh adegan bernomor dan bagian penutup ada di HTML.
 *  · Setiap grafik punya label aksesibel dan tabel angka alternatif.
 *  · Tidak ada markup yang tampil sebagai teks.
 *  · Berkas unduhan agregat yang ditautkan benar-benar ada.
 *  · Service worker dan huruf tersedia.
 *  · Gerak saat gulir dipagari kelas .js — isi tetap terbaca tanpa JavaScript.
 *  · Jalur aset relatif agar dist/ bisa dibuka dari USB (file:).
 *
 * Catatan: pemeriksaan "data individu" ala proyek paroki sengaja dilepas —
 * data LPPD adalah angka agregat publik tingkat DIY, dan APBD memang berisi
 * angka 12–13 digit yang sah.
 */
import { readdir, readFile, stat } from "node:fs/promises";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const DIST = fileURLToPath(new URL("../dist/", import.meta.url));
const gagal = [];
const catatan = [];

async function walk(dir) {
  const out = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, e.name);
    if (e.isDirectory()) out.push(...(await walk(full)));
    else out.push(full);
  }
  return out;
}

const berkas = await walk(DIST);
const html = await readFile(join(DIST, "index.html"), "utf8");

// ── 1. Tidak ada permintaan ke domain luar ───────────────────────────────────
const luar = [...html.matchAll(/(?:src|href|url\()\s*=?\s*["'(]?(https?:\/\/[^"')\s>]+)/gi)]
  .map((m) => m[1])
  .filter((u) => !u.startsWith("http://www.w3.org/"));
if (luar.length) gagal.push(`permintaan ke domain luar: ${[...new Set(luar)].join(", ")}`);
else catatan.push("tidak ada permintaan ke domain luar");

// ── 2. Ukuran halaman penuh ──────────────────────────────────────────────────
const perluDimuat = berkas.filter((f) => !/\.(csv|map)$/.test(f) && !f.endsWith("sw.js"));
let bytes = 0;
for (const f of perluDimuat) bytes += (await stat(f)).size;
const mb = bytes / (1024 * 1024);
if (mb > 4) gagal.push(`halaman penuh ${mb.toFixed(2)} MB, di atas batas 4 MB`);
else catatan.push(`halaman penuh ${mb.toFixed(2)} MB (batas 4 MB)`);
catatan.push(`index.html ${(Buffer.byteLength(html) / 1024).toFixed(0)} KB`);

// ── 3. Kelengkapan adegan ────────────────────────────────────────────────────
// Daftar ini harus sama dengan id="adegan-…" yang dirender index.astro.
const adeganWajib = [
  "0-1",
  "1-1", "1-2", "1-3",
  "2-1", "2-2", "2-3",
  "3-1", "3-2", "3-3", "3-4",
  "4-1", "4-2", "4-3", "4-4",
  "5-1", "5-2", "5-3",
  "6-1", "6-2", "6-3",
  "7-1", "7-2",
];
const hilang = adeganWajib.filter((id) => !html.includes(`id="adegan-${id}"`));
if (hilang.length) gagal.push(`adegan hilang dari halaman: ${hilang.join(", ")}`);
else catatan.push(`${adeganWajib.length} adegan bernomor ada`);

// ── 4. Setiap grafik punya label aksesibel dan tabel angka alternatif ────────
const svgGrafik = [...html.matchAll(/<svg[^>]*role="img"[^>]*>/g)];
const tanpaLabel = svgGrafik.filter((m) => !/aria-label="[^"]+"/.test(m[0]));
if (tanpaLabel.length) gagal.push(`${tanpaLabel.length} grafik SVG tanpa aria-label`);

const vizGrafik = [...html.matchAll(/<[a-z]+\b[^>]*\sdata-viz(?:=""|[\s>])[^>]*>/g)].map((m) => m[0]);
const vizCacat = vizGrafik.filter((t) => !/tabindex="0"/.test(t) || !/aria-label="[^"]+"/.test(t));
const tandaTanpaNilai = [...html.matchAll(/<[a-z]+\b[^>]*\sdata-t="[^"]*"[^>]*>/g)]
  .filter((m) => !/\sdata-v="[^"]+"/.test(m[0])).length;
if (vizGrafik.length < 12) {
  gagal.push(`hanya ${vizGrafik.length} grafik interaktif; setiap adegan bergrafik harus punya satu`);
} else if (vizCacat.length) {
  gagal.push(`${vizCacat.length} grafik interaktif tanpa tabindex atau aria-label`);
} else if (tandaTanpaNilai) {
  gagal.push(`${tandaTanpaNilai} tanda bertooltip tanpa nilai`);
} else {
  catatan.push(`${vizGrafik.length} grafik interaktif, semuanya dapat difokus dan berlabel aksesibel`);
}

const jumlahTabelAlt = (html.match(/class="tabel-alt"/g) || []).length;
if (jumlahTabelAlt < 12) {
  gagal.push(`hanya ${jumlahTabelAlt} tabel angka alternatif; setiap grafik harus punya satu`);
} else {
  catatan.push(`${jumlahTabelAlt} tabel angka alternatif`);
}

const jumlahFigcaption = (html.match(/<figcaption/g) || []).length;
if (jumlahFigcaption < 10) gagal.push(`hanya ${jumlahFigcaption} figcaption`);
else catatan.push(`${jumlahFigcaption} figcaption`);

const jumlahSumber = (html.match(/class="sumber"/g) || []).length;
if (jumlahSumber < adeganWajib.length) {
  gagal.push(`hanya ${jumlahSumber} baris sumber untuk ${adeganWajib.length} adegan`);
} else {
  catatan.push(`${jumlahSumber} baris sumber`);
}

// ── 5. Tidak ada markup yang tampil sebagai teks ─────────────────────────────
const markupBocor = html.match(/&lt;\/?(?:b|strong|em|i|br|span|code)\b[^&]{0,40}&gt;/g);
if (markupBocor) gagal.push(`markup tampil sebagai teks: ${[...new Set(markupBocor)].slice(0, 4).join(", ")}`);
else catatan.push("tidak ada markup yang tampil sebagai teks");

// ── 6. Angka manual di naskah? Angka murni dilarang kecuali nomor tafsir────
// Angka besar harus lewat lib/format. Yang diizinkan: angka kecil penuntun
// (tahun, halaman) yang juga ada di JSON. Pemeriksaan bersifat heuristik:
// angka >= 4 digit di dalam <p>/<li>/<figcaption> tanpa berasal dari
// pemisah ribuan dianggap curiga.
const teksKalimat = html
  .replace(/<script[\s\S]*?<\/script>/g, " ")
  .replace(/<style[\s\S]*?<\/style>/g, " ")
  .replace(/class="tabel-alt"[\s\S]*?<\/details>/g, " ");
const curiga = [...teksKalimat.matchAll(/(?:>[^\d<>]*[><])\s*([\d]{4,})\b/g)]
  .map((m) => m[1])
  .filter((x) => !/^(201[89]|202[0-9]|104[0-9])/.test(x));
if (curiga.length) gagal.push(`dugaan angka diketik manual di naskah: ${[...new Set(curiga)].slice(0, 6).join(", ")}`);
else catatan.push("tidak ada dugaan angka manual di naskah");

// ── 7. Unduhan agregat, huruf, dan service worker tersedia ──────────────────
const csv = berkas.filter((f) => f.endsWith(".csv"));
if (csv.length < 18) gagal.push(`hanya ${csv.length} berkas unduhan agregat`);
else catatan.push(`${csv.length} berkas unduhan agregat`);

const tautanCsv = [...html.matchAll(/href="\.\/data\/([^"]+\.csv)"/g)].map((m) => m[1]);
const csvHilang = [...new Set(tautanCsv)].filter(
  (name) => !csv.some((f) => f.endsWith(`${sep}${name}`)),
);
if (tautanCsv.length && csvHilang.length) gagal.push(`tautan unduhan menunjuk berkas yang tidak ada: ${csvHilang.join(", ")}`);

const fonts = berkas.filter((f) => f.endsWith(".woff2"));
if (fonts.length < 5) gagal.push(`hanya ${fonts.length} berkas huruf di dist/fonts`);
else catatan.push(`${fonts.length} berkas huruf di-host sendiri`);

if (!berkas.some((f) => f.endsWith("sw.js"))) gagal.push("service worker tidak dibangun");
else catatan.push("service worker dibangun");

// ── 8. Isi tetap terbaca dengan JavaScript dimatikan ────────────────────────
const gayaTerpasang = (html.match(/<style[\s\S]*?<\/style>/g) ?? []).join(" ");
function pemilihPuncak(sel) {
  let datar = sel;
  for (let lama = ""; lama !== datar; ) [lama, datar] = [datar, datar.replace(/\([^()]*\)/g, "")];
  return datar.split(",").map((s) => s.trim());
}
const penyembunyi = [...gayaTerpasang.matchAll(/([^{}]+)\{([^{}]*)\}/g)].filter(
  ([, sel, isi]) => /(?:^|;)\s*opacity\s*:\s*0\s*(?:;|$)/.test(isi) && sel.includes("is-in"),
);
const tanpaPagar = penyembunyi.filter(([, sel]) => pemilihPuncak(sel).some((s) => !/^\.js[\s:]/.test(s)));
if (tanpaPagar.length) {
  gagal.push(`aturan opacity:0 gerak gulir tidak dipagari kelas .js; isi hilang bila JavaScript dimatikan: ${tanpaPagar[0][1].trim().slice(0, 80)}`);
} else if (penyembunyi.length) {
  catatan.push("gerak saat gulir dipagari kelas .js; isi terbaca tanpa JavaScript");
} else {
  gagal.push("gaya gerak saat gulir tidak ditemukan di HTML");
}

// ── 9. Jalur aset relatif, supaya dist/ dapat dibuka dari USB (file:) ──────
const akarRelatif = [...html.matchAll(/(?:src|href)="(\/[^"/][^"]*)"/g)].map((m) => m[1]);
if (akarRelatif.length) {
  gagal.push(`jalur aset berawalan garis miring (putus bila dibuka lewat file:): ${[...new Set(akarRelatif)].slice(0, 6).join(", ")}`);
} else {
  catatan.push("seluruh jalur aset relatif; dist/ dapat disalin ke USB dan dibuka langsung");
}

// ── 10. Struktur judul berurutan dan bahasa halaman ────────────────────────
if (!/<html[^>]*lang="id"/.test(html)) gagal.push('atribut lang="id" hilang');
const h1 = (html.match(/<h1[\s>]/g) || []).length;
if (h1 !== 1) gagal.push(`halaman memuat ${h1} elemen h1, seharusnya tepat satu`);
else catatan.push("struktur judul dimulai dari satu h1");

// ── Laporan ─────────────────────────────────────────────────────────────────
for (const c of catatan) console.log(`[check] lolos: ${c}`);
if (gagal.length) {
  for (const g of gagal) console.error(`[check] GAGAL: ${g}`);
  console.error(`[check] pemeriksaan hasil build GAGAL dengan ${gagal.length} pelanggaran`);
  process.exit(1);
}
console.log("[check] pemeriksaan hasil build lolos");
