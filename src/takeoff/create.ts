import type { Assembly } from '../assemblies/types'
import type { Material } from '../materials/types'
import type {
  AssemblyTakeoff,
  CaliberTotal,
  ExcludedAssembly,
  MaterialCaliber,
  MaterialTakeoff,
  TakeoffLine,
  TakeoffMode,
  TakeoffReport,
} from './types'
import { surfaceLabels } from '../assemblies/types'
import { validateAssembly } from '../assemblies/validation'
import { calculate, calculationMethod, replacementCycles } from '../carbon/engine'
import { now } from '../shared/identity'

function buildLines(assembly: Assembly, materials: Material[]): TakeoffLine[] {
  const byId = new Map(materials.map((material) => [material.id, material]))
  return assembly.layers.map((layer, index) => {
    const material = byId.get(layer.materialId)
    if (!material) throw new Error('材料参数缺失，无法生成清单。')
    const cycles = replacementCycles(assembly.years, layer.lifespan)
    const massRate = (layer.thickness / 1000) * material.density
    const initialRate = massRate * material.factor * (1 + layer.loss / 100)
    const totalRate = initialRate * (1 + cycles)
    const volume = (layer.thickness / 1000) * assembly.area
    return {
      layerId: layer.id,
      assemblyId: assembly.id,
      assemblyName: assembly.name,
      surface: surfaceLabels[assembly.surface],
      area: assembly.area,
      years: assembly.years,
      position: index + 1,
      materialId: material.id,
      materialName: material.name,
      kind: material.kind,
      source: material.source,
      thickness: layer.thickness,
      loss: layer.loss,
      lifespan: layer.lifespan,
      cycles,
      volume,
      mass: massRate * assembly.area,
      initial: initialRate * assembly.area,
      replacement: (totalRate - initialRate) * assembly.area,
      total: totalRate * assembly.area,
    }
  })
}

function scopeOf(lines: TakeoffLine[]): { assemblyNames: string[]; coveredArea: number } {
  const areaById = new Map<string, number>()
  for (const line of lines) areaById.set(line.assemblyId, line.area)
  let coveredArea = 0
  areaById.forEach((area) => (coveredArea += area))
  return {
    assemblyNames: [...new Set(lines.map((line) => line.assemblyName))],
    coveredArea,
  }
}

function sumLines(
  lines: TakeoffLine[],
): Pick<TakeoffLine, 'volume' | 'mass' | 'initial' | 'replacement' | 'total'> {
  return {
    volume: lines.reduce((total, line) => total + line.volume, 0),
    mass: lines.reduce((total, line) => total + line.mass, 0),
    initial: lines.reduce((total, line) => total + line.initial, 0),
    replacement: lines.reduce((total, line) => total + line.replacement, 0),
    total: lines.reduce((total, line) => total + line.total, 0),
  }
}

function summarizeCaliber(years: number, lines: TakeoffLine[]): CaliberTotal {
  return { years, lineCount: lines.length, ...scopeOf(lines), ...sumLines(lines) }
}

function buildAssemblySections(
  selected: Assembly[],
  materials: Material[],
): { sections: AssemblyTakeoff[]; lines: TakeoffLine[] } {
  const sections: AssemblyTakeoff[] = []
  const lines: TakeoffLine[] = []
  for (const assembly of selected) {
    const assemblyLines = buildLines(assembly, materials)
    lines.push(...assemblyLines)
    sections.push({
      assemblyId: assembly.id,
      name: assembly.name,
      revision: assembly.revision,
      state: assembly.state,
      surface: assembly.surface,
      area: assembly.area,
      years: assembly.years,
      note: assembly.note,
      lines: assemblyLines,
      thicknessSum: assemblyLines.reduce((total, line) => total + line.thickness, 0),
      ...sumLines(assemblyLines),
    })
  }
  return { sections, lines }
}

