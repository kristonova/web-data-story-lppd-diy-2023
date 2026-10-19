# -*- coding: utf-8 -*-
"""
Ekstraksi tabel PDF per Bab, dengan Bab 2 dibagi lebih lanjut per sub-bab
(agar file tidak terlalu besar untuk web data story).

Output di data-story/source/:
  bab-1-*.md, bab-3-*.md, bab-4-*.md, bab-5-*.md   -> per bab
  bab2-<sub>_-_<slug>.md                             -> per sub-bab di Bab 2
  data-story/index.md, data-story/README.md
"""
import pdfplumber
import re
import os
from pathlib import Path

# Path relatif terhadap akar repo (skrip ini ada di scripts/ekstraksi/),
# jadi skrip dapat dijalankan dari folder mana pun.
AKAR     = Path(__file__).resolve().parents[2]
PDF_PATH = AKAR / "bahan-mentah" / "Laporan Penyelenggaraan Pemerintahan Daerah DIY Tahun 2023_compressed.pdf"
OUT_DIR  = AKAR / "data-story"
SRC_DIR  = OUT_DIR / "source"

# (nomor_bab, halaman_awal, halaman_akhir, judul_bab)
BABS = [
    (1,  22,  187, "Pendahuluan"),
    (2, 188,  977, "Capaian Kinerja"),
    (3, 978, 1032, "Capaian Kinerja"),
    (4, 1033, 1103, "Penerapan Standar"),
    (5, 1104, 1110, "Penutup"),
]

def slugify(judul):
    s = judul.lower()
    s = re.sub(r'[^a-z0-9\s]', '', s)
    s = re.sub(r'\s+', '-', s).strip('-')
    return s or "section"

def clean_cell(c):
    if c is None:
        return ""
    t = str(c).replace("\r", " ").replace("\n", " ")
    t = re.sub(r"\s+", " ", t).strip()
    t = t.replace("|", "\\|")
    return t

def is_empty_table(table):
    if not table:
        return True
    for row in table:
        if not row:
            continue
        for c in row:
            if c and str(c).strip():
                return False
    return True

def table_to_md(table, page_no, tabel_index):
    rows = [r for r in table if r and any(c and str(c).strip() for c in r)]
    if not rows:
        return None
    ncol = max(len(r) for r in rows)
    norm = []
    for r in rows:
        rr = list(r) + [None] * (ncol - len(r))
        norm.append([clean_cell(c) for c in rr])
    if all(all(c == "" for c in r) for r in norm):
        return None
    header = norm[0]
    body = norm[1:]
    lines = []
    lines.append(f"*Sumber: halaman {page_no}, tabel ke-{tabel_index}*")
    lines.append("| " + " | ".join(header) + " |")
    lines.append("| " + " | ".join(["---"] * ncol) + " |")
    for r in body:
        lines.append("| " + " | ".join(r) + " |")
    lines.append("")
    return "\n".join(lines)

def detect_subbab_headings(pdf, start_page, end_page, prefix):
    """
    Scan halaman start_page..end_page, cari baris yang dimulai dengan
    nomor sub-bab (contoh: 2.1., 2.2.6.5.) diikuti judul huruf besar.
    Kembalikan list (halaman, nomor_sub, judul) urut naik halaman.
    Ambil heading yang nomor-nya diawali dengan prefix (contoh '2.').
    """
    headings = []
    pat = re.compile(r'^\s*(\d+(?:\.\d+)*)\.\s+([A-Z][^\n]{5,110})')
    for i in range(start_page - 1, end_page):
        page = pdf.pages[i]
        txt = page.extract_text() or ""
        for line in txt.split("\n"):
            m = pat.match(line)
            if not m:
                continue
            nomor = m.group(1)
            judul = m.group(2).strip()
            if nomor.startswith(prefix + ".") and nomor != prefix:
                # filter: heading laporan biasanya HURUF BESAR; hindari angka besar
                # seperti "2.451.424" yang bukan nomor sub-bab
                bagian_nomor = nomor.split(".")
                if any(len(b) > 2 for b in bagian_nomor):
                    continue
                huruf = [c for c in judul if c.isalpha()]
                if huruf and (sum(1 for c in huruf if c.isupper()) / len(huruf)) < 0.6:
                    continue
                # hindari duplikasi nomor yang sama di halaman berbeda (ambil yang pertama)
                if not any(h[1] == nomor for h in headings):
                    headings.append((i + 1, nomor, judul))
            break  # satu heading per halaman paling atas
    return headings

