Catatan teknis
==============

Catatan pendamping untuk siapa pun yang memelihara halaman ini. Keputusannya ada
alasannya, supaya keputusan lama tidak dibongkar tanpa tahu kenapa ia dibuat.

1. Dari PDF ke tabel
-------------------

Sumber kerja adalah hasil ekstraksi teks laporan dalam `markdown-per-bab/` (di root repo,
bukan di dalam `data-story/`) — satu berkas per bab, dengan penanda
`<!-- Halaman N -->` per halaman. `scripts/build_data.mjs` melakukan:

- **Penambal baris**: tabel PDF yang terpotong lintas halaman disambung terlebih dahulu,
  lalu diuji: jumlah baris dan beberapa nilai kunci (mis. IPM 81,09;
  PAD 2.679.145.718.161,55) harus cocok sebelum ekstraksi lanjut.
- **Angka Indonesia**: pemisah ribuan `.` dan desimal `,` dibaca lewat `angka()` yang
  menolak sel kosong — sel kacau tidak pernah bernilai 0.
- **Asersi silang**: tiap agregat diuji ulang terhadap penjumlahan barisnya
  (`cek()` di build_data). Beda pembulatan diizinkan; beda aritmetika menggagalkan build.

2. Rujukan per adegan (bagian dari halaman)
-------------------------------------------

| Adegan | Rujukan LPPD                                        |
|--------|-----------------------------------------------------|
| 0-1    | hal. 188, tabel ke-2                                |
| 1-1    | hal. 27, naskah geografi wilayah                    |
| 1-2    | hal. 29 t1 + hal. 31 t4                              |
| 1-3    | hal. 31, tabel ke-1                                 |
| 2-1    | hal. 60 t1                                           |
| 2-2    | hal. 61, 62, 63 (tabel ke-1)                          |
| 2-3    | hal. 64–68 (5 adegan tabel ke-1)                      |
| 3-1    | hal. 189 t1 · 3-2 hal. 191 t1 · 3-3 hal. 192 t1 · 3-4 hal. 198 t1 |
| 4-1    | hal. 333–334, blok rasio partisipasi sekolah (teks)   |
| 4-2    | hal. 335–337 + 337–341, blok (teks)                   |
| 4-3    | hal. 585 t1 · 4-4 hal. 586 t1                         |
| 5-1    | hal. 800 t1 · 5-2 hal. 800 t2 · 5-3 hal. 739/740 t1   |
| 6-1    | hal. 1046–1105, kategori & indikator SPM per bidang   |
| 6-2/6-3| hal. 1046/1047 t1                                     |

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

- **Grafik HTML lebih dahulu.** Batang, ruas, titik, dan seluruh teks adalah elemen HTML
  yang diposisikan dengan persen, sehingga label tetap berukuran asli di layar ponsel.
  SVG hanya dipakai untuk garis (`preserveAspectRatio="none"` + `vector-effect:
  non-scaling-stroke`) dan busur cincin.
- **Warna grafik** (`src/styles/tokens.css`): `--c-sorot` (merah resmi, satu angka yang
  dibicarakan), `--c-tinta` / `--c-dasar` / `--c-redup` (turunan `ink`), `--c-trek` (rel
  dan bayangan anggaran), `--c-emas` (aksen). Satu grafik paling banyak memakai merah dan
  satu warna pendukung, sesuai pedoman.
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
    src/components/charts/        Angka, BarH, BulletH, Kupu, UnitTitik, Kolom, Tumpuk,
                                  Treemap, DotSerapan, Garis, MultiKecil, Cincin,
                                  KolomTumpuk, SkorBobot, Waffle, DaftarCapaian

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
- Judul adegan mengikuti SectionTitle: judul Regular, lalu garis 2,27 px yang berawal
  dari tepi kiri layar — ruas merah terang 62,53 px disusul garis abu.
- Huruf Source Sans 3 (pengganti Myriad Pro di web) Light/Regular/Semibold, di-host
  sendiri. Jogjakartype hanya untuk "Matur Nuwun"; berkasnya dibagikan utuh bersama
  lisensinya di `public/lisensi/`.
- Tanpa kartu, bayangan, sudut membulat, huruf kapital semua, atau emoji. Pemisah adalah
  ruang putih dan garis rambut. Pil hanya untuk tombol dan penanda pertumbuhan.
- Tidak ada mode gelap: pedoman hanya mengenal tema putih dan tema merah.
