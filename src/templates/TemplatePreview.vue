<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue'
import type { ConstructionTemplate } from './types'
import { surfaceLabels } from '../assemblies/types'
import type { Material } from '../materials/types'
import { kindLabels } from '../materials/types'
import { number } from '../shared/format'
const props = defineProps<{
  template: ConstructionTemplate
  materials: Material[]
  missing: { index: number; materialId: string }[]
  busy: boolean
}>()
const emit = defineEmits<{
  apply: []
  close: []
}>()
const dialog = ref<HTMLElement | null>(null)
const resolved = computed(() =>
  props.template.layers.map((layer, index) => ({
    layer,
    index,
    material: props.materials.find((item) => item.id === layer.materialId),
  })),
)
const totalThickness = computed(() =>
  props.template.layers.reduce((sum, layer) => sum + layer.thickness, 0),
)
function focusables(): HTMLElement[] {
  return Array.from(dialog.value?.querySelectorAll<HTMLElement>('button:not([disabled])') ?? [])
}
function onKey(event: KeyboardEvent) {
  if (props.busy) return
  if (event.key === 'Escape') {
    emit('close')
    return
  }
  if (event.key === 'Tab') {
    const items = focusables()
    if (items.length < 2) return
    const first = items[0]
    const last = items[items.length - 1]
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }
}
onMounted(() => {
  window.addEventListener('keydown', onKey)
  nextTick(() => focusables()[0]?.focus())
})
onUnmounted(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <div
    class="preview-backdrop"
    @click.self="busy ? null : emit('close')"
  >
    <div
      ref="dialog"
      class="preview-dialog"
      role="dialog"
      aria-modal="true"
      aria-labelledby="preview-title"
    >
      <div class="preview-head">
        <div>
          <span class="eyebrow">模板预览</span>
          <h2 id="preview-title">{{ template.name }}</h2>
        </div>
        <button
          class="icon-close"
          :disabled="busy"
          aria-label="关闭预览"
          @click="emit('close')"
        >
          ×
        </button>
      </div>
      <p class="preview-surface">
        适用部位：<strong>{{ surfaceLabels[template.surface] }}</strong>
      </p>
      <p class="preview-usage">{{ template.usage }}</p>
      <div class="table-scroll">
        <table>
          <caption>
            材料层组合（室外到室内）· 共
            {{
              template.layers.length
            }}
            层 · 总厚
            {{
              number(totalThickness)
            }}
            毫米
          </caption>
          <thead>
            <tr>
              <th scope="col">层序</th>
              <th scope="col">材料</th>
              <th scope="col">厚度（毫米）</th>
              <th scope="col">损耗（%）</th>
              <th scope="col">替换寿命（年）</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="entry in resolved"
              :key="entry.index"
              :class="{ unavailable: !entry.material }"
            >
              <td>{{ entry.index + 1 }}</td>
              <td>
                <template v-if="entry.material">
                  {{ entry.material.name }}
                  <span class="kind">{{ kindLabels[entry.material.kind] }}</span>
                </template>
                <template v-else>材料不可用（{{ entry.layer.materialId }}）</template>
              </td>
              <td>{{ number(entry.layer.thickness) }}</td>
              <td>{{ number(entry.layer.loss) }}</td>
              <td>{{ entry.layer.lifespan }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div
        v-if="missing.length"
        class="preview-block"
        role="alert"
      >
        <p>材料引用不可用，无法直接套用。需要先处理：</p>
        <ul>
          <li
            v-for="item in missing"
            :key="item.index"
          >
            第 {{ item.index }} 层引用的材料（{{
              item.materialId
            }}）已不存在，请在模板中改层或恢复该材料。
          </li>
        </ul>
      </div>
      <p class="preview-note">
        套用后将生成一个独立的编辑中构造：沿用部位与材料层组合，面积、计算年限、名称与目标值使用新建默认值；模板后续修改不会影响该构造。
      </p>
      <div class="preview-actions">
        <button
          class="button"
          :disabled="busy"
          @click="emit('close')"
        >
          取消
        </button>
        <button
          class="button primary"
          :disabled="busy || missing.length > 0"
          @click="emit('apply')"
        >
          生成独立构造
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.preview-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(41, 56, 46, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  z-index: 50;
}
.preview-dialog {
  background: var(--paper);
  border: 1px solid var(--line);
  border-radius: 8px;
  max-width: 760px;
  width: 100%;
  max-height: 90vh;
  overflow: auto;
  padding: 28px;
}
.preview-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}
.icon-close {
  border: 0;
  background: transparent;
  font-size: 24px;
  line-height: 1;
  color: var(--muted);
  padding: 4px 8px;
}
.preview-surface {
  margin: 14px 0 6px;
  font-size: 12px;
  color: var(--muted);
}
.preview-usage {
  margin: 0 0 8px;
  font-size: 13px;
  line-height: 1.8;
}
.kind {
  margin-left: 8px;
  color: var(--muted);
  font-size: 10px;
}
tr.unavailable {
  color: #922f20;
}
.preview-block {
  background: #fff0eb;
  border: 1px solid #eacac0;
  color: #922f20;
  border-radius: 6px;
  padding: 12px 16px;
  font-size: 12px;
  line-height: 1.8;
}
.preview-block ul {
  margin: 6px 0 0;
  padding-left: 18px;
}
.preview-note {
  font-size: 11px;
  color: var(--muted);
  line-height: 1.8;
  margin: 12px 0 0;
}
.preview-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 20px;
}
@media (max-width: 600px) {
  .preview-dialog {
    padding: 20px;
  }
}
</style>
