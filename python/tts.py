"""Text-to-speech for ebook files."""

import os
from pathlib import Path
from typing import Optional

from _html_extractor import _TextExtractor

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


def list_voices():
    """List available TTS voices."""
    if pyttsx3 is None:
        raise ImportError("pyttsx3 is required. Install: pip install pyttsx3")

    engine = pyttsx3.init()
    voices = engine.getProperty("voices")
    engine.stop()

    print("\nAvailable voices:")
    for i, voice in enumerate(voices):
        lang = voice.languages[0] if voice.languages else "unknown"
        print(f"  [{i}] {voice.name} ({lang})")
    print()
    return voices


def preview_voice(voice_id: Optional[int] = None, speed: float = 1.0, volume: float = 1.0):
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


def extract_text_from_epub(filepath: str) -> str:
    """Extract all text content from an EPUB file."""
    if ebooklib is None:
        raise ImportError("ebooklib is required. Install: pip install ebooklib")

    book = epub.read_epub(filepath)
    text_parts = []

    for item in book.get_items():
        if item.get_type() == ebooklib.ITEM_DOCUMENT:
            extractor = _TextExtractor()
            content = item.get_content().decode("utf-8", errors="replace")
            extractor.feed(content)
            text_parts.append("".join(extractor.text))

    return "\n\n".join(text_parts)


def extract_text_from_pdf(filepath: str) -> str:
    """Extract text from a PDF file."""
    if fitz is None:
        raise ImportError("PyMuPDF is required. Install: pip install PyMuPDF")

    with fitz.open(filepath) as doc:
        text_parts = []
        for page in doc:
            text_parts.append(page.get_text())
    return "\n\n".join(text_parts)


def text_to_speech(
    text: str,
    output_path: str,
    voice_id: Optional[int] = None,
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
    voice_id: Optional[int] = None,
    speed: float = 1.0,
    volume: float = 1.0,
):
    """Convert an ebook (PDF/EPUB) to an audio file."""
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

    char_count = len(text)
    print(f"  Extracted {char_count:,} characters")
    print(f"  Converting to audio...")

    text_to_speech(text, output_path, voice_id=voice_id, speed=speed, volume=volume)

    print(f"  Audio saved to: {output_path}")
    return output_path
