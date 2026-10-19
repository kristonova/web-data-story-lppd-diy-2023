Catatan teknis
==============

Catatan pendamping untuk siapa pun yang memelihara halaman ini. Keputusannya ada
alasannya, supaya keputusan lama tidak dibongkar tanpa tahu kenapa ia dibuat.

1. Dari PDF ke tabel
-------------------

Sumber kerja adalah hasil ekstraksi teks laporan dalam `markdown-per-bab/` (di root repo,
bukan di dalam `data-story/`) — satu berkas per bab, dengan penanda
`<!-- Halaman N -->` per halaman. Keduanya dihasilkan sekali dari PDF di `bahan-mentah/`
oleh skrip Python di `scripts/ekstraksi/` (`convert_pdf_to_bab_markdown.py` untuk
`markdown-per-bab/`, `extract_tables.py` untuk `data-story/source/`).
`scripts/build_data.mjs` melakukan:

- **Penambal baris**: tabel PDF yang terpotong lintas halaman disambung terlebih dahulu,
  lalu diuji: jumlah baris dan beberapa nilai kunci (mis. IPM 81,09;
  PAD 2.679.145.718.161,55) harus cocok sebelum ekstraksi lanjut.
- **Angka Indonesia**: pemisah ribuan `.` dan desimal `,` dibaca lewat `angka()` yang
  menolak sel kosong — sel kacau tidak pernah bernilai 0.
- **Asersi silang**: tiap agregat diuji ulang terhadap penjumlahan barisnya
  (`cek()` di build_data). Beda pembulatan diizinkan; beda aritmetika menggagalkan build.

2. Rujukan per adegan (bagian dari halaman)
-------------------------------------------

| Adegan | Visual                         | Rujukan LPPD                                   |
|--------|--------------------------------|------------------------------------------------|
| 0-1    | angka kunci                    | hal. 188 t2                                    |
| 1-1    | peta berlapis + peringkat      | hal. 27 (naskah luas), hal. 30 t1              |
| 1-2    | peta 78 kapanewon + titik      | hal. 30 t1, hal. 31 t4                         |
| 1-3    | komposisi + punggung umur      | hal. 30 t2, hal. 31 t1                         |
| 2-1    | arus (Sankey) APBD             | hal. 60–63 t1                                  |
| 2-2    | bullet anggaran–realisasi      | hal. 61–63 t1                                  |
| 2-3    | titik serapan per urusan       | hal. 64–68 t1                                  |
| 3-1    | empat peta kecil + Williamson  | hal. 939 t5, 941 t1, 948 t1, 931 t2 (naskah)   |
| 3-2    | garis IPM + koordinat paralel  | hal. 939 t5, 941 t1, 189 t1                    |
| 3-3    | garis kota–desa + lintasan     | hal. 191 t1, 948 t1                            |
| 3-4    | batang tumpuk pasar kerja      | hal. 192 t1                                    |
| 3-5    | batang tumpuk Bank Dunia       | hal. 198 t1, 188 t2                            |
| 4-1    | garis pertumbuhan wilayah      | hal. 924 t5 + t1, 930 t3 (naskah)              |
| 4-2    | tabel panas lapangan usaha     | hal. 923 t2, 924 t1                            |
| 4-3    | kolom tumpuk investasi         | hal. 585 t1                                    |
| 4-4    | peta gelembung per tahun       | hal. 586 t1                                    |
| 4-5    | peta gelembung hotel           | hal. 639 t1                                    |
| 5-1    | peta Sumbu Filosofi + titik    | hal. 1107 (naskah penutup), hal. 615 t1        |
| 5-2    | skor berbobot                  | hal. 800 t1                                    |
| 5-3    | tumpuk + bullet Danais         | hal. 800 t2                                    |
| 5-4    | treemap BKK                    | hal. 739/740 t1                                |
| 6-1    | batang IKK pendidikan          | hal. 333–335 (blok teks)                       |
| 6-2    | cincin infrastruktur           | hal. 335–341 (blok teks)                       |
| 6-3    | waffle air minum + sanitasi    | hal. 467 t3, 463 t1                            |
| 6-4    | cincin SPM per bidang          | hal. 1046–1105                                 |
| 6-5    | daftar capaian SPM pendidikan  | hal. 1046/1047 t1                              |
| 6-6    | waffle pendidikan khusus       | hal. 1047 t1                                   |

