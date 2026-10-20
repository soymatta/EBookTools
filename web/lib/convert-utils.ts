import { PDFDocument } from "pdf-lib"
import JSZip from "jszip"
import { getEPUBChapters } from "./epub-parser"

/** pdf-lib standard fonts are WinAnsi: characters outside Latin-1 cannot be drawn. */
function toWinAnsi(text: string): { text: string; dropped: number } {
  let dropped = 0
  let out = ""
  for (const ch of text) {
    const code = ch.codePointAt(0) ?? 0
    if (code === 9 || code === 10) { out += ch; continue }
    if (code === 0x0a || (code >= 0x20 && code <= 0x7e) || (code >= 0xa1 && code <= 0xff)) {
      out += ch
      continue
    }
    if (/\s/.test(ch)) { out += " "; continue }
    dropped++
  }
  return { text: out, dropped }
}

export async function epubToPDF(file: File): Promise<Blob> {
  // Spine order, nav/cover/notes skipped — the same canonical reader the TTS
  // tool uses. Reading the ZIP listing directly produced TOC-first, randomly
  // ordered PDFs.
  const chapters = await getEPUBChapters(file)
  if (chapters.length === 0) {
    throw new Error("No readable chapters found in this EPUB")
  }

  const pdfDoc = await PDFDocument.create()
  const font = await pdfDoc.embedFont("Helvetica")
  const fontSize = 12
  const margin = 50
  const maxWidth = 595.28 - margin * 2

  let droppedChars = 0
  let totalChars = 0

  for (const chapter of chapters) {
    const title = toWinAnsi(chapter.title)
    const sanitized = toWinAnsi(chapter.text)
    droppedChars += sanitized.dropped + title.dropped
    totalChars += chapter.text.length + chapter.title.length
    const heading = title.text.trim()
    const body = sanitized.text.trim()
    if (!heading && !body) continue

    const lines = heading
      ? [heading, "", ...wrapText(body, font, fontSize, maxWidth)]
      : wrapText(body, font, fontSize, maxWidth)
    let page = pdfDoc.addPage([595.28, 841.89])
    let y = page.getHeight() - margin

    for (const line of lines) {
      if (y < margin) {
        page = pdfDoc.addPage([595.28, 841.89])
        y = page.getHeight() - margin
      }
      if (line.trim()) page.drawText(line, { x: margin, y, size: fontSize, font })
      y -= fontSize * 1.5
    }
  }

  if (totalChars > 0 && droppedChars / totalChars > 0.02) {
    throw new Error(
      `This EPUB uses characters outside the Latin-1 range (${droppedChars.toLocaleString()} unsupported characters). ` +
      "The built-in PDF font cannot draw them; convert in a tool with Unicode font embedding."
    )
  }

  const bytes = await pdfDoc.save()
  return new Blob([bytes.slice().buffer as ArrayBuffer], { type: "application/pdf" })
}

function wrapText(
  text: string,
  font: { widthOfTextAtSize: (text: string, size: number) => number },
  fontSize: number,
  maxWidth: number
): string[] {
  const words = text.split(/\s+/)
  const lines: string[] = []
  let currentLine = ""

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word
    const width = font.widthOfTextAtSize(testLine, fontSize)

    if (width > maxWidth && currentLine) {
      lines.push(currentLine)
      currentLine = word
    } else {
      currentLine = testLine
    }
  }

  if (currentLine) lines.push(currentLine)
  return lines
}

export async function pdfToEPUB(file: File): Promise<Blob> {
  const { getDocument } = await import("pdfjs-dist")
  const arrayBuffer = await file.arrayBuffer()
  const pdf = await getDocument({ data: arrayBuffer }).promise

  const zip = new JSZip()

  zip.file("mimetype", "application/epub+zip", { compression: "STORE" })

  zip.file(
    "META-INF/container.xml",
    `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`
  )

  const title = file.name.replace(/\.[^.]+$/, "")
  const chapters: { id: string; title: string; href: string }[] = []

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const content = await page.getTextContent()
    // Keep the PDF's own line breaks (hasEOL) so paragraphs survive; joining
    // every item with a space collapsed each page into one paragraph.
    let pageText = ""
    for (const item of content.items) {
      if (!("str" in item)) continue
      pageText += item.str
      pageText += "hasEOL" in item && item.hasEOL ? "\n" : " "
    }

    if (!pageText.trim()) continue

    const chapterId = `page-${i}`
    const chapterHref = `${chapterId}.xhtml`
    const chapterTitle = `Page ${i}`

    const paragraphs = pageText
      .split(/\n+/)
      .filter((p) => p.trim())
      .map((p) => `<p>${escapeXml(p.trim())}</p>`)
      .join("\n")

    zip.file(
      `OEBPS/${chapterHref}`,
      `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <title>${escapeXml(chapterTitle)}</title>
</head>
<body>
<h1>${escapeXml(chapterTitle)}</h1>
${paragraphs}
</body>
</html>`
    )

    chapters.push({ id: chapterId, title: chapterTitle, href: chapterHref })
  }

  if (chapters.length === 0) {
    const emptyId = "empty"
    const emptyHref = "empty.xhtml"
    zip.file(
      `OEBPS/${emptyHref}`,
      `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
<head><title>Empty</title></head>
<body><p>No text content found in this PDF.</p></body>
</html>`
    )
    chapters.push({ id: emptyId, title: "Empty", href: emptyHref })
  }

  const manifestItems = chapters
    .map((ch) => `    <item id="${ch.id}" href="${ch.href}" media-type="application/xhtml+xml"/>`)
    .join("\n")
  const spineItems = chapters
    .map((ch) => `    <itemref idref="${ch.id}"/>`)
    .join("\n")
  const tocItems = chapters
    .map((ch) => `      <navPoint id="${ch.id}">
        <navLabel><text>${escapeXml(ch.title)}</text></navLabel>
        <content src="${ch.href}"/>
      </navPoint>`)
    .join("\n")

  zip.file(
    "OEBPS/content.opf",
    `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="bookid">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:title>${escapeXml(title)}</dc:title>
    <dc:language>en</dc:language>
    <dc:identifier id="bookid">pdf-conversion-${Date.now()}</dc:identifier>
  </metadata>
  <manifest>
    <item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>
${manifestItems}
  </manifest>
  <spine toc="ncx">
${spineItems}
  </spine>
</package>`
  )

  zip.file(
    "OEBPS/toc.ncx",
    `<?xml version="1.0" encoding="UTF-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
  <head>
    <meta name="dtb:uid" content="pdf-conversion-${Date.now()}"/>
  </head>
  <docTitle><text>${escapeXml(title)}</text></docTitle>
  <navMap>
${tocItems}
  </navMap>
</ncx>`
  )

  const content = await zip.generateAsync({ type: "uint8array" })
  return new Blob([content.slice().buffer as ArrayBuffer], { type: "application/epub+zip" })
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
}
