"""EPUB to PDF and PDF to EPUB conversion."""

import os
import html
from pathlib import Path

from _html_extractor import _TextExtractor

try:
    import ebooklib
    from ebooklib import epub
except ImportError:
    ebooklib = None

try:
    from fpdf import FPDF
except ImportError:
    FPDF = None

try:
    import fitz  # PyMuPDF
except ImportError:
    fitz = None


def epub_to_pdf(input_path: str, output_path: str = None) -> str:
    """Convert an EPUB file to PDF."""
    if ebooklib is None:
        raise ImportError("ebooklib is required. Install: pip install ebooklib")
    if FPDF is None:
        raise ImportError("fpdf2 is required. Install: pip install fpdf2")

    if output_path is None:
        base, _ = os.path.splitext(input_path)
        output_path = f"{base}.pdf"

    book = epub.read_epub(input_path)
    pdf = FPDF()
    pdf.set_auto_page_break(auto=True, margin=15)

    for item in book.get_items():
        if item.get_type() == ebooklib.ITEM_DOCUMENT:
            parser = _TextExtractor()
            content = item.get_content().decode("utf-8", errors="replace")
            parser.feed(content)
            page_text = "".join(parser.text).strip()

            if page_text:
                pdf.add_page()
                pdf.set_font("Helvetica", size=12)
                pdf.multi_cell(0, 7, page_text)

    pdf.output(output_path)
    print(f"  EPUB converted to: {output_path}")
    return output_path


def pdf_to_epub(input_path: str, output_path: str = None) -> str:
    """Convert a PDF file to EPUB."""
    if fitz is None:
        raise ImportError("PyMuPDF is required. Install: pip install PyMuPDF")
    if ebooklib is None:
        raise ImportError("ebooklib is required. Install: pip install ebooklib")

    if output_path is None:
        base, _ = os.path.splitext(input_path)
        output_path = f"{base}.epub"

    with fitz.open(input_path) as doc:
        book = epub.EpubBook()
        book.set_identifier("pdf-conversion")
        book.set_title(os.path.splitext(os.path.basename(input_path))[0])
        book.set_language("en")

        chapters = []
        for i, page in enumerate(doc):
            text = page.get_text()
            if text.strip():
                chapter = epub.EpubHtml(
                    title=f"Page {i + 1}",
                    file_name=f"page_{i + 1}.xhtml",
                    lang="en",
                )
                chapter.content = f"<h1>Page {i + 1}</h1><p>{html.escape(text).replace(chr(10), '</p><p>')}</p>"
                book.add_item(chapter)
                chapters.append(chapter)

    book.toc = [epub.Link(ch.file_name, ch.title, ch.title) for ch in chapters]
    book.add_item(epub.EpubNcx())
    book.add_item(epub.EpubNav())
    book.spine = ["nav"] + chapters

    epub.write_epub(output_path, book)
    print(f"  PDF converted to: {output_path}")
    return output_path
