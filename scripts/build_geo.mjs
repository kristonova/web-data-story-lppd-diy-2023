#!/usr/bin/env node
/**
 * build_geo.mjs — memproyeksikan GeoJSON DIY menjadi jalur SVG saat build.
 *
 * Masukan  : data-story/geo/*.geojson (batas wilayah disiapkan sekali oleh
 *            siapkan_geo.mjs; penanda.geojson disusun tangan untuk ilustrasi)
 * Keluaran : src/data/derived/peta.json  — jalur SVG siap pakai, satu ruang koordinat
 *            public/data/*.geojson         — batas wilayah untuk diunduh pembaca
 *
 * Proyeksi ekuirektangular dengan faktor cos(lintang tengah): pada rentang DIY
 * (< 1°) distorsinya di bawah satu persen, cukup untuk peta tematik, dan tidak
 * memerlukan pustaka peta di peramban. Seluruh peta di halaman (peta utama,
 * peta kecil, sisipan Kota) memakai ruang koordinat yang sama; yang berbeda
 * hanya viewBox-nya.
 *
 * Asersi: 5 kabupaten/kota dan 78 kapanewon/kemantren, kode wilayah sama
 * dengan tabel LPPD, jumlah kapanewon per kabupaten sama dengan tabel
 * administrasi LPPD (pilar1.json), dan luas geometri dalam 5% luas LPPD.
 */
