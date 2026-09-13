import type { Material, MaterialKind } from './types'
import { materialFieldOrder, validateMaterialFields, type MaterialField } from './validation'

/** 批量导入中一行清单的解析与校验结果。 */
export interface ImportRowPreview {
  /** 在原始清单中的行号（含表头与空行，从 1 开始）。 */
  line: number
  /** 原始文本，原样保留方便修正。 */
  raw: Record<MaterialField, string>
  name: string
  kind: MaterialKind | null
  density: number | null
  conductivity: number | null
  factor: number | null
  lifespan: number | null
  source: string
  description: string
  /** 按字段组织的问题，空数组表示本行可导入。 */
  issues: { field: MaterialField | 'row'; text: string }[]
  /** 与材料目录或清单内其他行重名时的冲突说明。 */
  conflict: string | null
}

export interface BatchPreview {
  rows: ImportRowPreview[]
  validCount: number
  invalidCount: number
  /** 整批层面的阻断信息（例如超过单次/总容量），与具体行无关。 */
  batchIssues: string[]
}

/** 已通过校验、可直接提交的一行（名称与来源已去除首尾空白）。 */
export interface MaterialDraft {
  name: string
  kind: MaterialKind
  density: number
  conductivity: number
  factor: number
  lifespan: number
  source: string
  description: string
}

const maxImportRows = 500
export const materialCapacity = 500

export const importColumnHelp =
  '每行一种材料，依次填写：材料名称、类别、密度、导热系数、碳因子、参考寿命、参数来源、材料说明。'

export const importHeaderLabels = [
  '名称',
  '类别',
  '密度',
  '导热系数',
  '碳因子',
  '寿命',
  '来源',
  '说明',
]

export const importTemplateRows = [
  ['名称', '类别', '密度', '导热系数', '碳因子', '参考寿命', '参数来源', '材料说明'],
  [
    '挤塑聚苯板',
    '保温材料',
    '35',
    '0.03',
    '5.2',
    '25',
    '教学示例参数 · 挤塑板',
    '演示批量导入，不含表皮与粘结层。',
  ],
  [
    '聚氨酯硬泡',
    '保温材料',
    '40',
    '0.024',
    '4.8',
    '25',
    '教学示例参数 · 聚氨酯',
    '闭孔硬泡演示参数。',
  ],
  [
    '亚麻仁油地面',
    '饰面材料',
    '1100',
    '0.17',
    '1.6',
    '15',
    '教学示例参数 · 地面涂料',
    '按每次整体替换计算。',
  ],
]

const headerKeywords: { field: MaterialField; keys: string[] }[] = [
  { field: 'name', keys: ['名称', '材料名', 'name'] },
  { field: 'kind', keys: ['类别', '类型', 'kind', 'type'] },
  { field: 'density', keys: ['密度', 'density'] },
  { field: 'conductivity', keys: ['导热', 'conductivity'] },
  { field: 'factor', keys: ['碳因子', '碳排', 'factor'] },
  { field: 'lifespan', keys: ['寿命', '年限', 'lifespan', 'life'] },
  { field: 'source', keys: ['来源', '依据', 'source'] },
  { field: 'description', keys: ['说明', '备注', '描述', 'description', 'note', 'remark'] },
]

const kindByLabel = new Map<string, MaterialKind>([
  ['主体材料', 'structure'],
  ['结构材料', 'structure'],
  ['structure', 'structure'],
  ['保温材料', 'insulation'],
  ['保温', 'insulation'],
  ['insulation', 'insulation'],
  ['饰面材料', 'finish'],
  ['饰面', 'finish'],
  ['finish', 'finish'],
])

