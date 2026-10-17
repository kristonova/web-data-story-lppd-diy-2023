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
