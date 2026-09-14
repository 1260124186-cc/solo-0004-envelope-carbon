<script setup lang="ts">
import type { CarbonDocument } from './types'
import { revisionNote } from './types'
import { number, date } from '../shared/format'
import { revisionKindLabels, surfaceLabels } from '../assemblies/types'
import { downloadDocument } from './download'
defineProps<{ document: CarbonDocument }>()
</script>

<template>
  <section
    class="document-sheet"
    aria-label="冻结计算书"
  >
    <div class="document-title">
      <div>
        <span class="eyebrow">围护构造计算书</span>
        <h2>{{ document.assembly.name }}</h2>
      </div>
      <span class="document-seal">已定稿<br />修订 {{ document.assembly.revision }}</span>
    </div>
    <p class="document-meta">
      {{ surfaceLabels[document.assembly.surface] }} · {{ number(document.assembly.area) }} 平方米 ·
      {{ document.assembly.years }} 年
    </p>
    <p class="document-meta">{{ date(document.createdAt) }} · {{ document.result.method }}</p>
    <p class="document-meta">
      定稿备注：{{
        document.note || revisionNote(document.assembly, document.assembly.revision) || '未填写备注'
      }}
    </p>
    <div class="document-numbers">
      <div>
        <span>生命周期强度</span
        ><strong data-check="frozen-intensity">{{ number(document.result.intensity) }}</strong
        ><small>千克当量 / 平方米</small>
      </div>
      <div>
        <span>整个构造隐含碳</span><strong>{{ number(document.result.whole) }}</strong
        ><small>千克二氧化碳当量</small>
      </div>
      <div>
        <span>简化传热系数</span><strong>{{ number(document.result.transmittance) }}</strong
        ><small>瓦 / 平方米·开尔文</small>
      </div>
    </div>
    <div class="table-scroll">
      <table>
        <caption>
          冻结的逐层计算
        </caption>
        <thead>
          <tr>
            <th scope="col">材料</th>
            <th scope="col">厚度（毫米）</th>
            <th scope="col">替换次数</th>
            <th scope="col">隐含碳（千克当量/平方米）</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="layer in document.result.layers"
            :key="layer.layerId"
          >
            <th scope="row">{{ layer.materialName }}</th>
            <td>{{ number(layer.thickness) }}</td>
            <td>{{ layer.cycles }}</td>
            <td>{{ number(layer.total) }}</td>
          </tr>
        </tbody>
      </table>
    </div>
    <div class="document-notes">
      <h3>设计说明</h3>
      <p>{{ document.assembly.note || '无补充说明。' }}</p>
      <h3>参数来源</h3>
      <p
        v-for="material in document.materials"
        :key="material.id"
      >
        {{ material.name }}：{{ material.source }}
      </p>
      <h3>修订记录</h3>
      <p
        v-for="entry in document.assembly.revisions"
        :key="`${entry.revision}-${entry.kind}`"
      >
        修订 {{ entry.revision }} · {{ revisionKindLabels[entry.kind] }} · {{ date(entry.at)
        }}<br />{{ entry.note || '未填写备注' }}
      </p>
      <p>本计算书冻结生成时的输入与结果，后续构造修改不会改变本版本。</p>
    </div>
    <button
      class="button primary"
      @click="downloadDocument(document)"
    >
      下载计算书
    </button>
  </section>
</template>

<style scoped>
.document-sheet {
  background: var(--paper);
  border: 1px solid var(--line);
  padding: 32px;
  border-radius: 6px;
  max-width: 900px;
}
.document-title {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 20px;
  border-bottom: 2px solid var(--green);
  padding-bottom: 20px;
}
.document-title h2 {
  font-size: 24px;
  margin: 12px 0 0;
}
.document-seal {
  color: var(--green);
  border: 1px solid var(--green);
  font-size: 11px;
  text-align: center;
  padding: 8px 14px;
  line-height: 1.6;
  white-space: nowrap;
}
.document-meta {
  font-size: 11px;
  color: var(--muted);
  line-height: 1.8;
}
.document-numbers {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  border-block: 1px solid var(--line);
  padding: 20px 0;
  margin: 24px 0;
  gap: 16px;
}
.document-numbers span,
.document-numbers small {
  display: block;
  color: var(--muted);
  font-size: 10px;
}
.document-numbers strong {
  display: block;
  font-size: 28px;
  font-weight: 500;
  margin: 8px 0;
}
.document-notes {
  margin: 20px 0;
  font-size: 11px;
  line-height: 1.8;
  white-space: pre-wrap;
}
.document-notes h3 {
  font-size: 12px;
}
@media (max-width: 600px) {
  .document-sheet {
    padding: 20px;
  }
  .document-numbers {
    grid-template-columns: 1fr;
  }
}
</style>
