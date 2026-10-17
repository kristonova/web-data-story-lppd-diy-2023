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

- Token warna: `--chart-grid`, `--chart-axis`, `--surface-card`, `--text-subtle/strong/body/muted`.
- Kelas sumbu tetap: `.grid line`, `.tick`, `.satuan`, `.nama`, `.nilai`, `.judul-sumbu`.
- `data-anim` menandai animasi yang dipagari kelas `.js` di layout:
  `x`, `x-balik`, `titik`, `pudar`, `garis`, `busur`, `kartu`.
- Semua svg pembawa data: `role="img"` + `aria-label`, terbungkus `div.viz` dari
  `kontainer()` (`tabindex=0`, `data-t`/`data-v`/`data-s`, grup `data-g`).
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
    src/i18n/id.ts         label & lead tanpa angka; angka disusun di halaman
    src/components/Adegan.astro   struktur per-adegan (pertanyaan→visual→tafsir→sumber)
    src/components/Pilar.astro    kulit pilar + chip bidang
    src/components/charts/       HorizontalBar, KolomLolipop, DuaTitik, GarisTren,
                                 BatangSelisih, MeterRing, StatCards, DataGapCard, dll.