Blok yang ekstraksinya bukan tabel (rasio IKK, ABK, infrastruktur) dipetik dari paragraf
teks dan disebut apa adanya sebagai sumber ("blok …", bukan "tabel ke-N") — `prov()` di
`src/lib/data.ts` menampilkan dua bentuk itu.

3. Naskah — bukan tabel — untuk luas wilayah
--------------------------------------------

Luas daratan per kab/kota hanya ada di kalimat bab 1 (hal. 27). Angkanya dipetik dari
teks itu, disandingkan dengan `persenIndonesia 0,16` yang dihitung ulang dan selisih
pembulatannya dicatat di manifes.

4. Idiom grafik
---------------

- **Peta (GIS).** `data-story/geo/*.geojson` adalah batas kapanewon dan kabupaten/kota
  yang disiapkan sekali oleh `scripts/siapkan_geo.mjs` (mapshaper, penyederhanaan dengan
  topologi terjaga; kabupaten dilebur dari kapanewon sehingga garisnya identik).
  `scripts/build_geo.mjs` memproyeksikannya (ekuirektangular, faktor cos lintang tengah)
  menjadi `src/data/derived/peta.json`, menguji kode wilayah, jumlah kapanewon per
  kabupaten, dan luas geometri (≤ 5% dari luas LPPD), lalu menyalin GeoJSON ke unduhan.
  Jalurnya dikirim **sekali** lewat `PetaDefs.astro` dan setiap peta memakai
  `<use href="#pk-3404">`; warna diwariskan dari elemen `<use>` ke jalur.
  Komponen `Peta.astro` punya empat mode: `koroplet` (lapis dapat dipilih), `kategori`
  (78 kapanewon), `gelembung` (lingkaran berskala sama antarlapis, dapat diputar) dan
  `penanda` (Sumbu Filosofi + sisipan Kota). Penanda tempat di `penanda.geojson` adalah
  koordinat perkiraan untuk ilustrasi, bukan angka LPPD, dan disebut begitu di sumber adegan.
- **Lapis**: grafik berlapis dibungkus `[data-lapis-induk]`; tombol `[data-pilih]`
  mengganti atribut `data-lapis`, CSS memilih isian `--f0…--f4`, skala `--s0…`, dan
  label `[data-l]` yang sesuai. Isi tooltip per lapis ada di `data-t0/data-v0/data-s0`.
  Tanpa JavaScript tombol disembunyikan, lapis awal tampil, dan semua lapis ada di tabel.
- **Warna identitas wilayah** (`src/lib/warna.ts`): Kulon Progo magenta, Bantul oranye,
  Gunungkidul hijau khas, Sleman biru khas, Kota marun, DIY tinta — dipakai sama di peta
  kategori, garis, koordinat paralel, punggung umur, lintasan, dan gelembung. Gradasi
  koroplet (merah, hijau, biru, emas) dan warna divergen tabel panas dicampur dari warna
  pedoman ke krem/putih, jadi tidak ada warna asing.
- **Komponen generasi ketiga**: `Arus` (Sankey tiga lajur; versi ringkas per kelompok di
  layar sempit), `Punggung` (ridgeline umur), `Paralel` (koordinat paralel), `Lintasan`
  (titik per periode dengan panah awal→akhir), `PetakPanas` (tabel panas divergen),
  `WaffleDeret` (waffle kecil berdampingan).
- **Grafik HTML lebih dahulu.** Batang, ruas, titik, dan seluruh teks adalah elemen HTML
  yang diposisikan dengan persen, sehingga label tetap berukuran asli di layar ponsel.
  SVG hanya dipakai untuk garis (`preserveAspectRatio="none"` + `vector-effect:
  non-scaling-stroke`) dan busur cincin.
- **Warna grafik** (`src/styles/tokens.css`): `--c-sorot` (merah resmi, satu angka yang
  dibicarakan), `--c-tinta` / `--c-dasar` / `--c-redup` (turunan `ink`), `--c-trek` (rel
  dan bayangan anggaran), `--c-emas` (aksen). Grafik satu seri tetap netral dengan satu
  sorotan merah; grafik antarwilayah memakai warna identitas wilayah (lihat butir peta).
