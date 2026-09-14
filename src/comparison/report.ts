import type { Assembly, Surface } from '../assemblies/types'
import type { Material } from '../materials/types'
import type { Calculation } from '../carbon/types'
import type { ComparisonRecord } from './types'
import { number, date } from '../shared/format'
import { surfaceLabels, stateLabels } from '../assemblies/types'
import { kindLabels } from '../materials/types'

const kgCO2 = '千克二氧化碳当量'

interface FrozenSide {
  assembly: Assembly
  materials: Material[]
  result: Calculation
}

/** 按显示小数位补零，供表格列对齐；数值口径仍为未舍入值，仅显示舍入。 */
function fixed(value: number, digits = 2): string {
  return value.toLocaleString('zh-CN', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })
}

function signed(value: number, digits = 2): string {
  return `${value > 0 ? '+' : ''}${fixed(value, digits)}`
}

/** 等宽字体下的显示宽度：中日韩文字与全角符号按 2 个英文字符计。 */
function visualWidth(value: string): number {
  return [...value].reduce((total, char) => total + (char.codePointAt(0)! > 0x2e7f ? 2 : 1), 0)
}

function padEnd(value: string, width: number): string {
  return `${value}${' '.repeat(Math.max(0, width - visualWidth(value)))}`
}

function padStart(value: string, width: number): string {
  return `${' '.repeat(Math.max(0, width - visualWidth(value)))}${value}`
}

type NumericField =
  | 'thickness'
  | 'mass'
  | 'initial'
  | 'replacement'
  | 'intensity'
  | 'whole'
  | 'resistance'
  | 'transmittance'

const columnItems: {
  label: string
  field: NumericField
  unit: string
  digits: number
}[] = [
  { label: '初始隐含碳', field: 'initial', unit: `${kgCO2}/平方米`, digits: 2 },
  { label: '替换隐含碳', field: 'replacement', unit: `${kgCO2}/平方米`, digits: 2 },
  { label: '生命周期碳强度', field: 'intensity', unit: `${kgCO2}/平方米`, digits: 2 },
  { label: '整个构造隐含碳', field: 'whole', unit: kgCO2, digits: 2 },
  { label: '简化总热阻', field: 'resistance', unit: '平方米·开尔文/瓦', digits: 3 },
  { label: '传热系数', field: 'transmittance', unit: '瓦/(平方米·开尔文)', digits: 3 },
  { label: '构造总厚度', field: 'thickness', unit: '毫米', digits: 1 },
  { label: '每平方米初始质量', field: 'mass', unit: '千克/平方米', digits: 2 },
]

function comparisonTable(baseline: Calculation, alternative: Calculation): string[] {
  const labelWidth = 18
  const valueWidth = 16
  const head = `${padEnd('计算项', labelWidth)}${padStart('基准构造', valueWidth)}${padStart(
    '替代构造',
    valueWidth,
  )}${padStart('差值(替代−基准)', valueWidth)}  单位`
  const rows = columnItems.map((item) => {
    const a = baseline[item.field]
    const b = alternative[item.field]
    return `${padEnd(item.label, labelWidth)}${padStart(fixed(a, item.digits), valueWidth)}${padStart(
      fixed(b, item.digits),
      valueWidth,
    )}${padStart(signed(b - a, item.digits), valueWidth)}  ${item.unit}`
  })
  return [head, ...rows]
}

function layerLines(indexLabel: string, side: FrozenSide): string[] {
  const byId = new Map(side.materials.map((material) => [material.id, material]))
  const lines: string[] = []
  side.assembly.layers.forEach((layer, index) => {
    const result = side.result.layers[index]
    const material = byId.get(layer.materialId)
    lines.push(
      `${indexLabel}第 ${index + 1} 层（室外至室内排序）：${result.materialName}`,
      `    层厚：${number(layer.thickness)} 毫米（来源：${indexLabel}冻结的构造层输入）`,
      `    施工损耗率：${number(layer.loss)}%（来源：${indexLabel}冻结的构造层输入）`,
      `    替换寿命：${layer.lifespan} 年（来源：${indexLabel}冻结的构造层输入）`,
      `    每平方米质量：${number(result.mass)} 千克/平方米`,
      `    初始隐含碳：${number(result.initial)} ${kgCO2}/平方米`,
      `    替换次数：${result.cycles} 次；替换隐含碳：${number(result.replacement)} ${kgCO2}/平方米`,
      `    该层生命周期隐含碳：${number(result.total)} ${kgCO2}/平方米`,
      `    层热阻：${fixed(result.resistance, 4)} 平方米·开尔文/瓦`,
      `    材料参数来源：${material?.source ?? '记录中未保存该材料来源'}`,
    )
  })
  return lines
}

