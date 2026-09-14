<script setup lang="ts">
import { computed } from 'vue'
import type { Assembly } from '../assemblies/types'
import type { Material } from '../materials/types'
import type { DraftRecord } from './store'
import type { AssemblyDiff } from './diff'
import { describeNewAssembly } from './diff'
import { date } from '../shared/format'

const props = defineProps<{
  record: DraftRecord
  saved: Assembly | null
  materials: Material[]
  diff: AssemblyDiff | null
  stale: boolean
  finalized: boolean
  busy: boolean
}>()
const emit = defineEmits<{
  recover: []
  discard: []
  saveAs: []
}>()

const newSummary = computed(() =>
  props.saved ? [] : describeNewAssembly(props.record.assembly, props.materials),
)

function materialName(materialId: string): string {
  return props.materials.find((material) => material.id === materialId)?.name ?? '材料已删除'
}
</script>

<template>
  <div
    class="draft-recovery panel"
    role="dialog"
    aria-modal="true"
    aria-labelledby="draft-recovery-title"
  >
    <div class="recovery-heading">
      <div>
        <span class="eyebrow">草稿自动恢复</span>
        <h1 id="draft-recovery-title">发现未保存的草稿</h1>
      </div>
      <span class="draft-time">自动保存于 {{ date(record.updatedAt) }}</span>
    </div>
    <p class="recovery-intro">
      上次会话异常关闭或刷新时，编辑区有尚未正式保存的内容。草稿与正式数据分开存放，不会自动覆盖任何已保存构造。请先核对下面的差异，再决定如何处理。
    </p>

    <div
      v-if="stale"
      class="recovery-warning"
      role="alert"
    >
      <strong>草稿基于正式版本修订 {{ record.baseRevision }}</strong
      >，但该构造之后已在别处保存到修订
      {{
        saved?.revision
      }}。恢复后若直接保存，系统会再次要求确认；选择“另存为新构造”则完全不改动正式版本。
    </div>
    <div
      v-if="finalized"
      class="recovery-warning"
      role="alert"
    >
      该构造目前已定稿，草稿不能直接覆盖正式版本。可以另存为新构造，或恢复后仅作查看。
    </div>

    <section class="diff-section">
      <h2>
        {{ saved ? `与最近保存版本（修订 ${saved.revision}）的差异` : '尚未保存过的新构造' }}
      </h2>

      <template v-if="saved && diff">
        <p
          v-if="!diff.hasChanges"
          class="diff-empty"
        >
          草稿内容与最近保存版本完全一致，无需恢复，可直接放弃草稿。
        </p>
        <template v-else>
          <div
            v-if="diff.fieldChanges.length"
            class="table-scroll"
          >
            <table>
              <caption>
                基本条件差异
              </caption>
              <thead>
                <tr>
                  <th>字段</th>
                  <th>正式保存版本</th>
                  <th>草稿</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="change in diff.fieldChanges"
                  :key="change.label"
                >
                  <th>{{ change.label }}</th>
                  <td>{{ change.saved }}</td>
                  <td class="draft-cell">{{ change.draft }}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div
            v-if="diff.addedLayers.length"
            class="layer-diff-group"
          >
            <h3>新增的构造层</h3>
            <ul>
              <li
                v-for="layer in diff.addedLayers"
                :key="layer.id"
              >
                {{ materialName(layer.materialId) }} · 厚度 {{ layer.thickness }} 毫米 · 损耗
                {{ layer.loss }}% · 寿命 {{ layer.lifespan }} 年
              </li>
            </ul>
          </div>
          <div
            v-if="diff.removedLayers.length"
            class="layer-diff-group"
          >
            <h3>草稿中删除的构造层</h3>
            <ul>
              <li
                v-for="layer in diff.removedLayers"
                :key="layer.id"
              >
                {{ materialName(layer.materialId) }} · 厚度 {{ layer.thickness }} 毫米
              </li>
            </ul>
          </div>
          <div
            v-if="diff.changedLayers.length"
            class="table-scroll"
          >
            <table>
              <caption>
                构造层参数差异
              </caption>
              <thead>
                <tr>
                  <th>层位</th>
                  <th>字段</th>
                  <th>正式保存版本</th>
                  <th>草稿</th>
                </tr>
              </thead>
              <tbody>
                <template
                  v-for="group in diff.changedLayers"
                  :key="group.index"
                >
                  <tr
                    v-for="detail in group.details"
                    :key="`${group.index}-${detail.label}`"
                  >
                    <th>第 {{ group.index }} 层 · {{ group.materialName }}</th>
                    <th>{{ detail.label }}</th>
                    <td>{{ detail.saved }}</td>
                    <td class="draft-cell">{{ detail.draft }}</td>
                  </tr>
                </template>
              </tbody>
            </table>
          </div>
          <p
            v-if="diff.movedLayers.length"
            class="moved-note"
          >
            另有 {{ diff.movedLayers.length }} 个构造层调整了排列顺序。
          </p>
        </template>
      </template>

      <template v-else>
        <div class="table-scroll">
          <table>
            <caption>
              草稿内容概览
            </caption>
            <tbody>
              <tr
                v-for="item in newSummary"
                :key="item.label"
              >
                <th>{{ item.label }}</th>
                <td class="draft-cell">{{ item.value }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p class="moved-note">保存为正式构造后，才会出现在构造选择列表中。</p>
      </template>
    </section>

    <div class="recovery-actions">
      <button
        class="button"
        :disabled="busy"
        @click="emit('discard')"
      >
        放弃草稿
      </button>
      <button
        class="button"
        :disabled="busy"
        @click="emit('saveAs')"
      >
        另存为新构造
      </button>
      <button
        class="button primary"
        :disabled="busy || finalized"
        :title="finalized ? '正式构造已定稿，不能直接覆盖，请另存为新构造。' : ''"
        @click="emit('recover')"
      >
        恢复到编辑区
      </button>
    </div>
  </div>
</template>

<style scoped>
.draft-recovery {
  margin-bottom: 24px;
  border-color: #d8cfa6;
}
.recovery-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 18px;
}
.draft-time {
  font-size: 11px;
  color: var(--muted);
  white-space: nowrap;
}
.recovery-intro {
  font-size: 13px;
  color: var(--muted);
  line-height: 1.9;
  margin: 12px 0 18px;
}
.recovery-warning {
  background: #fcf3de;
  border: 1px solid #e5d7af;
  color: #73581e;
  border-radius: 6px;
  padding: 12px 16px;
  font-size: 12px;
  line-height: 1.8;
  margin-bottom: 18px;
}
.diff-section h2 {
  font-size: 15px;
  margin-bottom: 12px;
}
.diff-section h3 {
  font-size: 13px;
  margin: 14px 0 8px;
}
.diff-empty {
  font-size: 13px;
  color: var(--green);
  background: var(--green-pale);
  border-radius: 6px;
  padding: 12px 16px;
}
.draft-cell {
  color: var(--green);
  font-weight: 500;
  white-space: normal;
}
.layer-diff-group ul {
  margin: 0;
  padding-left: 20px;
  font-size: 12px;
  line-height: 2;
}
.layer-diff-group li {
  font-variant-numeric: tabular-nums;
}
.moved-note {
  font-size: 12px;
  color: var(--muted);
  margin: 10px 0 0;
}
.recovery-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  border-top: 1px solid var(--line);
  margin-top: 22px;
  padding-top: 20px;
  flex-wrap: wrap;
}
@media (max-width: 740px) {
  .recovery-heading {
    flex-direction: column;
    gap: 8px;
  }
  .recovery-actions {
    flex-direction: column-reverse;
  }
}
</style>
