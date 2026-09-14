<script setup lang="ts">
import { computed } from 'vue'
import type { Assembly } from '../assemblies/types'
import type { Material } from '../materials/types'
import type { Calculation } from '../carbon/types'
import type { PhaseSnapshot, SnapshotEntry } from './types'
import { surfaceLabels, stateLabels } from '../assemblies/types'
import { kindLabels } from '../materials/types'
import { calculate } from '../carbon/engine'
import { entryReference } from './reference'
import type { EntryReference } from './reference'
import { number, date } from '../shared/format'

const props = defineProps<{
  snapshot: PhaseSnapshot
  assemblies: Assembly[]
  materials: Material[]
}>()

function recalculate(entry: SnapshotEntry): Calculation | null {
  try {
    return calculate(entry.assembly, entry.materials)
  } catch {
    return null
  }
}

const entries = computed(() =>
  props.snapshot.entries.map((entry) => ({
    entry,
    reference: entryReference(entry, props.assemblies, props.materials),
    result: recalculate(entry),
  })),
)

function layerMaterial(entry: SnapshotEntry, materialId: string): Material | undefined {
  return entry.materials.find((material) => material.id === materialId)
}

function missingMaterialsNote(reference: EntryReference): string {
  return `材料 ${reference.missingMaterials.join('、')} 已不在当前材料目录（引用缺失），下表为快照留存的物性。`
}

function changedNote(reference: EntryReference, entry: SnapshotEntry): string {
  return `原构造已有新变化（当前修订 ${reference.currentRevision}），本快照保持修订 ${entry.assemblyRevision} 时的内容。`
}
</script>

