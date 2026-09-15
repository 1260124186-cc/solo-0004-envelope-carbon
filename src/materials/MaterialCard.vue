<script setup lang="ts">
import { ref } from 'vue'
import type { Material } from './types'
import { kindLabels, kindColors } from './types'
import { number, full } from '../shared/format'

defineProps<{ material: Material }>()
const showFull = ref(false)

const properties = [
  { key: 'density', label: '密度', unit: '千克/立方米' },
  { key: 'conductivity', label: '导热系数', unit: '瓦/米·开尔文' },
  { key: 'factor', label: '碳因子', unit: '千克当量/千克' },
  { key: 'lifespan', label: '参考寿命', unit: '年' },
] as const
</script>

<template>
  <section
    class="material-card"
    :style="{ borderTopColor: kindColors[material.kind] }"
  >
    <div class="card-topline">
      <span>{{ kindLabels[material.kind] }}</span
      ><span>{{ material.custom ? '自定义物性' : '教学示例' }}</span>
    </div>
    <h2>{{ material.name }}</h2>
    <p class="material-description">{{ material.description || '无补充说明。' }}</p>
    <div class="properties-head">
      <span class="properties-title">物性参数</span>
      <button
        type="button"
        class="precision-toggle"
        :aria-expanded="showFull"
        @click="showFull = !showFull"
      >
        {{ showFull ? '收起完整精度' : '查看完整精度' }}
      </button>
    </div>
    <dl class="material-properties">
      <div
        v-for="property in properties"
        :key="property.key"
      >
        <dt>{{ property.label }}</dt>
        <dd>
          <span
            v-if="!showFull"
            class="value-line"
            >{{ number(material[property.key]) }} <small>{{ property.unit }}</small></span
          >
          <template v-else>
            <span class="value-detail">
              界面显示：{{ number(material[property.key]) }} {{ property.unit }}
            </span>
            <span class="value-detail stored">
              存储值（参与计算）：{{ full(material[property.key]) }} {{ property.unit }}
            </span>
          </template>
        </dd>
      </div>
    </dl>
    <p
      v-if="showFull"
      class="precision-note"
    >
      界面数值按两位小数（小于 1
      时按三位有效数字）四舍五入显示；实际保存并参与计算的是下方完整存储值，不因显示而改变。
    </p>
    <p class="material-source">{{ material.source }}</p>
  </section>
</template>

<style scoped>
.material-card {
  border: 1px solid var(--line);
  border-top: 3px solid;
  border-radius: 5px;
  padding: 20px;
  background: var(--paper);
}
.card-topline {
  display: flex;
  justify-content: space-between;
  font-size: 10px;
  color: var(--muted);
}
.material-card h2 {
  margin: 15px 0 8px;
  font-size: 18px;
}
.material-description {
  color: var(--muted);
  font-size: 11px;
  line-height: 1.7;
  min-height: 38px;
}
.properties-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 16px 0 4px;
}
.properties-title {
  font-size: 10px;
  color: var(--muted);
  letter-spacing: 0.5px;
}
.precision-toggle {
  border: 1px solid #cfd8ca;
  background: var(--paper);
  color: var(--green);
  border-radius: 4px;
  padding: 4px 9px;
  font-size: 10px;
  line-height: 1.4;
}
.precision-toggle:hover {
  border-color: var(--green);
  background: #edf2e9;
}
.material-properties {
  margin: 8px 0 12px;
}
.material-properties div {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  font-size: 11px;
  margin: 12px 0;
}
.material-properties dt {
  color: var(--muted);
  flex-shrink: 0;
}
.material-properties dd {
  margin: 0;
  text-align: right;
}
.value-line {
  display: block;
}
.material-properties small {
  font-size: 9px;
  color: var(--muted);
}
.value-detail {
  display: block;
  font-size: 10px;
  color: var(--muted);
  line-height: 1.7;
  white-space: nowrap;
}
.value-detail.stored {
  color: var(--ink);
  font-variant-numeric: tabular-nums;
}
.precision-note {
  margin: 0 0 12px;
  font-size: 10px;
  line-height: 1.7;
  color: var(--muted);
  background: #f3f5ec;
  border-radius: 4px;
  padding: 8px 10px;
}
.material-source {
  font-size: 10px;
  border-top: 1px solid var(--line);
  padding-top: 12px;
  color: var(--muted);
}
</style>
