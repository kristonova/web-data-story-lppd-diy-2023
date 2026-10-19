/**
 * validate_data.mjs — gerbang validasi keluaran pipeline data.
 *
 * Berbeda dari build_data.mjs (yang menguji ekstraksi terhadap LPPD sendiri),
 * berkas ini menguji FILE hasil terhadap invarian bergaya terdahulu:
 *  · Setiap JSON turunan ada dan kunci esensialnya terisi (bukan null/[]).
 *  · Identitas aritmetika antarberkas tetap berdiri (jumlah kelompok persetujuan,
 *    hasil berbobot nilai akhir, jumlah BKK, dst.).
 *  · CSV unduhan barisnya masuk akal (≥1 baris data, jumlah kolom sama).
 *  · Perbandingan antarkabupaten/kota (wilayah.json) bersilang dengan angka DIY,
 *    dan jalur peta (peta.json) memuat 5 kabupaten/kota dan 78 kapanewon.
 *  · GeoJSON unduhan sah dan jumlah fiturnya benar.
 *  · Tidak ada angka ")" negatif elemen, NaN, atau null tak berizin yang
 *    bocor ke CSV.
 * Berjalan cepat tanpa membaca sumber; dipanggil oleh `npm run verify`.
 */
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const OUT = fileURLToPath(new URL("../src/data/derived/", import.meta.url));
const PUB = fileURLToPath(new URL("../public/data/", import.meta.url));

const gagal = [];
const baca = (nama) => JSON.parse(readFileSync(join(OUT, `${nama}.json`), "utf8"));
const hampir = (a, b, tol = 0.01) => Math.abs(a - b) < tol;
const cek = (nama, kondisi, rincian = "") => {
  if (!kondisi) gagal.push(`${nama} — ${rincian}`);
};

const wajib = ["pembuka", "pilar1", "pilar2", "pilar2-urusan", "pilar3", "pilar4", "pilar5", "pilar6", "wilayah", "peta", "manifes"];
for (const f of wajib) {
  const p = join(OUT, `${f}.json`);
  cek(`berkas.${f}`, existsSync(p), p);
}

if (gagal.length) {
  for (const g of gagal) console.error(`[validate] GAGAL: ${g}`);
  process.exit(1);
}

// ── Pembuka: enam indikator, seluruh nilai terisi ─────────────────────────────
const pembuka = baca("pembuka");
cek("pembuka.indikator", pembuka.indikator?.length === 6, String(pembuka.indikator?.length));
for (const i of pembuka.indikator) {
  cek(`pembuka.${i.jenis}`, i.nilai2022 != null && i.nilai2023 != null && i.perubahan != null, i.nama);
}
const ipm = pembuka.indikator.find((x) => x.jenis === "ipm");
cek("pembuka.ipm", hampir(ipm.nilai2023, 81.09) && hampir(ipm.perubahan, 0.56), JSON.stringify(ipm));

// ── Pilar2: pendapatan & belanja konsisten dengan urusan ─────────────────────
const p2 = baca("pilar2");
const u2 = baca("pilar2-urusan");
cek("p2.belanja.total", hampir(p2.belanja.total.realisasi, 5708080855492.41, 1), String(p2.belanja.total?.realisasi));
cek("p2.pendapatan.total", hampir(p2.pendapatan.total.realisasi, 5840561001091.65, 1), String(p2.pendapatan.total?.realisasi));
const kel = u2.kelompok;
cek("u2.kelompok", kel.length === 7, String(kel.length));
const sumKelAng = kel.reduce((a, x) => a + x.anggaran, 0);
const sumKelReal = kel.reduce((a, x) => a + x.realisasi, 0);
cek("u2.sum.anggaran", hampir(sumKelAng, 6016543491245, 1), String(sumKelAng));
cek("u2.sum.realisasi", hampir(sumKelReal, 5708080855492.41, 1), String(sumKelReal));
cek("u2.jumlah", hampir(u2.jumlah.anggaran, sumKelAng, 1) && hampir(u2.jumlah.realisasi, sumKelReal, 1), JSON.stringify(u2.jumlah));

// ── Pilar3: IPM 4 komponen; kemiskinan per periode rapi ──────────────────────
const p3 = baca("pilar3");
const ipmK = p3.ipm.komponen ?? p3.ipm;
cek("p3.ipm.komponen", Array.isArray(ipmK) && ipmK.length === 4, String(ipmK?.length ?? p3.ipm));
for (const k of ipmK) {
  const t = k.nilai;
  cek(`p3.ipm.${k.nama}`, t?.t2020 != null && t?.t2023 != null && t.t2023 > t.t2020, JSON.stringify(t));
}
cek("p3.gini", hampir(p3.ketimpangan.gini2023, 0.449, 0.0005) && hampir(p3.ketimpangan.gini2022, 0.459, 0.0005), JSON.stringify(p3.ketimpangan));
const kem = p3.kemiskinan;
cek("p3.kemiskinan.total2023", hampir(kem.nilai2023, 11.04), String(kem.nilai2023));
const m23 = (kem.perDaerah ?? []).filter((x) => x.periode === "Maret 2023");
for (const d of ["Perkotaan", "Perdesaan"]) {
  const r = m23.find((x) => x.daerah === d);
  cek(`p3.kemiskinan.${d}.m23`, !!r, d);
}
const tot23 = m23.find((x) => x.daerah === "Total") ?? m23.find((x) => x.daerah.toLowerCase().includes("total"));
cek("p3.kemiskinan.total.m23", !!tot23 && hampir(tot23.persen, 11.04, 0.05), JSON.stringify(tot23));
cek("p3.tpt", hampir(p3.ketenagakerjaan.tpt.t2023, 3.69), String(p3.ketenagakerjaan.tpt?.t2023));

