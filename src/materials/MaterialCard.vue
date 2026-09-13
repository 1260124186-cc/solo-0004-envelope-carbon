<script setup lang="ts">
import type { Material } from './types'
import type { Evidence } from '../evidence/types'
import { kindLabels, kindColors } from './types'
import { number } from '../shared/format'
import MaterialEvidence from './MaterialEvidence.vue'
defineProps<{ material: Material; evidence: Evidence[] }>()
const emit = defineEmits<{ register: [materialId: string] }>()
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
    <dl class="material-properties">
      <div>
        <dt>密度</dt>
        <dd>{{ number(material.density) }} <small>千克/立方米</small></dd>
      </div>
      <div>
        <dt>导热系数</dt>
        <dd>{{ number(material.conductivity) }} <small>瓦/米·开尔文</small></dd>
      </div>
      <div>
        <dt>碳因子</dt>
        <dd>{{ number(material.factor) }} <small>千克当量/千克</small></dd>
      </div>
      <div>
        <dt>参考寿命</dt>
        <dd>{{ material.lifespan }} <small>年</small></dd>
      </div>
    </dl>
    <p class="material-source">{{ material.source }}</p>
    <MaterialEvidence
      :material="material"
      :evidence="evidence"
      @register="emit('register', $event)"
    />
  </section>
</template>

<style scoped>
.material-card {
  border: 1px solid var(--line);
  border-top: 3px solid;
  border-radius: 5px;
  padding: 20px;
  background: var(--paper);
  display: flex;
  flex-direction: column;
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
.material-properties {
  margin: 20px 0;
}
.material-properties div {
  display: flex;
  justify-content: space-between;
  font-size: 11px;
  margin: 12px 0;
}
.material-properties dt {
  color: var(--muted);
}
.material-properties dd {
  margin: 0;
}
.material-properties small {
  font-size: 9px;
  color: var(--muted);
}
.material-source {
  font-size: 10px;
  border-top: 1px solid var(--line);
  padding-top: 12px;
  color: var(--muted);
}
</style>
