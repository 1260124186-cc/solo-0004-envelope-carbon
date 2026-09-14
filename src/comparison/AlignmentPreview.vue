<script setup lang="ts">
import type { AlignmentPreview as Preview } from './compare'
import { number, signed } from '../shared/format'
defineProps<{ preview: Preview; compact?: boolean }>()
function delta(before: number | null, after: number | null): string {
  if (before === null || after === null) return '—'
  const value = after - before
  if (Math.abs(value) < 1e-9) return '不变'
  return signed(value)
}
</script>

<template>
  <div
    class="alignment-preview"
    :class="{ compact }"
  >
    <h3 class="preview-heading">对齐口径差异项</h3>
    <ul
      class="caliber-list"
      data-check="caliber-changes"
    >
      <li
        v-for="change in preview.changes"
        :key="change.key"
        :class="{ changed: change.changed }"
        :data-check="`caliber-${change.key}`"
      >
        <span class="caliber-label">{{ change.label }}</span>
        <span class="caliber-values">
          <span :class="{ strike: change.changed }">{{ change.current }}</span>
          <template v-if="change.changed">
            <span aria-hidden="true">→</span>
            <strong>{{ change.baseline }}</strong>
          </template>
          <span
            v-else
            class="already-aligned"
          >
            已与基准一致
          </span>
        </span>
      </li>
    </ul>

    <template v-if="!compact">
      <h3 class="preview-heading">按基准统一后的结果预览（不修改当前构造）</h3>
      <div class="table-scroll">
        <table>
          <caption class="sr-only">
            对齐口径前与对齐后的计算结果
          </caption>
          <thead>
            <tr>
              <th scope="col">计算项</th>
              <th scope="col">当前口径</th>
              <th scope="col">对齐后预览</th>
              <th scope="col">变化</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="metric in preview.metrics"
              :key="metric.key"
            >
              <th scope="row">{{ metric.label }}</th>
              <td>{{ metric.before === null ? '无法计算' : number(metric.before) }}</td>
              <td>{{ metric.after === null ? '无法计算' : number(metric.after) }}</td>
              <td :data-check="`preview-${metric.key}-delta`">
                {{ delta(metric.before, metric.after) }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <p
        v-for="note in preview.cycleNotes"
        :key="note.layerId"
        class="cycle-note"
      >
        「{{ note.materialName }}」替换次数将由 {{ note.before }} 次变为 {{ note.after }} 次。
      </p>
      <p
        v-if="!preview.errors.length"
        class="preview-hint"
      >
        预览仅按基准复制部位、面积与年限重新计算；确认保存前不会改动任何构造。
      </p>
      <ul
        v-else
        class="preview-errors"
        data-check="preview-errors"
      >
        <li
          v-for="error in preview.errors"
          :key="error"
        >
          对齐后校验不通过：{{ error }}
        </li>
      </ul>
    </template>
  </div>
</template>

<style scoped>
.alignment-preview {
  border: 1px solid var(--line);
  border-radius: 6px;
  background: #f7f9f2;
  padding: 20px 22px;
  margin: 16px 0;
}
.alignment-preview.compact {
  background: transparent;
  border-color: #cfd8ca;
  padding: 16px 18px;
}
.preview-heading {
  font-size: 13px;
  margin: 4px 0 10px;
}
.caliber-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 8px;
}
.caliber-list li {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  font-size: 12px;
  padding: 8px 12px;
  border-radius: 4px;
  background: var(--paper);
  border: 1px solid var(--line);
}
.caliber-list li.changed {
  border-color: #d8c78e;
  background: #fcf8ea;
}
.caliber-label {
  color: var(--muted);
}
.caliber-values {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-variant-numeric: tabular-nums;
}
.caliber-values .strike {
  color: #9c6b57;
  text-decoration: line-through;
}
.already-aligned {
  color: var(--muted);
  font-size: 11px;
}
.preview-hint {
  font-size: 11px;
  color: var(--muted);
  margin: 10px 0 0;
}
.cycle-note {
  font-size: 11px;
  color: #73581e;
  margin: 6px 0 0;
}
.preview-errors {
  list-style: none;
  margin: 10px 0 0;
  padding: 10px 12px;
  border-radius: 4px;
  background: #fff0eb;
  color: #922f20;
  font-size: 12px;
  display: grid;
  gap: 4px;
}
@media (max-width: 600px) {
  .caliber-list li {
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
  }
}
</style>