<template>
  <article
    class="snapshot-sheet"
    aria-label="阶段快照记录"
  >
    <div class="snapshot-title">
      <div>
        <span class="eyebrow">阶段记录 · 非定稿</span>
        <h2>{{ snapshot.name }}</h2>
      </div>
      <span class="snapshot-seal">阶段快照<br />{{ snapshot.entries.length }} 个构造</span>
    </div>
    <p class="snapshot-meta">
      {{ date(snapshot.createdAt) }} 生成 · 生成后原构造与材料的修改不会回写本记录
    </p>
    <p
      v-if="snapshot.note"
      class="snapshot-note"
    >
      {{ snapshot.note }}
    </p>
    <p class="snapshot-scope">
      本快照为阶段整体留存，不改变构造状态，也不是定稿计算书。下列数值由冻结输入实时重算，仅作阶段参考；正式冻结结果与下载以计算书为准。
    </p>
    <section
      v-for="{ entry, reference, result } in entries"
      :key="entry.assemblyId"
      class="snapshot-entry"
    >
      <div class="entry-heading">
        <h3>{{ entry.assembly.name }}</h3>
        <span class="muted">
          快照时修订 {{ entry.assemblyRevision }} · {{ stateLabels[entry.assembly.state] }}
        </span>
      </div>
      <p class="entry-meta">
        {{ surfaceLabels[entry.assembly.surface] }} · {{ number(entry.assembly.area) }} 平方米 ·
        {{ entry.assembly.years }} 年计算期
      </p>
      <p
        v-if="reference.assembly === 'missing'"
        class="inline-warning"
      >
        原构造已不在当前设计中（引用缺失），以下为快照留存的内容。
      </p>
      <p
        v-else-if="reference.assembly === 'changed'"
        class="inline-warning"
      >
        {{ changedNote(reference, entry) }}
      </p>
      <p
        v-else
        class="reference-ok"
      >
        与原构造当前版本一致。
      </p>
      <p
        v-if="reference.missingMaterials.length"
        class="inline-warning"
      >
        {{ missingMaterialsNote(reference) }}
      </p>
      <div class="table-scroll">
        <table>
          <caption>
            快照留存的构造层（室外至室内）
          </caption>
          <thead>
            <tr>
              <th scope="col">材料</th>
              <th scope="col">厚度（毫米）</th>
              <th scope="col">损耗（%）</th>
              <th scope="col">替换寿命（年）</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="layer in entry.assembly.layers"
              :key="layer.id"
            >
              <th scope="row">{{ layerMaterial(entry, layer.materialId)?.name ?? '未知材料' }}</th>
              <td>{{ number(layer.thickness) }}</td>
              <td>{{ number(layer.loss) }}</td>
              <td>{{ layer.lifespan }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <ul class="entry-materials">
        <li
          v-for="material in entry.materials"
          :key="material.id"
        >
          <strong>{{ material.name }}</strong>
          （{{ kindLabels[material.kind] }}）· 密度 {{ number(material.density) }} 千克/立方米 ·
          导热系数 {{ number(material.conductivity) }} · 碳因子 {{ number(material.factor) }} ·
          参考寿命 {{ material.lifespan }} 年
          <small>来源：{{ material.source }}</small>
        </li>
      </ul>
      <div
        v-if="result"
        class="entry-result"
      >
        <span
          >生命周期强度
          <strong data-check="snapshot-intensity">{{ number(result.intensity) }}</strong>
          千克当量/平方米</span
        >
        <span>构造总隐含碳 {{ number(result.whole) }} 千克当量</span>
        <span>简化传热系数 {{ number(result.transmittance) }}</span>
      </div>
      <p
        v-else
        class="inline-warning"
      >
        冻结输入无法按当前算法重算，请以留存的构造层与物性为准。
      </p>
      <p class="entry-result-note">由快照冻结输入实时重算 · 阶段参考，非定稿结果</p>
    </section>
  </article>
</template>

<style scoped>
.snapshot-sheet {
  background: var(--paper);
  border: 1px dashed #c8c2ae;
  padding: 32px;
  border-radius: 6px;
}
.snapshot-title {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 20px;
  border-bottom: 2px solid #b6a050;
  padding-bottom: 20px;
}
.snapshot-title h2 {
  font-size: 24px;
  margin: 12px 0 0;
}
.snapshot-seal {
  color: #73581e;
  border: 1px dashed #b6a050;
  font-size: 11px;
  text-align: center;
  padding: 8px 14px;
  line-height: 1.6;
  white-space: nowrap;
}
.snapshot-meta {
  font-size: 11px;
  color: var(--muted);
  line-height: 1.8;
}
.snapshot-note {
  font-size: 12px;
  line-height: 1.8;
  white-space: pre-wrap;
  background: #f6f7f0;
  border-radius: 4px;
  padding: 12px 16px;
}
.snapshot-scope {
  font-size: 11px;
  color: #73581e;
  background: #fff8e7;
  border: 1px solid #e5d7af;
  border-radius: 4px;
  padding: 12px 16px;
  line-height: 1.8;
}
.snapshot-entry {
  border-top: 1px solid var(--line);
  margin-top: 24px;
  padding-top: 20px;
}
.entry-heading {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 16px;
  flex-wrap: wrap;
}
.entry-heading h3 {
  margin: 0;
}
.entry-meta {
  font-size: 11px;
  color: var(--muted);
  margin: 8px 0 16px;
}
.reference-ok {
  font-size: 11px;
  color: var(--green);
}
.entry-materials {
  list-style: none;
  padding: 0;
  margin: 0;
  font-size: 11px;
  line-height: 1.9;
  color: var(--muted);
}
.entry-materials strong {
  color: var(--ink);
  font-weight: 600;
}
.entry-materials small {
  display: block;
}
.entry-result {
  display: flex;
  gap: 24px;
  flex-wrap: wrap;
  border-top: 1px solid var(--line);
  margin-top: 16px;
  padding-top: 16px;
  font-size: 11px;
  color: var(--muted);
}
.entry-result strong {
  font-size: 20px;
  font-weight: 500;
  color: var(--ink);
  font-variant-numeric: tabular-nums;
}
.entry-result-note {
  font-size: 10px;
  color: var(--muted);
  margin: 8px 0 0;
}
@media (max-width: 600px) {
  .snapshot-sheet {
    padding: 20px;
  }
}
</style>
