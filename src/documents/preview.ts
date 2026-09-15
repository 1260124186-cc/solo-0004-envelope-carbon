import type { Assembly, Finding } from '../assemblies/types'
import type { Calculation } from '../carbon/types'
import type { Material } from '../materials/types'
import type { EnvelopeData } from '../persistence/types'
import { validateAssembly } from '../assemblies/validation'
import { validateMaterial } from '../materials/validation'
import { calculate } from '../carbon/engine'

export const DOCUMENT_CAPACITY = 1000
export const DOCUMENT_CAPACITY_NEAR_LIMIT_SLOTS = 10

export interface FreezeIssue {
  severity: 'error' | 'warning'
  location: string
  text: string
}

export interface FreezePreview {
  assembly: Assembly
  revision: number
  materials: Material[]
  materialNames: Record<string, string>
  result: Calculation | null
  documentCount: number
  capacity: number
  remaining: number
  issues: FreezeIssue[]
  canFinalize: boolean
}

export type FreezePreviewStore = Pick<EnvelopeData, 'materials' | 'documents'>

export function usedMaterialSnapshot(assembly: Assembly, materials: Material[]): Material[] {
  const snapshot: Material[] = []
  const seen = new Set<string>()
  for (const layer of assembly.layers) {
    if (seen.has(layer.materialId)) continue
    const material = materials.find((item) => item.id === layer.materialId)
    if (material) {
      snapshot.push(material)
      seen.add(material.id)
    }
  }
  return snapshot
}

export function findingLocation(assembly: Assembly, finding: Finding): string {
  if (finding.path === 'name') return '构造基本信息 · 构造名称'
  if (finding.path === 'surface') return '构造基本信息 · 建筑部位'
  if (finding.path === 'area') return '构造基本信息 · 构造面积'
  if (finding.path === 'years') return '构造基本信息 · 计算年限'
  if (finding.path === 'carbonLimit') return '构造基本信息 · 碳强度目标'
  if (finding.path === 'thermalLimit') return '构造基本信息 · 传热系数上限'
  if (finding.path === 'note') return '构造基本信息 · 设计说明'
  if (finding.path === 'layers') return '构造层'
  if (finding.path.startsWith('layers.')) {
    const layerId = finding.path.slice('layers.'.length)
    const index = assembly.layers.findIndex((layer) => layer.id === layerId)
    return index < 0 ? '构造层' : `第 ${index + 1} 层`
  }
  return finding.path || '构造参数'
}

export function buildFreezePreview(assembly: Assembly, store: FreezePreviewStore): FreezePreview {
  const issues: FreezeIssue[] = []
  const materials = usedMaterialSnapshot(assembly, store.materials)
  const materialNames = Object.fromEntries(
    store.materials.map((material) => [material.id, material.name]),
  )

  if (assembly.state !== 'editing') {
    issues.push({
      severity: 'error',
      location: '构造状态',
      text: '只有编辑中的构造可以生成定稿；已定稿构造请先重新开启编辑。',
    })
  }
  if (!Number.isInteger(assembly.revision) || assembly.revision < 1) {
    issues.push({
      severity: 'error',
      location: '修订号',
      text: '修订号无效，无法确认将要冻结的版本。',
    })
  }

  for (const finding of validateAssembly(assembly, store.materials)) {
    issues.push({
      severity: 'error',
      location: findingLocation(assembly, finding),
      text: finding.text,
    })
  }

  const layerIndexByMaterial = new Map<string, number>()
  assembly.layers.forEach((layer, index) => {
    if (!layerIndexByMaterial.has(layer.materialId))
      layerIndexByMaterial.set(layer.materialId, index)
  })

  for (const material of materials) {
    const layerIndex = layerIndexByMaterial.get(material.id)
    const location =
      layerIndex === undefined ? `材料物性快照 · ${material.name}` : `第 ${layerIndex + 1} 层`
    for (const text of validateMaterial(material)) {
      issues.push({
        severity: 'error',
        location,
        text: `材料「${material.name}」${text}`,
      })
    }
  }

  const documentCount = store.documents.length
  const remaining = DOCUMENT_CAPACITY - documentCount
  if (remaining <= 0) {
    issues.push({
      severity: 'error',
      location: '浏览器存储 · 计算书容量',
      text: `计算书已达到 ${DOCUMENT_CAPACITY.toLocaleString('zh-CN')} 份容量上限，无法继续定稿。`,
    })
  } else if (remaining <= DOCUMENT_CAPACITY_NEAR_LIMIT_SLOTS) {
    issues.push({
      severity: 'error',
      location: '浏览器存储 · 计算书容量',
      text: `计算书数量接近容量上限：现有 ${documentCount.toLocaleString('zh-CN')} 份，仅剩 ${remaining} 个空位，已阻止本次定稿。`,
    })
  }

  let result: Calculation | null = null
  if (!issues.some((issue) => issue.severity === 'error')) {
    try {
      result = calculate(assembly, store.materials)
    } catch (cause) {
      issues.push({
        severity: 'error',
        location: '计算结果',
        text: cause instanceof Error ? cause.message : '计算失败，请检查构造与材料参数。',
      })
    }
  }

  return {
    assembly,
    revision: assembly.revision,
    materials,
    materialNames,
    result,
    documentCount,
    capacity: DOCUMENT_CAPACITY,
    remaining,
    issues,
    canFinalize: issues.length === 0 && result !== null,
  }
}
