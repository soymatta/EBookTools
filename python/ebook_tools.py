#!/usr/bin/env python3
"""
EBookTools - Set of tools for your EBooks and EReaders
All processing happens locally, no external APIs.
"""

import argparse
import os
import sys
import zipfile
import io
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

try:
    from PIL import Image
except ImportError:
    Image = None

try:
    import pyttsx3
except ImportError:
    pyttsx3 = None

try:
    from fpdf import FPDF
except ImportError:
    FPDF = None

try:
    import fitz  # PyMuPDF
except ImportError:
    fitz = None


# ============================================================
# 1. COMPRESS BOOKS
# ============================================================

def compress_pdf(input_path: str, output_path: str = None) -> str:
    """Compress a PDF file losslessly using pikepdf."""
    if pikepdf is None:
        raise ImportError("pikepdf is required. Install: pip install pikepdf")

    if output_path is None:
        base, ext = os.path.splitext(input_path)
        output_path = f"{base}_compressed{ext}"

    with pikepdf.open(input_path) as pdf:
        pdf.save(output_path, compress_streams=True, object_stream_mode=pikepdf.ObjectStreamMode.generate)

    original_size = os.path.getsize(input_path)
    compressed_size = os.path.getsize(output_path)
    reduction = (1 - compressed_size / original_size) * 100
    print(f"  PDF compressed: {original_size:,} -> {compressed_size:,} bytes ({reduction:.1f}% reduction)")
    return output_path


