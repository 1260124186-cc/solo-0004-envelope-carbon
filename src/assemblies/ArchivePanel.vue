<script setup lang="ts">
import type { Assembly } from './types'
import { stateLabels, surfaceLabels } from './types'
import { date } from '../shared/format'
const props = defineProps<{
  assemblies: Assembly[]
  archived: Assembly[]
  archives: string[]
  documentCounts: Record<string, number>
  openDraftId: string | null
  draftState: Assembly['state'] | null
  baselineId: string
  alternativeId: string
  busy: boolean
}>()
const emit = defineEmits<{
  archive: [id: string]
  restore: [id: string]
  view: [id: string]
  close: []
}>()

function blockReason(id: string): string {
  if (id === props.baselineId) return '是方案比较当前选中的基准构造，请先改选基准。'
  if (id === props.alternativeId) return '是方案比较当前选中的替代构造，请先改选替代。'
  if (id === props.openDraftId && props.draftState === 'editing')
    return '正在编辑区打开，请先保存或切换到其他构造。'
  return ''
}
</script>

<template>
  <section
    class="archive-panel panel"
    aria-label="归档管理"
  >
    <div class="section-heading">
      <div>
        <span class="eyebrow">归档管理</span>
        <h1>从列表隐藏，而不是从存储删除。</h1>
      </div>
      <button
        class="button small"
        :disabled="busy"
        @click="emit('close')"
      >
        返回工作面
      </button>
    </div>
    <p class="section-intro">
      归档后构造默认不出现在「当前构造」和「方案比较」的选择里，但构造实体、定稿只读状态与全部历史计算书都原样保留，随时可以按原身份恢复。系统不提供从存储删除构造的动作，清理浏览器站点数据才会真正清除。
    </p>

    <h2 class="list-title">工作中的构造（{{ assemblies.length }}）</h2>
    <div
      v-if="!assemblies.length"
      class="empty-state"
    >
      当前列表没有构造，可从下方归档记录恢复，或返回构造编辑新建。
    </div>
    <ul class="archive-list">
      <li
        v-for="item in assemblies"
        :key="item.id"
        class="archive-row"
      >
        <div class="row-meta">
          <strong>{{ item.name }}</strong>
          <span>
            {{ stateLabels[item.state] }} · {{ surfaceLabels[item.surface] }} · 修订
            {{ item.revision }} · {{ date(item.updatedAt) }}
          </span>
          <span
            v-if="blockReason(item.id)"
            class="row-block"
            >无法归档：{{ blockReason(item.id) }}</span
          >
        </div>
        <div class="row-actions">
          <button
            class="button small"
            :disabled="busy || Boolean(blockReason(item.id))"
            @click="emit('archive', item.id)"
          >
            归档（仅从列表隐藏）
          </button>
        </div>
      </li>
    </ul>

    <h2 class="list-title">已归档（{{ archived.length }}）</h2>
    <div
      v-if="!archived.length"
      class="empty-state"
    >
      还没有归档记录。
    </div>
    <ul class="archive-list">
      <li
        v-for="item in archived"
        :key="item.id"
        class="archive-row archived"
      >
        <div class="row-meta">
          <strong>{{ item.name }}</strong>
          <span>
            {{ stateLabels[item.state] }} · {{ surfaceLabels[item.surface] }} · 修订
            {{ item.revision }} · {{ documentCounts[item.id] ?? 0 }} 份历史计算书
          </span>
        </div>
        <div class="row-actions">
          <button
            class="button small"
            :disabled="busy"
            @click="emit('view', item.id)"
          >
            打开历史计算书
          </button>
          <button
            class="button small primary"
            :disabled="busy"
            @click="emit('restore', item.id)"
          >
            恢复到当前列表
          </button>
        </div>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.archive-panel {
  max-width: 1100px;
  margin: 0 auto;
}
.list-title {
  font-size: 14px;
  margin: 26px 0 12px;
}
.archive-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 10px;
}
.archive-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  border: 1px solid var(--line);
  background: #faf9f2;
  border-radius: 6px;
  padding: 14px 18px;
}
.archive-row.archived {
  background: #f3f4ec;
  border-style: dashed;
}
.row-meta {
  display: grid;
  gap: 4px;
  min-width: 0;
}
.row-meta strong {
  font-size: 14px;
}
.row-meta > span {
  font-size: 11px;
  color: var(--muted);
}
.row-block {
  color: #865629;
}
.row-actions {
  display: flex;
  gap: 8px;
  flex-shrink: 0;
}
@media (max-width: 700px) {
  .archive-row {
    flex-direction: column;
    align-items: stretch;
  }
  .row-actions {
    justify-content: flex-end;
    flex-wrap: wrap;
  }
}
</style>
