"""Get and set ebook metadata."""

import os
from pathlib import Path

try:
    import pikepdf
except ImportError:
    pikepdf = None

try:
    import ebooklib
    from ebooklib import epub
except ImportError:
    ebooklib = None


def get_metadata(filepath: str) -> dict:
    """Get metadata from an ebook file (PDF or EPUB)."""
    ext = Path(filepath).suffix.lower()

    if ext == ".pdf":
        return get_pdf_metadata(filepath)
    elif ext == ".epub":
        return get_epub_metadata(filepath)
    else:
        raise ValueError(f"Unsupported format: {ext}")


def get_pdf_metadata(filepath: str) -> dict:
    """Get metadata from a PDF file."""
    if pikepdf is None:
        raise ImportError("pikepdf is required. Install: pip install pikepdf")

    with pikepdf.open(filepath) as pdf:
        meta = pdf.docinfo or {}
        return {
            "title": str(meta.get("/Title", "")),
            "author": str(meta.get("/Author", "")),
            "subject": str(meta.get("/Subject", "")),
            "keywords": str(meta.get("/Keywords", "")),
            "creator": str(meta.get("/Creator", "")),
            "producer": str(meta.get("/Producer", "")),
            "date": str(meta.get("/CreationDate", "")),
        }


def get_epub_metadata(filepath: str) -> dict:
    """Get metadata from an EPUB file."""
    if ebooklib is None:
        raise ImportError("ebooklib is required. Install: pip install ebooklib")

    book = epub.read_epub(filepath)

    def get_meta(prop):
        try:
            items = book.get_metadata("DC", prop)
            return str(items[0][0]) if items else ""
        except Exception:
            return ""

    return {
        "title": get_meta("title"),
        "author": get_meta("creator"),
        "language": get_meta("language"),
        "identifier": get_meta("identifier"),
        "description": get_meta("description"),
        "publisher": get_meta("publisher"),
        "date": get_meta("date"),
    }


def set_metadata(filepath: str, metadata: dict, output_path: str = None) -> str:
    """Set metadata for an ebook file."""
    ext = Path(filepath).suffix.lower()

    if ext == ".pdf":
        return set_pdf_metadata(filepath, metadata, output_path)
    elif ext == ".epub":
        return set_epub_metadata(filepath, metadata, output_path)
    else:
        raise ValueError(f"Unsupported format: {ext}")


def set_pdf_metadata(filepath: str, metadata: dict, output_path: str = None) -> str:
    """Set metadata for a PDF file."""
    if pikepdf is None:
        raise ImportError("pikepdf is required. Install: pip install pikepdf")

    if output_path is None:
        base, ext = os.path.splitext(filepath)
        output_path = f"{base}_metadata{ext}"

    with pikepdf.open(filepath) as pdf:
        with pdf.open_metadata() as meta:
            if metadata.get("title"):
                meta["dc:title"] = metadata["title"]
            if metadata.get("author"):
                meta["dc:creator"] = [metadata["author"]]
            if metadata.get("description"):
                meta["dc:description"] = metadata["description"]
            if metadata.get("language"):
                meta["dc:language"] = [metadata["language"]]
            if metadata.get("identifier"):
                meta["dc:identifier"] = metadata["identifier"]

        pdf.save(output_path)

    print(f"  Metadata saved to: {output_path}")
    return output_path


def set_epub_metadata(filepath: str, metadata: dict, output_path: str = None) -> str:
    """Set metadata for an EPUB file."""
    if ebooklib is None:
        raise ImportError("ebooklib is required. Install: pip install ebooklib")

    if output_path is None:
        base, ext = os.path.splitext(filepath)
        output_path = f"{base}_metadata{ext}"

    book = epub.read_epub(filepath)

    if metadata.get("title"):
        book.set_title(metadata["title"])
    if metadata.get("author"):
        book.add_author(metadata["author"])
    if metadata.get("language"):
        book.set_language(metadata["language"])
    if metadata.get("identifier"):
        book.set_identifier(metadata["identifier"])
    if metadata.get("description"):
        existing_descs = [(ns, key, val) for ns, key, val in book.metadata.get_metadata("DC") if key == "description"]
        for ns, key, val in existing_descs:
            book.metadata.remove_metadata("DC", key)
        book.add_metadata("DC", "description", metadata["description"])

    epub.write_epub(output_path, book)
    print(f"  Metadata saved to: {output_path}")
    return output_path
