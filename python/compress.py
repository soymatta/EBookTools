"""Compress PDF and EPUB files."""

import os
import zipfile
import re
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

COMPRESSION_LEVELS = {
    "light": {"label": "Light", "description": "Fastest. Removes duplicate objects. ~5-10% smaller.", "zip_level": 1, "objects_per_tick": 100},
    "normal": {"label": "Normal", "description": "Balanced. Rebuilds object streams. ~15-30% smaller.", "zip_level": 6, "objects_per_tick": 50},
    "strong": {"label": "Strong", "description": "Maximum compression. Slowest. ~20-40% smaller.", "zip_level": 9, "objects_per_tick": 10},
}


def compress_pdf(input_path: str, output_path: str = None, level: str = "normal") -> str:
    """Compress a PDF file losslessly using pikepdf."""
    if pikepdf is None:
        raise ImportError("pikepdf is required. Install: pip install pikepdf")

    if output_path is None:
        base, ext = os.path.splitext(input_path)
        output_path = f"{base}_compressed{ext}"

    config = COMPRESSION_LEVELS.get(level, COMPRESSION_LEVELS["normal"])

    with pikepdf.open(input_path) as pdf:
        if level == "light":
            pdf.save(output_path, compress_streams=True)
        elif level == "strong":
            pdf.save(output_path, compress_streams=True, object_stream_mode=pikepdf.ObjectStreamMode.generate, recompress_flate=True)
        else:
            pdf.save(output_path, compress_streams=True, object_stream_mode=pikepdf.ObjectStreamMode.generate)

    original_size = os.path.getsize(input_path)
    compressed_size = os.path.getsize(output_path)
    reduction = (1 - compressed_size / original_size) * 100
    print(f"  PDF compressed ({level}): {original_size:,} -> {compressed_size:,} bytes ({reduction:.1f}% reduction)")
    return output_path


def compress_epub(input_path: str, output_path: str = None, level: str = "normal") -> str:
    """Compress an EPUB file by removing junk and repacking with better compression."""
    if output_path is None:
        base, ext = os.path.splitext(input_path)
        output_path = f"{base}_compressed{ext}"

    config = COMPRESSION_LEVELS.get(level, COMPRESSION_LEVELS["normal"])
    original_size = os.path.getsize(input_path)

    junk_pattern = re.compile(r"(^\.|Thumbs\.db|desktop\.ini|__MACOSX|\.DS_Store)", re.IGNORECASE)

    with zipfile.ZipFile(input_path, "r") as zin:
        with zipfile.ZipFile(output_path, "w", zipfile.ZIP_DEFLATED, compresslevel=config["zip_level"]) as zout:
            removed = 0
            for item in zin.infolist():
                if junk_pattern.search(item.filename):
                    removed += 1
                    continue
                data = zin.read(item.filename)
                zout.writestr(item, data)

    compressed_size = os.path.getsize(output_path)
    reduction = (1 - compressed_size / original_size) * 100
    print(f"  EPUB compressed ({level}): {original_size:,} -> {compressed_size:,} bytes ({reduction:.1f}% reduction)")
    if removed:
        print(f"  Removed {removed} junk file(s)")
    return output_path


def compress_books(file_list: list, output_format: str = "original", level: str = "normal") -> list:
    """Compress multiple books. Returns list of output paths."""
    results = []

    for i, filepath in enumerate(file_list, 1):
        print(f"[{i}/{len(file_list)}] Compressing: {os.path.basename(filepath)}")
        ext = Path(filepath).suffix.lower()

        try:
            if ext == ".pdf":
                if output_format == "epub":
                    print("  Warning: PDF->EPUB conversion not supported in compress. Keeping PDF.")
                out = compress_pdf(filepath, level=level)
            elif ext == ".epub":
                if output_format == "pdf":
                    print("  Warning: EPUB->PDF conversion not supported in compress. Keeping EPUB.")
                out = compress_epub(filepath, level=level)
            else:
                print(f"  Skipped: unsupported format {ext}")
                continue
            results.append(out)
        except Exception as e:
            print(f"  Error: {e}")

    return results
