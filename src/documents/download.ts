import type { CarbonDocument } from './types'
import type { ComplianceRule } from '../compliance/types'
import { number, date } from '../shared/format'
import { surfaceLabels } from '../assemblies/types'
import { documentCompliance, documentRuleState } from './basis'

export function documentText(document: CarbonDocument, rules: ComplianceRule[] = []): string {
  const { assembly, result } = document
  const compliance = documentCompliance(document)
  const ruleState = documentRuleState(document, rules)
  const ruleSuffix =
    ruleState === 'deactivated'
      ? '（该规则现已停用，仍按定稿时口径列示）'
      : ruleState === 'missing'
        ? '（该规则已被移除，仍按定稿时口径列示）'
        : ''
  const lines = [
    '围护碳研 · 围护构造计算书',
    `构造：${assembly.name}`,
    `部位：${surfaceLabels[assembly.surface]}`,
    `定稿时间：${date(document.createdAt)}`,
    `构造修订：${assembly.revision}`,
    `计算方法：${result.method}`,
    `面积：${number(assembly.area)} 平方米`,
    `计算期：${assembly.years} 年`,
    '',
    '一、计算结果',
    `初始隐含碳：${number(result.initial)} 千克二氧化碳当量/平方米`,
    `替换隐含碳：${number(result.replacement)} 千克二氧化碳当量/平方米`,
    `生命周期强度：${number(result.intensity)} 千克二氧化碳当量/平方米`,
    `构造总隐含碳：${number(result.whole)} 千克二氧化碳当量`,
    `传热系数：${number(result.transmittance)} 瓦/(平方米·开尔文)`,
    `构造总厚度：${number(result.thickness)} 毫米`,
    '',
    '二、达标判定（按定稿时口径冻结）',
    compliance.mode === 'rule'
      ? `判定规则：${compliance.ruleName}${ruleSuffix}`
      : '判定口径：构造自带碳强度目标与传热系数上限（未选用达标规则）',
    `总体结论：${compliance.pass ? '达标' : '未达标'}`,
    ...compliance.conditions.map(
      (condition) =>
        `${condition.pass ? '[达标]' : '[超出]'} ${condition.label}：实际 ${number(condition.actual)}，上限 ${number(condition.limit)} ${condition.unit}`,
    ),
    ...(ruleState === 'deactivated' || ruleState === 'missing'
      ? ['说明：规则的后续变化不追溯改变本计算书，以上为定稿时冻结的历史判定依据。']
      : []),
    '',
    '三、构造层（室外至室内）',
  ]
  result.layers.forEach((layer, index) => {
    lines.push(
      `${index + 1}. ${layer.materialName}，厚 ${number(layer.thickness)} 毫米`,
      `质量 ${number(layer.mass)} 千克/平方米；替换 ${layer.cycles} 次`,
      `隐含碳 ${number(layer.total)} 千克二氧化碳当量/平方米`,
      `参数来源：${layer.source}`,
    )
  })
  lines.push('', '四、冻结物性')
  document.materials.forEach((material) => {
    lines.push(
      `${material.name}：密度 ${material.density} 千克/立方米`,
      `导热系数 ${material.conductivity} 瓦/(米·开尔文)；碳因子 ${material.factor} 千克二氧化碳当量/千克`,
    )
  })
  lines.push(
    '',
    '五、设计说明',
    assembly.note || '无补充说明。',
    '',
    '计算范围：仅含材料初始生产与同因子替换。',
    '不含运行能耗、运输、施工能耗、终结阶段及生物源碳储存。',
    '热阻采用简化一维算法，不含热桥、含湿与空腔修正。',
    '本计算书冻结生成时的输入、结果与达标判定；规则日后被修改、停用或移除均不追溯改变本版本。',
    '内置物性为教学示例，实际工程应使用经核实的参数。',
  )
  return lines.join('\n')
}

export function downloadDocument(document: CarbonDocument, rules: ComplianceRule[] = []): void {
  const blob = new Blob(['\ufeff', documentText(document, rules)], {
    type: 'text/plain;charset=utf-8',
  })
  const url = URL.createObjectURL(blob)
  const anchor = window.document.createElement('a')
  anchor.href = url
  const safeName = document.assembly.name.replace(/[\\/:*?"<>|]/g, '-')
  anchor.download = `${safeName}-计算书-${document.assembly.revision}.txt`
  window.document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}
