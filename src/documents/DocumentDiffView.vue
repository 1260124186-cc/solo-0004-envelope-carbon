<script setup lang="ts">
import type { DocumentDiff, LayerDiff } from './diff'
import { date, number, signed } from '../shared/format'
import { surfaceLabels } from '../assemblies/types'

const props = defineProps<{ diff: DocumentDiff }>()

function layerName(layer: LayerDiff, side: 'before' | 'after'): string {
  const view = side === 'before' ? layer.before : layer.after
  return view?.result?.materialName ?? view?.material?.name ?? '未知材料'
}
function position(layer: LayerDiff, side: 'before' | 'after'): string {
  const value = side === 'before' ? layer.beforePosition : layer.afterPosition
  return value === null ? '—' : `第 ${value + 1} 层`
}
const badgeClass: Record<string, string> = {
  added: 'badge add',
  removed: 'badge remove',
}
</script>

<template>
  <section
    class="document-diff"
    aria-label="两版计算书对照"
  >
    <div class="diff-heading">
      <div>
        <span class="eyebrow">两版对照</span>
        <h2>
          修订 {{ props.diff.before.assembly.revision }} → 修订
          {{ props.diff.after.assembly.revision }}
        </h2>
      </div>
      <div class="diff-versions">
        <small>基准版本（旧）</small>
        <strong>{{ date(props.diff.before.createdAt) }}</strong>
        <span aria-hidden="true">→</span>
        <small>对照版本（新）</small>
        <strong>{{ date(props.diff.after.createdAt) }}</strong>
      </div>
    </div>
    <p class="diff-basis">
      对照只读取两份计算书各自冻结的构造、材料物性与结果，不用当前材料目录重算旧参数。差值均为新版减去旧版，正值代表增加。
    </p>

    <div class="diff-summary">
      <span class="eyebrow">生命周期强度变化</span>
      <strong data-check="diff-intensity-delta">
        {{ signed(props.diff.after.result.intensity - props.diff.before.result.intensity) }}
      </strong>
      <small>千克二氧化碳当量 / 平方米</small>
      <p v-if="props.diff.intensityPercent !== null">
        相对旧版 <b>{{ signed(props.diff.intensityPercent) }}%</b>
      </p>
      <p v-else>旧版强度为零，不计算变化比例。</p>
    </div>

    <div class="table-scroll">
      <table>
        <caption>
          基本口径
        </caption>
        <thead>
          <tr>
            <th scope="col">项目</th>
            <th scope="col">旧版</th>
            <th scope="col">新版</th>
            <th scope="col">变化</th>
          </tr>
        </thead>
        <tbody>
          <tr :class="{ changed: props.diff.area.delta !== 0 }">
            <th scope="row">构造面积（平方米）</th>
            <td>{{ number(props.diff.area.before) }}</td>
            <td>{{ number(props.diff.area.after) }}</td>
            <td>{{ signed(props.diff.area.delta) }}</td>
          </tr>
          <tr :class="{ changed: props.diff.years.before !== props.diff.years.after }">
            <th scope="row">计算年限（年）</th>
            <td>{{ props.diff.years.before }}</td>
            <td>{{ props.diff.years.after }}</td>
            <td>{{ signed(props.diff.years.after - props.diff.years.before) }}</td>
          </tr>
          <tr :class="{ changed: props.diff.surface.before !== props.diff.surface.after }">
            <th scope="row">建筑部位</th>
            <td>{{ surfaceLabels[props.diff.surface.before] }}</td>
            <td>{{ surfaceLabels[props.diff.surface.after] }}</td>
            <td>
              {{ props.diff.surface.before === props.diff.surface.after ? '无变化' : '部位已调整' }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <section class="diff-layers">
      <h3>材料层变化</h3>
      <p class="muted hint">
        按层的稳定标识配对，不按显示行号；「顺序调整」只表示同一层在室外—室内序列中的相对位置改变。
      </p>
      <div
        v-for="layer in props.diff.layers"
        :key="layer.layerId"
        class="layer-diff"
        data-check="diff-layer"
        :data-kind="layer.kind"
      >
        <div class="layer-diff-head">
          <span
            v-if="layer.kind === 'added'"
            :class="badgeClass.added"
            >新增层</span
          >
          <span
            v-else-if="layer.kind === 'removed'"
            :class="badgeClass.removed"
            >删除层</span
          >
          <template v-else>
            <span
              v-if="layer.moved"
              class="badge moved"
              data-check="diff-layer-moved"
              >顺序调整</span
            >
            <span
              v-if="layer.replacedMaterial"
              class="badge replaced"
              data-check="diff-layer-replaced"
              >材料替换</span
            >
            <span
              v-if="layer.parameterChanges.length"
              class="badge param"
              data-check="diff-layer-param"
              >参数调整（{{ layer.parameterChanges.length }}）</span
            >
            <span
              v-if="layer.propertyChanges.length"
              class="badge property"
              data-check="diff-layer-property"
              >冻结物性差异（{{ layer.propertyChanges.length }}）</span
            >
            <span
              v-if="layer.unchanged"
              class="badge same"
              >无变化</span
            >
          </template>
          <strong class="layer-diff-name">{{
            layerName(layer, 'after') !== '未知材料'
              ? layerName(layer, 'after')
              : layerName(layer, 'before')
          }}</strong>
          <span class="layer-diff-position"
            >{{ position(layer, 'before') }} → {{ position(layer, 'after') }}</span
          >
        </div>

        <div
          v-if="layer.kind === 'matched'"
          class="layer-diff-body"
        >
          <div
            v-if="layer.replacedMaterial"
            class="diff-line replaced-line"
          >
            <span class="diff-label">材料</span>
            <span class="diff-value">{{ layerName(layer, 'before') }}</span>
            <span class="diff-arrow">→</span>
            <span class="diff-value">{{ layerName(layer, 'after') }}</span>
          </div>
          <div
            v-for="change in layer.parameterChanges"
            :key="change.key"
            class="diff-line"
          >
            <span class="diff-label">{{ change.label }}（{{ change.unit }}）</span>
            <span class="diff-value">{{ number(change.before) }}</span>
            <span class="diff-arrow">→</span>
            <span class="diff-value">{{ number(change.after) }}</span>
            <span class="diff-delta">{{ signed(change.delta) }}</span>
          </div>
          <div
            v-for="change in layer.propertyChanges"
            :key="change.key"
            class="diff-line"
          >
            <span class="diff-label">{{ change.label }}</span>
            <span class="diff-value">{{ change.before }}</span>
            <span class="diff-arrow">→</span>
            <span class="diff-value">{{ change.after }}</span>
          </div>
          <div
            v-if="layer.cyclesChange"
            class="diff-line"
          >
            <span class="diff-label">替换次数</span>
            <span class="diff-value">{{ layer.cyclesChange.before }}</span>
            <span class="diff-arrow">→</span>
            <span class="diff-value">{{ layer.cyclesChange.after }}</span>
          </div>
          <div
            v-if="layer.carbonChange"
            class="diff-line layer-carbon"
          >
            <span class="diff-label">该层隐含碳（千克当量/平方米）</span>
            <span class="diff-value">{{ number(layer.carbonChange.before) }}</span>
            <span class="diff-arrow">→</span>
            <span class="diff-value">{{ number(layer.carbonChange.after) }}</span>
            <span class="diff-delta">{{ signed(layer.carbonChange.delta) }}</span>
          </div>
        </div>

        <div
          v-else
          class="layer-diff-body side-list"
        >
          <div>
            <small v-if="layer.before">
              厚 {{ number(layer.before.layer.thickness) }} 毫米 · 损耗
              {{ number(layer.before.layer.loss) }}% · 寿命 {{ layer.before.layer.lifespan }} 年
            </small>
            <small v-else>新版新增</small>
          </div>
          <div>
            <small v-if="layer.after">
              厚 {{ number(layer.after.layer.thickness) }} 毫米 · 损耗
              {{ number(layer.after.layer.loss) }}% · 寿命 {{ layer.after.layer.lifespan }} 年
            </small>
            <small v-else>旧版存在，新版已删除</small>
          </div>
        </div>
      </div>
    </section>

    <div class="table-scroll">
      <table>
        <caption>
          最终结果
        </caption>
        <thead>
          <tr>
            <th scope="col">计算项</th>
            <th scope="col">旧版</th>
            <th scope="col">新版</th>
            <th scope="col">差值</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="row in props.diff.results"
            :key="row.key"
            :class="{ changed: row.delta !== 0 }"
          >
            <th scope="row">{{ row.label }}（{{ row.unit }}）</th>
            <td>{{ number(row.before) }}</td>
            <td>{{ number(row.after) }}</td>
            <td :data-check="row.key === 'intensity' ? 'diff-result-intensity' : undefined">
              {{ signed(row.delta) }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <ul
      v-if="props.diff.passChanges.length"
      class="pass-changes"
    >
      <li
        v-for="change in props.diff.passChanges"
        :key="change.key"
      >
        {{ change.label }}：{{ change.before ? '满足' : '不满足' }} →
        {{ change.after ? '满足' : '不满足' }}
      </li>
    </ul>
  </section>
</template>

<style scoped>
.document-diff {
  background: var(--paper);
  border: 1px solid var(--line);
  border-radius: 6px;
  padding: 28px;
  max-width: 960px;
}
.diff-heading {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 20px;
  border-bottom: 2px solid var(--green);
  padding-bottom: 18px;
}
.diff-heading h2 {
  margin: 8px 0 0;
  font-size: 21px;
}
.diff-versions {
  display: grid;
  grid-template-columns: auto auto;
  gap: 2px 12px;
  text-align: right;
  align-items: center;
  font-size: 12px;
}
.diff-versions span {
  grid-row: span 2;
  color: var(--green);
  font-size: 16px;
}
.diff-versions small {
  color: var(--muted);
  font-size: 10px;
}
.diff-basis {
  font-size: 11px;
  color: var(--muted);
  line-height: 1.8;
  margin: 14px 0;
}
.diff-summary {
  background: var(--green-pale);
  border-left: 3px solid var(--green);
  padding: 20px 24px;
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
  margin-bottom: 8px;
}
.diff-summary strong {
  font-size: 34px;
  font-weight: 500;
  color: var(--green);
}
.diff-summary small {
  font-size: 11px;
  color: var(--muted);
}
.diff-summary p {
  flex-basis: 100%;
  margin: 0;
  font-size: 12px;
}
.diff-summary b {
  font-weight: 600;
}
tr.changed {
  background: #faf7ec;
}
.diff-layers h3 {
  font-size: 14px;
  margin: 24px 0 4px;
}
.diff-layers .hint {
  font-size: 11px;
  margin: 0 0 14px;
}
.layer-diff {
  border: 1px solid var(--line);
  border-radius: 6px;
  padding: 14px 16px;
  margin-bottom: 10px;
  background: #fffefb;
}
.layer-diff-head {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}
.layer-diff-name {
  font-size: 13px;
  font-weight: 600;
}
.layer-diff-position {
  margin-left: auto;
  font-size: 11px;
  color: var(--muted);
  font-variant-numeric: tabular-nums;
}
.badge {
  font-size: 10px;
  padding: 3px 8px;
  border-radius: 999px;
  white-space: nowrap;
}
.badge.add {
  background: #e3eee4;
  color: #235f3a;
}
.badge.remove {
  background: #f3e1dc;
  color: #8c3c29;
}
.badge.moved {
  background: #e7ecef;
  color: #2f4a5c;
}
.badge.replaced {
  background: #f6ead2;
  color: #7c5b1e;
}
.badge.param {
  background: #fbf3dd;
  color: #865629;
}
.badge.property {
  background: #efe8f1;
  color: #5f3f6b;
}
.badge.same {
  background: #f1f2ec;
  color: var(--muted);
}
.layer-diff-body {
  margin-top: 10px;
  display: grid;
  gap: 6px;
}
.diff-line {
  display: grid;
  grid-template-columns: minmax(150px, 1.4fr) 1fr 18px 1fr auto;
  align-items: center;
  gap: 10px;
  font-size: 12px;
}
.diff-label {
  color: var(--muted);
  font-size: 11px;
}
.diff-value {
  font-variant-numeric: tabular-nums;
  word-break: break-all;
  white-space: normal;
}
.diff-arrow {
  color: var(--green);
  text-align: center;
}
.diff-delta {
  font-variant-numeric: tabular-nums;
  color: var(--green);
  font-weight: 600;
  min-width: 70px;
  text-align: right;
}
.replaced-line .diff-value {
  font-weight: 600;
}
.side-list {
  grid-template-columns: 1fr 1fr;
  gap: 6px 24px;
}
.side-list small {
  color: var(--muted);
  font-size: 11px;
  line-height: 1.7;
}
.layer-carbon {
  border-top: 1px dashed var(--line);
  padding-top: 6px;
}
.pass-changes {
  font-size: 12px;
  color: #7c5b1e;
  background: #fcf3de;
  border-radius: 4px;
  padding: 12px 28px;
  margin: 8px 0 0;
}
@media (max-width: 640px) {
  .document-diff {
    padding: 18px;
  }
  .diff-heading {
    flex-direction: column;
  }
  .diff-versions {
    text-align: left;
  }
  .diff-line {
    grid-template-columns: 1fr 1fr;
  }
  .diff-line .diff-arrow,
  .diff-line .diff-delta {
    grid-column: 2;
    text-align: left;
  }
  .side-list {
    grid-template-columns: 1fr;
  }
}
</style>
