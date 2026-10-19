# -*- coding: utf-8 -*-
"""
Konversi PDF LPPD DIY 2023 -> file Markdown PER BAB (teks penuh, bukan hanya tabel).
Output di folder terpisah: markdown-per-bab/

Setiap bab = satu file .md:
  - header metadata (judul, sumber, rentang halaman, total baris)
  - daftar isi bab dengan link ke baris (L{N})
  - pemisah "## Isi"
  - konten penuh per halaman (dengan penanda <!-- Halaman N -->)
  - heading dikonversi ke markdown (# BAB, ## 1.1, ### 1.1.1, #### 1.1.1.1)

Nomor baris yang dicatat adalah nomor baris **akurat dalam file .md asli**,
sehingga README bisa dijadikan rujukan tunggal oleh AI untuk mengetahui
file mana dan di baris berapa bagian tertentu dimulai.

Selain itu, skrip menulis README.md dengan:
  - ringkasan isi tiap bab
  - tabel "File → Baris → Bagian" sebagai referensi langsung
"""
import pdfplumber
import re
from pathlib import Path

# Path relatif terhadap akar repo (skrip ini ada di scripts/ekstraksi/),
# jadi skrip dapat dijalankan dari folder mana pun.
AKAR     = Path(__file__).resolve().parents[2]
PDF_PATH = AKAR / "bahan-mentah" / "Laporan Penyelenggaraan Pemerintahan Daerah DIY Tahun 2023_compressed.pdf"
OUT_DIR  = AKAR / "markdown-per-bab"
OUT_DIR.mkdir(parents=True, exist_ok=True)

# (nomor_bab, halaman_awal, halaman_akhir, judul_bab, ringkasan_singkat)
BABS = [
    (1,  22,  187, "PENDAHULUAN",
     "Latar belakang pembentukan daerah DIY, data geografis dan demografi (penduduk, kabupaten/kota, perangkat daerah), realisasi APBD, "
     "perencanaan pembangunan (masalah strategis, visi-misi kepala daerah, program dan kegiatan tahunan), serta penerapan Standar Pelayanan Minimal (SPM)."),
    (2, 188,  977, "CAPAIAN KINERJA PENYELENGGARAAN PEMERINTAHAN DAERAH",
     "Bab terbesar berisi capaian kinerja menyeluruh: makro (IPM, kemiskinan, pengangguran, pertumbuhan ekonomi, pendapatan per kapita, ketimpangan), "
     "indikator kinerja kunci (keluaran/hasil/fungsi penunjang/otonomi/asimetris), capaian urusan wajib (pendidikan, kesehatan/RS, PUPR, penataan ruang, perumahan, ketenteraman, sosial, tenaga kerja, pemberdayaan perempuan, pangan, pertanahan, lingkungan hidup, administrasi kependudukan, pemberdayaan masyarakat, KB, perhubungan, komunikasi & informatika, koperasi & UMKM, penanaman modal, pemuda & olahraga, statistik, persandian, kebudayaan, perpustakaan, kearsipan), urusan pilihan, kewenangan istimewa, urusan umum, tugas umum, fungsi penunjang, dan akuntabilitas kinerja."),
    (3, 978, 1032, "CAPAIAN KINERJA PELAKSANAAN TUGAS PEMBANTUAN",
     "Dasar hukum, gambaran umum, dan capaian kinerja pelaksanaan tugas pembantuan per OPD (Pertanian & Ketahanan Pangan, PUPR & ESDM, Koperasi & UMKM, Pariwisata), "
     "termasuk tugas pembantuan provinsi yang dilaksanakan oleh kabupaten/kota."),
    (4, 1033, 1103, "PENERAPAN DAN PENCAPAIAN STANDAR PELAYANAN MINIMAL",
     "Penerapan SPM per bidang urusan: Pendidikan, Kesehatan, Pekerjaan Umum, Perumahan Rakyat, Ketenteraman/Ketertiban Umum, dan Sosial. "
     "Setiap bidang mencakup jenis pelayanan dasar, target capaian, anggaran, dukungan personil, hasil capaian, serta kendala/masalah dan solusi."),
    (5, 1104, 1110, "PENUTUP",
     "Kesimpulan laporan capaian kinerja penyelenggaraan Pemerintahan Daerah dan Tugas Pembantuan DIY tahun anggaran 2023."),
]

