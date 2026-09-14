<script setup lang="ts">
import { computed, shallowRef, watch } from 'vue'
import type { Assembly } from '../assemblies/types'
import type { CarbonDocument } from './types'
import { documentSnippet } from './types'
import { revisionNoteMax } from '../assemblies/validation'
import { date } from '../shared/format'
import DocumentSheet from './DocumentSheet.vue'
const props = defineProps<{
  assembly: Assembly
  documents: CarbonDocument[]
  dirty: boolean
  busy: boolean
  valid: boolean
  finalizeNote: string
  reopenNote: string
}>()
const emit = defineEmits<{
  finalize: []
  reopen: []
  design: []
  'update:finalizeNote': [value: string]
  'update:reopenNote': [value: string]
}>()
const selectedId = shallowRef('')
watch(
  () => props.documents,
  (documents) => {
    if (!documents.some((document) => document.id === selectedId.value))
      selectedId.value = documents[0]?.id ?? ''
  },
  { immediate: true },
)
const selected = computed(() =>
  props.documents.find((document) => document.id === selectedId.value),
)
function optionLabel(document: CarbonDocument): string {
  const snippet = documentSnippet(document)
  const head = `修订 ${document.assembly.revision} · ${date(document.createdAt)}`
  return snippet ? `${head} · ${snippet}` : `${head} · 未填写备注`
}
</script>

<template>
  <section class="document-workspace">
    <div class="section-heading">
      <div>
        <span class="eyebrow">设计留痕</span>
        <h1>把这一版，留在计算书里。</h1>
      </div>
      <button
        v-if="assembly.state === 'finalized'"
        class="button"
        :disabled="busy"
        @click="emit('reopen')"
      >
        重新开启编辑
      </button>
      <button
        v-else
        class="button primary"
        :disabled="busy || dirty || !valid"
        @click="emit('finalize')"
      >
        生成定稿
      </button>
    </div>
    <p class="section-intro">定稿将冻结构造与全部材料物性，计算书始终按生成时的输入显示。</p>
    <div class="revision-note">
      <label
        v-if="assembly.state === 'editing'"
        class="revision-note-field"
      >
        <span class="revision-note-label">
          本次定稿的修订备注（可选）
          <small>{{ finalizeNote.trim().length }}/{{ revisionNoteMax }}</small>
        </span>
        <input
          :value="finalizeNote"
          :maxlength="revisionNoteMax"
          :disabled="busy"
          placeholder="备注会随本份计算书冻结，后续编辑不能改写"
          @input="emit('update:finalizeNote', ($event.target as HTMLInputElement).value)"
        />
      </label>
      <label
        v-else
        class="revision-note-field"
      >
        <span class="revision-note-label">
          重新开启编辑的修订备注（可选）
          <small>{{ reopenNote.trim().length }}/{{ revisionNoteMax }}</small>
        </span>
        <input
          :value="reopenNote"
          :maxlength="revisionNoteMax"
          :disabled="busy"
          placeholder="说明为什么要在本版之后继续修改"
          @input="emit('update:reopenNote', ($event.target as HTMLInputElement).value)"
        />
      </label>
    </div>
    <p
      v-if="dirty"
      class="inline-warning"
    >
      请先返回构造编辑保存修改，才能生成本次定稿。
    </p>
    <div
      v-if="!documents.length"
      class="empty-state"
    >
      <h2>这个构造还没有计算书</h2>
      <p>完成构造编辑并保存后，点击「生成定稿」。</p>
      <button
        class="button"
        @click="emit('design')"
      >
        返回构造编辑
      </button>
    </div>
    <template v-else>
      <label class="document-version"
        >历史计算书
        <select v-model="selectedId">
          <option
            v-for="document in documents"
            :key="document.id"
            :value="document.id"
          >
            {{ optionLabel(document) }}
          </option>
        </select>
      </label>
      <DocumentSheet
        v-if="selected"
        :document="selected"
      />
    </template>
  </section>
</template>

<style scoped>
.document-workspace {
  max-width: 1100px;
  margin: 0 auto;
}
.document-version {
  max-width: 640px;
  margin: 24px 0;
}
.revision-note {
  margin: 18px 0;
}
.revision-note-field {
  display: grid;
  gap: 7px;
  max-width: 560px;
}
.revision-note-label {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 10px;
  color: #727969;
  font-size: 11px;
}
.revision-note-label small {
  color: var(--muted);
  font-variant-numeric: tabular-nums;
}
</style>