/** 支持引号包裹的 TSV/CSV 行切分；引号内允许出现分隔符、双引号和换行。 */
function splitRecords(text: string, delimiter: string): string[][] {
  const records: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  let started = false
  const pushCell = () => {
    row.push(cell)
    cell = ''
  }
  const pushRow = () => {
    pushCell()
    records.push(row)
    row = []
    started = false
  }
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    started = true
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"'
          i++
        } else {
          quoted = false
        }
      } else {
        cell += ch
      }
      continue
    }
    if (ch === '"' && cell === '') {
      quoted = true
      continue
    }
    if (ch === delimiter) {
      pushCell()
      continue
    }
    if (ch === '\n') {
      pushRow()
      continue
    }
    if (ch === '\r') {
      if (text[i + 1] === '\n') i++
      pushRow()
      continue
    }
    cell += ch
  }
  if (started || cell !== '' || row.length) pushRow()
  return records
}

function detectDelimiter(text: string): string {
  const sample = text.slice(0, 4000)
  const tabs = (sample.match(/\t/g) ?? []).length
  const commas = (sample.match(/,/g) ?? []).length
  return commas > tabs ? ',' : '\t'
}

function detectColumns(header: string[]): Map<number, MaterialField> | null {
  const map = new Map<number, MaterialField>()
  header.forEach((cell, index) => {
    const normalized = cell.trim().toLocaleLowerCase()
    if (!normalized) return
    const hit = headerKeywords.find(({ keys }) => keys.some((key) => normalized.includes(key)))
    if (hit && !map.has(index) && !Array.from(map.values()).includes(hit.field)) {
      map.set(index, hit.field)
    }
  })
  // 必须识别出名称列且至少两个字段，才认为这是表头而非恰好含关键词的数据行。
  if (map.size < 2 || !Array.from(map.values()).includes('name')) return null
  // 表头中任何单元格都不应是纯数字；物性数据行必然带有数值列，以此避免误吞数据行。
  if (header.some((cell) => cell.trim() !== '' && Number.isFinite(Number(cell.trim())))) return null
  return map
}

function parseNumberCell(raw: string): number | null {
  if (!raw.trim()) return NaN
  const value = Number(raw.trim())
  return Number.isFinite(value) ? value : null
}

const emptyRaw = (): Record<MaterialField, string> => ({
  name: '',
  kind: '',
  density: '',
  conductivity: '',
  factor: '',
  lifespan: '',
  source: '',
  description: '',
})

/**
 * 解析结构化清单并逐行执行与单条表单完全一致的物性校验。
 * 重名检测同时覆盖已有材料目录与清单内部；本函数不产生任何写入。
 */
