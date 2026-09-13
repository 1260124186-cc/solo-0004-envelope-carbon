<script setup lang="ts">
import { computed, ref } from 'vue'
import type { Assembly } from '../assemblies/types'
import type { EnvelopeScheme, SchemeEvaluation } from './types'
import { surfaceLabels } from '../assemblies/types'
import { number } from '../shared/format'
import DriftBanner from './DriftBanner.vue'
import SchemeSummary from './SchemeSummary.vue'

const props = defineProps<{
  scheme: EnvelopeScheme
  assemblies: Assembly[]
  evaluation: SchemeEvaluation | null
  busy: boolean
  dirty: boolean
}>()
const emit = defineEmits<{
  update: [patch: Partial<EnvelopeScheme>]
  addEntry: [assemblyId: string]
  updateEntry: [entryId: string, area: number]
  removeEntry: [entryId: string]
  keep: [entryId: string]
  updateReference: [entryId: string]
  save: []
  design: []
}>()

const selectedAssemblyId = ref('')
const referencedIds = computed(() => new Set(props.scheme.entries.map((entry) => entry.assemblyId)))
const availableAssemblies = computed(() =>
  props.assemblies.filter((assembly) => !referencedIds.value.has(assembly.id)),
)
function numeric(event: Event): number {
  return (event.target as HTMLInputElement).valueAsNumber
}
function addSelected() {
  if (!selectedAssemblyId.value) return
  emit('addEntry', selectedAssemblyId.value)
  selectedAssemblyId.value = ''
}
</script>

