<script setup lang="ts">
import { computed, nextTick, ref, shallowRef } from 'vue'
import type { Material, MaterialKind } from './types'
import { kindColors, kindLabels } from './types'
import { number } from '../shared/format'

const props = defineProps<{
  materials: Material[]
  disabled: boolean
  mode: 'add' | 'replace'
  currentMaterialId?: string
  currentLifespan?: number
}>()
const emit = defineEmits<{
  add: [material: Material]
  replace: [payload: { material: Material; adoptLifespan: boolean }]
  cancel: []
}>()

const open = ref(false)
const query = shallowRef('')
const kindFilter = shallowRef<MaterialKind | ''>('')
const selectedId = shallowRef('')
const adoptLifespan = ref(false)
const searchInput = ref<HTMLInputElement | null>(null)
let previousFocus: HTMLElement | null = null

const filtered = computed(() => {
  const needle = query.value.trim().toLocaleLowerCase()
  return props.materials.filter(
    (material) =>
      (!kindFilter.value || material.kind === kindFilter.value) &&
      (!needle || material.name.toLocaleLowerCase().includes(needle)),
  )
})
const selected = computed(() => props.materials.find((item) => item.id === selectedId.value))
const lifespanDiffers = computed(
  () =>
    props.mode === 'replace' &&
    selected.value !== undefined &&
    props.currentLifespan !== undefined &&
    selected.value.lifespan !== props.currentLifespan,
)
const confirmText = computed(() => (props.mode === 'add' ? '确认添加这一层' : '确认更换材料'))

function syncSelection() {
  if (props.mode === 'replace' && props.currentMaterialId) {
    selectedId.value = props.currentMaterialId
  } else if (!filtered.value.some((item) => item.id === selectedId.value)) {
    selectedId.value = filtered.value[0]?.id ?? ''
  }
}

async function show() {
  if (props.disabled) return
  previousFocus = document.activeElement as HTMLElement | null
  query.value = ''
  kindFilter.value = ''
  adoptLifespan.value = false
  open.value = true
  await nextTick()
  syncSelection()
  searchInput.value?.focus()
}

function close() {
  if (!open.value) return
  open.value = false
  emit('cancel')
  previousFocus?.focus?.()
}

function selectMaterial(material: Material) {
  selectedId.value = material.id
}

function chooseAndConfirm(material: Material) {
  selectMaterial(material)
  confirm()
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    event.stopPropagation()
    close()
  }
}

function confirm() {
  if (!selected.value) return
  if (props.mode === 'add') {
    emit('add', selected.value)
  } else {
    if (selected.value.id === props.currentMaterialId) {
      close()
      return
    }
    emit('replace', { material: selected.value, adoptLifespan: adoptLifespan.value })
  }
  open.value = false
  previousFocus?.focus?.()
}
</script>

