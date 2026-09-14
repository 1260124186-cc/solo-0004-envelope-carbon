<script setup lang="ts">
import { computed } from 'vue'
import type { Assembly } from '../assemblies/types'
import type { Material } from '../materials/types'
import { compare, comparableReasons } from './compare'
import ComparisonResult from './ComparisonResult.vue'
const props = defineProps<{
  assemblies: Assembly[]
  materials: Material[]
  busy: boolean
  dirty: boolean
}>()
const baselineId = defineModel<string>('baselineId', { required: true })
const alternativeId = defineModel<string>('alternativeId', { required: true })
const emit = defineEmits<{ align: []; design: [] }>()
const baseline = computed(() => props.assemblies.find((item) => item.id === baselineId.value))
const alternative = computed(() => props.assemblies.find((item) => item.id === alternativeId.value))
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
const canSwap = computed(() => Boolean(baseline.value && alternative.value))
function swapSchemes() {
  // 交换基准与替代：对调两个标识后由 evaluation 重新调用 compare，
  // 差值、相对比例、达标状态与同口径校验均以新基准重算，而非仅调换列名。
  if (!canSwap.value) return
  const previousBaseline = baselineId.value
  baselineId.value = alternativeId.value
  alternativeId.value = previousBaseline
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
      <div class="comparison-selectors">
        <label
          >基准构造
          <select
            v-model="baselineId"
            aria-label="基准构造"
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
        <div class="comparison-swap">
          <span
            class="comparison-arrow"
            aria-hidden="true"
            >→</span
          >
          <button
            type="button"
            class="button small"
            data-check="swap-schemes"
            :disabled="busy || !canSwap"
            title="对调基准与替代，并以新基准重算全部差值"
            @click="swapSchemes"
          >
            ⇄ 交换基准与替代
          </button>
        </div>
        <label
          >替代构造
          <select
            v-model="alternativeId"
            aria-label="替代构造"
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
      </div>
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
    </template>
  </section>
</template>

<style scoped>
.comparison-workspace {
  max-width: 1100px;
  margin: 0 auto;
}
.comparison-selectors {
  display: grid;
  grid-template-columns: 1fr 30px 1fr;
  align-items: end;
  gap: 20px;
  margin: 28px 0;
}
.comparison-swap {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding-bottom: 4px;
}
.comparison-arrow {
  color: var(--green);
}
@media (max-width: 650px) {
  .comparison-selectors {
    grid-template-columns: 1fr;
    gap: 12px;
  }
  .comparison-swap {
    flex-direction: row;
    justify-content: center;
  }
}
</style>
