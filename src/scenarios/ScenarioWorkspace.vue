<script setup lang="ts">
import { computed, shallowRef } from 'vue'
import type { Assembly, Finding } from '../assemblies/types'
import type { ScenarioStudy, StudyEvaluation } from './types'
import { surfaceLabels, stateLabels } from '../assemblies/types'
import { evaluateStudy } from './engine'
import { date, number } from '../shared/format'
import ScenarioFactorTable from './ScenarioFactorTable.vue'
import ScenarioResultPanel from './ScenarioResultPanel.vue'
const props = defineProps<{
  assemblies: Assembly[]
  studies: ScenarioStudy[]
  draft: ScenarioStudy | null
  findings: Finding[]
  busy: boolean
  dirty: boolean
}>()
const emit = defineEmits<{
  start: [assemblyId: string]
  select: [id: string]
  clear: []
  update: [patch: Partial<ScenarioStudy>]
  range: [materialId: string, key: 'low' | 'reference' | 'high', value: number]
  reset: [materialId: string]
  save: []
  remove: [id: string]
}>()
const sourceId = shallowRef('')
const effectiveSourceId = computed(() => sourceId.value || props.assemblies[0]?.id || '')
const sourceAssembly = computed(() =>
  props.draft
    ? props.assemblies.find((item) => item.id === props.draft!.sourceAssemblyId)
    : undefined,
)
const evaluation = computed<{ value: StudyEvaluation | null; error: string }>(() => {
  if (!props.draft) return { value: null, error: '' }
  if (props.findings.some((finding) => finding.path.startsWith('snapshot'))) {
    return { value: null, error: '研究采用的构造或物性不完整，无法计算情景。' }
  }
  try {
    return { value: evaluateStudy(props.draft), error: '' }
  } catch (cause) {
    return { value: null, error: cause instanceof Error ? cause.message : '情景计算无法完成。' }
  }
})
const structuralFindings = computed(() =>
  props.findings.filter(
    (finding) => !finding.path.startsWith('ranges.') && finding.path !== 'ranges',
  ),
)
const rangeBlocking = computed(() =>
  props.findings.some((finding) => finding.path.startsWith('ranges')),
)
</script>

