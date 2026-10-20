/**
 * Clean-text pipeline for TTS input (mirror of python/_html_extractor.py).
 *
 * EPUB/PDF extraction returns raw strings full of artifacts (URLs, page
 * numbers, stray entities, irregular whitespace). Everything fed to a TTS
 * engine — browser speech, pyttsx3 or VoiceStudio — must go through
 * cleanTextForTTS first. Long texts are split with chunkTextForTTS at
 * sentence boundaries (VoiceStudio handles long-form server-side, but
 * chunking keeps browser-voice utterances and per-part downloads sane).
 */

const SKIP_SELECTOR =
  "script, style, nav, header, footer, aside, form, button, select, canvas, svg, figure, figcaption, table";

const SKIP_EPUB_TYPES = new Set([
  "toc",
  "page-list",
  "landmarks",
  "lot",
  "loi",
  "loa",
  "lov",
  "footnotes",
  "endnotes",
  "rearnotes",
]);

/** Extract readable text from an HTML/XHTML string, dropping non-narrative elements. */
export function htmlToCleanText(html: string): string {
  const doc = new DOMParser().parseFromString(html, "text/html");
  doc.querySelectorAll(SKIP_SELECTOR).forEach((el) => el.remove());
  // Drop EPUB structural sections referenced by epub:type (TOC, page lists, notes).
  doc.querySelectorAll("*").forEach((el) => {
    const t = (el.getAttribute("epub:type") || "").toLowerCase().split(" ")[0];
    if (t && SKIP_EPUB_TYPES.has(t)) el.remove();
  });
  return cleanTextForTTS(doc.body?.textContent || "");
}

/** Normalize extracted text so a TTS engine reads it naturally. */
export function cleanTextForTTS(text: string): string {
  let out = text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u2014\u2013]/g, "-")
    // URLs and emails are spelled out letter by letter — drop them.
    .replace(/https?:\/\/\S+|www\.\S+|[\w.+-]+@[\w-]+\.[\w.]+/g, "")
    // Rejoin words split by end-of-line hyphens.
    .replace(/(\w)-\n(\w)/g, "$1$2")
    .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, "");

  const lines: string[] = [];
  for (const line of out.split("\n")) {
    const stripped = line.replace(/\s+/g, " ").trim();
    if (!stripped) continue;
    if (/^[\d\s\-–—.,]+$/.test(stripped)) continue; // page/folio number
    lines.push(stripped);
  }

  out = lines.join("\n").replace(/([.!?…]){4,}/g, "$1$1$1");
  return out.includes("\n") ? out.trim() : out.replace(/\s+/g, " ").trim();
}

/** Split text into chunks at sentence boundaries (default ~3500 chars). */
export function chunkTextForTTS(text: string, maxChars = 3500): string[] {
  const clean = text.trim();
  if (!clean) return [];
  if (clean.length <= maxChars) return [clean];

  const sentences = clean.split(/(?<=[.!?…])\s+/);
  const chunks: string[] = [];
  let current: string[] = [];
  let currentLen = 0;

  const flush = () => {
    if (current.length > 0) {
      chunks.push(current.join(" "));
      current = [];
      currentLen = 0;
    }
  };

  for (let sentence of sentences) {
    sentence = sentence.trim();
    if (!sentence) continue;
    if (currentLen + sentence.length + 1 > maxChars && current.length > 0) flush();
    while (sentence.length > maxChars) {
      chunks.push(sentence.slice(0, maxChars));
      sentence = sentence.slice(maxChars);
    }
    current.push(sentence);
    currentLen += sentence.length + 1;
  }
  flush();
  return chunks;
}

/** True when a chapter holds real narration (not an empty shell). */
export function hasNarrativeText(text: string, minChars = 20): boolean {
  return cleanTextForTTS(text).length >= minChars;
}
