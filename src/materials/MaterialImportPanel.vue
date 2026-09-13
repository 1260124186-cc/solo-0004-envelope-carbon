<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { Material } from './types'
import { kindLabels } from './types'
import {
  importColumnHelp,
  importHeaderLabels,
  importTemplateRows,
  previewImport,
  toDrafts,
  type ImportRowPreview,
} from './importing'

const props = defineProps<{
  materials: Material[]
  busy: boolean
  importMaterials: (
    entries: { draft: ReturnType<typeof toDrafts>[number]; line: number }[],
  ) => Promise<{ ok: boolean; lineErrors?: { line: number; text: string }[] }>
}>()
const emit = defineEmits<{ imported: []; cancel: [] }>()

const text = ref('')
const fileError = ref('')
const fileInput = ref<HTMLInputElement | null>(null)
const preview = computed(() => previewImport(text.value, props.materials))
const canImport = computed(
  () =>
    !props.busy &&
    preview.value.rows.length > 0 &&
    preview.value.validCount > 0 &&
    preview.value.invalidCount === 0 &&
    preview.value.batchIssues.length === 0,
)
// 提交期间由存储锁内复查按行打回的冲突（例如其他标签页抢先新建）。
const serverLineErrors = ref<Map<number, string[]>>(new Map())

watch(text, () => {
  fileError.value = ''
  serverLineErrors.value = new Map()
})
watch(
  () => props.materials,
  () => {
    serverLineErrors.value = new Map()
  },
)

function issuesOf(row: ImportRowPreview): string[] {
  const texts = row.issues.map((issue) => issue.text)
  if (row.conflict) texts.push(row.conflict)
  const server = serverLineErrors.value.get(row.line)
  if (server) texts.push(...server)
  return texts
}

function fillTemplate() {
  text.value = importTemplateRows.map((row) => row.join('\t')).join('\n')
}

async function onFileChange(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  fileError.value = ''
  if (file.size > 2 * 1024 * 1024) {
    fileError.value = '清单文件超过 2 MB，请精简后再选择。'
    input.value = ''
    return
  }
  try {
    text.value = await file.text()
  } catch {
    fileError.value = '无法读取该文件，请改用复制粘贴方式导入。'
  }
  input.value = ''
}

async function submit() {
  if (!canImport.value) return
  const validRows = preview.value.rows.filter((row) => row.issues.length === 0 && !row.conflict)
  const entries = toDrafts(preview.value.rows).map((draft, index) => ({
    draft,
    line: validRows[index]?.line ?? 0,
  }))
  const result = await props.importMaterials(entries)
  if (result.ok) {
    text.value = ''
    serverLineErrors.value = new Map()
    emit('imported')
  } else if (result.lineErrors?.length) {
    const next = new Map<number, string[]>()
    for (const { line, text: message } of result.lineErrors) {
      next.set(line, [...(next.get(line) ?? []), message])
    }
    serverLineErrors.value = next
  }
}
</script>

