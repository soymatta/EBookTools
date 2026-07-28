"""Rename badly named ebook files using metadata from free APIs."""

import os
import json
import urllib.request
import urllib.parse
from pathlib import Path

from metadata import get_metadata


def search_openlibrary(query: str) -> dict:
    """Search Open Library for book metadata. No API key required."""
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
    url = f"https://www.googleapis.com/books/v1/volumes?q={urllib.parse.quote(query)}&maxResults=1"
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "EBookTools/1.0"})
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
    for char in r'<>:"/\|?*':
        result = result.replace(char, "")
    return result.strip()


def auto_rename(file_list: list, rename_format: str = "{title} - {author}") -> list:
    """Look up metadata and rename badly named books."""
    results = []

    for i, filepath in enumerate(file_list, 1):
        filename = os.path.basename(filepath)
        print(f"[{i}/{len(file_list)}] Processing: {filename}")

        file_meta = get_metadata(filepath)
        query = " ".join(filter(None, [file_meta.get("title", ""), file_meta.get("author", "")]))

        if not query.strip():
            base = Path(filepath).stem
            query = base.replace("_", " ").replace("-", " ")

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

        print(f"  {filename} -> {new_name}")
        results.append({
            "original": filename,
            "new_name": new_name,
            "metadata": meta,
            "old_path": old_path,
            "new_path": new_path,
        })

    return results