<template>
  <section class="scenario-workspace">
    <div class="section-heading">
      <div>
        <span class="eyebrow">参数情景研究</span>
        <h1>给碳因子一个范围，而不是一个定值。</h1>
      </div>
      <button
        v-if="!draft"
        class="button primary"
        :disabled="busy || !assemblies.length"
        @click="emit('start', effectiveSourceId)"
      >
        ＋ 新建参数情景研究
      </button>
    </div>
    <p class="section-intro">
      为构造使用的每种材料填写碳因子低值、参考值与高值，系统分别计算三种情景的隐含碳强度与总量，并判断是否达到构造目标。
      研究只冻结并使用建立时的构造与物性，不修改材料目录和原构造；不进行概率分布或随机模拟。
    </p>

    <div
      v-if="!draft"
      class="study-landing"
    >
      <div
        v-if="studies.length"
        class="saved-studies panel"
      >
        <h2>已保存的研究（{{ studies.length }}）</h2>
        <ul class="study-list">
          <li
            v-for="study in studies"
            :key="study.id"
          >
            <div class="study-item-main">
              <strong>{{ study.name }}</strong>
              <span
                >来源构造：{{
                  assemblies.find((item) => item.id === study.sourceAssemblyId)?.name ??
                  '来源构造已删除'
                }}
                · 修订 {{ study.snapshot.assemblyRevision }}</span
              >
              <span>更新于 {{ date(study.updatedAt) }}</span>
            </div>
            <div class="actions">
              <button
                class="button small"
                :disabled="busy"
                @click="emit('select', study.id)"
              >
                重新打开
              </button>
              <button
                class="button small"
                :disabled="busy"
                @click="emit('remove', study.id)"
              >
                删除
              </button>
            </div>
          </li>
        </ul>
      </div>
      <div
        v-if="assemblies.length"
        class="new-study panel"
      >
        <h2>从已保存构造开始</h2>
        <p class="muted">研究将冻结该构造当前保存版本的层组成与材料物性。</p>
        <label
          >选择构造
          <select
            v-model="sourceId"
            :aria-label="'选择用于新建研究的构造'"
            :disabled="busy"
          >
            <option
              v-for="item in assemblies"
              :key="item.id"
              :value="item.id"
            >
              {{ item.name }} · {{ stateLabels[item.state] }} · 修订 {{ item.revision }}
            </option>
          </select>
        </label>
        <button
          class="button primary"
          :disabled="busy"
          @click="emit('start', effectiveSourceId)"
        >
          建立研究
        </button>
      </div>
      <div
        v-else
        class="empty-state"
      >
        <h2>还没有可用的构造</h2>
        <p>请先在构造编辑中建立并保存一个构造，再开展参数情景研究。</p>
      </div>
    </div>

    <div
      v-else
      class="study-editor"
    >
      <div class="study-toolbar">
        <button
          class="button small"
          :disabled="busy"
          @click="emit('clear')"
        >
          ← 返回研究列表
        </button>
        <span
          class="revision-tag"
          :title="`来源构造更新时间 ${date(draft.snapshot.assemblyUpdatedAt)}`"
        >
          冻结来源「{{
            assemblies.find((item) => item.id === draft!.sourceAssemblyId)?.name ??
            draft.snapshot.assembly.name
          }}」· 修订 {{ draft.snapshot.assemblyRevision }}
        </span>
      </div>

      <div class="editor-grid">
        <div class="editor-main panel">
          <label class="study-name"
            >研究名称
            <input
              type="text"
              maxlength="50"
              aria-label="研究名称"
              :value="draft.name"
              :disabled="busy"
              @input="emit('update', { name: ($event.target as HTMLInputElement).value })"
            />
          </label>
          <label class="study-note"
            >研究假设（范围依据、口径说明）
            <textarea
              rows="3"
              maxlength="1000"
              aria-label="研究假设"
              :value="draft.note"
              :disabled="busy"
              @input="emit('update', { note: ($event.target as HTMLTextAreaElement).value })"
            ></textarea>
          </label>

          <ScenarioFactorTable
            :study="draft"
            :materials="draft.snapshot.materials"
            :findings="findings"
            :busy="busy"
            @range="(materialId, key, value) => emit('range', materialId, key, value)"
            @reset="emit('reset', $event)"
          />

          <ul
            v-if="structuralFindings.length"
            class="finding-list"
          >
            <li
              v-for="finding in structuralFindings"
              :key="finding.path + finding.text"
            >
              {{ finding.text }}
            </li>
          </ul>

          <div class="study-footer">
            <span class="save-indicator">{{
              busy ? '正在保存…' : dirty ? '有未保存的修改' : '研究已保存'
            }}</span>
            <div class="actions">
              <button
                class="button"
                :disabled="busy"
                @click="emit('remove', draft.id)"
              >
                删除研究
              </button>
              <button
                class="button primary"
                :disabled="busy || !dirty || findings.length > 0"
                @click="emit('save')"
              >
                保存研究
              </button>
            </div>
          </div>
        </div>

        <aside class="editor-side">
          <div class="snapshot-card panel">
            <span class="eyebrow">冻结的构造条件</span>
            <h3>{{ draft.snapshot.assembly.name }}</h3>
            <p>
              {{ surfaceLabels[draft.snapshot.assembly.surface] }} ·
              {{ number(draft.snapshot.assembly.area) }} 平方米 ·
              {{ draft.snapshot.assembly.years }} 年计算期
            </p>
            <p>
              {{ draft.snapshot.assembly.layers.length }} 个构造层 · 碳强度目标 ≤
              {{ number(draft.snapshot.assembly.carbonLimit) }}
            </p>
            <p
              v-if="sourceAssembly && sourceAssembly.revision !== draft.snapshot.assemblyRevision"
              class="staleness"
            >
              来源构造此后已有修改（当前修订
              {{
                sourceAssembly.revision
              }}）。本研究仍使用建立时冻结的版本；如需按最新构造研究，请新建一项研究。
            </p>
            <details>
              <summary>冻结物性与来源</summary>
              <ul class="snapshot-materials">
                <li
                  v-for="material in draft.snapshot.materials"
                  :key="material.id"
                >
                  <strong>{{ material.name }}</strong>
                  <span
                    >密度 {{ number(material.density) }} 千克/立方米 · 导热
                    {{ number(material.conductivity) }}</span
                  >
                  <span>{{ material.source }}</span>
                </li>
              </ul>
            </details>
          </div>
        </aside>
      </div>

      <div
        v-if="evaluation.error"
        class="empty-state"
      >
        {{ evaluation.error }}
      </div>
      <ScenarioResultPanel
        v-else-if="evaluation.value && !rangeBlocking"
        :evaluation="evaluation.value"
        :assembly="draft.snapshot.assembly"
      />
      <div
        v-else
        class="empty-state"
      >
        请为每种材料补全满足低值 ≤ 参考值 ≤ 高值的碳因子，保存前会持续校验。
      </div>
    </div>
  </section>
