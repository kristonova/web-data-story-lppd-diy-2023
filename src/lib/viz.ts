/**
 * Utilitas visualisasi interaktif — dipakai seluruh komponen grafik generasi kedua.
 *
 * Geometri tetap dihitung saat build, tanpa pustaka charting. JavaScript di
 * peramban hanya menambahkan lapisan interaksi (components/InteraksiGrafik.astro):
 * tooltip, sorotan grup, navigasi keyboard, dan filter kelompok wilayah.
 *
 * Tooltip memperkaya, tidak pernah menjadi satu-satunya jalan membaca angka:
 * setiap nilai di tooltip juga ada di tabel angka alternatif adegan yang sama.
 */
import { q } from "./chart";

// ── Kontrak atribut tooltip ─────────────────────────────────────────────────
export interface Tip {
  /** Nama entitas atau kategori. */
  judul: string;
  /** Nilai utama; tampil paling tebal karena pembaca sudah tahu entitasnya. */
  nilai: string;
  /** Baris keterangan tambahan. Nilai kosong atau false dilewati. */
  baris?: (string | false | null | undefined)[];
  /** Token warna untuk kunci garis di tooltip, misalnya `var(--kat-2)`. */
  warna?: string;
  /** Tanda dengan grup yang sama menyala bersamaan saat salah satunya disentuh. */
  grup?: string;
  /** Kelompok wilayah; dipakai filter kelompok. */
  kelompok?: string;
}

/** Pemisah baris di dalam atribut `data-s`. Tidak pernah muncul di label data. */
export const PEMISAH_BARIS = "|";

/**
 * Ubah Tip menjadi atribut `data-*`. Skrip interaksi memasukkannya ke DOM lewat
 * `textContent`, tidak pernah lewat `innerHTML`.
 */
export function tip(t: Tip): Record<string, string> {
  const a: Record<string, string> = { "data-t": t.judul, "data-v": t.nilai };
  const baris = (t.baris ?? []).filter((x): x is string => typeof x === "string" && x.length > 0);
  if (baris.length) a["data-s"] = baris.join(PEMISAH_BARIS);
  if (t.warna) a["data-c"] = t.warna;
  if (t.grup) a["data-g"] = t.grup;
  if (t.kelompok) a["data-k"] = t.kelompok;
  return a;
}

/** Atribut kontainer grafik interaktif: dapat difokus, dijelajah dengan panah. */
export function kontainer(label: string): Record<string, string> {
  return {
    "data-viz": "",
    tabindex: "0",
    role: "group",
    "aria-roledescription": "grafik interaktif",
    "aria-label": `${label}. Tekan tombol panah untuk menjelajah nilai; tabel angka tersedia di bawah grafik.`,
  };
}

// ── Warna ────────────────────────────────────────────────────────────────────
/** Palet kategori tanpa merah, lima slot, lolos validate_palette.mjs. */
export const kat = (slot: number): string => `var(--kat-${slot})`;
/** Warna teks yang aman di atas isian slot kategori. */
export const katTeks = (slot: number): string => `var(--kat-teks-${slot})`;

// ── Treemap ─────────────────────────────────────────────────────────────────
export interface Kotak<T> {
  x: number;
  y: number;
  w: number;
  h: number;
  data: T;
}

/**
 * Treemap squarified (Bruls, Huizing & van Wijk, 2000). Kotak diurutkan dari
 * nilai terbesar dan disusun per baris sepanjang sisi terpendek, sehingga rasio
 * sisi setiap kotak sedekat mungkin dengan persegi dan labelnya muat.
 */
export function squarify<T>(
  items: { nilai: number; data: T }[],
  x: number,
  y: number,
  w: number,
  h: number,
): Kotak<T>[] {
  const urut = items.filter((i) => i.nilai > 0).sort((a, b) => b.nilai - a.nilai);
  const total = urut.reduce((s, i) => s + i.nilai, 0);
  const out: Kotak<T>[] = [];
  if (total <= 0 || w <= 0 || h <= 0) return out;

  const skala = (w * h) / total;
  let antre = urut.map((i) => ({ a: i.nilai * skala, data: i.data }));
  type Sel = (typeof antre)[number];
  let [rx, ry, rw, rh] = [x, y, w, h];

  const terburuk = (baris: Sel[], sisi: number): number => {
    const s = baris.reduce((t, r) => t + r.a, 0);
    const maks = Math.max(...baris.map((r) => r.a));
    const min = Math.min(...baris.map((r) => r.a));
    return Math.max((sisi * sisi * maks) / (s * s), (s * s) / (sisi * sisi * min));
  };

  const letakkan = (baris: Sel[]): void => {
    const s = baris.reduce((t, r) => t + r.a, 0);
    if (rw >= rh) {
      const lebar = s / rh;
      let yy = ry;
      for (const r of baris) {
        const hh = r.a / lebar;
        out.push({ x: rx, y: yy, w: lebar, h: hh, data: r.data });
        yy += hh;
      }
      rx += lebar;
      rw -= lebar;
    } else {
      const tinggi = s / rw;
      let xx = rx;
      for (const r of baris) {
        const ww = r.a / tinggi;
        out.push({ x: xx, y: ry, w: ww, h: tinggi, data: r.data });
        xx += ww;
      }
      ry += tinggi;
      rh -= tinggi;
    }
  };

  let baris: Sel[] = [];
  while (antre.length) {
    const sisi = Math.min(rw, rh);
    const berikut = antre[0]!;
    if (baris.length === 0 || terburuk([...baris, berikut], sisi) <= terburuk(baris, sisi)) {
      baris.push(berikut);
      antre = antre.slice(1);
    } else {
      letakkan(baris);
      baris = [];
    }
  }
  if (baris.length) letakkan(baris);
  return out;
}

