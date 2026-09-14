<script setup lang="ts">
import { onMounted, ref } from 'vue'
import type { DraftDiff } from './diff'
import { date } from '../shared/format'

const props = defineProps<{
  /** 草稿最近自动保存时间。 */
  savedAt: string
  /** 草稿对应的构造名称。 */
  name: string
  /** 草稿对应的保存版本是否仍然存在。 */
  originExists: boolean
  /** 草稿基于的正式数据是否已被其它标签页改动（过期草稿）。 */
  stale: boolean
  /** 保存版本是否已定稿。 */
  finalized: boolean
  diff: DraftDiff
  busy: boolean
  error: string
}>()

const emit = defineEmits<{
  restore: []
  discard: []
  saveAs: []
}>()

const statusText: Record<'added' | 'removed' | 'modified', string> = {
  added: '新增层',
  removed: '删除层',
  modified: '修改层',
}

const dialogRef = ref<HTMLElement | null>(null)
onMounted(() => dialogRef.value?.focus())
</script>

<template>
  <div
    class="draft-backdrop"
    role="presentation"
  >
    <div
      ref="dialogRef"
      class="draft-dialog panel"
      role="dialog"
      aria-modal="true"
      aria-labelledby="draft-recovery-title"
      tabindex="-1"
    >
      <div class="dialog-heading">
        <div>
          <span class="eyebrow">草稿自动恢复</span>
          <h1 id="draft-recovery-title">发现未提交的构造草稿</h1>
        </div>
        <span class="draft-time">自动保存于 {{ date(props.savedAt) }}</span>
      </div>
      <p class="dialog-intro">
        页面上次关闭时，构造「{{
          props.name
        }}」存在未保存的修改。下表列出草稿与最近保存内容的差异，恢复前请先核对。草稿保存在独立空间，不会自动覆盖正式数据。
      </p>

      <div
        v-if="!props.originExists"
        class="situation new"
        role="status"
      >
        这是一份尚未保存过的新构造草稿，正式列表中还没有对应构造。可直接「另存为新构造」将其保存为正式构造；也可先恢复到编辑区继续调整。
      </div>
      <div
        v-else-if="props.stale"
        class="situation stale"
        role="alert"
      >
        该草稿之后，正式数据已在其它标签页或会话中被修改并保存。直接恢复后保存会先要求确认，且仍受跨标签页修订保护；如不想影响原构造，请选择「另存为新构造」。
      </div>
      <div
        v-else-if="props.finalized"
        class="situation locked"
        role="status"
      >
        对应构造已定稿。可将草稿另存为新构造，或恢复到编辑区自行处理；定稿构造本身保持只读，历史计算书不受影响。
      </div>
      <div
        v-else
        class="situation"
        role="status"
      >
        对应构造仍可编辑，正式版本自草稿保存后未被改动。
      </div>

      <div class="diff-scroll">
        <table>
          <caption>
            基本条件差异（{{
              props.diff.fieldChanges.length
            }}
            项）
          </caption>
          <thead>
            <tr>
              <th scope="col">项目</th>
              <th scope="col">最近保存</th>
              <th scope="col">草稿内容</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="change in props.diff.fieldChanges"
              :key="change.label"
            >
              <th scope="row">{{ change.label }}</th>
              <td>{{ change.saved }}</td>
              <td class="draft-cell">{{ change.draft }}</td>
            </tr>
            <tr v-if="!props.diff.fieldChanges.length">
              <td colspan="3">基本条件无差异</td>
            </tr>
          </tbody>
        </table>

        <table>
          <caption>
            构造层差异（{{
              props.diff.layerChanges.length
            }}
            项）
          </caption>
          <thead>
            <tr>
              <th scope="col">构造层</th>
              <th scope="col">状态</th>
              <th scope="col">属性变化</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="layer in props.diff.layerChanges"
              :key="layer.key"
            >
              <th scope="row">{{ layer.title }}</th>
              <td>
                <span :class="['layer-badge', layer.status]">{{ statusText[layer.status] }}</span>
              </td>
              <td>
                <ul
                  v-if="layer.fields.length"
                  class="layer-fields"
                >
                  <li v-for="field in layer.fields">
                    {{ field.label }}：{{ field.saved }} → {{ field.draft }}
                  </li>
                </ul>
                <span
                  v-else
                  class="muted"
                  >—</span
                >
              </td>
            </tr>
            <tr v-if="!props.diff.layerChanges.length">
              <td colspan="3">构造层无差异</td>
            </tr>
          </tbody>
        </table>
      </div>

      <p
        v-if="props.error"
        class="dialog-error"
        role="alert"
      >
        {{ props.error }}
      </p>

      <div class="dialog-actions">
        <button
          class="button"
          :disabled="props.busy"
          @click="emit('discard')"
        >
          放弃草稿
        </button>
        <button
          class="button"
          :disabled="props.busy"
          :title="
            !props.originExists
              ? '直接将这份未保存草稿创建为正式构造'
              : '以草稿内容创建一个新的正式构造，原构造保持不变'
          "
          @click="emit('saveAs')"
        >
          另存为新构造
        </button>
        <button
          class="button primary"
          :disabled="props.busy"
          @click="emit('restore')"
        >
          恢复到编辑区
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.draft-backdrop {
  position: fixed;
  inset: 0;
  z-index: 50;
  background: rgba(31, 44, 36, 0.45);
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding: 40px 20px;
  overflow-y: auto;
}
.draft-dialog {
  width: min(860px, 100%);
  padding: 26px 28px;
  border-radius: 8px;
}
.dialog-heading {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 16px;
}
.draft-time {
  font-size: 11px;
  color: var(--muted);
  white-space: nowrap;
}
.dialog-intro {
  font-size: 12.5px;
  line-height: 1.9;
  color: var(--ink);
  margin: 14px 0 16px;
}
.situation {
  border: 1px solid var(--line);
  background: #f3f5ec;
  color: #555e50;
  border-radius: 4px;
  padding: 10px 14px;
  font-size: 12px;
  line-height: 1.8;
  margin-bottom: 12px;
}
.situation.stale {
  background: #fcf3de;
  border-color: #e5d7af;
  color: #73581e;
}
.situation.locked {
  background: #eef1f4;
  border-color: #cfd8de;
  color: #3f5160;
}
.diff-scroll {
  max-height: 42vh;
  overflow-y: auto;
  border: 1px solid var(--line);
  border-radius: 6px;
  padding: 0 14px;
  margin-bottom: 16px;
}
table {
  font-size: 12px;
}
caption {
  padding-top: 14px;
  font-weight: 600;
  color: var(--ink);
}
.draft-cell {
  color: var(--green);
  font-weight: 600;
  white-space: normal;
}
.layer-badge {
  display: inline-block;
  padding: 3px 8px;
  border-radius: 999px;
  font-size: 10px;
  white-space: nowrap;
}
.layer-badge.added {
  background: #e9f0e6;
  color: var(--green);
}
.layer-badge.removed {
  background: #fff0eb;
  color: #922f20;
}
.layer-badge.modified {
  background: #fff8e7;
  color: #73581e;
}
.layer-fields {
  margin: 0;
  padding-left: 16px;
  white-space: normal;
  line-height: 1.8;
}
.dialog-error {
  background: #fff0eb;
  border: 1px solid #eacac0;
  color: #922f20;
  border-radius: 4px;
  padding: 10px 14px;
  font-size: 12px;
  margin: 0 0 12px;
}
.dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}
@media (max-width: 640px) {
  .draft-backdrop {
    padding: 16px 10px;
  }
  .draft-dialog {
    padding: 20px 16px;
  }
  .dialog-heading {
    flex-direction: column;
    align-items: flex-start;
    gap: 6px;
  }
  .dialog-actions {
    flex-wrap: wrap;
  }
}
</style>
