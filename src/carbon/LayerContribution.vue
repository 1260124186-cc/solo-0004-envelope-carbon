<script setup lang="ts">
import type { LayerResult } from './types'
import { number } from '../shared/format'
defineProps<{ layers: LayerResult[] }>()
</script>

<template>
  <details class="layer-contribution">
    <summary>
      逐层计算依据 <span>{{ layers.length }} 层</span>
    </summary>
    <ol class="contribution-list">
      <li
        v-for="layer in layers"
        :key="layer.layerId"
      >
        <div>
          <strong>{{ layer.materialName }}</strong
          ><span>{{ number(layer.total) }} 千克当量/平方米</span>
        </div>
        <p>质量 {{ number(layer.mass) }} 千克/平方米 · 替换 {{ layer.cycles }} 次</p>
        <p>热阻 {{ number(layer.resistance) }} 平方米·开尔文/瓦</p>
      </li>
    </ol>
  </details>
</template>

<style scoped>
.layer-contribution {
  border-top: 1px solid var(--line);
  padding: 18px 24px;
}
.layer-contribution summary {
  cursor: pointer;
  font-size: 12px;
}
.layer-contribution summary span {
  float: right;
  color: var(--muted);
  font-size: 10px;
}
.contribution-list {
  margin-bottom: 0;
  padding-left: 16px;
}
.contribution-list li {
  padding: 12px 0;
  font-size: 10px;
}
.contribution-list li + li {
  border-top: 1px solid var(--line);
}
.contribution-list li div {
  display: flex;
  justify-content: space-between;
  gap: 8px;
}
.contribution-list strong {
  font-weight: 500;
}
.contribution-list p {
  margin: 5px 0 0;
  color: var(--muted);
}
</style>
