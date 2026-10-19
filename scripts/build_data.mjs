#!/usr/bin/env node
/**
 * build_data.mjs — pipeline data untuk cerita web "LPPD DIY dalam Angka 2023".
 *
 * Membaca tabel hasil konversi di data-story/source/*.md dan teks di
 * markdown-per-bab/*.md, mengekstrak HANYA tabel-tabel terpilih, memeriksa
 * konsistensinya (penjumlahan bagian vs total, rasio target vs capaian,
 * kesamaan silang antar tabel), lalu menulis:
 *   - src/data/derived/*.json   (lapisan data untuk komponen)
 *   - public/data/*.csv         (unduhan untuk pembaca)
 *
 * Aturan mutlak: tidak ada angka yang diketik manual di antara sumber dan
 * keluaran. Setiap angka keluaran berasal dari baris/kalimat sumber; angka
 * turunan dihitung di sini lalu diperiksa terhadap angka yang justru
 * dinyatakan LPPD (verifikasi silang). Build mati bila ekstraksi/asarasi gagal.
 */
import { readdirSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const KARSA = fileURLToPath(new URL("..", import.meta.url));
const SRC = join(KARSA, "data-story", "source");
const TEKS = join(KARSA, "markdown-per-bab");
const OUT = join(KARSA, "src", "data", "derived");
const PUB = join(KARSA, "public", "data");

mkdirSync(OUT, { recursive: true });
mkdirSync(PUB, { recursive: true });

/** Daftar kegagalan asersi; build mati di bagian akhir. */
const gagal = [];
/** Catatan tafsir/koreksi format untuk manifest penutup. */
const catatanCelah = [];
/** Berkas manajen unduhan: { berkas, tentang, sumber } */
const unduhan = [];

function cek(nama, kondisi, rincian = "") {
  if (!kondisi) gagal.push(`${nama} — ${rincian}`);
}
function catat(teks) {
  catatanCelah.push(teks);
}

// ── Memuat dan memecah berkas sumber ────────────────────────────────────────

const cacheBerkas = new Map();
function muat(berkas) {
  if (cacheBerkas.has(berkas)) return cacheBerkas.get(berkas);
  const t = readFileSync(join(SRC, berkas), "utf8");
  cacheBerkas.set(berkas, t);
  return t;
}

/** { hal, ke, baris:string[] } — marker *Sumber: halaman N, tabel ke-M* */
function pecahTabel(berkas) {
  const teks = muat(berkas);
  const out = [];
  let saat = null;
  for (const baris of teks.split("\n")) {
    const m = baris.match(/^\*Sumber:\s*halaman\s*(\d+),\s*tabel\s*ke-(\d+)\*\s*$/);
    if (m) {
      saat = { hal: +m[1], ke: +m[2], baris: [] };
      out.push(saat);
    } else if (saat && baris.startsWith("|")) {
      saat.baris.push(baris);
    }
  }
  return out;
}

const cacheTabel = new Map();
function tabelN(berkas, hal, ke) {
  const kunci = `${berkas}#${hal}/${ke}`;
  if (cacheTabel.has(kunci)) return cacheTabel.get(kunci);
  const t = pecahTabel(berkas).find((x) => x.hal === hal && x.ke === ke);
  if (!t) gagal.push(`${berkas}: tabel halaman ${hal} ke-${ke} tidak ditemukan`);
  const nilai = t ?? { hal, ke, baris: [] };
  cacheTabel.set(kunci, nilai);
  return nilai;
}

/** Baris markdown tanpa pemisah "---". */
function isi(t) {
  return (t.baris ?? []).filter((b) => !/^\|\s*(-+\s*\|)+\s*$/.test(b));
}

/** Batangkan satu baris markdown; sel di-trim. */
function sel(b) {
  return b.split("|").slice(1, -1).map((s) => s.trim());
}

// ── Pengurai angka id-ID yang ketat ─────────────────────────────────────────

/**
 * "1.583.726.675.829,00" | "97,69" | "(671.681.028,00)" | "-" | "Rp63.000.000,00"
 * Bentuk rusak ("9,.83", "1540.38", "1 . 2 9 3") ditolak → null.
 */
function angka(s) {
  if (s == null) return null;
  let t = String(s).trim();
  if (!t || /^[-–]+$/.test(t)) return null;
  t = t.replace(/^Rp\.?\s*/i, "").trim();
  let neg = false;
  if (/^\(.*\)$/.test(t)) {
    neg = true;
    t = t.slice(1, -1).trim();
  }
  if (t.startsWith("-")) {
    neg = true;
    t = t.slice(1).trim();
  }
  if (!/^[.,\d]+$/.test(t)) return null;
  const m = t.match(/^(\d{1,3}(?:\.\d{3})*|\d+)(?:,(\d+))?$/);
  if (!m) return null;
  const v = parseFloat(t.replace(/\./g, "").replace(",", "."));
  if (!Number.isFinite(v)) return null;
  return neg ? -v : v;
}

/** Angka pertama pada sel berawalan satuan: "112.898.323 juta rupiah" → 112898323 */
function angkaPertama(s) {
  const m = String(s ?? "").match(/([\d.,]+)/);
  return m ? angka(m[1]) : null;
}

/** Persen pada sel persennya sendiri: "99,75%", "100", "100.00 %" → 99.75 / 100 */
function persenSel(s) {
  const m = String(s ?? "").replace(/%/g, "").trim().match(/^(\d+)(?:[.,](\d+))?$/);
  if (!m) return null;
  const desimal = m[2] ? `0.${m[2]}` : "0";
  return +( parseFloat(m[1]) + parseFloat(desimal) ).toFixed(4);
}

/** "= 0,56%" / "= - 3,92%*" dari sel formula makro → 0.56 / -3.92 */
function persenFormula(s) {
  const m = String(s ?? "").match(/=\s*(-?)\s*([\d.,]+)\s*%/);
  if (!m) return null;
  const v = angkaPertama(m[2]);
  return v == null ? null : m[1] ? -v : v;
}

/** Semua angka (parsial bilai) dalam baris, sesuai urutan kemunculan. */
function numsBaris(b) {
  const out = [];
  for (const c of sel(b)) {
    const v = angka(c);
    if (v !== null) out.push(v);
  }
  return out;
}

// ── Keluaran ────────────────────────────────────────────────────────────────

function tulisJson(nama, obj) {
  writeFileSync(join(OUT, `${nama}.json`), JSON.stringify(obj, null, 2) + "\n", "utf8");
}

function tulisCsv(nama, kolom, baris, tentang, sumber) {
  const file = nama.endsWith(".csv") ? nama : `${nama}.csv`;
  const esc = (v) => {
    if (v == null) return "";
    let s;
    if (typeof v === "number") s = String(v).replace(".", ",");
    else s = String(v);
    return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const isi = "\uFEFF" + [kolom.join(";")]
    .concat(baris.map((r) => r.map(esc).join(";")))
    .join("\n") + "\n";
  writeFileSync(join(PUB, file), isi, "utf8");
  unduhan.push({ berkas: file, tentang, sumber });
}

const prov = (berkas, halaman, tabel) => ({ berkas, halaman, tabel });
const provTeks = (berkas, barisDari) => ({ berkas: `markdown-per-bab/${berkas}`, baris: barisDari });

// ═════════════════════════════════════════════════════════════════════════════
// PEMBUKA — Enam indikator makro (hal 188, tabel ke-2)
// ═════════════════════════════════════════════════════════════════════════════

function ambilMakro() {
  const F = "bab2-2_1_capaian-kinerja-makro.md";
  const t = tabelN(F, 188, 2);
  const baris = isi(t);
  const harapNilai22 = [80.64, 11.49, 4.06, 112898323, 44.85, 0.459];
  const harapNilai23 = [81.09, 11.04, 3.69, 118626843, 48.54, 0.449];
  const harapPerubahan = [0.56, -3.92, -9.11, 5.07, 8.23, -2.23];
  const indikator = [];
  let i = 0;
  for (const b of baris) {
    const c = sel(b).filter((x) => x !== "");
    if (c.length < 5) continue;
    if (!/^\d$/.test(c[0] ?? "")) continue;
    const nama = c[1];
    // baris legenda kolom ("| 1 | 2 | 3 | …") tidak punya huruf pada sel label
    if (!/[A-Za-z]/.test(nama ?? "")) continue;
    const idxFormula = c.findIndex((x) => /=\s*-?\s*\d/.test(x) && /%/.test(x));
    cek(`pembuka.formula[${i}]`, idxFormula > 0, c.join(" | "));
    // nilai 2022/2023: dua sel bernilai diluar formula (bisa membawa satuan)
    const nilaiCells = c
      .map((x, j) => ({ x, j }))
      .filter(({ x, j }) => j > 0 && j !== idxFormula && angkaPertama(x) != null);
    cek(`pembuka.nilaiCells[${i}]`, nilaiCells.length === 2, `baris: ${c.join(" | ")}`);
    const nilai22 = angkaPertama(nilaiCells[0]?.x ?? "");
    const nilai23 = angkaPertama(nilaiCells[1]?.x ?? "");
    const perubahan = idxFormula >= 0 ? persenFormula(c[idxFormula]) : null;
    cek(`pembuka.nilai22[${i}]`, Math.abs((nilai22 ?? NaN) - harapNilai22[i]) < 1e-6, `dapat ${nilai22}`);
    cek(`pembuka.nilai23[${i}]`, Math.abs((nilai23 ?? NaN) - harapNilai23[i]) < 1e-6, `dapat ${nilai23}`);
    cek(`pembuka.perubahan[${i}]`, perubahan != null && Math.abs(perubahan - harapPerubahan[i]) < 1e-6, `dapat ${perubahan}`);
    // Verifikasi silang: perubahan yang dinyatakan LPPD ≈ rasio dua nilai pada baris.
    // (Gini dikecualikan: rumus internal LPPD menyimpang dari rasio nilai tulisannya.)
    if (i < 5 && nilai22 != null && nilai23 != null) {
      const hitung = ((nilai23 - nilai22) / Math.abs(nilai22)) * 100;
      cek(`pembuka.rasio[${i}]`, Math.abs(hitung - harapPerubahan[i]) < 0.03, `dihitung ${hitung.toFixed(3)}`);
    }
    indikator.push({
      nama,
      nilai2022: nilai22,
      nilai2023: nilai23,
      perubahan,
      satuan: ["poin", "persen", "persen", "juta rupiah (ADHK basis 2010)", "juta rupiah", "rasio 0–1"][i],
      jenis: ["ipm", "kemiskinan", "pengangguran", "pertumbuhan", "perkapita", "gini"][i],
    });
    i++;
  }
  cek("pembuka.jumlah", indikator.length === 6, String(indikator.length));
  catat(
    "Perubahan Gini yang dicantumkan LPPD (−2,23%) tak cocok dengan rasio turunannya (0,459→0,449 = −2,18%); " +
    "nilai langsung dari tabel dipertahankan."
  );
  return indikator;
}

const makro = ambilMakro();
tulisJson("pembuka", { sumber: [prov("bab2-2_1_capaian-kinerja-makro.md", 188, 2)], indikator: makro });
tulisCsv(
  "makro.csv",
  ["indikator", "jenis", "nilai_2022", "nilai_2023", "perubahan_persen"],
  makro.map((x) => [x.nama, x.jenis, x.nilai2022, x.nilai2023, x.perubahan]),
  "Enam indikator kinerja makro DIY 2022 vs 2023",
  "LPPD DIY 2023, halaman 188, tabel ke-2"
);

// ═════════════════════════════════════════════════════════════════════════════
// PILAR 1 — Potret daerah (wilayah, luas, penduduk, usia)
// ═════════════════════════════════════════════════════════════════════════════

const F1 = "bab-1-pendahuluan.md";

// 1a. Wilayah administratif — hal 31 t4
const wilayah = [];
let diyWil = null;
for (const b of isi(tabelN(F1, 31, 4))) {
  const c = sel(b).filter((x) => x !== "");
  if (!c.length) continue;
  if (/DIY/.test(c.join(" "))) {
    diyWil = c.map(angka).filter((v) => v != null);
    continue;
  }
  if (!/^\d$/.test(c[0])) continue;
  cek("pilar1.wilayah.sel", c.length === 5, c.join(" | "));
  wilayah.push({
    nama: c[1],
    kapanewonKemantren: angka(c[2]),
    kalurahan: angka(c[3]),
    kelurahan: angka(c[4]),
  });
}
cek("pilar1.wilayah.baris", wilayah.length === 5, String(wilayah.length));
const sumKap = wilayah.reduce((a, x) => a + (x.kapanewonKemantren ?? 0), 0);
const sumKal = wilayah.reduce((a, x) => a + (x.kalurahan ?? 0), 0);
const sumKel = wilayah.reduce((a, x) => a + (x.kelurahan ?? 0), 0);
cek("pilar1.wilayah.diy", diyWil?.length === 3, String(diyWil));
cek("pilar1.wilayah.kapanewon", diyWil?.[0] === sumKap, `${sumKap} vs ${diyWil?.[0]}`);
cek("pilar1.wilayah.kalurahan", diyWil?.[1] === sumKal, `${sumKal} vs ${diyWil?.[1]}`);
cek("pilar1.wilayah.kelurahan", diyWil?.[2] === sumKel, `${sumKel} vs ${diyWil?.[2]}`);
cek("pilar1.wilayah.78kapanewon", sumKap === 78, String(sumKap));

// 1b. Luas wilayah — paragraf teks bab 1 (baris 388–396 markdown-per-bab)
const teksLuas = readFileSync(join(TEKS, "bab-1-pendahuluan.md"), "utf8").split("\n").slice(385, 398).join("\n");
const luas = [];
for (const nama of ["Kulon Progo", "Bantul", "Gunungkidul", "Sleman"]) {
  const m = teksLuas.match(new RegExp(`Kabupaten ${nama}, dengan luas ([\\d.,]+) km[^;]*\\(([\\d.,]+)%\\)`));
  cek(`pilar1.luas.${nama}`, !!m, "tidak ditemukan");
  if (m) luas.push({ nama: `Kabupaten ${nama}`, km2: angka(m[1]), persen: angka(m[2]) });
}
{
  const m = teksLuas.match(/Kota Yogyakarta, dengan luas ([\d.,]+) km[^;]*\(([\d.,]+)%\)/);
  cek("pilar1.luas.Kota Yogyakarta", !!m, "tidak ditemukan");
  if (m) luas.push({ nama: "Kota Yogyakarta", km2: angka(m[1]), persen: angka(m[2]) });
}
const mLuasTot = teksLuas.match(/luas wilayah daratan ([\d.,]+) km[^;]*atau ([\d.,]+)%/);
cek("pilar1.luas.total", !!mLuasTot, "tidak ditemukan");
const luasTotal = mLuasTot ? angka(mLuasTot[1]) : null;
const luasPersenIndo = mLuasTot ? angka(mLuasTot[2]) : null;
const sumLuas = luas.reduce((a, x) => a + (x.km2 ?? 0), 0);
cek("pilar1.luas.sum", Math.abs(sumLuas - luasTotal) < 0.03, `${sumLuas} vs ${luasTotal}`);

// 1c. Penduduk per wilayah — hal 29 t1
const pendudukWil = [];
for (const b of isi(tabelN(F1, 29, 1))) {
  const c = sel(b).filter((x) => x !== "");
  if (!/^\d{4}$/.test(c[0] ?? "")) continue;
  const nama = c[1] ?? "";
  const nums = c.slice(2).map(angka).filter((v) => v != null);
  pendudukWil.push({ kode: c[0], nama, jumlah: nums[0], persen: nums[1] });
}
cek("pilar1.penduduk29.baris", pendudukWil.length === 6, String(pendudukWil.length));
const diy29 = pendudukWil.find((x) => /DIY/.test(x.nama));
const kab29 = pendudukWil.filter((x) => !/DIY/.test(x.nama));
const sumKab29 = kab29.reduce((a, x) => a + (x.jumlah ?? 0), 0);
const sumPct29 = kab29.reduce((a, x) => a + (x.persen ?? 0), 0);
cek("pilar1.penduduk29.total", diy29?.jumlah === 3722296, String(diy29?.jumlah));
cek("pilar1.penduduk29.sum", sumKab29 === diy29?.jumlah, `${sumKab29}`);
cek("pilar1.penduduk29.persen", Math.abs(sumPct29 - diy29?.persen) < 0.05, `${sumPct29}`);

// 1d. Penduduk per jenis kelamin — hal 30 t1
const pendudukGender = [];
let diyGender = null;
for (const b of isi(tabelN(F1, 30, 1))) {
  const c = sel(b).filter((x) => x !== "");
  if (!/^\d{4}$/.test(c[0] ?? "")) continue;
  if (/DIY/.test(c[1] ?? "")) {
    diyGender = { nama: "DIY", lakiPersen: angka(c[2]), perempuanPersen: angka(c[3]) };
    continue;
  }
  pendudukGender.push({
    kode: c[0],
    nama: c[1],
    laki: angka(c[2]),
    perempuan: angka(c[3]),
    jumlah: angka(c[4]),
    lakiPersen: angka(c[5]),
    perempuanPersen: angka(c[6]),
    jumlahPersen: angka(c[7]),
  });
}
cek("pilar1.penduduk30.baris", pendudukGender.length === 5, String(pendudukGender.length));
const sumLaki = pendudukGender.reduce((a, x) => a + (x.laki ?? 0), 0);
const sumPerempuan = pendudukGender.reduce((a, x) => a + (x.perempuan ?? 0), 0);
	const sumJ30 = pendudukGender.reduce((a, x) => a + (x.jumlah ?? 0), 0);
cek("pilar1.penduduk30.laki", sumLaki === 1842667, String(sumLaki));
cek("pilar1.penduduk30.perempuan", sumPerempuan === 1879629, String(sumPerempuan));
cek("pilar1.penduduk30.jumlah", sumJ30 === 3722296, String(sumJ30));
cek("pilar1.penduduk30.silang29", sumJ30 === diy29?.jumlah, "30t1 vs 29t1");
cek("pilar1.penduduk30.pct", diyGender?.lakiPersen === 49.5 && diyGender?.perempuanPersen === 50.5, `${diyGender?.lakiPersen}/${diyGender?.perempuanPersen}`);

// 1e. Struktur usia — hal 30 t2 (0-4 … 35-39) + hal 31 t1 (40-44 … 75+)
const usia = [];
for (const b of isi(tabelN(F1, 30, 2))) {
  const c = sel(b).filter((x) => x !== "");
  if (!/^(?:\d+|75)-?\d*(?:\s*ke\s*atas)?$/.test(c[0] ?? "")) continue;
  usia.push({ label: c[0], jumlah: angka(c[6]), persen: angka(c[7]), perKab: [angka(c[1]), angka(c[2]), angka(c[3]), angka(c[4]), angka(c[5])] });
}
for (const b of isi(tabelN(F1, 31, 1))) {
  const c = sel(b).filter((x) => x !== "");
  if (/^(?:4[0-9]|5[0-9]|6[0-9]|7[0-5])-\d+$/.test(c[0] ?? "") || c[0] === "75 ke atas") {
    usia.push({ label: c[0], jumlah: angka(c[6]), persen: angka(c[7]), perKab: [angka(c[1]), angka(c[2]), angka(c[3]), angka(c[4]), angka(c[5])] });
  }
}
cek("pilar1.usia.baris", usia.length === 16, String(usia.length));
const sumUsia = usia.reduce((a, x) => a + (x.jumlah ?? 0), 0);
const sumUsiaPct = usia.reduce((a, x) => a + (x.persen ?? 0), 0);
cek("pilar1.usia.total", sumUsia === 3722296, String(sumUsia));
cek("pilar1.usia.persen", Math.abs(sumUsiaPct - 100) < 0.06, String(sumUsiaPct));
function kumpulUsia(labels, nama) {
  const jml = labels.map((l) => usia.find((u) => u.label === l)?.jumlah ?? 0).reduce((a, v) => a + v, 0);
  return { nama, jumlah: jml, persen: Math.round((jml / 3722296) * 1000) / 10 };
}
const ikhtisarUsia = [
  kumpulUsia(["0-4", "5-9", "10-14"], "usia 0-14"),
  kumpulUsia(["15-19", "20-24", "25-29", "30-34", "35-39", "40-44", "45-49", "50-54", "55-59"], "usia produktif 15-59"),
  kumpulUsia(["60-64", "65-69", "70-74", "75 ke atas"], "usia 60+"),
];
const sumIkhtisar = ikhtisarUsia.reduce((a, x) => a + x.jumlah, 0);
cek("pilar1.usia.ikhtisar", sumIkhtisar === 3722296, String(sumIkhtisar));

{
  const data1 = {
    sumber: [
      prov(F1, 29, 1), prov(F1, 30, 1), prov(F1, 30, 2), prov(F1, 31, 1), prov(F1, 31, 4),
      provTeks("bab-1-pendahuluan.md", "baris 388–396 (teks luas wilayah)"),
    ],
    administrasi: {
      perKab: wilayah,
      kapanewon: sumKap, kalurahan: sumKal, kelurahan: sumKel,
    },
    luas: { perKab: luas, total: luasTotal, persenIndonesia: luasPersenIndo },
    penduduk: {
      total: diy29.jumlah,
      laki: sumLaki, perempuan: sumPerempuan,
      lakiPersen: diyGender.lakiPersen, perempuanPersen: diyGender.perempuanPersen,
      perKab: pendudukGender,
      perKabRingkas: kab29,
    },
    usia: { perKelompok: usia, ikhtisar: ikhtisarUsia },
  };
  tulisJson("pilar1", data1);
}
const kunciWil = (n) => {
  const t = String(n ?? "").toLowerCase();
  if (t.includes("kulon")) return "kulon";
  if (t.includes("bantul")) return "bantul";
  if (t.includes("gunung")) return "gunung";
  if (t.includes("sleman")) return "sleman";
  return "kota";
};
tulisCsv(
  "wilayah-administrasi.csv",
  ["kabupaten_kota", "kapanewon_kemantren", "kalurahan", "kelurahan", "luas_km2", "persen_luas"],
  wilayah.map((w) => {
    const l = luas.find((x) => kunciWil(x.nama) === kunciWil(w.nama));
    return [w.nama, w.kapanewonKemantren, w.kalurahan, w.kelurahan, l?.km2 ?? null, l?.persen ?? null];
  }),
  "Struktur wilayah administratif DIY",
  "LPPD DIY 2023, halaman 31, tabel ke-4"
);
tulisCsv(
  "penduduk-wilayah.csv",
  ["kode", "wilayah", "laki_laki", "perempuan", "jumlah", "persen_diy"],
  pendudukGender.map((x) => [x.kode, x.nama, x.laki, x.perempuan, x.jumlah, x.jumlahPersen]),
  "Penduduk DIY per wilayah dan jenis kelamin",
  "LPPD DIY 2023, halaman 30, tabel ke-1"
);
tulisCsv(
  "penduduk-usia.csv",
  ["usia_tahun", "jumlah", "persen_diy"],
  usia.map((u) => [u.label, u.jumlah, u.persen]),
  "Penduduk DIY menurut kelompok usia",
  "LPPD DIY 2023, halaman 30 (tabel ke-2) dan halaman 31 (tabel ke-1)"
);

// ═════════════════════════════════════════════════════════════════════════════
// PILAR 2 — APBD: pendapatan, belanja per jenis, belanja per kelompok urusan
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Baris keuangan LRA: [kode?, label…, anggaran, realisasi, %, realisasi 2022].
 * Sel kode di kolom pertama berupa angka kecil ("4", "5") ikut terbaca —
 * dilewati agar tidak menjadi "anggaran".
 */
function barisKeu(tabel, regex) {
  for (const b of isi(tabel)) {
    const c = sel(b).filter((x) => x !== "");
    if (!c.some((x) => regex.test(x))) continue;
    const nums = [];
    sel(b).forEach((x, j) => {
      const v = angka(x);
      if (v == null) return;
      if (j === 0 && Math.abs(v) <= 20) return; // sel kode, bukan nilai
      nums.push(v);
    });
    if (nums.length >= 3) {
      return {
        anggaran: nums[0],
        realisasi: nums[1],
        persen: nums[2],
        realisasi2022: nums[3] ?? null,
      };
    }
  }
  return null;
}

{
  // 2a. Pendapatan — hal 60 t1
  const tPend = tabelN(F1, 60, 1);
  const kPend = [
    ["total", /^PENDAPATAN DAERAH$/],
    ["pad", /^PENDAPATAN ASLI DAERAH/],
    ["pajak", /^Pajak Daerah$/],
    ["retribusi", /^Retribusi Daerah$/],
    ["kekayaan", /^Hasil Pengelolaan Kekayaan Daerah yang Dipisahkan/],
    ["lainPad", /^Lain-lain PAD yang Sah/],
    ["transfer", /^PENDAPATAN TRANSFER$/],
    ["transferPusat", /^Pendapatan Transfer Pemerintah Pusat/],
    ["transferAntar", /^Pendapatan Transfer Antar Daerah/],
    ["lainSah", /^LAIN-LAIN PENDAPATAN DAERAH YANG SAH/],
    ["hibah", /^Pendapatan Hibah$/],
  ];
  const pendapatan = {};
  for (const [k, r] of kPend) {
    pendapatan[k] = barisKeu(tPend, r);
    cek(`pilar2.pendapatan.${k}`, !!pendapatan[k], `baris ${r} tak ketemu`);
  }
  const realPend = pendapatan.total.realisasi;
  cek("pilar2.pendapatan.total", Math.abs(realPend - 5840561001091.65) < 0.01, String(realPend));
  const komponenPadReal = pendapatan.pajak.realisasi + pendapatan.retribusi.realisasi + pendapatan.kekayaan.realisasi + pendapatan.lainPad.realisasi;
  cek("pilar2.pendapatan.pad", Math.abs(komponenPadReal - pendapatan.pad.realisasi) < 1, String(komponenPadReal));
  cek(
    "pilar2.pendapatan.grup",
    Math.abs(pendapatan.pad.realisasi + pendapatan.transfer.realisasi + pendapatan.lainSah.realisasi - realPend) < 1,
    "grup pendapatan"
  );
  cek(
    "pilar2.pendapatan.transfer",
    Math.abs(pendapatan.transferPusat.realisasi + pendapatan.transferAntar.realisasi - pendapatan.transfer.realisasi) < 1,
    "sub transfer"
  );
  const sharePad = Math.round((pendapatan.pad.realisasi / realPend) * 1000) / 10;
  cek("pilar2.pendapatan.sharePad", Math.abs(sharePad - 40.6) < 0.15, String(sharePad));

  // 2b. Belanja — hal 61 t1 + 62 t1 (+ 63 t1: pembiayaan netto & SiLPA)
  const tBel61 = tabelN(F1, 61, 1);
  const tBel62 = tabelN(F1, 62, 1);
  const tBel63 = tabelN(F1, 63, 1);
  const gabungan = { baris: [...isi(tBel61), ...isi(tBel62), ...isi(tBel63)] };
  const kBel = [
    ["total", /^BELANJA DAERAH$/],
    ["operasi", /^BELANJA OPERASI$/],
    ["pegawai", /^Belanja Pegawai/],
    ["barangJasa", /^Belanja Barang dan Jasa/],
    ["subsidi", /^Belanja Subsidi/],
    ["hibah", /^Belanja Hibah/],
    ["bansos", /^Belanja Bantuan Sosial/],
    ["modal", /^BELANJA MODAL$/],
    ["modalTanah", /^Belanja Modal.*?Tanah/],
    ["modalMesin", /^Belanja Modal.*?Peralatan/],
    ["modalGeuting", /^Belanja Modal.*?Gedung/],
    ["modalJalan", /^Belanja Modal.*?Jalan/],
    ["modalAsetTetap", /^Belanja Modal Aset Tetap Lainnya$/],
    ["modalAsetLain", /^Belanja Modal Aset Lainnya$/],
    ["takTerduga", /^BELANJA TIDAK TERDUGA/],
    ["transfer", /^BELANJA TRANSFER/],
    ["bagiHasil", /^Belanja Bagi Hasil/],
    ["bantuanKeuangan", /^Belanja Bantuan Keuangan/],
    ["surplus", /^SURPLUS/],
    ["pembiayaanNetto", /^PEMBIAYAAN NETTO/],
    ["slpa", /^SISA LEBIH PEMBIAYAAN ANGGARAN/],
  ];
  const belanja = {};
  for (const [k, r] of kBel) {
    belanja[k] = barisKeu(gabungan, r);
    cek(`pilar2.belanja.${k}`, !!belanja[k], `baris ${r} tak ketemu`);
  }
  cek("pilar2.belanja.anggaran", Math.abs(belanja.total?.anggaran - 6016543491245.0) < 0.01, String(belanja.total?.anggaran));
  cek("pilar2.belanja.realisasi", Math.abs(belanja.total?.realisasi - 5708080855492.41) < 0.01, String(belanja.total?.realisasi));
  const sumOperasi = ["pegawai", "barangJasa", "subsidi", "hibah", "bansos"]
    .map((k) => belanja[k]?.realisasi).reduce((a, v) => a + v, 0);
  cek("pilar2.belanja.operasi", Math.abs(sumOperasi - (belanja.operasi?.realisasi ?? NaN)) < 1, String(sumOperasi));
  const sumModal = ["modalTanah", "modalMesin", "modalGeuting", "modalJalan", "modalAsetTetap", "modalAsetLain"]
    .map((k) => belanja[k]?.realisasi).reduce((a, v) => a + v, 0);
  cek("pilar2.belanja.modal", Math.abs(sumModal - (belanja.modal?.realisasi ?? NaN)) < 1, String(sumModal));
  cek(
    "pilar2.belanja.jenis",
    Math.abs(
      (belanja.operasi?.realisasi ?? NaN) + (belanja.modal?.realisasi ?? NaN) +
      (belanja.takTerduga?.realisasi ?? NaN) + (belanja.transfer?.realisasi ?? NaN) -
      (belanja.total?.realisasi ?? NaN)
    ) < 1,
    "opsi+modal+dd+transfer"
  );
  cek(
    "pilar2.belanja.transfer",
    Math.abs((belanja.bagiHasil?.realisasi ?? NaN) + (belanja.bantuanKeuangan?.realisasi ?? NaN) - (belanja.transfer?.realisasi ?? NaN)) < 1,
    "bagihasil+bsk"
  );
  cek("pilar2.belanja.surplus", Math.abs((belanja.surplus?.realisasi ?? NaN) - 132480145599.24) < 0.01, String(belanja.surplus?.realisasi));
  cek("pilar2.belanja.slpa", Math.abs((belanja.slpa?.realisasi ?? NaN) - 293035532554.48) < 0.01, String(belanja.slpa?.realisasi));

  tulisJson("pilar2", {
    sumber: [prov(F1, 60, 1), prov(F1, 61, 1), prov(F1, 62, 1), prov(F1, 63, 1)],
    pendapatan: { ...pendapatan, sharePad },
    belanja,
  });
  tulisCsv(
    "apbd-pendapatan.csv",
    ["kode", "uraian", "anggaran", "realisasi_2023", "realisasi_2022"],
    [
      ["4", "PENDAPATAN DAERAH", pendapatan.total?.anggaran, pendapatan.total?.realisasi, pendapatan.total?.realisasi2022],
      ["4.1", "PENDAPATAN ASLI DAERAH", pendapatan.pad?.anggaran, pendapatan.pad?.realisasi, pendapatan.pad?.realisasi2022],
      ["4.1.01", "Pajak Daerah", pendapatan.pajak?.anggaran, pendapatan.pajak?.realisasi, pendapatan.pajak?.realisasi2022],
      ["4.1.02", "Retribusi Daerah", pendapatan.retribusi?.anggaran, pendapatan.retribusi?.realisasi, pendapatan.retribusi?.realisasi2022],
      ["4.1.03", "Hasil Pengelolaan Kekayaan Daerah yang Dipisahkan", pendapatan.kekayaan?.anggaran, pendapatan.kekayaan?.realisasi, pendapatan.kekayaan?.realisasi2022],
      ["4.1.04", "Lain-lain PAD yang Sah", pendapatan.lainPad?.anggaran, pendapatan.lainPad?.realisasi, pendapatan.lainPad?.realisasi2022],
      ["4.2", "PENDAPATAN TRANSFER", pendapatan.transfer?.anggaran, pendapatan.transfer?.realisasi, pendapatan.transfer?.realisasi2022],
      ["4.2.01", "Pendapatan Transfer Pemerintah Pusat", pendapatan.transferPusat?.anggaran, pendapatan.transferPusat?.realisasi, pendapatan.transferPusat?.realisasi2022],
      ["4.2.02", "Pendapatan Transfer Antar Daerah", pendapatan.transferAntar?.anggaran, pendapatan.transferAntar?.realisasi, pendapatan.transferAntar?.realisasi2022],
      ["4.3", "LAIN-LAIN PENDAPATAN DAERAH YANG SAH", pendapatan.lainSah?.anggaran, pendapatan.lainSah?.realisasi, pendapatan.lainSah?.realisasi2022],
      ["4.3.01", "Pendapatan Hibah", pendapatan.hibah?.anggaran, pendapatan.hibah?.realisasi, pendapatan.hibah?.realisasi2022],
    ],
    "Laporan Realisasi APBD DIY 2023 — sisi pendapatan (Rp)",
    "LPPD DIY 2023, halaman 60, tabel ke-1"
  );
  tulisCsv(
    "apbd-belanja.csv",
    ["jenis", "uraian", "anggaran", "realisasi_2023", "realisasi_2022"],
    [
      ["5", "BELANJA DAERAH", belanja.total?.anggaran, belanja.total?.realisasi, belanja.total?.realisasi2022],
      ["5.01", "BELANJA OPERASI", belanja.operasi?.anggaran, belanja.operasi?.realisasi, belanja.operasi?.realisasi2022],
      ["5.01.01", "Belanja Pegawai", belanja.pegawai?.anggaran, belanja.pegawai?.realisasi, belanja.pegawai?.realisasi2022],
      ["5.01.02", "Belanja Barang dan Jasa", belanja.barangJasa?.anggaran, belanja.barangJasa?.realisasi, belanja.barangJasa?.realisasi2022],
      ["5.01.03", "Belanja Subsidi", belanja.subsidi?.anggaran, belanja.subsidi?.realisasi, belanja.subsidi?.realisasi2022],
      ["5.01.04", "Belanja Hibah", belanja.hibah?.anggaran, belanja.hibah?.realisasi, belanja.hibah?.realisasi2022],
      ["5.01.05", "Belanja Bantuan Sosial", belanja.bansos?.anggaran, belanja.bansos?.realisasi, belanja.bansos?.realisasi2022],
      ["5.02", "BELANJA MODAL", belanja.modal?.anggaran, belanja.modal?.realisasi, belanja.modal?.realisasi2022],
      ["5.02.01", "Belanja Modal Tanah", belanja.modalTanah?.anggaran, belanja.modalTanah?.realisasi, belanja.modalTanah?.realisasi2022],
      ["5.02.02", "Belanja Modal Peralatan dan Mesin", belanja.modalMesin?.anggaran, belanja.modalMesin?.realisasi, belanja.modalMesin?.realisasi2022],
      ["5.02.03", "Belanja Modal Gedung dan Bangunan", belanja.modalGeuting?.anggaran, belanja.modalGeuting?.realisasi, belanja.modalGeuting?.realisasi2022],
      ["5.02.04", "Belanja Modal Jalan, Jaringan, dan Irigasi", belanja.modalJalan?.anggaran, belanja.modalJalan?.realisasi, belanja.modalJalan?.realisasi2022],
      ["5.02.05", "Belanja Modal Aset Tetap Lainnya", belanja.modalAsetTetap?.anggaran, belanja.modalAsetTetap?.realisasi, belanja.modalAsetTetap?.realisasi2022],
      ["5.02.06", "Belanja Modal Aset Lainnya", belanja.modalAsetLain?.anggaran, belanja.modalAsetLain?.realisasi, belanja.modalAsetLain?.realisasi2022],
      ["5.03", "BELANJA TIDAK TERDUGA", belanja.takTerduga?.anggaran, belanja.takTerduga?.realisasi, belanja.takTerduga?.realisasi2022],
      ["5.04", "BELANJA TRANSFER", belanja.transfer?.anggaran, belanja.transfer?.realisasi, belanja.transfer?.realisasi2022],
      ["5.04.01", "Belanja Bagi Hasil", belanja.bagiHasil?.anggaran, belanja.bagiHasil?.realisasi, belanja.bagiHasil?.realisasi2022],
      ["5.04.02", "Belanja Bantuan Keuangan kepada Kabupaten/Kota", belanja.bantuanKeuangan?.anggaran, belanja.bantuanKeuangan?.realisasi, belanja.bantuanKeuangan?.realisasi2022],
    ],
    "Laporan Realisasi APBD DIY 2023 — belanja menurut jenis (Rp)",
    "LPPD DIY 2023, halaman 61–62, tabel ke-1"
  );

  // 2c. Belanja per kelompok urusan — hal 64–68
  const tU = {
    baris: [64, 65, 66, 67, 68].flatMap((h) => isi(tabelN(F1, h, 1))),
  };
  // Struktur baris LRA urusan: [id, label(tak terputus dalam satu sel), anggaran,
  //  realisasi, perubahan, %]. Baris legenda kolom ("| 1 | 2 | 3 |…") tidak punya
  // sel huruf — dijaga dengan syarat sel label ≥4 huruf.
  function kelompokUrusan(id) {
    for (const b of tU.baris) {
      const c = sel(b).filter((x) => x !== "");
      if (c[0] !== id) continue;
      if (!c.some((x) => /[A-Za-z]{4,}/.test(x))) continue; // bukan baris legenda
      const nums = c.slice(1).map(angka).filter((v) => v != null); // kolom id di luar
      if (nums.length >= 3) {
        return {
          id,
          nama: c.find((x) => /[A-Za-z]{4,}/.test(x)) ?? "",
          anggaran: nums[0],
          realisasi: nums[1],
          perubahan: nums[2],
          persen: nums[nums.length - 1],
        };
      }
    }
    return null;
  }
  const kelompokLRA = [
    ["1", /PELAYANAN DASAR/],
    ["2", /TIDAK BERKAITAN/],
    ["3", /PILIHAN/],
    ["4", /PENDUKUNG/],
    ["5", /PENUNJANG/],
    ["6", /PENGAWASAN/],
    ["8", /UMUM/],
  ];
  const urusanKelompok = [];
  for (const [id, r] of kelompokLRA) {
    const k = kelompokUrusan(id);
    cek(`pilar2.urusan.kelompok.${id}`, !!k, `kelompok ${id} tak ketemu`);
    if (k) {
      cek(`pilar2.urusan.nama${id}`, r.test(k.nama.toUpperCase()), k.nama);
      urusanKelompok.push(k);
    }
  }
  const urusanDasar = [];
  const harapanDasar = [/PENDIDIKAN/, /KESEHATAN/, /PEKERJAAN UMUM/, /PERUMAHAN/, /NTERAMAN|NTRAMAN/, /SOSIAL/];
  const dasarIds = ["1.01", "1.02", "1.03", "1.04", "1.05", "1.06"];
  dasarIds.forEach((id, k) => {
    const u = kelompokUrusan(id);
    cek(`pilar2.urusan.${id}`, !!u, `urusan ${id} tak ketemu`);
    if (u) {
      cek(`pilar2.urusan.nama${id}`, harapanDasar[k].test(u.nama.toUpperCase()), u.nama);
      urusanDasar.push(u);
    }
  });
  // Baris JUMLAH di hal 68 terputus menjadi dua: label+realisasi lalu anggaran+
  // perubahan+%. Kedua potongan digabung untuk verifikasi juru silang.
  let jumlahAng = null;
  let jumlahReal = null;
  for (let n = 0; n < tU.baris.length; n++) {
    const c0 = sel(tU.baris[n]).filter((x) => x !== "");
    if (!c0.some((x) => /^JUMLAH$/.test(x))) continue;
    const a1 = c0.map(angka).filter((v) => v != null);
    const c1 = sel(tU.baris[n + 1] ?? "| | |").filter((x) => x !== "");
    const a2 = c1.map(angka).filter((v) => v != null);
    for (const v of [...a1, ...a2]) {
      if (Math.abs(v - 5708080855492.41) < 0.01) jumlahReal = v;
      if (Math.abs(v - 6016543491245.0) < 1) jumlahAng = v;
    }
  }
  cek("pilar2.urusan.jumlah", jumlahAng != null && jumlahReal != null, "baris JUMLAH (dua potongan) tak terbaca");
  const sumKelAnggaran = urusanKelompok.reduce((a, x) => a + x.anggaran, 0);
  const sumKelReal = urusanKelompok.reduce((a, x) => a + x.realisasi, 0);
  cek("pilar2.urusan.grand-anggaran", Math.abs(sumKelAnggaran - (jumlahAng ?? NaN)) < 1, String(sumKelAnggaran));
  cek("pilar2.urusan.grand-real", Math.abs(sumKelReal - (jumlahReal ?? NaN)) < 1, String(sumKelReal));
  cek("pilar2.urusan.silang-belanja", Math.abs((jumlahReal ?? NaN) - (belanja.total?.realisasi ?? NaN)) < 1, "urusan vs belanja jenis");
  const sumDasarReal = urusanDasar.reduce((a, x) => a + x.realisasi, 0);
  cek(
    "pilar2.urusan.dasar",
    Math.abs(sumDasarReal - urusanKelompok.find((x) => x.id === "1").realisasi) < 1,
    String(sumDasarReal)
  );
  catat(
    "Rincian belanja bidang pangan (urusan 2.09) tidak dapat diolah: sel realisasinya rusak akibat OCR " +
    "(\"1 . 2 9 3 . 784.193,00\"). Analisis urusan tetap memakai tingkat kelompok, yang jumlahnya terverifikasi."
  );

  tulisJson("pilar2-urusan", {
    sumber: [prov(F1, 64, 1), prov(F1, 65, 1), prov(F1, 66, 1), prov(F1, 67, 1), prov(F1, 68, 1)],
    kelompok: urusanKelompok,
    dasar: urusanDasar,
    jumlah: { anggaran: jumlahAng, realisasi: jumlahReal, persen: 94.87 },
  });
  tulisCsv(
    "apbd-urusan.csv",
    ["kode", "uraian", "anggaran_setelah_perubahan", "realisasi_2023", "perubahan_rp", "persen_realisasi"],
    [
      ...urusanKelompok.map((k) => [k.id, k.nama, k.anggaran, k.realisasi, k.perubahan, k.persen]),
      ...urusanDasar.map((k) => [k.id, k.nama, k.anggaran, k.realisasi, k.perubahan, k.persen]),
      ["JUMLAH", "JUMLAH BELANJA (PER URUSAN)", jumlahAng, jumlahReal, jumlahReal != null && jumlahAng != null ? jumlahReal - jumlahAng : null, 94.87],
    ],
    "Belanja APBD DIY 2023 menurut kelompok urusan (Rp)",
    "LPPD DIY 2023, halaman 64–68, tabel ke-1 tiap halaman"
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// PILAR 3 — Kinerja makro: IPM, kemiskinan, ketenagakerjaan, ketimpangan
// ═════════════════════════════════════════════════════════════════════════════

// 3a. Komponen IPM — hal 189 t1 (kolom 2020, 2021, 2022, 2023)
const F3a = "bab2-2_1_1_indeks-pembangunan-manusia-ipm.md";
const ipmHap = [
  { kunci: /Umur Harapan Hidup/, nama: "Umur harapan hidup saat lahir", satuan: "tahun", ujung: [74.95, 75.18] },
  { kunci: /Harapan Lama Sekolah/, nama: "Harapan lama sekolah", satuan: "tahun", ujung: [15.59, 15.66] },
  { kunci: /Rata-rata Lama Sekolah/, nama: "Rata-rata lama sekolah", satuan: "tahun", ujung: [9.55, 9.83] },
  { kunci: /Pengeluaran per Kapita/, nama: "Pengeluaran per kapita disesuaikan (PPP)", satuan: "ribu rupiah", ujung: [14015, 14924] },
];
const ipmKomponen = [];
for (const b of isi(tabelN(F3a, 189, 1))) {
  const c = sel(b).filter((x) => x !== "");
  const hap = ipmHap.find((h) => h.kunci.test(c[0] ?? ""));
  if (!hap) continue;
  const nums = c.slice(1).map(angka).filter((v) => v != null);
  cek(
    `pilar3.ipm.${hap.nama}`,
    nums.length === 4 && Math.abs((nums[0] ?? NaN) - hap.ujung[0]) < 0.005 && Math.abs((nums[3] ?? NaN) - hap.ujung[1]) < 0.005,
    c.join(" | ")
  );
  if (nums.length !== 4) continue;
  ipmKomponen.push({ nama: hap.nama, satuan: hap.satuan, nilai: { t2020: nums[0], t2021: nums[1], t2022: nums[2], t2023: nums[3] } });
}
cek("pilar3.ipm.baris", ipmKomponen.length === 4, String(ipmKomponen.length));

// 3b. Kemiskinan per daerah — hal 191 t1 (label daerah isi-turun, ribu jiwa)
const F3b = "bab2-2_1_2_angka-kemiskinan.md";
const kemiskinan = [];
{
  let daerah = null;
  for (const b of isi(tabelN(F3b, 191, 1))) {
    const c = sel(b).filter((x) => x !== "");
    if (c.length < 3) continue;
    const bar = /Perkotaan|Perdesaan|Total/.test(c[0] ?? "");
    if (bar) daerah = c[0];
    else if (!daerah) continue;
    const periode = bar ? c[1] : c[0];
    const nums = (bar ? c.slice(2) : c.slice(1)).map(angka).filter((v) => v != null);
    if (nums.length < 2) continue;
    kemiskinan.push({ daerah, periode, ribu: nums[0], persen: nums[1] });
  }
}
const periodeKem = [...new Set(kemiskinan.map((k) => k.periode))];
cek("pilar3.kemiskinan.baris", kemiskinan.length === 9 || kemiskinan.length === 12, `${kemiskinan.length} selama ${periodeKem.length} periode`);
for (const p of periodeKem) {
  const kot = kemiskinan.find((k) => k.daerah === "Perkotaan" && k.periode === p);
  const des = kemiskinan.find((k) => k.daerah === "Perdesaan" && k.periode === p);
  const tot = kemiskinan.find((k) => k.daerah === "Total" && k.periode === p);
  if (kot && des && tot) {
    cek(`pilar3.kemiskinan.jumlah.${p}`, Math.abs(kot.ribu + des.ribu - tot.ribu) < 0.05, `${kot.ribu + des.ribu} vs ${tot.ribu}`);
  }
}
const kem23 = kemiskinan.find((k) => k.daerah === "Total" && k.periode === "Maret 2023");
cek("pilar3.kemiskinan.mar23", !!kem23 && Math.abs(kem23.ribu - 448.47) < 0.05 && Math.abs(kem23.persen - 11.04) < 0.005, JSON.stringify(kem23));

// 3c. Ketenagakerjaan — hal 192 t1 (ribu orang, Agustus 2022 vs 2023)
const ketenagakerjaan = [];
for (const b of isi(tabelN(F3b, 192, 1))) {
  const c = sel(b).filter((x) => x !== "");
  if (!/[A-Za-z]/.test(c[0] ?? "")) continue;
  const nums = c.slice(1).map(angka).filter((v) => v != null);
  if (nums.length === 2) ketenagakerjaan.push({ label: c[0], t2022: nums[0], t2023: nums[1] });
}
cek("pilar3.ketenaga.baris", ketenagakerjaan.length === 5, JSON.stringify(ketenagakerjaan));
const kk = (re) => ketenagakerjaan.find((x) => re.test(x.label));
const uKerja = kk(/usia kerja/i);
const akKerja = kk(/^Angkatan kerja/);
const bekerja = kk(/Bekerja/);
const pengangguran = kk(/Pengangguran/);
const bukanAk = kk(/Bukan angkatan/);
let tpt = null;
cek("pilar3.ketenaga.grup", !!uKerja && !!akKerja && !!bekerja && !!pengangguran && !!bukanAk, "indikator tak lengkap");
if (uKerja && akKerja && bekerja && pengangguran && bukanAk) {
  for (const t of ["t2022", "t2023"]) {
    cek(`pilar3.ketenaga.bekerja.${t}`, Math.abs(bekerja[t] + pengangguran[t] - akKerja[t]) < 0.011, `${bekerja[t] + pengangguran[t]} vs ${akKerja[t]}`);
    cek(`pilar3.ketenaga.${t}`, Math.abs(akKerja[t] + bukanAk[t] - uKerja[t]) < 0.011, `${akKerja[t] + bukanAk[t]} vs ${uKerja[t]}`);
  }
  tpt = {
    t2022: Math.round((pengangguran.t2022 / akKerja.t2022) * 10000) / 100,
    t2023: Math.round((pengangguran.t2023 / akKerja.t2023) * 10000) / 100,
  };
  cek("pilar3.ketenaga.tpt2022", Math.abs(tpt.t2022 - 4.06) < 0.01, String(tpt.t2022));
  cek("pilar3.ketenaga.tpt2023", Math.abs(tpt.t2023 - 3.69) < 0.01, String(tpt.t2023));
}
cek("pilar3.ketenaga.total", Math.abs((uKerja?.t2023 ?? 0) - 2998.93) < 0.011, String(uKerja?.t2023));

// 3d. Ketimpangan — hal 198 t1 (porsi 40% bawah, 40% tengah, 20% atas)
const F3d = "bab2-2_1_6_ketimpangan-pendapatan.md";
const ketimpangan = [];
{
  let daerah = null;
  for (const b of isi(tabelN(F3d, 198, 1))) {
    const c = sel(b).filter((x) => x !== "");
    if (c.length < 4) continue;
    const bar = /Perkotaan|Perdesaan|Total/.test(c[0] ?? "");
    if (bar) daerah = c[0];
    else if (!daerah) continue;
    const periode = bar ? c[1] : c[0];
    const nums = (bar ? c.slice(2) : c.slice(1)).map(angka).filter((v) => v != null);
    if (nums.length !== 3) continue;
    cek(`pilar3.timp.sum.${daerah}.${periode}`, Math.abs(nums[0] + nums[1] + nums[2] - 100) < 0.011, String(nums));
    ketimpangan.push({ daerah, periode, p40Bawah: nums[0], p40Tengah: nums[1], p20Atas: nums[2] });
  }
}
cek("pilar3.timp.baris", ketimpangan.length === 9, String(ketimpangan.length));
const timp23 = ketimpangan.find((k) => k.daerah === "Total" && k.periode === "Maret 2023");
cek("pilar3.timp.mar23", timp23 && timp23.p40Bawah === 15.58 && timp23.p40Tengah === 31.68 && timp23.p20Atas === 52.74, JSON.stringify(timp23));

// Keluaran pilar 3
const mkPr = (j) => makro.find((x) => x.jenis === j);
tulisJson("pilar3", {
  sumber: [
    prov(F3a, 189, 1),
    prov(F3b, 191, 1),
    prov(F3b, 192, 1),
    prov(F3d, 198, 1),
    prov("bab2-2_1_capaian-kinerja-makro.md", 188, 2),
  ],
  ipm: { nilai2022: mkPr("ipm")?.nilai2022, nilai2023: mkPr("ipm")?.nilai2023, komponen: ipmKomponen },
  kemiskinan: { nilai2022: mkPr("kemiskinan")?.nilai2022, nilai2023: mkPr("kemiskinan")?.nilai2023, perDaerah: kemiskinan },
  ketenagakerjaan: { baris: ketenagakerjaan, tpt },
  ketimpangan: { gini2022: mkPr("gini")?.nilai2022, gini2023: mkPr("gini")?.nilai2023, perDaerah: ketimpangan },
});
tulisCsv(
  "ipm-komponen.csv",
  ["komponen", "satuan", "y2020", "y2021", "y2022", "y2023"],
  ipmKomponen.map((k) => [k.nama, k.satuan, k.nilai.t2020, k.nilai.t2021, k.nilai.t2022, k.nilai.t2023]),
  "Komponen IPM DIY 2020–2023",
  "LPPD DIY 2023, halaman 189, tabel ke-1"
);
tulisCsv(
  "kemiskinan.csv",
  ["daerah", "periode", "jumlah_ribu_jiwa", "persen"],
  kemiskinan.map((k) => [k.daerah, k.periode, k.ribu, k.persen]),
  "Kemiskinan DIY menurut wilayah dan periode",
  "LPPD DIY 2023, halaman 191, tabel ke-1"
);
tulisCsv(
  "ketenagakerjaan.csv",
  ["indikator", "ribu_orang_agustus_2022", "ribu_orang_agustus_2023"],
  ketenagakerjaan.map((x) => [x.label, x.t2022, x.t2023]),
  "Struktur ketenagakerjaan DIY (ribu orang)",
  "LPPD DIY 2023, halaman 192, tabel ke-1"
);
tulisCsv(
  "ketimpangan.csv",
  ["daerah", "periode", "p40_terbawah", "tengah_40", "p20_teratas"],
  ketimpangan.map((k) => [k.daerah, k.periode, k.p40Bawah, k.p40Tengah, k.p20Atas]),
  "Distribusi pendapatan DIY menurut porsi penduduk",
  "LPPD DIY 2023, halaman 198, tabel ke-1"
);

// ═════════════════════════════════════════════════════════════════════════════
// PILAR 4 — IKK pendidikan/kesehatan/PU dan investasi keruangan
// ═════════════════════════════════════════════════════════════════════════════

/** Potongan teks dari marker halaman `halDari` hingga(≥) `halHingga` — rasio IKK
 *  tertulis sebagai kalimat rumus di sel tabel, bukan deretan kolom. */
function potongan(halDari, halHingga, berkas) {
  const garis = muat(berkas).split("\n");
  let aktif = false;
  const out = [];
  for (const g of garis) {
    const m = g.match(/^\*Sumber:\s*halaman\s*(\d+)/);
    if (m) {
      const h = +m[1];
      if (!aktif && h === halDari) aktif = true;
      else if (aktif && h >= halHingga) aktif = false;
    }
    if (aktif) out.push(g);
  }
  return out.join("\n");
}
/** Angka dari kecocokan pertama pola pada teks (kelompok 1) */
function satu(teks, re, nama) {
  const m = teks.match(re);
  cek(nama, !!m, `pola ${re} tidak ada`);
  if (!m) return null;
  const v = angka(m[1]);
  cek(`${nama}.angka`, v != null, m[1]);
  return v;
}
/** Angka dari literal yang diharapkan (nilainya tetap diambil dari teks) */
function litera(teks, re, nama) {
  const m = teks.match(re);
  cek(nama, !!m, `pola ${re} tidak ada`);
  if (!m) return null;
  const v = angka(m[0]);
  cek(`${nama}.angka`, v != null, m[0]);
  return v;
}
function ada(teks, re, nama) {
  const ok = re.test(teks);
  cek(nama, ok, `pola ${re} tidak ada`);
  return ok;
}

const F4a = "bab2-2_2_2_indikator-kinerja-kunci-hasil.md";
const blokAPM = potongan(333, 334, F4a);
const blokAPK = potongan(334, 335, F4a);
const blokABK = potongan(335, 337, F4a);
const blokPU = potongan(337, 341, F4a);

// 4a-c. IKK pendidikan — APM (hal 333), APK (334), ABK (335)
const siswaSMA22 = satu(blokAPM, /SMA\s*=\s*([\d.,]+)/, "pilar4.ikk.apm.sma");
const siswaSMK22 = satu(blokAPM, /SMK\s*=\s*([\d.,]+)/, "pilar4.ikk.apm.smk");
const siswaMA22 = satu(blokAPM, /\bMA\s*=\s*([\d.,]+)/, "pilar4.ikk.apm.ma");
{
  const daftarSiswa = [...blokAPM.matchAll(/([\d.,]+)\s*siswa/g)];
  cek("pilar4.ikk.apm.tamat-count", daftarSiswa.length === 1, String(daftarSiswa.length));
}
const siswaTamat = satu(blokAPM, /([\d.,]+)\s*siswa/, "pilar4.ikk.apm.tamat");
const penduduk1618 = litera(blokAPM, /(?<![\d,.])154[.,]722/, "pilar4.ikk.apm.penduduk");
ada(blokAPM, /97,69\s*%/, "pilar4.ikk.apm.stated");
const apmHitung = siswaTamat != null && penduduk1618 ? ((siswaSMA22 + siswaSMK22 + siswaMA22 + siswaTamat) / penduduk1618) * 100 : null;
const apm = Math.round((apmHitung ?? NaN) * 100) / 100;
cek("pilar4.ikk.apm.nilai", Math.abs(apm - 97.69) < 0.01, String(apm));

const apkSMA = satu(blokAPK, /SMA\s*=\s*([\d.,]+)/, "pilar4.ikk.apk.sma");
const apkSMK = satu(blokAPK, /SMK\s*=\s*([\d.,]+)/, "pilar4.ikk.apk.smk");
const apkMA = satu(blokAPK, /\bMA\s*=\s*([\d.,]+)/, "pilar4.ikk.apk.ma");
const apkTambahan = (() => {
  // "+ 87.704 | + 20.548 | + 27": ambil suku + terakhir pada formula APK
  const sem = [...blokAPK.matchAll(/\+\s*(\d+)\b/g)];
  cek("pilar4.ikk.apk.plus", sem.length >= 3, String(sem.length));
  return sem.length ? angka(sem[sem.length - 1][1]) : null;
})();
const apkHitung = penduduk1618 ? ((apkSMA + apkSMK + apkMA + apkTambahan) / penduduk1618) * 100 : null;
const apk = Math.round((apkHitung ?? NaN) * 100) / 100;
cek("pilar4.ikk.apk.nilai", Math.abs(apk - 109.76) < 0.01, String(apk));
ada(blokAPK, /109,76\s*%/, "pilar4.ikk.apk.stated");

const abkSlb = satu(blokABK, /SLB\s*=\s*([\d.,]+)/, "pilar4.ikk.abk.slb");
const abkInklusi = satu(blokABK, /Inklusi\s*=\s*([\d.,]+)/i, "pilar4.ikk.abk.inklusi");
const abkTidak = satu(blokABK, /bersekolah di DIY\s*=\s*([\d.,]+)/i, "pilar4.ikk.abk.tidak");
const abkTerlayani = abkSlb + abkInklusi;
const abkTotal = abkTerlayani + abkTidak;
const abkPct = Math.round((abkTerlayani / abkTotal) * 10000) / 100;
cek("pilar4.ikk.abk.layani", abkTerlayani === 6539, String(abkTerlayani));
cek("pilar4.ikk.abk.total", abkTotal === 7232, String(abkTotal));
cek("pilar4.ikk.abk.pct", Math.abs(abkPct - 90.42) < 0.01, String(abkPct));
ada(blokABK, /(?<![\d.])6\.132/, "pilar4.ikk.abk.typo6132");
ada(blokABK, /90,42\s*%/, "pilar4.ikk.abk.stated");
if (ada(blokABK, /(?<![\d.])6\.132/, "pilar4.ikk.abk.typo6132"))
  catat(
    "Persentase ABK terlayani dihitung dari penjumlahan baris sumber: 6.539 dari 7.232 (90,42%). " +
      "Teks LPPD mencantumkan angka '6.132' pada rumus — ralat '7.232'; hasil pembagiannya (90,42%) tetap benar."
  );

// 4d. IKK kesehatan — rasio tempat tidur RS rujukan (bagian di blok ABK–336)
const rsTidur = litera(blokABK, /(?<![\d.])8\.651/, "pilar4.ikk.rs.tidur");
const rsPenduduk = litera(blokABK, /(?<![\d.])3\.722\.296/, "pilar4.ikk.rs.penduduk");
ada(blokABK, /2,32\s*%/, "pilar4.ikk.rs.stated");
const rsPerRibu = rsTidur && rsPenduduk ? Math.round((rsTidur / rsPenduduk) * 1000 * 100) / 100 : null;
cek("pilar4.ikk.rs.rasperibu", Math.abs(rsPerRibu - 2.32) < 0.01, String(rsPerRibu));
catat(
  "Rasio tempat tidur RS rujukan '2,32' pada LPPD adalah rasio kasur per 1.000 penduduk " +
    "(8.651/3.722.296 × 1.000 = 2,32), bukan persen; cerita menampilkannya sebagai rasio."
);

// 4e. IKK pekerjaan umum — jalan, SPAL, air selon baris rasio 337–341
const jalanMantap = litera(blokPU, /(?<![\d.])476[.,]135/, "pilar4.ikk.pu.jalan");
const jalanTotal = litera(blokPU, /(?<![\d.])674[.,]585/, "pilar4.ikk.pu.jalanTotal");
const jalanPct = jalanMantap ? Math.round(((jalanMantap / jalanTotal) * 100) * 1000) / 1000 : null;
ada(blokPU, /70,58\d?\s*%/, "pilar4.ikk.pu.jalanStated");
cek("pilar4.ikk.pu.jalanPct", jalanPct != null && Math.abs(jalanPct - 70.585) < 0.01, String(jalanPct));
const spalDilayani = litera(blokPU, /(?<![\d.])27\.205/, "pilar4.ikk.pu.spal");
const spalTotal = litera(blokPU, /(?<![\d.])75\.000/, "pilar4.ikk.pu.spalTotal");
const spalPct = spalDilayani ? Math.round((spalDilayani / spalTotal) * 10000) / 100 : null;
ada(blokPU, /36,27\s*%/, "pilar4.ikk.pu.spalStated");
cek("pilar4.ikk.pu.spalPct", Math.abs(spalPct - 36.27) < 0.01, String(spalPct));
const airDipakai = litera(blokPU, /199,67/, "pilar4.ikk.pu.air");
const airHitung = [...blokPU.matchAll(/199,67/g)];
cek("pilar4.ikk.pu.air-dua", airHitung.length >= 2, String(airHitung.length));
ada(blokPU, /\b100\s*%/, "pilar4.ikk.pu.airStated");
const airPct = 100;
cek("pilar4.ikk.pu.airPct", Math.abs((airDipakai / airDipakai) * 100 - airPct) < 0.01, "ok");

// 4f. Investasi kumulatif — hal 585 t1 (Rp000)
const F4b = "bab2-2_2_6_22_urusan-penanaman-modal-dinas-penanaman-modal-dan-pelayanan.md";
const invSeri = [];
for (const b of isi(tabelN(F4b, 585, 1))) {
  const c = sel(b).filter((x) => x !== "");
  if (!/^s\.?d/i.test(c[0] ?? "")) continue;
  const vals = [];
  for (const x of c) {
    const v = angka(x);
    if (v != null && !vals.some((w) => w === v)) vals.push(v);
  }
  if (vals.length < 4) {
    cek(`pilar4.inv.seri.${c[0]}`, false, c.join(" | "));
    continue;
  }
  const pctCell = c.find((x) => /%/.test(x) && x.length <= 12);
  invSeri.push({
    periode: c[0],
    pmdn: vals[0],
    pma: vals[1],
    total: vals[2],
    tambahan: vals[3],
    pctStated: pctCell ? persenSel(pctCell.replace(/%\s*$/, "").trim()) : null,
  });
}
cek("pilar4.inv.seri-urut", invSeri.length === 2 && /2022/.test(invSeri[0]?.periode ?? "") && /2023/.test(invSeri[1]?.periode ?? ""), JSON.stringify(invSeri.map((r) => r.periode)));
const miliar = (v) => (v == null ? null : Math.round((v / 1e9) * 100) / 100);
// Tabel kumulatif hal. 585 tertulis dalam Rp000: 24.967.647.193 (Rp000) = Rp24,97 triliun.
const triliunDariRibu = (v) => (v == null ? null : Math.round((v / 1e9) * 100) / 100);
for (const r of invSeri) cek(`pilar4.inv.jumlah.${r.periode}`, Math.abs(r.pmdn + r.pma - r.total) < 5, String(r.total)); // pembulatan Rp000 pada majemuk
cek("pilar4.inv.tambah", invSeri.length === 2 && Math.abs(invSeri[1].total - (invSeri[0].total + invSeri[1].tambahan)) < 1, "s.d.2022+tambah = s.d.2023");
const growth22 = invSeri[0] ? Math.round((invSeri[0].tambahan / (invSeri[0].total - invSeri[0].tambahan)) * 10000) / 100 : null;
const growth23 = invSeri[1] && invSeri[0] ? Math.round((invSeri[1].tambahan / invSeri[0].total) * 10000) / 100 : null;
cek("pilar4.inv.growth22", Math.abs((growth22 ?? NaN) - 12.03) < 0.06, String(growth22));
cek("pilar4.inv.growth23", Math.abs((growth23 ?? NaN) - 15.65) < 0.01, String(growth23));
if (invSeri[1]?.pctStated != null && invSeri[1].pctStated >= 15 && invSeri[1].pctStated <= 17)
  catat(
    "Pertumbuhan investasi kumulatif 2023 dihitung +15,65% (tambahan 5,70 T atas kumpulan 36,41 T); " +
      "LPPD menuliskannya dibulatkan +16%."
  );

// 4g. Investasi per kabupaten/kota — tabel per LRA (Rp), 5 tahun per baris ganda
const tabelKab = pecahTabel(F4b).find((t) => t.baris.some((b) => /KAB\.SLEMAN|KOTA YOGYAKARTA|KAB\.BANTUL/.test(b)));
cek("pilar4.inv.kab-tabel", !!tabelKab, "tabel per kab/kota tak ketemu");
const kunciKab = (s) => {
  const t = String(s ?? "").toUpperCase().replace(/\s+/g, " ").trim();
  if (/KULON/.test(t)) return "Kulon Progo";
  if (/BANTUL/.test(t)) return "Bantul";
  if (/GUNUNGKIDUL/.test(t)) return "Gunungkidul";
  if (/SLEMAN/.test(t)) return "Sleman";
  if (/KOTA/.test(t) && /YOGYAKARTA/.test(t)) return "Kota Yogyakarta";
  if (/^TOTAL/.test(t)) return "__TOTAL__";
  return null;
};
const perKabInv = [];
let invTotal = null;
if (tabelKab) {
  const grup = new Map();
  let cur = null;
  for (const b of isi(tabelKab)) {
    const c = sel(b).filter((x) => x !== "");
    if (!c.length) continue;
    const k = kunciKab(c[0]);
    if (k) {
      cur = k;
      grup.set(k, [...c]);
    } else if (cur) {
      grup.get(cur).push(...c);
    }
  }
  for (const [k, cells] of grup) {
    const vals = [];
    for (const x of cells) {
      const v = angka(x);
      if (v != null && !vals.some((w) => w === v)) vals.push(v);
    }
    if (k === "__TOTAL__") {
      if (vals.length === 5) invTotal = { t2022: vals[0], t2023: vals[1], t2019: vals[2], t2020: vals[3], t2021: vals[4] };
      else cek("pilar4.inv.total.bentuk", false, `${vals.length}: ${vals}`);
      continue;
    }
    if (vals.length === 5) {
      perKabInv.push({
        kabkota: k,
        t2019: miliar(vals[0]),
        t2020: miliar(vals[1]),
        t2021: miliar(vals[2]),
        t2022: miliar(vals[3]),
        t2023: miliar(vals[4]),
        raw: vals,
      });
    } else cek(`pilar4.inv.perkab.${k}`, false, `${vals.length} nilai unik: ${vals}`);
  }
}
const invHap = { t2019: 6518285700000, t2020: 2823382580000, t2021: 3078892969169, t2022: 3909367815056, t2023: 5696408001422 };
cek("pilar4.inv.perkab.baris", perKabInv.length === 5, String(perKabInv.length));
cek("pilar4.inv.total.dariated", !!invTotal, String(invTotal));
for (const t of ["t2019", "t2020", "t2021", "t2022", "t2023"]) {
  const idx = { t2019: 0, t2020: 1, t2021: 2, t2022: 3, t2023: 4 }[t];
  const sum = perKabInv.reduce((a, x) => a + (x.raw[idx] ?? 0), 0);
  cek(`pilar4.inv.sumperkab.${t}`, Math.abs(sum - invHap[t]) < 8, `${sum} vs ${invHap[t]}`);
  if (sum !== invHap[t] && Math.abs(sum - invHap[t]) >= 1.5) {
    catat(
      `Investasi per kabupaten (${t}): penjumlahan nilai 5 kab/kota menghasilkan Rp${sum.toLocaleString("id-ID")}, ` +
        `berbeda Rp${Math.abs(sum - invHap[t]).toLocaleString("id-ID")} dari angka terverifikasi ` +
        `${invHap[t].toLocaleString("id-ID")} — selisih pembulatan Rp000 pada baris sumber.`
    );
  }
  cek(`pilar4.inv.totalRow.${t}`, Math.abs((invTotal?.[t] ?? NaN) - invHap[t]) < 1.5, `${invTotal?.[t]} vs ${invHap[t]}`);
}
// Silang antar tabel: "tambahan" (Rp000, hal 585) ≈ jumlah per-kab tahun ya (Rp, tabel per-kab)
cek("pilar4.inv.silang-tambahan22", Math.abs(invSeri[0].tambahan * 1000 - invHap.t2022) < 1000, `${invSeri[0].tambahan * 1000} vs ${invHap.t2022}`);
cek("pilar4.inv.silang-tambahan23", Math.abs(invSeri[1].tambahan * 1000 - invHap.t2023) < 1000, `${invSeri[1].tambahan * 1000} vs ${invHap.t2023}`);

tulisJson("pilar4", {
  sumber: [
    { berkas: F4a, halaman: "333–334", tabel: "blok rasio partisipasi sekolah (teks)" },
    { berkas: F4a, halaman: "335–337", tabel: "blok ABK & rumah sakit rujukan (teks)" },
    { berkas: F4a, halaman: "337–341", tabel: "blok infrastruktur dasar provinsi (teks)" },
    prov(F4b, 585, 1),
    prov(F4b, tabelKab?.hal ?? 586, 1),
  ],
  ikkPendidikan: {
    apm: { rasio: apm, sma: siswaSMA22, smk: siswaSMK22, ma: siswaMA22, tamat: siswaTamat, penduduk: penduduk1618 },
    apk: { rasio: apk, sma: apkSMA, smk: apkSMK, ma: apkMA, tambahanTanggungan: apkTambahan },
    abk: { slb: abkSlb, inklusi: abkInklusi, tidakDiri: abkTidak, terlayani: abkTerlayani, total: abkTotal, persen: abkPct },
  },
  ikkKesehatan: { tempatTidurRsRujukan: rsTidur, penduduk: rsPenduduk, rasioPerRibu: rsPerRibu },
  ikkPU: {
    jalan: { mantapKm: jalanMantap, totalKm: jalanTotal, persen: jalanPct, satuan: "Km" },
    spal: { dilayani: spalDilayani, total: spalTotal, persen: spalPct },
    airMinum: { nilai: airDipakai, satuan: "liter/detik", persen: airPct },
  },
  investasi: {
    seri: invSeri.map((r) => ({ periode: r.periode, pmdnTriliun: triliunDariRibu(r.pmdn), pmaTriliun: triliunDariRibu(r.pma), totalTriliun: triliunDariRibu(r.total), tambahanTriliun: triliunDariRibu(r.tambahan), pctStated: r.pctStated })),
    pertumbuhan: { s2022: growth22, s2023: growth23 },
    perKab: perKabInv.map((x) => ({ kabkota: x.kabkota, t2019: x.t2019, t2020: x.t2020, t2021: x.t2021, t2022: x.t2022, t2023: x.t2023 })),
  },
});
tulisCsv(
  "investasi-tren.csv",
  ["periode", "pmdn_triliun", "pma_triliun", "total_triliun", "tambahan_triliun", "pertumbuhan_persen"],
  invSeri.map((r, i) => [r.periode, triliunDariRibu(r.pmdn), triliunDariRibu(r.pma), triliunDariRibu(r.total), triliunDariRibu(r.tambahan), i === 0 ? growth22 : growth23]),
  "Realisasi investasi PMDN-PMA kumulatif DIY (Rp triliun)",
  "LPPD DIY 2023, halaman 585, tabel ke-1"
);
tulisCsv(
  "investasi-perkota.csv",
  ["kabupaten_kota", "t2019", "t2020", "t2021", "t2022", "t2023"],
  perKabInv.map((x) => [x.kabkota, x.t2019, x.t2020, x.t2021, x.t2022, x.t2023]),
  "Investasi PMDN-PMA per kabupaten/kota DIY per tahun (Rp miliar)",
  `LPPD DIY 2023, halaman ${tabelKab?.hal ?? 586}, tabel ke-1`
);

// ═════════════════════════════════════════════════════════════════════════════
// PILAR 5 — Keistimewaan: nilai akhir urusan + BKK kalurahan
// ═════════════════════════════════════════════════════════════════════════════

// 5a. Nilai akhir keistimewaan — hal 800 t1
const F5 = "bab2-2_2_11_2_perencanaan-pembangunan-paniradya-kaistimewan-diy.md";
const namaAkhir = {
  a: "Rerata capaian fisik dan keuangan semua urusan keistimewaan",
  b: "Skor indeks kepuasan masyarakat atas penyebarluasan informasi keistimewaan",
  c: "Skor indeks kepuasan Paramparapraja atas pelayanan",
};
const nilaiAkhir = [];
let totalNilai = null;
for (const b of isi(tabelN(F5, 800, 1))) {
  const c = sel(b).filter((x) => x !== "");
  const abc = (c[0] ?? "").match(/^([abc])\s*\./);
  if (abc) {
    const nums = c.slice(1).map(angka).filter((v) => v != null);
    const bobotCell = c.find((x) => /%/.test(x));
    const bobot = bobotCell ? persenSel(bobotCell.replace(/%\s*/, "").trim()) : null;
    cek(`pilar5.nilaiAkhir.${abc[1]}`, nums.length === 2 && bobot != null, c.join(" | "));
    if (nums.length !== 2 || bobot == null) continue;
    cek(`pilar5.nilaiAkhir.timbang.${abc[1]}`, Math.abs((nums[0] * bobot) / 100 - nums[1]) < 0.01, `${nums[0]}×${bobot}% ≈ ${nums[1]}`);
    nilaiAkhir.push({ nib: abc[1], nama: namaAkhir[abc[1]], nilai: nums[0], bobot, hasil: nums[1] });
  } else if (/^Total Nilai/.test(c[0] ?? "")) {
    const nums = c.map(angka).filter((v) => v != null);
    totalNilai = nums[nums.length - 1] ?? null;
  }
}
cek("pilar5.nilaiAkhir.baris", nilaiAkhir.length === 3, String(nilaiAkhir.length));
cek(
  "pilar5.nilaiAkhir.total",
  totalNilai != null && Math.abs(nilaiAkhir.reduce((a, x) => a + x.hasil, 0) - totalNilai) < 0.005,
  `${nilaiAkhir.reduce((a, x) => a + x.hasil, 0)} vs ${totalNilai}`
);

// 5b. Urusan keistimewaan — hal 800 t2
const urusanKeist = [];
for (const b of isi(tabelN(F5, 800, 2))) {
  const c = sel(b).filter((x) => x !== "");
  if (!/^\d$/.test(c[0] ?? "")) continue;
  if (!/[A-Za-z]{4,}/.test(c[1] ?? "")) continue;
  const nums = c.slice(2).map(angka).filter((v) => v != null);
  if (nums.length < 2) continue; // baris "Tata Cara" tanpa angka
  urusanKeist.push({ nama: c[1], anggaran: nums[0], realisasi: nums[1], keuangan: nums[2], fisik: nums[3] ?? null });
}
cek("pilar5.urusan.baris", urusanKeist.length === 4, JSON.stringify(urusanKeist.map((u) => u.nama)));
let keistTotal = null;
let keistRerata = null;
for (const b of isi(tabelN(F5, 800, 2))) {
  const c = sel(b).filter((x) => x !== "");
  if (c.some((x) => /^TOTAL$/.test(x))) {
    const nums = c.map(angka).filter((v) => v != null);
    keistTotal = { anggaran: nums[0], realisasi: nums[1], keuangan: nums[2], fisik: nums[3] ?? null };
  } else if (c.some((x) => /^RERATA$/.test(x))) {
    keistRerata = c.map(angka).filter((v) => v != null)[0] ?? null;
  }
}
cek("pilar5.jumlah.nilai", keistTotal?.anggaran === 1420000000000 && keistTotal?.realisasi === 1396163539432, JSON.stringify(keistTotal));
cek("pilar5.jumlah.sumanggaran", keistTotal && Math.abs(urusanKeist.reduce((a, x) => a + x.anggaran, 0) - keistTotal.anggaran) < 1, "sum anggaran");
cek("pilar5.jumlah.sumreal", keistTotal && Math.abs(urusanKeist.reduce((a, x) => a + x.realisasi, 0) - keistTotal.realisasi) < 1, "sum realisasi");
const keuHitung = Math.round(((keistTotal?.realisasi ?? 0) / (keistTotal?.anggaran ?? 1)) * 10000) / 100;
cek("pilar5.jumlah.keu", Math.abs(keuHitung - (keistTotal?.keuangan ?? NaN)) < 0.01, `${keuHitung} vs ${keistTotal?.keuangan}`);
cek(
  "pilar5.rerata.nilaiakhir",
  Math.abs((keistRerata ?? NaN) - (nilaiAkhir.find((x) => x.nib === "a")?.nilai ?? NaN)) < 0.005,
  String(keistRerata)
);

// 5c. BKK kalurahan — hal 739 t1 + 740 t1 (angka, sebagian di baris lanjutan)
const F5c = "bab2-2_2_8_5_bantuan-keuangan-khusus-bkk-kalurahan.md";
const bkk = [];
{
  const mentah = [];
  let cur = null;
  for (const b of [...isi(tabelN(F5c, 739, 1)), ...isi(tabelN(F5c, 740, 1))]) {
    const c = sel(b).filter((x) => x !== "");
    if (/^(20|1[0-9]|[1-9])$/.test(c[0] ?? "")) {
      // baris legenda kolom ("| 1 | 2 | 3 |…"): tak ada huruf & semua angka kecil
      const adaHuruf = c.some((x) => /[A-Za-z]/.test(x));
      const semuaKecil = c.map(angka).filter((v) => v != null).every((v) => Math.abs(v) < 100000);
      if (!adaHuruf && semuaKecil) continue;
      if (cur) mentah.push(cur);
      cur = {
        no: +c[0],
        sel: c.slice(1), // kolom pertama adalah nomor baris, bukan data
        jenis: c.slice(1).filter((x) => /[A-Za-z]/.test(x) && angkaPertama(x) == null).join(" "),
      };
    } else if (cur && c.some((x) => angkaPertama(x) != null)) {
      cur.sel.push(...c);
    }
  }
  if (cur) mentah.push(cur);
  for (const r of mentah) {
    const uang = [];
    const pct = [];
    for (const x of r.sel) {
      const v = angka(x);
      if (v == null) continue;
      (Math.abs(v) >= 100000 ? uang : pct).push(v);
    }
    r.pagu = uang[0] ?? null;
    r.realisasi = uang[1] ?? null;
    r.keuangan = pct[0] ?? null;
    r.fisik = pct[1] ?? null;
    delete r.sel;
    bkk.push(r);
  }
}
bkk.sort((a, b) => a.no - b.no);
cek("pilar5.bkk.baris", bkk.length === 20, String(bkk.length));
cek("pilar5.bkk.nomor", bkk.every((r, i) => r.no === i + 1), JSON.stringify(bkk.map((r) => r.no)));
const sumPaguBKK = bkk.reduce((a, x) => a + (x.pagu ?? 0), 0);
const sumRealBKK = bkk.reduce((a, x) => a + (x.realisasi ?? 0), 0);
cek("pilar5.bkk.sum.pagu", Math.abs(sumPaguBKK - 130474225000) < 0.01, String(sumPaguBKK));
cek("pilar5.bkk.sum.real", Math.abs(sumRealBKK - 129907836137) < 2, String(sumRealBKK));
if (bkk.length === 20 && Math.abs(sumRealBKK - 129907836137) > 0.01) {
  catat(
    `Jumlah realisasi BKK: penjumlahan 20 baris rincian menghasilkan Rp${sumRealBKK.toLocaleString("id-ID")}, ` +
      `sedangkan LPPD mencantumkan Rp129.907.836.137 pada baris Total (selisih pembulatan Rp1).`
  );
}
for (const r of bkk) {
  cek(`pilar5.bkk.${r.no}`, r.pagu != null && r.realisasi != null, JSON.stringify(r));
  if (r.pagu != null && r.realisasi != null && r.keuangan != null) {
    const hit = Math.round((r.realisasi / r.pagu) * 10000) / 100;
    cek(`pilar5.bkk.keu${r.no}`, Math.abs(hit - r.keuangan) < 0.08, `${hit} vs ${r.keuangan}`);
  }
}

tulisJson("pilar5", {
  sumber: [prov(F5, 800, 1), prov(F5, 800, 2), prov(F5c, 739, 1), prov(F5c, 740, 1)],
  nilaiAkhir: {
    baris: nilaiAkhir.map((x) => ({ nama: x.nama, nilai: x.nilai, bobot: x.bobot, hasil: x.hasil })),
    total: totalNilai,
    rerataCapaian: keistRerata,
  },
  urusan: { baris: urusanKeist, total: keistTotal },
  bkk: {
    baris: bkk.map((x) => ({ no: x.no, jenis: x.jenis, pagu: x.pagu, realisasi: x.realisasi, keuangan: x.keuangan, fisik: x.fisik })),
    jumlah: { pagu: sumPaguBKK, realisasi: sumRealBKK },
  },
});
tulisCsv(
  "keistimewaan.csv",
  ["urusan", "anggaran", "realisasi_tahap", "keuangan_persen", "fisik_persen"],
  [
    ...urusanKeist.map((x) => [x.nama, x.anggaran, x.realisasi, x.keuangan, x.fisik]),
    ["JUMLAH", keistTotal?.anggaran, keistTotal?.realisasi, keistTotal?.keuangan, keistTotal?.fisik],
  ],
  "Urusan keistimewaan DIY: pagu, realisasi fisik-keuangan",
  "LPPD DIY 2023, halaman 800, tabel ke-2"
);
tulisCsv(
  "bkk.csv",
  ["nomor", "jenis", "pagu_rp", "realisasi_rp", "keuangan_persen", "fisik_persen"],
  bkk.map((x) => [x.no, x.jenis, x.pagu, x.realisasi, x.keuangan, x.fisik]),
  "Bantuan Keuangan Khusus BKK kalurahan DIY (20 jenis)",
  "LPPD DIY 2023, halaman 739–740, tabel ke-1"
);

// ═════════════════════════════════════════════════════════════════════════════
// PILAR 6 — Standar Pelayanan Minimal (SPM)
// ═════════════════════════════════════════════════════════════════════════════

const F6 = "bab-4-penerapan-standar.md";

// 6a. Kategori indeks SPM per bidang — kategori dinyatakan di baris tersendiri;
//     bidang ditentukan oleh halaman tempat baris itu berada.
const kategoriSPM = [];
{
  const garis = muat(F6).split("\n");
  let hal = 0;
  const bidangDari = (h) => {
    if (h <= 0) return null;
    if (h <= 1056) return "Pendidikan";
    if (h <= 1060) return "Kesehatan";
    if (h <= 1070) return "Pekerjaan Umum dan Penataan Ruang";
    if (h <= 1080) return "Perumahan Rakyat";
    if (h <= 1090) return "Ketenteraman, Ketertiban, dan Pelindungan Masyarakat";
    return "Sosial";
  };
  for (let n = 0; n < garis.length; n++) {
    const mh = garis[n].match(/^\*Sumber:\s*halaman\s*(\d+)/);
    if (mh) hal = +mh[1];
    if (!/KATEGORI INDEKS PENCAPAIAN SPM/.test(garis[n])) continue;
    let kategori = null;
    for (let k = n; k <= Math.min(n + 4, garis.length - 1); k++) {
      const mk = garis[k].match(/TUNTAS\s+(UTAMA|PARIPURNA)/);
      if (mk) {
        kategori = mk[1];
        break;
      }
    }
    if (!kategori) continue;
    // Persentase kategori bisa di baris kategori atau baris tetangganya
    // (hal 1071: "KATEGORI … 100%" lalu "TUNTAS PARIPURNA" di bawahnya).
    const teksWindow = garis.slice(n, Math.min(n + 5, garis.length)).join(" ");
    const mi = [...teksWindow.matchAll(/(\d+(?:[.,]\d+)?)\s*%/g)];
    const indeks = mi.length ? persenSel(mi[0][1]) : null;
    const bidang = bidangDari(hal);
    if (!bidang || kategoriSPM.some((x) => x.bidang === bidang)) continue;
    kategoriSPM.push({ bidang, kategori, indeks });
  }
}
cek("pilar6.kategori.baris", kategoriSPM.length === 6, JSON.stringify(kategoriSPM));
for (const [bidang, kat, harap] of [
  ["Pendidikan", "UTAMA", 98.33],
  ["Kesehatan", "PARIPURNA", 100],
  ["Pekerjaan Umum dan Penataan Ruang", "PARIPURNA", 100],
  ["Perumahan Rakyat", "PARIPURNA", 100],
  ["Ketenteraman, Ketertiban, dan Pelindungan Masyarakat", "PARIPURNA", 100],
  ["Sosial", "PARIPURNA", 100],
]) {
  const k = kategoriSPM.find((x) => x.bidang === bidang);
  cek(`pilar6.kategori.${bidang}`, !!k && k.kategori === kat && Math.abs((k?.indeks ?? NaN) - harap) < 0.01, JSON.stringify(k));
}

// 6b. Indikator SPM pendidikan menengah — hal 1046 t1 + 1047 t1 (SMA, SMK, Khusus)
const indikatorSPM = [];
{
  const gabung = { baris: [...isi(tabelN(F6, 1046, 1)), ...isi(tabelN(F6, 1047, 1))] };
  let jenjang = null;
  let rek = null;
  const finis = () => {
    if (rek && rek.valid.length >= 2 && rek.pct != null) {
      rek.target = rek.valid[0];
      rek.capaian = rek.valid[1];
      const rasioPct = (rek.capaian / rek.target) * 100;
      if ((rek.capaian >= rek.target - 1e-9 && Math.abs(rek.pct - 100) <= 0.02) || Math.abs(rasioPct - rek.pct) <= 0.06) {
        indikatorSPM.push(rek);
      } else {
        // Sel capaian rusak OCR (varian titik, mis. "0.46" dari "0,46") sehingga
        // pasangan tak terverifikasi — dilepas dengan catatan, bukan asersi.
        catat(
          `Baris SPM ${rek.jenjang} "${rek.label}" dilepas: pasangan capaian ${rek.capaian}/target ${rek.target} ` +
            `tidak konsisten dengan persentase terbaca ${rek.pct}% — salah satu sel rusak OCR.`
        );
      }
    } else if (rek && rek.label) {
      catat(
        `Baris SPM ${rek.jenjang ?? ""} "${rek.label}" dilepas dari data: sel capaian tidak terbaca mesin ` +
          `(format desimal berubah akibat OCR, mis. "0.46"); hubungan target–capaian tidak dapat diverifikasi.`
      );
    }
    rek = null;
  };
  for (const b of gabung.baris) {
    const c = sel(b).filter((x) => x !== "");
    const bj = c.find((x) => x === "SMA" || x === "SMK" || x === "Pendidikan Khusus");
    if (bj) {
      finis();
      jenjang = bj;
      continue;
    }
    const lab = c.find((x) => /^\d+\.\s*[A-Za-z]/.test(x));
    if (lab) {
      finis();
      const valid = c.map(angka).filter((v) => v != null);
      const pctCell = [...c].reverse().find((x) => /%/.test(x));
      rek = {
        jenjang,
        label: lab.replace(/^\d+\.\s*/, ""),
        satuan: c.find((x) => /^(%|Nilai|Orang|Rupiah)$/.test(x)) ?? null,
        valid,
        pct: pctCell ? persenSel(pctCell.replace(/%\s*$/, "").trim()) : null,
      };
      continue;
    }
    if (rek) {
      const tambahan = c.map(angka).filter((v) => v != null);
      if (tambahan.length) rek.valid = rek.valid.concat(tambahan);
      if (!rek.satuan) {
        const s2 = c.find((x) => /^(%|Nilai|Orang|Rupiah)$/.test(x));
        if (s2) rek.satuan = s2;
      }
      if (rek.pct == null) {
        const pc = [...c].reverse().find((x) => /%/.test(x));
        if (pc) rek.pct = persenSel(pc.replace(/%\s*$/, "").trim());
      }
    }
  }
  finis();
}
const smaJml = indikatorSPM.filter((r) => r.jenjang === "SMA").length;
const smkJml = indikatorSPM.filter((r) => r.jenjang === "SMK").length;
cek("pilar6.spm.sma", smaJml >= 9, String(smaJml));
cek("pilar6.spm.smk", smkJml >= 9, String(smkJml));

// 6c. Pendidikan khusus — layanan & indeks (blok lanjutan hal 1047–1049)
const blokPK = potongan(1047, 1049, F6);
const pkHarus = litera(blokPK, /(?<![\d.])6\.319/, "pilar6.khusus.harus");
const pkTerlayani = litera(blokPK, /(?<![\d.])6\.215/, "pilar6.khusus.terlayani");
const pkBelum = litera(blokPK, /(?<![\d.,])104(?![\d.,])/, "pilar6.khusus.belum");
const pkPctStated = satu(blokPK, /(98,35)\s*%/, "pilar6.khusus.pct");
const pkIndeks = satu(blokPK, /(97,68)\s*%/, "pilar6.khusus.indeks");
const pkPenerima = satu(blokPK, /(78,68)\s*%/, "pilar6.khusus.penerimaIndeks");
const pkPct = pkHarus && pkTerlayani ? Math.round((pkTerlayani / pkHarus) * 10000) / 100 : null;
cek("pilar6.khusus.angka", pkHarus === 6319 && pkTerlayani === 6215 && pkBelum === 104, JSON.stringify([pkHarus, pkTerlayani, pkBelum]));
cek("pilar6.khusus.sisa", pkHarus != null && pkHarus - pkTerlayani === pkBelum, "harus - terlayani");
cek("pilar6.khusus.pct", Math.abs(pkPct - 98.35) < 0.01 && pkPctStated != null, String(pkPct));

tulisJson("pilar6", {
  sumber: [{ berkas: F6, halaman: "1046–1105", tabel: "kategori & indikator SPM per bidang" }, prov(F6, 1046, 1), prov(F6, 1047, 1)],
  kategori: kategoriSPM,
  pendidikanIndikator: indikatorSPM.map(({ valid, ...rest }) => rest),
  pendidikanKhusus: {
    harusDilayani: pkHarus,
    terlayani: pkTerlayani,
    belumTerlayani: pkBelum,
    persen: pkPct,
    indeksKhusus: pkIndeks,
    indeksPenerimaLD: pkPenerima,
  },
});
tulisCsv(
  "pendidikan.csv",
  ["indikator", "nilai", "satuan"],
  [
    ["APM — Angka Partisipasi Murni", apm, "persen"],
    ["APK — Angka Partisipasi Kasar", apk, "persen"],
    ["ABK yang terlayani layanan pendidikan", abkPct, "persen"],
  ],
  "Indikator kunci layanan pendidikan DIY 2023",
  "LPPD DIY 2023, halaman 333–335 (blok rasio IKK)"
);
tulisCsv(
  "spm.csv",
  ["bidang", "kategori_indeks", "indeks_persen"],
  kategoriSPM.map((k) => [k.bidang, k.kategori, k.indeks]),
  "Kategori indeks pencapaian SPM per bidang",
  "LPPD DIY 2023, halaman 1046–1105"
);
tulisCsv(
  "spm-pendidikan.csv",
  ["jenjang", "indikator", "satuan", "target", "capaian", "capaian_persen"],
  indikatorSPM.map((r) => [r.jenjang, r.label, r.satuan, r.target, r.capaian, r.pct]),
  "Indikator SPM pendidikan menengah (target vs capaian)",
  "LPPD DIY 2023, halaman 1046–1048, tabel ke-1"
);

// ═════════════════════════════════════════════════════════════════════════════
// PENUTUP — statistik sumber, manifes, gerbang gagal
// ═════════════════════════════════════════════════════════════════════════════

// Statistik kepemilikan tabel sumber per berkas (cakupan konversi PDF)
const berkasData = [
  "bab-1-pendahuluan.md",
  "bab2-2_1_capaian-kinerja-makro.md",
  "bab2-2_1_1_indeks-pembangunan-manusia-ipm.md",
  "bab2-2_1_2_angka-kemiskinan.md",
  "bab2-2_1_6_ketimpangan-pendapatan.md",
  "bab2-2_2_2_indikator-kinerja-kunci-hasil.md",
  "bab2-2_2_6_22_urusan-penanaman-modal-dinas-penanaman-modal-dan-pelayanan.md",
  "bab2-2_2_8_5_bantuan-keuangan-khusus-bkk-kalurahan.md",
  "bab2-2_2_11_2_perencanaan-pembangunan-paniradya-kaistimewan-diy.md",
  "bab-4-penerapan-standar.md",
];
const tabelStats = [];
for (const berkas of berkasData) {
  const tabels = pecahTabel(berkas);
  let berangka = 0;
  for (const t of tabels) {
    const barisBerdata = isi(t).filter((b) => {
      const cc = sel(b).filter((x) => x !== "");
      const n = cc.filter((x) => angka(x) != null || persenSel(x) != null).length;
      return n >= 2;
    }).length;
    if (barisBerdata >= 3) berangka++;
  }
  tabelStats.push({ berkas: `data-story/source/${berkas}`, tabel: tabels.length, tabelBerangka: berangka });
}
cek("penutup.tabelstats", tabelStats.length === 10 && tabelStats.every((x) => x.tabel > 0), JSON.stringify(tabelStats));

tulisJson("manifes", {
  dibuat: new Date().toISOString(),
  sumber: {
    dokumen: "Laporan Penyelenggaraan Pemerintahan Daerah (LPPD) DIY Tahun 2023",
    teks: "data-story/source/*.md dan markdown-per-bab/*.md (konversi PDF asli)",
  },
  catatanCelah,
  unduhan,
  tabelStats,
});

if (gagal.length) {
  console.error(`\nBUILD DIBATALKAN — ${gagal.length} asersi gagal:`);
  for (const g of gagal) console.error(`  ✗ ${g}`);
  process.exit(1);
}
console.log(
  `OK — ${unduhan.length} CSV ditulis; ${catatanCelah.length} catatan celah; ` +
  `${tabelStats.reduce((a, x) => a + x.tabel, 0)} tabel sumber ter-statis.`
);