def compress_epub(input_path: str, output_path: str = None) -> str:
    """Compress an EPUB file by repacking with maximum ZIP compression."""
    if output_path is None:
        base, ext = os.path.splitext(input_path)
        output_path = f"{base}_compressed{ext}"

    original_size = os.path.getsize(input_path)

    with zipfile.ZipFile(input_path, "r") as zin:
        with zipfile.ZipFile(output_path, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as zout:
            for item in zin.infolist():
                data = zin.read(item.filename)
                zout.writestr(item, data)

    compressed_size = os.path.getsize(output_path)
    reduction = (1 - compressed_size / original_size) * 100
    print(f"  EPUB compressed: {original_size:,} -> {compressed_size:,} bytes ({reduction:.1f}% reduction)")
    return output_path


def compress_books(file_list: list, output_format: str = "original") -> list:
    """Compress multiple books. Returns list of output paths."""
    results = []

    for i, filepath in enumerate(file_list, 1):
        print(f"[{i}/{len(file_list)}] Compressing: {os.path.basename(filepath)}")
        ext = Path(filepath).suffix.lower()

        try:
            if ext == ".pdf":
                if output_format == "epub":
                    print("  Warning: PDF->EPUB conversion not supported in compress. Keeping PDF.")
                out = compress_pdf(filepath)
            elif ext == ".epub":
                if output_format == "pdf":
                    print("  Warning: EPUB->PDF conversion not supported in compress. Keeping EPUB.")
                out = compress_epub(filepath)
            else:
                print(f"  Skipped: unsupported format {ext}")
                continue
            results.append(out)
        except Exception as e:
            print(f"  Error: {e}")

    return results


# ============================================================
# 2. EBOOK TO VOICE (TTS)
# ============================================================

def preview_voice(voice_id: int = None, speed: float = 1.0, volume: float = 1.0):
    """Preview a TTS voice with sample text."""
    if pyttsx3 is None:
        raise ImportError("pyttsx3 is required. Install: pip install pyttsx3")

    engine = pyttsx3.init()

    if voice_id is not None:
        voices = engine.getProperty("voices")
        if 0 <= voice_id < len(voices):
            engine.setProperty("voice", voices[voice_id].id)

    engine.setProperty("rate", int(200 * speed))
    engine.setProperty("volume", volume)

    sample = "Hello! This is a preview of the text to speech voice. You can adjust the speed and volume to your liking."
    print(f"  Preview: \"{sample}\"")
    engine.say(sample)
    engine.runAndWait()
    engine.stop()


def list_voices():
    """List available TTS voices."""
    if pyttsx3 is None:
        raise ImportError("pyttsx3 is required. Install: pip install pyttsx3")

    engine = pyttsx3.init()
    voices = engine.getProperty("voices")
    engine.stop()

    print("\nAvailable voices:")
    for i, voice in enumerate(voices):
        print(f"  [{i}] {voice.name} ({voice.languages[0] if voice.languages else 'unknown'})")
    print()
    return voices


def extract_text_from_epub(filepath: str) -> str:
    """Extract all text content from an EPUB file."""
    if ebooklib is None:
        raise ImportError("ebooklib is required. Install: pip install ebooklib")

    book = epub.read_epub(filepath)
    text_parts = []

    for item in book.get_items():
        if item.get_type() == ebooklib.ITEM_DOCUMENT:
            from html.parser import HTMLParser

            class TextExtractor(HTMLParser):
                def __init__(self):
                    super().__init__()
                    self.text = []
                    self._skip = False

                def handle_starttag(self, tag, attrs):
                    if tag in ("script", "style"):
                        self._skip = True

                def handle_endtag(self, tag):
                    if tag in ("script", "style"):
                        self._skip = False
                    if tag in ("p", "br", "div", "h1", "h2", "h3", "h4", "h5", "h6"):
                        self.text.append("\n")

                def handle_data(self, data):
                    if not self._skip:
                        self.text.append(data)

            extractor = TextExtractor()
            content = item.get_content().decode("utf-8", errors="replace")
            extractor.feed(content)
            text_parts.append("".join(extractor.text))

    return "\n\n".join(text_parts)


def extract_text_from_pdf(filepath: str) -> str:
    """Extract text from a PDF file."""
    if fitz is None:
        raise ImportError("PyMuPDF is required. Install: pip install PyMuPDF")

    doc = fitz.open(filepath)
    text_parts = []

    for page in doc:
        text_parts.append(page.get_text())

    doc.close()
    return "\n\n".join(text_parts)


def text_to_speech(
    text: str,
    output_path: str,
    voice_id: int = None,
    speed: float = 1.0,
    volume: float = 1.0,
):
    """Convert text to an audio file using pyttsx3."""
    if pyttsx3 is None:
        raise ImportError("pyttsx3 is required. Install: pip install pyttsx3")

    engine = pyttsx3.init()

    if voice_id is not None:
        voices = engine.getProperty("voices")
        if 0 <= voice_id < len(voices):
            engine.setProperty("voice", voices[voice_id].id)

    engine.setProperty("rate", int(200 * speed))
    engine.setProperty("volume", volume)
    engine.save_to_file(text, output_path)
    engine.runAndWait()
    engine.stop()


def ebook_to_audio(
    input_path: str,
    output_path: str = None,
    voice_id: int = None,
    speed: float = 1.0,
    volume: float = 1.0,
):
    """Convert an ebook (PDF/EPUB) to an audio file."""
    if output_path is None:
        base, _ = os.path.splitext(input_path)
        output_path = f"{base}.mp3"

    ext = Path(input_path).suffix.lower()
    print(f"  Extracting text from {ext}...")

    if ext == ".epub":
        text = extract_text_from_epub(input_path)
    elif ext == ".pdf":
        text = extract_text_from_pdf(input_path)
    else:
        raise ValueError(f"Unsupported format: {ext}")

    if not text.strip():
        raise ValueError("No text content found in the file")

    char_count = len(text)
    print(f"  Extracted {char_count:,} characters")
    print(f"  Converting to audio...")

    text_to_speech(text, output_path, voice_id=voice_id, speed=speed, volume=volume)

    print(f"  Audio saved to: {output_path}")
    return output_path


# ============================================================
# 3. EPUB <-> PDF CONVERSION
# ============================================================

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
            from html.parser import HTMLParser

            class SimpleHTMLParser(HTMLParser):
                def __init__(self):
                    super().__init__()
                    self.text = []
                    self._skip = False

                def handle_starttag(self, tag, attrs):
                    if tag in ("script", "style"):
                        self._skip = True

                def handle_endtag(self, tag):
                    if tag in ("script", "style"):
                        self._skip = False
                    if tag in ("p", "br", "div", "h1", "h2", "h3", "h4", "h5", "h6"):
                        self.text.append("\n")

                def handle_data(self, data):
                    if not self._skip:
                        self.text.append(data)

            parser = SimpleHTMLParser()
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

    doc = fitz.open(input_path)

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
            chapter.content = f"<h1>Page {i + 1}</h1><p>{text.replace(chr(10), '</p><p>')}</p>"
            book.add_item(chapter)
            chapters.append(chapter)

    doc.close()

    # Table of contents
    book.toc = [epub.Link(ch.file_name, ch.title, ch.title) for ch in chapters]
    book.add_item(epub.EpubNcx())
    book.add_item(epub.EpubNav())
    book.spine = ["nav"] + chapters

    epub.write_epub(output_path, book)
    print(f"  PDF converted to: {output_path}")
    return output_path


# ============================================================
# 4. METADATA EDITOR
# ============================================================

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
    ns = {"dc": "http://purl.org/dc/elements/1.1/"}

    def get_meta(prop):
        try:
            items = book.get_metadata("DC", prop)
            return str(items[0][0]) if items else ""
        except:
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
        book.add_metadata("DC", "description", metadata["description"])

    epub.write_epub(output_path, book)
    print(f"  Metadata saved to: {output_path}")
    return output_path


# ============================================================
# 5. AUTONAME (BOOK RENAMER)
# ============================================================

def search_openlibrary(query: str) -> dict:
    """Search Open Library for book metadata. No API key required."""
    import urllib.request
    import urllib.parse
    import json

    url = f"https://openlibrary.org/search.json?q={urllib.parse.quote(query)}&fields=title,author_name,first_publish_year,isbn,subject&limit=1"
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "EBookTools/1.0"})
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode())
            if data.get("docs"):
                doc = data["docs"][0]
                return {
                    "title": doc.get("title", ""),
                    "author": doc.get("author_name", [""])[0] if doc.get("author_name") else "",
                    "year": str(doc.get("first_publish_year", "")),
                    "category": doc.get("subject", [""])[0] if doc.get("subject") else "",
                    "isbn": doc.get("isbn", [""])[0] if doc.get("isbn") else "",
                }
    except Exception as e:
        print(f"  Open Library search failed: {e}")
    return {}


