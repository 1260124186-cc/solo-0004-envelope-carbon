<script setup lang="ts">
import { computed, reactive, shallowRef } from 'vue'
import type { EnvelopeData } from '../persistence/types'
import type { ConflictChoices } from './types'
import { kindLabels } from './types'
import { backupFileLimit, parseBackup } from './backup'
import { mergeSegments, planMerge, planOutcome } from './merge'
import { downloadBackup } from './download'
const props = defineProps<{
  data: EnvelopeData
  busy: boolean
  restoreBackup: (incoming: EnvelopeData, choices: ConflictChoices) => Promise<boolean>
}>()
const incoming = shallowRef<EnvelopeData | null>(null)
const fileName = shallowRef('')
const fileError = shallowRef('')
const choices = reactive<Record<string, 'skip' | 'copy'>>({})
const plan = computed(() => (incoming.value ? planMerge(props.data, incoming.value) : null))
const outcome = computed(() =>
  incoming.value ? planOutcome(props.data, incoming.value, choices) : null,
)
const summary = computed(() => {
  if (!plan.value || !outcome.value) return ''
  if (!outcome.value.changes) {
    return plan.value.conflicts.length
      ? '按当前选择没有需要写入的记录：冲突记录均被跳过。'
      : '备份中的记录与现有设计完全相同，没有需要导入的内容。'
  }
  return `恢复将：${mergeSegments(outcome.value).join('；')}。`
})
const blocked = computed(
  () => props.busy || !outcome.value || !outcome.value.changes || outcome.value.overflow.length > 0,
)

async function onFile(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  reset()
  fileName.value = file.name
  if (file.size > backupFileLimit) {
    fileError.value = '备份文件超过 20 MB，不是本工具生成的有效备份。当前设计未被修改。'
    return
  }
  try {
    incoming.value = parseBackup(await file.text())
    for (const conflict of plan.value?.conflicts ?? []) choices[conflict.id] = 'copy'
  } catch (cause) {
    incoming.value = null
    fileError.value =
      cause instanceof Error ? cause.message : '无法读取备份文件。当前设计未被修改。'
  }
}

async function confirm() {
  if (!incoming.value || blocked.value) return
  const restored = await props.restoreBackup(incoming.value, { ...choices })
  if (restored) reset()
}

function reset() {
  incoming.value = null
  fileError.value = ''
  for (const key of Object.keys(choices)) delete choices[key]
}
</script>

