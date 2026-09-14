<script setup lang="ts">
import { computed } from 'vue'
import type { Assembly } from '../assemblies/types'
import type { Material } from '../materials/types'
import { compare, comparableReasons, compareAlternatives } from './compare'
import ComparisonOverview from './ComparisonOverview.vue'
import ComparisonResult from './ComparisonResult.vue'
const props = defineProps<{
  assemblies: Assembly[]
  materials: Material[]
  busy: boolean
  dirty: boolean
}>()
const baselineId = defineModel<string>('baselineId', { required: true })
const alternativeId = defineModel<string>('alternativeId', { required: true })
const alternativeIds = defineModel<string[]>('alternativeIds', { required: true })
const emit = defineEmits<{ align: []; design: [] }>()
const baseline = computed(() => props.assemblies.find((item) => item.id === baselineId.value))
const alternative = computed(() => props.assemblies.find((item) => item.id === alternativeId.value))
const participants = computed(() =>
  props.assemblies.filter(
    (item) => item.id !== baselineId.value && alternativeIds.value.includes(item.id),
  ),
)
const overview = computed(() => {
  if (!baseline.value) return null
  try {
    return compareAlternatives(baseline.value, participants.value, props.materials)
  } catch {
    return null
  }
})
const evaluation = computed(() => {
  if (!baseline.value || !alternative.value)
    return { result: null, errors: ['请选择基准构造和替代构造。'] }
  const errors = comparableReasons(baseline.value, alternative.value)
  if (errors.length) return { result: null, errors }
  try {
    return { result: compare(baseline.value, alternative.value, props.materials), errors: [] }
  } catch (error) {
    return {
      result: null,
      errors: [error instanceof Error ? error.message : '无法比较这两个构造。'],
    }
  }
})
const canAlign = computed(
  () =>
    baseline.value &&
    alternative.value &&
    baseline.value.id !== alternative.value.id &&
    alternative.value.state === 'editing',
)
function toggle(id: string) {
  alternativeIds.value = alternativeIds.value.includes(id)
    ? alternativeIds.value.filter((item) => item !== id)
    : [...alternativeIds.value, id]
}
</script>

<template>
  <section class="panel comparison-workspace">
    <span class="eyebrow">替代研究</span>
    <h1>在相同条件下，比较材料选择。</h1>
    <p class="section-intro">
      比较使用已保存的构造。先复制基准，再改变材料或厚度，以便追溯每一次设计变化。
    </p>
    <div
      v-if="assemblies.length < 2"
      class="empty-state"
    >
      <h2>还需要一个替代构造</h2>
      <p>返回构造编辑，使用「复制为替代方案」，修改并保存后即可比较。</p>
      <button
        class="button primary"
        @click="emit('design')"
      >
        返回构造编辑
      </button>
    </div>
    <template v-else>
      <p
        v-if="dirty"
        class="inline-warning"
      >
        编辑区仍有未保存修改，以下结果来自最近保存版本。
      </p>
      <label class="baseline-select"
        >基准构造（总览与详细比较共用）
        <select
          v-model="baselineId"
          :disabled="busy"
        >
          <option
            value=""
            disabled
          >
            选择基准
          </option>
          <option
            v-for="item in assemblies"
            :key="item.id"
            :value="item.id"
          >
            {{ item.name }}
          </option>
        </select>
      </label>
      <section
        class="overview-block"
        aria-label="多替代总览"
      >
        <h2>多替代总览</h2>
        <p class="section-intro">
          勾选参与总览的替代构造。所有差值与相对比例以同一基准为参照，口径不一致的构造会被排除并说明原因。
        </p>
        <div
          class="alternative-checks"
          role="group"
          aria-label="参与总览的替代构造"
        >
          <label
            v-for="item in assemblies"
            :key="item.id"
            class="alternative-check"
          >
            <input
              type="checkbox"
              :checked="item.id !== baselineId && alternativeIds.includes(item.id)"
              :disabled="busy || item.id === baselineId"
              @change="toggle(item.id)"
            />
            <span
              >{{ item.name }}<template v-if="item.id === baselineId">（当前基准）</template></span
            >
          </label>
        </div>
        <p
          v-if="!participants.length"
          class="empty-state"
        >
          尚未勾选替代构造。
        </p>
        <ComparisonOverview
          v-else-if="overview && baseline"
          :overview="overview"
          :baseline-name="baseline.name"
        />
      </section>
      <section
        class="pair-block"
        aria-label="两方案详细比较"
      >
        <h2>两方案详细比较</h2>
        <label class="pair-select"
          >替代构造
          <select
            v-model="alternativeId"
            :disabled="busy"
          >
            <option
              value=""
              disabled
            >
              选择替代
            </option>
            <option
              v-for="item in assemblies"
              :key="item.id"
              :value="item.id"
            >
              {{ item.name }}
            </option>
          </select>
        </label>
        <div
          v-if="evaluation.errors.length"
          class="empty-state"
        >
          <p
            v-for="error in evaluation.errors"
            :key="error"
          >
            {{ error }}
          </p>
          <button
            v-if="canAlign"
            class="button"
            :disabled="busy || dirty"
            @click="emit('align')"
          >
            将替代构造统一为基准口径
          </button>
        </div>
        <ComparisonResult
          v-if="evaluation.result && baseline && alternative"
          :result="evaluation.result"
          :baseline-name="baseline.name"
          :alternative-name="alternative.name"
        />
      </section>
    </template>
  </section>
</template>

<style scoped>
.comparison-workspace {
  max-width: 1100px;
  margin: 0 auto;
}
.baseline-select {
  max-width: 380px;
  margin: 28px 0 0;
}
.overview-block,
.pair-block {
  margin-top: 32px;
  padding-top: 28px;
  border-top: 1px solid var(--line);
}
.overview-block h2,
.pair-block h2 {
  margin: 0;
}
.alternative-checks {
  display: flex;
  flex-wrap: wrap;
  gap: 12px 24px;
  margin-bottom: 22px;
}
.alternative-check {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: var(--ink);
}
.alternative-check input {
  width: auto;
  margin: 0;
}
.pair-select {
  max-width: 380px;
  margin: 18px 0 24px;
}
</style>