RE_BAB    = re.compile(r'^BAB\s+(\d+)\s*\.\s*(.+)$', re.IGNORECASE)
RE_SUB2   = re.compile(r'^(\d+)\.(\d+)\.(\d+)\.(\d+)\s*\.\s*(.+)$')      # 1.1.1.1. JUDUL
RE_SUB1   = re.compile(r'^(\d+)\.(\d+)\.(\d+)\s*\.\s*(.+)$')             # 1.1.1. JUDUL
RE_SEKSI  = re.compile(r'^(\d+)\.(\d+)\s*\.\s*(.+)$')                    # 1.1. JUDUL

def clean_line(line):
    line = line.replace("\x0c", " ").replace("\r", " ")
    line = re.sub(r'[ \t]+', ' ', line).strip()
    return line

def heading_level_and_title(text):
    m = RE_BAB.match(text)
    if m:
        return 1, f"BAB {m.group(1)}. {m.group(2).strip()}"
    m = RE_SUB2.match(text)
    if m:
        return 4, f"{m.group(1)}.{m.group(2)}.{m.group(3)}.{m.group(4)}. {m.group(5).strip()}"
    m = RE_SUB1.match(text)
    if m:
        return 3, f"{m.group(1)}.{m.group(2)}.{m.group(3)}. {m.group(4).strip()}"
    m = RE_SEKSI.match(text)
    if m:
        return 2, f"{m.group(1)}.{m.group(2)}. {m.group(3).strip()}"
    return None, None

def slugify(judul):
    s = judul.lower()
    s = re.sub(r'[^a-z0-9\s]', '', s)
    s = re.sub(r'\s+', '-', s).strip('-')
    return s or "section"

def extract_content(pdf, start_page, end_page):
    """
    Kembalikan (content_lines, marks).
    content_lines = list baris konten (awalnya penanda halaman + teks per halaman).
    marks = list (judul_bagian, posisi_relatif_1based_dalam_content_lines).
    """
    content = []
    marks = []
    for pno in range(start_page, end_page + 1):
        page = pdf.pages[pno - 1]
        txt = page.extract_text() or ""
        content.append(f"<!-- Halaman {pno} -->")
        for raw in txt.split("\n"):
            line = clean_line(raw)
            if not line:
                continue
            lvl, title = heading_level_and_title(line)
            if lvl is not None:
                md = "#" * lvl + " " + title
                content.append(md)
                marks.append((title, len(content)))  # 1-based posisi di content
            else:
                content.append(line)
        content.append("")  # spasi antar halaman
    return content, marks

def build_file(nbab, judul_bab, s, e, content, marks):
    """
    Susun baris akhir file dan hitung nomor baris AKURAT setiap mark.
    Layout:
      1 # BAB n. Judul
      2 Sumber: ...
      3 Rentang halaman PDF: s – e
      4 Total baris: N
      5 ---
      6 (kosong)
      7 ## Daftar Isi Bab
      8..  entries (satu per mark)  -> referensi baris akhir
      ... --- 
      ... ## Isi
      ... (kosong)
      ... content[1..]  (konten penuh)
    """
    header_static = [
        f"# BAB {nbab}. {judul_bab}",
        f"Sumber: `{Path(PDF_PATH).name}`",
        f"Rentang halaman PDF: {s} – {e}",
        "---",
        "",
        "## Daftar Isi Bab",
    ]
    n_static = len(header_static)                      # 6
    n_marks = len(marks)
    # baris sebelum content[1]: static(6) + "Total baris"(1) + entries(n_marks) + "---"(1) + "## Isi"(1) + ""(1)
    content_offset = n_static + 1 + n_marks + 3        # content[1] berada di baris content_offset + 1

    # Susun daftar isi dengan referensi baris akurat
    toc_lines = []
    for title, relpos in marks:
        lvl, _ = heading_level_and_title(title)
        indent = "  " * max(0, (lvl or 1) - 1)
        final_line = content_offset + relpos
        toc_lines.append(f"{indent}- [{title}](#L{final_line}) — baris {final_line}")

    total_lines = content_offset + len(content)

    lines = []
    lines.extend(header_static)
    lines.append(f"Total baris: {total_lines}")
    lines.extend(toc_lines)
    lines.append("---")
    lines.append("## Isi")
    lines.append("")
    lines.extend(content)

    return lines, total_lines, content_offset

