<script setup lang="ts">
import { computed } from 'vue'
import type { Decision } from './types'
import { decisionStateLabels } from './types'
import type { CarbonDocument } from '../documents/types'
import { date } from '../shared/format'
import DecisionEditor from './DecisionEditor.vue'
import DecisionSheet from './DecisionSheet.vue'
const props = defineProps<{
  decisions: Decision[]
  documents: CarbonDocument[]
  draft: Decision | null
  dirty: boolean
  busy: boolean
}>()
const emit = defineEmits<{
  select: [id: string]
  create: []
  update: [patch: Partial<Decision>]
  save: []
  confirm: []
  revise: []
  documents: []
}>()
const sorted = computed(() =>
  props.decisions.slice().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
)
</script>

<template>
  <section class="panel decision-workspace">
    <div class="section-heading">
      <div>
        <span class="eyebrow">设计决策</span>
        <h1>把比较，落成结论。</h1>
      </div>
      <button
        class="button primary"
        :disabled="busy"
        @click="emit('create')"
      >
        ＋ 新建决策记录
      </button>
    </div>
    <p class="section-intro">
      决策引用定稿计算书的具体版本，记录采用方案、选择理由与待核实条件；确认后不可改写，只能建立新的修订。
    </p>
    <div
      v-if="!documents.length"
      class="empty-state"
    >
      <h2>还没有可引用的计算书</h2>
      <p>决策记录依附于定稿计算书。请先为至少两个构造版本生成定稿，再记录选择结论。</p>
      <button
        class="button"
        @click="emit('documents')"
      >
        前往计算书
      </button>
    </div>
    <div
      v-else
      class="decision-grid"
    >
      <aside
        class="decision-list"
        aria-label="决策记录列表"
      >
        <button
          v-for="item in sorted"
          :key="item.id"
          :class="['decision-item', { active: draft?.id === item.id }]"
          @click="emit('select', item.id)"
        >
          <span class="item-title">{{ item.title }}</span>
          <span class="item-meta"
            >修订 {{ item.revision }} · {{ decisionStateLabels[item.state] }} ·
            {{ date(item.updatedAt) }}</span
          >
        </button>
        <p
          v-if="!decisions.length"
          class="list-empty"
        >
          还没有决策记录。
        </p>
      </aside>
      <DecisionEditor
        v-if="draft && draft.state === 'draft'"
        :decision="draft"
        :documents="documents"
        :busy="busy"
        :dirty="dirty"
        @update="emit('update', $event)"
        @save="emit('save')"
        @confirm="emit('confirm')"
      />
      <DecisionSheet
        v-else-if="draft"
        :decision="draft"
        :documents="documents"
        :busy="busy"
        @revise="emit('revise')"
      />
      <div
        v-else
        class="empty-state"
      >
        从左侧选择一条决策记录，或新建决策记录。
      </div>
    </div>
  </section>
</template>

<style scoped>
.decision-workspace {
  max-width: 1100px;
  margin: 0 auto;
}
.decision-grid {
  display: grid;
  grid-template-columns: 300px minmax(0, 1fr);
  gap: 28px;
  align-items: start;
}
.decision-list {
  display: grid;
  gap: 10px;
  align-content: start;
}
.decision-item {
  display: grid;
  gap: 6px;
  text-align: left;
  border: 1px solid var(--line);
  background: var(--paper);
  border-radius: 6px;
  padding: 14px 16px;
}
.decision-item:hover {
  border-color: var(--green);
}
.decision-item.active {
  border-color: var(--green);
  background: var(--green-pale);
}
.item-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--ink);
}
.item-meta {
  font-size: 10px;
  color: var(--muted);
}
.list-empty {
  font-size: 12px;
  color: var(--muted);
  text-align: center;
  border: 1px dashed #ccd5c7;
  border-radius: 6px;
  padding: 24px 12px;
  margin: 0;
}
@media (max-width: 900px) {
  .decision-grid {
    grid-template-columns: 1fr;
  }
}
</style>
