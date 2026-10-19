LPPD DIY dalam Angka
====================

Data story satu halaman untuk **Laporan Penyelenggaraan Pemerintahan Daerah (LPPD) DIY 2023**.
Dibangun Astro, sepenuhnya statis, tanpa pemanggilan jaringan bila dibuka dari `dist/` —
dapat disalin ke USB dan dibuka lewat `file:`.

Sumber satu-satunya kebenaran adalah laporan resminya: setiap angka di halaman menunjuk
**halaman + tabel** LPPD DIY 2023, ditarik otomatis oleh pipeline dan dijaga asersi silang
sebelum halaman boleh dibangun.

Cara kerja singkat
------------------

    markdown-per-bab/          ← sumber: hasil ekstraksi teks per bab (di root repo)
    data-story/source/         ← salinan per-urusan untuk pengecekan cepat
    data-story/geo/            ← batas kapanewon & kabupaten/kota DIY (GeoJSON) + penanda
    scripts/build_data.mjs     ← ekstraksi tabel + asersi silang → JSON + CSV + manifes
    scripts/build_geo.mjs      ← GeoJSON → jalur SVG terproyeksi + asersi peta
    src/data/derived/*.json    ← 11 JSON turunan (pembuka, pilar1–6, wilayah, peta, manifes)
    public/data/               ← 24 CSV agregat + 2 GeoJSON batas wilayah untuk diunduh
    src/pages/index.astro      ← satu halaman: sampul, ringkasan, 6 bab, penutup (29 adegan)
    src/components/charts/     ← 20 komponen grafik dan peta HTML/SVG tanpa pustaka charting
    public/brand/              ← aset resmi Jogja Istimewa (logo, deret ikon, latar, ikon)
    scripts/check_build.mjs    ← gerbang akhir atas hasil build di dist/

Tampilan
--------

Halaman memakai design system **Jogja Istimewa**: merah resmi di atas putih, emas sebagai
ornamen, warna khas (hijau, biru, terakota) dan warna lentur pedoman untuk membedakan
wilayah. Judul bab, adegan, dan grafik memakai **Jogjakartype**; naskah dan angka memakai
Source Sans 3 (pengganti Myriad Pro di web). Keduanya di-host sendiri.

Visualnya beragam menurut cerita: **peta GIS** dari batas GeoJSON kapanewon (peta berlapis
luas–penduduk–kepadatan, peta 78 kapanewon, empat peta kesejahteraan, peta gelembung
investasi yang dapat diputar per tahun, peta hotel, peta Sumbu Filosofi dengan sisipan
Kota), diagram arus APBD, punggung umur, koordinat paralel komponen IPM, lintasan
kemiskinan, tabel panas lapangan usaha, dan waffle air minum. Semua digambar saat build
tanpa pustaka peta atau charting, bergerak halus saat digulir, menghormati *reduced
motion*, dan setiap grafik punya tabel angka. Rincian aturan ada di
`docs/catatan-teknis.md` bagian 4 dan 8.

Seluruh angka diaduk dari `src/lib/data.ts` (tipis di atas JSON turunan) — **tidak ada
angka hasil pengukuran yang diketik manual** di naskah. Kalimat yang memuat angka disusun
templat, jadi bila sumber diperbarui, halaman ikut segar.

Perintah
--------

    npm run data          # bangun ulang JSON/CSV dari sumber + jalur peta, dengan asersi silang
    npm run validate:data # validasi bentuk & nilai kunci keluaran pipeline
    npm run dev           # pratinjau pengembangan
    npm run build         # astro check + astro build + service worker
    npm run check:build   # 17 pemeriksaan atas dist/ (lihat rincian di bawah)
    npm run verify        # data → validate:data → build → check:build

`npm run verify` adalah satu-satunya cara yang diizinkan menyatakan "sudah selesai":
semua gerbang harus hijau.

Yang dijaga oleh `check:build`
------------------------------

- Tanpa permintaan ke domain luar; seluruh aset (huruf, gambar, brand) di-host sendiri.
- Halaman penuh < 4 MB; jalur aset seluruhnya relatif.
- 29 adegan bernomor hadir; ≥12 grafik dapat difokus + berlabel aksesibel;
  setiap grafik punya tabel angka alternatif terbuka-tanpa-JS (`<details>`).
- Jalur peta dikirim sekali (5 kabupaten/kota, 78 kapanewon) lalu dipakai ulang; GeoJSON
  unduhan ada.
- Tidak ada markup yang tampil sebagai teks; tidak ada kandidat angka yang diketik manual.
- Gerak saat gulir dinonaktifkan bila JavaScript mati (dipagari kelas `.js`).
- Judul mulai dari satu h1; `lang="id"`.
- Service worker dibangun; 24 CSV dan 2 GeoJSON unduhan benar-benar ada di `dist/data/`.

Catatan celah data
------------------

Pipeline mencatat **22 catatan celah** (pembulatan antartabel, sel OCR yang tak terbaca,
koreksi resmi di laporan, angka yang maknanya bukan persen, penulisan angka yang tidak
seragam, dan dua paragraf laporan yang saling bertentangan tentang indeks Williamson). Seluruhnya ditampilkan terbuka
di adegan penutup 7-1 dan tersimpan di `src/data/derived/manifes.json`. Sel yang rusak
tidak pernah dirender sebagai angka — ia dilaporkan, bukan dikira.

Batas wilayah peta
------------------

Batas kapanewon dan kabupaten/kota berasal dari portal GIS Dukcapil Kemendagri (data 2018
semester 1), melalui repositori `Alf-Anas/batas-administrasi-indonesia` folder 2020, dan
bersifat indikatif untuk visualisasi — bukan rujukan hukum batas wilayah. GeoJSON ringkas
di `data-story/geo/` disiapkan sekali dengan:

    node scripts/siapkan_geo.mjs <folder Batas Kecamatan.shp> <folder Batas Kabupaten.shp>

Kode wilayah Kemendagri (3401–3471) menjadi kunci penghubung tabel LPPD dengan peta.
Letak Tugu, Keraton, Panggung Krapyak, Gunung Merapi, dan Laut Selatan di
`data-story/geo/penanda.geojson` adalah perkiraan untuk ilustrasi.
