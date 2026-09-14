<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { Assembly } from '../assemblies/types'
import type { Material } from '../materials/types'
import type { BreakdownLayer } from './types'
import { calculate } from '../carbon/engine'
import { number, percent, signed, signedPercent } from '../shared/format'
import { kindLabels } from '../materials/types'

const props = defineProps<{
  assembly: Assembly
  materials: Material[]
  layer: BreakdownLayer
  baseIntensity: number
  baseWhole: number
}>()

const removal = computed(() => {
  if (props.assembly.layers.length <= 1) return null
  const next = {
    ...props.assembly,
    layers: props.assembly.layers.filter((item) => item.id !== props.layer.layerId),
  }
  return calculate(next, props.materials)
})
const removalDelta = computed(() =>
  removal.value ? removal.value.intensity - props.baseIntensity : null,
)
const removalPercent = computed(() =>
  removal.value && props.baseIntensity !== 0
    ? (removal.value.intensity - props.baseIntensity) / props.baseIntensity
    : null,
)

const thicknessText = ref(String(props.layer.thickness))
watch(
  () => props.layer.layerId,
  () => {
    thicknessText.value = String(props.layer.thickness)
  },
)
const thickness = computed(() => Number(thicknessText.value))
const thicknessValid = computed(
  () => Number.isFinite(thickness.value) && thickness.value >= 0.1 && thickness.value <= 2000,
)
const thicknessResult = computed(() => {
  if (!thicknessValid.value) return null
  const next = {
    ...props.assembly,
    layers: props.assembly.layers.map((item) =>
      item.id === props.layer.layerId ? { ...item, thickness: thickness.value } : item,
    ),
  }
  return calculate(next, props.materials)
})
</script>

<template>
  <section
    class="layer-impact"
    aria-label="构造层影响试算"
  >
    <div class="impact-heading">
      <h2>第 {{ layer.order }} 层 · {{ layer.materialName }}</h2>
      <span class="muted"
        >{{ kindLabels[layer.kind] }} · 当前合计 {{ number(layer.total) }} 千克当量/平方米 · 占比
        {{ percent(layer.share) }}</span
      >
    </div>
    <div class="impact-grid">
      <div class="impact-block">
        <h3>移除这一层</h3>
        <template v-if="removal">
          <p>
            强度变为 <strong>{{ number(removal.intensity) }}</strong> 千克当量/平方米（<span
              data-check="removal-delta"
              >{{ signed(removalDelta!) }}</span
            >，{{ signedPercent(removalPercent!) }}）
          </p>
          <p>
            总量变为 <strong>{{ number(removal.whole) }}</strong> 千克当量（{{
              signed(removal.whole - baseWhole)
            }}
            千克当量）
          </p>
        </template>
        <p v-else>构造至少保留一层，无法试算移除。</p>
      </div>
      <div class="impact-block">
        <h3>改变这一层厚度</h3>
        <label
          >试算厚度（毫米）
          <input
            v-model="thicknessText"
            type="number"
            min="0.1"
            max="2000"
            step="0.1"
            aria-label="试算厚度（毫米）"
          />
        </label>
        <p v-if="!thicknessValid">厚度需在 0.1 至 2,000 毫米之间。</p>
        <template v-else-if="thicknessResult">
          <p>
            强度变为 <strong>{{ number(thicknessResult.intensity) }}</strong> 千克当量/平方米（<span
              data-check="thickness-delta"
              >{{ signed(thicknessResult.intensity - baseIntensity) }}</span
            >）
          </p>
          <p>
            总量变为 <strong>{{ number(thicknessResult.whole) }}</strong> 千克当量（{{
              signed(thicknessResult.whole - baseWhole)
            }}
            千克当量）
          </p>
        </template>
      </div>
    </div>
    <p class="impact-note">试算基于已保存的修订 {{ assembly.revision }}，不会改动构造。</p>
  </section>
</template>

<style scoped>
.layer-impact {
  margin-top: 24px;
  border: 1px solid var(--line);
  border-left: 3px solid var(--green);
  border-radius: 6px;
  padding: 20px 24px;
  background: #f8f9f3;
}
.impact-heading {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
}
.impact-heading h2 {
  font-size: 16px;
}
.impact-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 24px;
  margin-top: 16px;
}
.impact-block h3 {
  font-size: 12px;
  margin: 0 0 10px;
}
.impact-block p {
  font-size: 12px;
  color: var(--muted);
  margin: 8px 0;
  line-height: 1.8;
}
.impact-block strong {
  color: var(--green);
  font-size: 16px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}
.impact-block label {
  max-width: 200px;
  margin-bottom: 10px;
}
.impact-note {
  margin: 16px 0 0;
  font-size: 10px;
  color: var(--muted);
}
@media (max-width: 700px) {
  .impact-grid {
    grid-template-columns: 1fr;
  }
}
</style>
