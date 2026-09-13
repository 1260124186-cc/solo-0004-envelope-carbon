<script setup lang="ts">
import { computed, shallowRef } from 'vue'
import type { AuditEntry, AuditOutcome } from './audit'
import { actionLabels, outcomeLabels, auditLimit } from './audit'

const props = defineProps<{
  entries: AuditEntry[]
  currentActor: string
}>()

const outcomeFilter = shallowRef<AuditOutcome | ''>('')
const actionFilter = shallowRef('')

const actionOptions = computed(() => {
  const present = new Set(props.entries.map((entry) => entry.action))
  return Object.entries(actionLabels).filter(([key]) => present.has(key as AuditEntry['action']))
})

const visible = computed(() =>
  props.entries.filter(
    (entry) =>
      (!outcomeFilter.value || entry.outcome === outcomeFilter.value) &&
      (!actionFilter.value || entry.action === actionFilter.value),
  ),
)

const committedCount = computed(
  () => props.entries.filter((entry) => entry.outcome === 'committed').length,
)
const rejectedCount = computed(() => props.entries.length - committedCount.value)

function time(value: string): string {
  const parsed = new Date(value)
  if (!Number.isFinite(parsed.getTime())) return '时间未知'
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(parsed)
}

function kindLabel(kind: AuditEntry['targetKind']): string {
  return kind === 'assembly' ? '构造' : kind === 'material' ? '材料' : '比较'
}
</script>

<template>
  <section class="audit-workspace">
    <div class="section-heading">
      <div>
        <span class="eyebrow">只追加留痕</span>
        <h1>设计在什么时间，被谁改过。</h1>
      </div>
      <span
        class="audit-readonly"
        title="审计日志只随成功落库或被拒绝的动作追加，本页不提供任何修改入口。"
      >
        只读
      </span>
    </div>
    <p class="section-intro">
      每次保存构造、新建或导入材料、生成定稿、重新开启编辑和对齐比较口径，都会按落库先后追加一条记录。
      成功的变更标记为「成功」；失败或被拒绝的尝试单列原因，不会改动任何设计数据。
      序号在浏览器互斥锁内分配，跨标签页并发也与数据保持同一先后顺序。
    </p>

    <div class="audit-summary">
      <span>共 {{ entries.length }} 条</span>
      <span class="dot committed">成功 {{ committedCount }} · 已拒绝 {{ rejectedCount }}</span>
      <span class="muted">当前标签页操作者 {{ currentActor }}</span>
    </div>

    <div class="audit-filters">
      <label
        >结果
        <select v-model="outcomeFilter">
          <option value="">全部结果</option>
          <option value="committed">仅成功</option>
          <option value="rejected">仅已拒绝</option>
        </select>
      </label>
      <label
        >动作
        <select v-model="actionFilter">
          <option value="">全部动作</option>
          <option
            v-for="[key, label] in actionOptions"
            :key="key"
            :value="key"
          >
            {{ label }}
          </option>
        </select>
      </label>
    </div>

    <div
      v-if="!entries.length"
      class="empty-state"
    >
      <h2>还没有审计记录</h2>
      <p>保存构造或添加材料后，这里会按时间顺序显示留痕。</p>
    </div>
    <div
      v-else-if="!visible.length"
      class="empty-state"
    >
      没有符合当前筛选的记录。
    </div>
    <div
      v-else
      class="table-scroll"
    >
      <table data-check="audit-table">
        <caption>
          最新在前；日志最多保留
          {{
            auditLimit
          }}
          条，超出后仅最旧记录被舍弃，不影响设计数据。
        </caption>
        <thead>
          <tr>
            <th scope="col">序号</th>
            <th scope="col">发生时间</th>
            <th scope="col">动作</th>
            <th scope="col">结果</th>
            <th scope="col">对象</th>
            <th scope="col">标识</th>
            <th scope="col">操作者</th>
            <th scope="col">说明 / 拒绝原因</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="entry in visible"
            :key="entry.seq"
            :data-audit-seq="entry.seq"
            :data-audit-outcome="entry.outcome"
          >
            <td>{{ entry.seq }}</td>
            <td class="audit-time">{{ time(entry.at) }}</td>
            <td>{{ actionLabels[entry.action] }}</td>
            <td>
              <span :class="['outcome-badge', entry.outcome]">{{
                outcomeLabels[entry.outcome]
              }}</span>
            </td>
            <td>
              <span class="kind-tag">{{ kindLabel(entry.targetKind) }}</span>
              {{ entry.targetName || '—' }}
            </td>
            <td
              class="audit-id"
              :title="entry.targetId"
            >
              {{ entry.targetId }}
            </td>
            <td :title="`浏览器标识#标签页标识：${entry.actor}`">{{ entry.actor }}</td>
            <td class="audit-note">
              <template v-if="entry.outcome === 'committed'">{{ entry.detail || '—' }}</template>
              <template v-else>
                <span class="reject-reason">{{ entry.reason }}</span>
              </template>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>

<style scoped>
.audit-workspace {
  max-width: 1240px;
  margin: 0 auto;
}
.audit-readonly {
  font-size: 11px;
  color: var(--green);
  background: var(--green-pale);
  border: 1px solid #c4dbce;
  border-radius: 4px;
  padding: 6px 12px;
  white-space: nowrap;
}
.audit-summary {
  display: flex;
  flex-wrap: wrap;
  gap: 18px;
  align-items: center;
  font-size: 12px;
  margin-bottom: 16px;
}
.dot {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.audit-filters {
  display: flex;
  gap: 16px;
  margin-bottom: 8px;
}
.audit-filters label {
  width: 200px;
}
.audit-time,
.audit-id,
.audit-note {
  white-space: normal;
}
.audit-id {
  max-width: 220px;
  word-break: break-all;
  color: var(--muted);
  font-size: 11px;
}
.audit-note {
  min-width: 200px;
}
.kind-tag {
  display: inline-block;
  font-size: 10px;
  color: var(--muted);
  border: 1px solid var(--line);
  border-radius: 3px;
  padding: 1px 6px;
  margin-right: 6px;
}
.outcome-badge {
  display: inline-block;
  font-size: 11px;
  border-radius: 3px;
  padding: 2px 8px;
}
.outcome-badge.committed {
  color: var(--green);
  background: var(--green-pale);
}
.outcome-badge.rejected {
  color: #922f20;
  background: #fff0eb;
}
.reject-reason {
  color: #922f20;
}
@media (max-width: 740px) {
  .audit-filters {
    flex-direction: column;
  }
  .audit-filters label {
    width: 100%;
  }
}
</style>
