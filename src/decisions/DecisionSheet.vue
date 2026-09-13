<script setup lang="ts">
import { computed } from 'vue'
import type { Decision } from './types'
import type { CarbonDocument } from '../documents/types'
import { date } from '../shared/format'
import DecisionValues from './DecisionValues.vue'
const props = defineProps<{
  decision: Decision
  documents: CarbonDocument[]
  busy: boolean
}>()
const emit = defineEmits<{ revise: [] }>()
const optionDocuments = computed(() =>
  props.decision.options
    .map((option) => props.documents.find((document) => document.id === option.documentId))
    .filter((document): document is CarbonDocument => Boolean(document)),
)
const chosen = computed(() =>
  optionDocuments.value.find((document) => document.id === props.decision.chosenDocumentId),
)
const rejected = computed(() =>
  props.decision.options
    .filter((option) => option.documentId !== props.decision.chosenDocumentId)
    .map((option) => {
      const document = props.documents.find((item) => item.id === option.documentId)
      return {
        documentId: option.documentId,
        name: document
          ? `${document.assembly.name} · 修订 ${document.assembly.revision}`
          : '未知计算书',
        reason: option.rejectedReason,
      }
    }),
)
</script>

<template>
  <section
    class="decision-sheet"
    aria-label="已确认的设计决策"
  >
    <div class="sheet-title">
      <div>
        <span class="eyebrow">设计决策记录</span>
        <h2>{{ decision.title }}</h2>
      </div>
      <span
        class="sheet-seal"
        data-check="decision-state"
        >已确认<br />修订 {{ decision.revision }}</span
      >
    </div>
    <p class="sheet-meta">
      确认于 {{ date(decision.confirmedAt) }} · 创建于 {{ date(decision.createdAt) }}
    </p>
    <div class="sheet-chosen">
      <span class="eyebrow">采用方案</span>
      <strong v-if="chosen"
        >{{ chosen.assembly.name }} · 计算书修订 {{ chosen.assembly.revision }}</strong
      >
      <strong v-else>引用的计算书缺失</strong>
    </div>
    <DecisionValues
      :documents="optionDocuments"
      :chosen-id="decision.chosenDocumentId"
    />
    <div class="sheet-notes">
      <h3>选择理由</h3>
      <p>{{ decision.rationale }}</p>
      <h3>需要进一步核实的条件</h3>
      <p>{{ decision.verify || '无。' }}</p>
      <h3>暂不采用的方案</h3>
      <p
        v-for="item in rejected"
        :key="item.documentId"
      >
        {{ item.name }}：{{ item.reason }}
      </p>
    </div>
    <div class="sheet-footer">
      <p class="sheet-lock">已确认的决策不能直接改写；如需调整结论，请建立新的修订。</p>
      <button
        class="button primary"
        :disabled="busy"
        @click="emit('revise')"
      >
        建立新的修订
      </button>
    </div>
  </section>
</template>

<style scoped>
.decision-sheet {
  background: var(--paper);
  border: 1px solid var(--line);
  padding: 32px;
  border-radius: 6px;
  display: grid;
  gap: 24px;
  align-content: start;
}
.sheet-title {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 20px;
  border-bottom: 2px solid var(--green);
  padding-bottom: 20px;
}
.sheet-title h2 {
  font-size: 24px;
  margin: 12px 0 0;
}
.sheet-seal {
  color: var(--green);
  border: 1px solid var(--green);
  font-size: 11px;
  text-align: center;
  padding: 8px 14px;
  line-height: 1.6;
  white-space: nowrap;
}
.sheet-meta {
  font-size: 11px;
  color: var(--muted);
  margin: 0;
}
.sheet-chosen {
  background: var(--green-pale);
  border-left: 3px solid var(--green);
  padding: 18px 20px;
}
.sheet-chosen strong {
  display: block;
  font-size: 20px;
  font-weight: 500;
  color: var(--green);
  margin-top: 6px;
}
.sheet-notes {
  font-size: 12px;
  line-height: 1.9;
  white-space: pre-wrap;
}
.sheet-notes h3 {
  font-size: 12px;
  margin: 16px 0 4px;
}
.sheet-notes p {
  margin: 0;
}
.sheet-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  border-top: 1px solid var(--line);
  padding-top: 20px;
}
.sheet-lock {
  font-size: 11px;
  color: var(--muted);
  margin: 0;
}
@media (max-width: 600px) {
  .decision-sheet {
    padding: 20px;
  }
  .sheet-footer {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>
