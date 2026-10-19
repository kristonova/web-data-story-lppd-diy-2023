/**
 * Warna grafik turunan design system Jogja Istimewa.
 *
 * Seluruh nilai hex berasal dari palet pedoman: warna resmi (merah, marun,
 * emas, tinta), warna khas (hijau #184531, biru #045b87, terakota #ac6249),
 * dan warna lentur (magenta #a72185, oranye #f08519). Gradasi koroplet
 * dibentuk dengan mencampur warna tersebut ke krem/putih pedoman, jadi tidak
 * ada warna asing yang masuk ke halaman.
 *
 * Fungsi di sini berjalan saat build: grafik menerima hex jadi, bukan
 * variabel CSS, karena warna koroplet harus dihitung dari nilai data.
 */

/** Warna identitas kabupaten/kota — dipakai konsisten di seluruh cerita. */
export const WARNA_KAB: Record<string, string> = {
  "3401": "#a72185", // Kulon Progo — magenta
  "3402": "#f08519", // Bantul — oranye
  "3403": "#184531", // Gunungkidul — hijau khas
  "3404": "#045b87", // Sleman — biru khas
  "3471": "#811c1d", // Kota Yogyakarta — marun
  DIY: "#332c2b", // DIY — tinta
};

/** Gradasi berurutan, dari nilai terendah ke tertinggi. */
export const RAMP = {
  merah: ["#fbefe6", "#f4c3b0", "#e8806a", "#d82128", "#811c1d"],
  hijau: ["#eef4ec", "#bcd8c0", "#73a888", "#2f6e50", "#184531"],
  biru: ["#eaf2f6", "#b4d4e4", "#62a2c6", "#1d73a3", "#045b87"],
  emas: ["#fbf7e9", "#f0dfae", "#dab96b", "#b08a3e", "#6f5321"],
  terakota: ["#fbf1ea", "#ecc6ad", "#d0916f", "#ac6249", "#6d3a29"],
} as const;
export type NamaRamp = keyof typeof RAMP;

const rgb = (h: string): [number, number, number] => {
  const x = h.replace("#", "");
  return [parseInt(x.slice(0, 2), 16), parseInt(x.slice(2, 4), 16), parseInt(x.slice(4, 6), 16)];
};
const hex = (c: number[]): string =>
  "#" + c.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0")).join("");

/** Campur dua warna; t = 0 → a, t = 1 → b. */
export function campur(a: string, b: string, t: number): string {
  const [x, y] = [rgb(a), rgb(b)];
  return hex(x.map((v, i) => v + (y[i]! - v) * t));
}

/** Warna pada posisi t ∈ [0, 1] di sepanjang gradasi. */
export function padaRamp(stops: readonly string[], t: number): string {
  const u = Math.max(0, Math.min(1, t)) * (stops.length - 1);
  const i = Math.min(stops.length - 2, Math.floor(u));
  return campur(stops[i]!, stops[i + 1]!, u - i);
}

/** Luminans relatif WCAG. */
export function luminans(h: string): number {
  const lin = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  const [r, g, b] = rgb(h);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/** Warna teks yang terbaca di atas isian: putih atau tinta, mana yang kontrasnya lebih tinggi. */
export function teksDi(isian: string): string {
  const L = luminans(isian);
  const kontrasPutih = 1.05 / (L + 0.05);
  const kontrasTinta = (L + 0.05) / (luminans("#332c2b") + 0.05);
  return kontrasPutih >= kontrasTinta ? "#ffffff" : "#332c2b";
}

/** Gradasi CSS untuk legenda. */
export const gradien = (stops: readonly string[]): string => `linear-gradient(90deg, ${stops.join(", ")})`;

/**
 * Warna divergen untuk pertumbuhan: negatif ke merah, positif ke hijau,
 * nol putih. `batas` adalah nilai mutlak yang mencapai warna terpekat.
 */
export function divergen(v: number, batas: number): string {
  const t = Math.min(1, Math.abs(v) / batas);
  const kutub = v < 0 ? ["#ffffff", "#f4c3b0", "#e8806a", "#d82128", "#811c1d"] : ["#ffffff", "#d6e7d6", "#8fbc9d", "#3d7e5c", "#184531"];
  return padaRamp(kutub, t);
}
