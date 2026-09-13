<script setup lang="ts">
import type { ThermalBasis } from './types'
import { basisStateLabels } from './types'
import { number } from '../shared/format'
defineProps<{ basis: ThermalBasis; usage: number; busy: boolean }>()
const emit = defineEmits<{ retire: [id: string] }>()
</script>

<template>
  <section class="basis-card">
    <div class="card-topline">
      <span>{{ basisStateLabels[basis.state] }}</span
      ><span>{{ usage }} 个构造选用</span>
    </div>
    <h2>{{ basis.name }}</h2>
    <dl class="basis-properties">
      <div>
        <dt>内表面热阻</dt>
        <dd>{{ number(basis.inner) }} <small>平方米·开尔文/瓦</small></dd>
      </div>
      <div>
        <dt>外表面热阻</dt>
        <dd>{{ number(basis.outer) }} <small>平方米·开尔文/瓦</small></dd>
      </div>
    </dl>
    <p class="basis-note">依据：{{ basis.note }}</p>
    <button
      v-if="basis.state === 'active'"
      class="button small"
      :disabled="busy"
      @click="emit('retire', basis.id)"
    >
      停用口径
    </button>
    <p
      v-else
      class="basis-retired"
    >
      已停用，不可再选用；已选用的构造与已定稿计算书保持原结果。
    </p>
  </section>
</template>

<style scoped>
.basis-card {
  border: 1px solid var(--line);
  border-top: 3px solid #81a99a;
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
.basis-card h2 {
  margin: 15px 0 8px;
  font-size: 18px;
}
.basis-properties {
  margin: 16px 0;
}
.basis-properties div {
  display: flex;
  justify-content: space-between;
  font-size: 11px;
  margin: 12px 0;
}
.basis-properties dt {
  color: var(--muted);
}
.basis-properties dd {
  margin: 0;
}
.basis-properties small {
  font-size: 9px;
  color: var(--muted);
}
.basis-note {
  font-size: 10px;
  border-top: 1px solid var(--line);
  padding-top: 12px;
  color: var(--muted);
  line-height: 1.7;
  word-break: break-all;
}
.basis-retired {
  font-size: 10px;
  color: var(--muted);
  line-height: 1.7;
  margin-bottom: 0;
}
</style>