- **Gerak** (`data-anim`, dipagari `.js`, bergerak sesudah bloknya `[data-reveal]` mendapat
  `.is-in`): `x`, `x-kanan`, `y`, `titik`, `pudar`, `naik`, `sapu` (garis tergambar kiri ke
  kanan), `angkat` (kolom naik dari dasar), `busur` (cincin). Jenjang waktunya dipasang
  skrip lewat `--tunda-k`; komponen boleh menetapkannya sendiri (gelombang waffle).
  Jangan memberi `data-anim` pada elemen yang memakai `transform` untuk posisinya —
  `naik`, `x`, dan `titik` mengganti `transform` dan menggeser elemen itu.
- Angka bertanda `data-count` menghitung naik; teks akhirnya dipulihkan persis seperti
  yang ditulis server.
- Setiap grafik terbungkus `div.viz` dari `kontainer()` (`tabindex=0`, `aria-label`,
  `data-t`/`data-v`/`data-s`, grup `data-g`), lalu tabel angka di `<details class="tabel-alt">`.
- Pembulatan koordinat konsisten `q()` (2 desimal) supaya HTML tetap ramping.

5. Pitfall yang pernah memakan waktu
------------------------------------

- **PowerShell mengelabui en dash**: konsol menggambarkan `–` sebagai `-`. Jangan yakin
  berdasarkan keluaran layar; gunakan skrip node untuk melihat kode poin.
- **CRLF**: regex edit harus toleran `\r?\n`.
- **Sel OCR rusak**: sel pangan yatim (mis. `2,09` yang tak lagi terbaca valid) jatuh ke
  `catatanCelah`, tidak dirender.
- **Rasio vs persen**: `rasioPerRibu` RS adalah ranjang per 1.000 jiwa, bukan persen —
  nilai 2,32 harus disandingkan teks satuan, dan ia ada di catatan celah.
- **Ralat ABK**: laporan memuat 6.132 lalu dikoreksi menjadi 7.232; pipeline memakai
  angka ralat, catatan celah melaporkan keduanya.
- **Investasi +15,65% vs +16%**: laporan menuliskan pembulatan; dua versi hadir berdampingan.
- **Satuan investasi kumulatif**: tabel hal. 585 tertulis dalam Rp000, jadi
  24.967.647.193 berarti Rp24,97 **triliun**, bukan miliar. Pipeline kini menulis
  `pmdnTriliun` dst. dan `investasi-tren.csv` berkolom `*_triliun`. Tabel per kab/kota
  hal. 586 tertulis dalam rupiah penuh dan tetap disajikan dalam miliar.
- **SPAL bukan cakupan rumah tangga**: indikator hal. 338–339 adalah rasio volume limbah
  domestik yang masuk SPAL regional terhadap kapasitas olahnya (27.205 / 75.000). Naskah
  menyebutnya pemanfaatan kapasitas, bukan "rumah terlayani".
- **`x! / y` dibaca sebagai regex**: kompilator Astro berbasis Rust (compiler-rs 0.5)
  salah mengurai operator non-null yang langsung disusul garis miring pembagian, lalu
  `astro check` meledak memakai memori (> 6 GB) dan build gagal di baris yang salah.
  Tulis `(x!) / y`. Pemeriksaan cepat: `grep -n '!\s*/\s' src -r`.
- **Satuan tabel air minum**: Tabel 2-39 berjudul "penduduk", tetapi tiap barisnya sama
  dengan jumlah rumah tangga Tabel 2-33; pipeline menguji kesamaan itu dan memakai
  satuan rumah tangga.
- **Sel pengeluaran per kapita**: kolom 2019–2020 memakai koma sebagai pemisah ribuan
  ("10,275"), kolom 2021–2023 memakai titik; `ribuRupiah()` membaca keduanya.
- **Nama kelas bertabrakan**: komponen bergaya terlingkup tetap mewarisi kelas global.
  Kelas `.akhir` milik bagian penutup sempat terpasang pada titik grafik dan membuatnya
  sebesar layar; pakai nama berawalan komponen (`mk__titik--akhir`).

6. Kontrak pemeriksa build
--------------------------

