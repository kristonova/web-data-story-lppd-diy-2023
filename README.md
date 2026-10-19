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
    scripts/build_data.mjs     ← ekstraksi tabel + asersi silang → JSON + CSV + manifes
    src/data/derived/*.json    ← 9 JSON turunan (pembuka, pilar1–6, manifes)
    public/data/*.csv          ← 18 CSV agregat yang ikut diterbitkan
    src/pages/index.astro      ← satu halaman: sampul, ringkasan, 6 bab, penutup (23 adegan)
    src/components/charts/     ← 16 komponen grafik HTML/SVG tanpa pustaka charting
    public/brand/              ← aset resmi Jogja Istimewa (logo, deret ikon, latar, ikon)
    scripts/check_build.mjs    ← gerbang akhir atas hasil build di dist/

Tampilan
--------

Halaman memakai design system **Jogja Istimewa**: merah resmi di atas putih, emas sebagai
ornamen, huruf Source Sans 3 (pengganti Myriad Pro di web) yang di-host sendiri. Sampul dan
penutup memakai latar sampul resmi dengan deret ikon emas; setiap bab dibuka pembatas merah
penuh dengan deret ikon putih; setiap adegan berjudul dengan garis aksen pedoman. Grafik
digambar dalam HTML lebih dahulu supaya label tetap terbaca di ponsel, bergerak halus saat
digulir (batang tumbuh, garis tergambar, cincin menyapu, angka berhitung), dan menghormati
pengaturan *reduced motion*. Rincian aturan ada di `docs/catatan-teknis.md` bagian 4 dan 8.

Seluruh angka diaduk dari `src/lib/data.ts` (tipis di atas JSON turunan) — **tidak ada
angka hasil pengukuran yang diketik manual** di naskah. Kalimat yang memuat angka disusun
templat, jadi bila sumber diperbarui, halaman ikut segar.

Perintah
--------

    npm run data          # bangun ulang JSON/CSV dari sumber + asersi silang
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
- 23 adegan bernomor hadir; ≥12 grafik dapat difokus + berlabel aksesibel;
  setiap grafik punya tabel angka alternatif terbuka-tanpa-JS (`<details>`).
- Tidak ada markup yang tampil sebagai teks; tidak ada kandidat angka yang diketik manual.
- Gerak saat gulir dinonaktifkan bila JavaScript mati (dipagari kelas `.js`).
- Judul mulai dari satu h1; `lang="id"`.
- Service worker dibangun; 18 berkas unduhan agregat benar-benar ada di `dist/data/`.

Catatan celah data
------------------

Pipeline mencatat **12 catatan celah** (pembulatan antartabel, sel OCR yang tak terbaca,
koreksi resmi di laporan, angka yang maknanya bukan persen). Seluruhnya ditampilkan terbuka
di adegan penutup 7-1 dan tersimpan di `src/data/derived/manifes.json`. Sel yang rusak
tidak pernah dirender sebagai angka — ia dilaporkan, bukan dikira.
