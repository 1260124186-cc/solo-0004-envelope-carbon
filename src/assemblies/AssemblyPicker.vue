<script setup lang="ts">
import { computed, ref } from 'vue'
import type { Assembly, AssemblyState, Surface } from './types'
import { stateLabels, surfaceLabels } from './types'
import { date } from '../shared/format'

type SurfaceFilter = Surface | 'all'
type StateFilter = AssemblyState | 'all'
type SortMode = 'store' | 'recent'

const props = defineProps<{
  assemblies: Assembly[]
  selectedId: string
  draftName?: string
  busy: boolean
  canDuplicate: boolean
}>()
const emit = defineEmits<{
  select: [id: string]
  create: []
  duplicate: []
}>()

// 筛选状态只属于本控件的视图层，不写回任何构造数据。
const keyword = ref('')
const surfaceFilter = ref<SurfaceFilter>('all')
const stateFilter = ref<StateFilter>('all')
const sortMode = ref<SortMode>('store')

const hasFilters = computed(
  () => keyword.value.trim() !== '' || surfaceFilter.value !== 'all' || stateFilter.value !== 'all',
)

const filtered = computed(() => {
  const term = keyword.value.trim().toLocaleLowerCase()
  const items = props.assemblies.filter((item) => {
    if (surfaceFilter.value !== 'all' && item.surface !== surfaceFilter.value) return false
    if (stateFilter.value !== 'all' && item.state !== stateFilter.value) return false
    if (term && !item.name.toLocaleLowerCase().includes(term)) return false
    return true
  })
  if (sortMode.value === 'recent') {
    return items.slice().sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
  }
  return items
})

const selected = computed(() => props.assemblies.find((item) => item.id === props.selectedId))
const isPinnedDraft = computed(() => !selected.value)
const selectedVisible = computed(() => filtered.value.some((item) => item.id === props.selectedId))
const outsideFilter = computed(() => hasFilters.value && !selectedVisible.value)
const showPinnedOption = computed(() => isPinnedDraft.value || !selectedVisible.value)
const pinnedOptionText = computed(() => {
  if (selected.value) return `${selected.value.name} · ${stateLabels[selected.value.state]}`
  return props.draftName?.trim() ? `${props.draftName.trim()} · 未保存` : '未保存的新构造'
})

function clearFilters() {
  keyword.value = ''
  surfaceFilter.value = 'all'
  stateFilter.value = 'all'
  sortMode.value = 'store'
}

function onChange(event: Event) {
  const element = event.target as HTMLSelectElement
  const id = element.value
  if (id === props.selectedId) return
  emit('select', id)
  // 未保存修改确认被取消时，父层不会切换身份；撤销下拉的视觉变化，
  // 让控件与“当前构造”始终指向同一记录。
  element.value = props.selectedId
}
</script>

