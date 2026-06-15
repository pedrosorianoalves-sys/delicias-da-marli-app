export type ExportCell = string | number | boolean | null | undefined

export type ExportSection = {
  title: string
  headers: string[]
  rows: ExportCell[][]
}

function sanitizeFileName(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9-_]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
}

function todayStamp() {
  return new Date().toISOString().slice(0, 10)
}

export function buildExportFileName(prefix: string, extension: string) {
  return `${sanitizeFileName(prefix)}-${todayStamp()}.${extension}`
}

function cellToString(cell: ExportCell) {
  if (cell === null || cell === undefined) return ''
  return String(cell)
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

function csvEscape(value: ExportCell) {
  const text = cellToString(value)
  return `"${text.replace(/"/g, '""')}"`
}

export function downloadCsv(title: string, sections: ExportSection[]) {
  const lines = sections.flatMap((section, index) => [
    ...(index === 0 ? [] : ['']),
    section.title,
    section.headers.map(csvEscape).join(';'),
    ...section.rows.map((row) => row.map(csvEscape).join(';')),
  ])

  downloadBlob(
    new Blob([`\uFEFF${lines.join('\r\n')}`], {
      type: 'text/csv;charset=utf-8',
    }),
    buildExportFileName(title, 'csv'),
  )
}

function xmlEscape(value: ExportCell) {
  return cellToString(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function columnName(index: number) {
  let name = ''
  let current = index + 1

  while (current > 0) {
    const remainder = (current - 1) % 26
    name = String.fromCharCode(65 + remainder) + name
    current = Math.floor((current - 1) / 26)
  }

  return name
}

function worksheetXml(section: ExportSection) {
  const rows = [
    [section.title],
    [],
    section.headers,
    ...section.rows,
  ]

  const xmlRows = rows
    .map((row, rowIndex) => {
      const rowNumber = rowIndex + 1
      const cells = row
        .map((cell, cellIndex) => {
          const ref = `${columnName(cellIndex)}${rowNumber}`
          return `<c r="${ref}" t="inlineStr"><is><t>${xmlEscape(cell)}</t></is></c>`
        })
        .join('')

      return `<row r="${rowNumber}">${cells}</row>`
    })
    .join('')

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${xmlRows}</sheetData></worksheet>`
}

function workbookXml(sections: ExportSection[]) {
  const sheets = sections
    .map(
      (section, index) =>
        `<sheet name="${xmlEscape(section.title).slice(0, 31)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`,
    )
    .join('')

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheets}</sheets></workbook>`
}

function workbookRelsXml(sections: ExportSection[]) {
  const worksheetRels = sections
    .map(
      (_, index) =>
        `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`,
    )
    .join('')

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${worksheetRels}</Relationships>`
}

function rootRelsXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`
}

function contentTypesXml(sections: ExportSection[]) {
  const sheets = sections
    .map(
      (_, index) =>
        `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`,
    )
    .join('')

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${sheets}</Types>`
}

function makeCrcTable() {
  return Array.from({ length: 256 }, (_, index) => {
    let c = index
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    }
    return c >>> 0
  })
}

const CRC_TABLE = makeCrcTable()

function crc32(bytes: Uint8Array) {
  let crc = 0xffffffff
  for (const byte of bytes) {
    crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8)
  }
  return (crc ^ 0xffffffff) >>> 0
}

function writeUint16(bytes: number[], value: number) {
  bytes.push(value & 0xff, (value >>> 8) & 0xff)
}

function writeUint32(bytes: number[], value: number) {
  bytes.push(
    value & 0xff,
    (value >>> 8) & 0xff,
    (value >>> 16) & 0xff,
    (value >>> 24) & 0xff,
  )
}

function textBytes(value: string) {
  return new TextEncoder().encode(value)
}

function createZip(files: { name: string; content: string }[]) {
  const output: number[] = []
  const centralDirectory: number[] = []

  for (const file of files) {
    const nameBytes = textBytes(file.name)
    const data = textBytes(file.content)
    const crc = crc32(data)
    const offset = output.length

    writeUint32(output, 0x04034b50)
    writeUint16(output, 20)
    writeUint16(output, 0)
    writeUint16(output, 0)
    writeUint16(output, 0)
    writeUint16(output, 0)
    writeUint32(output, crc)
    writeUint32(output, data.length)
    writeUint32(output, data.length)
    writeUint16(output, nameBytes.length)
    writeUint16(output, 0)
    output.push(...nameBytes, ...data)

    writeUint32(centralDirectory, 0x02014b50)
    writeUint16(centralDirectory, 20)
    writeUint16(centralDirectory, 20)
    writeUint16(centralDirectory, 0)
    writeUint16(centralDirectory, 0)
    writeUint16(centralDirectory, 0)
    writeUint16(centralDirectory, 0)
    writeUint32(centralDirectory, crc)
    writeUint32(centralDirectory, data.length)
    writeUint32(centralDirectory, data.length)
    writeUint16(centralDirectory, nameBytes.length)
    writeUint16(centralDirectory, 0)
    writeUint16(centralDirectory, 0)
    writeUint16(centralDirectory, 0)
    writeUint16(centralDirectory, 0)
    writeUint32(centralDirectory, 0)
    writeUint32(centralDirectory, offset)
    centralDirectory.push(...nameBytes)
  }

  const centralDirectoryOffset = output.length
  output.push(...centralDirectory)
  writeUint32(output, 0x06054b50)
  writeUint16(output, 0)
  writeUint16(output, 0)
  writeUint16(output, files.length)
  writeUint16(output, files.length)
  writeUint32(output, centralDirectory.length)
  writeUint32(output, centralDirectoryOffset)
  writeUint16(output, 0)

  return new Uint8Array(output)
}

