<script setup lang="ts">
import type { TakeoffReport } from './types'
import { computed } from 'vue'
import { date, number } from '../shared/format'
import { kindLabels } from '../materials/types'
import { stateLabels } from '../assemblies/types'
import { downloadTakeoff } from './download'
const props = defineProps<{ report: TakeoffReport }>()
const modeLabel = computed(() => (props.report.mode === 'assembly' ? '按构造分组' : '按材料汇总'))
</script>

<template>
  <section
    class="takeoff-sheet"
    aria-label="材料用量清单预览"
  >
    <div class="sheet-heading">
      <div>
        <span class="eyebrow">材料用量清单 · 方案阶段估算</span>
        <h2>{{ modeLabel }}（{{ report.selectedCount }} 个构造）</h2>
        <p class="sheet-meta">导出时间 {{ date(report.generatedAt) }} · {{ report.method }}</p>
      </div>
      <button
        class="button primary"
        data-check="takeoff-download"
        @click="downloadTakeoff(report)"
      >
        下载清单文本
      </button>
    </div>

    <div class="table-scroll">
      <table>
        <caption>
          口径概览（部位、面积、计算年限逐项列出）
        </caption>
        <thead>
          <tr>
            <th scope="col">构造</th>
            <th scope="col">状态 / 修订</th>
            <th scope="col">部位</th>
            <th scope="col">面积（平方米）</th>
            <th scope="col">计算年限（年）</th>
            <th scope="col">构造总厚（毫米）</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="section in report.assemblySections"
            :key="section.assemblyId"
          >
            <th scope="row">{{ section.name }}</th>
            <td>{{ stateLabels[section.state] }} · {{ section.revision }}</td>
            <td>{{ section.surface }}</td>
            <td>{{ number(section.area) }}</td>
            <td>{{ section.years }}</td>
            <td>{{ number(section.thicknessSum) }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div
      v-if="!report.uniformYears"
      class="caliber-warning"
      data-check="caliber-warning"
    >
      入选构造的计算年限不一致：下表替换与生命周期隐含碳按年限口径分组给出，不跨年限混算总量；仅体积、净质量与初始隐含碳（年限无关）给出跨口径合计。
    </div>

    <div class="table-scroll">
      <table>
        <caption>
          口径合计（按计算年限分组）
        </caption>
        <thead>
          <tr>
            <th scope="col">计算年限（年）</th>
            <th scope="col">覆盖构造</th>
            <th scope="col">覆盖面积（平方米）</th>
            <th scope="col">体积（立方米）</th>
            <th scope="col">净质量（千克）</th>
            <th scope="col">初始隐含碳（千克当量）</th>
            <th scope="col">替换隐含碳（千克当量）</th>
            <th scope="col">生命周期合计（千克当量）</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="total in report.caliberTotals"
            :key="total.years"
          >
            <th scope="row">{{ total.years }}</th>
            <td>{{ total.assemblyNames.join('、') }}</td>
            <td>{{ number(total.coveredArea) }}</td>
            <td>{{ number(total.volume) }}</td>
            <td>{{ number(total.mass) }}</td>
            <td>{{ number(total.initial) }}</td>
            <td data-check="caliber-replacement">{{ number(total.replacement) }}</td>
            <td>{{ number(total.total) }}</td>
          </tr>
          <tr class="grand-row">
            <th scope="row">跨口径合计</th>
            <td>年限无关指标</td>
            <td>{{ number(report.totalArea) }}</td>
            <td>{{ number(report.volume) }}</td>
            <td>{{ number(report.mass) }}</td>
            <td>{{ number(report.initial) }}</td>
            <td>— 不混算 —</td>
            <td>— 不混算 —</td>
          </tr>
        </tbody>
      </table>
    </div>

    <template v-if="report.mode === 'assembly'">
      <div
        v-for="section in report.assemblySections"
        :key="section.assemblyId"
        class="assembly-block"
      >
        <h3>
          {{ section.name }}
          <small
            >{{ section.surface }} · {{ number(section.area) }} 平方米 ·
            {{ section.years }} 年</small
          >
        </h3>
        <div class="table-scroll">
          <table>
            <caption>
              逐层归属（室外至室内）
            </caption>
            <thead>
              <tr>
                <th scope="col">层位</th>
                <th scope="col">材料（类别）</th>
                <th scope="col">厚度（毫米）</th>
                <th scope="col">损耗（%）</th>
                <th scope="col">体积（立方米）</th>
                <th scope="col">净质量（千克）</th>
                <th scope="col">初始（千克当量）</th>
                <th scope="col">替换次数</th>
                <th scope="col">替换（千克当量）</th>
                <th scope="col">生命周期（千克当量）</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="line in section.lines"
                :key="line.layerId"
              >
                <th scope="row">第 {{ line.position }} 层</th>
                <td>{{ line.materialName }}（{{ kindLabels[line.kind] }}）</td>
                <td>{{ number(line.thickness) }}</td>
                <td>{{ number(line.loss) }}</td>
                <td>{{ number(line.volume) }}</td>
                <td>{{ number(line.mass) }}</td>
                <td>{{ number(line.initial) }}</td>
                <td>{{ line.cycles }}</td>
                <td>{{ number(line.replacement) }}</td>
                <td>{{ number(line.total) }}</td>
              </tr>
            </tbody>
            <tfoot>
              <tr>
                <th scope="row">构造小计</th>
                <td>
                  {{ section.lines.length }} 层 · 总厚 {{ number(section.thicknessSum) }} 毫米
                </td>
                <td>{{ number(section.thicknessSum) }}</td>
                <td></td>
                <td>{{ number(section.volume) }}</td>
                <td>{{ number(section.mass) }}</td>
                <td>{{ number(section.initial) }}</td>
                <td></td>
                <td>{{ number(section.replacement) }}</td>
                <td>{{ number(section.total) }}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </template>

    <template v-else>
      <div
        v-for="material in report.materialSections"
        :key="material.materialId"
        class="material-block"
      >
        <h3>
          {{ material.materialName }}
          <small
            >{{ kindLabels[material.kind] }} · 出现于 {{ material.assemblyCount }} 个构造、
            {{ material.lines.length }} 层</small
          >
        </h3>
        <div class="table-scroll">
          <table>
            <caption>
              按口径小计与按构造层厚
            </caption>
            <thead>
              <tr>
                <th scope="col">口径（计算年限）</th>
                <th scope="col">覆盖构造</th>
                <th scope="col">层数 / 覆盖面积（平方米）</th>
                <th scope="col">体积（立方米）</th>
                <th scope="col">净质量（千克）</th>
                <th scope="col">初始（千克当量）</th>
                <th scope="col">替换（千克当量）</th>
                <th scope="col">生命周期（千克当量）</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="caliber in material.calibers"
                :key="caliber.years"
              >
                <th scope="row">{{ caliber.years }} 年</th>
                <td>{{ caliber.assemblyNames.join('、') }}</td>
                <td>{{ caliber.lineCount }} 层 · {{ number(caliber.coveredArea) }}</td>
                <td>{{ number(caliber.volume) }}</td>
                <td>{{ number(caliber.mass) }}</td>
                <td>{{ number(caliber.initial) }}</td>
                <td>{{ number(caliber.replacement) }}</td>
                <td>{{ number(caliber.total) }}</td>
              </tr>
              <tr
                v-if="!material.uniformYears"
                class="grand-row"
              >
                <th scope="row">跨口径</th>
                <td colspan="2">年限不同，替换与生命周期不混算</td>
                <td>{{ number(material.volume) }}</td>
                <td>{{ number(material.mass) }}</td>
                <td>{{ number(material.initial) }}</td>
                <td>—</td>
                <td>—</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="table-scroll">
          <table>
            <caption>
              归属明细：同材料在哪个构造的哪一层，各厚多少毫米
            </caption>
            <thead>
              <tr>
                <th scope="col">构造</th>
                <th scope="col">部位 / 面积（平方米）/ 年限</th>
                <th scope="col">层位</th>
                <th scope="col">厚度（毫米）</th>
                <th scope="col">参数来源</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="line in material.lines"
                :key="`${line.assemblyId}-${line.layerId}`"
              >
                <th scope="row">{{ line.assemblyName }}</th>
                <td>{{ line.surface }} · {{ number(line.area) }} · {{ line.years }} 年</td>
                <td>第 {{ line.position }} 层</td>
                <td>{{ number(line.thickness) }}</td>
                <td>{{ line.source }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </template>

    <div
      v-if="report.excluded.length"
      class="excluded-block"
    >
      <h3>未纳入清单的已保存构造</h3>
      <ul>
        <li
          v-for="item in report.excluded"
          :key="item.assemblyId"
        >
          <strong>{{ item.name }}</strong
          >：<span
            v-for="reason in item.reasons"
            :key="reason"
            >{{ reason }}
          </span>
        </li>
      </ul>
    </div>

    <ol class="note-list">
      <li
        v-for="note in report.notes"
        :key="note"
      >
        {{ note }}
      </li>
    </ol>
  </section>
</template>

<style scoped>
.takeoff-sheet {
  background: var(--paper);
  border: 1px solid var(--line);
  padding: 32px;
  border-radius: 8px;
}
.sheet-heading {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 20px;
  border-bottom: 2px solid var(--green);
  padding-bottom: 20px;
}
.sheet-heading h2 {
  margin: 8px 0 4px;
}
.sheet-meta {
  font-size: 11px;
  color: var(--muted);
  margin: 0;
}
.caliber-warning {
  color: #865629;
  background: #fcf3de;
  border-left: 3px solid #b6803f;
  padding: 12px 16px;
  font-size: 12px;
  line-height: 1.8;
  margin: 16px 0;
}
.assembly-block,
.material-block {
  margin-top: 28px;
  padding-top: 12px;
  border-top: 1px dashed var(--line);
}
.assembly-block h3,
.material-block h3 {
  font-size: 15px;
  margin: 12px 0;
}
.assembly-block h3 small,
.material-block h3 small {
  font-size: 11px;
  color: var(--muted);
  font-weight: 400;
  margin-left: 10px;
}
tfoot th,
tfoot td {
  background: #f3f5ec;
  font-weight: 600;
}
.grand-row th,
.grand-row td {
  background: var(--green-pale);
  color: var(--green);
}
.excluded-block {
  margin-top: 24px;
  padding: 16px;
  border: 1px dashed #d4b7a5;
  border-radius: 6px;
  font-size: 12px;
}
.excluded-block ul {
  margin: 8px 0 0;
  padding-left: 18px;
  line-height: 1.9;
}
.note-list {
  margin: 28px 0 0;
  padding-left: 18px;
  color: var(--muted);
  font-size: 11px;
  line-height: 1.9;
}
@media (max-width: 640px) {
  .takeoff-sheet {
    padding: 20px;
  }
  .sheet-heading {
    flex-direction: column;
  }
}
</style>
