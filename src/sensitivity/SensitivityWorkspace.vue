<script setup lang="ts">
import { computed, ref, shallowRef, watch } from 'vue'
import type { Assembly } from '../assemblies/types'
import { surfaceLabels } from '../assemblies/types'
import type { Material } from '../materials/types'
import { date, number } from '../shared/format'
import type { SensitivityRun } from './types'
import {
  createRun,
  currentValue,
  parameterOptions,
  rangeProblems,
  runSweep,
  suggestedRange,
} from './sweep'
import SensitivityResults from './SensitivityResults.vue'
const props = defineProps<{
  assemblies: Assembly[]
  materials: Material[]
  analyses: SensitivityRun[]
  busy: boolean
  dirty: boolean
}>()
const emit = defineEmits<{ save: [run: SensitivityRun]; design: [] }>()
const assemblyId = shallowRef('')
const parameterKey = shallowRef('')
const lower = ref(0)
const upper = ref(0)
const step = ref(0)
const selectedRunId = shallowRef('')
const assembly = computed(() => props.assemblies.find((item) => item.id === assemblyId.value))
const options = computed(() =>
  assembly.value ? parameterOptions(assembly.value, props.materials) : [],
)
const thicknessOptions = computed(() =>
  options.value.filter((item) => item.parameter.kind === 'thickness'),
)
const propertyOptions = computed(() =>
  options.value.filter((item) => item.parameter.kind !== 'thickness'),
)
const option = computed(
  () => options.value.find((item) => item.key === parameterKey.value) ?? options.value[0],
)
watch(
  () => props.assemblies,
  (assemblies) => {
    if (!assemblies.some((item) => item.id === assemblyId.value)) {
      assemblyId.value = assemblies[0]?.id ?? ''
    }
  },
  { immediate: true },
)
watch(assemblyId, () => {
  parameterKey.value = ''
})
watch(
  () => option.value?.key,
  () => {
    if (!option.value) return
    const suggested = suggestedRange(option.value)
    lower.value = suggested.lower
    upper.value = suggested.upper
    step.value = suggested.step
  },
  { immediate: true },
)
const problems = computed(() =>
  option.value ? rangeProblems(option.value, lower.value, upper.value, step.value) : [],
)
const sweep = computed(() => {
  if (!assembly.value || !option.value || problems.value.length) return null
  try {
    return runSweep(
      assembly.value,
      props.materials,
      option.value,
      lower.value,
      upper.value,
      step.value,
    )
  } catch {
    return null
  }
})
const sharedLayers = computed(() =>
  option.value && option.value.parameter.kind !== 'thickness' ? option.value.layers : 0,
)
const runs = computed(() => [...props.analyses].reverse())
watch(
  runs,
  (list) => {
    if (!list.some((run) => run.id === selectedRunId.value)) {
      selectedRunId.value = list[0]?.id ?? ''
    }
  },
  { immediate: true },
)
const selectedRun = computed(() => props.analyses.find((run) => run.id === selectedRunId.value))
const selectedRunCurrent = computed(() =>
  selectedRun.value
    ? currentValue(
        selectedRun.value.assembly,
        selectedRun.value.materials,
        selectedRun.value.parameter,
      )
    : undefined,
)
function numeric(event: Event): number {
  return (event.target as HTMLInputElement).valueAsNumber
}
function save() {
  if (!assembly.value || !option.value || !sweep.value || props.busy) return
  const run = createRun(
    assembly.value,
    props.materials,
    option.value,
    lower.value,
    upper.value,
    step.value,
  )
  selectedRunId.value = run.id
  emit('save', run)
}
</script>