<template>
  <form
    class="import-panel"
    @submit.prevent="submit"
  >
    <div class="section-heading">
      <h2>批量导入自定义材料</h2>
      <button
        type="button"
        class="button small"
        :disabled="busy"
        @click="emit('cancel')"
      >
        收起
      </button>
    </div>
    <p class="import-help">
      {{ importColumnHelp }}首行可写“{{
        importHeaderLabels.join('、')
      }}”等表头，也可直接粘贴数据行。 支持制表符（从 Excel/WPS
      复制）或逗号分隔文本（.csv/.tsv/.txt），类别请填写
      <strong>主体材料、保温材料、饰面材料</strong>。所有处理均在本机浏览器完成，不会上传。
    </p>
    <label class="import-text-label"
      >材料清单
      <textarea
        v-model="text"
        rows="8"
        spellcheck="false"
        placeholder="粘贴清单后将逐行预览校验结果，确认无问题再整批写入。"
        aria-describedby="import-actions"
      />
    </label>
    <div
      id="import-actions"
      class="import-actions"
    >
      <div class="actions">
        <button
          type="button"
          class="button small"
          :disabled="busy"
          @click="fillTemplate"
        >
          填入示例清单
        </button>
        <button
          type="button"
          class="button small"
          :disabled="busy"
          @click="fileInput?.click()"
        >
          从文件读取
        </button>
        <input
          ref="fileInput"
          type="file"
          class="sr-only"
          accept=".csv,.tsv,.txt,text/csv,text/plain,tab-separated-values"
          @change="onFileChange"
        />
      </div>
      <p
        v-if="fileError"
        class="import-file-error"
        role="alert"
      >
        {{ fileError }}
      </p>
    </div>

    <div
      v-if="preview.rows.length || preview.batchIssues.length"
      class="import-preview"
      aria-live="polite"
    >
      <p class="import-summary">
        共解析 {{ preview.rows.length }} 行：
        <span class="summary-ok">{{ preview.validCount }} 行可导入</span>，
        <span :class="preview.invalidCount ? 'summary-bad' : 'summary-ok'">
          {{ preview.invalidCount }} 行需修正
        </span>
        。逐行校验完成后才可整批写入；任一行失败都不会写入任何材料。
      </p>
      <ul
        v-if="preview.batchIssues.length"
        class="batch-issues"
      >
        <li
          v-for="issue in preview.batchIssues"
          :key="issue"
        >
          {{ issue }}
        </li>
      </ul>
      <div class="table-scroll">
        <table>
          <caption>
            逐行预览：物性范围与手工新建完全一致，重名或冲突条目已在行内标出
          </caption>
          <thead>
            <tr>
              <th scope="col">行</th>
              <th scope="col">状态</th>
              <th scope="col">名称</th>
              <th scope="col">类别</th>
              <th scope="col">密度</th>
              <th scope="col">导热系数</th>
              <th scope="col">碳因子</th>
              <th scope="col">寿命</th>
              <th scope="col">来源</th>
              <th scope="col">问题与冲突</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="row in preview.rows"
              :key="row.line"
              :class="{ 'row-invalid': issuesOf(row).length }"
            >
              <td>{{ row.line }}</td>
              <td>
                <span
                  :class="['status-dot', issuesOf(row).length ? 'bad' : 'ok']"
                  aria-hidden="true"
                ></span>
                <span class="sr-only">{{ issuesOf(row).length ? '待修正' : '可导入' }}</span>
                {{ issuesOf(row).length ? '待修正' : '可导入' }}
              </td>
              <td :title="row.raw.name">{{ row.raw.name || '—' }}</td>
              <td>{{ row.kind ? kindLabels[row.kind] : row.raw.kind || '—' }}</td>
              <td>{{ row.raw.density || '—' }}</td>
              <td>{{ row.raw.conductivity || '—' }}</td>
              <td>{{ row.raw.factor || '—' }}</td>
              <td>{{ row.raw.lifespan || '—' }}</td>
              <td :title="row.raw.source">{{ row.raw.source || '—' }}</td>
              <td class="issue-cell">
                <ul
                  v-if="issuesOf(row).length"
                  class="row-issues"
                >
                  <li
                    v-for="(message, index) in issuesOf(row)"
                    :key="index"
                  >
                    {{ message }}
                  </li>
                </ul>
                <span
                  v-else
                  class="muted"
                  >无</span
                >
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div class="import-footer">
        <p class="muted import-fineprint">
          导入的材料将标记为自定义物性，与手工新建完全等效，可直接用于构造层；不会覆盖任何已有材料。
        </p>
        <button
          type="submit"
          class="button primary"
          :disabled="!canImport"
        >
          {{ busy ? '正在写入…' : `确认整批导入 ${preview.validCount} 种材料` }}
        </button>
      </div>
      <p
        v-if="preview.rows.length && !canImport && !preview.batchIssues.length"
        class="import-blocked"
      >
        请按行修正标红条目（问题保留在预览中），全部通过后再确认导入。
      </p>
    </div>
  </form>
</template>

<style scoped>
.import-panel {
  background: #f4f7f1;
  border: 1px solid #d1dfd4;
  padding: 24px;
  border-radius: 6px;
  margin: 24px 0;
}
.import-help {
  font-size: 11px;
  color: var(--muted);
  line-height: 1.9;
  margin: 14px 0 16px;
}
.import-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  margin-top: 10px;
  flex-wrap: wrap;
}
.import-file-error {
  margin: 0;
  font-size: 11px;
  color: #855123;
}
.import-preview {
  margin-top: 22px;
}
.import-summary {
  font-size: 12px;
  margin: 0 0 6px;
}
.summary-ok {
  color: var(--green);
  font-weight: 600;
}
.summary-bad {
  color: #922f20;
  font-weight: 600;
}
.batch-issues {
  margin: 8px 0 0;
  padding-left: 18px;
  font-size: 12px;
  color: #855123;
}
.status-dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  margin-right: 6px;
}
.status-dot.ok {
  background: #4a7d5f;
}
.status-dot.bad {
  background: #b3563f;
}
tr.row-invalid {
  background: #fdf1ec;
}
.issue-cell {
  white-space: normal;
  min-width: 220px;
}
.row-issues {
  margin: 0;
  padding-left: 16px;
  color: #8a3a26;
}
.row-issues li {
  margin: 3px 0;
}
.import-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  margin-top: 8px;
}
.import-fineprint {
  font-size: 11px;
  margin: 0;
}
.import-blocked {
  font-size: 11px;
  color: #855123;
  margin: 10px 0 0;
}
@media (max-width: 600px) {
  .import-footer {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>
