<script setup lang="ts">
import { computed } from 'vue'
import type { Decision } from './types'
import type { CarbonDocument } from '../documents/types'
import { confirmFindings, validateDecision } from './validation'
import { date, number } from '../shared/format'
import DecisionValues from './DecisionValues.vue'
const props = defineProps<{
  decision: Decision
  documents: CarbonDocument[]
  busy: boolean
  dirty: boolean
}>()
const emit = defineEmits<{
  update: [patch: Partial<Decision>]
  save: []
  confirm: []
}>()
const orderedDocuments = computed(() => props.documents.slice().reverse())
const optionDocuments = computed(() =>
  props.decision.options
    .map((option) => props.documents.find((document) => document.id === option.documentId))
    .filter((document): document is CarbonDocument => Boolean(document)),
)
const saveErrors = computed(() => validateDecision(props.decision, props.documents))
const confirmHints = computed(() => confirmFindings(props.decision, props.documents))

function nameOf(documentId: string): string {
  const document = props.documents.find((item) => item.id === documentId)
  return document ? `${document.assembly.name} · 修订 ${document.assembly.revision}` : '未知计算书'
}

function isSelected(documentId: string): boolean {
  return props.decision.options.some((option) => option.documentId === documentId)
}

function toggle(documentId: string, checked: boolean) {
  const options = checked
    ? [...props.decision.options, { documentId, rejectedReason: '' }]
    : props.decision.options.filter((option) => option.documentId !== documentId)
  const chosenDocumentId = options.some(
    (option) => option.documentId === props.decision.chosenDocumentId,
  )
    ? props.decision.chosenDocumentId
    : ''
  emit('update', { options, chosenDocumentId })
}

function setReason(documentId: string, rejectedReason: string) {
  emit('update', {
    options: props.decision.options.map((option) =>
      option.documentId === documentId ? { ...option, rejectedReason } : option,
    ),
  })
}
</script>