export function downloadXlsx(title: string, sections: ExportSection[]) {
  const safeSections = sections.length > 0 ? sections : [{ title, headers: [], rows: [] }]
  const files = [
    { name: '[Content_Types].xml', content: contentTypesXml(safeSections) },
    { name: '_rels/.rels', content: rootRelsXml() },
    { name: 'xl/workbook.xml', content: workbookXml(safeSections) },
    { name: 'xl/_rels/workbook.xml.rels', content: workbookRelsXml(safeSections) },
    ...safeSections.map((section, index) => ({
      name: `xl/worksheets/sheet${index + 1}.xml`,
      content: worksheetXml(section),
    })),
  ]

  downloadBlob(
    new Blob([createZip(files)], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    }),
    buildExportFileName(title, 'xlsx'),
  )
}

function pdfEscape(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\x20-\x7e]/g, ' ')
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
}

function truncate(value: string, maxLength: number) {
  return value.length > maxLength ? `${value.slice(0, maxLength - 1)}…` : value
}

function pdfLines(title: string, sections: ExportSection[]) {
  const lines = [title, `Gerado em ${new Date().toLocaleString('pt-BR')}`, '']

  for (const section of sections) {
    lines.push(section.title, section.headers.join(' | '))

    if (section.rows.length === 0) {
      lines.push('Nenhum dado.')
    } else {
      lines.push(
        ...section.rows.map((row) =>
          truncate(row.map((cell) => cellToString(cell)).join(' | '), 115),
        ),
      )
    }

    lines.push('')
  }

  return lines
}

export function downloadPdf(title: string, sections: ExportSection[]) {
  const lines = pdfLines(title, sections)
  const linesPerPage = 42
  const pageChunks = Array.from(
    { length: Math.ceil(lines.length / linesPerPage) || 1 },
    (_, index) => lines.slice(index * linesPerPage, (index + 1) * linesPerPage),
  )

  const objects: string[] = []
  const addObject = (content: string) => {
    objects.push(content)
    return objects.length
  }

  const pagesObjectId = 2
  const fontObjectId = 3
  const pageObjectIds: number[] = []
  const contentObjectIds: number[] = []

  addObject('<< /Type /Catalog /Pages 2 0 R >>')
  addObject('PLACEHOLDER_PAGES')
  addObject('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>')

  pageChunks.forEach((chunk) => {
    const commands = [
      'BT',
      '/F1 11 Tf',
      '50 800 Td',
      ...chunk.flatMap((line, index) => [
        index === 0 ? '' : '0 -17 Td',
        `(${pdfEscape(line)}) Tj`,
      ]),
      'ET',
    ]
      .filter(Boolean)
      .join('\n')

    const contentId = addObject(
      `<< /Length ${commands.length} >>\nstream\n${commands}\nendstream`,
    )
    const pageId = addObject(
      `<< /Type /Page /Parent ${pagesObjectId} 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 ${fontObjectId} 0 R >> >> /Contents ${contentId} 0 R >>`,
    )

    contentObjectIds.push(contentId)
    pageObjectIds.push(pageId)
  })

  objects[pagesObjectId - 1] =
    `<< /Type /Pages /Kids [${pageObjectIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pageObjectIds.length} >>`

  const chunks = ['%PDF-1.4\n']
  const offsets = [0]

  objects.forEach((object, index) => {
    offsets.push(chunks.join('').length)
    chunks.push(`${index + 1} 0 obj\n${object}\nendobj\n`)
  })

  const xrefOffset = chunks.join('').length
  chunks.push(`xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`)
  offsets.slice(1).forEach((offset) => {
    chunks.push(`${String(offset).padStart(10, '0')} 00000 n \n`)
  })
  chunks.push(
    `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`,
  )

  downloadBlob(
    new Blob([chunks.join('')], { type: 'application/pdf' }),
    buildExportFileName(title, 'pdf'),
  )
}