def search_google_books(query: str) -> dict:
    """Search Google Books API for book metadata. No API key for basic search."""
    import urllib.request
    import urllib.parse
    import json

    url = f"https://www.googleapis.com/books/v1/volumes?q={urllib.parse.quote(query)}&maxResults=1"
    try:
        req = urllib.request.Request(url)
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode())
            if data.get("items"):
                info = data["items"][0]["volumeInfo"]
                isbn = ""
                for identifier in info.get("industryIdentifiers", []):
                    if identifier["type"] == "ISBN_13":
                        isbn = identifier["identifier"]
                        break
                return {
                    "title": info.get("title", ""),
                    "author": info.get("authors", [""])[0] if info.get("authors") else "",
                    "year": info.get("publishedDate", "")[:4],
                    "category": info.get("categories", [""])[0] if info.get("categories") else "",
                    "isbn": isbn,
                }
    except Exception as e:
        print(f"  Google Books search failed: {e}")
    return {}


def apply_rename_format(template: str, metadata: dict) -> str:
    """Apply a rename template to metadata."""
    result = template
    result = result.replace("{title}", metadata.get("title", "Unknown Title"))
    result = result.replace("{author}", metadata.get("author", "Unknown Author"))
    result = result.replace("{year}", metadata.get("year", "n.d."))
    result = result.replace("{category}", metadata.get("category", "General"))
    result = result.replace("{isbn}", metadata.get("isbn", ""))
    # Sanitize filename
    for char in r'<>:"/\|?*':
        result = result.replace(char, "")
    return result.strip()


def auto_rename(file_list: list, rename_format: str = "{title} - {author}") -> list:
    """Look up metadata and rename badly named books."""
    results = []

    for i, filepath in enumerate(file_list, 1):
        filename = os.path.basename(filepath)
        print(f"[{i}/{len(file_list)}] Processing: {filename}")

        # Extract metadata from file
        file_meta = get_metadata(filepath)
        query = " ".join(filter(None, [file_meta.get("title", ""), file_meta.get("author", "")]))

        if not query.strip():
            # Try to use filename as query
            base = Path(filepath).stem
            query = base.replace("_", " ").replace("-", " ")

        # Search APIs
        print(f"  Searching: {query}")
        meta = search_openlibrary(query)
        if not meta.get("title"):
            meta = search_google_books(query)

        ext = Path(filepath).suffix.lower()

        if meta.get("title") or meta.get("author"):
            new_name = apply_rename_format(rename_format, meta) + ext
        else:
            print(f"  No metadata found, keeping original name")
            new_name = filename

        old_path = filepath
        new_path = os.path.join(os.path.dirname(filepath), new_name)

        print(f"  {filename} → {new_name}")
        results.append({
            "original": filename,
            "new_name": new_name,
            "metadata": meta,
            "old_path": old_path,
            "new_path": new_path,
        })

    return results


# ============================================================
# CLI INTERFACE
# ============================================================