/**
 * Iris satu persegi panjang menjadi pita berurutan tanpa mengubah urutan.
 * Dipakai untuk kolom kelompok wilayah: urutan tetap berarti hanya kelompok yang
 * bersebelahan di urutan palet yang pernah bersentuhan, sehingga validasi
 * pasangan bersebelahan pada palet berlaku.
 */
export function iris<T>(
  items: { nilai: number; data: T }[],
  x: number,
  y: number,
  w: number,
  h: number,
  arah: "mendatar" | "menurun",
): Kotak<T>[] {
  const total = items.reduce((s, i) => s + Math.max(0, i.nilai), 0);
  if (total <= 0) return [];
  let pos = arah === "mendatar" ? x : y;
  return items.map((i) => {
    const bagian = Math.max(0, i.nilai) / total;
    const k =
      arah === "mendatar"
        ? { x: pos, y, w: w * bagian, h, data: i.data }
        : { x, y: pos, w, h: h * bagian, data: i.data };
    pos += arah === "mendatar" ? w * bagian : h * bagian;
    return k;
  });
}

// ── Satuan bulat ────────────────────────────────────────────────────────────
/**
 * Bagi `jumlahUnit` kotak (misalnya 100 kotak waffle) sebanding dengan nilai,
 * memakai metode sisa terbesar. Jumlah hasil selalu tepat `jumlahUnit`, dan
 * tidak ada kategori yang bergeser lebih dari satu kotak dari bagian persisnya.
 */
export function sisaTerbesar(nilai: number[], jumlahUnit = 100): number[] {
  const total = nilai.reduce((s, v) => s + Math.max(0, v), 0);
  if (total <= 0) return nilai.map(() => 0);
  const mentah = nilai.map((v) => (Math.max(0, v) / total) * jumlahUnit);
  const hasil = mentah.map((v) => Math.floor(v));
  let kurang = jumlahUnit - hasil.reduce((s, v) => s + v, 0);
  const urut = mentah
    .map((v, i) => ({ sisa: v - Math.floor(v), i }))
    .sort((a, b) => b.sisa - a.sisa);
  for (const { i } of urut) {
    if (kurang <= 0) break;
    hasil[i] = (hasil[i] ?? 0) + 1;
    kurang -= 1;
  }
  return hasil;
}

// ── Hemisiklus ──────────────────────────────────────────────────────────────
export interface Kursi {
  x: number;
  y: number;
  sudut: number;
}

/**
 * Tata letak kursi setengah lingkaran. Jumlah kursi per baris sebanding dengan
 * jari-jarinya, lalu seluruh kursi diurutkan dari kiri ke kanan sehingga setiap
 * kategori menempati satu sektor yang utuh.
 */
export function kursiHemisiklus(
  jumlah: number,
  baris: number,
  cx: number,
  cy: number,
  rDalam: number,
  rLuar: number,
): Kursi[] {
  const radii = Array.from({ length: baris }, (_, i) =>
    baris === 1 ? rLuar : rDalam + ((rLuar - rDalam) * i) / (baris - 1));
  const perBaris = sisaTerbesar(radii, jumlah);
  const out: Kursi[] = [];
  radii.forEach((r, i) => {
    const k = perBaris[i] ?? 0;
    for (let j = 0; j < k; j++) {
      const sudut = k === 1 ? Math.PI / 2 : Math.PI * (1 - j / (k - 1));
      out.push({ x: q(cx + r * Math.cos(sudut)), y: q(cy - r * Math.sin(sudut)), sudut });
    }
  });
  return out.sort((a, b) => b.sudut - a.sudut || a.y - b.y);
}

// ── Aneka ────────────────────────────────────────────────────────────────────
/** Median dari deret angka. */
export function median(v: number[]): number {
  const s = [...v].sort((a, b) => a - b);
  if (!s.length) return 0;
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
}

/** Persen dengan dua angka di belakang koma untuk gaya CSS (`left: 12.34%`). */
export const css = (v: number): string => `${q(v)}%`;