function buildMaterialSections(lines: TakeoffLine[], order: Material[]): MaterialTakeoff[] {
  const grouped = new Map<string, TakeoffLine[]>()
  for (const line of lines) {
    const bucket = grouped.get(line.materialId)
    if (bucket) bucket.push(line)
    else grouped.set(line.materialId, [line])
  }
  const rank = new Map(order.map((material, index) => [material.id, index]))
  return [...grouped.entries()]
    .sort(
      (a, b) =>
        (rank.get(a[0]) ?? Number.MAX_SAFE_INTEGER) - (rank.get(b[0]) ?? Number.MAX_SAFE_INTEGER),
    )
    .map(([materialId, materialLines]) => {
      const first = materialLines[0]
      const yearsOrder = [...new Set(materialLines.map((line) => line.years))].sort((a, b) => a - b)
      const calibers: MaterialCaliber[] = yearsOrder.map((years) =>
        summarizeCaliber(
          years,
          materialLines.filter((line) => line.years === years),
        ),
      )
      const assemblyOrder = [...new Set(materialLines.map((line) => line.assemblyId))]
      const thicknessByAssembly = assemblyOrder.map((assemblyId) => {
        const scoped = materialLines.filter((line) => line.assemblyId === assemblyId)
        return {
          assemblyId,
          assemblyName: scoped[0].assemblyName,
          years: scoped[0].years,
          thickness: scoped.reduce((total, line) => total + line.thickness, 0),
        }
      })
      return {
        materialId,
        materialName: first.materialName,
        kind: first.kind,
        source: first.source,
        lines: materialLines,
        calibers,
        uniformYears: calibers.length === 1,
        assemblyCount: assemblyOrder.length,
        thicknessByAssembly,
        ...sumLines(materialLines),
      }
    })
}

/**
 * 只读汇总已保存构造的材料用量，不修改任何构造或材料。
 * 替换碳与生命周期合计以计算年限为口径分组，绝不跨年限混算。
 */
export function createTakeoff(
  assemblyIds: string[],
  assemblies: Assembly[],
  materials: Material[],
  mode: TakeoffMode = 'assembly',
): TakeoffReport {
  const excluded: ExcludedAssembly[] = []
  const selected: Assembly[] = []
  for (const id of assemblyIds) {
    const assembly = assemblies.find((item) => item.id === id)
    if (!assembly) {
      excluded.push({ assemblyId: id, name: '已删除的构造', reasons: ['构造不存在或已被删除。'] })
      continue
    }
    const findings = validateAssembly(assembly, materials).map((finding) => finding.text)
    if (findings.length) {
      excluded.push({ assemblyId: assembly.id, name: assembly.name, reasons: findings })
      continue
    }
    try {
      calculate(assembly, materials)
    } catch (cause) {
      excluded.push({
        assemblyId: assembly.id,
        name: assembly.name,
        reasons: [cause instanceof Error ? cause.message : '无法计算该构造。'],
      })
      continue
    }
    selected.push(assembly)
  }

  const { sections, lines } = buildAssemblySections(selected, materials)
  const materialSections = buildMaterialSections(lines, materials)
  const yearsOrder = [...new Set(selected.map((assembly) => assembly.years))].sort((a, b) => a - b)
  const caliberTotals = yearsOrder.map((years) =>
    summarizeCaliber(
      years,
      lines.filter((line) => line.years === years),
    ),
  )
  const totals = sumLines(lines)
  const notes = [
    `计算方法：${calculationMethod}。`,
    '质量为厚度乘密度的净质量，未计施工损耗；初始隐含碳已计入各层损耗率，替换隐含碳按同因子逐次替换。',
    '厚度（毫米）是每平方米构造内的层厚，仅在同一构造内合计；跨构造用量以体积（立方米）与质量（千克）表示。',
    '替换次数为 ceil(计算年限 / 替换寿命) − 1；替换与生命周期合计只在相同计算年限的口径内给出，不跨年限混算。',
    '体积、质量与初始隐含碳与计算年限无关，跨口径合计时已单独标注；不同建筑部位的合计仅供方案阶段量算，不代表同一实物部位。',
    '本清单只读已保存构造与材料参数，不会修改任何构造；仅含材料生产与同因子替换，不含运输、施工、运行与终结阶段。',
    '内置物性为教学示例，实际工程须使用经核实的参数。',
  ]
  return {
    generatedAt: now(),
    mode,
    assemblySections: sections,
    materialSections,
    caliberTotals,
    uniformYears: yearsOrder.length <= 1,
    selectedCount: selected.length,
    totalArea: scopeOf(lines).coveredArea,
    ...totals,
    excluded,
    method: calculationMethod,
    notes,
  }
}
