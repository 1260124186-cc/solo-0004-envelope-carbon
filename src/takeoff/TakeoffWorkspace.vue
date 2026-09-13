<script setup lang="ts">
import { computed, shallowRef, watch } from 'vue'
import type { Assembly } from '../assemblies/types'
import type { Material } from '../materials/types'
import type { TakeoffMode } from './types'
import { createTakeoff } from './create'
import { stateLabels, surfaceLabels } from '../assemblies/types'
import TakeoffSheet from './TakeoffSheet.vue'
const props = defineProps<{
  assemblies: Assembly[]
  materials: Material[]
  busy: boolean
  dirty: boolean
}>()
const emit = defineEmits<{ design: [] }>()
const chosen = shallowRef<string[]>([])
const mode = shallowRef<TakeoffMode>('assembly')

watch(
  () => props.assemblies.map((item) => item.id).join('|'),
  () => {
    const valid = new Set(props.assemblies.map((item) => item.id))
    const retained = chosen.value.filter((id) => valid.has(id))
    const fresh = props.assemblies.map((item) => item.id).filter((id) => !retained.includes(id))
    chosen.value = [...retained, ...fresh]
  },
  { immediate: true },
)

const report = computed(() =>
  chosen.value.length
    ? createTakeoff(chosen.value, props.assemblies, props.materials, mode.value)
    : null,
)
const chosenSet = computed(() => new Set(chosen.value))

function toggle(id: string) {
  chosen.value = chosenSet.value.has(id)
    ? chosen.value.filter((item) => item !== id)
    : [...chosen.value, id]
}

function selectAll() {
  chosen.value = props.assemblies.map((item) => item.id)
}

function clearAll() {
  chosen.value = []
}
</script>

<template>
  <section class="panel takeoff-workspace">
    <div class="section-heading">
      <div>
        <span class="eyebrow">方案估算</span>
        <h1>把已保存构造的材料，合并成一份用量清单。</h1>
      </div>
    </div>
    <p class="section-intro">
      清单只读已保存构造，不会修改任何构造或计算书。各构造层的材料按种类合并，保留每个用量来自哪个构造的哪一层；替换与生命周期隐含碳按计算年限分组，不同年限不混算。
    </p>
    <p
      v-if="dirty"
      class="inline-warning"
    >
      编辑区仍有未保存修改，清单仅使用最近一次保存的构造版本。
    </p>

    <div
      v-if="!assemblies.length"
      class="empty-state"
    >
      <h2>还没有已保存构造</h2>
      <p>返回构造编辑，先保存一个或多个构造。</p>
      <button
        class="button primary"
        @click="emit('design')"
      >
        返回构造编辑
      </button>
    </div>
    <template v-else>
      <fieldset
        class="assembly-select"
        :disabled="busy"
      >
        <legend>选择构造（可多选）</legend>
        <div class="select-tools">
          <button
            class="button small"
            type="button"
            @click="selectAll"
          >
            全选
          </button>
          <button
            class="button small"
            type="button"
            @click="clearAll"
          >
            清空
          </button>
          <span class="muted">已选 {{ chosen.length }} / {{ assemblies.length }}</span>
        </div>
        <ul class="assembly-options">
          <li
            v-for="item in assemblies"
            :key="item.id"
          >
            <label class="option">
              <input
                type="checkbox"
                :checked="chosenSet.has(item.id)"
                :disabled="busy"
                @change="toggle(item.id)"
              />
              <span class="option-name">{{ item.name }}</span>
              <span class="option-meta">
                {{ surfaceLabels[item.surface] }} · {{ item.area }} 平方米 · {{ item.years }} 年 ·
                {{ stateLabels[item.state] }} · 修订 {{ item.revision }}
              </span>
            </label>
          </li>
        </ul>
      </fieldset>

      <div
        v-if="report"
        class="mode-bar"
        role="group"
        aria-label="清单分组方式"
      >
        <button
          class="button"
          :class="{ primary: mode === 'assembly' }"
          :disabled="busy"
          @click="mode = 'assembly'"
        >
          按构造分组
        </button>
        <button
          class="button"
          :class="{ primary: mode === 'material' }"
          :disabled="busy"
          @click="mode = 'material'"
        >
          按材料汇总
        </button>
      </div>

      <div
        v-if="report && report.selectedCount === 0"
        class="empty-state"
      >
        选中的构造都无法纳入清单，请先在构造编辑中修正输入。
      </div>
      <TakeoffSheet
        v-else-if="report"
        :report="report"
      />
    </template>
  </section>
</template>

<style scoped>
.takeoff-workspace {
  max-width: 1200px;
  margin: 0 auto;
}
.assembly-select {
  border: 1px solid var(--line);
  border-radius: 6px;
  padding: 16px 20px 20px;
  margin: 20px 0;
}
.assembly-select legend {
  padding: 0 8px;
  font-size: 12px;
  color: var(--muted);
}
.select-tools {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}
.select-tools span {
  font-size: 11px;
}
.assembly-options {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px 20px;
}
.option {
  display: flex;
  align-items: baseline;
  gap: 10px;
  font-size: 12px;
  color: var(--ink);
  cursor: pointer;
}
.option input {
  width: auto;
}
.option-name {
  font-weight: 600;
  white-space: nowrap;
}
.option-meta {
  color: var(--muted);
  font-size: 11px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.mode-bar {
  display: flex;
  gap: 8px;
  margin: 20px 0;
}
@media (max-width: 760px) {
  .assembly-options {
    grid-template-columns: 1fr;
  }
}
</style>
