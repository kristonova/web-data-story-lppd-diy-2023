/**
 * Lapisan data — satu-satunya jalan masuk JSON turunan ke halaman.
 *
 * Seluruh angka di layar, termasuk angka yang berada di dalam kalimat naskah,
 * berasal dari berkas-berkas ini. Tidak ada angka yang diketik manual di dalam
 * komponen atau di dalam src/i18n/id.ts. Setiap JSON turunan mengandung
 * penunjuk sumbernya sendiri (halaman dan tabel LPPD DIY 2023).
 */
import manifesRaw from "../data/derived/manifes.json";
import pembukaRaw from "../data/derived/pembuka.json";
import pilar1Raw from "../data/derived/pilar1.json";
import pilar2Raw from "../data/derived/pilar2.json";
import pilar2uRaw from "../data/derived/pilar2-urusan.json";
import pilar3Raw from "../data/derived/pilar3.json";
import pilar4Raw from "../data/derived/pilar4.json";
import pilar5Raw from "../data/derived/pilar5.json";
import pilar6Raw from "../data/derived/pilar6.json";

// ── Bentuk data ─────────────────────────────────────────────────────────────

/** Baris satu sumber: potret ke LPPD. */
export interface Sumber {
  berkas: string;
  halaman: string | number;
  tabel: string | number;
}

/** Baris nilai bentuk umum untuk grafik satu seri. */
export interface Row {
  label: string;
  n: number | null;
  /** Persentase bila tersedia (mis. realisasi keuangan); null = tak dinyatakan. */
  pct?: number | null;
}

/** Satu indikator macro pembuka. */
export interface MakroIndikator {
  nama: string;
  nilai2022: number;
  nilai2023: number;
  perubahan: number;
  satuan: string;
  jenis: "ipm" | "kemiskinan" | "pengangguran" | "pertumbuhan" | "perkapita" | "gini";
}

export interface SelKab {
  nama: string;
  kapanewonKemantren: number;
  kalurahan: number | null;
  kelurahan: number | null;
}

export interface LuasKab {
  nama: string;
  km2: number;
  persen: number;
}

export interface PendudukKab {
  kode: string;
  nama: string;
  laki: number;
  perempuan: number;
  jumlah: number;
  lakiPersen: number;
  perempuanPersen: number;
  jumlahPersen: number;
}

export interface UsiaGroup {
  label: string;
  jumlah: number;
  persen: number;
  perKab: number[];
}

export interface AngkaRp {
  anggaran: number;
  realisasi: number;
  persen: number;
  realisasi2022: number;
}

export interface UrusanKelompok {
  id: string;
  nama: string;
  anggaran: number;
  realisasi: number;
  perubahan: number;
  persen: number;
}

export interface IpmsKomponen {
  nama: string;
  satuan: string;
  nilai: { t2020: number; t2021: number; t2022: number; t2023: number };
}

export interface KemiskinanBaris {
  daerah: "Perkotaan" | "Perdesaan" | "Total";
  periode: string;
  ribu: number;
  persen: number;
}

export interface Ketimkabar {
  daerah: "Perkotaan" | "Perdesaan" | "Total";
  periode: string;
  p40Bawah: number;
  p40Tengah: number;
  p20Atas: number;
}

export interface InvestasiTahun {
  periode: string;
  /** Rp triliun (tabel sumber dalam Rp000). */
  pmdnTriliun: number;
  pmaTriliun: number;
  totalTriliun: number;
  tambahanTriliun: number;
  pctStated: number;
}

export interface InvestasiPerKab {
  kabkota: string;
  t2019: number;
  t2020: number;
  t2021: number;
  t2022: number;
  t2023: number;
}

export interface NilaiAkhirBaris {
  nama: string;
  nilai: number;
  bobot: number;
  hasil: number;
}

export interface KeistimewaanUrusan {
  nama: string;
  anggaran: number;
  realisasi: number;
  keuangan: number;
  fisik: number;
}

export interface BkkBaris {
  no: number;
  jenis: string;
  pagu: number;
  realisasi: number | null;
  keuangan: number | null;
  fisik: number | null;
}

export interface PendidikanIndikator {
  jenjang: string;
  label: string;
  satuan: string;
  pct: number;
  target: number;
  capaian: number;
}

export interface ManifesUnduhan {
  berkas: string;
  tentang: string;
  sumber: string;
}

// ── Berkas turunan ──────────────────────────────────────────────────────────

export const manifes = manifesRaw as {
  dibuat: string;
  catatanCelah: string[];
  unduhan: ManifesUnduhan[];
  tabelStats: { berkas: string; tabel: number; tabelBerangka: number }[];
};

export const pembuka = pembukaRaw as {
  sumber: Sumber[];
  indikator: MakroIndikator[];
};

