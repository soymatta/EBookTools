"""Rename badly named ebook files using embedded metadata (fully offline).

Uses only the title/author already stored inside the EPUB/PDF — no API
lookups, no network. Files without usable embedded metadata keep their
original name (reported, not renamed).
"""

import os
from pathlib import Path

from metadata import get_metadata


def apply_rename_format(template: str, metadata: dict) -> str:
    """Apply a rename template to metadata."""
    result = template
    result = result.replace("{title}", metadata.get("title", "Unknown Title"))
    result = result.replace("{author}", metadata.get("author", "Unknown Author"))
    result = result.replace("{year}", metadata.get("year", "n.d."))
    result = result.replace("{category}", metadata.get("category", "General"))
    result = result.replace("{isbn}", metadata.get("isbn", ""))
    for char in r'<>:"/\|?*':
        result = result.replace(char, "")
    return result.strip()


def _embedded_lookup(filepath: str) -> dict:
    """Read whatever metadata the file already carries."""
    try:
        file_meta = get_metadata(filepath)
    except Exception as e:
        print(f"  Could not read metadata: {e}")
        return {}

    meta = {}
    title = (file_meta.get("title") or "").strip()
    author = (file_meta.get("author") or "").strip()
    if title:
        meta["title"] = title
    if author:
        meta["author"] = author
    for key in ("year", "date"):
        value = (file_meta.get(key) or "").strip()
        if value:
            meta["year"] = value[:4]
            break
    for key in ("category", "subject"):
        value = (file_meta.get(key) or "").strip()
        if value:
            meta["category"] = value
            break
    isbn = (file_meta.get("identifier") or file_meta.get("isbn") or "").strip()
    if isbn:
        meta["isbn"] = isbn
    return meta


def auto_rename(file_list: list, rename_format: str = "{title} - {author}") -> list:
    """Rename books from their embedded metadata. Returns result dicts."""
    results = []

    for i, filepath in enumerate(file_list, 1):
        filename = os.path.basename(filepath)
        print(f"[{i}/{len(file_list)}] Processing: {filename}")

        meta = _embedded_lookup(filepath)
        ext = Path(filepath).suffix.lower()

        if meta.get("title") or meta.get("author"):
            new_name = apply_rename_format(rename_format, meta) + ext
        else:
            print("  No embedded metadata found, keeping original name")
            new_name = filename

        old_path = filepath
        new_path = os.path.join(os.path.dirname(filepath), new_name)

        print(f"  {filename} -> {new_name}")
        results.append({
            "original": filename,
            "new_name": new_name,
            "metadata": meta,
            "old_path": old_path,
            "new_path": new_path,
        })

    return results
