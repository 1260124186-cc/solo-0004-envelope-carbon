import type { TakeoffReport } from './types'
import type { AssemblyTakeoff, MaterialTakeoff, TakeoffLine } from './types'
import { date, number } from '../shared/format'
import { kindLabels } from '../materials/types'
import { stateLabels, surfaceLabels } from '../assemblies/types'

const unit = '千克二氧化碳当量'
const separator = '——————————————————————————————'

function lineRow(line: TakeoffLine): string {
  return [
    `    第 ${line.position} 层｜${line.materialName}｜厚 ${number(line.thickness)} 毫米`,
    `    损耗 ${number(line.loss)}%｜替换寿命 ${line.lifespan} 年（${line.cycles} 次）`,
    `    体积 ${number(line.volume)} 立方米｜净质量 ${number(line.mass)} 千克`,
    `    初始 ${number(line.initial)}｜替换 ${number(line.replacement)}｜生命周期 ${number(
      line.total,
    )} ${unit}`,
  ].join('\n')
}

function assemblySection(section: AssemblyTakeoff): string[] {
  return [
    separator,
    `构造：${section.name}（修订 ${section.revision} · ${stateLabels[section.state]}）`,
    `部位：${surfaceLabels[section.surface]}｜面积：${number(section.area)} 平方米｜计算年限：${
      section.years
    } 年｜构造总厚：${number(section.thicknessSum)} 毫米`,
    section.note ? `说明：${section.note}` : '说明：无补充说明。',
    '逐层归属（室外至室内）：',
    ...section.lines.flatMap((line) => [lineRow(line), '']),
    `构造小计：体积 ${number(section.volume)} 立方米｜净质量 ${number(section.mass)} 千克`,
    `初始 ${number(section.initial)}｜替换 ${number(section.replacement)}｜生命周期 ${number(
      section.total,
    )} ${unit}`,
  ]
}

function materialSection(material: MaterialTakeoff): string[] {
  const lines = [
    separator,
    `材料：${material.materialName}（${kindLabels[material.kind]}）｜参数来源：${material.source}`,
    `出现于 ${material.assemblyCount} 个构造、共 ${material.lines.length} 层；按构造层厚合计（毫米，仅同一构造内相加）：`,
    ...material.thicknessByAssembly.map(
      (item) => `    ${item.assemblyName}（${item.years} 年）：${number(item.thickness)} 毫米`,
    ),
  ]
  material.calibers.forEach((caliber) => {
    lines.push(
      `口径小计 · ${caliber.years} 年（${caliber.assemblyNames.join('、')}）：`,
      `    层数 ${caliber.lineCount}｜覆盖面积 ${number(caliber.coveredArea)} 平方米`,
      `    体积 ${number(caliber.volume)} 立方米｜净质量 ${number(caliber.mass)} 千克`,
      `    初始 ${number(caliber.initial)}｜替换 ${number(caliber.replacement)}｜生命周期 ${number(
        caliber.total,
      )} ${unit}`,
    )
  })
  if (!material.uniformYears) {
    lines.push(
      '该材料分布在不同计算年限的构造中：体积、净质量与初始隐含碳与年限无关，可跨口径合计；',
      '替换与生命周期隐含碳不在构造间混算，请按上面的年限口径小计分别取用。',
    )
  }
  lines.push(
    `跨口径合计（年限无关）：体积 ${number(material.volume)} 立方米｜净质量 ${number(
      material.mass,
    )} 千克｜初始 ${number(material.initial)} ${unit}`,
    '归属明细：',
    ...material.lines.flatMap((line) => [
      `  ${line.assemblyName}（${line.surface} · ${number(line.area)} 平方米 · ${line.years} 年）`,
      lineRow(line),
      '',
    ]),
  )
  return lines
}

export function takeoffText(report: TakeoffReport): string {
  const primaryTitle = report.mode === 'assembly' ? '一、按构造分组' : '一、按材料汇总'
  const lines = [
    '围护碳研 · 材料用量清单（方案阶段估算）',
    `导出时间：${date(report.generatedAt)}`,
    `计算方法：${report.method}`,
    `入选构造：${report.selectedCount} 个${
      report.excluded.length ? `；另有 ${report.excluded.length} 个构造未纳入（见文末）` : ''
    }`,
    '',
    '口径概览（构造部位、面积、计算年限逐项列出，不合并不同口径）：',
    ...report.assemblySections.map(
      (section) =>
        `  ${section.name}｜${surfaceLabels[section.surface]}｜${number(
          section.area,
        )} 平方米｜${section.years} 年`,
    ),
  ]
  if (report.uniformYears) {
    lines.push(`全部入选构造共用计算年限：${report.caliberTotals[0]?.years ?? '—'} 年。`)
  } else {
    lines.push('入选构造计算年限不一致：替换与生命周期隐含碳按年限分组给出，不跨年限混算总量。')
  }
  lines.push(
    '',
    '口径合计（按计算年限分组）：',
    ...report.caliberTotals.map(
      (total) =>
        `  ${total.years} 年（${total.assemblyNames.join('、')}）：覆盖面积 ${number(
          total.coveredArea,
        )} 平方米｜体积 ${number(total.volume)} 立方米｜净质量 ${number(
          total.mass,
        )} 千克｜初始 ${number(total.initial)}｜替换 ${number(total.replacement)}｜生命周期 ${number(
          total.total,
        )} ${unit}`,
    ),
    `年限无关合计（可跨口径）：总体积 ${number(report.volume)} 立方米｜总净质量 ${number(
      report.mass,
    )} 千克｜总初始 ${number(report.initial)} ${unit}`,
    '',
    primaryTitle,
  )
  if (report.mode === 'assembly') {
    lines.push(...report.assemblySections.flatMap(assemblySection))
    lines.push('', '二、按材料汇总', ...report.materialSections.flatMap(materialSection))
  } else {
    lines.push(...report.materialSections.flatMap(materialSection))
    lines.push('', '二、按构造分组', ...report.assemblySections.flatMap(assemblySection))
  }
  lines.push('', '三、口径与计算边界')
  report.notes.forEach((note, index) => lines.push(`${index + 1}. ${note}`))
  if (report.excluded.length) {
    lines.push('', '未纳入清单的构造：')
    report.excluded.forEach((item) => {
      lines.push(`  ${item.name}`)
      item.reasons.forEach((reason) => lines.push(`    - ${reason}`))
    })
  }
  return lines.join('\n')
}

export function downloadTakeoff(report: TakeoffReport): void {
  const blob = new Blob(['\ufeff', takeoffText(report)], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = window.document.createElement('a')
  anchor.href = url
  const stamp = new Date(report.generatedAt)
  const key = Number.isFinite(stamp.getTime())
    ? stamp.toISOString().slice(0, 16).replace(/[T:]/g, '-')
    : '导出'
  anchor.download = `材料用量清单-${key}.txt`
  window.document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}
