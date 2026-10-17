# Data Story – Pemerintahan Daerah DIY 2023

Folder ini berisi data tabel yang diekstrak dari PDF laporan, siap digunakan sebagai sumber web data story.

## Struktur

- `source/` : file Markdown per Bab / sub-bab.
- `index.md` : daftar isi dengan jumlah tabel dan file sumber per file.

## Format tiap tabel

Setiap tabel diawali catatan sumber (halaman + nomor tabel), diikuti tabel Markdown standar.

## Pembersihan data

- Baris kosong sepenuhnya dihapus.
- Sel kosong dikosongkan.
- Karakter pipe (`|`) di-escape.
- Encoding: UTF-8.