<template>
  <div class="scheme-grid">
    <section class="scheme-surface">
      <div class="section-heading">
        <div>
          <span class="eyebrow">建筑围护组合</span>
          <h1>把外墙、屋面与楼板，组织成一份方案。</h1>
        </div>
      </div>
      <p class="section-intro">
        从已保存构造中选择部位并填写该部位在本组合中的实际面积。组合保存时冻结引用版本；原构造后续修改不会悄悄改变已保存的结果。
      </p>

      <DriftBanner
        v-if="evaluation"
        :entries="evaluation.entries"
        :busy="busy"
        @keep="emit('keep', $event)"
        @update="emit('updateReference', $event)"
      />

      <fieldset
        class="scheme-fields"
        :disabled="busy"
      >
        <legend class="sr-only">组合基本信息</legend>
        <label class="wide"
          >组合名称
          <input
            :value="scheme.name"
            maxlength="50"
            @input="emit('update', { name: ($event.target as HTMLInputElement).value })"
          />
        </label>
        <label class="wide"
          >组合说明
          <textarea
            rows="2"
            maxlength="1000"
            :value="scheme.note"
            placeholder="记录方案范围、面积口径或设计假设"
            @input="emit('update', { note: ($event.target as HTMLTextAreaElement).value })"
          ></textarea>
        </label>
      </fieldset>

      <div
        v-if="!assemblies.length"
        class="empty-state"
      >
        <h2>还没有可引用的构造</h2>
        <p>先到构造编辑保存外墙、屋面或楼板构造，再回到这里组合。</p>
        <button
          class="button primary"
          @click="emit('design')"
        >
          前往构造编辑
        </button>
      </div>

      <template v-else>
        <div class="entry-add">
          <label class="add-select"
            >从已保存构造中选择
            <select
              v-model="selectedAssemblyId"
              :disabled="busy"
              aria-label="从已保存构造中选择"
            >
              <option
                value=""
                disabled
              >
                {{ availableAssemblies.length ? '选择要加入的构造' : '所有构造均已加入' }}
              </option>
              <option
                v-for="assembly in availableAssemblies"
                :key="assembly.id"
                :value="assembly.id"
              >
                {{ surfaceLabels[assembly.surface] }} · {{ assembly.name }} ·
                {{ assembly.years }} 年
              </option>
            </select>
          </label>
          <button
            class="button"
            :disabled="busy || !selectedAssemblyId"
            @click="addSelected"
          >
            ＋ 加入组合
          </button>
        </div>

        <div
          v-if="evaluation && !evaluation.consistent && !evaluation.findings.length"
          class="inline-warning mixed-line"
        >
          组合内存在不同计算年限（{{ evaluation.yearSets.join('、') }}
          年）：各部位结果仍分别有效，但不能直接混算组合总量与平均强度，右侧仅提供分年限小计。
        </div>

        <div
          v-if="scheme.entries.length"
          class="table-scroll"
        >
          <table>
            <caption>
              组合部位与实际面积
            </caption>
            <thead>
              <tr>
                <th scope="col">建筑部位</th>
                <th scope="col">引用构造 / 版本</th>
                <th scope="col">计算年限</th>
                <th scope="col">组合内实际面积（平方米）</th>
                <th scope="col">碳强度（千克当量/平方米）</th>
                <th scope="col">隐含碳合计（千克当量）</th>
                <th scope="col">操作</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="entry in evaluation?.entries ?? []"
                :key="entry.entry.id"
                :class="{ 'row-mixed': !evaluation?.consistent }"
              >
                <td>{{ surfaceLabels[entry.entry.snapshot.surface] }}</td>
                <td>
                  {{ entry.entry.name }}
                  <small>
                    （原面积 {{ number(entry.entry.snapshot.area) }} · 修订
                    {{ entry.entry.revision }}）</small
                  >
                  <span
                    v-if="entry.acknowledged"
                    class="tag tag-kept"
                    >已保留冻结版本</span
                  >
                  <span
                    v-else-if="entry.status === 'missing'"
                    class="tag tag-missing"
                    >原构造已删除 · 待处理</span
                  >
                  <span
                    v-else-if="entry.status === 'modified'"
                    class="tag tag-missing"
                    >原构造已修改 · 待选择</span
                  >
                </td>
                <td :class="{ 'year-mixed': !evaluation?.consistent }">{{ entry.years }} 年</td>
                <td>
                  <label
                    class="sr-only"
                    :for="`area-${entry.entry.id}`"
                    >{{ entry.entry.name }} 在组合中的实际面积（平方米）</label
                  >
                  <input
                    :id="`area-${entry.entry.id}`"
                    class="area-input"
                    type="number"
                    min="0.1"
                    max="1000000"
                    step="0.1"
                    :value="entry.entry.area"
                    :disabled="busy"
                    @input="emit('updateEntry', entry.entry.id, numeric($event))"
                  />
                </td>
                <td>{{ number(entry.intensity) }}</td>
                <td data-check="entry-whole">{{ number(entry.whole) }}</td>
                <td>
                  <button
                    class="button small"
                    :disabled="busy"
                    :aria-label="`从组合中移除 ${entry.entry.name}`"
                    @click="emit('removeEntry', entry.entry.id)"
                  >
                    移除
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="scheme-footer">
          <span class="save-indicator">{{
            busy ? '正在保存…' : dirty ? '有未保存的修改' : `已保存 · 修订 ${scheme.revision}`
          }}</span>
          <button
            class="button primary"
            :disabled="busy || !dirty"
            @click="emit('save')"
          >
            保存组合
          </button>
        </div>
      </template>
    </section>
    <SchemeSummary :evaluation="evaluation" />
  </div>
</template>

<style scoped>
.scheme-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 380px;
  gap: 28px;
  align-items: start;
}
.scheme-surface {
  background: var(--paper);
  border: 1px solid var(--line);
  padding: 28px;
  border-radius: 8px;
}
.scheme-fields {
  border: 0;
  padding: 0;
  margin: 0 0 24px;
  display: grid;
  grid-template-columns: 1fr;
  gap: 16px;
}
.entry-add {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: end;
  gap: 12px;
  margin-bottom: 18px;
}
.mixed-line {
  margin: 0 0 14px;
}
.area-input {
  width: 130px;
}
.tag {
  display: inline-block;
  margin-left: 6px;
  padding: 2px 7px;
  border-radius: 3px;
  font-size: 10px;
}
.tag-kept {
  background: var(--green-pale);
  color: var(--green);
}
.tag-missing {
  background: #fbf0db;
  color: #995128;
}
.row-mixed .year-mixed {
  color: #995128;
  font-weight: 600;
}
.scheme-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-top: 1px solid var(--line);
  margin-top: 24px;
  padding-top: 20px;
  gap: 12px;
}
.save-indicator {
  font-size: 11px;
  color: var(--muted);
}
@media (max-width: 1100px) {
  .scheme-grid {
    grid-template-columns: 1fr;
  }
}
@media (max-width: 600px) {
  .scheme-surface {
    padding: 18px;
  }
  .entry-add {
    grid-template-columns: 1fr;
  }
  .scheme-footer {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>
