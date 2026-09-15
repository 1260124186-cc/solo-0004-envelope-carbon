<script setup lang="ts">
import { onMounted, ref } from 'vue'
import type { AssemblyDiff, AssemblySummary } from './diff'

const props = defineProps<{
  diff: AssemblyDiff | null
  summary: AssemblySummary | null
  busy: boolean
}>()
const emit = defineEmits<{ confirm: []; cancel: [] }>()
const dialog = ref<HTMLElement | null>(null)
const confirmButton = ref<HTMLButtonElement | null>(null)

onMounted(() => {
  confirmButton.value?.focus()
})

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    event.preventDefault()
    emit('cancel')
    return
  }
  if (event.key === 'Tab' && dialog.value) {
    const focusable = [...dialog.value.querySelectorAll<HTMLElement>('button:not(:disabled)')]
    if (!focusable.length) return
    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }
}
</script>

<template>
  <div
    class="dialog-backdrop"
    @click.self="emit('cancel')"
  >
    <div
      ref="dialog"
      class="dialog"
      role="dialog"
      aria-modal="true"
      :aria-label="summary ? '首次保存内容概览' : '保存前确认本次修改'"
      @keydown="onKeydown"
    >
      <h2>{{ summary ? '首次保存内容概览' : '保存前确认本次修改' }}</h2>
      <p class="dialog-intro">
        {{
          summary
            ? '这是该构造的第一次保存，没有可对比的历史版本。请核对将写入的内容。'
            : '写入前请核对当前草稿相对最近保存版本的差异。确认后照常保存，取消则回到编辑状态。'
        }}
      </p>

      <template v-if="props.diff">
        <section
          v-if="props.diff.fields.length"
          class="review-section"
        >
          <h3>基本字段</h3>
          <ul class="review-list">
            <li
              v-for="field in props.diff.fields"
              :key="field.label"
            >
              <span class="change-label">{{ field.label }}</span>
              <span class="change-values">{{ field.before }} → {{ field.after }}</span>
            </li>
          </ul>
        </section>
        <section
          v-if="props.diff.layers.length"
          class="review-section"
        >
          <h3>构造层</h3>
          <ul class="review-list">
            <li
              v-for="layer in props.diff.layers"
              :key="layer.id"
            >
              <div class="layer-change-title">
                <span
                  v-for="badge in layer.badges"
                  :key="badge"
                  class="badge"
                  :data-kind="badge"
                  >{{ badge }}</span
                >
                <span>{{ layer.title }}</span>
              </div>
              <ul class="layer-change-details">
                <li
                  v-for="detail in layer.details"
                  :key="detail"
                >
                  {{ detail }}
                </li>
              </ul>
            </li>
          </ul>
        </section>
        <section
          v-if="props.diff.materialsAdded.length || props.diff.materialsRemoved.length"
          class="review-section"
        >
          <h3>材料引用</h3>
          <p
            v-if="props.diff.materialsAdded.length"
            class="material-ref"
          >
            <span
              class="badge"
              data-kind="新增"
              >新增</span
            >
            {{ props.diff.materialsAdded.join('、') }}
          </p>
          <p
            v-if="props.diff.materialsRemoved.length"
            class="material-ref"
          >
            <span
              class="badge"
              data-kind="删除"
              >删除</span
            >
            {{ props.diff.materialsRemoved.join('、') }}
          </p>
        </section>
        <p
          v-if="
            !props.diff.fields.length &&
            !props.diff.layers.length &&
            !props.diff.materialsAdded.length &&
            !props.diff.materialsRemoved.length
          "
          class="muted"
        >
          没有检测到内容差异。
        </p>
      </template>

      <template v-if="props.summary">
        <section class="review-section">
          <h3>基本条件</h3>
          <dl class="summary-grid">
            <template
              v-for="field in props.summary.fields"
              :key="field.label"
            >
              <dt>{{ field.label }}</dt>
              <dd>{{ field.value }}</dd>
            </template>
          </dl>
        </section>
        <section
          v-if="props.summary.layers.length"
          class="review-section"
        >
          <h3>构造层（{{ props.summary.layers.length }} 层，室外到室内）</h3>
          <ol class="review-list summary-layers">
            <li
              v-for="layer in props.summary.layers"
              :key="layer"
            >
              {{ layer }}
            </li>
          </ol>
        </section>
        <section
          v-if="props.summary.materials.length"
          class="review-section"
        >
          <h3>材料引用</h3>
          <p class="material-ref">{{ props.summary.materials.join('、') }}</p>
        </section>
      </template>

      <div class="actions dialog-actions">
        <button
          class="button"
          :disabled="busy"
          @click="emit('cancel')"
        >
          继续编辑
        </button>
        <button
          ref="confirmButton"
          class="button primary"
          :disabled="busy"
          @click="emit('confirm')"
        >
          {{ busy ? '正在保存…' : '确认保存' }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.dialog-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(41, 56, 46, 0.42);
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding: 8vh 20px 20px;
  z-index: 10;
}
.dialog {
  background: var(--paper);
  border: 1px solid var(--line);
  border-radius: 8px;
  padding: 28px;
  width: 100%;
  max-width: 560px;
  max-height: 80vh;
  overflow-y: auto;
}
.dialog h2 {
  margin: 0;
}
.dialog-intro {
  color: var(--muted);
  font-size: 12px;
  line-height: 1.8;
  margin: 10px 0 20px;
}
.review-section {
  margin-bottom: 18px;
}
.review-section h3 {
  font-size: 12px;
  color: var(--muted);
  font-weight: 600;
  margin: 0 0 8px;
}
.review-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 8px;
  font-size: 12px;
}
.review-list > li {
  border: 1px solid var(--line);
  border-radius: 6px;
  padding: 10px 12px;
}
.change-label {
  display: block;
  color: var(--muted);
  font-size: 11px;
  margin-bottom: 4px;
}
.change-values {
  font-variant-numeric: tabular-nums;
  word-break: break-all;
}
.layer-change-title {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.layer-change-details {
  list-style: none;
  margin: 6px 0 0;
  padding: 0;
  display: grid;
  gap: 3px;
  color: var(--muted);
  font-size: 11px;
  font-variant-numeric: tabular-nums;
}
.badge {
  font-size: 10px;
  padding: 2px 7px;
  border-radius: 3px;
  background: #eef1e8;
  color: var(--muted);
  white-space: nowrap;
}
.badge[data-kind='新增'] {
  background: var(--green-pale);
  color: var(--green);
}
.badge[data-kind='删除'] {
  background: #fff0eb;
  color: #922f20;
}
.badge[data-kind='顺序'] {
  background: #fcf3de;
  color: #865629;
}
.material-ref {
  font-size: 12px;
  margin: 6px 0 0;
  display: flex;
  align-items: baseline;
  gap: 8px;
}
.summary-grid {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 6px 18px;
  margin: 0;
  font-size: 12px;
}
.summary-grid dt {
  color: var(--muted);
}
.summary-grid dd {
  margin: 0;
  font-variant-numeric: tabular-nums;
}
.summary-layers {
  list-style: none;
  counter-reset: none;
}
.dialog-actions {
  justify-content: flex-end;
  border-top: 1px solid var(--line);
  padding-top: 18px;
  margin-top: 4px;
}
@media (max-width: 600px) {
  .dialog {
    padding: 20px;
  }
}
</style>
