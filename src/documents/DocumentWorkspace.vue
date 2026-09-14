<script setup lang="ts">
import { computed, shallowRef, watch } from 'vue'
import type { Assembly } from '../assemblies/types'
import type { CarbonDocument } from './types'
import type { DocumentDiff } from './diff'
import { date } from '../shared/format'
import { diffDocuments } from './diff'
import DocumentSheet from './DocumentSheet.vue'
import DocumentDiffView from './DocumentDiffView.vue'

const props = defineProps<{
  assembly: Assembly
  documents: CarbonDocument[]
  dirty: boolean
  busy: boolean
  valid: boolean
}>()
const emit = defineEmits<{ finalize: []; reopen: []; design: [] }>()

type ViewMode = 'single' | 'diff'
const mode = shallowRef<ViewMode>('single')
const selectedId = shallowRef('')
const beforeId = shallowRef('')
const afterId = shallowRef('')

function revisionLabel(document: CarbonDocument): string {
  return `修订 ${document.assembly.revision} · ${date(document.createdAt)}`
}

watch(
  () => props.documents,
  (documents, previous = []) => {
    if (!documents.some((document) => document.id === selectedId.value))
      selectedId.value = documents[0]?.id ?? ''
    // 两版选择只影响本页本地视图，不触碰构造状态，也不生成新定稿。
    const previousIds = new Set(previous.map((document) => document.id))
    const appeared = documents.filter((document) => !previousIds.has(document.id))
    if (documents.length && appeared.length) {
      // 新定稿生成后，默认对照最新两版（旧版在前）。
      afterId.value = documents[0].id
      beforeId.value = documents[1]?.id ?? documents[0].id
      return
    }
    if (!documents.some((document) => document.id === afterId.value))
      afterId.value = documents[0]?.id ?? ''
    if (!documents.some((document) => document.id === beforeId.value))
      beforeId.value = documents[1]?.id ?? documents[0]?.id ?? ''
  },
  { immediate: true },
)

const selected = computed(() =>
  props.documents.find((document) => document.id === selectedId.value),
)
const beforeDocument = computed(() =>
  props.documents.find((document) => document.id === beforeId.value),
)
const afterDocument = computed(() =>
  props.documents.find((document) => document.id === afterId.value),
)
const sameSelection = computed(
  () => beforeDocument.value !== undefined && beforeId.value === afterId.value,
)
const diff = computed<{ value: DocumentDiff | null; error: string }>(() => {
  if (!beforeDocument.value || !afterDocument.value) return { value: null, error: '' }
  if (sameSelection.value) return { value: null, error: '请在两个版本框中分别选择不同的修订版。' }
  try {
    // 旧版在前、新版在后；选择框顺序即时间顺序，不依赖数组当前排列。
    return { value: diffDocuments(beforeDocument.value, afterDocument.value), error: '' }
  } catch (cause) {
    return {
      value: null,
      error: cause instanceof Error ? cause.message : '无法对照这两个版本。',
    }
  }
})
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
      <div
        class="mode-switch"
        role="group"
        aria-label="历史查看方式"
      >
        <button
          class="button small"
          :class="{ primary: mode === 'single' }"
          :aria-pressed="mode === 'single'"
          data-check="mode-single"
          @click="mode = 'single'"
        >
          单版查看
        </button>
        <button
          class="button small"
          :class="{ primary: mode === 'diff' }"
          :aria-pressed="mode === 'diff'"
          data-check="mode-diff"
          @click="mode = 'diff'"
        >
          两版对照
        </button>
      </div>

      <template v-if="mode === 'single'">
        <label class="document-version"
          >历史计算书
          <select v-model="selectedId">
            <option
              v-for="document in documents"
              :key="document.id"
              :value="document.id"
            >
              {{ revisionLabel(document) }}
            </option>
          </select>
        </label>
        <DocumentSheet
          v-if="selected"
          :document="selected"
        />
      </template>

      <template v-else>
        <div
          v-if="documents.length < 2"
          class="empty-state diff-empty"
          data-check="diff-unavailable"
        >
          <h2>只有一版，暂不能对照</h2>
          <p>两版对照需要同一构造的两份冻结计算书。请先重新开启编辑，修改并保存后再次生成定稿。</p>
          <p class="muted">对照只读取两份计算书各自冻结的内容，不会用当前材料目录重算旧参数。</p>
        </div>
        <template v-else>
          <div class="diff-selectors">
            <label
              >基准版本（旧版）
              <select v-model="beforeId">
                <option
                  v-for="document in documents"
                  :key="document.id"
                  :value="document.id"
                >
                  {{ revisionLabel(document) }}
                </option>
              </select>
            </label>
            <span
              class="diff-arrow"
              aria-hidden="true"
              >→</span
            >
            <label
              >对照版本（新版）
              <select v-model="afterId">
                <option
                  v-for="document in documents"
                  :key="document.id"
                  :value="document.id"
                >
                  {{ revisionLabel(document) }}
                </option>
              </select>
            </label>
          </div>
          <p
            v-if="diff.error"
            class="inline-warning"
            data-check="diff-warning"
          >
            {{ diff.error }}
          </p>
          <DocumentDiffView
            v-else-if="diff.value"
            :diff="diff.value"
          />
        </template>
      </template>
    </template>
  </section>
</template>

<style scoped>
.document-workspace {
  max-width: 1100px;
  margin: 0 auto;
}
.document-version {
  max-width: 420px;
  margin: 24px 0;
}
.mode-switch {
  display: flex;
  gap: 8px;
  margin: 20px 0 8px;
}
.diff-selectors {
  display: grid;
  grid-template-columns: 1fr 30px 1fr;
  align-items: end;
  gap: 20px;
  margin: 20px 0;
}
.diff-arrow {
  padding-bottom: 12px;
  text-align: center;
  color: var(--green);
}
.diff-empty {
  margin-top: 16px;
}
@media (max-width: 650px) {
  .diff-selectors {
    grid-template-columns: 1fr;
    gap: 12px;
  }
  .diff-arrow {
    display: none;
  }
}
</style>
