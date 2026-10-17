/**
 * Utilitas grafik. Seluruh grafik digambar sebagai SVG saat build — tidak ada
 * pustaka charting di sisi klien, dan setiap grafik terbaca dengan JavaScript
 * dimatikan (PRD §7.1, §11.1).
 *
 * Aturan yang berlaku untuk seluruh komponen (PRD §10):
 *  · Sumbu tunggal. Tidak pernah dua skala Y dalam satu grafik.
 *  · Warna mengikuti entitas, bukan peringkat.
 *  · Tanda tipis: garis 2 px, ujung data membulat 4 px, celah 2 px antarsegmen.
 *  · Teks memakai token teks, tidak pernah memakai warna seri.
 */
import type { Row } from "./data";

export const TIDAK_TERCATAT = "Tidak tercatat";

/**
 * Bulatkan koordinat SVG ke dua angka di belakang koma. Selain memangkas ukuran
 * HTML, ini menjaga agar tidak ada deretan digit panjang di dalam keluaran —
 * scripts/check_build.mjs memperlakukan deretan seperti itu sebagai dugaan
 * kunci individu dan menggagalkan build.
 */
export const q = (v: number): number => Math.round(v * 100) / 100;

/** Lima slot seri, urutan tetap, tidak pernah diputar ulang. */
export const SERI = ["var(--series-1)", "var(--series-2)", "var(--series-3)",
                     "var(--series-4)", "var(--series-5)"] as const;

/** Warna tanda untuk grafik satu seri: netral membawa, merah menyorot satu. */
export const MARK = {
  base: "var(--mark-base)",
  highlight: "var(--mark-highlight)",
  muted: "var(--mark-muted)",
  gap: "var(--mark-gap)",
} as const;

export const RAMP = ["var(--ramp-1)", "var(--ramp-2)", "var(--ramp-3)",
                     "var(--ramp-4)", "var(--ramp-5)"] as const;

export type SeriKey = "1" | "2" | "3" | "4" | "5" | "base" | "highlight" | "gap";

/** Isi dan penanda cetak untuk satu tanda grafik. */
export function isi(key: SeriKey): { fill: string; "data-seri": SeriKey } {
  const fill =
    key === "base" ? MARK.base
    : key === "highlight" ? MARK.highlight
    : key === "gap" ? "url(#arsir-celah)"
    : SERI[Number(key) - 1];
  return { fill, "data-seri": key };
}

/**
 * Nilai garis kisi dengan langkah yang bulat (1, 2, 2,5, 5, atau 10 kali
 * pangkat sepuluh), termasuk nol dan satu langkah di atas nilai terbesar.
 * Pembaca paroki membaca 0 - 250 - 500 - 750 - 1.000 - 1.250 jauh lebih cepat
 * daripada 0 - 313 - 625 - 938.
 */
export function kisi(max: number, _sasaran = 4): number[] {
  if (max <= 0) return [0, 1];
  const mag = 10 ** Math.floor(Math.log10(max));
  for (const m of [0.1, 0.2, 0.25, 0.5, 1, 2, 2.5, 5, 10]) {
    const langkah = m * mag;
    const jumlah = Math.ceil(max / langkah - 1e-9);
    if (jumlah >= 3 && jumlah <= 6) {
      return Array.from({ length: jumlah + 1 }, (_, i) =>
        Number((i * langkah).toFixed(6)));
    }
  }
  return [0, max];
}

/** Batas atas sumbu: garis kisi terakhir, supaya skala dan kisi selalu sepadan. */
export function batasAtas(max: number): number {
  const g = kisi(max);
  return g[g.length - 1] ?? 1;
}

/** Nilai terbesar di antara baris yang tidak disamarkan. */
export function maksBaris(rows: Row[]): number {
  return rows.reduce((m, r) => (r.n !== null && r.n > m ? r.n : m), 0);
}

/**
 * Pilih slot seri untuk satu label. "Tidak tercatat" selalu memakai arsir,
 * sehingga celah data terlihat sebagai celah dan bukan sebagai kategori biasa.
 */
export function slotUntuk(label: string, urut: number): SeriKey {
  if (label === TIDAK_TERCATAT) return "gap";
  return String((urut % 5) + 1) as SeriKey;
}

/**
 * Grafik satu seri: semua batang netral, kecuali satu yang disorot merah.
 * Inilah cara anggaran merah SADASA dijaga — merah menyorot satu angka yang
 * dibicarakan kalimat tafsir, bukan mewarnai seluruh grafik.
 */
export function sorotan(label: string, disorot?: string | string[]): SeriKey {
  if (label === TIDAK_TERCATAT) return "gap";
  const daftar = disorot === undefined ? [] : Array.isArray(disorot) ? disorot : [disorot];
  return daftar.includes(label) ? "highlight" : "base";
}

/** Langkah ramp (1..5) untuk satu nilai pada rentang [min, max]. */
export function langkahRamp(v: number, min: number, max: number): 1 | 2 | 3 | 4 | 5 {
  if (max <= min) return 1;
  const t = (v - min) / (max - min);
  return (Math.min(4, Math.floor(t * 5)) + 1) as 1 | 2 | 3 | 4 | 5;
}

/** Potong label panjang untuk sumbu, teks penuh tetap ada di tabel alternatif. */
export function potong(s: string, batas = 34): string {
  return s.length <= batas ? s : `${s.slice(0, batas - 1).trimEnd()}…`;
}

/** Perkiraan tinggi SVG untuk daftar batang mendatar. */
export function tinggiBatang(jumlah: number, tinggi: number, jarak: number, atas: number, bawah: number): number {
  return atas + jumlah * (tinggi + jarak) - jarak + bawah;
}