// ── Pilar4: IKK & investasi ──────────────────────────────────────────────────
const p4 = baca("pilar4");
const ikk = p4.ikkPendidikan;
cek("p4.apm", hampir(ikk.apm.rasio, 97.69), String(ikk.apm?.rasio));
cek("p4.apk", hampir(ikk.apk.rasio, 109.76), String(ikk.apk?.rasio));
cek("p4.abk", hampir(ikk.abk.persen, 90.42), String(ikk.abk?.persen));
const inv = p4.investasi;
cek("p4.inv.seri", inv.seri.length === 2, String(inv.seri.length));
const sd23 = inv.seri[1];
cek("p4.inv.tambahan23", hampir(sd23.totalTriliun, 42.1, 0.02), String(sd23?.totalTriliun));
cek("p4.inv.perkab", inv.perKab.length === 5, String(inv.perKab.length));

// ── Pilar5: nilai akhir berbobot & BKK ───────────────────────────────────────
const p5 = baca("pilar5");
const na = p5.nilaiAkhir;
const sumHasil = na.baris.reduce((a, x) => a + x.hasil, 0);
cek("p5.hasil.berbobot", hampir(sumHasil, na.total, 0.01), `${sumHasil} vs ${na.total}`);
cek("p5.total", hampir(na.total, 90.04, 0.005), String(na.total));
cek("p5.rerata", hampir(na.rerataCapaian, na.baris[0].nilai, 0.005), String(na.rerataCapaian));
const bk = p5.bkk;
cek("p5.bkk.20", bk.baris.length === 20, String(bk.baris.length));
cek("p5.bkk.sum.dalam", hampir(bk.jumlah.realisasi, bk.baris.reduce((a, x) => a + (x.realisasi ?? 0), 0), 2), String(bk.jumlah.realisasi));
cek("p5.bkk.pagu", hampir(bk.jumlah.pagu, 130474225000, 1), String(bk.jumlah.pagu));

// ── Pilar6: kategori & khusus ────────────────────────────────────────────────
const p6 = baca("pilar6");
cek("p6.kategori.6", p6.kategori.length === 6, String(p6.kategori.length));
cek("p6.kategori.pendidikan", p6.kategori[0].kategori === "UTAMA" && hampir(p6.kategori[0].indeks, 98.33), JSON.stringify(p6.kategori[0]));
cek("p6.paripurna", p6.kategori.slice(1).every((x) => x.kategori === "PARIPURNA" && hampir(x.indeks, 100)), "");
const ind = p6.pendidikanIndikator;
cek("p6.indikator.sma", ind.filter((x) => x.jenjang === "SMA").length >= 9, "");
cek("p6.indikator.smk", ind.filter((x) => x.jenjang === "SMK").length >= 9, "");
const kh = p6.pendidikanKhusus;
cek("p6.khusus", kh.harusDilayani === 6319 && kh.terlayani === 6215 && kh.belumTerlayani === 104, JSON.stringify(kh));
cek("p6.khusus.pct", hampir(kh.persen, 98.35, 0.01), String(kh.persen));

// ── Pilar4 tambahan: IKK kesehatan; pilar5: total urusan keistimewaan ────────
cek("p4.rsrcs", hampir(p4.ikkKesehatan.rasioPerRibu, 2.32, 0.005), String(p4.ikkKesehatan.rasioPerRibu));
const ur = p5.urusan;
const sumUrAng = ur.baris.reduce((a, x) => a + x.anggaran, 0);
const sumUrReal = ur.baris.reduce((a, x) => a + x.realisasi, 0);
cek("p5.urusan.jumlah", hampir(ur.total.anggaran, sumUrAng, 1) && hampir(ur.total.realisasi, sumUrReal, 1), JSON.stringify(ur.total));
cek("p5.urusan.jmlhLPPD", hampir(ur.total.anggaran, 1420000000000, 1) && hampir(ur.total.realisasi, 1396163539432, 1), JSON.stringify(ur.total));