<template>
  <section class="panel sensitivity-workspace">
    <span class="eyebrow">敏感性分析</span>
    <h1>一个参数变化，结果会走多远。</h1>
    <p class="section-intro">
      选择已保存构造，扫描某一层厚度或某一材料的关键物性：其余条件保持不变，逐一计算范围内候选的隐含碳强度与传热系数，标出达到构造目标的候选与跨越目标边界的临界点。分析在构造副本上进行，不修改原构造，中间候选也不会保存为正式构造。
    </p>
    <div
      v-if="!assemblies.length"
      class="empty-state"
    >
      <h2>还没有可分析的构造</h2>
      <p>返回构造编辑，保存一个构造后即可开始敏感性分析。</p>
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
        编辑区仍有未保存修改，以下分析基于最近保存版本。
      </p>
      <div class="sensitivity-setup">
        <label
          >分析构造
          <select
            v-model="assemblyId"
            aria-label="分析构造"
            :disabled="busy"
          >
            <option
              v-for="item in assemblies"
              :key="item.id"
              :value="item.id"
            >
              {{ item.name }}
            </option>
          </select>
        </label>
        <label
          >扫描参数
          <select
            v-model="parameterKey"
            aria-label="扫描参数"
            :disabled="busy"
          >
            <optgroup label="构造层厚度">
              <option
                v-for="item in thicknessOptions"
                :key="item.key"
                :value="item.key"
              >
                {{ item.label }}
              </option>
            </optgroup>
            <optgroup label="材料物性">
              <option
                v-for="item in propertyOptions"
                :key="item.key"
                :value="item.key"
              >
                {{ item.label }}
              </option>
            </optgroup>
          </select>
        </label>
        <template v-if="option">
          <label
            >下限（{{ option.unit }}）
            <input
              type="number"
              :value="lower"
              aria-label="扫描下限"
              :disabled="busy"
              @input="lower = numeric($event)"
            />
          </label>
          <label
            >上限（{{ option.unit }}）
            <input
              type="number"
              :value="upper"
              aria-label="扫描上限"
              :disabled="busy"
              @input="upper = numeric($event)"
            />
          </label>
          <label
            >步长（{{ option.unit }}）
            <input
              type="number"
              :value="step"
              aria-label="扫描步长"
              :disabled="busy"
              @input="step = numeric($event)"
            />
          </label>
        </template>
      </div>
      <template v-if="option && assembly">
        <p class="parameter-note">
          当前值 {{ number(option.current) }} {{ option.unit }} · 允许范围
          {{ number(option.min) }} 至 {{ number(option.max) }} {{ option.unit }}
          <template v-if="sharedLayers > 1">
            · 该材料被 {{ sharedLayers }} 层引用，物性扫描同时作用于这些层，其余参数保持不变
          </template>
          <template v-else-if="option.parameter.kind === 'thickness'">
            · 厚度扫描只改变所选构造层，同材料的其他层保持不变
          </template>
        </p>
        <ul
          v-if="problems.length"
          class="setup-problems"
        >
          <li
            v-for="problem in problems"
            :key="problem"
          >
            {{ problem }}
          </li>
        </ul>
        <SensitivityResults
          v-if="sweep"
          :points="sweep.points"
          :crossings="sweep.crossings"
          :label="option.label"
          :unit="option.unit"
          :current="option.current"
          :carbon-limit="assembly.carbonLimit"
          :thermal-limit="assembly.thermalLimit"
        />
        <div class="sensitivity-actions">
          <button
            class="button primary"
            :disabled="busy || !sweep"
            @click="save"
          >
            保存本次分析
          </button>
          <span class="save-hint">仅保存分析记录与输入快照，不生成新构造。</span>
        </div>
      </template>
      <div
        v-if="runs.length"
        class="saved-analyses"
      >
        <div class="section-heading">
          <div>
            <span class="eyebrow">复核</span>
            <h2>已保存的分析</h2>
          </div>
        </div>
        <label class="run-select"
          >分析记录
          <select
            v-model="selectedRunId"
            aria-label="分析记录"
          >
            <option
              v-for="run in runs"
              :key="run.id"
              :value="run.id"
            >
              {{ date(run.createdAt) }} · {{ run.assembly.name }} · {{ run.label }}
            </option>
          </select>
        </label>
        <article
          v-if="selectedRun"
          class="run-review"
          data-check="saved-run"
        >
          <p class="run-meta">
            构造「{{ selectedRun.assembly.name }}」 · 修订 {{ selectedRun.assembly.revision }} ·
            {{ surfaceLabels[selectedRun.assembly.surface] }} ·
            {{ number(selectedRun.assembly.area) }} 平方米 · {{ selectedRun.assembly.years }} 年 ·
            保存于 {{ date(selectedRun.createdAt) }}
          </p>
          <p class="run-meta">
            扫描 {{ selectedRun.label }}：{{ number(selectedRun.lower) }} 至
            {{ number(selectedRun.upper) }} {{ selectedRun.unit }}，步长
            {{ number(selectedRun.step) }} {{ selectedRun.unit }} · 目标：碳强度 ≤
            {{ number(selectedRun.assembly.carbonLimit) }}，传热系数 ≤
            {{ number(selectedRun.assembly.thermalLimit) }}
          </p>
          <div class="table-scroll">
            <table>
              <caption>
                分析时冻结的材料物性
              </caption>
              <thead>
                <tr>
                  <th scope="col">材料</th>
                  <th scope="col">密度（千克/立方米）</th>
                  <th scope="col">导热系数（瓦/米·开尔文）</th>
                  <th scope="col">碳因子（千克当量/千克）</th>
                  <th scope="col">参数来源</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="material in selectedRun.materials"
                  :key="material.id"
                >
                  <th scope="row">{{ material.name }}</th>
                  <td>{{ number(material.density) }}</td>
                  <td>{{ number(material.conductivity) }}</td>
                  <td>{{ number(material.factor) }}</td>
                  <td>{{ material.source }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <SensitivityResults
            :points="selectedRun.points"
            :crossings="selectedRun.crossings"
            :label="selectedRun.label"
            :unit="selectedRun.unit"
            :current="selectedRunCurrent"
            :carbon-limit="selectedRun.assembly.carbonLimit"
            :thermal-limit="selectedRun.assembly.thermalLimit"
          />
          <p class="run-frozen">
            本记录冻结分析时采用的构造与物性，后续构造或材料修改不影响此结果。
          </p>
        </article>
      </div>
    </template>
  </section>
</template>

<style scoped>
.sensitivity-workspace {
  max-width: 1100px;
  margin: 0 auto;
}
.sensitivity-setup {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 16px;
  align-items: end;
  margin-bottom: 8px;
}
.parameter-note {
  font-size: 11px;
  color: var(--muted);
  line-height: 1.8;
  margin: 10px 0 18px;
}
.setup-problems {
  color: #945038;
  font-size: 12px;
  line-height: 1.8;
  padding-left: 18px;
  margin: 0 0 18px;
}
.sensitivity-actions {
  display: flex;
  align-items: center;
  gap: 14px;
  border-top: 1px solid var(--line);
  margin-top: 8px;
  padding-top: 20px;
}
.save-hint {
  font-size: 11px;
  color: var(--muted);
}
.saved-analyses {
  border-top: 1px solid var(--line);
  margin-top: 32px;
  padding-top: 24px;
}
.run-select {
  max-width: 520px;
  margin: 18px 0;
}
.run-review {
  border: 1px solid var(--line);
  border-radius: 6px;
  padding: 24px;
}
.run-meta {
  font-size: 11px;
  color: var(--muted);
  line-height: 1.8;
  margin: 6px 0;
}
.run-frozen {
  font-size: 11px;
  color: var(--muted);
  border-top: 1px solid var(--line);
  padding-top: 14px;
  margin-bottom: 0;
}
@media (max-width: 900px) {
  .sensitivity-setup {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
@media (max-width: 560px) {
  .sensitivity-setup {
    grid-template-columns: 1fr;
  }
}
</style>
