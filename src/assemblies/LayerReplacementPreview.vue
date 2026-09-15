<script setup lang="ts">
import { computed } from 'vue'
import type { Layer } from './types'
import type { Material } from '../materials/types'
import { layerCarbonBasis, replacementYears } from '../carbon/engine'
import { inRange } from './validation'
import { number } from '../shared/format'

const props = defineProps<{ layer: Layer; material: Material; years: number }>()

const ready = computed(
  () =>
    inRange(props.years, 1, 150) &&
    Number.isInteger(props.years) &&
    inRange(props.layer.thickness, 0.1, 2000) &&
    inRange(props.layer.loss, 0, 50) &&
    inRange(props.layer.lifespan, 1, 150) &&
    Number.isInteger(props.layer.lifespan),
)
const schedule = computed(() =>
  ready.value ? replacementYears(props.years, props.layer.lifespan) : [],
)
const basis = computed(() => layerCarbonBasis(props.layer, props.material))
const replacementTotal = computed(() => basis.value.initial * schedule.value.length)
const excludedAtEnd = computed(() => ready.value && props.years % props.layer.lifespan === 0)
const yearList = computed(() => {
  const years = schedule.value
  const label = (year: number) => `第 ${year} 年`
  if (years.length <= 6) return years.map(label).join('、')
  return `${years.slice(0, 3).map(label).join('、')} … ${label(years[years.length - 1])}`
})
</script>

<template>
  <div
    class="replacement-preview"
    aria-live="polite"
  >
    <template v-if="ready">
      <p class="preview-heading">替换预览 · 随输入更新</p>
      <p v-if="schedule.length">
        {{ years }} 年计算期内替换 {{ schedule.length }} 次：{{ yearList }}
      </p>
      <p v-else>{{ years }} 年计算期内无需替换，本层寿命已覆盖计算期。</p>
      <p>
        每次替换按相同材料参数计算，与初始同为
        {{ number(basis.initial) }} 千克当量/平方米；替换部分合计
        {{ number(replacementTotal) }} 千克当量/平方米。
      </p>
      <p
        v-if="excludedAtEnd"
        class="preview-exclusion"
      >
        第 {{ years }} 年的一次恰在计算期终点，按规则不计入。
      </p>
    </template>
    <p
      v-else
      class="preview-pending"
    >
      输入有效的厚度、损耗、替换寿命与计算年限后，此处预览本层替换安排。
    </p>
  </div>
</template>

<style scoped>
.replacement-preview {
  margin-top: 10px;
  padding: 10px 12px;
  background: var(--green-pale);
  border-radius: 4px;
  font-size: 10px;
  line-height: 1.7;
  color: var(--muted);
}
.replacement-preview p {
  margin: 4px 0;
}
.preview-heading {
  color: var(--green);
  letter-spacing: 0.6px;
}
.preview-exclusion {
  color: #865629;
}
.preview-pending {
  color: var(--muted);
}
</style>