<template>
  <section class="backup-workspace">
    <div class="section-heading">
      <div>
        <span class="eyebrow">本地文件 · 不上传</span>
        <h1>把设计，握在自己手里。</h1>
      </div>
    </div>
    <p class="section-intro">
      导出与恢复都在当前浏览器内完成，备份文件不会发送到任何服务。恢复前会校验文件格式与引用关系，恢复结果与日常保存一样接受下次打开时的启动校验。
    </p>
    <div class="backup-grid">
      <div class="panel">
        <h2>导出备份</h2>
        <p class="panel-note">
          将全部构造、材料与历史计算书保存为一个 JSON 文件，可转移到另一浏览器或在清理数据后恢复。
        </p>
        <p class="muted">
          当前设计：{{ data.assemblies.length }} 个构造 · {{ data.materials.length }} 种材料 ·
          {{ data.documents.length }} 份计算书
        </p>
        <button
          class="button primary"
          :disabled="busy"
          @click="downloadBackup(data)"
        >
          导出设计备份
        </button>
      </div>
      <div class="panel">
        <h2>从备份恢复</h2>
        <p class="panel-note">
          恢复采用合并方式：新增记录直接导入；与现有记录冲突时可逐条选择跳过或作为独立副本导入，副本的构造、构造层、材料引用与计算书关联会一并重映射到新标识。
        </p>
        <label class="file-label">
          备份文件
          <input
            type="file"
            accept=".json,application/json"
            aria-label="选择备份文件"
            :disabled="busy"
            @change="onFile"
          />
        </label>
        <p
          v-if="fileError"
          class="inline-warning"
          role="alert"
        >
          {{ fileError }}
        </p>
        <template v-if="incoming && plan && outcome">
          <p class="muted file-name">已读取：{{ fileName }}</p>
          <div
            v-if="
              plan.additions.assemblies.length ||
              plan.additions.materials.length ||
              plan.additions.documents.length
            "
            class="restore-group"
          >
            <h3>将新增</h3>
            <ul v-if="plan.additions.assemblies.length">
              <li
                v-for="item in plan.additions.assemblies"
                :key="item"
              >
                构造 · {{ item }}
              </li>
            </ul>
            <ul v-if="plan.additions.materials.length">
              <li
                v-for="item in plan.additions.materials"
                :key="item"
              >
                材料 · {{ item }}
              </li>
            </ul>
            <ul v-if="plan.additions.documents.length">
              <li
                v-for="item in plan.additions.documents"
                :key="item"
              >
                计算书 · {{ item }}
              </li>
            </ul>
          </div>
          <div
            v-if="plan.conflicts.length"
            class="restore-group"
          >
            <h3>与现有记录冲突（{{ plan.conflicts.length }}）</h3>
            <div
              v-for="conflict in plan.conflicts"
              :key="conflict.id"
              class="conflict-item"
              role="group"
              :aria-label="`冲突记录 ${conflict.label}`"
            >
              <div class="conflict-head">
                <strong>{{ conflict.label }}</strong>
                <span class="conflict-kind">{{ kindLabels[conflict.kind] }}</span>
              </div>
              <p class="conflict-compare">
                现有：{{ conflict.existingNote }}<br />备份：{{ conflict.incomingNote }}
              </p>
              <label class="conflict-choice">
                <input
                  v-model="choices[conflict.id]"
                  type="radio"
                  :name="`conflict-${conflict.id}`"
                  value="copy"
                />
                作为独立副本导入（关联记录重映射到新标识）
              </label>
              <label class="conflict-choice">
                <input
                  v-model="choices[conflict.id]"
                  type="radio"
                  :name="`conflict-${conflict.id}`"
                  value="skip"
                />
                跳过，保留现有记录
              </label>
            </div>
          </div>
          <p
            v-if="plan.keptCount"
            class="muted"
          >
            {{ plan.keptCount }} 条记录与现有内容相同，将保持不变。
          </p>
          <ul
            v-if="outcome.warnings.length"
            class="restore-warnings"
          >
            <li
              v-for="warning in outcome.warnings"
              :key="warning"
            >
              {{ warning }}
            </li>
          </ul>
          <p
            v-if="outcome.forcedDocuments.length"
            class="muted"
          >
            随所属构造一并跳过：{{ outcome.forcedDocuments.join('；') }}
          </p>
          <ul
            v-if="outcome.overflow.length"
            class="restore-overflow"
            role="alert"
          >
            <li
              v-for="line in outcome.overflow"
              :key="line"
            >
              {{ line }}
            </li>
          </ul>
          <p
            class="restore-summary"
            data-check="restore-summary"
          >
            {{ summary }}
          </p>
          <div class="actions">
            <button
              class="button primary"
              :disabled="blocked"
              @click="confirm"
            >
              确认恢复
            </button>
            <button
              class="button"
              :disabled="busy"
              @click="reset"
            >
              取消
            </button>
          </div>
        </template>
      </div>
    </div>
  </section>
</template>

<style scoped>
.backup-workspace {
  max-width: 1100px;
  margin: 0 auto;
}
.backup-grid {
  display: grid;
  grid-template-columns: 1fr 1.4fr;
  gap: 24px;
  align-items: start;
}
.panel h2 {
  margin: 0 0 12px;
}
.panel-note {
  color: var(--muted);
  font-size: 12px;
  line-height: 1.9;
  margin: 0 0 16px;
}
.file-label {
  max-width: 420px;
  margin-bottom: 16px;
}
.file-name {
  font-size: 11px;
  margin: 0 0 12px;
}
.restore-group {
  border-top: 1px solid var(--line);
  padding-top: 14px;
  margin-top: 14px;
}
.restore-group h3 {
  font-size: 13px;
  margin: 0 0 10px;
}
.restore-group ul {
  margin: 0 0 10px;
  padding-left: 20px;
  font-size: 12px;
  line-height: 1.9;
}
.conflict-item {
  border: 1px solid var(--line);
  border-radius: 6px;
  padding: 14px 16px;
  margin-bottom: 12px;
  display: grid;
  gap: 8px;
}
.conflict-head {
  display: flex;
  align-items: center;
  gap: 10px;
}
.conflict-kind {
  font-size: 10px;
  color: var(--muted);
  border: 1px solid var(--line);
  border-radius: 999px;
  padding: 2px 8px;
}
.conflict-compare {
  margin: 0;
  font-size: 11px;
  color: var(--muted);
  line-height: 1.8;
}
.conflict-choice {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: var(--ink);
}
.conflict-choice input {
  width: auto;
}
.restore-warnings {
  margin: 0 0 12px;
  padding: 12px 16px 12px 32px;
  background: #fcf3de;
  color: #865629;
  border-radius: 4px;
  font-size: 12px;
  line-height: 1.9;
}
.restore-overflow {
  margin: 0 0 12px;
  padding: 12px 16px 12px 32px;
  background: #fff0eb;
  color: #922f20;
  border-radius: 4px;
  font-size: 12px;
  line-height: 1.9;
}
.restore-summary {
  font-size: 13px;
  font-weight: 600;
  margin: 16px 0;
}
@media (max-width: 900px) {
  .backup-grid {
    grid-template-columns: 1fr;
  }
}
</style>