export function previewImport(text: string, existing: Material[]): BatchPreview {
  const rows: ImportRowPreview[] = []
  const batchIssues: string[] = []
  if (!text.trim()) return { rows, validCount: 0, invalidCount: 0, batchIssues }

  const delimiter = detectDelimiter(text)
  const records = splitRecords(text, delimiter)
  let headerIndex = -1
  let columns: Map<number, MaterialField> | null = null
  const firstContent = records.findIndex((record) => record.some((cell) => cell.trim()))
  if (firstContent >= 0) {
    const detected = detectColumns(records[firstContent])
    if (detected) {
      columns = detected
      headerIndex = firstContent
    }
  }
  const cellAt = (record: string[], field: MaterialField): string => {
    if (columns) {
      for (const [index, mapped] of columns) {
        if (mapped === field) return record[index] ?? ''
      }
      return ''
    }
    return record[materialFieldOrder.indexOf(field)] ?? ''
  }

  let dataRows = 0
  for (let index = 0; index < records.length; index++) {
    if (index === headerIndex) continue
    const record = records[index]
    if (!record.some((cell) => cell.trim())) continue
    const line = index + 1
    dataRows++
    if (dataRows > maxImportRows) {
      batchIssues.push(`单次最多导入 ${maxImportRows} 种材料，请将清单分批后重试。`)
      break
    }
    const raw = emptyRaw()
    materialFieldOrder.forEach((field) => {
      raw[field] = cellAt(record, field)
    })
    const name = raw.name.trim()
    const source = raw.source.trim()
    const description = raw.description.trim()
    const kindLabel = raw.kind.trim()
    const kind = kindByLabel.get(kindLabel.toLocaleLowerCase()) ?? null
    const density = parseNumberCell(raw.density)
    const conductivity = parseNumberCell(raw.conductivity)
    const factor = parseNumberCell(raw.factor)
    const lifespan = parseNumberCell(raw.lifespan)

    const issues: ImportRowPreview['issues'] = []
    if (kindLabel && !kind) {
      issues.push({
        field: 'kind',
        text: `类别“${kindLabel}”无法识别，请填写主体材料、保温材料或饰面材料。`,
      })
    }
    if (raw.density.trim() && density === null) {
      issues.push({ field: 'density', text: '密度需要填写数字。' })
    }
    if (raw.conductivity.trim() && conductivity === null) {
      issues.push({ field: 'conductivity', text: '导热系数需要填写数字。' })
    }
    if (raw.factor.trim() && factor === null) {
      issues.push({ field: 'factor', text: '碳因子需要填写数字。' })
    }
    if (raw.lifespan.trim() && lifespan === null) {
      issues.push({ field: 'lifespan', text: '参考寿命需要填写数字。' })
    }

    // 用占位值补齐无法解析的字段后，仍走标准物性校验；范围、长度等规则与手工表单共用。
    const candidate: Material = {
      id: '',
      name,
      kind: kind ?? 'insulation',
      density: density ?? NaN,
      conductivity: conductivity ?? NaN,
      factor: factor ?? NaN,
      lifespan: lifespan ?? NaN,
      source,
      description,
      custom: true,
    }
    const fields = validateMaterialFields(candidate)
    const parseIssueFields = new Set(issues.map((issue) => issue.field))
    for (const field of materialFieldOrder) {
      // 解析失败时优先展示更具体的解析提示，避免同一字段重复报错。
      if (parseIssueFields.has(field)) continue
      const message = fields[field]
      if (message) issues.push({ field, text: message })
    }

    rows.push({
      line,
      raw,
      name,
      kind,
      density,
      conductivity,
      factor,
      lifespan,
      source,
      description,
      issues,
      conflict: null,
    })
  }

  // 清单内部重名：第一次出现的名称为基准，后续同名行互相标记。
  const firstByName = new Map<string, number>()
  const laterLinesByName = new Map<string, number[]>()
  rows.forEach((row) => {
    if (!row.name) return
    const key = row.name.toLocaleLowerCase()
    if (firstByName.has(key)) {
      laterLinesByName.set(key, [...(laterLinesByName.get(key) ?? []), row.line])
    } else {
      firstByName.set(key, row.line)
    }
  })
  const existingNames = new Set(
    existing.map((material) => material.name.trim().toLocaleLowerCase()),
  )
  for (const row of rows) {
    if (!row.name) continue
    const key = row.name.toLocaleLowerCase()
    const laterLines = laterLinesByName.get(key)
    if (laterLines && firstByName.get(key) === row.line) {
      row.conflict = `清单内名称重复（另见第 ${laterLines.join('、')} 行）。`
    } else if (laterLines) {
      row.conflict = `清单内名称重复（首次出现在第 ${firstByName.get(key)} 行）。`
    } else if (existingNames.has(key)) {
      row.conflict = '材料目录中已有同名材料，不能覆盖，请改用可区分的名称。'
    }
  }

  const validCount = rows.filter((row) => row.issues.length === 0 && !row.conflict).length
  if (existing.length + validCount > materialCapacity) {
    batchIssues.push(
      `导入后材料将达到 ${existing.length + validCount} 种，超过 ${materialCapacity} 种容量上限，请减少清单条目。`,
    )
  }
  return {
    rows,
    validCount,
    invalidCount: rows.length - validCount,
    batchIssues,
  }
}

/** 预览通过后，将行转换为待写入草稿；只接受无问题、无冲突的行。 */
export function toDrafts(rows: ImportRowPreview[]): MaterialDraft[] {
  return rows
    .filter((row) => row.issues.length === 0 && !row.conflict)
    .map((row) => ({
      name: row.name,
      kind: row.kind as MaterialKind,
      density: row.density as number,
      conductivity: row.conductivity as number,
      factor: row.factor as number,
      lifespan: row.lifespan as number,
      source: row.source,
      description: row.description,
    }))
}