def main():
    parser = argparse.ArgumentParser(
        description="EBookTools - Set of tools for your EBooks and EReaders"
    )
    subparsers = parser.add_subparsers(dest="command", help="Available commands")

    # compress
    compress_parser = subparsers.add_parser("compress", help="Compress ebook files")
    compress_parser.add_argument("files", nargs="+", help="Files to compress")
    compress_parser.add_argument(
        "-o", "--output-format", choices=["original", "pdf", "epub"], default="original"
    )

    # tts
    tts_parser = subparsers.add_parser("tts", help="Convert ebook to audio")
    tts_parser.add_argument("file", help="Ebook file to convert")
    tts_parser.add_argument("-o", "--output", help="Output audio file path")
    tts_parser.add_argument("-v", "--voice", type=int, help="Voice ID (use 'list-voices' to see options)")
    tts_parser.add_argument("-s", "--speed", type=float, default=1.0, help="Speech speed (default: 1.0)")
    tts_parser.add_argument("--volume", type=float, default=1.0, help="Volume (default: 1.0)")

    # list-voices
    subparsers.add_parser("list-voices", help="List available TTS voices")

    # preview-voice
    preview_parser = subparsers.add_parser("preview-voice", help="Preview a TTS voice")
    preview_parser.add_argument("-v", "--voice", type=int, help="Voice ID")
    preview_parser.add_argument("-s", "--speed", type=float, default=1.0)
    preview_parser.add_argument("--volume", type=float, default=1.0)

    # convert
    convert_parser = subparsers.add_parser("convert", help="Convert between EPUB and PDF")
    convert_parser.add_argument("file", help="Input file")
    convert_parser.add_argument(
        "-t", "--to", required=True, choices=["pdf", "epub"], help="Output format"
    )
    convert_parser.add_argument("-o", "--output", help="Output file path")

    # metadata
    meta_parser = subparsers.add_parser("metadata", help="Edit ebook metadata")
    meta_parser.add_argument("file", help="Ebook file")
    meta_parser.add_argument("--get", action="store_true", help="Show current metadata")
    meta_parser.add_argument("--title", help="Set title")
    meta_parser.add_argument("--author", help="Set author")
    meta_parser.add_argument("--description", help="Set description")
    meta_parser.add_argument("--language", help="Set language")
    meta_parser.add_argument("--isbn", help="Set ISBN/identifier")
    meta_parser.add_argument("-o", "--output", help="Output file path")

    # autoname
    autoname_parser = subparsers.add_parser("autoname", help="Rename books using metadata from APIs")
    autoname_parser.add_argument("files", nargs="+", help="Files to rename")
    autoname_parser.add_argument(
        "-f", "--format", default="{title} - {author}",
        help='Rename format (default: "{title} - {author}")'
    )
    autoname_parser.add_argument(
        "--apply", action="store_true", help="Actually rename files (without this, shows preview only)"
    )

    args = parser.parse_args()

    if args.command is None:
        parser.print_help()
        return

    if args.command == "compress":
        results = compress_books(args.files, args.output_format)
        if results:
            print(f"\nDone! {len(results)} file(s) compressed.")

    elif args.command == "tts":
        ebook_to_audio(
            args.file,
            output_path=args.output,
            voice_id=args.voice,
            speed=args.speed,
            volume=args.volume,
        )

    elif args.command == "list-voices":
        list_voices()

    elif args.command == "preview-voice":
        preview_voice(voice_id=args.voice, speed=args.speed, volume=args.volume)

    elif args.command == "convert":
        ext = Path(args.file).suffix.lower()
        if args.to == "pdf" and ext == ".epub":
            epub_to_pdf(args.file, args.output)
        elif args.to == "epub" and ext == ".pdf":
            pdf_to_epub(args.file, args.output)
        else:
            print(f"Error: Cannot convert {ext} to {args.to}")

    elif args.command == "metadata":
        if args.get:
            meta = get_metadata(args.file)
            print("\nCurrent metadata:")
            for key, value in meta.items():
                print(f"  {key}: {value}")
        else:
            updates = {}
            if args.title:
                updates["title"] = args.title
            if args.author:
                updates["author"] = args.author
            if args.description:
                updates["description"] = args.description
            if args.language:
                updates["language"] = args.language
            if args.isbn:
                updates["identifier"] = args.isbn

            if updates:
                set_metadata(args.file, updates, args.output)
            else:
                print("No metadata fields to update. Use --title, --author, etc.")

    elif args.command == "autoname":
        results = auto_rename(args.files, args.format)
        if results:
            print(f"\n{'Preview' if not args.apply else 'Results'}:")
            print("-" * 60)
            for r in results:
                print(f"  {r['original']} → {r['new_name']}")
            print("-" * 60)

            if not args.apply:
                print("\nTo apply these changes, add --apply flag")
            else:
                renamed_count = 0
                for r in results:
                    if r["original"] != r["new_name"]:
                        try:
                            os.rename(r["old_path"], r["new_path"])
                            renamed_count += 1
                        except Exception as e:
                            print(f"  Failed to rename {r['original']}: {e}")
                print(f"\nRenamed {renamed_count} file(s).")


if __name__ == "__main__":
    main()