</template>

<style scoped>
.scenario-workspace {
  max-width: 1200px;
  margin: 0 auto;
}
.study-landing {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 340px;
  gap: 20px;
  align-items: start;
}
.saved-studies h2,
.new-study h2 {
  margin-top: 0;
}
.study-list {
  list-style: none;
  margin: 16px 0 0;
  padding: 0;
}
.study-list li {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  padding: 14px 0;
  border-bottom: 1px solid var(--line);
}
.study-item-main {
  display: grid;
  gap: 4px;
  font-size: 11px;
  color: var(--muted);
}
.study-item-main strong {
  color: var(--ink);
  font-weight: 600;
  font-size: 13px;
}
.new-study {
  display: grid;
  gap: 14px;
}
.study-toolbar {
  display: flex;
  align-items: center;
  gap: 14px;
  margin: 20px 0;
  flex-wrap: wrap;
}
.revision-tag {
  font-size: 11px;
  color: var(--muted);
}
.editor-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 320px;
  gap: 20px;
  align-items: start;
}
.editor-side {
  display: grid;
  gap: 16px;
}
.study-name,
.study-note {
  margin-bottom: 16px;
}
.snapshot-card h3 {
  margin: 8px 0;
  font-size: 15px;
}
.snapshot-card p {
  font-size: 11px;
  color: var(--muted);
  line-height: 1.7;
  margin: 6px 0;
}
.snapshot-card .staleness {
  color: #865629;
  background: #fcf3de;
  padding: 9px 11px;
  border-radius: 4px;
}
.snapshot-card summary {
  cursor: pointer;
  font-size: 11px;
  color: var(--muted);
}
.snapshot-materials {
  margin: 10px 0 0;
  padding-left: 16px;
  font-size: 10px;
  color: var(--muted);
  line-height: 1.7;
}
.snapshot-materials strong {
  color: var(--ink);
  font-weight: 500;
}
.snapshot-materials span {
  display: block;
}
.finding-list {
  margin: 12px 0 0;
  padding-left: 18px;
  color: #922f20;
  font-size: 12px;
  line-height: 1.8;
}
.study-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-top: 1px solid var(--line);
  margin-top: 20px;
  padding-top: 18px;
  gap: 12px;
}
.save-indicator {
  font-size: 11px;
  color: var(--muted);
}
@media (max-width: 980px) {
  .study-landing,
  .editor-grid {
    grid-template-columns: 1fr;
  }
}
@media (max-width: 600px) {
  .study-footer {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>
