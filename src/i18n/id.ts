/**
 * Naskah bahasa Indonesia untuk halaman.
 *
 * Aturan: berkas ini tidak memuat satu pun angka hasil pengukuran — baik
 * dalam bentuk angka maupun kata bilangan. Kalimat yang memuat angka disusun
 * di src/pages/index.astro dari src/lib/data.ts. Di sini hanya judul, label,
 * dan kalimat pengantar yang tidak bergantung pada angka.
 *
 * Suara: bahasa Indonesia yang tertata, alami, dan mengalir, dengan kalimat
 * efektif dan padat makna sesuai kaidah tata bahasa Indonesia yang baik.
 */

export const judul = "LPPD DIY 2023 dalam Angka";
export const deskripsi =
  "Web data story Laporan Penyelenggaraan Pemerintahan Daerah (LPPD) DIY Tahun 2023: menyajikan data spasial kependudukan, postur APBD, capaian kesejahteraan, dinamika ekonomi & investasi, urusan keistimewaan, dan pemenuhan layanan dasar. Seluruh data merujuk pada tabel resmi.";

export const sampul = {
  label: "Laporan Penyelenggaraan Pemerintahan Daerah",
  judul: "Daerah Istimewa Yogyakarta dalam Angka",
  sub: "Potret satu tahun kinerja pembangunan dan penyelenggaraan pemerintahan daerah",
  meta: "Tahun Anggaran 2023 · Disarikan dari Dokumen Resmi LPPD DIY 2023",
};

export const ringkasan = {
  label: "Ringkasan Eksekutif",
  judul: "Capaian Indikator Kinerja Makro DIY 2023",
  catatan:
    "Seluruh data disarikan langsung dari dokumen resmi LPPD DIY 2023 dengan rujukan halaman dan nomor tabel yang jelas. Setiap grafik dilengkapi tabel data alternatif, dan seluruh dataset agregat dapat diunduh pada bagian akhir halaman.",
  isiJudul: "Daftar Isi Pembahasan",
};

export interface BabTeks {
  id: string;
  judul: string;
  nav: string;
  sub: string;
  ikon: string;
  ikonNama: string;
}

export const bab: BabTeks[] = [
  {
    id: "bab-1",
    judul: "Kependudukan & Wilayah",
    nav: "Wilayah",
    sub: "Karakteristik geografis, persebaran warga, dan dinamika struktur demografi",
    ikon: "ikon-merapi",
    ikonNama: "Merapi",
  },
  {
    id: "bab-2",
    judul: "Pengelolaan Keuangan Daerah",
    nav: "Keuangan",
    sub: "Kinerja realisasi pendapatan, alokasi pos belanja, dan serapan APBD",
    ikon: "ikon-tugu",
    ikonNama: "Tugu",
  },
  {
    id: "bab-3",
    judul: "Kesejahteraan Masyarakat",
    nav: "Kesejahteraan",
    sub: "Indeks pembangunan manusia, pengentasan kemiskinan, ketenagakerjaan, dan disparitas wilayah",
    ikon: "ikon-beringin-kembar",
    ikonNama: "Beringin Kembar",
  },
  {
    id: "bab-4",
    judul: "Perekonomian & Investasi",
    nav: "Ekonomi",
    sub: "Pertumbuhan ekonomi, sektor usaha andalan, realisasi penanaman modal, dan akomodasi wisata",
    ikon: "ikon-becak",
    ikonNama: "Becak",
  },
  {
    id: "bab-5",
    judul: "Urusan Keistimewaan",
    nav: "Keistimewaan",
    sub: "Pelestarian warisan budaya, akuntabilitas Dana Keistimewaan, dan BKK Kalurahan",
    ikon: "ikon-keraton",
    ikonNama: "Keraton",
  },
  {
    id: "bab-6",
    judul: "Layanan Publik Dasar",
    nav: "Layanan",
    sub: "Pendidikan, infrastruktur jalan, akses air bersih, sanitasi, dan capaian SPM",
    ikon: "ikon-lampu-antik",
    ikonNama: "Lampu Antik",
  },
];

export const penutup = {
  label: "Penutup",
  judul: "Transparansi Data & Akses Unduhan",
  lead:
    "Sebagai wujud integritas dan transparansi publik, seluruh catatan teknis dan anomali pada dokumen sumber asli—seperti keterbatasan pemindaian OCR dokumen, variasi pembulatan angka antar-tabel, maupun ralat resmi—didokumentasikan secara terbuka tanpa manipulasi. Anda juga dapat mengunduh seluruh berkas dataset agregat di bawah ini.",
  kolofonData:
    "Seluruh data bersumber resmi dari dokumen Laporan Penyelenggaraan Pemerintahan Daerah (LPPD) Daerah Istimewa Yogyakarta Tahun 2023. Berkas unduhan telah melalui proses verifikasi dan validasi silang data secara otomatis. Batas wilayah administrasi pada peta disajikan sebagai visualisasi indikatif bersumber dari portal GIS Dukcapil Kemendagri.",
  kolofonDesain:
    "Tata letak visual dan ornamen dirancang mengikuti Panduan Identitas Visual Jogja Istimewa Pemerintah Daerah DIY. Tipografi menggunakan fon Jogjakartype (© Locomotype) untuk judul dan Source Sans 3 (SIL Open Font License) untuk keterbacaan teks naskah.",
};

export const akhir = {
  kata: "Matur Nuwun",
  sub: "Terima kasih telah menyimak data story penyelenggaraan pemerintahan DIY 2023",
  atas: "Kembali ke Awal",
};
