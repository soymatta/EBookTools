import JSZip from "jszip"

export interface EPUBChapter {
  id: string
  title: string
  href: string
  text: string
}

export async function findOPFPath(zip: JSZip): Promise<string | null> {
  const containerFile = zip.file("META-INF/container.xml")
  if (!containerFile) return null

  const containerText = await containerFile.async("text")
  const parser = new DOMParser()
  const doc = parser.parseFromString(containerText, "application/xml")

  const rootfile = doc.querySelector("rootfile")
  return rootfile?.getAttribute("full-path") || null
}

export async function getEPUBChapters(file: File): Promise<EPUBChapter[]> {
  const buffer = await file.arrayBuffer()
  const zip = await JSZip.loadAsync(buffer)

  const opfPath = await findOPFPath(zip)
  if (!opfPath) return []

  const opfFile = zip.file(opfPath)
  if (!opfFile) return []

  const opfText = await opfFile.async("text")
  const parser = new DOMParser()
  const opfDoc = parser.parseFromString(opfText, "application/xml")

  const opfDir = opfPath.split("/").slice(0, -1).join("/")

  const spineItems = opfDoc.querySelectorAll("spine > itemref")
  const manifestMap = new Map<string, string>()
  opfDoc.querySelectorAll("manifest > item").forEach(item => {
    const id = item.getAttribute("id")
    const href = item.getAttribute("href")
    if (id && href) manifestMap.set(id, href)
  })

  const chapters: EPUBChapter[] = []
  let index = 0

  for (const spineItem of Array.from(spineItems)) {
    const idref = spineItem.getAttribute("idref")
    if (!idref) continue

    const href = manifestMap.get(idref)
    if (!href) continue

    const filePath = opfDir ? `${opfDir}/${href}` : href
    const contentFile = zip.file(filePath)
    if (!contentFile) continue

    const html = await contentFile.async("text")
    const htmlDoc = parser.parseFromString(html, "text/html")
    const text = htmlDoc.body?.textContent || ""

    if (text.trim()) {
      const title = htmlDoc.querySelector("title")?.textContent || `Chapter ${index + 1}`
      chapters.push({
        id: idref,
        title,
        href: filePath,
        text: text.trim(),
      })
      index++
    }
  }

  return chapters
}

export async function extractEPUBMetadata(file: File) {
  const buffer = await file.arrayBuffer()
  const zip = await JSZip.loadAsync(buffer)

  const opfPath = await findOPFPath(zip)
  if (!opfPath) return null

  const opfContent = await zip.file(opfPath)?.async("text")
  if (!opfContent) return null

  const parser = new DOMParser()
  const doc = parser.parseFromString(opfContent, "application/xml")

  const getMeta = (name: string): string => {
    const el = doc.querySelector(`metadata > dc\\:${name}, metadata > ${name}`)
    return el?.textContent || ""
  }

  return {
    title: getMeta("title"),
    creator: getMeta("creator"),
    language: getMeta("language"),
    identifier: getMeta("identifier"),
    description: getMeta("description"),
    publisher: getMeta("publisher"),
    date: getMeta("date"),
  }
}

export async function extractEPUBText(file: File): Promise<string> {
  const chapters = await getEPUBChapters(file)
  return chapters.map(ch => ch.text).join("\n\n")
}