Pemeriksa "angka manual" menggantikan pemeriksa PII proyek paroki: data LPPD adalah
agregat publik tingkat DIY dan APBD memang berisi angka 12–13 digit yang sah. Pemindaian
tetap mencari deretan digit yang muncul **tepat setelah batas tag `>`** pada markup
bersih — angka di tabel alternatif dinilai terpisah (wadah
`<details class="tabel-alt">` disingkirkan lebih dahulu), demikian pula angka di dalam skrip.

7. Susunan berkas penting
-------------------------

    src/lib/data.ts        satu layer: tipe + ekspor JSON + prov()/anchor()
    src/lib/format.ts      angka Indonesia, rp()/rpS() rupiah ringkas, kata(), namaKab()
    src/i18n/id.ts         judul, label & lead tanpa angka; angka disusun di halaman
    src/layouts/Cerita.astro      kepala halaman, gerak gulir, hitung naik, service worker
    src/components/Bab.astro      pembatas merah (SectionDivider) + pengantar bab berikon
    src/components/Adegan.astro   judul bergaris (SectionTitle) → visual → tafsir → sumber
    src/components/Figur.astro    judul grafik, satuan, legenda, slot tabel angka
    src/lib/warna.ts              warna identitas wilayah, gradasi koroplet, divergen
    src/components/charts/        Angka, BarH, BulletH, UnitTitik, Tumpuk, Treemap,
                                  DotSerapan, Garis, Cincin, KolomTumpuk, SkorBobot,
                                  Waffle, DaftarCapaian, Peta, PetaDefs, Arus, Punggung,
                                  Paralel, Lintasan, PetakPanas, WaffleDeret
    data-story/geo/               batas wilayah GeoJSON + penanda (sumber peta)
    scripts/siapkan_geo.mjs       sekali jalan: shapefile nasional → GeoJSON DIY ringkas
    scripts/build_geo.mjs         setiap `npm run data`: GeoJSON → jalur SVG + asersi

8. Identitas visual Jogja Istimewa
----------------------------------

Halaman memakai design system **Jogja Istimewa**. Aset resminya disalin apa adanya ke
`public/brand/` (logo merah dan putih, deret ikon putih dan emas, latar sampul, ikon
Icon System). Aturan yang dijaga:

- Merah resmi `#d82128` di atas putih; putih di atas merah. Emas `#dab96b` hanya ornamen.
- Logo tidak pernah diketik: selalu berkas SVG resmi, putih di atas sampul, merah sesudah
  kepala halaman memadat.
- Sampul dan penutup: latar sampul resmi, judul Light putih rata tengah, deret ikon emas.
  Pembatas bab: bidang merah penuh, judul Light putih, deret ikon putih di tepi bawah.
- Judul adegan mengikuti SectionTitle: judul pendek, pertanyaan adegan sebagai anak
  judul Light, lalu garis 2,27 px yang berawal dari tepi kiri layar — ruas merah terang
  62,53 px disusul garis abu.
- Huruf Source Sans 3 (pengganti Myriad Pro di web) Light/Regular/Semibold, di-host
  sendiri, untuk naskah, label, dan angka. **Jogjakartype** untuk judul bab, judul adegan,
  judul grafik, nama bab di daftar isi, dan "Matur Nuwun" — atas permintaan pemilik
  proyek, melampaui anjuran pedoman (1–3 kata). Karena itu judul adegan dibuat pendek
  (2–4 kata) dan pertanyaannya dipindah ke anak judul Source Sans. Glif yang tidak ada di
  Jogjakartype (², ·, ×, huruf beraksen) jatuh ke Source Sans 3 lewat tumpukan huruf.
  Berkas TTF dibagikan utuh (tanpa konversi) bersama lisensinya di `public/lisensi/`.
- Tanpa kartu, bayangan, sudut membulat, huruf kapital semua, atau emoji. Pemisah adalah
  ruang putih dan garis rambut. Pil hanya untuk tombol (pemilih lapis, putar) dan penanda
  pertumbuhan. Label peta duduk di pelat warna wilayahnya, bukan bayangan teks.
- Ikon Icon System dipakai sebagai penanda topik (pengantar bab, daftar isi) dan sebagai
  penanda tempat di peta Sumbu Filosofi (Merapi, Tugu, Keraton), sesuai anjuran
  "peta wisata" pedoman; tidak dicampur dengan set ikon lain.
- Tidak ada mode gelap: pedoman hanya mengenal tema putih dan tema merah.
