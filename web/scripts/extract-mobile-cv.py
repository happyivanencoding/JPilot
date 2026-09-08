"""Extract an uploaded CV locally. No OCR, network, macros or fact invention."""
from pathlib import Path
import sys
import zipfile
import xml.etree.ElementTree as ET


def extract(file: Path) -> str:
    suffix = file.suffix.lower()
    if file.stat().st_size > 12 * 1024 * 1024:
        raise ValueError("Document trop volumineux (12 Mo maximum).")
    if suffix in {".txt", ".md"}:
        text = file.read_text(encoding="utf-8-sig")
    elif suffix == ".docx":
        with zipfile.ZipFile(file) as archive:
            if sum(x.file_size for x in archive.infolist()) > 64 * 1024 * 1024:
                raise ValueError("Document Word décompressé trop volumineux.")
            parts = ["word/document.xml"] + sorted(
                n for n in archive.namelist()
                if n.startswith(("word/header", "word/footer")) and n.endswith(".xml")
            )
            ns = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}
            paragraphs = []
            for part in parts:
                root = ET.fromstring(archive.read(part))
                for paragraph in root.findall(".//w:p", ns):
                    line = "".join(t.text or "" for t in paragraph.findall(".//w:t", ns))
                    if line.strip():
                        paragraphs.append(line)
            text = "\n".join(paragraphs)
    elif suffix == ".pdf":
        try:
            import fitz
        except ImportError as exc:
            raise ValueError("Installer PyMuPDF dans le Python du serveur pour lire les PDF.") from exc
        with fitz.open(file) as doc:
            if doc.needs_pass:
                raise ValueError("PDF protégé : exporter une copie sans mot de passe.")
            if len(doc) > 50:
                raise ValueError("Le CV dépasse 50 pages.")
            text = "\n".join(page.get_text(sort=True) for page in doc)
    else:
        raise ValueError("Formats acceptés : PDF, DOCX, TXT et Markdown.")
    text = text.replace("\x00", "").strip()
    if len(text) < 30:
        raise ValueError("Aucun texte lisible. Pour un PDF scanné, exporter une version contenant du texte.")
    if len(text.encode("utf-8")) > 200_000:
        raise ValueError("Le texte du CV dépasse 200 Ko.")
    return text


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")
    try:
        print(extract(Path(sys.argv[1])))
    except Exception as error:
        print(str(error), file=sys.stderr)
        sys.exit(1)
