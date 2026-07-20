import { PDFDocument } from "pdf-lib"
import JSZip from "jszip"

export async function epubToPDF(file: File): Promise<Blob> {
  const arrayBuffer = await file.arrayBuffer()
  const zip = await JSZip.loadAsync(arrayBuffer)

  const pdfDoc = await PDFDocument.create()

  const htmlFiles = Object.keys(zip.files).filter(
    (name) =>
      name.endsWith(".xhtml") || name.endsWith(".html") || name.endsWith(".htm")
  )

  for (const htmlFile of htmlFiles) {
    const content = await zip.file(htmlFile)?.async("text")
    if (!content) continue

    const text = extractTextFromHTML(content)
    if (text.trim()) {
      const page = pdfDoc.addPage([595.28, 841.89])
      const font = await pdfDoc.embedFont("Helvetica")
      const fontSize = 12
      const margin = 50
      const maxWidth = page.getWidth() - margin * 2

      const lines = wrapText(text, font, fontSize, maxWidth)
      let y = page.getHeight() - margin

      for (const line of lines) {
        if (y < margin) {
          const newPage = pdfDoc.addPage([595.28, 841.89])
          y = newPage.getHeight() - margin
          newPage.drawText(line, { x: margin, y, size: fontSize, font })
        } else {
          page.drawText(line, { x: margin, y, size: fontSize, font })
        }
        y -= fontSize * 1.5
      }
    }
  }

  const bytes = await pdfDoc.save()
  return new Blob([bytes.slice().buffer as ArrayBuffer], { type: "application/pdf" })
}

function extractTextFromHTML(html: string): string {
  const parser = new DOMParser()
  const doc = parser.parseFromString(html, "text/html")
  return doc.body?.textContent || ""
}

function wrapText(
  text: string,
  font: Parameters<typeof PDFDocument.prototype.embedFont> extends never
    ? { widthOfTextAtSize: (text: string, size: number) => number }
    : { widthOfTextAtSize: (text: string, size: number) => number },
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
    const pageText = content.items
      .map((item) => ("str" in item ? item.str : ""))
      .join(" ")

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