<template>
  <section
    class="decision-editor"
    aria-label="决策草稿编辑"
  >
    <div class="editor-head">
      <span class="eyebrow">决策草稿 · 修订 {{ decision.revision }}</span>
      <span
        class="state-label"
        data-check="decision-state"
        >草稿</span
      >
    </div>
    <label
      >决策主题
      <input
        :value="decision.title"
        maxlength="50"
        placeholder="例如：标准段外墙构造选型"
        :disabled="busy"
        @input="emit('update', { title: ($event.target as HTMLInputElement).value })"
      />
    </label>
    <fieldset class="option-picker">
      <legend>引用计算书（定稿版本）</legend>
      <p class="picker-note">
        引用冻结在具体计算书版本上，而不是会继续变化的构造名称；构造之后的修改与重新定稿不影响本记录。
      </p>
      <label
        v-for="document in orderedDocuments"
        :key="document.id"
        class="option-pick"
      >
        <input
          type="checkbox"
          :checked="isSelected(document.id)"
          :disabled="busy"
          @change="toggle(document.id, ($event.target as HTMLInputElement).checked)"
        />
        <span
          >{{ document.assembly.name }} · 修订 {{ document.assembly.revision }} ·
          {{ date(document.createdAt) }}（强度
          {{ number(document.result.intensity) }} 千克当量/平方米）</span
        >
      </label>
    </fieldset>
    <template v-if="decision.options.length">
      <DecisionValues
        :documents="optionDocuments"
        :chosen-id="decision.chosenDocumentId"
      />
      <div class="option-choices">
        <div
          v-for="option in decision.options"
          :key="option.documentId"
          class="option-choice"
        >
          <label class="option-choose">
            <input
              type="radio"
              name="chosen-option"
              :aria-label="`采用 ${nameOf(option.documentId)}`"
              :checked="decision.chosenDocumentId === option.documentId"
              :disabled="busy"
              @change="emit('update', { chosenDocumentId: option.documentId })"
            />
            <span>采用 {{ nameOf(option.documentId) }}</span>
          </label>
          <textarea
            v-if="decision.chosenDocumentId !== option.documentId"
            rows="2"
            maxlength="1000"
            :aria-label="`暂不采用 ${nameOf(option.documentId)} 的原因`"
            :value="option.rejectedReason"
            placeholder="暂不采用该方案的原因"
            :disabled="busy"
            @input="setReason(option.documentId, ($event.target as HTMLTextAreaElement).value)"
          />
        </div>
      </div>
    </template>
    <label
      >选择理由
      <textarea
        rows="4"
        maxlength="2000"
        :value="decision.rationale"
        placeholder="为什么最终选择该方案：关键数值对比、目标达成情况等。"
        :disabled="busy"
        @input="emit('update', { rationale: ($event.target as HTMLTextAreaElement).value })"
      />
    </label>
    <label
      >需要进一步核实的条件
      <textarea
        rows="3"
        maxlength="2000"
        :value="decision.verify"
        placeholder="结论成立所依赖、仍需核实的条件；没有可留空。"
        :disabled="busy"
        @input="emit('update', { verify: ($event.target as HTMLTextAreaElement).value })"
      />
    </label>
    <p
      v-if="saveErrors.length && dirty"
      class="inline-warning"
    >
      {{ saveErrors[0] }}
    </p>
    <div
      v-if="confirmHints.length"
      class="confirm-hints"
    >
      <span class="eyebrow">确认结论前仍需完成</span>
      <p
        v-for="hint in confirmHints"
        :key="hint"
      >
        {{ hint }}
      </p>
    </div>
    <div class="editor-footer">
      <span class="save-indicator">{{
        busy ? '正在保存…' : dirty ? '有未保存的修改' : '已保存'
      }}</span>
      <div class="actions">
        <button
          class="button"
          :disabled="busy || dirty || confirmHints.length > 0"
          @click="emit('confirm')"
        >
          确认结论
        </button>
        <button
          class="button primary"
          :disabled="busy || !dirty || saveErrors.length > 0"
          @click="emit('save')"
        >
          保存草稿
        </button>
      </div>
    </div>
  </section>
</template>

<style scoped>
.decision-editor {
  display: grid;
  gap: 20px;
  align-content: start;
}
.editor-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}
.state-label {
  color: #73581e;
  background: #f7efd9;
  font-size: 11px;
  padding: 5px 9px;
  white-space: nowrap;
}
.option-picker {
  border: 1px solid var(--line);
  border-radius: 6px;
  padding: 16px;
  margin: 0;
  display: grid;
  gap: 10px;
  max-height: 260px;
  overflow-y: auto;
}
.option-picker legend {
  font-size: 11px;
  color: #727969;
  padding: 0 6px;
}
.picker-note {
  font-size: 11px;
  color: var(--muted);
  line-height: 1.7;
  margin: 0;
}
.option-pick {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 10px;
  font-size: 12px;
  color: var(--ink);
}
.option-pick input {
  width: auto;
  flex: none;
}
.option-choices {
  display: grid;
  gap: 14px;
}
.option-choice {
  display: grid;
  gap: 8px;
  border-left: 3px solid var(--line);
  padding-left: 14px;
}
.option-choose {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 10px;
  font-size: 12px;
  color: var(--ink);
}
.option-choose input {
  width: auto;
  flex: none;
}
.confirm-hints {
  background: #f6f7f0;
  border: 1px dashed #ccd5c7;
  border-radius: 6px;
  padding: 14px 16px;
  font-size: 11px;
  color: var(--muted);
  line-height: 1.8;
}
.confirm-hints p {
  margin: 4px 0 0;
}
.editor-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-top: 1px solid var(--line);
  padding-top: 20px;
  gap: 12px;
}
.save-indicator {
  font-size: 11px;
  color: var(--muted);
}
@media (max-width: 600px) {
  .editor-footer {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>
