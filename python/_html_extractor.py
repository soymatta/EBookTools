"""Shared HTML/XHTML text extraction and TTS-oriented text cleaning.

The extractor follows the book spine order (callers iterate spine items) and
skips non-narrative elements (nav, headers, footers, page-lists) so the
resulting text is clean enough to feed straight into a TTS engine such as
pyttsx3 or a local VoiceStudio server.
"""

import html
import re
from html.parser import HTMLParser


# Elements that never contain narrative text.
SKIP_TAGS = frozenset({
    "script", "style", "nav", "header", "footer", "aside",
    "form", "button", "select", "canvas", "svg", "figure",
    "figcaption", "table",
})

# EPUB 3 structural types (epub:type attribute) to skip. Footnotes/endnotes
# are referenced inline anyway; reading them aloud breaks narration flow.
SKIP_TYPES = frozenset({
    "toc", "page-list", "landmarks", "lot", "loi", "loa", "lov",
    "footnotes", "endnotes", "rearnotes",
})

BLOCK_TAGS = frozenset({
    "p", "br", "div", "h1", "h2", "h3", "h4", "h5", "h6",
    "li", "tr", "blockquote", "section", "article",
})

_URL_RE = re.compile(r"https?://\S+|www\.\S+|[\w.+-]+@[\w-]+\.[\w.]+")
_WS_RE = re.compile(r"\s+")
_PUNCT_RE = re.compile(r"([.!?…]){4,}")
_DASH_RE = re.compile(r"[—–]")
_QUOTE_RE = re.compile(r"[“”]")
_SQUOTE_RE = re.compile(r"[‘’]")
_HYPHEN_BREAK_RE = re.compile(r"(\w)-\n(\w)")
_SENTENCE_SPLIT_RE = re.compile(r"(?<=[.!?…])\s+")


class _TextExtractor(HTMLParser):
    """HTML parser extracting plain text, skipping non-narrative elements."""

    def __init__(self):
        super().__init__()
        self.text = []
        # Tags whose content is currently skipped. A stack (not a counter)
        # because EPUB structural skips (epub:type="footnotes") open on tags
        # that are not in SKIP_TAGS; only the matching close tag may restore
        # normal flow, otherwise the rest of the chapter is lost.
        self._skip_stack = []

    def handle_starttag(self, tag, attrs):
        tag = tag.lower()
        if tag in SKIP_TAGS:
            self._skip_stack.append(tag)
            return
        if self._skip_stack:
            return
        attr_dict = dict(attrs)
        epub_type = (
            attr_dict.get("epub:type")
            or attr_dict.get("{http://www.idpf.org/2007/ops}type")
            or ""
        ).lower()
        if epub_type and epub_type.split()[0] in SKIP_TYPES:
            self._skip_stack.append(tag)

    def handle_endtag(self, tag):
        tag = tag.lower()
        if self._skip_stack:
            if tag == self._skip_stack[-1]:
                self._skip_stack.pop()
            return
        if tag in BLOCK_TAGS:
            self.text.append("\n")

    def handle_data(self, data):
        if not self._skip_stack:
            self.text.append(data)


def html_to_text(content: str) -> str:
    """Extract raw text from an HTML/XHTML fragment."""
    extractor = _TextExtractor()
    extractor.feed(content)
    return "".join(extractor.text)


def clean_text_for_tts(text: str) -> str:
    """Normalize extracted text so a TTS engine reads it naturally.

    - Decodes HTML entities
    - Joins words split by end-of-line hyphens ("read-\ning" -> "reading")
    - Removes URLs and email addresses (spelled out letter by letter otherwise)
    - Normalizes fancy quotes/dashes to ASCII equivalents
    - Drops digit-only lines (page numbers) and collapses whitespace
    """
    text = html.unescape(text)
    text = _QUOTE_RE.sub('"', text)
    text = _SQUOTE_RE.sub("'", text)
    text = _DASH_RE.sub("-", text)
    text = _URL_RE.sub("", text)
    text = _HYPHEN_BREAK_RE.sub(r"\1\2", text)
    # Control characters (except newlines/tabs) confuse some TTS engines.
    text = "".join(ch for ch in text if ch == "\n" or ch == "\t" or ord(ch) >= 32)

    lines = []
    for line in text.split("\n"):
        stripped = _WS_RE.sub(" ", line).strip()
        if not stripped:
            continue
        if re.fullmatch(r"[\d\s\-–—.,]+", stripped):
            continue  # page number / folio line
        lines.append(stripped)

    text = "\n".join(lines)
    text = _PUNCT_RE.sub(r"\1\1\1", text)
    return _WS_RE.sub(" ", text).strip() if "\n" not in text else text.strip()


def chunk_text(text: str, max_chars: int = 3500) -> list:
    """Split text into chunks at sentence boundaries for TTS request limits."""
    text = text.strip()
    if len(text) <= max_chars:
        return [text] if text else []

    sentences = _SENTENCE_SPLIT_RE.split(text)
    chunks = []
    current = []
    current_len = 0

    for sentence in sentences:
        sentence = sentence.strip()
        if not sentence:
            continue
        if current_len + len(sentence) + 1 > max_chars and current:
            chunks.append(" ".join(current))
            current = []
            current_len = 0
        # A single pathological sentence longer than the limit: hard-split it.
        while len(sentence) > max_chars:
            chunks.append(sentence[:max_chars])
            sentence = sentence[max_chars:]
        current.append(sentence)
        current_len += len(sentence) + 1

    if current:
        chunks.append(" ".join(current))
    return chunks