def main():
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    SRC_DIR.mkdir(parents=True, exist_ok=True)

    pdf = pdfplumber.open(PDF_PATH)

    file_counts = {}   # nama_file -> jumlah tabel
    file_handles = {}  # nama_file -> file object
    total_tabel = 0
    halaman_dengan_tabel = 0

    def get_handle(fname):
        if fname not in file_handles:
            fpath = SRC_DIR / fname
            fh = open(fpath, "w", encoding="utf-8")
            file_handles[fname] = fh
            file_counts[fname] = 0
            # header ditulis saat pertama buka; judul diisi oleh caller
        return file_handles[fname]

    def write_header(fh, judul, sumber_extra=""):
        fh.write(f"# {judul}\n")
        fh.write(f"Sumber: `{os.path.basename(PDF_PATH)}`\n")
        if sumber_extra:
            fh.write(f"{sumber_extra}\n")
        fh.write("---\n\n")

    # ---------- Proses tiap Bab ----------
    for (nbab, s, e, judul_bab) in BABS:
        if nbab != 2:
            # Bab selain 2: satu file per bab
            fname = f"bab-{nbab}-{slugify(judul_bab)}.md"
            fh = get_handle(fname)
            if file_counts[fname] == 0:
                write_header(fh, f"BAB {nbab}. {judul_bab}",
                             f"Rentang halaman: {s} – {e}")
            _proses_bab(pdf, s, e, fh, file_counts, fname)
        else:
            # Bab 2: deteksi sub-bab dan pecah per sub-bab
            subs = detect_subbab_headings(pdf, s, e, "2")
            # Tambahkan batas akhir = halaman setelah Bab 2
            boundaries = subs + [(e + 1, None, None)]
            for idx, (hal_awal, nomor_sub, judul_sub) in enumerate(subs):
                hal_akhir = boundaries[idx + 1][0] - 1
                label = f"{nomor_sub} {judul_sub}" if judul_sub else nomor_sub
                fname = f"bab2-{nomor_sub.replace('.', '_')}_{slugify(judul_sub)}.md" if judul_sub else f"bab2-{nomor_sub.replace('.', '.')}.md"
                fh = get_handle(fname)
                if file_counts[fname] == 0:
                    write_header(fh, f"Bab 2 – {label}",
                                 f"Rentang halaman: {hal_awal} – {hal_akhir} (dalam BAB 2)")
                _proses_bab(pdf, hal_awal, hal_akhir, fh, file_counts, fname)

    # tutup semua file
    for fh in file_handles.values():
        fh.close()
    pdf.close()

    # ---------- index.md ----------
    # kumpulkan semua file yang tertulis di source
    entries = []
    for fpath in sorted(SRC_DIR.glob("bab-*.md")) + sorted(SRC_DIR.glob("bab2-*.md")):
        # baca baris judul dan rentang halaman
        text = fpath.read_text(encoding="utf-8").splitlines()
        title = text[0].replace("# ", "") if text else fpath.name
        rentang = ""
        for line in text:
            if line.startswith("Rentang halaman:"):
                rentang = line.replace("Rentang halaman:", "").strip()
                break
        # hitung tabel: jumlah baris yang diawali '*Sumber: halaman'
        tabel_count = sum(1 for line in text if line.startswith("*Sumber: halaman"))
        entries.append((title, rentang, tabel_count, fpath.name))

    with open(OUT_DIR / "index.md", "w", encoding="utf-8") as f:
        f.write("# Indeks Data Story – Pemerintahan Daerah DIY 2023\n\n")
        f.write("File ini berisi daftar tabel yang diekstrak dari PDF laporan, dikelompokkan per Bab (Bab 2 dibagi per sub-bab agar file tetap ringan).\n\n")
        f.write("| Grup | Judul | Rentang Halaman | Jumlah Tabel | File Sumber |\n")
        f.write("|------|-------|-----------------|--------------|-------------|\n")
        for title, rentang, tcnt, fname in entries:
            f.write(f"| {title.split(' – ')[0]} | {title} | {rentang} | {tcnt} | `source/{fname}` |\n")
        f.write(f"\n**Total file data:** {len(entries)}\n")
        f.write(f"**Total tabel diekstrak:** {sum(file_counts.values())}\n")

    # ---------- README.md ----------
    with open(OUT_DIR / "README.md", "w", encoding="utf-8") as f:
        f.write("# Data Story – Pemerintahan Daerah DIY 2023\n\n")
        f.write("Folder ini berisi data tabel yang diekstrak dari PDF laporan, siap digunakan sebagai sumber web data story.\n\n")
        f.write("## Struktur\n\n")
        f.write("- `source/` : file Markdown per Bab / sub-bab.\n")
        f.write("- `index.md` : daftar isi dengan jumlah tabel dan file sumber per file.\n\n")
        f.write("## Format tiap tabel\n\n")
        f.write("Setiap tabel diawali catatan sumber (halaman + nomor tabel), diikuti tabel Markdown standar.\n\n")
        f.write("## Pembersihan data\n\n")
        f.write("- Baris kosong sepenuhnya dihapus.\n")
        f.write("- Sel kosong dikosongkan.\n")
        f.write("- Karakter pipe (`|`) di-escape.\n")
        f.write("- Encoding: UTF-8.\n")

    print("SELESAI")
    print(f"Total file: {len(entries)}")
    print(f"Total tabel: {sum(file_counts.values())}")
    for title, rentang, tcnt, fname in sorted(entries, key=lambda x: x[2], reverse=True)[:12]:
        print(f"  {tcnt:5d} tabel | {fname}")

def _proses_bab(pdf, s, e, fh, file_counts, fname):
    global_total = 0
    hal_dgn_tabel = 0
    for i in range(s - 1, e):
        page = pdf.pages[i]
        pno = i + 1
        tables = page.extract_tables() or []
        tabel_di_halaman = 0
        for t_idx, table in enumerate(tables, start=1):
            if is_empty_table(table):
                continue
            md = table_to_md(table, pno, t_idx)
            if md is None:
                continue
            fh.write(md + "\n")
            file_counts[fname] += 1
            global_total += 1
            tabel_di_halaman += 1
        if tabel_di_halaman > 0:
            hal_dgn_tabel += 1

if __name__ == "__main__":
    main()
