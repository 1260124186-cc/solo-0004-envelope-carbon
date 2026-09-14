<script setup lang="ts">
import { computed, shallowRef, watch } from 'vue'
import type { Assembly } from '../assemblies/types'
import type { Material } from '../materials/types'
import type { BreakdownSnapshot } from './types'
import { stateLabels } from '../assemblies/types'
import { date, number } from '../shared/format'
import { decompose } from './decompose'
import BreakdownView from './BreakdownView.vue'
import LayerImpact from './LayerImpact.vue'

const props = defineProps<{
  assemblies: Assembly[]
  materials: Material[]
  breakdowns: BreakdownSnapshot[]
  busy: boolean
  dirtyDraftId: string | null
}>()
const emit = defineEmits<{ save: [assemblyId: string]; design: [] }>()

const assemblyId = shallowRef('')
const snapshotId = shallowRef('')
const selectedLayerId = shallowRef('')

watch(
  () => props.assemblies,
  (assemblies) => {
    if (!assemblies.some((item) => item.id === assemblyId.value)) {
      assemblyId.value = assemblies[0]?.id ?? ''
    }
  },
  { immediate: true },
)
const assembly = computed(() => props.assemblies.find((item) => item.id === assemblyId.value))
watch(assembly, () => {
  snapshotId.value = ''
  selectedLayerId.value = ''
})

const evaluation = computed(() => {
  if (!assembly.value) return { breakdown: null, error: '' }
  try {
    return { breakdown: decompose(assembly.value, props.materials), error: '' }
  } catch (cause) {
    return {
      breakdown: null,
      error: cause instanceof Error ? cause.message : '无法分解该构造。',
    }
  }
})
const snapshots = computed(() =>
  props.breakdowns
    .filter((item) => item.assemblyId === assemblyId.value)
    .slice()
    .reverse(),
)
const snapshot = computed(() => snapshots.value.find((item) => item.id === snapshotId.value))
const selectedLayer = computed(() =>
  evaluation.value.breakdown?.layers.find((layer) => layer.layerId === selectedLayerId.value),
)
</script>

<template>
  <section class="panel breakdown-workspace">
    <div class="section-heading">
      <div>
        <span class="eyebrow">贡献分解</span>
        <h1>看清每一份碳，来自哪一层。</h1>
      </div>
    </div>
    <p class="section-intro">
      把生命周期隐含碳拆成初始生产与计算期内替换，按构造层和材料类别归集贡献占比；分解与计算面板严格对账。全部分解基于已保存的构造与材料版本，不随编辑中的草稿变化。
    </p>
    <div
      v-if="!assemblies.length"
      class="empty-state"
    >
      <h2>还没有已保存的构造</h2>
      <p>先在构造编辑中保存一个构造，再回来查看贡献分解。</p>
      <button
        class="button"
        @click="emit('design')"
      >
        返回构造编辑
      </button>
    </div>
    <template v-else-if="assembly">
      <div class="breakdown-selectors">
        <label
          >已保存构造
          <select
            v-model="assemblyId"
            aria-label="选择分解构造"
            :disabled="busy"
          >
            <option
              v-for="item in assemblies"
              :key="item.id"
              :value="item.id"
            >
              {{ item.name }} · 修订 {{ item.revision }} · {{ stateLabels[item.state] }}
            </option>
          </select>
        </label>
        <label
          >分解版本
          <select
            v-model="snapshotId"
            aria-label="已保存快照"
            :disabled="busy"
          >
            <option value="">当前保存版本 · 修订 {{ assembly.revision }}</option>
            <option
              v-for="item in snapshots"
              :key="item.id"
              :value="item.id"
            >
              快照 · {{ date(item.createdAt) }} · 修订 {{ item.assembly.revision }}
            </option>
          </select>
        </label>
      </div>
      <p
        v-if="dirtyDraftId === assembly.id"
        class="inline-warning"
      >
        该构造有未保存的修改，以下分解基于最近保存的修订 {{ assembly.revision }}。
      </p>
      <p
        v-if="evaluation.error"
        class="inline-warning"
        role="alert"
      >
        {{ evaluation.error }}
      </p>
      <template v-else-if="!snapshot && evaluation.breakdown">
        <BreakdownView
          :breakdown="evaluation.breakdown"
          selectable
          :selected-layer-id="selectedLayerId"
          @select="selectedLayerId = $event"
        />
        <LayerImpact
          v-if="selectedLayer"
          :assembly="assembly"
          :materials="materials"
          :layer="selectedLayer"
          :base-intensity="evaluation.breakdown.intensity"
          :base-whole="evaluation.breakdown.whole"
        />
        <p
          v-else
          class="select-hint"
        >
          在逐层明细中选中一层，查看移除或改变它会带来多大变化。
        </p>
        <div class="snapshot-actions">
          <button
            class="button primary"
            :disabled="busy"
            @click="emit('save', assembly.id)"
          >
            保存分解快照
          </button>
          <span class="muted">快照冻结当前修订与材料物性，保存后不受后续编辑影响。</span>
        </div>
      </template>
      <template v-else-if="snapshot">
        <p
          class="snapshot-banner"
          data-check="snapshot-banner"
        >
          已保存快照 · 生成于 {{ date(snapshot.createdAt) }} · 基于修订
          {{ snapshot.assembly.revision }} · 物性已冻结
        </p>
        <BreakdownView :breakdown="snapshot.breakdown" />
        <details class="frozen-materials">
          <summary>冻结物性 · {{ snapshot.materials.length }} 种材料</summary>
          <ul>
            <li
              v-for="material in snapshot.materials"
              :key="material.id"
            >
              {{ material.name }}：密度 {{ number(material.density) }} 千克/立方米 · 碳因子
              {{ material.factor }} 千克当量/千克 · 导热系数 {{ material.conductivity }} · 参考寿命
              {{ material.lifespan }} 年 · {{ material.source }}
            </li>
          </ul>
        </details>
      </template>
    </template>
  </section>
</template>

<style scoped>
.breakdown-workspace {
  max-width: 1100px;
  margin: 0 auto;
}
.breakdown-selectors {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
  margin-bottom: 20px;
}
.select-hint {
  margin: 20px 0 0;
  padding: 14px 16px;
  border: 1px dashed #ccd5c7;
  border-radius: 6px;
  color: var(--muted);
  font-size: 12px;
  text-align: center;
}
.snapshot-actions {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-top: 24px;
  border-top: 1px solid var(--line);
  padding-top: 20px;
}
.snapshot-actions .muted {
  font-size: 11px;
}
.snapshot-banner {
  margin: 0 0 8px;
  padding: 12px 16px;
  background: var(--green-pale);
  color: var(--green);
  font-size: 12px;
  border-radius: 4px;
}
.frozen-materials {
  margin-top: 16px;
  font-size: 11px;
  color: var(--muted);
}
.frozen-materials summary {
  cursor: pointer;
}
.frozen-materials ul {
  padding-left: 18px;
  line-height: 1.9;
}
@media (max-width: 650px) {
  .breakdown-selectors {
    grid-template-columns: 1fr;
  }
}
</style>