def main():
    pdf = pdfplumber.open(PDF_PATH)

    bab_records = []
    for (nbab, s, e, judul_bab, ringkasan) in BABS:
        content, marks = extract_content(pdf, s, e)
        lines, total_lines, content_offset = build_file(nbab, judul_bab, s, e, content, marks)
        fname = f"bab-{nbab}-{slugify(judul_bab)}.md"
        fpath = OUT_DIR / fname
        with open(fpath, "w", encoding="utf-8") as f:
            for ln in lines:
                f.write(ln + "\n")

        # hitung ulang mark dengan baris akhir akurat untuk README
        accurate_marks = []
        for title, relpos in marks:
            lvl, _ = heading_level_and_title(title)
            final_line = content_offset + relpos
            accurate_marks.append((title, final_line, lvl))

        bab_records.append({
            "nbab": nbab,
            "judul": judul_bab,
            "ringkasan": ringkasan,
            "fname": fname,
            "start": s,
            "end": e,
            "marks": accurate_marks,
            "total_lines": total_lines,
        })
        print(f"[OK] BAB {nbab} -> {fname}  ({total_lines} baris, {len(marks)} bagian)")

    pdf.close()

    # ---------- README.md ----------
    readme_path = OUT_DIR / "README.md"
    with open(readme_path, "w", encoding="utf-8") as f:
        f.write("# Data Story – LPPD DIY Tahun 2023 (Markdown per Bab)\n\n")
        f.write("Folder ini berisi hasil konversi **teks penuh** PDF laporan LPPD DIY Tahun 2023, dibagi per Bab.\n")
        f.write(f"Sumber: `{Path(PDF_PATH).name}`\n\n")
        f.write("## Tujuan untuk AI / Web Data Story\n\n")
        f.write("Jika ingin membangun web data story, **cukup baca README ini**. Setiap bab sudah dicatat:\n")
        f.write("- file markdown yang berisi bab tersebut\n")
        f.write("- nomor baris (baris ke-berapa) di mana setiap bagian/sub-bab dimulai\n")
        f.write("Dengan informasi ini, AI dapat langsung membuka file dan baris yang relevan tanpa membaca seluruh file.\n\n")

        f.write("## Ringkasan Tiap Bab\n\n")
        f.write("| Bab | Judul | Halaman PDF | File Markdown | Total Baris |\n")
        f.write("|-----|-------|-------------|---------------|-------------|\n")
        for r in bab_records:
            f.write(f"| BAB {r['nbab']} | {r['judul']} | {r['start']} – {r['end']} | `{r['fname']}` | {r['total_lines']} |\n")

        f.write("\n## Panduan Cepat (File → Baris → Bagian)\n\n")
        f.write("Tabel berikut menjelaskan, untuk setiap bagian di tiap bab, file markdown dan nomor baris **akurat** tempat bagian tersebut dimulai.\n")
        f.write("Gunakan sebagai referensi langsung saat membangun web data story.\n\n")

        for r in bab_records:
            f.write(f"### BAB {r['nbab']}. {r['judul']}\n")
            f.write(f"File: `{r['fname']}`  |  Halaman PDF: {r['start']} – {r['end']}  |  Total baris: {r['total_lines']}  |  Ringkasan: {r['ringkasan']}\n\n")
            f.write("| Bagian | Baris | Catatan |\n")
            f.write("|--------|-------|---------|\n")
            if not r['marks']:
                f.write("| (tidak ada bagian terdeteksi) | – | Isi berupa teks alur |\n")
            for title, lineno, lvl in r['marks']:
                f.write(f"| {title} | {lineno} | `[{r['fname']}#L{lineno}]` |\n")
            f.write("\n")

        f.write("---\n\n")
        f.write("## Cara Membaca\n\n")
        f.write("- Setiap file markdown dimulai dengan metadata (judul, sumber, rentang halaman, total baris) dan daftar isi bab.\n")
        f.write("- Heading ditandai `#` (Bab), `##` (seksi), `###` (sub-seksi), `####` (sub-sub-seksi).\n")
        f.write("- Setiap halaman PDF ditandai komentar HTML `<!-- Halaman N -->` agar mudah melacak asal data.\n")
        f.write("- Nomor baris di README merujuk pada baris dalam file markdown asli (akurat).\n")
        f.write("- Encoding: UTF-8.\n\n")
        f.write("## Catatan\n\n")
        f.write("- Konversi hasil ekstraksi teks PDF; beberapa tabel kompleks mungkin belum terstruktur sempurna sebagai tabel Markdown.\n")
        f.write("- Untuk data tabel terstruktur, lihat folder `data-story/source/` (ekstraksi tabel terpisah per bab/sub-bab).\n")

    print(f"\nSELESAI. README ditulis ke {readme_path}")
    print(f"Total file bab: {len(bab_records)}")

if __name__ == "__main__":
    main()