<template>
  <div class="assembly-picker">
    <div class="picker-main">
      <label class="picker-label">
        当前构造
        <select
          aria-label="当前构造"
          :value="selectedId"
          :disabled="busy"
          @change="onChange"
        >
          <option
            v-if="showPinnedOption"
            :value="selectedId"
          >
            {{ pinnedOptionText }}<template v-if="outsideFilter">（不在当前筛选内）</template>
          </option>
          <option
            v-for="item in filtered"
            :key="item.id"
            :value="item.id"
            :title="`最近修改：${date(item.updatedAt)}`"
          >
            {{ item.name }} · {{ stateLabels[item.state] }}
          </option>
        </select>
      </label>
      <div class="picker-actions">
        <button
          class="button"
          :disabled="busy"
          @click="emit('create')"
        >
          ＋ 新建构造
        </button>
        <button
          class="button"
          :disabled="busy || !canDuplicate"
          @click="emit('duplicate')"
        >
          复制为替代方案
        </button>
      </div>
      <p
        v-if="outsideFilter"
        class="picker-note"
        role="status"
      >
        当前构造「{{
          pinnedOptionText
        }}」不符合筛选条件，仍保持为当前构造；筛选只缩小候选范围，不会切换或隐藏工作区数据。
      </p>
    </div>
    <fieldset
      class="picker-filters"
      aria-label="构造候选筛选"
    >
      <legend class="sr-only">构造候选筛选</legend>
      <label>
        名称搜索
        <input
          v-model="keyword"
          type="search"
          placeholder="按构造名称查找"
          aria-label="按名称搜索构造"
        />
      </label>
      <label>
        建筑部位
        <select
          v-model="surfaceFilter"
          aria-label="按建筑部位筛选"
        >
          <option value="all">全部部位</option>
          <option
            v-for="(label, key) in surfaceLabels"
            :key="key"
            :value="key"
          >
            {{ label }}
          </option>
        </select>
      </label>
      <label>
        构造状态
        <select
          v-model="stateFilter"
          aria-label="按构造状态筛选"
        >
          <option value="all">全部状态</option>
          <option
            v-for="(label, key) in stateLabels"
            :key="key"
            :value="key"
          >
            {{ label }}
          </option>
        </select>
      </label>
      <label>
        排序
        <select
          v-model="sortMode"
          aria-label="构造排序方式"
        >
          <option value="store">保存顺序</option>
          <option value="recent">最近修改时间</option>
        </select>
      </label>
      <button
        type="button"
        class="button small filter-clear"
        :disabled="!hasFilters && sortMode === 'store'"
        @click="clearFilters"
      >
        清除筛选
      </button>
      <span
        class="filter-count"
        aria-live="polite"
      >
        共 {{ filtered.length }} / {{ assemblies.length }} 个构造
      </span>
    </fieldset>
    <div
      v-if="filtered.length === 0"
      class="picker-empty"
      role="status"
      data-check="picker-empty"
    >
      <p>
        没有符合当前筛选的构造。工作区仍是「{{ pinnedOptionText }}」，可以调整筛选，或直接新建构造。
      </p>
      <div class="picker-empty-actions">
        <button
          type="button"
          class="button small"
          :disabled="!hasFilters && sortMode === 'store'"
          @click="clearFilters"
        >
          清除筛选
        </button>
        <button
          type="button"
          class="button small primary"
          :disabled="busy"
          @click="emit('create')"
        >
          ＋ 新建构造
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.assembly-picker {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 24px;
}
.picker-main {
  display: flex;
  flex-wrap: wrap;
  gap: 20px;
  align-items: end;
  justify-content: space-between;
}
.picker-label {
  min-width: 330px;
}
.picker-label select {
  font-size: 14px;
  font-weight: 600;
  background: var(--paper);
}
.picker-actions {
  display: flex;
  gap: 8px;
}
.picker-note {
  flex-basis: 100%;
  margin: 2px 0 0;
  font-size: 11px;
  line-height: 1.7;
  color: #73581e;
}
.picker-filters {
  display: grid;
  grid-template-columns: minmax(180px, 1.4fr) repeat(3, minmax(110px, 1fr)) auto auto;
  gap: 10px;
  align-items: end;
  margin: 0;
  padding: 12px 14px;
  border: 1px solid var(--line);
  border-radius: 6px;
  background: #f6f7f0;
}
.filter-clear {
  height: 38px;
}
.filter-count {
  font-size: 11px;
  color: var(--muted);
  white-space: nowrap;
  padding-bottom: 2px;
}
.picker-empty {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  padding: 12px 16px;
  border: 1px dashed #ccd5c7;
  border-radius: 6px;
  background: #f6f7f0;
}
.picker-empty p {
  margin: 0;
  font-size: 12px;
  line-height: 1.8;
  color: var(--ink);
}
.picker-empty-actions {
  display: flex;
  gap: 8px;
  flex-shrink: 0;
}
@media (max-width: 900px) {
  .picker-filters {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .filter-count {
    grid-column: 1 / -1;
  }
}
@media (max-width: 700px) {
  .picker-main {
    align-items: stretch;
    flex-direction: column;
    gap: 12px;
  }
  .picker-label {
    min-width: 0;
  }
  .picker-actions {
    flex-wrap: wrap;
  }
  .picker-empty {
    flex-direction: column;
    align-items: stretch;
  }
  .picker-empty-actions {
    flex-wrap: wrap;
  }
}
</style>
