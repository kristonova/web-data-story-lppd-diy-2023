#!/usr/bin/env node
/**
 * Persiapan batas wilayah (sekali jalan, bukan bagian dari `npm run build`).
 *
 * Menyusun GeoJSON ringkas DIY dari shapefile batas administrasi nasional:
 *
 *   data-story/geo/diy-kapanewon.geojson       78 kapanewon/kemantren (poligon)
 *   data-story/geo/diy-kabupaten.geojson       5 kabupaten/kota, dilebur dari kapanewon
 *   data-story/geo/sekitar-diy.geojson         kabupaten tetangga, dipotong bingkai peta
 *
 * Sumber: repositori Alf-Anas/batas-administrasi-indonesia, folder 2020
 * ("Batas Kecamatan SHP.zip" dan "Batas Kabupaten SHP.zip"), yang menurut
 * README-nya diekstrak dari portal GIS Dukcapil Kemendagri
 * (gis.dukcapil.kemendagri.go.id), data 2018 semester 1. Batas bersifat
 * indikatif untuk visualisasi, bukan rujukan hukum batas wilayah.
 *
 * Penyederhanaan memakai mapshaper (topologi dijaga: batas bersama dua
 * kapanewon disederhanakan sekali, sehingga tidak ada celah atau tumpang
 * tindih). Kabupaten dilebur dari kapanewon yang sama, jadi garisnya identik.
 *
 * Pemakaian:
 *   node scripts/siapkan_geo.mjs <folder-berisi-Batas Kecamatan.shp> <folder-berisi-Batas Kabupaten.shp>
 *
 * Membutuhkan jaringan sekali untuk `npx mapshaper@0.6.102`.
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";

const AKAR = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const KELUAR = join(AKAR, "data-story", "geo");
const [dirKec, dirKab] = process.argv.slice(2);
if (!dirKec || !dirKab) {
  console.error("Pemakaian: node scripts/siapkan_geo.mjs <folder Batas Kecamatan> <folder Batas Kabupaten>");
  process.exit(1);
}

/** Bingkai peta (bujur barat, lintang selatan, bujur timur, lintang utara). */
const BINGKAI = [109.8, -8.3, 111.05, -7.4];
/** Toleransi penyederhanaan, meter. */
const TOL_DIY = 80;
const TOL_SEKITAR = 250;
const PRESISI = 0.0001;

const kerja = join(tmpdir(), `geo-diy-${process.pid}`);
mkdirSync(kerja, { recursive: true });
mkdirSync(KELUAR, { recursive: true });

const ms = (...arg) =>
  execFileSync("npx", ["-y", "mapshaper@0.6.102", ...arg], { stdio: ["ignore", "inherit", "inherit"] });

const shpKec = join(resolve(dirKec), "Batas Kecamatan.shp");
const shpKab = join(resolve(dirKab), "Batas Kabupaten.shp");
const t = (f) => join(kerja, f);

// 1. Kapanewon DIY, disederhanakan dengan topologi terjaga.
ms(
  "-i", shpKec,
  "-filter", 'Provinsi=="DAERAH ISTIMEWA YOGYAKARTA"',
  "-clean",
  "-simplify", `interval=${TOL_DIY}`, "keep-shapes",
  "-clean",
  "-each", "kode=Kode_Kec, nama=Kecamatan, kode_kab=Kode_Kab, nama_kab=Kab_Kota, label_lon=this.innerX, label_lat=this.innerY, luas_km2=Math.round(this.area/1e4)/100",
  "-filter-fields", "kode,nama,kode_kab,nama_kab,label_lon,label_lat,luas_km2",
  "-o", t("kapanewon.json"), "format=geojson", `precision=${PRESISI}`,
);

// 2. Kabupaten/kota dilebur dari kapanewon yang sudah disederhanakan.
ms(
  "-i", t("kapanewon.json"),
  "-dissolve", "kode_kab", "copy-fields=nama_kab",
  "-each", "kode=kode_kab, nama=nama_kab, label_lon=this.innerX, label_lat=this.innerY, luas_km2=Math.round(this.area/1e4)/100",
  "-filter-fields", "kode,nama,label_lon,label_lat,luas_km2",
  "-o", t("kabupaten.json"), "format=geojson", `precision=${PRESISI}`,
);

// 3. Kabupaten tetangga sebagai konteks, dipotong bingkai.
ms(
  "-i", shpKab,
  "-filter", 'Provinsi!="DAERAH ISTIMEWA YOGYAKARTA"',
  "-clip", `bbox=${BINGKAI.join(",")}`,
  "-clean",
  "-simplify", `interval=${TOL_SEKITAR}`, "keep-shapes",
  "-each", "kode=Kode_Kab, nama=Kab_Kota, provinsi=Provinsi",
  "-filter-fields", "kode,nama,provinsi",
  "-o", t("sekitar.json"), "format=geojson", `precision=${PRESISI}`,
);

// Bungkus dengan metadata sumber, bulatkan koordinat titik label.
const bulat = (v) => Math.round(v / PRESISI) * PRESISI;
const meta = {
  sumber:
    "Portal GIS Dukcapil Kemendagri (data 2018 semester 1), melalui repositori Alf-Anas/batas-administrasi-indonesia folder 2020. Batas indikatif untuk visualisasi.",
  penyederhanaan: `mapshaper 0.6.102, interval ${TOL_DIY} m (DIY) dan ${TOL_SEKITAR} m (sekitar), presisi ${PRESISI} derajat`,
  crs: "EPSG:4326",
};
const tulis = (masuk, nama, judul) => {
  const g = JSON.parse(readFileSync(t(masuk), "utf8"));
  for (const f of g.features) {
    const pr = f.properties ?? {};
    for (const k of ["label_lon", "label_lat"]) if (typeof pr[k] === "number") pr[k] = Number(bulat(pr[k]).toFixed(4));
  }
  const keluar = { type: "FeatureCollection", name: judul, metadata: meta, features: g.features };
  writeFileSync(join(KELUAR, nama), JSON.stringify(keluar) + "\n");
  console.log(`  ${nama}: ${g.features.length} fitur`);
};
tulis("kapanewon.json", "diy-kapanewon.geojson", "Kapanewon dan kemantren DIY");
tulis("kabupaten.json", "diy-kabupaten.geojson", "Kabupaten dan kota DIY");
tulis("sekitar.json", "sekitar-diy.geojson", "Kabupaten/kota tetangga DIY (dipotong bingkai)");
rmSync(kerja, { recursive: true, force: true });
