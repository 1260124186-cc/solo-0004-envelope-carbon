<script setup lang="ts">
import { computed } from 'vue'
import type { CarbonDocument } from '../documents/types'
import { number } from '../shared/format'
import { surfaceLabels } from '../assemblies/types'
const props = defineProps<{ documents: CarbonDocument[]; chosenId: string }>()
const rows: {
  label: string
  value: (document: CarbonDocument) => string
  check?: string
}[] = [
  { label: '建筑部位', value: (document) => surfaceLabels[document.assembly.surface] },
  { label: '构造面积（平方米）', value: (document) => number(document.assembly.area) },
  { label: '计算年限（年）', value: (document) => String(document.assembly.years) },
  {
    label: '生命周期强度（千克当量/平方米）',
    value: (document) => number(document.result.intensity),
    check: 'decision-intensity',
  },
  {
    label: '整个构造隐含碳（千克当量）',
    value: (document) => number(document.result.whole),
  },
  {
    label: '传热系数（瓦/平方米·开尔文）',
    value: (document) => number(document.result.transmittance),
  },
  {
    label: '碳强度目标',
    value: (document) => (document.result.carbonPass ? '满足' : '超出'),
  },
  {
    label: '传热上限',
    value: (document) => (document.result.thermalPass ? '满足' : '超出'),
  },
]
const aligned = computed(() => {
  const [first, ...rest] = props.documents
  if (!first || !rest.length) return true
  return rest.every(
    (document) =>
      document.assembly.surface === first.assembly.surface &&
      document.assembly.area === first.assembly.area &&
      document.assembly.years === first.assembly.years,
  )
})
</script>

<template>
  <div class="decision-values">
    <p
      v-if="!aligned"
      class="inline-warning"
    >
      引用的计算书在部位、面积或年限上不一致，对照数值时请注意口径差异。
    </p>
    <div class="table-scroll">
      <table>
        <caption>
          各引用计算书在定稿时冻结的关键数值
        </caption>
        <thead>
          <tr>
            <th scope="col">计算项</th>
            <th
              v-for="document in documents"
              :key="document.id"
              scope="col"
            >
              {{ document.assembly.name }} · 修订 {{ document.assembly.revision }}
              <span
                v-if="document.id === chosenId"
                class="chosen-mark"
                >✓ 采用</span
              >
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="row in rows"
            :key="row.label"
          >
            <th scope="row">{{ row.label }}</th>
            <td
              v-for="document in documents"
              :key="document.id"
              :data-check="row.check"
            >
              {{ row.value(document) }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <div class="value-sources">
      <div
        v-for="document in documents"
        :key="document.id"
      >
        <h3>参数来源 · {{ document.assembly.name }} · 修订 {{ document.assembly.revision }}</h3>
        <p
          v-for="material in document.materials"
          :key="material.id"
        >
          {{ material.name }}：{{ material.source }}
        </p>
      </div>
    </div>
    <p class="values-note">
      以上数值与参数来源来自定稿时冻结的计算书版本，构造后续的修改与重新定稿不影响本表。
    </p>
  </div>
</template>

<style scoped>
.chosen-mark {
  display: block;
  color: var(--green);
  font-size: 10px;
  margin-top: 4px;
}
.value-sources {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 16px;
  font-size: 11px;
  color: var(--muted);
  line-height: 1.8;
}
.value-sources h3 {
  font-size: 11px;
  color: var(--ink);
  margin-bottom: 4px;
}
.value-sources p {
  margin: 2px 0;
}
.values-note {
  font-size: 10px;
  color: var(--muted);
  margin-top: 16px;
}
</style>