<template>
  <!-- 入口：添加模式为虚线区按钮，替换模式由父组件以图标按钮具名插槽触发 -->
  <slot
    name="trigger"
    :open="show"
  >
    <div class="material-picker">
      <p class="picker-hint">从完整材料目录中选择：可按名称搜索，或按主体、保温、饰面缩小范围。</p>
      <button
        type="button"
        class="button primary"
        :disabled="disabled"
        @click="show"
      >
        ＋ 选择材料并添加构造层
      </button>
    </div>
  </slot>

  <Teleport to="body">
    <div
      v-if="open"
      class="picker-backdrop"
      @click.self="close"
    >
      <div
        class="picker-dialog"
        role="dialog"
        aria-modal="true"
        :aria-label="mode === 'add' ? '选择材料并添加构造层' : '更换本层材料'"
        tabindex="-1"
        @keydown="onKeydown"
      >
        <header class="picker-header">
          <div>
            <span class="eyebrow">{{ mode === 'add' ? '添加构造层' : '更换材料' }}</span>
            <h2>
              {{ mode === 'add' ? '选择材料，确认后成为新一层' : '选择替代材料，确认后才替换本层' }}
            </h2>
          </div>
          <button
            type="button"
            class="icon-button"
            aria-label="关闭材料选择（不改变构造层）"
            @click="close"
          >
            ×
          </button>
        </header>

        <div class="picker-filters">
          <label class="search-label"
            >按名称搜索
            <input
              ref="searchInput"
              v-model="query"
              type="search"
              placeholder="输入材料名称关键字"
              aria-label="按名称搜索材料"
            />
          </label>
          <label class="kind-label"
            >类别
            <select
              v-model="kindFilter"
              aria-label="按材料类别缩小范围"
            >
              <option value="">全部类别</option>
              <option
                v-for="(label, key) in kindLabels"
                :key="key"
                :value="key"
              >
                {{ label }}
              </option>
            </select>
          </label>
          <span class="result-count">{{ filtered.length }} 种材料</span>
        </div>

        <div
          class="picker-list"
          role="radiogroup"
          :aria-label="mode === 'add' ? '选择要添加的材料' : '选择替换用的材料'"
        >
          <button
            v-for="material in filtered"
            :key="material.id"
            type="button"
            role="radio"
            :aria-checked="material.id === selectedId"
            class="material-row"
            :class="{ selected: material.id === selectedId }"
            @click="selectMaterial(material)"
            @dblclick="chooseAndConfirm(material)"
          >
            <span
              class="row-kind"
              :style="{ backgroundColor: kindColors[material.kind] }"
              :aria-label="kindLabels[material.kind]"
            />
            <span class="row-main">
              <span class="row-title-line">
                <strong>{{ material.name }}</strong>
                <span class="tag">{{ kindLabels[material.kind] }}</span>
                <span
                  class="tag"
                  :class="material.custom ? 'tag-custom' : 'tag-sample'"
                  >{{ material.custom ? '自定义物性' : '教学示例' }}</span
                >
              </span>
              <span class="row-props">
                <span
                  >密度 <b>{{ number(material.density) }}</b> 千克/立方米</span
                >
                <span
                  >导热系数 <b>{{ number(material.conductivity) }}</b> 瓦/米·开尔文</span
                >
                <span
                  >碳因子 <b>{{ number(material.factor) }}</b> 千克当量/千克</span
                >
                <span
                  >参考寿命 <b>{{ material.lifespan }}</b> 年</span
                >
              </span>
            </span>
          </button>
          <p
            v-if="!filtered.length"
            class="picker-empty"
          >
            没有符合条件的材料，请调整搜索词或类别。
          </p>
        </div>

        <footer
          v-if="selected"
          class="picker-footer"
        >
          <div class="footer-detail">
            <p class="footer-selected">
              已选：<strong>{{ selected.name }}</strong>
              <span class="muted"
                >（{{ selected.custom ? '自定义物性' : '教学示例' }} · {{ selected.source }}）</span
              >
            </p>
            <p
              v-if="mode === 'add'"
              class="footer-note"
            >
              确认后以合理初始参数添加：{{
                selected.kind === 'structure' ? '厚度 200 毫米' : '厚度 20 毫米'
              }}，施工损耗 3%，替换寿命采用该材料参考寿命
              {{ selected.lifespan }} 年；添加后可逐项调整。
            </p>
            <template v-else>
              <p class="footer-note">替换后保留本层已有厚度与施工损耗；仅更新材料物性。</p>
              <label class="lifespan-option">
                <input
                  v-model="adoptLifespan"
                  type="checkbox"
                  :disabled="selected.id === currentMaterialId"
                />
                <span>
                  采用「{{ selected.name }}」的参考寿命
                  {{ selected.lifespan }} 年作为本层替换寿命<template
                    v-if="currentLifespan !== undefined"
                    >（不勾选则保留当前 {{ currentLifespan }} 年）</template
                  >。
                </span>
              </label>
              <p
                v-if="!lifespanDiffers && selected.id !== currentMaterialId"
                class="footer-note"
              >
                新材料的参考寿命与本层当前替换寿命一致，无需调整。
              </p>
            </template>
          </div>
          <div class="footer-actions">
            <button
              type="button"
              class="button"
              @click="close"
            >
              取消
            </button>
            <button
              type="button"
              class="button primary"
              :disabled="!selected"
              @click="confirm"
            >
              {{ confirmText }}
            </button>
          </div>
        </footer>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.material-picker {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 18px;
  border: 1px dashed #b9c8bf;
  border-radius: 6px;
  background: #f3f7f1;
}
.picker-hint {
  margin: 0;
  font-size: 12px;
  color: var(--muted);
  line-height: 1.7;
}
.picker-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(35, 48, 38, 0.42);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  z-index: 50;
}
.picker-dialog {
  background: var(--paper);
  border: 1px solid var(--line);
  border-radius: 8px;
  width: min(820px, 100%);
  max-height: calc(100vh - 48px);
  display: flex;
  flex-direction: column;
  box-shadow: 0 18px 50px rgba(24, 38, 30, 0.25);
  outline: none;
}
.picker-header {
  display: flex;
  justify-content: space-between;
  align-items: start;
  gap: 12px;
  padding: 20px 24px 14px;
  border-bottom: 1px solid var(--line);
}
.picker-header h2 {
  font-size: 16px;
  margin-top: 4px;
}
.icon-button {
  border: 0;
  background: transparent;
  padding: 6px 10px;
  color: var(--muted);
  font-size: 16px;
}
.icon-button:hover {
  color: var(--ink);
}
.picker-filters {
  display: flex;
  gap: 14px;
  align-items: end;
  padding: 16px 24px;
}
.search-label {
  flex: 1;
}
.kind-label {
  width: 150px;
}
.result-count {
  font-size: 11px;
  color: var(--muted);
  padding-bottom: 11px;
  white-space: nowrap;
}
.picker-list {
  overflow-y: auto;
  padding: 0 24px 8px;
  min-height: 120px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.material-row {
  display: flex;
  align-items: stretch;
  gap: 12px;
  text-align: left;
  width: 100%;
  border: 1px solid var(--line);
  border-radius: 6px;
  background: #fffefb;
  padding: 12px 14px;
  cursor: pointer;
}
.material-row:hover {
  border-color: #9db3a4;
  background: #f5f8f1;
}
.material-row.selected {
  border-color: var(--green);
  background: var(--green-pale);
  box-shadow: inset 0 0 0 1px var(--green);
}
.row-kind {
  width: 4px;
  border-radius: 2px;
  flex-shrink: 0;
}
.row-main {
  flex: 1;
  min-width: 0;
}
.row-title-line {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.row-title-line strong {
  font-size: 13px;
  font-weight: 600;
}
.tag {
  font-size: 10px;
  color: var(--muted);
  border: 1px solid var(--line);
  border-radius: 999px;
  padding: 1px 8px;
  background: var(--paper);
}
.tag-custom {
  color: #865629;
  border-color: #e3c79b;
  background: #fcf3de;
}
.tag-sample {
  color: var(--green);
  border-color: #c2d2c4;
  background: #eef4ea;
}
.row-props {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 18px;
  margin-top: 7px;
  font-size: 11px;
  color: var(--muted);
}
.row-props b {
  color: var(--ink);
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}
.picker-empty {
  text-align: center;
  color: var(--muted);
  font-size: 12px;
  padding: 28px 0;
}
.picker-footer {
  border-top: 1px solid var(--line);
  padding: 14px 24px;
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  gap: 18px;
  background: #f8faf4;
  border-radius: 0 0 8px 8px;
}
.footer-selected {
  margin: 0 0 6px;
  font-size: 12px;
}
.footer-note {
  margin: 4px 0 0;
  font-size: 11px;
  color: var(--muted);
  line-height: 1.6;
}
.lifespan-option {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  font-size: 11px;
  color: var(--ink);
  margin-top: 6px;
  line-height: 1.6;
}
.lifespan-option input {
  width: auto;
  margin-top: 2px;
}
.footer-actions {
  display: flex;
  gap: 8px;
  flex-shrink: 0;
}
@media (max-width: 640px) {
  .material-picker {
    flex-direction: column;
    align-items: stretch;
  }
  .picker-filters {
    flex-wrap: wrap;
  }
  .kind-label {
    width: 130px;
  }
  .picker-footer {
    flex-direction: column;
    align-items: stretch;
  }
  .footer-actions {
    justify-content: flex-end;
  }
}
</style>
