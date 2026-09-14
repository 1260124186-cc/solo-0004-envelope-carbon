import type { Assembly, Layer, Surface } from '../assemblies/types'
import type { Material } from '../materials/types'
import { surfaceLabels } from '../assemblies/types'

// 草稿恢复前的差异描述：只比较构造可编辑内容，不把修订号、更新时间等保存元数据算作差异。

export interface FieldChange {
  label: string
  saved: string
  draft: string
}

export interface LayerChange {
  index: number
  materialName: string
  details: FieldChange[]
}

export interface AssemblyDiff {
  hasChanges: boolean
  fieldChanges: FieldChange[]
  addedLayers: Layer[]
  removedLayers: Layer[]
  changedLayers: LayerChange[]
  movedLayers: Array<{ id: string; materialName: string }>
}

function text(value: number | string): string {
  return value === '' ? '（空）' : String(value)
}

function scalarField(
  label: string,
  saved: number | string,
  draft: number | string,
): FieldChange | null {
  return saved === draft ? null : { label, saved: text(saved), draft: text(draft) }
}

function materialNameOf(materialId: string, materials: Material[]): string {
  return materials.find((material) => material.id === materialId)?.name ?? '材料已删除'
}

function describeLayer(layer: Layer, materials: Material[]): string {
  const name = materialNameOf(layer.materialId, materials)
  return `${name} · ${layer.thickness}毫米`
}

export function diffAssemblies(
  saved: Assembly,
  draft: Assembly,
  materials: Material[],
): AssemblyDiff {
  const fieldChanges: FieldChange[] = []
  const push = (change: FieldChange | null) => {
    if (change) fieldChanges.push(change)
  }
  push(scalarField('构造名称', saved.name, draft.name))
  push(
    scalarField(
      '建筑部位',
      surfaceLabels[saved.surface as Surface],
      surfaceLabels[draft.surface as Surface],
    ),
  )
  push(scalarField('构造面积（平方米）', saved.area, draft.area))
  push(scalarField('计算年限（年）', saved.years, draft.years))
  push(scalarField('碳强度目标', saved.carbonLimit, draft.carbonLimit))
  push(scalarField('传热系数上限', saved.thermalLimit, draft.thermalLimit))
  push(scalarField('设计说明', saved.note || '（空）', draft.note || '（空）'))

  const savedById = new Map(saved.layers.map((layer) => [layer.id, layer]))
  const draftById = new Map(draft.layers.map((layer) => [layer.id, layer]))

  const addedLayers = draft.layers.filter((layer) => !savedById.has(layer.id))
  const removedLayers = saved.layers.filter((layer) => !draftById.has(layer.id))

  const changedLayers: LayerChange[] = []
  const movedLayers: Array<{ id: string; materialName: string }> = []
  for (const [index, draftLayer] of draft.layers.entries()) {
    const savedLayer = savedById.get(draftLayer.id)
    if (!savedLayer) continue
    if (saved.layers.indexOf(savedLayer) !== index) {
      movedLayers.push({
        id: draftLayer.id,
        materialName: materialNameOf(draftLayer.materialId, materials),
      })
    }
    const details: FieldChange[] = []
    if (savedLayer.materialId !== draftLayer.materialId) {
      details.push({
        label: '材料',
        saved: materialNameOf(savedLayer.materialId, materials),
        draft: materialNameOf(draftLayer.materialId, materials),
      })
    }
    const pushLayer = (label: string, a: number, b: number) => {
      if (a !== b) details.push({ label, saved: String(a), draft: String(b) })
    }
    pushLayer('厚度（毫米）', savedLayer.thickness, draftLayer.thickness)
    pushLayer('损耗率（%）', savedLayer.loss, draftLayer.loss)
    pushLayer('替换寿命（年）', savedLayer.lifespan, draftLayer.lifespan)
    if (details.length) {
      changedLayers.push({
        index: index + 1,
        materialName: materialNameOf(draftLayer.materialId, materials),
        details,
      })
    }
  }

  return {
    hasChanges:
      fieldChanges.length > 0 ||
      addedLayers.length > 0 ||
      removedLayers.length > 0 ||
      changedLayers.length > 0,
    fieldChanges,
    addedLayers,
    removedLayers,
    changedLayers,
    movedLayers,
  }
}

// 尚未保存过的新构造没有正式版本可比对，逐项列出草稿内容供用户确认。
export function describeNewAssembly(
  draft: Assembly,
  materials: Material[],
): { label: string; value: string }[] {
  return [
    { label: '构造名称', value: draft.name || '（未命名）' },
    { label: '建筑部位', value: surfaceLabels[draft.surface] },
    { label: '构造面积（平方米）', value: String(draft.area) },
    { label: '计算年限（年）', value: String(draft.years) },
    {
      label: '构造层',
      value: draft.layers.map((layer) => describeLayer(layer, materials)).join('；') || '（无）',
    },
  ]
}
