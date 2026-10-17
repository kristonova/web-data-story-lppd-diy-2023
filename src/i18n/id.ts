/**
 * Naskah bahasa Indonesia untuk halaman.
 *
 * Aturan penting: berkas ini tidak memuat satu pun angka hasil pengukuran —
 * baik dalam bentuk angka maupun kata baku untuk angka ukur. Seluruh angka di
 * layar disusun oleh src/pages/index.astro dari src/lib/data.ts yang membaca
 * JSON turunan pipeline; kalimat yang memuat angka juga disusun di sana dengan
 * templat. Di sini hanya label, judul pilar, leads pilar, teks kartu, dan
 * keterangan tabel.
 */

export const judul = "LPPD DIY 2023 dalam Angka";
export const deskripsi =
  "Web data story Laporan Penyelenggaraan Pemerintahan Daerah DIY 2023: APBD, capaian makro, indikator kinerja kunci, keistimewaan, dan SPM — setiap angka menunjuk halaman dan tabel sumbernya.";

export const pembuka = {
  eyebrow: "Potret satu tahun penyelenggaraan",
  judul: "Laporan Penyelenggaraan Pemerintahan Daerah DIY 2023",
  lead:
    "Laporan ini memotret bagaimana Daerah Istimewa Yogyakarta menyelenggarakan pemerintahan pada tahun anggaran 2023: dari wilayah dan penduduknya, uang daerahnya, kesejahteraan penduduknya, indikator kinerja kuncinya, sampai penyelenggaraan keistimewaan dan standar pelayanan minimum.",
  note:
    "Seluruh angka di halaman ini berasal dari laporan resmi; setiap adegan menunjuk halaman dan tabel sumbernya. Setiap grafik punya tabel angka alternatif yang terbuka tanpa gawai pintar, dan seluruh data unduhannya berformat CSV.",
};

export const pilar = [
  {
    id: "pilar-1",
    judul: "Data dasar wilayah dan penduduk",
    bidang: ["Wilayah administrasi", "Penduduk", "Demografi"],
    lead:
      "Sebelum bicara kinerja, berdiri di atas tanah DIY: wilayahnya terbagi atas kabupaten dan kota, kapanewon dan kemantren, serta penduduk yang tidak merata — yang paling luas bukan yang paling padat.",
  },
  {
    id: "pilar-2",
    judul: "Uang daerah: APBD 2023",
    bidang: ["Pendapatan", "Belanja", "Kelompok urusan"],
    lead:
      "Pendapatan daerah nyaris semua cair, sedangkan belanja tertinggal sedikit di belakangnya. Perbandingan PAD terhadap transfer dari pusat memperlihatkan ketergantungan daerah yang nyata.",
  },
  {
    id: "pilar-3",
    judul: "Kesejahteraan: capaian makro",
    bidang: ["IPM", "Kemiskinan", "Ketenagakerjaan", "Ketimpangan"],
    lead:
      "Indeks pembangunan manusia naik sekali lagi dan angka kemiskinan turun; pasangannya datang dari pasar kerja yang memeras pencarian kerja turun juga. Ketimpangan pendapatan bergerak sangat tipis antara dua periode perbandingan.",
  },
  {
    id: "pilar-4",
    judul: "Indikator kinerja kunci dan investasi",
    bidang: ["Pendidikan", "Kesehatan", "PU dan penataan ruang", "Penanaman modal"],
    lead:
      "Sebagian indikator kinerja kunci menembak target, termasuk yang tingginya melewati batas target karena penyebutnya mencakup murid luar daerah yang bersekolah di DIY. Jalan dan drainase menyisakan kerja yang terlihat jelas, dan penanaman modal mengikuti peta yang tidak merata antarkabupaten.",
  },
  {
    id: "pilar-5",
    judul: "Keistimewaan DIY dan bantuan kalurahan BKK",
    bidang: ["Paniradya Kaistimewan", "Bantuan Keuangan Khusus"],
    lead:
      "Penyelenggaraan keistimewaan dibaca dari capaian fisik dan keuangan per urusan, serta skor kepuasan atas penyebaran informasi keistimewaan. Bantuan keuangan khusus kalurahan dilaporkan baris demi baris, lengkap dengan penanda fisik dan keuangannya.",
  },
  {
    id: "pilar-6",
    judul: "Standar Pelayanan Minimum",
    bidang: ["Pendidikan", "Kesehatan", "PU", "Perumahan", "Ketenteraman", "Sosial"],
    lead:
      "Sebagian besar bidang berada di tingkat tuntas; bidang pendidikan menyimpan catatan yang perlu berjaga — sebagian sel indikator per jenjang tidak dapat diverifikasi pembacaannya.",
  },
];

export const penutup = {
  judul: "Penutup: celah data dan unduhan",
  lead:
    "Tidak semua angka LPPD dapat dibaca utuh: sebagian sel rusak akibat pembacaan mesin, dan tidak sedikit pembulatan yang tidak konsisten antartabel. Berikut catatan celah yang direkam pipeline ketika asersinya dijalankan, diikuti berkas unduhan agregat berformat CSV.",
  kolofonLead:
    "Semua angka berasal dari Laporan Penyelenggaraan Pemerintahan Daerah Daerah Istimewa Yogyakarta Tahun 2023. Penunjuk sumber melekat pada setiap adegan; berkas unduhannya adalah tabel-tabel yang sudah melewati pemeriksaan aritmetika otomatis sebelum ditulis.",
};

/** Keterangan kartu celah (DataGapCard) di penutup. */
export const celahKartu = {
  pangan: "Sel rincian pangan rusak sehingga dihapus dari analisis urusan.",
  spm: "Sebagian baris indikator SMA dilepas sel-sel akibat pembacaan tak konsisten.",
};

export const tabelAlt = {
  indikator: "Indikator",
  nilai2022: "2022",
  nilai2023: "2023",
  perubahan: "Perubahan",
};

/** Framing kecil yang sering muncul. */
export const kata = {
  realisasi: "realisasi",
  anggaran: "anggaran",
  keuangan: "keuangan",
  fisik: "fisik",
  persen: "persen",
} as const;