export const pilar1 = pilar1Raw as {
  sumber: Sumber[];
  administrasi: { perKab: SelKab[]; kapanewon: number; kalurahan: number; kelurahan: number };
  luas: { perKab: LuasKab[]; total: number; persenIndonesia: number };
  penduduk: {
    total: number;
    laki: number;
    perempuan: number;
    lakiPersen: number;
    perempuanPersen: number;
    perKab: PendudukKab[];
  };
  usia: { perKelompok: UsiaGroup[]; ikhtisar: { nama: string; jumlah: number; persen: number }[] };
};

export const pilar2 = pilar2Raw as {
  sumber: Sumber[];
  pendapatan: {
    total: AngkaRp;
    pad: AngkaRp;
    pajak: AngkaRp;
    retribusi: AngkaRp;
    kekayaan: AngkaRp;
    lainPad: AngkaRp;
    transfer: AngkaRp;
    transferPusat: AngkaRp;
    transferAntar: AngkaRp;
    lainSah: AngkaRp;
    hibah: AngkaRp;
    sharePad: number;
  };
  belanja: {
    total: AngkaRp;
    operasi: AngkaRp;
    pegawai: AngkaRp;
    barangJasa: AngkaRp;
    subsidi: AngkaRp;
    hibah: AngkaRp;
    bansos: AngkaRp;
    modal: AngkaRp;
    modalTanah: AngkaRp;
    modalMesin: AngkaRp;
    modalGeuting: AngkaRp;
    modalJalan: AngkaRp;
    modalAsetTetap: AngkaRp;
    modalAsetLain: AngkaRp;
    takTerduga: AngkaRp;
    transfer: AngkaRp;
    bagiHasil: AngkaRp;
    bantuanKeuangan: AngkaRp;
    surplus: AngkaRp;
    pembiayaanNetto: AngkaRp;
    slpa: AngkaRp;
  };
};

export const pilar2u = pilar2uRaw as {
  sumber: Sumber[];
  kelompok: UrusanKelompok[];
  dasar: UrusanKelompok[];
  jumlah: { anggaran: number; realisasi: number; persen: number };
};

export const pilar3 = pilar3Raw as {
  sumber: Sumber[];
  ipm: { komponen: IpmsKomponen[]; nilai2022: number; nilai2023: number };
  kemiskinan: { nilai2022: number; nilai2023: number; perDaerah: KemiskinanBaris[] };
  ketenagakerjaan: { baris: { label: string; t2022: number; t2023: number }[]; tpt: { t2022: number; t2023: number } };
  ketimpangan: { gini2022: number; gini2023: number; perDaerah: Ketimkabar[] };
};

export const pilar4 = pilar4Raw as {
  sumber: Sumber[];
  ikkPendidikan: {
    apm: { rasio: number; sma: number; smk: number; ma: number; tamat: number; penduduk: number };
    apk: { rasio: number; sma: number; smk: number; ma: number; tambahanTanggungan: number };
    abk: { slb: number; inklusi: number; tidakDiri: number; terlayani: number; total: number; persen: number };
  };
  ikkKesehatan: { tempatTidurRsRujukan: number; penduduk: number; rasioPerRibu: number };
  ikkPU: {
    jalan: { mantapKm: number; totalKm: number; persen: number; satuan: string };
    spal: { dilayani: number; total: number; persen: number };
    airMinum: { nilai: number; satuan: string; persen: number };
  };
  investasi: {
    seri: InvestasiTahun[];
    pertumbuhan: { s2022: number; s2023: number };
    perKab: InvestasiPerKab[];
  };
};

export const pilar5 = pilar5Raw as {
  sumber: Sumber[];
  nilaiAkhir: { baris: NilaiAkhirBaris[]; total: number; rerataCapaian: number };
  urusan: { baris: KeistimewaanUrusan[]; total: KeistimewaanUrusan };
  bkk: { baris: BkkBaris[]; jumlah: { pagu: number; realisasi: number } };
};

export const pilar6 = pilar6Raw as {
  sumber: Sumber[];
  kategori: { bidang: string; kategori: "UTAMA" | "PARIPURNA"; indeks: number }[];
  pendidikanIndikator: PendidikanIndikator[];
  pendidikanKhusus: {
    harusDilayani: number;
    terlayani: number;
    belumTerlayani: number;
    persen: number;
    indeksKhusus: number;
    indeksPenerimaLD: number;
  };
};

// ── Helper kecil ────────────────────────────────────────────────────────────

/** Penunjuk sumber gabungan → "LPPD DIY 2023, halaman 29, tabel ke-1".
 *  Sumber bertipus teks memakai tabel bertipus string, mis. "blok rasio
 *  partisipasi sekolah" atau "naskah" — ditulis apa adanya tanpa kata "tabel". */
export function prov(s: Sumber): string {
  const tab = typeof s.tabel === "string" ? s.tabel : `tabel ke-${s.tabel}`;
  return `LPPD DIY 2023, halaman ${s.halaman}, ${tab}`;
}

/** Bentuk Row universal dari daftar {label, n, pct}. */
export function baris(rows: { label: string; n: number | null; pct?: number | null }[]): Row[] {
  return rows;
}
