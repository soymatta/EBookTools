"""Text-to-speech for ebook files (fully offline, local engine only).

Synthesis uses pyttsx3 + OS voices. All extracted text goes through the
clean-text pipeline in ``_html_extractor`` so the engine receives
narration-ready input. No network calls, no servers, no API keys.
"""

import os
from pathlib import Path
from typing import Optional, Union

from _html_extractor import (
    _TextExtractor,
    clean_text_for_tts,
    html_to_text,
)

try:
    import pyttsx3
except ImportError:
    pyttsx3 = None

try:
    import ebooklib
    from ebooklib import epub
except ImportError:
    ebooklib = None

try:
    import fitz  # PyMuPDF
except ImportError:
    fitz = None


def _resolve_voice_id(voice: Union[int, str, None]):
    """Local engine voices are indexed by int; numeric strings accepted."""
    if voice is None:
        return None
    try:
        return int(voice)
    except (TypeError, ValueError):
        return None


def list_voices():
    """List available local TTS voices."""
    if pyttsx3 is None:
        raise ImportError("pyttsx3 is required. Install: pip install pyttsx3")

    os_engine = pyttsx3.init()
    voices = os_engine.getProperty("voices")
    os_engine.stop()

    print("\nAvailable voices:")
    for i, voice in enumerate(voices):
        lang = voice.languages[0] if voice.languages else "unknown"
        print(f"  [{i}] {voice.name} ({lang})")
    print()
    return voices


def preview_voice(voice: Union[int, str, None] = None, speed: float = 1.0,
                  volume: float = 1.0):
    """Preview a local TTS voice with sample text."""
    if pyttsx3 is None:
        raise ImportError("pyttsx3 is required. Install: pip install pyttsx3")

    sample = "Hello! This is a preview of the text to speech voice. You can adjust the speed and volume to your liking."

    os_engine = pyttsx3.init()
    voice_id = _resolve_voice_id(voice)
    if voice_id is not None:
        voices = os_engine.getProperty("voices")
        if 0 <= voice_id < len(voices):
            os_engine.setProperty("voice", voices[voice_id].id)

    os_engine.setProperty("rate", int(200 * speed))
    os_engine.setProperty("volume", volume)

    print(f"  Preview: \"{sample}\"")
    os_engine.say(sample)
    os_engine.runAndWait()
    os_engine.stop()


def _spine_documents(book):
    """Yield EPUB documents in spine (reading) order, skipping nav."""
    if hasattr(book, "spine") and book.spine:
        for idref, _linear in book.spine:
            item = book.get_item_with_id(idref)
            if item is None:
                continue
            if item.get_type() == ebooklib.ITEM_DOCUMENT:
                yield item
    else:  # fallback: every document in manifest order
        for item in book.get_items():
            if item.get_type() == ebooklib.ITEM_DOCUMENT:
                yield item


def _chapter_title(item, fallback: str) -> str:
    raw = html_to_text(item.get_content().decode("utf-8", errors="replace"))
    for line in raw.split("\n"):
        line = line.strip()
        if line:
            return line[:80]
    return fallback


def extract_chapters_from_epub(filepath: str) -> list:
    """Extract [(title, clean_text)] chapters in spine order."""
    if ebooklib is None:
        raise ImportError("ebooklib is required. Install: pip install ebooklib")

    book = epub.read_epub(filepath)
    chapters = []

    for i, item in enumerate(_spine_documents(book)):
        content = item.get_content().decode("utf-8", errors="replace")
        text = clean_text_for_tts(html_to_text(content))
        if text.strip():
            chapters.append((_chapter_title(item, f"Chapter {i + 1}"), text))

    return chapters


def extract_text_from_epub(filepath: str) -> str:
    """Extract all clean text content from an EPUB file (spine order)."""
    chapters = extract_chapters_from_epub(filepath)
    return "\n\n".join(text for _title, text in chapters)


def extract_text_from_pdf(filepath: str) -> str:
    """Extract clean text from a PDF file."""
    if fitz is None:
        raise ImportError("PyMuPDF is required. Install: pip install PyMuPDF")

    with fitz.open(filepath) as doc:
        text_parts = []
        for page in doc:
            text_parts.append(clean_text_for_tts(page.get_text()))
    return "\n\n".join(p for p in text_parts if p.strip())


def text_to_speech(
    text: str,
    output_path: str,
    voice: Union[int, str, None] = None,
    speed: float = 1.0,
    volume: float = 1.0,
):
    """Convert text to an audio file using pyttsx3 (local engine)."""
    if pyttsx3 is None:
        raise ImportError("pyttsx3 is required. Install: pip install pyttsx3")

    engine = pyttsx3.init()
    voice_id = _resolve_voice_id(voice)
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
    voice: Union[int, str, None] = None,
    speed: float = 1.0,
    volume: float = 1.0,
):
    """Convert an ebook (PDF/EPUB) to an audio file. Fully offline."""
    if output_path is None:
        base, _ = os.path.splitext(input_path)
        output_path = f"{base}.wav"

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

    print(f"  Extracted {len(text):,} characters (cleaned)")
    print("  Converting to audio (local engine)...")

    text_to_speech(text, output_path, voice=voice, speed=speed, volume=volume)

    print(f"  Audio saved to: {output_path}")
    return output_path
