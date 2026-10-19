/**
 * Naskah bahasa Indonesia untuk halaman.
 *
 * Aturan: berkas ini tidak memuat satu pun angka hasil pengukuran — baik
 * dalam bentuk angka maupun kata bilangan. Kalimat yang memuat angka disusun
 * di src/pages/index.astro dari src/lib/data.ts. Di sini hanya judul, label,
 * dan kalimat pengantar yang tidak bergantung pada angka.
 *
 * Suara: bahasa Indonesia yang tertata dan hangat, kalimat pendek dan tegas,
 * tanpa huruf kapital semua dan tanpa tanda seru (pedoman Jogja Istimewa).
 */

export const judul = "LPPD DIY 2023 dalam Angka";
export const deskripsi =
  "Web data story Laporan Penyelenggaraan Pemerintahan Daerah DIY Tahun 2023: peta wilayah dan penduduk, arus keuangan daerah, kesejahteraan antarwilayah, ekonomi dan investasi, keistimewaan, dan layanan dasar. Setiap angka menunjuk halaman dan tabel sumbernya.";

export const sampul = {
  label: "Laporan Penyelenggaraan Pemerintahan Daerah",
  judul: "Daerah Istimewa Yogyakarta dalam Angka",
  sub: "Satu tahun penyelenggaraan pemerintahan, dibaca lewat data",
  meta: "Tahun Anggaran 2023 · Disarikan dari LPPD DIY 2023",
};

export const ringkasan = {
  label: "Ringkasan",
  judul: "Arah pembangunan DIY sepanjang 2023",
  catatan:
    "Setiap angka di halaman ini berasal dari laporan resmi dan menunjuk halaman serta tabel sumbernya. Setiap grafik disertai tabel angka yang dapat dibuka, dan seluruh data agregatnya dapat diunduh sebagai CSV di bagian penutup.",
  isiJudul: "Isi laporan",
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
    judul: "Wilayah dan Penduduk",
    nav: "Wilayah",
    sub: "Ruang yang dikelola dan warga yang dilayani",
    ikon: "ikon-merapi",
    ikonNama: "Merapi",
  },
  {
    id: "bab-2",
    judul: "Keuangan Daerah",
    nav: "Keuangan",
    sub: "Anggaran pendapatan dan belanja daerah",
    ikon: "ikon-tugu",
    ikonNama: "Tugu",
  },
  {
    id: "bab-3",
    judul: "Kesejahteraan Masyarakat",
    nav: "Kesejahteraan",
    sub: "Pembangunan manusia, kemiskinan, pasar kerja, dan jarak antarwilayah",
    ikon: "ikon-beringin-kembar",
    ikonNama: "Beringin Kembar",
  },
  {
    id: "bab-4",
    judul: "Ekonomi dan Investasi",
    nav: "Ekonomi",
    sub: "Pertumbuhan wilayah, lapangan usaha, penanaman modal, dan akomodasi wisata",
    ikon: "ikon-becak",
    ikonNama: "Becak",
  },
  {
    id: "bab-5",
    judul: "Urusan Keistimewaan",
    nav: "Keistimewaan",
    sub: "Warisan budaya, Dana Keistimewaan, dan bantuan keuangan khusus kalurahan",
    ikon: "ikon-keraton",
    ikonNama: "Keraton",
  },
  {
    id: "bab-6",
    judul: "Layanan Dasar",
    nav: "Layanan",
    sub: "Pendidikan, infrastruktur, air minum, sanitasi, dan standar pelayanan minimal",
    ikon: "ikon-lampu-antik",
    ikonNama: "Lampu Antik",
  },
];

export const penutup = {
  label: "Penutup",
  judul: "Catatan data dan unduhan",
  lead:
    "Tidak semua angka dalam laporan dapat dibaca utuh. Sebagian sel rusak akibat pembacaan mesin, dan beberapa pembulatan tidak konsisten antartabel. Catatan itu tidak disembunyikan: semuanya direkam pipeline dan ditampilkan di sini, diikuti berkas unduhan agregat.",
  kolofonData:
    "Semua angka berasal dari Laporan Penyelenggaraan Pemerintahan Daerah Daerah Istimewa Yogyakarta Tahun 2023. Berkas unduhan adalah tabel yang sudah melewati pemeriksaan aritmetika otomatis sebelum ditulis. Batas wilayah pada peta berasal dari portal GIS Dukcapil Kemendagri dan bersifat indikatif.",
  kolofonDesain:
    "Identitas visual mengikuti pedoman Jogja Istimewa; hak cipta logo dan identitas visual ada pada Pemerintah Daerah Istimewa Yogyakarta. Huruf Source Sans 3 (SIL Open Font License) untuk naskah dan Jogjakartype (© Locomotype, lisensi gratis non-komersial) untuk judul.",
};

export const akhir = {
  kata: "Matur Nuwun",
  sub: "Terima kasih telah membaca potret penyelenggaraan pemerintahan DIY",
  atas: "Kembali ke awal",
};
