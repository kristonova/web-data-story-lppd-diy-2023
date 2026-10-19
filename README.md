# LPPD DIY dalam Angka

Web data story interaktif satu halaman yang menyajikan dan membedah **Laporan Penyelenggaraan Pemerintahan Daerah (LPPD) Daerah Istimewa Yogyakarta Tahun 2023**.

Situs ini dibangun menggunakan Astro dan menghasilkan situs statis murni (*zero-dependency runtime*). Seluruh aset di-host secara lokal tanpa memanggil layanan eksternal, sehingga situs dapat diakses lancar tanpa koneksi internet—bahkan dapat disalin ke flashdisk dan langsung dibuka melalui peramban web.

---

## Prinsip dan Keakuratan Data

Rujukan tunggal proyek ini adalah dokumen resmi LPPD DIY 2023. Setiap data yang ditampilkan selalu mencantumkan referensi **halaman dan nomor tabel** aslinya di laporan resmi.

- **Tanpa input manual di narasi:** Tidak ada angka statistik capaian yang diketik manual di dalam teks narasi. Semua data dipasok terpusat melalui `src/lib/data.ts` berbasis berkas JSON turunan. Narasi disusun menggunakan templat dinamis; jika data sumber diperbarui, teks dan grafik otomatis ikut terbarui.
- **Validasi silang otomatis:** Sebelum halaman dibangun, pipeline data menjalankan uji rekonsiliasi dan asersi aritmetika otomatis (memastikan rincian data per baris klop dengan total agregatnya).
- **Transparansi anomali:** Jika ditemukan ketidaksesuaian pada dokumen asli (seperti sel buram hasil pemindaian OCR, selisih pembulatan antartabel, atau perbedaan data antarbab), pipeline mencatatnya secara transparan sebagai **catatan anomali data** pada adegan penutup serta di `src/data/derived/manifes.json`—data tidak dimanipulasi atau ditebak-tebak.

---

## Alur Kerja dan Struktur Direktori

```text
bahan-mentah/              ← Dokumen PDF LPPD asli dan berkas teks bantu (diabaikan git)
scripts/ekstraksi/         ← Skrip Python untuk konversi awal dari PDF ke Markdown
markdown-per-bab/          ← Hasil ekstraksi teks lengkap laporan per bab
data-story/source/         ← Hasil ekstraksi tabel terstruktur per urusan pemerintahan
data-story/geo/            ← Berkas batas wilayah GeoJSON (kapanewon & kabupaten/kota)
scripts/build_data.mjs     ← Pipeline pengolah tabel & validasi silang → JSON, CSV, manifes
scripts/build_geo.mjs      ← Generator jalur SVG peta dari GeoJSON + validasi koordinat
src/data/derived/*.json    ← 11 berkas JSON terstruktur hasil olahan pipeline
public/data/               ← 24 berkas CSV agregat dan 2 GeoJSON yang dapat diunduh publik
src/pages/index.astro      ← Halaman utama data story (memuat sampul, narasi, dan 29 adegan)
src/components/charts/     ← 20 komponen visualisasi data (murni SVG/HTML, tanpa library charting)
public/brand/              ← Aset identitas visual Jogja Istimewa (logo, ikon, latar)
scripts/check_build.mjs    ← Pengujian akhir otomatis untuk memverifikasi kualitas folder dist/
docs/catatan-teknis.md     ← Dokumentasi arsitektur dan keputusan teknis proyek
.github/workflows/         ← Otomasi build dan publikasi ke GitHub Pages
```

---

## Desain dan Visualisasi Data

Halaman ini menerapkan panduan sistem desain resmi **Jogja Istimewa**:
- **Warna:** Dominasi warna merah resmi khas Yogyakarta (`#d82128`) dan putih, aksen emas (`#dab96b`) untuk elemen ornamen, serta palet warna turunan untuk membedakan wilayah kabupaten/kota.
- **Tipografi:** Menggunakan fon resmi **Jogjakartype** untuk judul bab dan adegan, serta **Source Sans 3** untuk isi teks dan angka. Keduanya dimuat langsung secara lokal.
- **Visualisasi data mandiri:** Seluruh visualisasi dibuat murni menggunakan elemen HTML dan SVG standar tanpa library grafik eksternal (seperti Chart.js atau D3), sehingga proses render instan dan bobot halaman sangat ringan.
- **Ragam grafik:** Menampilkan peta tematik wilayah (kesejahteraan, investasi, sebaran hotel, kawasan Sumbu Filosofi), diagram alir APBD, piramida penduduk, koordinat paralel komponen IPM, grafik lintasan tren kemiskinan, matriks peta panas (*heatmap*) sektor usaha, hingga *waffle chart* akses air bersih.
- **Aksesibilitas dan performa:** Setiap grafik dilengkapi tabel angka alternatif yang dapat dibuka tanpa JavaScript (`<details>`), mendukung navigasi keyboard, serta menghormati preferensi pengguna (*reduced motion*).

---

## Panduan Perintah

Jalankan perintah berikut di terminal:

```bash
# Memproses data mentah menjadi JSON/CSV serta memproyeksikan peta
npm run data

# Memvalidasi skema dan nilai kunci data keluaran pipeline
npm run validate:data

# Menjalankan server pengembangan lokal
npm run dev

# Memeriksa tipe data, membangun situs statis, dan membuat service worker
npm run build

# Menjalankan pengujian kualitas terhadap hasil build di folder dist/
npm run check:build

# Menjalankan seluruh rantai pengujian dari awal hingga akhir (wajib lolos sebelum rilis)
npm run verify
```

> **Catatan Ekstraksi PDF:**  
> Jika perlu mengekstrak ulang dokumen PDF asli (memerlukan Python dan paket `pdfplumber`):
> ```bash
> python scripts/ekstraksi/convert_pdf_to_bab_markdown.py   # Menghasilkan markdown-per-bab/
> python scripts/ekstraksi/extract_tables.py                # Menghasilkan data-story/source/
> ```

---

## Standar Kualitas Rilis (`check:build`)

Perintah `npm run check:build` memeriksa 17 kriteria kelayakan pada folder `dist/` sebelum situs dinyatakan siap rilis:
- Seluruh aset (fon, gambar, logo) tersimpan lokal tanpa dependensi domain eksternal.
- Ukuran total halaman utuh berada di bawah 4 MB dengan semua jalur aset bersifat relatif.
- Sebanyak 29 adegan data story tersedia lengkap dan berurutan.
- Visualisasi interaktif dapat difokuskan, memiliki label aksesibilitas, dan menyediakan tabel data alternatif.
- Seluruh jalur SVG peta dioptimalkan dan dipakai ulang secara efisien.
- Teks narasi bebas dari kesalahan render markup maupun angka statistik manual.
- Halaman tetap nyaman dibaca dan informatif meski JavaScript dinonaktifkan di peramban.
- Berkas data publik (24 CSV dan 2 GeoJSON) tersedia dan dapat diunduh langsung.

---

## Informasi Geografis dan Batas Wilayah

Batas wilayah kapanewon dan kabupaten/kota bersumber dari data spasial Dukcapil Kemendagri yang disederhanakan untuk kebutuhan visualisasi web, dan bukan merupakan rujukan batas hukum resmi. Penghubung data tabular LPPD dengan layer peta menggunakan kode wilayah standar Kemendagri (3401–3471).