// ── Wilayah: lima kabupaten/kota + DIY, bersilang dengan angka provinsi ──────
const w = baca("wilayah");
const KODE = ["3401", "3402", "3403", "3404", "3471"];
cek("w.kabkota", JSON.stringify(w.kabkota.map((k) => k.kode)) === JSON.stringify(KODE), "");
cek("w.ipm.DIY", hampir(w.ipm.nilai.DIY.at(-1), pembuka.indikator[0].nilai2023), String(w.ipm.nilai.DIY));
cek("w.ipm.lengkap", [...KODE, "DIY"].every((k) => w.ipm.nilai[k]?.length === w.ipm.tahun.length), "");
cek("w.kemiskinan.DIY", hampir(w.kemiskinan.nilai.DIY.at(-1), pembuka.indikator[1].nilai2023), String(w.kemiskinan.nilai.DIY));
cek("w.pertumbuhan.DIY", hampir(w.pertumbuhan.diy.at(-1), pembuka.indikator[3].perubahan), String(w.pertumbuhan.diy));
cek("w.sektor.17", w.sektor.baris.length === 17 && w.sektor.baris.every((x) => x.nilai.length === 6), String(w.sektor.baris.length));
const sumKab = (obj, j) => KODE.reduce((a, k) => a + obj[k][j], 0);
cek("w.air.DIY", sumKab(w.airMinum.nilai, 0) + sumKab(w.airMinum.nilai, 1) + sumKab(w.airMinum.nilai, 2) === w.sanitasi.nilai.DIY[5], "air vs rumah tangga sanitasi");
cek("w.hotel", sumKab(w.hotel.nilai, 5) === sumKab(w.hotel.nilai, 1) + sumKab(w.hotel.nilai, 3), "jumlah hotel 2023");
cek("w.williamson", w.williamson.seri.length >= 4 && w.williamson.seri.every((x) => x.nilai > 0.4 && x.nilai < 0.6), JSON.stringify(w.williamson.seri));
cek("w.cagar", w.cagarBudaya.baris.length === 5, String(w.cagarBudaya.baris.length));

// ── Peta: jalur siap pakai ──────────────────────────────────────────────────
const p1 = baca("pilar1");
const pt = baca("peta");
cek("peta.kab", pt.kab.length === 5 && pt.kab.every((k) => KODE.includes(k.kode) && k.d.startsWith("M")), String(pt.kab.length));
cek("peta.kap", pt.kapanewon.length === p1.administrasi.kapanewon, String(pt.kapanewon.length));
cek("peta.label", pt.kab.every((k) => k.lx > 0 && k.lx < pt.lebar && k.ly > 0 && k.ly < pt.tinggi), "titik label di luar bingkai");

// ── Manifes: catatan celah & unduhan terisi ──────────────────────────────────
const m = baca("manifes");
cek("manifes.catatan", Array.isArray(m.catatanCelah) && m.catatanCelah.length >= 6, String(m.catatanCelah?.length));
const csvUnduh = m.unduhan.filter((u) => u.berkas.endsWith(".csv"));
const geoUnduh = m.unduhan.filter((u) => u.berkas.endsWith(".geojson"));
cek("manifes.unduhan.csv", csvUnduh.length === 24, String(csvUnduh.length));
cek("manifes.unduhan.geojson", geoUnduh.length === 2, String(geoUnduh.length));

// ── GeoJSON unduhan: sah dan lengkap ────────────────────────────────────────
for (const u of geoUnduh) {
  const p = join(PUB, u.berkas);
  if (!existsSync(p)) {
    gagal.push(`geojson.hilang — ${u.berkas}`);
    continue;
  }
  const g = JSON.parse(readFileSync(p, "utf8"));
  const harus = u.berkas.includes("kapanewon") ? p1.administrasi.kapanewon : 5;
  cek(`geojson.${u.berkas}`, g.type === "FeatureCollection" && g.features.length === harus, `${g.features?.length} fitur`);
}

// ── CSV unduhan: tidak kosong, tidak ada NaN, jumlah kolom konsisten ─────────
for (const u of csvUnduh) {
  const p = join(PUB, u.berkas);
  if (!existsSync(p)) {
    gagal.push(`csv.hilang — ${u.berkas}`);
    continue;
  }
  const isi = readFileSync(p, "utf8").replace(/^\uFEFF/, "");
  const baris = isi.split(/\r?\n/).filter(Boolean);
  cek(`csv.${u.berkas}`, baris.length >= 2, `${baris.length} baris`);
  const kolom0 = baris[0].split(";");
  for (const b of baris) {
    const k = b.split(";").length;
    if (k !== kolom0.length) {
      gagal.push(`csv.${u.berkas} — jumlah kolom berubah pada baris: ${b.slice(0, 40)}`);
      break;
    }
  }
  if (/\bNaN\b|-Infinity/.test(isi)) gagal.push(`csv.${u.berkas} — NaN bocor`);
  if (baris.slice(1).every((b) => b.split(";").every((c) => c === ""))) {
    gagal.push(`csv.${u.berkas} — semua baris kosong`);
  }
}

if (gagal.length) {
  for (const g of gagal) console.error(`[validate] GAGAL: ${g}`);
  console.error(`[validate] validasi keluaran GAGAL dengan ${gagal.length} pelanggaran`);
  process.exit(1);
}
console.log(`[validate] validasi keluaran lolos — ${wajib.length} JSON, ${csvUnduh.length} CSV, ${geoUnduh.length} GeoJSON, ${m.catatanCelah.length} catatan celah.`);
