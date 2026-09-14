import type { Assembly } from '../assemblies/types'
import { surfaceLabels } from '../assemblies/types'
import type { Material } from '../materials/types'
import { number } from '../shared/format'

export interface LineageNode {
  assembly: Assembly
  source: Assembly | null
  sourceNote: string | null
  children: LineageNode[]
  differences: string[]
  descendants: number
}

function materialName(materials: Material[], id: string): string {
  return materials.find((material) => material.id === id)?.name ?? '未收录材料'
}

export function describeDifferences(
  source: Assembly,
  derived: Assembly,
  materials: Material[],
): string[] {
  const differences: string[] = []
  if (source.surface !== derived.surface) {
    differences.push(
      `建筑部位由「${surfaceLabels[source.surface]}」改为「${surfaceLabels[derived.surface]}」。`,
    )
  }
  if (source.area !== derived.area) {
    differences.push(
      `构造面积由 ${number(source.area)} 平方米改为 ${number(derived.area)} 平方米。`,
    )
  }
  if (source.years !== derived.years) {
    differences.push(`计算年限由 ${source.years} 年改为 ${derived.years} 年。`)
  }
  if (source.carbonLimit !== derived.carbonLimit) {
    differences.push(
      `碳强度目标由 ${number(source.carbonLimit)} 改为 ${number(derived.carbonLimit)} 千克当量/平方米。`,
    )
  }
  if (source.thermalLimit !== derived.thermalLimit) {
    differences.push(
      `传热系数上限由 ${number(source.thermalLimit)} 改为 ${number(derived.thermalLimit)}。`,
    )
  }
  const total = Math.max(source.layers.length, derived.layers.length)
  for (let index = 0; index < total; index += 1) {
    const before = source.layers[index]
    const after = derived.layers[index]
    const label = `第 ${index + 1} 层`
    if (before && !after) {
      differences.push(`${label}「${materialName(materials, before.materialId)}」已移除。`)
      continue
    }
    if (!before && after) {
      differences.push(
        `新增${label}：「${materialName(materials, after.materialId)}」，厚度 ${number(after.thickness)} 毫米。`,
      )
      continue
    }
    if (before.materialId !== after.materialId) {
      differences.push(
        `${label}材料由「${materialName(materials, before.materialId)}」更换为「${materialName(materials, after.materialId)}」。`,
      )
    }
    if (before.thickness !== after.thickness) {
      differences.push(
        `${label}厚度由 ${number(before.thickness)} 改为 ${number(after.thickness)} 毫米。`,
      )
    }
    if (before.loss !== after.loss) {
      differences.push(`${label}损耗率由 ${number(before.loss)}% 改为 ${number(after.loss)}%。`)
    }
    if (before.lifespan !== after.lifespan) {
      differences.push(`${label}替换寿命由 ${before.lifespan} 年改为 ${after.lifespan} 年。`)
    }
  }
  return differences
}

function cyclicIds(assemblies: Assembly[]): Set<string> {
  const byId = new Map(assemblies.map((item) => [item.id, item]))
  const state = new Map<string, 'visiting' | 'done'>()
  const cyclic = new Set<string>()
  for (const assembly of assemblies) {
    const path: string[] = []
    let cursor: Assembly | undefined = assembly
    while (cursor && !state.has(cursor.id)) {
      state.set(cursor.id, 'visiting')
      path.push(cursor.id)
      const originId: string | undefined = cursor.origin?.id
      cursor = originId === undefined ? undefined : byId.get(originId)
    }
    if (cursor && state.get(cursor.id) === 'visiting') {
      const start = path.indexOf(cursor.id)
      for (const id of path.slice(start)) cyclic.add(id)
    }
    for (const id of path) state.set(id, 'done')
  }
  return cyclic
}

export function buildForest(assemblies: Assembly[], materials: Material[]): LineageNode[] {
  const byId = new Map(assemblies.map((item) => [item.id, item]))
  const cyclic = cyclicIds(assemblies)
  const nodes = new Map<string, LineageNode>()
  for (const assembly of assemblies) {
    let source: Assembly | null = null
    let sourceNote: string | null = null
    if (assembly.origin) {
      if (cyclic.has(assembly.id)) {
        sourceNote = '来源记录形成循环，按基准构造展示'
      } else {
        source = byId.get(assembly.origin.id) ?? null
        if (!source) sourceNote = '来源构造已不在当前设计中'
      }
    }
    nodes.set(assembly.id, {
      assembly,
      source,
      sourceNote,
      children: [],
      differences: source ? describeDifferences(source, assembly, materials) : [],
      descendants: 0,
    })
  }
  const roots: LineageNode[] = []
  for (const node of nodes.values()) {
    const parent = node.source ? nodes.get(node.source.id) : undefined
    if (parent) parent.children.push(node)
    else roots.push(node)
  }
  const count = (node: LineageNode): number => {
    node.descendants = node.children.reduce((sum, child) => sum + count(child), 0)
    return node.descendants + 1
  }
  for (const root of roots) count(root)
  return roots
}

export function findNode(roots: LineageNode[], id: string): LineageNode | null {
  for (const root of roots) {
    if (root.assembly.id === id) return root
    const found = findNode(root.children, id)
    if (found) return found
  }
  return null
}

export function findRoot(roots: LineageNode[], id: string): LineageNode | null {
  for (const root of roots) {
    if (findNode([root], id)) return root
  }
  return null
}

export function collectDescendants(node: LineageNode): LineageNode[] {
  return node.children.flatMap((child) => [child, ...collectDescendants(child)])
}