import { readFileSync, writeFileSync, copyFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const AKAR = fileURLToPath(new URL("..", import.meta.url));
const GEO = join(AKAR, "data-story", "geo");
const OUT = join(AKAR, "src", "data", "derived");
const PUB = join(AKAR, "public", "data");
mkdirSync(PUB, { recursive: true });

const gagal = [];
const cek = (nama, ok, rinci = "") => {
  if (!ok) gagal.push(`${nama} — ${rinci}`);
};
const baca = (f) => JSON.parse(readFileSync(join(GEO, f), "utf8"));

const kab = baca("diy-kabupaten.geojson");
const kap = baca("diy-kapanewon.geojson");
const sekitar = baca("sekitar-diy.geojson");
const penanda = baca("penanda.geojson");

// ── Bingkai dan proyeksi ─────────────────────────────────────────────────────
/** Bingkai peta utama: DIY dengan ruang untuk laut di selatan dan tetangga di utara. */
const BINGKAI = { barat: 109.97, timur: 110.88, selatan: -8.235, utara: -7.515 };
const LEBAR = 1000;
const cosPhi = Math.cos((((BINGKAI.utara + BINGKAI.selatan) / 2) * Math.PI) / 180);
const skala = LEBAR / ((BINGKAI.timur - BINGKAI.barat) * cosPhi);
const TINGGI = Math.round((BINGKAI.utara - BINGKAI.selatan) * skala);
const px = (lon) => (lon - BINGKAI.barat) * cosPhi * skala;
const py = (lat) => (BINGKAI.utara - lat) * skala;
const r1 = (v) => Math.round(v * 10) / 10;
const titik = ([lon, lat]) => [r1(px(lon)), r1(py(lat))];

/** Cincin → "M x y x y …Z"; titik berurutan yang sama setelah pembulatan dibuang. */
function jalurCincin(cincin, tutup = true) {
  const pts = [];
  for (const c of cincin) {
    const p = titik(c);
    const akhir = pts[pts.length - 1];
    if (!akhir || akhir[0] !== p[0] || akhir[1] !== p[1]) pts.push(p);
  }
  if (pts.length < 2) return "";
  return `M${pts.map((p) => `${p[0]} ${p[1]}`).join(" ")}${tutup ? "Z" : ""}`;
}
function jalur(geom) {
  switch (geom.type) {
    case "Polygon":
      return geom.coordinates.map((r) => jalurCincin(r)).join("");
    case "MultiPolygon":
      return geom.coordinates.flatMap((pl) => pl.map((r) => jalurCincin(r))).join("");
    case "LineString":
      return jalurCincin(geom.coordinates, false);
    case "MultiLineString":
      return geom.coordinates.map((l) => jalurCincin(l, false)).join("");
    default:
      return "";
  }
}

/** "GUNUNGKIDUL" → "Gunungkidul", "KOTA YOGYAKARTA" → "Kota Yogyakarta". */
const judul = (s) =>
  String(s)
    .toLowerCase()
    .replace(/(^|[\s-])([a-z])/g, (_, a, b) => a + b.toUpperCase())
    .trim();

// ── Lapisan ──────────────────────────────────────────────────────────────────
const lapisKab = kab.features
  .map((f) => ({
    kode: f.properties.kode,
    nama: judul(f.properties.nama),
    d: jalur(f.geometry),
    lx: r1(px(f.properties.label_lon)),
    ly: r1(py(f.properties.label_lat)),
    luasPeta: f.properties.luas_km2,
  }))
  .sort((a, b) => a.kode.localeCompare(b.kode));

const lapisKap = kap.features
  .map((f) => ({
    kode: f.properties.kode,
    nama: judul(f.properties.nama),
    kodeKab: f.properties.kode_kab,
    d: jalur(f.geometry),
    lx: r1(px(f.properties.label_lon)),
    ly: r1(py(f.properties.label_lat)),
  }))
  .sort((a, b) => a.kode.localeCompare(b.kode));

const lapisSekitar = sekitar.features.map((f) => ({ nama: judul(f.properties.nama), d: jalur(f.geometry) }));
const lapisPenanda = penanda.features
  .map((f) => ({
    nama: f.properties.nama,
    jenis: f.properties.jenis,
    urut: f.properties.urut ?? null,
    ikon: f.properties.ikon ?? null,
    x: r1(px(f.geometry.coordinates[0])),
    y: r1(py(f.geometry.coordinates[1])),
  }))
  .sort((a, b) => (a.urut ?? 99) - (b.urut ?? 99));

// ── Asersi silang dengan LPPD ────────────────────────────────────────────────
const pilar1 = JSON.parse(readFileSync(join(OUT, "pilar1.json"), "utf8"));
const wilayah = JSON.parse(readFileSync(join(OUT, "wilayah.json"), "utf8"));
const kodeLppd = wilayah.kabkota.map((k) => k.kode).sort();
cek("geo.kab.jumlah", lapisKab.length === 5, String(lapisKab.length));
cek("geo.kab.kode", JSON.stringify(lapisKab.map((k) => k.kode)) === JSON.stringify(kodeLppd), lapisKab.map((k) => k.kode).join(","));
cek("geo.kap.jumlah", lapisKap.length === pilar1.administrasi.kapanewon, `${lapisKap.length} vs ${pilar1.administrasi.kapanewon}`);
for (const k of wilayah.kabkota) {
  const adm = pilar1.administrasi.perKab.find((a) => a.nama === k.nama);
  const n = lapisKap.filter((x) => x.kodeKab === k.kode).length;
  cek(`geo.kap.${k.nama}`, adm && adm.kapanewonKemantren === n, `${n} vs ${adm?.kapanewonKemantren}`);
  const luas = pilar1.luas.perKab.find((l) => judul(l.nama).replace(/^Kab\. /, "") === k.nama || l.nama.toUpperCase().includes(k.nama.toUpperCase()));
  const petak = lapisKab.find((x) => x.kode === k.kode);
  cek(`geo.luas.${k.nama}`, luas && petak && Math.abs(petak.luasPeta / luas.km2 - 1) < 0.05, `${petak?.luasPeta} vs ${luas?.km2}`);
}
cek("geo.d", [...lapisKab, ...lapisKap].every((x) => x.d.length > 20), "jalur kosong");
cek("geo.sumbu", lapisPenanda.filter((p) => p.jenis === "sumbu").length >= 4, "penanda sumbu");

if (gagal.length) {
  console.error(`\nPETA DIBATALKAN — ${gagal.length} asersi gagal:`);
  for (const g of gagal) console.error(`  ✗ ${g}`);
  process.exit(1);
}

/** viewBox rapat di sekeliling DIY (peta kecil), dengan tepi 14 satuan. */
const diyBox = (() => {
  const xs = [];
  const ys = [];
  for (const k of lapisKab) {
    const n = k.d.match(/-?\d+(?:\.\d+)?/g).map(Number);
    for (let i = 0; i < n.length; i += 2) {
      xs.push(n[i]);
      ys.push(n[i + 1]);
    }
  }
  const m = 14;
  const x0 = Math.min(...xs) - m;
  const y0 = Math.min(...ys) - m;
  return [r1(x0), r1(y0), r1(Math.max(...xs) + m - x0), r1(Math.max(...ys) + m - y0)];
})();

/** viewBox sisipan Kota Yogyakarta + Panggung Krapyak, dalam ruang koordinat yang sama. */
const kotaBox = (() => {
  const b = { barat: 110.336, timur: 110.41, selatan: -7.84, utara: -7.766 };
  const x0 = r1(px(b.barat));
  const y0 = r1(py(b.utara));
  return [x0, y0, r1(px(b.timur) - x0), r1(py(b.selatan) - y0)];
})();

const peta = {
  sumber: kab.metadata.sumber,
  catatan: "Proyeksi ekuirektangular (faktor cos lintang tengah), satu ruang koordinat untuk seluruh peta.",
  lebar: LEBAR,
  tinggi: TINGGI,
  diyBox,
  kotaBox,
  kab: lapisKab,
  kapanewon: lapisKap,
  sekitar: lapisSekitar,
  penanda: lapisPenanda,
};
writeFileSync(join(OUT, "peta.json"), JSON.stringify(peta) + "\n", "utf8");

// Batas wilayah ikut diterbitkan untuk pembaca yang ingin memakai di aplikasi GIS,
// dan dicantumkan di daftar unduhan manifes (ditulis build_data.mjs sebelumnya).
const unduhGeo = [
  { berkas: "diy-kabupaten.geojson", tentang: "Batas 5 kabupaten/kota DIY (GeoJSON, disederhanakan)" },
  { berkas: "diy-kapanewon.geojson", tentang: "Batas 78 kapanewon dan kemantren DIY (GeoJSON, disederhanakan)" },
];
for (const u of unduhGeo) copyFileSync(join(GEO, u.berkas), join(PUB, u.berkas));
const jalurManifes = join(OUT, "manifes.json");
const manifes = JSON.parse(readFileSync(jalurManifes, "utf8"));
manifes.unduhan = [
  ...manifes.unduhan.filter((u) => !u.berkas.endsWith(".geojson")),
  ...unduhGeo.map((u) => ({ ...u, sumber: "Portal GIS Dukcapil Kemendagri (data 2018 semester 1), disederhanakan dengan mapshaper" })),
];
writeFileSync(jalurManifes, JSON.stringify(manifes, null, 2) + "\n", "utf8");

const ukuran = Buffer.byteLength(JSON.stringify(peta));
console.log(`OK — peta ${LEBAR}×${TINGGI}: ${lapisKab.length} kabupaten/kota, ${lapisKap.length} kapanewon, ${(ukuran / 1024).toFixed(0)} KB jalur.`);
