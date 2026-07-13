import JSZip from "jszip"

export async function compressEPUB(file: File): Promise<Blob> {
  const arrayBuffer = await file.arrayBuffer()
  const zip = await JSZip.loadAsync(arrayBuffer)

  const newZip = new JSZip()

  const files = Object.keys(zip.files)
  for (const filename of files) {
    const zipEntry = zip.files[filename]
    if (zipEntry.dir) continue

    const content = await zipEntry.async("uint8array")
    newZip.file(filename, content, {
      compression: "DEFLATE",
      compressionOptions: { level: 9 },
    })
  }

  const compressed = await newZip.generateAsync({
    type: "uint8array",
    compression: "DEFLATE",
    compressionOptions: { level: 9 },
  })

  return new Blob([compressed.slice().buffer as ArrayBuffer], { type: "application/epub+zip" })
}

export async function getEPUBMetadata(file: File) {
  const arrayBuffer = await file.arrayBuffer()
  const zip = await JSZip.loadAsync(arrayBuffer)

  const opfPath = await findOPFPath(zip)
  if (!opfPath) return null

  const opfContent = await zip.file(opfPath)?.async("text")
  if (!opfContent) return null

  const parser = new DOMParser()
  const doc = parser.parseFromString(opfContent, "application/xml")

  const getMeta = (name: string): string => {
    const el =
      doc.querySelector(`metadata > dc\\:${name}, metadata > ${name}`) ||
      doc.querySelector(`metadata > [name="${name}"]`)
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

async function findOPFPath(zip: JSZip): Promise<string | null> {
  const containerFile = zip.file("META-INF/container.xml")
  if (!containerFile) return null

  const containerText = await containerFile.async("text")
  const parser = new DOMParser()
  const doc = parser.parseFromString(containerText, "application/xml")

  const rootfile = doc.querySelector("rootfile")
  return rootfile?.getAttribute("full-path") || null
}