function materialLines(indexLabel: string, side: FrozenSide): string[] {
  return side.materials.map(
    (material) =>
      `${indexLabel}${material.name}：密度 ${number(material.density)} 千克/立方米；` +
      `导热系数 ${number(material.conductivity)} 瓦/(米·开尔文)；` +
      `单位质量碳因子 ${number(material.factor)} ${kgCO2}/千克；` +
      `参考寿命 ${material.lifespan} 年；类别 ${kindLabels[material.kind]}；` +
      `参数来源：${material.source}`,
  )
}

function conditionText(assembly: Assembly, surface: Surface): string[] {
  return [
    `建筑部位：${surfaceLabels[surface]}（部位编码 ${surface}），构造面积：${number(
      assembly.area,
    )} 平方米，计算年限：${assembly.years} 年`,
    `碳强度目标：${number(assembly.carbonLimit)} ${kgCO2}/平方米；` +
      `传热系数上限：${number(assembly.thermalLimit)} 瓦/(平方米·开尔文)`,
    `构造修订号：${assembly.revision}；保存时间：${date(assembly.updatedAt)}；` +
      `比较时状态：${stateLabels[assembly.state]}`,
    `设计说明：${assembly.note || '无补充说明。'}`,
  ]
}

export function comparisonReportText(record: ComparisonRecord): string {
  const baselineSide: FrozenSide = record.baseline
  const alternativeSide: FrozenSide = record.alternative
  const baseline = baselineSide.assembly
  const alternative = alternativeSide.assembly
  const sameSurface = baseline.surface === alternative.surface
  const sameArea = baseline.area === alternative.area
  const sameYears = baseline.years === alternative.years
  const lines: string[] = [
    '围护碳研 · 构造对比报告',
    '================================',
    `报告保存时间：${date(record.createdAt)}`,
    `比较记录编号：${record.id}`,
    '',
    `基准构造：${baseline.name}（标识 ${baseline.id}）`,
    `替代构造：${alternative.name}（标识 ${alternative.id}）`,
    '',
    '一、比较口径',
    sameSurface
      ? `两个构造采用相同的建筑部位：${surfaceLabels[baseline.surface]}。`
      : '警告：两个构造的建筑部位不一致，不应进行同口径比较。',
    sameArea
      ? `两个构造采用相同的构造面积：${number(baseline.area)} 平方米。`
      : '警告：两个构造的构造面积不一致，不应进行同口径比较。',
    sameYears
      ? `两个构造采用相同的计算年限：${baseline.years} 年。`
      : '警告：两个构造的计算年限不一致，不应进行同口径比较。',
    '本报告中的每一项差值均按“替代构造减去基准构造”计算，正值表示替代构造增加，负值表示减少。',
    '百分数为生命周期碳强度差值占基准构造生命周期碳强度的比例。',
    '比较成立的前提是部位、面积与计算年限完全一致；本记录保存时已通过该校验。',
    '',
    '二、基准构造的冻结参数',
    ...conditionText(baseline, baseline.surface),
    ...layerLines('基准构造', baselineSide),
    '',
    '三、替代构造的冻结参数',
    ...conditionText(alternative, alternative.surface),
    ...layerLines('替代构造', alternativeSide),
    '',
    '四、冻结的材料物性（比较保存时的取值）',
    ...materialLines('基准构造 · ', baselineSide),
    ...materialLines('替代构造 · ', alternativeSide),
    '以上物性随比较记录一并冻结；材料目录此后的修改不影响本报告。',
    '',
    '五、计算口径',
    `计算方法：${baselineSide.result.method}`,
    `1. 每平方米质量（千克/平方米）＝ 厚度（毫米）÷1000 × 密度（千克/立方米）。`,
    `2. 每平方米初始隐含碳（${kgCO2}/平方米）＝ 质量 × 单位质量碳因子 ×（1＋施工损耗率）。`,
    `3. 替换次数 ＝ ceil(计算年限 ÷ 层替换寿命) − 1；恰好处于计算期终点的替换不计入。`,
    `4. 每平方米替换隐含碳 ＝ 初始隐含碳 × 替换次数；生命周期碳强度 ＝ 初始与替换隐含碳之和。`,
    `5. 整个构造隐含碳（${kgCO2}）＝ 生命周期碳强度 × 构造面积（平方米）。`,
    `6. 层热阻（平方米·开尔文/瓦）＝ 厚度（米）÷ 导热系数（瓦/(米·开尔文)）。`,
    `7. 简化总热阻 ＝ 各层热阻之和 ＋ 内表面热阻 0.11 ＋ 外表面热阻 0.04（平方米·开尔文/瓦）。`,
    `8. 传热系数（瓦/(平方米·开尔文)）＝ 1 ÷ 简化总热阻。`,
    '计算范围仅包含材料生产隐含碳与同因子替换，不含运行能耗、运输、施工能耗、终结阶段及生物源碳储存；',
    '热工结果为简化一维算法，不含热桥、含湿修正与空腔修正。',
    '内部计算与差值均使用未舍入数值；下表为便于复核按显示小数位排版，极小值可能只显示三位有效数字。',
    '',
    '六、结果对比与各项差值',
    ...comparisonTable(baselineSide.result, alternativeSide.result),
    '',
    `生命周期碳强度差值：${number(record.carbonDelta)} ${kgCO2}/平方米`,
    record.percent === null
      ? '基准构造生命周期碳强度为零，不计算相对变化百分比。'
      : `相对基准变化：${signed(record.percent)}%（差值 ÷ 基准生命周期碳强度 ×100%）。`,
    `整个构造隐含碳差值：${number(record.wholeDelta)} ${kgCO2}（面积同为 ${number(
      baseline.area,
    )} 平方米）。`,
    `传热系数差值：${signed(record.thermalDelta)} 瓦/(平方米·开尔文)。`,
    '',
    '七、目标判断（依据各构造冻结的自身目标值）',
    `基准构造：生命周期碳强度 ${number(baselineSide.result.intensity)} ${kgCO2}/平方米，` +
      `目标 ≤ ${number(baseline.carbonLimit)}，${baselineSide.result.carbonPass ? '满足' : '不满足'}；` +
      `传热系数 ${number(baselineSide.result.transmittance)} 瓦/(平方米·开尔文)，` +
      `上限 ≤ ${number(baseline.thermalLimit)}，${baselineSide.result.thermalPass ? '满足' : '不满足'}。`,
    `替代构造：生命周期碳强度 ${number(alternativeSide.result.intensity)} ${kgCO2}/平方米，` +
      `目标 ≤ ${number(alternative.carbonLimit)}，` +
      `${alternativeSide.result.carbonPass ? '满足' : '不满足'}；` +
      `传热系数 ${number(alternativeSide.result.transmittance)} 瓦/(平方米·开尔文)，` +
      `上限 ≤ ${number(alternative.thermalLimit)}，${alternativeSide.result.thermalPass ? '满足' : '不满足'}。`,
    '目标值仅用于设计方案之间的辅助比较，不作为项目合规判定。',
    '',
    '八、复核说明',
    '1. 本报告依据保存该比较记录时冻结的两个构造副本、材料物性与计算结果生成。',
    '2. 报告中的数值不取自当前正在编辑的草稿，也不取自材料目录此后被修改或新建的材料；',
    '   保存比较之后对构造名称、层厚、损耗、寿命或材料物性的任何修改，都不会改变本报告。',
    '3. 报告导出动作不修改任何构造、材料或计算书，全部计算与生成过程均在本机浏览器内完成，不访问在线服务。',
    '4. 内置物性为教学示例，实际工程须使用经核实的材料参数。',
    '5. 如对数值有疑问，应以本报告第二至五节冻结的输入按第五节公式重新核算。',
  ]
  return lines.join('\n')
}

export function downloadComparisonReport(record: ComparisonRecord): void {
  const blob = new Blob(['\ufeff', comparisonReportText(record)], {
    type: 'text/plain;charset=utf-8',
  })
  const url = URL.createObjectURL(blob)
  const anchor = window.document.createElement('a')
  anchor.href = url
  const safeName = (value: string) => value.replace(/[\\/:*?"<>|]/g, '-')
  anchor.download = `对比报告-${safeName(record.baseline.assembly.name)}-${safeName(
    record.alternative.assembly.name,
  )}.txt`
  window.document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}
