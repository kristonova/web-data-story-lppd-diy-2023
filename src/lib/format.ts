/**
 * Pemformatan angka dan teks dalam kaidah Indonesia.
 *
 * Pemisah ribuan titik, pemisah desimal koma — sama seperti seluruh kolateral
 * SADASA Academy Design System (`193.864.728`).
 */

const ID = new Intl.NumberFormat("id-ID");

/** 12614 → "12.614". Nilai yang disamarkan ditulis sebagai tanda pisah. */
export function n(v: number | null | undefined, jikaKosong = "–"): string {
  if (v === null || v === undefined || Number.isNaN(v)) return jikaKosong;
  return ID.format(Math.round(v));
}

/** 36.8 → "36,8". `digit` mengunci jumlah angka di belakang koma. */
export function d(v: number | null | undefined, digit = 1, jikaKosong = "–"): string {
  if (v === null || v === undefined || Number.isNaN(v)) return jikaKosong;
  return new Intl.NumberFormat("id-ID", {
    minimumFractionDigits: digit,
    maximumFractionDigits: digit,
  }).format(v);
}

/** 10.7 → "10,7%". */
export function p(v: number | null | undefined, digit = 1, jikaKosong = "–"): string {
  if (v === null || v === undefined || Number.isNaN(v)) return jikaKosong;
  return `${d(v, digit)}%`;
}

/** "12.614 jiwa (100%)" untuk keterangan di bawah grafik. */
export function nPct(
  v: number | null | undefined,
  pctValue: number | null | undefined,
  satuan = "jiwa",
): string {
  if (v === null || v === undefined) return "–";
  const dasar = `${n(v)} ${satuan}`;
  return pctValue === null || pctValue === undefined ? dasar : `${dasar} (${p(pctValue)})`;
}

/** Rasio 1 : 9,9 untuk kartu pelayanan. */
export function rasio(v: number, digit = 1): string {
  return `1 : ${d(v, digit)}`;
}

/** "1 Februari 2019" dari "2019-02-01". */
export function tanggal(iso: string): string {
  const [y, m, day] = iso.split("-").map(Number);
  const bulan = [
    "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember",
  ];
  return `${day} ${bulan[(m ?? 1) - 1]} ${y}`;
}

/** Id ramah tautan dari nomor adegan: "2.1" → "adegan-2-1". */
export function anchor(id: string): string {
  return `adegan-${id.replace(/\./g, "-")}`;
}

/** Nilai sel tabel angka alternatif; sel yang tidak tersedia ditulis "–". */
export function sel(v: number | null): string {
  if (v !== null) return n(v);
  return "–";
}

// ── Rupiah ringkas ──────────────────────────────────────────────────────────
/**
 * Rupiah dalam satuan yang terbaca: triliun, miliar, atau juta.
 * 5840561001091 → "Rp5,84 triliun". Angka penuh tetap ada di tabel angka.
 */
export function rp(v: number, digit = 2): string {
  const a = Math.abs(v);
  const tanda = v < 0 ? "−" : "";
  if (a >= 1e12) return `${tanda}Rp${d(a / 1e12, digit)} triliun`;
  if (a >= 1e9) return `${tanda}Rp${d(a / 1e9, digit)} miliar`;
  if (a >= 1e6) return `${tanda}Rp${d(a / 1e6, digit)} juta`;
  return `${tanda}Rp${n(a)}`;
}

/** Versi pendek untuk label grafik: "Rp5,84 T", "Rp24,50 M", "Rp63 jt". */
export function rpS(v: number, digit = 2): string {
  const a = Math.abs(v);
  const tanda = v < 0 ? "−" : "";
  if (a >= 1e12) return `${tanda}Rp${d(a / 1e12, digit)} T`;
  if (a >= 1e9) return `${tanda}Rp${d(a / 1e9, digit)} M`;
  if (a >= 1e6) return `${tanda}Rp${d(a / 1e6, 0)} jt`;
  return `${tanda}Rp${n(a)}`;
}

/** Tanda selisih yang selalu bertanda: +0,45 · −0,37 · 0,00. */
export function sel2(v: number, digit = 2): string {
  if (Math.abs(v) < 0.5 * 10 ** -digit) return d(0, digit);
  return `${v > 0 ? "+" : "−"}${d(Math.abs(v), digit)}`;
}

/** Bilangan kecil sebagai kata, sesuai kaidah penulisan angka di kalimat. */
export function kata(v: number): string {
  const daftar = ["nol", "satu", "dua", "tiga", "empat", "lima", "enam", "tujuh", "delapan", "sembilan", "sepuluh", "sebelas"];
  return Number.isInteger(v) && v >= 0 && v < daftar.length ? daftar[v]! : n(v);
}

/** "KAB. KULON PROGO" → "Kulon Progo"; "KOTA YOGYAKARTA" → "Kota Yogyakarta". */
export function namaKab(s: string): string {
  const t = s
    .replace(/^KAB(UPATEN)?\.?\s*/i, "")
    .replace(/^Kabupaten\s+/i, "")
    .trim()
    .toLowerCase()
    .replace(/\b\p{L}/gu, (c) => c.toUpperCase());
  return t;
}

/** Huruf kalimat untuk label berhuruf kapital semua, akronim dipertahankan. */
export function kalimat(s: string, akronim: string[] = []): string {
  const tetap = new Set(akronim.map((a) => a.toUpperCase()));
  const kecil = s.toLowerCase().replace(/\s+/g, " ").trim();
  return kecil
    .split(" ")
    .map((w, i) => {
      const bersih = w.replace(/[^\p{L}\d]/gu, "").toUpperCase();
      if (tetap.has(bersih)) return w.toUpperCase();
      return i === 0 ? w.charAt(0).toUpperCase() + w.slice(1) : w;
    })
    .join(" ");
}
