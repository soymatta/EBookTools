import { PDFDocument } from "pdf-lib"
import JSZip from "jszip"

export async function epubToPDF(file: File): Promise<Blob> {
  const arrayBuffer = await file.arrayBuffer()
  const zip = await JSZip.loadAsync(arrayBuffer)

  const pdfDoc = await PDFDocument.create()

  // Extract text content from EPUB XHTML files
  const htmlFiles = Object.keys(zip.files).filter(
    (name) =>
      name.endsWith(".xhtml") || name.endsWith(".html") || name.endsWith(".htm")
  )

  for (const htmlFile of htmlFiles) {
    const content = await zip.file(htmlFile)?.async("text")
    if (!content) continue

    const text = extractTextFromHTML(content)
    if (text.trim()) {
      const page = pdfDoc.addPage([595.28, 841.89]) // A4
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
  font: any,
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
  // PDF to EPUB is complex - this is a simplified version
  // that extracts text and creates a basic EPUB
  const arrayBuffer = await file.arrayBuffer()

  // For now, we'll create a placeholder
  // Full implementation would use pdf.js to extract text
  const zip = new JSZip()

  // mimetype
  zip.file("mimetype", "application/epub+zip", { compression: "STORE" })

  // META-INF/container.xml
  zip.file(
    "META-INF/container.xml",
    `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`
  )

  // Basic OPF
  zip.file(
    "OEBPS/content.opf",
    `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:title>Converted from PDF</dc:title>
    <dc:language>en</dc:language>
    <dc:identifier>converted-pdf</dc:identifier>
  </metadata>
  <manifest>
    <item id="chapter1" href="chapter1.xhtml" media-type="application/xhtml+xml"/>
    <item id="toc" href="toc.ncx" media-type="application/x-dtbncx+xml"/>
  </manifest>
  <spine toc="toc">
    <itemref idref="chapter1"/>
  </spine>
</package>`
  )

  // Placeholder content
  zip.file(
    "OEBPS/chapter1.xhtml",
    `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
<head><title>Chapter 1</title></head>
<body>
<h1>Converted from PDF</h1>
<p>Text extraction from PDF requires pdf.js integration. This is a placeholder.</p>
</body>
</html>`
  )

  const content = await zip.generateAsync({ type: "uint8array" })
  return new Blob([content.slice().buffer as ArrayBuffer], { type: "application/epub+zip" })
}
